// Tauri SQL plugin — provides the Database class for executing parameterised SQLite queries
import Database from '@tauri-apps/plugin-sql';
// Import all domain types so mapper functions return strongly-typed objects
import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
// DEFAULT_SETTINGS is returned when no company settings have been saved yet
import { DEFAULT_SETTINGS } from '../constants';

// Singleton DB connection — opened once and reused for every query to avoid repeated open() overhead
let _db: Database | null = null;

// Return the shared DB connection, opening it for the first time if needed.
// All StorageService methods call this before executing SQL.
const getDb = async (): Promise<Database> => {
  if (!_db) {
    _db = await Database.load('sqlite:nhw_data.db'); // Open the SQLite file; creates it if it doesn't exist
  }
  return _db; // Return the cached connection
};

// --- Change notification (simple observer) ---
// A Set of callback functions registered by React components that re-fetch data after mutations
const _listeners = new Set<(type?: string) => void>();
// Fire all registered callbacks; pass an optional topic string so consumers can decide whether to re-fetch
const notifyChange = (type?: string) => {
  _listeners.forEach(cb => {
    try { cb(type); } catch (e) { /* Swallow listener errors to prevent one bad callback from blocking the rest */ }
  });
};

// Simple Hash for password (Browser compatible)
// Uses the Web Crypto API (available in both Tauri's WebView and the browser).
const hashPassword = async (password: string): Promise<string> => {
  try {
    const msgBuffer = new TextEncoder().encode(password); // Encode plain text to bytes
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); // Run SHA-256
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert to byte array
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Join bytes as hex string (64 chars)
  } catch (err) {
    console.error('Hashing error:', err); // Log the failure
    throw err; // Re-throw so the caller can surface an error in the UI
  }
};

// --- Row mappers (snake_case DB → camelCase TS) ---
// SQLite columns use snake_case; TypeScript interfaces use camelCase.
// These small mapper functions centralize the field renaming and numeric coercions.

// Map a raw SQLite products row to a strongly-typed Product object
const mapProductRow = (row: any): Product => ({
  id: row.id,                                      // Auto-incremented PK
  name: row.name,                                  // Product display name
  category: row.category || '',                    // Category string; default empty string if null
  hsnCode: row.hsn_code || '',                     // HSN code (hsn_code → hsnCode)
  unit: row.unit || 'Nos',                         // Unit of measure; default 'Nos'
  packageSize: row.package_size || undefined,      // Optional pack description (package_size → packageSize)
  batchNumber: row.batch_number || undefined,      // Optional batch number (batch_number → batchNumber)
  expiryDate: row.expiry_date || undefined,        // Optional ISO expiry date (expiry_date → expiryDate)
  mrp: Number(row.mrp) || 0,                      // Maximum Retail Price; coerce to number
  discountPercent: Number(row.discount_percent) || 0, // Discount % (discount_percent → discountPercent); coerce
  sellingPrice: Number(row.selling_price) || 0,   // Net selling price; coerce to number (selling_price → sellingPrice)
  purchasePrice: Number(row.purchase_price) || 0, // Cost to pharmacy; coerce to number (purchase_price → purchasePrice)
  gstRate: Number(row.gst_rate) || 0,             // GST percentage; coerce to number (gst_rate → gstRate)
  currentStock: Number(row.current_stock) || 0,   // Live unit count; coerce to number (current_stock → currentStock)
  minStockLevel: Number(row.min_stock_level) || 0, // Low-stock threshold; coerce (min_stock_level → minStockLevel)
});

// Map a raw SQLite customers row to a strongly-typed Customer object
const mapCustomerRow = (row: any): Customer => ({
  id: row.id,                              // Auto-incremented PK
  name: row.name,                          // Customer full name or business name
  phone: row.phone || '',                  // Primary phone; default empty string if null
  email: row.email || undefined,           // Optional email address
  address: row.address || undefined,       // Optional billing/shipping address
  gstin: row.gstin || undefined,           // Optional GSTIN (15-char); null stored as undefined
});

