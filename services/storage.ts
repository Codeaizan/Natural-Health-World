// Auto-detecting StorageService wrapper.
// Uses SQLite (via Tauri) when running as a desktop app.
// Falls back to IndexedDB (via Dexie) when running in a browser.

// Import all domain types so the StorageService methods are fully type-safe
import type { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
// Import the AuditLogService to record significant data mutations automatically
import { AuditLogService } from './auditLog';

// Detect if running inside the Tauri desktop wrapper.
// Tauri injects '__TAURI_INTERNALS__' onto window; its presence confirms the desktop environment.
const isTauri = (): boolean => {
  return !!(window as any).__TAURI_INTERNALS__; // Returns true inside Tauri; false in plain browsers
};

// --- Change notification (shared, works immediately) ---
// A Set of callback functions registered by React components that need to re-fetch data after mutations.
// Using a Set automatically deduplicates — registering the same callback twice is safe.
const _listeners = new Set<(type?: string) => void>();

// Lazy-loaded backend — null until the first StorageService call is made
let _backend: any = null; // Populated with sqliteStorage or dexieStorage after first use
let _backendReady: Promise<any> | null = null; // Singleton promise prevents concurrent backend imports

// Lazily resolve and return the correct backend module.
// On first call it imports either sqliteStorage or dexieStorage; subsequent calls resolve instantly.
const getBackend = (): Promise<any> => {
  if (_backend) return Promise.resolve(_backend); // Already initialised — return immediately
  if (_backendReady) return _backendReady;         // Import already in-flight — return the same promise

  // Start the one-time async import
  _backendReady = (async () => {
    if (isTauri()) {
      const mod = await import('./sqliteStorage'); // Load the Tauri/SQLite backend
      _backend = mod.StorageService;
    } else {
      const mod = await import('./dexieStorage');  // Load the browser/IndexedDB backend
      _backend = mod.StorageService;
    }
    // Replay any listeners that were registered before the backend was ready
    _listeners.forEach(cb => _backend.addChangeListener(cb)); // Forward existing listeners to the backend
    return _backend; // Resolve the promise with the ready backend module
  })();

  return _backendReady; // Return the in-flight promise so concurrent callers share it
};

// Public StorageService — every page and component in the app calls only this object.
// It is the single abstraction layer between UI code and the underlying database.
export const StorageService = {
  // --- Synchronous listener management (work immediately) ---

  // Register a callback that fires whenever data changes.
  // Called by React components that need to re-load data after a mutation elsewhere in the app.
  addChangeListener: (cb: (type?: string) => void) => {
    _listeners.add(cb); // Add to the shared Set so it receives all future change notifications
    if (_backend) _backend.addChangeListener(cb); // If backend is already loaded, register there too immediately
  },
  // Unregister a change callback — call this in a useEffect cleanup to prevent memory leaks
  removeChangeListener: (cb: (type?: string) => void) => {
    _listeners.delete(cb); // Remove from the shared Set
    if (_backend) _backend.removeChangeListener(cb); // Also remove from the backend if it's loaded
  },

  // --- Settings ---
  // Load the company settings record from the database (company name, GSTIN, bank details, etc.)
  getSettings: async (): Promise<CompanySettings> => {
    const b = await getBackend(); // Ensure the correct backend is loaded
    return b.getSettings(); // Delegate to the backend's getSettings implementation
  },
  // Save updated company settings and write an audit log entry
  saveSettings: async (settings: CompanySettings): Promise<void> => {
    const b = await getBackend();
    await b.saveSettings(settings); // Persist all setting fields to the database
    AuditLogService.log('settings', 'Settings Updated', `Company settings updated for "${settings.name}"`); // Record the change
  },

  // --- Auth & Users ---
  // Load all user accounts (username, role, last login — no plain-text passwords)
  getUsers: async (): Promise<User[]> => {
    const b = await getBackend();
    return b.getUsers(); // Returns array of User objects
  },
  // Insert or update a user account (password is expected pre-hashed by the caller)
  saveUser: async (user: User): Promise<void> => {
    const b = await getBackend();
    return b.saveUser(user);
  },
  // Check username + password against stored hash; returns the User on success or null on failure
  verifyCredentials: async (username: string, password: string): Promise<User | null> => {
    const b = await getBackend();
    return b.verifyCredentials(username, password); // Returns matching User or null
  },
  // Hash a plain-text password using SHA-256 (same algorithm used by both backends)
  hashPassword: async (password: string): Promise<string> => {
    const b = await getBackend();
    return b.hashPassword(password); // Returns hex digest string
  },

  // --- Products ---
  // Load the full product/medicine catalogue sorted by name
  getProducts: async (): Promise<Product[]> => {
    const b = await getBackend();
    return b.getProducts();
  },
  // Insert or update a product; logs whether it was a create or update
  saveProduct: async (product: Product): Promise<void> => {
    const b = await getBackend();
    await b.saveProduct(product); // Persist the product (add if no id, update if id exists)
    AuditLogService.log('inventory', product.id ? 'Product Updated' : 'Product Added', `Product "${product.name}" (ID: ${product.id})`);
  },
  // Hard-delete a product by its numeric ID; logs the deletion
  deleteProduct: async (id: number): Promise<void> => {
    const b = await getBackend();
    await b.deleteProduct(id); // Remove the row from the products table
    AuditLogService.log('inventory', 'Product Deleted', `Product ID: ${id} deleted`);
  },
  // Remove ALL products from the database (used during data clearing / large imports)
  deleteAllProducts: async (): Promise<void> => {
    const b = await getBackend();
    return b.deleteAllProducts(); // Truncate the products table
  },

  // --- Bills ---
  // Load all sales invoices ordered by date descending (newest first)
  getBills: async (): Promise<Bill[]> => {
    const b = await getBackend();
    return b.getBills();
  },
  // Insert or update a bill record; logs the invoice number, customer and grand total
  saveBill: async (bill: Bill): Promise<void> => {
    const b = await getBackend();
    await b.saveBill(bill); // Persist the bill and all its line items
    AuditLogService.log('billing', 'Bill Saved', `Invoice ${bill.invoiceNumber} for ${bill.customerName} - ₹${bill.grandTotal.toFixed(2)}`);
  },
  // Delete a bill by ID; the backend also restores the stock deducted by that bill
  deleteBill: async (billId: number): Promise<void> => {
    const b = await getBackend();
    await b.deleteBill(billId); // Remove bill and reverse its stock changes
    AuditLogService.log('billing', 'Bill Deleted', `Bill ID: ${billId} deleted`);
  },
  // Generate the next invoice number in sequence, using the appropriate prefix for GST or non-GST bills
  getNextInvoiceNumber: async (isGstBill: boolean = true): Promise<string> => {
    const b = await getBackend();
    return b.getNextInvoiceNumber(isGstBill);
  },

  // --- Stock ---
  // Apply a stock movement delta to a product and write a stock_history record
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
    const b = await getBackend();
    return b.updateStock(productId, quantityChange, reason, referenceId); // Positive = add, negative = deduct
  },
  // Load the full stock movement history for all products (newest first)
  getStockHistory: async (): Promise<StockHistory[]> => {
    const b = await getBackend();
    return b.getStockHistory();
  },

  // --- Customers ---
  // Load all customer records sorted by name
  getCustomers: async (): Promise<Customer[]> => {
    const b = await getBackend();
    return b.getCustomers();
  },
  // Insert or update a customer record; logs whether it was created or updated
  saveCustomer: async (customer: Customer): Promise<void> => {
    const b = await getBackend();
    await b.saveCustomer(customer); // Persist name, phone, email, address and GSTIN
    AuditLogService.log('customer', customer.id ? 'Customer Updated' : 'Customer Added', `Customer "${customer.name}" (ID: ${customer.id})`);
  },
  // Merge all bills from 'fromId' customer into 'toId' customer, then delete the source record
  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
    const b = await getBackend();
    return b.mergeCustomers(fromId, toId); // Re-assigns bills and removes the duplicate customer
  },

  // --- Sales Persons ---
  // Load all salesperson records (active and inactive)
  getSalesPersons: async (): Promise<SalesPerson[]> => {
    const b = await getBackend();
    return b.getSalesPersons();
  },
  // Insert or update a salesperson record (name and active status)
  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    const b = await getBackend();
    return b.saveSalesPerson(person);
  },

  // --- Backups ---
  // Run the automatic backup logic (creates a JSON snapshot of all data, stores it in backups table)
  performAutoBackup: async (): Promise<void> => {
    const b = await getBackend();
    return b.performAutoBackup(); // Usually called at startup by App.tsx
  },
  // Load the list of all saved backup records (metadata only, not the full data payload)
  getBackups: async (): Promise<BackupRecord[]> => {
    const b = await getBackend();
    return b.getBackups();
  },
  // Restore the database to the state captured in the provided backup record
  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
    const b = await getBackend();
    return b.restoreBackup(backup); // Returns true on success, false on failure
  },
  // Export all database data as a formatted JSON string (for saving to a file)
  exportBackupFile: async (): Promise<string> => {
    const b = await getBackend();
    return b.exportBackupFile(); // Returns full JSON string the caller can write to disk
  },
  // Import a previously exported JSON backup string, replacing all current data
  importBackupFile: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    const b = await getBackend();
    return b.importBackupFile(jsonData); // Parses JSON, validates, and replaces all tables
  },

  // --- Data Management ---
  // Delete all records from all tables; logs the wipe before it executes so the action is traceable
  clearAllData: async (): Promise<void> => {
    const b = await getBackend();
    AuditLogService.log('data', 'All Data Cleared', 'User cleared all application data'); // Log BEFORE clearing so the entry survives
    await b.clearAllData(); // Wipe every table in the database
  }
};
