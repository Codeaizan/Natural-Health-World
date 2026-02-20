import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { db, setKeyValue, getKeyValue } from './db';

// --- Change notification (simple observer) ---
const _listeners = new Set<(type?: string) => void>();
const notifyChange = (type?: string) => {
  _listeners.forEach(cb => {
    try { cb(type); } catch (e) { /* ignore listener errors */ }
  });
};

// Simple Hash for "bcrypt-like" behavior (Browser compatible)
const hashPassword = async (password: string): Promise<string> => {
    try {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('Hash computed for password:', { password, hash });
        return hash;
    } catch (err) {
        console.error('Hashing error:', err);
        throw err;
    }
};

export const StorageService = {
  addChangeListener: (cb: (type?: string) => void) => _listeners.add(cb),
  removeChangeListener: (cb: (type?: string) => void) => _listeners.delete(cb),
  
  // --- Settings ---
  getSettings: async (): Promise<CompanySettings> => {
    const settings = await getKeyValue('nhw_settings', null);
    return settings || DEFAULT_SETTINGS;
  },
  
  saveSettings: async (settings: CompanySettings): Promise<void> => {
    await setKeyValue('nhw_settings', settings);
    notifyChange('settings');
  },

  // --- Auth & Users ---
  getUsers: async (): Promise<User[]> => {
      try {
          const users = await db.users.toArray();
          console.log('Retrieved users from DB:', users);
          if (users.length === 0) {
              // Default Admin (Password: admin123) - SHA256 hash
              const defaultAdmin: User = {
                  username: 'admin',
                  passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 
                  role: 'admin'
              };
              try {
                  await db.users.add(defaultAdmin);
                  console.log('Default admin user added successfully');
              } catch (e) {
                  // User might already exist, try put instead
                  console.log('Add failed, trying put:', e);
                  await db.users.put(defaultAdmin);
                  console.log('Default admin user saved via put');
              }
              return [defaultAdmin];
          }
          return users;
      } catch (err) {
          console.error('Error getting users:', err);
          return [];
      }
  },
  
  saveUser: async (user: User) => {
      await db.users.put(user);
      notifyChange('users');
  },

  verifyCredentials: async (u: string, p: string): Promise<User | null> => {
      try {
          const user = await db.users.get(u);
          if (!user) {
              console.log('User not found:', u);
              return null;
          }
          
          const hash = await hashPassword(p);
          console.log('Password verification:', { username: u, passwordHash: user.passwordHash, computedHash: hash, match: user.passwordHash === hash });
          
          if (user.passwordHash === hash) {
              // Update last login
              user.lastLogin = new Date().toISOString();
              await db.users.put(user);
              notifyChange('users');
              return user;
          }
          return null;
      } catch (err) {
          console.error('Auth error:', err);
          return null;
      }
  },
  
  hashPassword, // Export for use in settings

  // --- Products ---
  getProducts: async (): Promise<Product[]> => {
    return await db.products.toArray();
  },
  
  saveProduct: async (product: Product): Promise<void> => {
    // Ensure numbers are numbers
    product.currentStock = Number(product.currentStock);
    product.mrp = Number(product.mrp);
    product.purchasePrice = Number(product.purchasePrice);
    
    if (product.id === 0 || !product.id) {
      // New product - remove id so Dexie auto-increments
      delete (product as any).id;
      await db.products.add(product);
    } else {
      // Update existing product
      await db.products.put(product);
    }
    notifyChange('products');
  },
  
  deleteProduct: async (id: number): Promise<void> => {
    await db.products.delete(id);
  },

  deleteAllProducts: async (): Promise<void> => {
    await db.products.clear();
  },

  deleteBill: async (billId: number): Promise<void> => {
    // Restore stock for each item in the bill before deleting
    const bill = await db.bills.get(billId);
    if (bill) {
      for (const item of bill.items) {
        await StorageService.updateStock(item.productId, item.quantity, 'bill_deleted', `Reversed: ${bill.invoiceNumber}`);
      }
      await db.bills.delete(billId);
      notifyChange('bills');
    }
  },
  
  // --- Stock Logic ---
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
      const product = await db.products.get(productId);
      
      let productName = 'Unknown';
      if (product) {
          productName = product.name;
          // CRITICAL: Force number conversion to avoid string concatenation issues
          const current = Number(product.currentStock);
          const change = Number(quantityChange);
          product.currentStock = current + change;
          await db.products.update(productId, product);
      }

      // History - let Dexie auto-increment ID
      const historyRecord: Omit<StockHistory, 'id'> = {
          timestamp: new Date().toISOString(),
          productId,
          productName,
          changeAmount: Number(quantityChange),
          reason,
          referenceId
      };
      await db.stockHistory.add(historyRecord as StockHistory);
      
      // Keep recent history, clean old records
      const allHistory = await db.stockHistory.orderBy('timestamp').reverse().toArray();
      if (allHistory.length > 1000) {
          const toDelete = allHistory.slice(1000);
          await db.stockHistory.bulkDelete(toDelete.map(h => h.id));
      }
      
      notifyChange('stock');
  },

  getStockHistory: async (): Promise<StockHistory[]> => {
    return await db.stockHistory.orderBy('timestamp').reverse().toArray();
  },

  // --- Customers ---
  getCustomers: async (): Promise<Customer[]> => {
    return await db.customers.toArray();
  },
  
  saveCustomer: async (customer: Customer): Promise<void> => {
    if (customer.id === 0 || !customer.id) {
      // New customer - let Dexie auto-increment
      delete (customer as any).id;
      await db.customers.add(customer);
    } else {
      await db.customers.update(customer.id, customer);
    }
    notifyChange('customers');
  },
  
  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
      const bills = await db.bills.toArray();
      const toCustomer = await db.customers.get(toId);

      if (!toCustomer) return;

      let updatedBills = false;
      for (const b of bills) {
          if (b.customerId === fromId) {
              b.customerId = toId;
              b.customerName = toCustomer.name;
              b.customerPhone = toCustomer.phone;
              b.customerAddress = toCustomer.address;
              b.customerGstin = toCustomer.gstin;
              await db.bills.put(b);
              updatedBills = true;
          }
      }
      
      if (updatedBills) {
          notifyChange('bills');
      }

      await db.customers.delete(fromId);
      notifyChange('customers');
  },

  // --- Bills ---
  getBills: async (): Promise<Bill[]> => {
    return await db.bills.toArray();
  },
  
  saveBill: async (bill: Bill): Promise<void> => {
    // Let Dexie auto-increment the ID
    delete (bill as any).id;
    const newId = await db.bills.add(bill);
    bill.id = newId as number;
    notifyChange('bills');

    // Deduct stock for each item
    for (const item of bill.items) {
        await StorageService.updateStock(item.productId, -item.quantity, 'sale', `Invoice: ${bill.invoiceNumber}`);
    }
  },
  
  getNextInvoiceNumber: async (): Promise<string> => {
    const settings = await StorageService.getSettings();
    const bills = await db.bills.toArray();
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
    let persons = await db.salesPersons.toArray();
    
    if (persons.length === 0) {
        const defaults = [
            { id: 1, name: 'Admin', isActive: true },
            { id: 2, name: 'Counter Sale', isActive: true }
        ];
        await db.salesPersons.bulkAdd(defaults);
        persons = defaults;
    }
    
    return persons;
  },
  
  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    if (person.id === 0 || !person.id) {
        // New sales person - let Dexie auto-increment
        delete (person as any).id;
        await db.salesPersons.add(person);
    } else {
        await db.salesPersons.update(person.id, person);
    }
    notifyChange('salesPersons');
  },

  // --- Backups ---
  performAutoBackup: async (): Promise<void> => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const backups = await db.backups.toArray();
      
      // Check if backup already exists for today
      const existing = backups.find(b => b.type === 'auto' && b.timestamp.startsWith(dateStr));
      if (existing) return;

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
      const newBackup: Omit<BackupRecord, 'id'> & { id?: string } = {
          timestamp: now.toISOString(),
          type: 'auto',
          size: fullData.length,
          data: fullData
      };
      
      await db.backups.add(newBackup as BackupRecord);
      
      // Keep only last 7 backups
      const allBackups = await db.backups.orderBy('timestamp').reverse().toArray();
      if (allBackups.length > 7) {
          const toDelete = allBackups.slice(7);
          await db.backups.bulkDelete(toDelete.map(b => b.id));
      }
  },
  
  getBackups: async (): Promise<BackupRecord[]> => {
    return await db.backups.orderBy('timestamp').reverse().toArray();
  },
  
  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
      try {
          const data = JSON.parse(backup.data);
          
          // Clear all tables
          await db.products.clear();
          await db.customers.clear();
          await db.bills.clear();
          await db.salesPersons.clear();
          await db.stockHistory.clear();
          await db.users.clear();
          
          // Restore data
          if (data.settings) await setKeyValue('nhw_settings', data.settings);
          if (data.products && data.products.length > 0) await db.products.bulkAdd(data.products);
          if (data.customers && data.customers.length > 0) await db.customers.bulkAdd(data.customers);
          if (data.bills && data.bills.length > 0) await db.bills.bulkAdd(data.bills);
          if (data.salesPersons && data.salesPersons.length > 0) await db.salesPersons.bulkAdd(data.salesPersons);
          if (data.stockHistory && data.stockHistory.length > 0) await db.stockHistory.bulkAdd(data.stockHistory);
          if (data.users && data.users.length > 0) await db.users.bulkAdd(data.users);
          
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

          // Validate backup has expected structure
          const { settings, products, customers, bills, salesPersons, stockHistory, users } = backupData.data;
          
          if (!settings) {
              return { success: false, message: 'Backup missing settings data' };
          }

          // Clear and restore data
          await db.products.clear();
          await db.customers.clear();
          await db.bills.clear();
          await db.salesPersons.clear();
          await db.stockHistory.clear();
          await db.users.clear();

          // Import all data
          if (settings) await setKeyValue('nhw_settings', settings);
          if (products && products.length > 0) await db.products.bulkAdd(products);
          if (customers && customers.length > 0) await db.customers.bulkAdd(customers);
          if (bills && bills.length > 0) await db.bills.bulkAdd(bills);
          if (salesPersons && salesPersons.length > 0) await db.salesPersons.bulkAdd(salesPersons);
          if (stockHistory && stockHistory.length > 0) await db.stockHistory.bulkAdd(stockHistory);
          if (users && users.length > 0) await db.users.bulkAdd(users);

          notifyChange('import');
          return { success: true, message: 'Backup imported successfully!' };
      } catch (e) {
          console.error("Import failed", e);
          return { success: false, message: `Import failed: ${(e as Error).message}` };
      }
  },

  // --- Clear all data ---
  clearAllData: async (): Promise<void> => {
    await db.products.clear();
    await db.customers.clear();
    await db.bills.clear();
    await db.salesPersons.clear();
    await db.stockHistory.clear();
    await db.backups.clear();
    await db.users.clear();
    localStorage.clear();
    notifyChange('clear');
  }
};