// Map a raw SQLite bills row to a strongly-typed Bill object.
// The 'items' column is stored as a JSON string and must be parsed back to an array.
const mapBillRow = (row: any): Bill => ({
  id: row.id,                                        // Auto-incremented PK
  invoiceNumber: row.invoice_number,                 // Human-readable invoice number (invoice_number → invoiceNumber)
  date: row.date,                                    // ISO date 'YYYY-MM-DD'
  customerId: row.customer_id,                       // FK → customers.id (customer_id → customerId)
  customerName: row.customer_name || '',             // Denormalised customer name snapshot
  customerPhone: row.customer_phone || '',           // Denormalised phone snapshot
  customerAddress: row.customer_address || undefined, // Denormalised address snapshot
  customerGstin: row.customer_gstin || undefined,    // Denormalised GSTIN snapshot
  salesPersonId: row.sales_person_id || 0,           // FK → sales_persons.id (sales_person_id → salesPersonId)
  salesPersonName: row.sales_person_name || '',      // Denormalised salesperson name snapshot
  isGstBill: row.is_gst_bill === 1,                  // SQLite stores boolean as INTEGER 1/0; convert to boolean
  subTotal: Number(row.sub_total) || 0,              // Pre-tax subtotal; coerce (sub_total → subTotal)
  taxableAmount: Number(row.taxable_amount) || 0,    // Taxable base amount; coerce (taxable_amount → taxableAmount)
  cgstAmount: Number(row.cgst_amount) || 0,          // Central GST amount; coerce (cgst_amount → cgstAmount)
  sgstAmount: Number(row.sgst_amount) || 0,          // State GST amount; coerce (sgst_amount → sgstAmount)
  igstAmount: Number(row.igst_amount) || 0,          // Integrated GST amount; coerce (igst_amount → igstAmount)
  totalTax: Number(row.total_tax) || 0,              // Sum of all taxes; coerce (total_tax → totalTax)
  roundOff: Number(row.round_off) || 0,              // Rounding adjustment; coerce (round_off → roundOff)
  grandTotal: Number(row.grand_total) || 0,          // Final customer-pays amount; coerce (grand_total → grandTotal)
  items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []), // Parse JSON string → array
});

// Map a raw SQLite sales_persons row to a SalesPerson object
const mapSalesPersonRow = (row: any): SalesPerson => ({
  id: row.id,                        // Auto-incremented PK
  name: row.name,                    // Salesperson full name
  isActive: row.is_active === 1,     // SQLite INTEGER 1/0 → TypeScript boolean (is_active → isActive)
});

// Map a raw SQLite stock_history row to a StockHistory object
const mapStockHistoryRow = (row: any): StockHistory => ({
  id: row.id,                                  // Auto-incremented PK
  timestamp: row.timestamp,                    // ISO datetime of the movement
  productId: row.product_id,                   // FK → products.id (product_id → productId)
  productName: row.product_name || '',         // Denormalised product name snapshot
  changeAmount: Number(row.change_amount) || 0, // Signed delta (positive = added, negative = deducted)
  reason: row.reason || '',                    // Human-readable movement reason
  referenceId: row.reference_id || undefined,  // Optional invoice number or reference (reference_id → referenceId)
});

// Map a raw SQLite backups row to a BackupRecord object
const mapBackupRow = (row: any): BackupRecord => ({
  id: String(row.id),                    // Convert PK integer to string (BackupRecord.id is string)
  timestamp: row.timestamp,              // ISO datetime when the backup was created
  type: row.type as 'auto' | 'manual',  // 'auto' = scheduled daily, 'manual' = user-triggered
  size: Number(row.size) || 0,          // Byte count of the data JSON string
  data: row.data || '',                 // Full JSON snapshot of all app data
});

// Map a raw SQLite users row to a User object
const mapUserRow = (row: any): User => ({
  username: row.username,                       // Primary key (login username)
  passwordHash: row.password_hash,             // SHA-256 hex hash (password_hash → passwordHash)
  role: row.role as 'admin' | 'user',          // 'admin' = full access; 'user' = restricted
  lastLogin: row.last_login || undefined,      // ISO datetime of last successful login (nullable)
});

