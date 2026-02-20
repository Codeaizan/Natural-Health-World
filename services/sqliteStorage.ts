import Database from '@tauri-apps/plugin-sql';
import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

// Singleton DB connection
let _db: Database | null = null;

const getDb = async (): Promise<Database> => {
  if (!_db) {
    _db = await Database.load('sqlite:nhw_data.db');
  }
  return _db;
};

// --- Change notification (simple observer) ---
const _listeners = new Set<(type?: string) => void>();
const notifyChange = (type?: string) => {
  _listeners.forEach(cb => {
    try { cb(type); } catch (e) { /* ignore listener errors */ }
  });
};

// Simple Hash for password (Browser compatible)
const hashPassword = async (password: string): Promise<string> => {
  try {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('Hashing error:', err);
    throw err;
  }
};

// --- Row mappers (snake_case DB → camelCase TS) ---

const mapProductRow = (row: any): Product => ({
  id: row.id,
  name: row.name,
  category: row.category || '',
  hsnCode: row.hsn_code || '',
  unit: row.unit || 'Nos',
  packageSize: row.package_size || undefined,
  batchNumber: row.batch_number || undefined,
  expiryDate: row.expiry_date || undefined,
  mrp: Number(row.mrp) || 0,
  discountPercent: Number(row.discount_percent) || 0,
  sellingPrice: Number(row.selling_price) || 0,
  purchasePrice: Number(row.purchase_price) || 0,
  gstRate: Number(row.gst_rate) || 0,
  currentStock: Number(row.current_stock) || 0,
  minStockLevel: Number(row.min_stock_level) || 0,
});

const mapCustomerRow = (row: any): Customer => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  email: row.email || undefined,
  address: row.address || undefined,
  gstin: row.gstin || undefined,
});

const mapBillRow = (row: any): Bill => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  date: row.date,
  customerId: row.customer_id,
  customerName: row.customer_name || '',
  customerPhone: row.customer_phone || '',
  customerAddress: row.customer_address || undefined,
  customerGstin: row.customer_gstin || undefined,
  salesPersonId: row.sales_person_id || 0,
  salesPersonName: row.sales_person_name || '',
  isGstBill: row.is_gst_bill === 1,
  subTotal: Number(row.sub_total) || 0,
  taxableAmount: Number(row.taxable_amount) || 0,
  cgstAmount: Number(row.cgst_amount) || 0,
  sgstAmount: Number(row.sgst_amount) || 0,
  igstAmount: Number(row.igst_amount) || 0,
  totalTax: Number(row.total_tax) || 0,
  roundOff: Number(row.round_off) || 0,
  grandTotal: Number(row.grand_total) || 0,
  items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
});

const mapSalesPersonRow = (row: any): SalesPerson => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active === 1,
});

const mapStockHistoryRow = (row: any): StockHistory => ({
  id: row.id,
  timestamp: row.timestamp,
  productId: row.product_id,
  productName: row.product_name || '',
  changeAmount: Number(row.change_amount) || 0,
  reason: row.reason || '',
  referenceId: row.reference_id || undefined,
});

const mapBackupRow = (row: any): BackupRecord => ({
  id: String(row.id),
  timestamp: row.timestamp,
  type: row.type as 'auto' | 'manual',
  size: Number(row.size) || 0,
  data: row.data || '',
});

const mapUserRow = (row: any): User => ({
  username: row.username,
  passwordHash: row.password_hash,
  role: row.role as 'admin' | 'user',
  lastLogin: row.last_login || undefined,
});

