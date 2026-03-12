// Import all domain TypeScript interfaces so every Dexie table is strongly typed
import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
// DEFAULT_SETTINGS provides the initial company-settings object when no saved settings exist
import { DEFAULT_SETTINGS } from '../constants';
// db is the shared Dexie database instance; setKeyValue/getKeyValue read/write the generic 'data' key-value table
import { db, setKeyValue, getKeyValue } from './db';

// --- Change notification (simple observer) ---
// A Set of callback functions registered by React components that re-fetch data after any mutation.
// Using a Set automatically deduplicates registrations.
const _listeners = new Set<(type?: string) => void>();
// Fire all registered listener callbacks and pass an optional change-type string (e.g. 'products', 'bills')
const notifyChange = (type?: string) => {
  _listeners.forEach(cb => {
    try { cb(type); } catch (e) { /* Swallow listener errors to prevent one bad listener from blocking others */ }
  });
};

// SHA-256 hash for password storage (Browser compatible, no salt)
// Uses the built-in Web Crypto API so no external library is needed.
const hashPassword = async (password: string): Promise<string> => {
    try {
        const msgBuffer = new TextEncoder().encode(password); // Encode the plain-text password to a Uint8Array
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer); // Run the SHA-256 digest algorithm
        const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert the ArrayBuffer to a plain number array
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert each byte to a 2-digit hex string and join
        return hash; // Return the 64-character hex digest
    } catch (err) {
        console.error('Hashing error:', err); // Log the failure so debugging is easier
        throw err; // Re-throw so the caller can handle the error (e.g. show an error toast)
    }
};