// The SQLite-backed implementation of the StorageService API.
// Used at runtime when the app is running inside the Tauri desktop shell
// (detected by window.__TAURI_INTERNALS__ in storage.ts).
export const StorageService = {
  // --- Change Listeners ---
  // Register a callback that runs when any data type changes (products, bills, settings, etc.)
  addChangeListener: (cb: (type?: string) => void) => _listeners.add(cb),
  // Unregister a previously added callback so it stops receiving change events
  removeChangeListener: (cb: (type?: string) => void) => _listeners.delete(cb),

  // --- Settings ---
  // Read the company settings record from the SQLite settings table.
  // Falls back to DEFAULT_SETTINGS if no saved settings row exists yet.
  getSettings: async (): Promise<CompanySettings> => {
    const db = await getDb();  // Get (or open) the shared SQLite connection
    const rows: any[] = await db.select("SELECT value FROM settings WHERE key = 'nhw_settings'"); // Fetch the settings row
    if (rows.length > 0) {      // Row found — attempt to parse the JSON value
      try {
        return JSON.parse(rows[0].value); // Deserialise the stored JSON string to a CompanySettings object
      } catch {
        return DEFAULT_SETTINGS;  // Malformed JSON — fall back to safe defaults
      }
    }
    return DEFAULT_SETTINGS;  // No row yet (first launch) — return built-in defaults
  },

  // Persist the company settings object by upserting a JSON row in the settings table
  saveSettings: async (settings: CompanySettings): Promise<void> => {
    const db = await getDb();               // Get the shared DB connection
    const json = JSON.stringify(settings);  // Serialise settings to JSON string
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('nhw_settings', $1) ON CONFLICT(key) DO UPDATE SET value = $1",
      [json]  // Bind JSON string — updates the value if the key already exists (upsert)
    );
    notifyChange('settings'); // Notify listeners so Settings page UI refreshes immediately
  },

  // --- Auth & Users ---
  // Load all user accounts from SQLite.
  // On first launch (empty table), seeds a default admin account automatically.
  getUsers: async (): Promise<User[]> => {
    try {
      const db = await getDb();                                         // Open DB connection
      const rows: any[] = await db.select("SELECT * FROM users");      // Fetch all user rows
      if (rows.length === 0) {
        // First launch — seed the built-in admin account so the login screen is never blocked
        const defaultAdmin: User = {
          username: 'admin',                                                                        // Default login name
          passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',       // Pre-computed SHA-256 of 'admin123'
          role: 'admin'                                                                            // Full administrator access
        };
        await db.execute(
          "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ($1, $2, $3)",      // OR IGNORE prevents duplicate on race condition
          [defaultAdmin.username, defaultAdmin.passwordHash, defaultAdmin.role]
        );
        return [defaultAdmin]; // Return the freshly seeded admin as the sole user
      }
      return rows.map(mapUserRow); // Map all DB rows to typed User objects
    } catch (err) {
      console.error('Error getting users:', err); // Log SQL errors without crashing the app
      return [];                                  // Return empty array so login screen can still render
    }
  },

  // Insert or update a user row using an upsert (ON CONFLICT updates the existing record)
  saveUser: async (user: User) => {
    const db = await getDb(); // Open DB connection
    await db.execute(
      "INSERT INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4) ON CONFLICT(username) DO UPDATE SET password_hash = $2, role = $3, last_login = $4",
      [user.username, user.passwordHash, user.role, user.lastLogin || null] // null stored as SQL NULL when no lastLogin
    );
    notifyChange('users'); // Notify listeners — Settings user management list will refresh
  },

  // Verify a username + password pair against the stored hash.
  // Returns the authenticated User on success, or null on failure.
  // Also seeds the default admin on the very first login attempt if no users exist.
  verifyCredentials: async (u: string, p: string): Promise<User | null> => {
    try {
      const db = await getDb(); // Open DB connection

      // Ensure the default admin exists before checking credentials on first ever login
      const countResult: any[] = await db.select("SELECT COUNT(*) as cnt FROM users"); // Check total user count
      if (countResult[0]?.cnt === 0) {
        // No users yet — seed the default admin so the login can succeed on first run
        const defaultHash = await hashPassword('admin123'); // Hash the default password at runtime
        await db.execute(
          "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
          ['admin', defaultHash, 'admin'] // Insert default admin with computed hash
        );
      }

      const rows: any[] = await db.select("SELECT * FROM users WHERE username = $1", [u]); // Look up by username
      if (rows.length === 0) return null; // Username not found — fail silently

      const user = mapUserRow(rows[0]);   // Map row to typed User
      const hash = await hashPassword(p); // Hash the supplied password for comparison

      if (user.passwordHash === hash) {
        // Password matches — record the login time and return the authenticated user
        user.lastLogin = new Date().toISOString(); // Capture current UTC time as ISO string
        await db.execute(
          "UPDATE users SET last_login = $1 WHERE username = $2",
          [user.lastLogin, user.username] // Persist the updated lastLogin to SQLite
        );
        notifyChange('users'); // Fire listeners so user-list views reflect the new lastLogin
        return user;           // Return the authenticated user to the caller
      }
      return null; // Password does not match — fail silently (caller shows a generic login error)
    } catch (err) {
      console.error('Auth error:', err); // Log unexpected errors for diagnostics
      return null;                       // Return null so login page can display an error message
    }
  },

  hashPassword, // Export the hashPassword helper so Settings page can hash new passwords before saving

  // --- Products ---
  // Fetch all products from SQLite and return them as typed Product objects
  getProducts: async (): Promise<Product[]> => {
    const db = await getDb();                                     // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM products"); // Fetch all product rows
    return rows.map(mapProductRow);                               // Map each row to a typed Product object
  },

  // Insert a new product (id === 0) or update an existing one.
  // Coerces numeric fields to prevent NaN from HTML form string values.
  saveProduct: async (product: Product): Promise<void> => {
    const db = await getDb();                                      // Open DB connection
    product.currentStock = Number(product.currentStock);           // Coerce to number (form inputs are strings)
    product.mrp = Number(product.mrp);                             // Coerce MRP price
    product.purchasePrice = Number(product.purchasePrice);         // Coerce purchase price

    if (product.id === 0 || !product.id) {
      // New product — INSERT without id so SQLite AUTOINCREMENT assigns the next primary key
      await db.execute(
        `INSERT INTO products (name, category, hsn_code, unit, package_size, batch_number, expiry_date, mrp, discount_percent, selling_price, purchase_price, gst_rate, current_stock, min_stock_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [product.name, product.category, product.hsnCode, product.unit, product.packageSize || null,   // null for optional fields
         product.batchNumber || null, product.expiryDate || null, product.mrp, product.discountPercent,
         product.sellingPrice, product.purchasePrice, product.gstRate, product.currentStock, product.minStockLevel]
      );
    } else {
      // Existing product — UPDATE all columns in the matching row
      await db.execute(
        `UPDATE products SET name=$1, category=$2, hsn_code=$3, unit=$4, package_size=$5, batch_number=$6, expiry_date=$7, mrp=$8, discount_percent=$9, selling_price=$10, purchase_price=$11, gst_rate=$12, current_stock=$13, min_stock_level=$14 WHERE id=$15`,
        [product.name, product.category, product.hsnCode, product.unit, product.packageSize || null,
         product.batchNumber || null, product.expiryDate || null, product.mrp, product.discountPercent,
         product.sellingPrice, product.purchasePrice, product.gstRate, product.currentStock, product.minStockLevel, product.id]
      );
    }
    notifyChange('products'); // Notify listeners — Inventory page and Billing product search will refresh
  },

  // Delete a single product by primary key
  deleteProduct: async (id: number): Promise<void> => {
    const db = await getDb();                                    // Open DB connection
    await db.execute("DELETE FROM products WHERE id = $1", [id]); // Remove the product row by id
  },

  // Wipe all products from the table (used by clearAllData / settings reset)
  deleteAllProducts: async (): Promise<void> => {
    const db = await getDb();                     // Open DB connection
    await db.execute("DELETE FROM products");     // Delete every row in the products table
  },

  // Delete a bill by id, first reversing the stock deductions it caused.
  // This ensures inventory levels stay accurate after a bill is removed.
  deleteBill: async (billId: number): Promise<void> => {
    const db = await getDb();                                                     // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM bills WHERE id = $1", [billId]); // Fetch the bill to get its items
    if (rows.length > 0) {
      const bill = mapBillRow(rows[0]); // Map DB row to typed Bill so we can iterate its items
      for (const item of bill.items) {
        // Add back the quantity that was deducted when the bill was saved
        await StorageService.updateStock(item.productId, item.quantity, 'bill_deleted', `Reversed: ${bill.invoiceNumber}`);
      }
      await db.execute("DELETE FROM bills WHERE id = $1", [billId]); // Remove the bill row
      notifyChange('bills'); // Notify listeners — Bills page list will refresh
    }
  },

  // --- Stock Logic ---
  // Update the stock level for a product and record the movement in stock_history.
  // quantityChange is signed: positive = stock received, negative = stock deducted.
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
    const db = await getDb(); // Open DB connection

    // Read the current stock level for the product
    const productRows: any[] = await db.select("SELECT * FROM products WHERE id = $1", [productId]); // Fetch product row
    let productName = 'Unknown'; // Fallback name in case the product was deleted
    if (productRows.length > 0) {
      productName = productRows[0].name;                             // Capture name for the stock_history snapshot
      const current = Number(productRows[0].current_stock);         // Coerce current stock to number
      const change = Number(quantityChange);                        // Coerce delta to number
      const newStock = Math.max(0, current + change);               // Calculate new stock level, clamped to zero minimum (stock cannot go negative)
      await db.execute("UPDATE products SET current_stock = $1 WHERE id = $2", [newStock, productId]); // Persist the change
    }

    // Insert a stock_history record for the movement
    await db.execute(
      `INSERT INTO stock_history (timestamp, product_id, product_name, change_amount, reason, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date().toISOString(), productId, productName, Number(quantityChange), reason, referenceId || null]
    );

    // Keep the history table lean — prune to the 1000 most recent rows
    const countRows: any[] = await db.select("SELECT COUNT(*) as cnt FROM stock_history"); // Count total rows
    if (countRows[0]?.cnt > 1000) {
      // Delete all rows except the 1000 newest (by timestamp DESC)
      await db.execute(
        "DELETE FROM stock_history WHERE id NOT IN (SELECT id FROM stock_history ORDER BY timestamp DESC LIMIT 1000)"
      );
    }

    notifyChange('stock'); // Notify listeners — StockHistory and Inventory pages will refresh
  },

  // Fetch the complete stock movement history, newest first
  getStockHistory: async (): Promise<StockHistory[]> => {
    const db = await getDb();                                                                 // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM stock_history ORDER BY timestamp DESC"); // Fetch descending by time
    return rows.map(mapStockHistoryRow);                                                      // Map each row to typed StockHistory
  },

  // --- Customers ---
  // Fetch all customer records from SQLite and return as typed Customer objects
  getCustomers: async (): Promise<Customer[]> => {
    const db = await getDb();                                      // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM customers"); // Fetch all customer rows
    return rows.map(mapCustomerRow);                               // Map each row to a typed Customer object
  },

  // Insert a new customer (id === 0) or update an existing one
  saveCustomer: async (customer: Customer): Promise<void> => {
    const db = await getDb(); // Open DB connection
    if (customer.id === 0 || !customer.id) {
      // New customer — INSERT without id so SQLite AUTOINCREMENT assigns the PK
      await db.execute(
        "INSERT INTO customers (name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5)",
        [customer.name, customer.phone, customer.email || null, customer.address || null, customer.gstin || null]
      );
    } else {
      // Existing customer — UPDATE all columns for the matching id
      await db.execute(
        "UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, gstin=$5 WHERE id=$6",
        [customer.name, customer.phone, customer.email || null, customer.address || null, customer.gstin || null, customer.id]
      );
    }
    notifyChange('customers'); // Notify listeners — Customers page list will refresh
  },

  // Merge two customer records: move all bills from fromId to toId, then delete the source customer.
  // This keeps invoice history intact while eliminating the duplicate customer entry.
  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
    const db = await getDb();                                                           // Open DB connection
    const toRows: any[] = await db.select("SELECT * FROM customers WHERE id = $1", [toId]); // Fetch the target customer
    if (toRows.length === 0) return;                                                    // Target not found — abort silently
    const toCustomer = mapCustomerRow(toRows[0]);                                       // Map to typed Customer

    // Re-assign all bills that belong to the source customer to the target customer
    await db.execute(
      "UPDATE bills SET customer_id=$1, customer_name=$2, customer_phone=$3, customer_address=$4, customer_gstin=$5 WHERE customer_id=$6",
      [toId, toCustomer.name, toCustomer.phone, toCustomer.address || null, toCustomer.gstin || null, fromId]
    );

    await db.execute("DELETE FROM customers WHERE id = $1", [fromId]); // Remove the now-redundant source customer
    notifyChange('customers'); // Fire listeners — Customers page will remove the deleted entry
    notifyChange('bills');     // Fire listeners — Bills page customer names are now updated
  },

  // --- Bills ---
  // Fetch all bill records from SQLite and return them as typed Bill objects
  getBills: async (): Promise<Bill[]> => {
    const db = await getDb();                                    // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM bills"); // Fetch all bill rows
    return rows.map(mapBillRow);                                 // Map each row to a typed Bill (items JSON parsed inside mapBillRow)
  },

  // Persist a new bill to SQLite and deduct sold quantities from product stock.
  // bill.id is set to the auto-assigned lastInsertId after the INSERT.
  saveBill: async (bill: Bill): Promise<void> => {
    const db = await getDb();                               // Open DB connection
    const itemsJson = JSON.stringify(bill.items);           // Serialise the BillItem array to JSON for storage

    // INSERT all 19 bill columns; lastInsertId is used to set bill.id
    const result = await db.execute(
      `INSERT INTO bills (invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [bill.invoiceNumber, bill.date, bill.customerId, bill.customerName, bill.customerPhone,
       bill.customerAddress || null, bill.customerGstin || null, bill.salesPersonId, bill.salesPersonName,
       bill.isGstBill ? 1 : 0,        // Convert boolean to SQLite INTEGER (1/0)
       bill.subTotal, bill.taxableAmount, bill.cgstAmount, bill.sgstAmount,
       bill.igstAmount, bill.totalTax, bill.roundOff, bill.grandTotal, itemsJson]
    );

    bill.id = result.lastInsertId as number; // Assign the auto-incremented PK back to the bill object
    notifyChange('bills');                   // Notify listeners — Bills page table will refresh

    // Deduct each item's quantity from the corresponding product's stock.
    // Wrapped in try-catch so a single stock-update failure doesn't leave inventory
    // silently out of sync — errors are logged for post-sale reconciliation.
    for (const item of bill.items) {
      try {
        await StorageService.updateStock(item.productId, -item.quantity, 'sale', `Invoice: ${bill.invoiceNumber}`);
      } catch (err) {
        console.error(`Stock update failed for product ${item.productId} on invoice ${bill.invoiceNumber}:`, err);
      }
    }
  },

  // Generate the next invoice number in Indian financial-year format: PREFIX/NNNN/YY-YY
  // Uses separate prefix & sequence for GST vs non-GST bills.
  getNextInvoiceNumber: async (isGstBill: boolean = true): Promise<string> => {
    const settings = await StorageService.getSettings();
    const bills = await StorageService.getBills();
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const fyStartYear = month < 3 ? year - 1 : year;
    const fyEndYear = fyStartYear + 1;
    const fyShort = `${fyStartYear % 100}-${fyEndYear % 100}`;

    // Pick the correct prefix and start number based on bill type
    const prefix = isGstBill
      ? settings.invoicePrefix
      : (settings.nonGstInvoicePrefix || settings.invoicePrefix);
    const startNum = isGstBill
      ? (settings.invoiceStartNumber || 1)
      : (settings.nonGstInvoiceStartNumber || settings.invoiceStartNumber || 1);

    // Filter bills that belong to the current FY and match this prefix
    const fyBills = bills.filter(b =>
      b.invoiceNumber.startsWith(prefix + '/') &&
      b.invoiceNumber.endsWith(fyShort)
    );

    let maxNum = 0;
    fyBills.forEach(b => {
      const parts = b.invoiceNumber.split('/');
      if (parts.length === 3) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    const nextNum = Math.max(maxNum + 1, startNum);
    return `${prefix}/${nextNum.toString().padStart(4, '0')}/${fyShort}`;
  },

  // --- Sales Persons ---
  // Fetch all salespeople. If none exist (first launch), seeds two defaults: 'Admin' and 'Counter Sale'.
  getSalesPersons: async (): Promise<SalesPerson[]> => {
    const db = await getDb();                                                    // Open DB connection
    let rows: any[] = await db.select("SELECT * FROM sales_persons");           // Fetch all salesperson rows

    if (rows.length === 0) {
      // First launch — seed sane defaults so billing can proceed immediately
      await db.execute("INSERT INTO sales_persons (name, is_active) VALUES ('Admin', 1), ('Counter Sale', 1)");
      rows = await db.select("SELECT * FROM sales_persons"); // Re-fetch after seeding
    }

    return rows.map(mapSalesPersonRow); // Map each row to a typed SalesPerson object
  },

  // Insert a new salesperson (id === 0) or update an existing one
  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    const db = await getDb(); // Open DB connection
    if (person.id === 0 || !person.id) {
      // New salesperson — INSERT so SQLite assigns the PK automatically
      await db.execute(
        "INSERT INTO sales_persons (name, is_active) VALUES ($1, $2)",
        [person.name, person.isActive ? 1 : 0] // Convert boolean → INTEGER 1/0 for SQLite
      );
    } else {
      // Existing salesperson — UPDATE the name and active flag
      await db.execute(
        "UPDATE sales_persons SET name=$1, is_active=$2 WHERE id=$3",
        [person.name, person.isActive ? 1 : 0, person.id]
      );
    }
    notifyChange('salesPersons'); // Notify listeners — Settings salesperson list will refresh
  },

  // --- Backups ---
  // Automatically create a daily backup snapshot.
  // Skips silently if an 'auto' backup already exists for today.
  // Keeps only the 7 most recent auto backups (rolling window).
  performAutoBackup: async (): Promise<void> => {
    const db = await getDb();                             // Open DB connection
    const now = new Date();                               // Capture current timestamp
    const dateStr = now.toISOString().split('T')[0];     // Extract YYYY-MM-DD for today-check query

    // Skip if an auto backup was already created today (prevents duplicate daily backups)
    const existing: any[] = await db.select(
      "SELECT id FROM backups WHERE type = 'auto' AND timestamp LIKE $1",
      [dateStr + '%']  // Match any timestamp starting with today's date
    );
    if (existing.length > 0) return; // Already backed up today — nothing to do

    // Collect a snapshot of all data tables
    const backupData = {
      settings: await StorageService.getSettings(),         // Company settings
      products: await StorageService.getProducts(),         // Product catalogue
      customers: await StorageService.getCustomers(),       // Customer list
      bills: await StorageService.getBills(),               // Sales invoices
      salesPersons: await StorageService.getSalesPersons(), // Salesperson list
      stockHistory: await StorageService.getStockHistory(), // Stock movement log
      users: await StorageService.getUsers()                // User accounts
    };

    const fullData = JSON.stringify(backupData);  // Serialise snapshot to JSON string

    // Wrap the data for file export with metadata
    const fileContent = JSON.stringify({
      exportedAt: now.toISOString(),
      appVersion: '1.1.0',
      type: 'auto',
      data: backupData
    }, null, 2);

    // Write backup JSON file to the backups folder on disk
    try {
      const { getBackupsPath, ensureDataFolders } = await import('./dataPath');
      await ensureDataFolders();
      const backupsDir = await getBackupsPath();
      if (backupsDir) {
        const { writeTextFile, exists: fsExists, readDir, remove } = await import('@tauri-apps/plugin-fs');
        const fileName = `nhw-backup-${dateStr}.json`;
        await writeTextFile(`${backupsDir}\\${fileName}`, fileContent);

        // Clean up old backup files — keep only the 7 most recent
        try {
          const entries = await readDir(backupsDir);
          const backupFiles = entries
            .filter((e: any) => e.name?.startsWith('nhw-backup-') && e.name?.endsWith('.json'))
            .map((e: any) => e.name as string)
            .sort()
            .reverse();
          if (backupFiles.length > 7) {
            for (const old of backupFiles.slice(7)) {
              await remove(`${backupsDir}\\${old}`);
            }
          }
        } catch { /* Best-effort cleanup */ }
      }
    } catch (e) {
      console.error('Failed to write backup file to disk:', e);
    }

    // Insert the backup row with its size and full JSON payload
    await db.execute(
      "INSERT INTO backups (timestamp, type, size, data) VALUES ($1, $2, $3, $4)",
      [now.toISOString(), 'auto', fullData.length, fullData] // size = byte length of JSON string
    );

    // Prune to the 7 most recent rows to keep storage usage bounded
    const countRows: any[] = await db.select("SELECT COUNT(*) as cnt FROM backups"); // Total backup count
    if (countRows[0]?.cnt > 7) {
      // Delete everything except the 7 newest rows (by timestamp DESC)
      await db.execute(
        "DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY timestamp DESC LIMIT 7)"
      );
    }
  },

  // Fetch all backup records, newest first
  getBackups: async (): Promise<BackupRecord[]> => {
    const db = await getDb();                                                           // Open DB connection
    const rows: any[] = await db.select("SELECT * FROM backups ORDER BY timestamp DESC"); // Fetch newest first
    return rows.map(mapBackupRow);                                                      // Map each row to a typed BackupRecord
  },

  // Restore all data from a backup snapshot.
  // Deletes all current data first, then re-inserts with explicit IDs to preserve FK references.
  // Returns true on success, false if an error occurs.
  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
    try {
      const db = await getDb();                // Open DB connection
      const data = JSON.parse(backup.data);    // Parse the JSON backup snapshot

      // Clear all tables before restoring (order matters — bills reference customers)
      await db.execute("DELETE FROM products");       // Wipe products
      await db.execute("DELETE FROM customers");      // Wipe customers
      await db.execute("DELETE FROM bills");          // Wipe bills
      await db.execute("DELETE FROM sales_persons");  // Wipe salespeople
      await db.execute("DELETE FROM stock_history");  // Wipe stock movement log
      await db.execute("DELETE FROM users");          // Wipe user accounts

      // Restore settings (if present in backup)
      if (data.settings) {
        await StorageService.saveSettings(data.settings); // Upsert settings row
      }

      // Restore products using explicit ids to preserve FK references in bills
      if (data.products) {
        for (const p of data.products) {
          await db.execute(
            `INSERT INTO products (id, name, category, hsn_code, unit, package_size, batch_number, expiry_date, mrp, discount_percent, selling_price, purchase_price, gst_rate, current_stock, min_stock_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [p.id, p.name, p.category || '', p.hsnCode || '', p.unit || 'Nos', p.packageSize || null,
             p.batchNumber || null, p.expiryDate || null, p.mrp || 0, p.discountPercent || 0,
             p.sellingPrice || 0, p.purchasePrice || 0, p.gstRate || 0, p.currentStock || 0, p.minStockLevel || 0]
          );
        }
      }

      // Restore customers using explicit ids (preserves customer_id FK in bills)
      if (data.customers) {
        for (const c of data.customers) {
          await db.execute(
            "INSERT INTO customers (id, name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5, $6)",
            [c.id, c.name, c.phone || '', c.email || null, c.address || null, c.gstin || null]
          );
        }
      }

      // Restore bills using explicit ids
      if (data.bills) {
        for (const b of data.bills) {
          const itemsJson = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || []); // Ensure items is serialised JSON
          await db.execute(
            `INSERT INTO bills (id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [b.id, b.invoiceNumber, b.date, b.customerId, b.customerName || '', b.customerPhone || '',
             b.customerAddress || null, b.customerGstin || null, b.salesPersonId || 0, b.salesPersonName || '',
             b.isGstBill ? 1 : 0,  // Restore boolean as INTEGER
             b.subTotal || 0, b.taxableAmount || 0, b.cgstAmount || 0,
             b.sgstAmount || 0, b.igstAmount || 0, b.totalTax || 0, b.roundOff || 0, b.grandTotal || 0, itemsJson]
          );
        }
      }

      // Restore salespeople using explicit ids
      if (data.salesPersons) {
        for (const sp of data.salesPersons) {
          await db.execute(
            "INSERT INTO sales_persons (id, name, is_active) VALUES ($1, $2, $3)",
            [sp.id, sp.name, sp.isActive ? 1 : 0] // Restore boolean as INTEGER
          );
        }
      }

      // Restore stock history using explicit ids
      if (data.stockHistory) {
        for (const sh of data.stockHistory) {
          await db.execute(
            "INSERT INTO stock_history (id, timestamp, product_id, product_name, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [sh.id, sh.timestamp, sh.productId, sh.productName || '', sh.changeAmount || 0, sh.reason || '', sh.referenceId || null]
          );
        }
      }

      // Restore user accounts using INSERT OR IGNORE to avoid duplicate-username errors
      if (data.users) {
        for (const u of data.users) {
          await db.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4)",
            [u.username, u.passwordHash, u.role || 'user', u.lastLogin || null]
          );
        }
      }

      notifyChange('restore'); // Notify all listeners — every page should re-read its data
      return true;             // Signal success to the caller
    } catch (e) {
      console.error("Restore failed", e); // Log the error for diagnostics
      return false;                       // Signal failure — caller will display an error message
    }
  },

  // --- Manual Export / Import ---
  // Collect all data into a JSON snapshot and return it as a formatted string for download.
  exportBackupFile: async (): Promise<string> => {
    const backupData = {
      exportedAt: new Date().toISOString(),  // Timestamp the export so the file is self-describing
      appVersion: '1.0.0',                  // Record the app version for forward-compatibility checks
      data: {
        settings: await StorageService.getSettings(),         // Company settings
        products: await StorageService.getProducts(),         // Product catalogue
        customers: await StorageService.getCustomers(),       // Customer list
        bills: await StorageService.getBills(),               // Sales invoices
        salesPersons: await StorageService.getSalesPersons(), // Salesperson list
        stockHistory: await StorageService.getStockHistory(), // Stock movement log
        users: await StorageService.getUsers()                // User accounts
      }
    };
    return JSON.stringify(backupData, null, 2); // Format with 2-space indentation for readability
  },

  // Import a JSON backup file: validate structure, wipe current data, then re-insert all records.
  // Returns { success: true } on success, or { success: false, message } on validation/DB error.
  importBackupFile: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    try {
      const backupData = JSON.parse(jsonData); // Parse the uploaded JSON string

      if (!backupData.data) {
        return { success: false, message: 'Invalid backup file format' }; // Missing top-level data key
      }

      const { settings, products, customers, bills, salesPersons, stockHistory, users } = backupData.data; // Destructure all sections

      if (!settings) {
        return { success: false, message: 'Backup missing settings data' }; // Settings are mandatory
      }

      const db = await getDb(); // Open DB connection before clearing

      // Wipe all tables so the import starts from a clean slate
      await db.execute("DELETE FROM products");       // Clear products
      await db.execute("DELETE FROM customers");      // Clear customers
      await db.execute("DELETE FROM bills");          // Clear bills
      await db.execute("DELETE FROM sales_persons");  // Clear salespeople
      await db.execute("DELETE FROM stock_history");  // Clear stock history
      await db.execute("DELETE FROM users");          // Clear user accounts

      // Import settings (always present — validated above)
      if (settings) await StorageService.saveSettings(settings);

      // Import products with explicit ids to restore FK references
      if (products && products.length > 0) {
        for (const p of products) {
          await db.execute(
            `INSERT INTO products (id, name, category, hsn_code, unit, package_size, batch_number, expiry_date, mrp, discount_percent, selling_price, purchase_price, gst_rate, current_stock, min_stock_level)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [p.id, p.name, p.category || '', p.hsnCode || '', p.unit || 'Nos', p.packageSize || null,
             p.batchNumber || null, p.expiryDate || null, p.mrp || 0, p.discountPercent || 0,
             p.sellingPrice || 0, p.purchasePrice || 0, p.gstRate || 0, p.currentStock || 0, p.minStockLevel || 0]
          );
        }
      }

      // Import customers with explicit ids
      if (customers && customers.length > 0) {
        for (const c of customers) {
          await db.execute(
            "INSERT INTO customers (id, name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5, $6)",
            [c.id, c.name, c.phone || '', c.email || null, c.address || null, c.gstin || null]
          );
        }
      }

      // Import bills with explicit ids
      if (bills && bills.length > 0) {
        for (const b of bills) {
          const itemsJson = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || []); // Ensure items JSON string
          await db.execute(
            `INSERT INTO bills (id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [b.id, b.invoiceNumber, b.date, b.customerId, b.customerName || '', b.customerPhone || '',
             b.customerAddress || null, b.customerGstin || null, b.salesPersonId || 0, b.salesPersonName || '',
             b.isGstBill ? 1 : 0,  // Restore boolean as SQLite INTEGER
             b.subTotal || 0, b.taxableAmount || 0, b.cgstAmount || 0,
             b.sgstAmount || 0, b.igstAmount || 0, b.totalTax || 0, b.roundOff || 0, b.grandTotal || 0, itemsJson]
          );
        }
      }

      // Import salespeople with explicit ids
      if (salesPersons && salesPersons.length > 0) {
        for (const sp of salesPersons) {
          await db.execute(
            "INSERT INTO sales_persons (id, name, is_active) VALUES ($1, $2, $3)",
            [sp.id, sp.name, sp.isActive ? 1 : 0] // Restore boolean as INTEGER
          );
        }
      }

      // Import stock history with explicit ids
      if (stockHistory && stockHistory.length > 0) {
        for (const sh of stockHistory) {
          await db.execute(
            "INSERT INTO stock_history (id, timestamp, product_id, product_name, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [sh.id, sh.timestamp, sh.productId, sh.productName || '', sh.changeAmount || 0, sh.reason || '', sh.referenceId || null]
          );
        }
      }

      // Import user accounts (OR IGNORE prevents failure if username already exists)
      if (users && users.length > 0) {
        for (const u of users) {
          await db.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4)",
            [u.username, u.passwordHash, u.role || 'user', u.lastLogin || null]
          );
        }
      }

      notifyChange('import'); // Notify all listeners so every page reloads its data
      return { success: true, message: 'Backup imported successfully!' }; // Report success to UI
    } catch (e) {
      console.error("Import failed", e);                                             // Log parse or DB error
      return { success: false, message: `Import failed: ${(e as Error).message}` }; // Return error message for the toast
    }
  },

  // --- Clear All Data (Settings page "Factory Reset") ---
  // Wipe every table including settings and users — complete factory reset.
  // Unlike dexieStorage, this also deletes settings (SQLite has no localStorage to preserve separately).
  clearAllData: async (): Promise<void> => {
    const db = await getDb();                          // Open DB connection
    await db.execute("DELETE FROM products");          // Wipe all products
    await db.execute("DELETE FROM customers");         // Wipe all customers
    await db.execute("DELETE FROM bills");             // Wipe all invoices
    await db.execute("DELETE FROM sales_persons");     // Wipe all salesperson records
    await db.execute("DELETE FROM stock_history");     // Wipe all stock movement logs
    await db.execute("DELETE FROM backups");           // Wipe all backup snapshots
    await db.execute("DELETE FROM users");             // Wipe all user accounts
    await db.execute("DELETE FROM settings");          // Wipe settings (SQLite only — no localStorage here)
    notifyChange('clear');                             // Notify all listeners — every page will reset to empty state
  }
};