export const StorageService = {
  addChangeListener: (cb: (type?: string) => void) => _listeners.add(cb),
  removeChangeListener: (cb: (type?: string) => void) => _listeners.delete(cb),

  // --- Settings ---
  getSettings: async (): Promise<CompanySettings> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT value FROM settings WHERE key = 'nhw_settings'");
    if (rows.length > 0) {
      try {
        return JSON.parse(rows[0].value);
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: CompanySettings): Promise<void> => {
    const db = await getDb();
    const json = JSON.stringify(settings);
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ('nhw_settings', $1) ON CONFLICT(key) DO UPDATE SET value = $1",
      [json]
    );
    notifyChange('settings');
  },

  // --- Auth & Users ---
  getUsers: async (): Promise<User[]> => {
    try {
      const db = await getDb();
      const rows: any[] = await db.select("SELECT * FROM users");
      if (rows.length === 0) {
        // Default Admin (Password: admin123) - SHA256 hash
        const defaultAdmin: User = {
          username: 'admin',
          passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
          role: 'admin'
        };
        await db.execute(
          "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
          [defaultAdmin.username, defaultAdmin.passwordHash, defaultAdmin.role]
        );
        return [defaultAdmin];
      }
      return rows.map(mapUserRow);
    } catch (err) {
      console.error('Error getting users:', err);
      return [];
    }
  },

  saveUser: async (user: User) => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4) ON CONFLICT(username) DO UPDATE SET password_hash = $2, role = $3, last_login = $4",
      [user.username, user.passwordHash, user.role, user.lastLogin || null]
    );
    notifyChange('users');
  },

  verifyCredentials: async (u: string, p: string): Promise<User | null> => {
    try {
      const db = await getDb();
      const rows: any[] = await db.select("SELECT * FROM users WHERE username = $1", [u]);
      if (rows.length === 0) return null;

      const user = mapUserRow(rows[0]);
      const hash = await hashPassword(p);

      if (user.passwordHash === hash) {
        user.lastLogin = new Date().toISOString();
        await db.execute(
          "UPDATE users SET last_login = $1 WHERE username = $2",
          [user.lastLogin, user.username]
        );
        notifyChange('users');
        return user;
      }
      return null;
    } catch (err) {
      console.error('Auth error:', err);
      return null;
    }
  },

  hashPassword,

  // --- Products ---
  getProducts: async (): Promise<Product[]> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM products");
    return rows.map(mapProductRow);
  },

  saveProduct: async (product: Product): Promise<void> => {
    const db = await getDb();
    product.currentStock = Number(product.currentStock);
    product.mrp = Number(product.mrp);
    product.purchasePrice = Number(product.purchasePrice);

    if (product.id === 0 || !product.id) {
      await db.execute(
        `INSERT INTO products (name, category, hsn_code, unit, package_size, batch_number, expiry_date, mrp, discount_percent, selling_price, purchase_price, gst_rate, current_stock, min_stock_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [product.name, product.category, product.hsnCode, product.unit, product.packageSize || null,
         product.batchNumber || null, product.expiryDate || null, product.mrp, product.discountPercent,
         product.sellingPrice, product.purchasePrice, product.gstRate, product.currentStock, product.minStockLevel]
      );
    } else {
      await db.execute(
        `UPDATE products SET name=$1, category=$2, hsn_code=$3, unit=$4, package_size=$5, batch_number=$6, expiry_date=$7, mrp=$8, discount_percent=$9, selling_price=$10, purchase_price=$11, gst_rate=$12, current_stock=$13, min_stock_level=$14 WHERE id=$15`,
        [product.name, product.category, product.hsnCode, product.unit, product.packageSize || null,
         product.batchNumber || null, product.expiryDate || null, product.mrp, product.discountPercent,
         product.sellingPrice, product.purchasePrice, product.gstRate, product.currentStock, product.minStockLevel, product.id]
      );
    }
    notifyChange('products');
  },

  deleteProduct: async (id: number): Promise<void> => {
    const db = await getDb();
    await db.execute("DELETE FROM products WHERE id = $1", [id]);
  },

  deleteAllProducts: async (): Promise<void> => {
    const db = await getDb();
    await db.execute("DELETE FROM products");
  },

  deleteBill: async (billId: number): Promise<void> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM bills WHERE id = $1", [billId]);
    if (rows.length > 0) {
      const bill = mapBillRow(rows[0]);
      for (const item of bill.items) {
        await StorageService.updateStock(item.productId, item.quantity, 'bill_deleted', `Reversed: ${bill.invoiceNumber}`);
      }
      await db.execute("DELETE FROM bills WHERE id = $1", [billId]);
      notifyChange('bills');
    }
  },

  // --- Stock Logic ---
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
    const db = await getDb();

    // Get product
    const productRows: any[] = await db.select("SELECT * FROM products WHERE id = $1", [productId]);
    let productName = 'Unknown';
    if (productRows.length > 0) {
      productName = productRows[0].name;
      const current = Number(productRows[0].current_stock);
      const change = Number(quantityChange);
      const newStock = current + change;
      await db.execute("UPDATE products SET current_stock = $1 WHERE id = $2", [newStock, productId]);
    }

    // Add history record
    await db.execute(
      `INSERT INTO stock_history (timestamp, product_id, product_name, change_amount, reason, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [new Date().toISOString(), productId, productName, Number(quantityChange), reason, referenceId || null]
    );

    // Keep recent history, clean old records
    const countRows: any[] = await db.select("SELECT COUNT(*) as cnt FROM stock_history");
    if (countRows[0]?.cnt > 1000) {
      await db.execute(
        "DELETE FROM stock_history WHERE id NOT IN (SELECT id FROM stock_history ORDER BY timestamp DESC LIMIT 1000)"
      );
    }

    notifyChange('stock');
  },

  getStockHistory: async (): Promise<StockHistory[]> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM stock_history ORDER BY timestamp DESC");
    return rows.map(mapStockHistoryRow);
  },

  // --- Customers ---
  getCustomers: async (): Promise<Customer[]> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM customers");
    return rows.map(mapCustomerRow);
  },

  saveCustomer: async (customer: Customer): Promise<void> => {
    const db = await getDb();
    if (customer.id === 0 || !customer.id) {
      await db.execute(
        "INSERT INTO customers (name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5)",
        [customer.name, customer.phone, customer.email || null, customer.address || null, customer.gstin || null]
      );
    } else {
      await db.execute(
        "UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, gstin=$5 WHERE id=$6",
        [customer.name, customer.phone, customer.email || null, customer.address || null, customer.gstin || null, customer.id]
      );
    }
    notifyChange('customers');
  },

  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
    const db = await getDb();
    const toRows: any[] = await db.select("SELECT * FROM customers WHERE id = $1", [toId]);
    if (toRows.length === 0) return;
    const toCustomer = mapCustomerRow(toRows[0]);

    // Update all bills that reference fromId
    await db.execute(
      "UPDATE bills SET customer_id=$1, customer_name=$2, customer_phone=$3, customer_address=$4, customer_gstin=$5 WHERE customer_id=$6",
      [toId, toCustomer.name, toCustomer.phone, toCustomer.address || null, toCustomer.gstin || null, fromId]
    );

    await db.execute("DELETE FROM customers WHERE id = $1", [fromId]);
    notifyChange('customers');
    notifyChange('bills');
  },

  // --- Bills ---
  getBills: async (): Promise<Bill[]> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM bills");
    return rows.map(mapBillRow);
  },

  saveBill: async (bill: Bill): Promise<void> => {
    const db = await getDb();
    const itemsJson = JSON.stringify(bill.items);

    const result = await db.execute(
      `INSERT INTO bills (invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [bill.invoiceNumber, bill.date, bill.customerId, bill.customerName, bill.customerPhone,
       bill.customerAddress || null, bill.customerGstin || null, bill.salesPersonId, bill.salesPersonName,
       bill.isGstBill ? 1 : 0, bill.subTotal, bill.taxableAmount, bill.cgstAmount, bill.sgstAmount,
       bill.igstAmount, bill.totalTax, bill.roundOff, bill.grandTotal, itemsJson]
    );

    bill.id = result.lastInsertId as number;
    notifyChange('bills');

    // Deduct stock for each item
    for (const item of bill.items) {
      await StorageService.updateStock(item.productId, -item.quantity, 'sale', `Invoice: ${bill.invoiceNumber}`);
    }
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const settings = await StorageService.getSettings();
    const bills = await StorageService.getBills();
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const fyStartYear = month < 3 ? year - 1 : year;
    const fyEndYear = fyStartYear + 1;
    const fyShort = `${fyStartYear % 100}-${fyEndYear % 100}`;

    const prefix = settings.invoicePrefix;

    const fyBills = bills.filter(b =>
      b.invoiceNumber.startsWith(prefix + '/') &&
      b.invoiceNumber.endsWith(fyShort)
    );

    let maxNum = 0;
    if (fyBills.length > 0) {
      fyBills.forEach(b => {
        const parts = b.invoiceNumber.split('/');
        if (parts.length === 3) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
    }

    const startNum = settings.invoiceStartNumber || 1;
    const nextNum = Math.max(maxNum + 1, startNum);

    return `${prefix}/${nextNum.toString().padStart(4, '0')}/${fyShort}`;
  },

  // --- Sales Persons ---
  getSalesPersons: async (): Promise<SalesPerson[]> => {
    const db = await getDb();
    let rows: any[] = await db.select("SELECT * FROM sales_persons");

    if (rows.length === 0) {
      await db.execute("INSERT INTO sales_persons (name, is_active) VALUES ('Admin', 1), ('Counter Sale', 1)");
      rows = await db.select("SELECT * FROM sales_persons");
    }

    return rows.map(mapSalesPersonRow);
  },

  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    const db = await getDb();
    if (person.id === 0 || !person.id) {
      await db.execute(
        "INSERT INTO sales_persons (name, is_active) VALUES ($1, $2)",
        [person.name, person.isActive ? 1 : 0]
      );
    } else {
      await db.execute(
        "UPDATE sales_persons SET name=$1, is_active=$2 WHERE id=$3",
        [person.name, person.isActive ? 1 : 0, person.id]
      );
    }
    notifyChange('salesPersons');
  },

  // --- Backups ---
  performAutoBackup: async (): Promise<void> => {
    const db = await getDb();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Check if backup already exists for today
    const existing: any[] = await db.select(
      "SELECT id FROM backups WHERE type = 'auto' AND timestamp LIKE $1",
      [dateStr + '%']
    );
    if (existing.length > 0) return;

    const backupData = {
      settings: await StorageService.getSettings(),
      products: await StorageService.getProducts(),
      customers: await StorageService.getCustomers(),
      bills: await StorageService.getBills(),
      salesPersons: await StorageService.getSalesPersons(),
      stockHistory: await StorageService.getStockHistory(),
      users: await StorageService.getUsers()
    };

    const fullData = JSON.stringify(backupData);

    await db.execute(
      "INSERT INTO backups (timestamp, type, size, data) VALUES ($1, $2, $3, $4)",
      [now.toISOString(), 'auto', fullData.length, fullData]
    );

    // Keep only last 7 backups
    const countRows: any[] = await db.select("SELECT COUNT(*) as cnt FROM backups");
    if (countRows[0]?.cnt > 7) {
      await db.execute(
        "DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY timestamp DESC LIMIT 7)"
      );
    }
  },

  getBackups: async (): Promise<BackupRecord[]> => {
    const db = await getDb();
    const rows: any[] = await db.select("SELECT * FROM backups ORDER BY timestamp DESC");
    return rows.map(mapBackupRow);
  },

  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
    try {
      const db = await getDb();
      const data = JSON.parse(backup.data);

      // Clear all tables
      await db.execute("DELETE FROM products");
      await db.execute("DELETE FROM customers");
      await db.execute("DELETE FROM bills");
      await db.execute("DELETE FROM sales_persons");
      await db.execute("DELETE FROM stock_history");
      await db.execute("DELETE FROM users");

      // Restore settings
      if (data.settings) {
        await StorageService.saveSettings(data.settings);
      }

      // Restore products
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

      // Restore customers
      if (data.customers) {
        for (const c of data.customers) {
          await db.execute(
            "INSERT INTO customers (id, name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5, $6)",
            [c.id, c.name, c.phone || '', c.email || null, c.address || null, c.gstin || null]
          );
        }
      }

      // Restore bills
      if (data.bills) {
        for (const b of data.bills) {
          const itemsJson = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || []);
          await db.execute(
            `INSERT INTO bills (id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [b.id, b.invoiceNumber, b.date, b.customerId, b.customerName || '', b.customerPhone || '',
             b.customerAddress || null, b.customerGstin || null, b.salesPersonId || 0, b.salesPersonName || '',
             b.isGstBill ? 1 : 0, b.subTotal || 0, b.taxableAmount || 0, b.cgstAmount || 0,
             b.sgstAmount || 0, b.igstAmount || 0, b.totalTax || 0, b.roundOff || 0, b.grandTotal || 0, itemsJson]
          );
        }
      }

      // Restore sales persons
      if (data.salesPersons) {
        for (const sp of data.salesPersons) {
          await db.execute(
            "INSERT INTO sales_persons (id, name, is_active) VALUES ($1, $2, $3)",
            [sp.id, sp.name, sp.isActive ? 1 : 0]
          );
        }
      }

      // Restore stock history
      if (data.stockHistory) {
        for (const sh of data.stockHistory) {
          await db.execute(
            "INSERT INTO stock_history (id, timestamp, product_id, product_name, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [sh.id, sh.timestamp, sh.productId, sh.productName || '', sh.changeAmount || 0, sh.reason || '', sh.referenceId || null]
          );
        }
      }

      // Restore users
      if (data.users) {
        for (const u of data.users) {
          await db.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4)",
            [u.username, u.passwordHash, u.role || 'user', u.lastLogin || null]
          );
        }
      }

      notifyChange('restore');
      return true;
    } catch (e) {
      console.error("Restore failed", e);
      return false;
    }
  },

  // Manual export/import for user download
  exportBackupFile: async (): Promise<string> => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      data: {
        settings: await StorageService.getSettings(),
        products: await StorageService.getProducts(),
        customers: await StorageService.getCustomers(),
        bills: await StorageService.getBills(),
        salesPersons: await StorageService.getSalesPersons(),
        stockHistory: await StorageService.getStockHistory(),
        users: await StorageService.getUsers()
      }
    };
    return JSON.stringify(backupData, null, 2);
  },

  importBackupFile: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    try {
      const backupData = JSON.parse(jsonData);

      if (!backupData.data) {
        return { success: false, message: 'Invalid backup file format' };
      }

      const { settings, products, customers, bills, salesPersons, stockHistory, users } = backupData.data;

      if (!settings) {
        return { success: false, message: 'Backup missing settings data' };
      }

      const db = await getDb();

      // Clear all tables
      await db.execute("DELETE FROM products");
      await db.execute("DELETE FROM customers");
      await db.execute("DELETE FROM bills");
      await db.execute("DELETE FROM sales_persons");
      await db.execute("DELETE FROM stock_history");
      await db.execute("DELETE FROM users");

      // Import settings
      if (settings) await StorageService.saveSettings(settings);

      // Import products
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

      // Import customers
      if (customers && customers.length > 0) {
        for (const c of customers) {
          await db.execute(
            "INSERT INTO customers (id, name, phone, email, address, gstin) VALUES ($1, $2, $3, $4, $5, $6)",
            [c.id, c.name, c.phone || '', c.email || null, c.address || null, c.gstin || null]
          );
        }
      }

      // Import bills
      if (bills && bills.length > 0) {
        for (const b of bills) {
          const itemsJson = typeof b.items === 'string' ? b.items : JSON.stringify(b.items || []);
          await db.execute(
            `INSERT INTO bills (id, invoice_number, date, customer_id, customer_name, customer_phone, customer_address, customer_gstin, sales_person_id, sales_person_name, is_gst_bill, sub_total, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [b.id, b.invoiceNumber, b.date, b.customerId, b.customerName || '', b.customerPhone || '',
             b.customerAddress || null, b.customerGstin || null, b.salesPersonId || 0, b.salesPersonName || '',
             b.isGstBill ? 1 : 0, b.subTotal || 0, b.taxableAmount || 0, b.cgstAmount || 0,
             b.sgstAmount || 0, b.igstAmount || 0, b.totalTax || 0, b.roundOff || 0, b.grandTotal || 0, itemsJson]
          );
        }
      }

      // Import sales persons
      if (salesPersons && salesPersons.length > 0) {
        for (const sp of salesPersons) {
          await db.execute(
            "INSERT INTO sales_persons (id, name, is_active) VALUES ($1, $2, $3)",
            [sp.id, sp.name, sp.isActive ? 1 : 0]
          );
        }
      }

      // Import stock history
      if (stockHistory && stockHistory.length > 0) {
        for (const sh of stockHistory) {
          await db.execute(
            "INSERT INTO stock_history (id, timestamp, product_id, product_name, change_amount, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [sh.id, sh.timestamp, sh.productId, sh.productName || '', sh.changeAmount || 0, sh.reason || '', sh.referenceId || null]
          );
        }
      }

      // Import users
      if (users && users.length > 0) {
        for (const u of users) {
          await db.execute(
            "INSERT OR IGNORE INTO users (username, password_hash, role, last_login) VALUES ($1, $2, $3, $4)",
            [u.username, u.passwordHash, u.role || 'user', u.lastLogin || null]
          );
        }
      }

      notifyChange('import');
      return { success: true, message: 'Backup imported successfully!' };
    } catch (e) {
      console.error("Import failed", e);
      return { success: false, message: `Import failed: ${(e as Error).message}` };
    }
  },

  // --- Clear all data (for Settings page) ---
  clearAllData: async (): Promise<void> => {
    const db = await getDb();
    await db.execute("DELETE FROM products");
    await db.execute("DELETE FROM customers");
    await db.execute("DELETE FROM bills");
    await db.execute("DELETE FROM sales_persons");
    await db.execute("DELETE FROM stock_history");
    await db.execute("DELETE FROM backups");
    await db.execute("DELETE FROM users");
    await db.execute("DELETE FROM settings");
    notifyChange('clear');
  }
};