// The Dexie (IndexedDB) implementation of the StorageService API.
// Used when the app runs in a browser without the Tauri desktop wrapper.
export const StorageService = {
  // Register a callback to be invoked whenever any data changes
  addChangeListener: (cb: (type?: string) => void) => _listeners.add(cb),
  // Unregister a previously added callback
  removeChangeListener: (cb: (type?: string) => void) => _listeners.delete(cb),
  
  // --- Settings ---
  // Read company settings from the generic key-value 'data' table.
  // Falls back to DEFAULT_SETTINGS if no saved settings exist yet.
  getSettings: async (): Promise<CompanySettings> => {
    const settings = await getKeyValue('nhw_settings', null); // Try to load the saved settings object
    return settings || DEFAULT_SETTINGS; // Return saved settings or fall back to the built-in defaults
  },
  
  // Persist the provided company settings and notify all listeners
  saveSettings: async (settings: CompanySettings): Promise<void> => {
    await setKeyValue('nhw_settings', settings); // Upsert settings under the 'nhw_settings' key
    notifyChange('settings'); // Inform listeners (e.g. re-render the Settings page header)
  },

  // --- Auth & Users ---
  // Load all user accounts from IndexedDB.
  // If the table is empty (first launch), seeds a default admin account automatically.
  getUsers: async (): Promise<User[]> => {
      try {
          const users = await db.users.toArray(); // Read all rows from the Dexie 'users' table
          if (users.length === 0) {
              // Default Admin (Password: admin123) - SHA256 hash
              // Pre-computed hash avoids an async hashPassword() call on first load
              const defaultAdmin: User = {
                  username: 'admin',
                  passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // SHA-256 of 'admin123'
                  role: 'admin' // Full administrator access
              };
              try {
                  await db.users.add(defaultAdmin); // Try to insert; will fail if there's a race condition
              } catch (e) {
                  // User might already exist due to a concurrent insert — use put (upsert) instead
                  await db.users.put(defaultAdmin);
              }
              return [defaultAdmin]; // Return the seeded admin as the only user
          }
          return users; // Return the full array of stored users
      } catch (err) {
          console.error('Error getting users:', err); // Log Dexie errors without crashing
          return []; // Return empty array so the login screen can still render
      }
  },
  
  // Insert or update a user record in IndexedDB (username is the primary key / unique key)
  saveUser: async (user: User) => {
      await db.users.put(user); // 'put' upserts: inserts if new, updates if username already exists
      notifyChange('users'); // Notify listeners (e.g. Settings page user list)
  },

  // Verify a username and password pair; returns the matching User or null on failure.
  // Also seeds the default admin on the very first login if no users exist.
  verifyCredentials: async (u: string, p: string): Promise<User | null> => {
      try {
          // Ensure default admin exists on first-ever login
          const count = await db.users.count(); // Count all user rows in the table
          if (count === 0) {
              // No users at all — create the default admin account before attempting verification
              const defaultAdmin: User = {
                  username: 'admin',
                  passwordHash: await hashPassword('admin123'), // Hash the default password at runtime
                  role: 'admin'
              };
              await db.users.put(defaultAdmin); // Seed the admin account
          }

          const user = await db.users.get(u); // Look up the user row by username (primary key)
          if (!user) {
              return null; // Username not found — login fails
          }
          
          const hash = await hashPassword(p); // Hash the provided password to compare
          
          if (user.passwordHash === hash) {
              // Password matches — update the last login timestamp and return the user object
              user.lastLogin = new Date().toISOString(); // Record the exact login time
              await db.users.put(user); // Persist the updated lastLogin field
              notifyChange('users'); // Notify listeners of the lastLogin change
              return user; // Return the authenticated user
          }
          return null; // Incorrect password — login fails
      } catch (err) {
          console.error('Auth error:', err); // Log the error without crashing
          return null; // Return null so the login page shows an error message
      }
  },
  
  hashPassword, // Export so the Settings page can hash new passwords before saving

  // --- Products ---
  // Load the full medicine/goods catalogue from IndexedDB as a typed array
  getProducts: async (): Promise<Product[]> => {
    return await db.products.toArray(); // Return all rows from the Dexie 'products' table
  },
  
  // Insert or update a product record.
  // Coerces key numeric fields (stock, MRP, purchase price) before persisting to prevent string-concat bugs.
  saveProduct: async (product: Product): Promise<void> => {
    // Ensure numbers are numbers — HTML form inputs may provide strings
    product.currentStock = Number(product.currentStock); // Convert stock to a true number
    product.mrp = Number(product.mrp);                   // Convert MRP price to a number
    product.purchasePrice = Number(product.purchasePrice); // Convert purchase price to a number
    
    if (product.id === 0 || !product.id) {
      // New product — remove id so Dexie auto-increments and assigns the next available ID
      delete (product as any).id; // The '++id' schema means Dexie generates the PK
      await db.products.add(product); // Insert as a new row
    } else {
      // Existing product — update the row with the matching id
      await db.products.put(product); // Put overwrites the entire row
    }
    notifyChange('products'); // Notify listeners (e.g. Inventory page, Billing search)
  },
  
  // Hard-delete a product row from IndexedDB by its numeric ID
  deleteProduct: async (id: number): Promise<void> => {
    await db.products.delete(id); // Remove the row; no-op if id does not exist
  },

  // Delete ALL product rows from the 'products' table (bulk wipe, used by import)
  deleteAllProducts: async (): Promise<void> => {
    await db.products.clear(); // Efficiently drop all rows in one operation
  },

  // Delete a bill and restore the stock that was deducted when it was created.
  // IMPORTANT: reverses the stock movement before removing the bill so inventory stays consistent.
  deleteBill: async (billId: number): Promise<void> => {
    // Restore stock for each item in the bill before deleting
    const bill = await db.bills.get(billId); // Fetch the full bill including its items
    if (bill) {
      for (const item of bill.items) {
        // Add back the quantity that was deducted when this bill was saved
        await StorageService.updateStock(item.productId, item.quantity, 'bill_deleted', `Reversed: ${bill.invoiceNumber}`);
      }
      await db.bills.delete(billId); // Remove the bill row from IndexedDB
      notifyChange('bills'); // Notify listeners (e.g. Invoices page)
    }
  },
  
  // --- Stock Logic ---
  // Apply a stock movement to a product and record the change in the stock_history table.
  // quantityChange is positive for additions (purchases) and negative for deductions (sales).
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
      const product = await db.products.get(productId); // Fetch the current product record
      
      let productName = 'Unknown'; // Fallback name used in history if the product is not found
      if (product) {
          productName = product.name; // Capture the product name for the history record
          // CRITICAL: Force number conversion to avoid string concatenation issues (HTML inputs return strings)
          const current = Number(product.currentStock); // Convert to number before arithmetic
          const change = Number(quantityChange);         // Convert to number before arithmetic
          product.currentStock = Math.max(0, current + change); // Apply delta, clamped to zero minimum (stock cannot go negative)
          await db.products.update(productId, product);  // Write the updated stock level back to IndexedDB
      }

      // Build the immutable history record for this movement
      const historyRecord: Omit<StockHistory, 'id'> = {
          timestamp: new Date().toISOString(), // Exact moment the movement occurred
          productId,        // Which product's stock changed
          productName,      // Snapshot of the product name (denormalised so history is readable if product is later renamed/deleted)
          changeAmount: Number(quantityChange), // Positive = added, negative = deducted
          reason,           // Human-readable reason: 'sale', 'bill_deleted', 'Manual adjustment', etc.
          referenceId       // Optional invoice number or other reference (e.g. 'Invoice: INV-0042')
      };
      await db.stockHistory.add(historyRecord as StockHistory); // Append to history; Dexie auto-increments the id
      
      // Prune history to the most recent 1 000 records to cap IndexedDB growth
      const allHistory = await db.stockHistory.orderBy('timestamp').reverse().toArray(); // Newest first
      if (allHistory.length > 1000) {
          const toDelete = allHistory.slice(1000); // Everything after the 1 000th most recent record
          await db.stockHistory.bulkDelete(toDelete.map(h => h.id)); // Bulk-delete the oldest records
      }
      
      notifyChange('stock'); // Notify listeners (e.g. Dashboard low-stock alerts, Inventory page)
  },

  // Load the full stock movement history ordered newest-first
  getStockHistory: async (): Promise<StockHistory[]> => {
    return await db.stockHistory.orderBy('timestamp').reverse().toArray(); // Most recent movement first
  },

  // --- Customers ---
  // Load all customer records from IndexedDB as a typed array
  getCustomers: async (): Promise<Customer[]> => {
    return await db.customers.toArray(); // Return all rows from the Dexie 'customers' table
  },
  
  // Insert or update a customer record.
  // Uses add (new) vs put (update) based on whether an id is present.
  saveCustomer: async (customer: Customer): Promise<void> => {
    if (customer.id === 0 || !customer.id) {
      // New customer — remove id so Dexie auto-increments and assigns the PK
      delete (customer as any).id; // Drop the 0/undefined id before insert
      await db.customers.add(customer); // Insert as a new row
    } else {
      await db.customers.update(customer.id, customer); // Update the row matching the existing id
    }
    notifyChange('customers'); // Notify listeners (e.g. Customers page, Billing customer search)
  },
  
  // Merge a duplicate customer ('fromId') into a target customer ('toId').
  // Re-assigns all bills from the source to the target, then deletes the source customer record.
  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
      const bills = await db.bills.toArray(); // Load all bills to find ones belonging to the source customer
      const toCustomer = await db.customers.get(toId); // Load the target customer to copy current details

      if (!toCustomer) return; // Target customer not found — abort silently

      let updatedBills = false; // Track whether any bills were actually changed
      for (const b of bills) {
          if (b.customerId === fromId) {
              // Re-assign this bill to the target customer and update all denormalised contact fields
              b.customerId = toId;                      // Update the foreign key
              b.customerName = toCustomer.name;         // Snapshot the target's current name
              b.customerPhone = toCustomer.phone;       // Snapshot the target's phone
              b.customerAddress = toCustomer.address;   // Snapshot the target's address
              b.customerGstin = toCustomer.gstin;       // Snapshot the target's GSTIN
              await db.bills.put(b); // Overwrite the bill row with the updated customer reference
              updatedBills = true; // Mark that at least one bill was changed
          }
      }
      
      if (updatedBills) {
          notifyChange('bills'); // Only fire bill notification if bills were actually modified
      }

      await db.customers.delete(fromId); // Remove the duplicate/source customer record
      notifyChange('customers'); // Notify listeners that the customer list changed
  },

  // --- Bills ---
  // Load all saved invoices from IndexedDB as a typed array
  getBills: async (): Promise<Bill[]> => {
    return await db.bills.toArray(); // Return all rows from the Dexie 'bills' table
  },
  
  // Insert a new bill into IndexedDB and deduct stock for every line item.
  // Note: bills are always inserted (never updated) — editing means delete + re-create.
  saveBill: async (bill: Bill): Promise<void> => {
    // Let Dexie auto-increment the ID
    delete (bill as any).id; // Drop any id field so Dexie generates the next auto-increment PK
    const newId = await db.bills.add(bill); // Insert the bill row; returns the new id
    bill.id = newId as number; // Write the generated id back onto the bill object for the caller
    notifyChange('bills'); // Notify listeners (e.g. Invoices page, Dashboard)

    // Deduct stock for each line item — wrapped in try-catch to handle partial failures.
    // If any stock update fails, the bill is already saved but we log the error so
    // the discrepancy can be identified and corrected.
    for (const item of bill.items) {
      try {
        await StorageService.updateStock(item.productId, -item.quantity, 'sale', `Invoice: ${bill.invoiceNumber}`);
      } catch (err) {
        console.error(`Stock update failed for product ${item.productId} on invoice ${bill.invoiceNumber}:`, err);
      }
    }
  },
  
  // Generate the next sequential invoice number in Indian financial-year format.
  // Uses separate prefix & sequence for GST vs non-GST bills.
  // Format: "<prefix>/<NNNN>/<FY>" e.g. "NH/0043/25-26" or "NHW/0012/25-26"
  getNextInvoiceNumber: async (isGstBill: boolean = true): Promise<string> => {
    const settings = await StorageService.getSettings();
    const bills = await db.bills.toArray();
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
  // Load all salesperson records from IndexedDB.
  // Seeds two defaults ('Admin' and 'Counter Sale') if the table is empty on first use.
  getSalesPersons: async (): Promise<SalesPerson[]> => {
    let persons = await db.salesPersons.toArray(); // Read all rows from the 'salesPersons' table
    
    if (persons.length === 0) {
        // First run — seed default salespersons so billing always has at least two options
        const defaults = [
            { id: 1, name: 'Admin', isActive: true },
            { id: 2, name: 'Counter Sale', isActive: true }
        ];
        await db.salesPersons.bulkAdd(defaults); // Insert both defaults in one operation
        persons = defaults; // Use the seeded array as the return value
    }
    
    return persons; // Return the full array of salesperson records
  },
  
  // Insert or update a salesperson record.
  // Uses add (new id=0/null) vs update (existing id) pattern.
  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    if (person.id === 0 || !person.id) {
        // New sales person — let Dexie auto-increment
        delete (person as any).id; // Remove the 0/null id so Dexie generates the PK
        await db.salesPersons.add(person); // Insert as a new row
    } else {
        await db.salesPersons.update(person.id, person); // Update the existing row
    }
    notifyChange('salesPersons'); // Notify listeners (e.g. Billing salesperson dropdown)
  },

  // --- Backups ---
  // Create an automatic daily backup if one does not already exist for today.
  // Keeps a rolling 7-day history; older backups are automatically deleted.
  performAutoBackup: async (): Promise<void> => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // 'YYYY-MM-DD' — used to check for today's backup
      const backups = await db.backups.toArray(); // Load all existing backup records
      
      // Check if an auto-backup already exists for today — avoid creating duplicate daily backups
      const existing = backups.find(b => b.type === 'auto' && b.timestamp.startsWith(dateStr));
      if (existing) return; // Today's backup already done — skip

      // Collect a snapshot of all data from every table
      const backupData = {
          settings: await StorageService.getSettings(),           // Company settings
          products: await StorageService.getProducts(),           // Full product catalogue
          customers: await StorageService.getCustomers(),         // All customer records
          bills: await StorageService.getBills(),                 // All invoices
          salesPersons: await StorageService.getSalesPersons(),   // Salesperson records
          stockHistory: await StorageService.getStockHistory(),   // Full stock movement log
          users: await StorageService.getUsers()                  // User accounts (hashed passwords)
      };

      const fullData = JSON.stringify(backupData); // Serialise the entire snapshot to a JSON string

      // Write backup JSON file to the backups folder on disk (Tauri only)
      try {
        const isTauri = !!(window as any).__TAURI_INTERNALS__;
        if (isTauri) {
          const fileContent = JSON.stringify({
            exportedAt: now.toISOString(),
            appVersion: '1.1.0',
            type: 'auto',
            data: backupData
          }, null, 2);
          const { getBackupsPath, ensureDataFolders } = await import('./dataPath');
          await ensureDataFolders();
          const backupsDir = await getBackupsPath();
          if (backupsDir) {
            const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs');
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
        }
      } catch (e) {
        console.error('Failed to write backup file to disk:', e);
      }

      const newBackup: Omit<BackupRecord, 'id'> & { id?: string } = {
          timestamp: now.toISOString(), // When the backup was created
          type: 'auto',                 // Mark as an automatic scheduled backup
          size: fullData.length,        // Byte length of the JSON string (for display in Backups page)
          data: fullData                // The full JSON payload
      };
      
      await db.backups.add(newBackup as BackupRecord); // Append the backup record to IndexedDB
      
      // Enforce the 7-backup rolling window — delete anything older than the 7 most recent
      const allBackups = await db.backups.orderBy('timestamp').reverse().toArray(); // Newest first
      if (allBackups.length > 7) {
          const toDelete = allBackups.slice(7); // Everything beyond the 7 most recent
          await db.backups.bulkDelete(toDelete.map(b => b.id)); // Remove old backups from IndexedDB
      }
  },
  
  // Load all backup records ordered newest-first (does not include the full JSON payload by default)
  getBackups: async (): Promise<BackupRecord[]> => {
    return await db.backups.orderBy('timestamp').reverse().toArray(); // Newest backup first
  },
  
  // Restore the entire application database from a backup record.
  // Clears all current tables and re-populates them from the backup's JSON payload.
  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
      try {
          const data = JSON.parse(backup.data); // Parse the stored JSON snapshot
          
          // Clear all tables — remove every existing row before restoring
          await db.products.clear();     // Wipe products
          await db.customers.clear();    // Wipe customers
          await db.bills.clear();        // Wipe bills
          await db.salesPersons.clear(); // Wipe salesPersons
          await db.stockHistory.clear(); // Wipe stock history
          await db.users.clear();        // Wipe user accounts
          
          // Restore data — only write if data exists in the backup to avoid importing nulls
          if (data.settings) await setKeyValue('nhw_settings', data.settings);                                   // Settings key-value
          if (data.products && data.products.length > 0) await db.products.bulkAdd(data.products);               // All products
          if (data.customers && data.customers.length > 0) await db.customers.bulkAdd(data.customers);           // All customers
          if (data.bills && data.bills.length > 0) await db.bills.bulkAdd(data.bills);                           // All invoices
          if (data.salesPersons && data.salesPersons.length > 0) await db.salesPersons.bulkAdd(data.salesPersons); // Salespersons
          if (data.stockHistory && data.stockHistory.length > 0) await db.stockHistory.bulkAdd(data.stockHistory); // Stock history
          if (data.users && data.users.length > 0) await db.users.bulkAdd(data.users);                           // User accounts
          
          notifyChange('restore'); // Notify all listeners to re-fetch data from the restored state
          return true; // Restore succeeded
      } catch (e) {
          console.error("Restore failed", e); // Log the error for debugging
          return false; // Signal failure to the calling page
      }
  },

  // Manual export/import for user download
  // Produce a complete JSON file string that the user can download to their local machine.
  exportBackupFile: async (): Promise<string> => {
      const backupData = {
          exportedAt: new Date().toISOString(), // Timestamp the export for reference
          appVersion: '1.0.0',                 // App version at the time of export
          data: {
              settings: await StorageService.getSettings(),           // Company settings snapshot
              products: await StorageService.getProducts(),           // All products
              customers: await StorageService.getCustomers(),         // All customers
              bills: await StorageService.getBills(),                 // All invoices
              salesPersons: await StorageService.getSalesPersons(),   // Salesperson records
              stockHistory: await StorageService.getStockHistory(),   // Full stock history
              users: await StorageService.getUsers()                  // User accounts
          }
      };
      return JSON.stringify(backupData, null, 2); // Pretty-print with 2-space indentation for readability
  },

  // Import a JSON file previously exported by exportBackupFile.
  // Validates the file structure, clears all current data, then inserts the backup content.
  importBackupFile: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
      try {
          const backupData = JSON.parse(jsonData); // Parse the user-provided JSON string
          
          if (!backupData.data) {
              return { success: false, message: 'Invalid backup file format' }; // Missing top-level 'data' key
          }

          // Destructure all table arrays from the backup's 'data' section
          const { settings, products, customers, bills, salesPersons, stockHistory, users } = backupData.data;
          
          if (!settings) {
              return { success: false, message: 'Backup missing settings data' }; // Settings are mandatory
          }

          // Clear and restore data — wipe every table before importing to avoid duplicates
          await db.products.clear();     // Remove all products
          await db.customers.clear();    // Remove all customers
          await db.bills.clear();        // Remove all invoices
          await db.salesPersons.clear(); // Remove all salespersons
          await db.stockHistory.clear(); // Remove all stock history
          await db.users.clear();        // Remove all user accounts

          // Import all data from the backup, skipping sections that are empty or missing
          if (settings) await setKeyValue('nhw_settings', settings); // Restore settings key-value
          if (products && products.length > 0) await db.products.bulkAdd(products);                              // Bulk-insert products
          if (customers && customers.length > 0) await db.customers.bulkAdd(customers);                          // Bulk-insert customers
          if (bills && bills.length > 0) await db.bills.bulkAdd(bills);                                          // Bulk-insert invoices
          if (salesPersons && salesPersons.length > 0) await db.salesPersons.bulkAdd(salesPersons);              // Bulk-insert salespersons
          if (stockHistory && stockHistory.length > 0) await db.stockHistory.bulkAdd(stockHistory);              // Bulk-insert stock history
          if (users && users.length > 0) await db.users.bulkAdd(users);                                          // Bulk-insert users

          notifyChange('import'); // Notify all listeners to re-fetch from the newly imported data
          return { success: true, message: 'Backup imported successfully!' }; // Signal success
      } catch (e) {
          console.error("Import failed", e); // Log the error for debugging
          return { success: false, message: `Import failed: ${(e as Error).message}` }; // Return the error message to the UI
      }
  },

  // --- Clear all data ---
  // Hard-wipe every IndexedDB table and all app-specific localStorage keys.
  // Preserves audit logs, tax audit logs, and theme preference so the clear is transparent to those features.
  clearAllData: async (): Promise<void> => {
    await db.products.clear();     // Wipe the entire products catalogue
    await db.customers.clear();    // Wipe all customer records
    await db.bills.clear();        // Wipe all invoices
    await db.salesPersons.clear(); // Wipe all salesperson records
    await db.stockHistory.clear(); // Wipe all stock movement records
    await db.backups.clear();      // Wipe all backup records
    await db.users.clear();        // Wipe all user accounts
    // Only remove app-specific localStorage keys, preserve audit logs and theme
    const keysToPreserve = ['nhw_audit_logs', 'nhw_tax_audit_logs', 'nhw_theme']; // Keys that must survive a data clear
    const allKeys = Object.keys(localStorage); // Get all keys currently stored in localStorage
    allKeys.forEach(key => {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key); // Remove every key that is not in the preserve list
      }
    });
    notifyChange('clear'); // Notify all listeners so the entire UI reflects the cleared state
  }
};