import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

const DB_KEYS = {
  SETTINGS: 'nhw_settings',
  PRODUCTS: 'nhw_products',
  CUSTOMERS: 'nhw_customers',
  BILLS: 'nhw_bills',
  SALES_PERSONS: 'nhw_sales_persons',
  STOCK_HISTORY: 'nhw_stock_history',
  BACKUPS: 'nhw_backups',
  USERS: 'nhw_users'
};

const load = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const save = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Change notification (simple observer) ---
const _listeners = new Set<(type?: string) => void>();
const notifyChange = (type?: string) => {
  _listeners.forEach(cb => {
    try { cb(type); } catch (e) { /* ignore listener errors */ }
  });
};

// Simple Hash for "bcrypt-like" behavior (Browser compatible)
const hashPassword = async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const StorageService = {
  addChangeListener: (cb: (type?: string) => void) => _listeners.add(cb),
  removeChangeListener: (cb: (type?: string) => void) => _listeners.delete(cb),
  // --- Settings ---
  getSettings: (): CompanySettings => load(DB_KEYS.SETTINGS, DEFAULT_SETTINGS),
  saveSettings: (settings: CompanySettings) => save(DB_KEYS.SETTINGS, settings),

  // --- Auth & Users ---
  getUsers: (): User[] => {
      const users = load<User[]>(DB_KEYS.USERS, []);
      if (users.length === 0) {
          // Default Admin (Password: admin123) - SHA256 hash
          const defaultAdmin: User = {
              username: 'admin',
              passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 
              role: 'admin'
          };
          save(DB_KEYS.USERS, [defaultAdmin]);
          return [defaultAdmin];
      }
      return users;
  },
  
  saveUser: (user: User) => {
      const users = StorageService.getUsers();
      const existingIdx = users.findIndex(u => u.username === user.username);
      if (existingIdx >= 0) {
          users[existingIdx] = user;
      } else {
          users.push(user);
      }
      save(DB_KEYS.USERS, users);
  },

  verifyCredentials: async (u: string, p: string): Promise<User | null> => {
      const users = StorageService.getUsers();
      const user = users.find(user => user.username === u);
      if (!user) return null;
      
      const hash = await hashPassword(p);
      if (user.passwordHash === hash) {
          // Update last login
          user.lastLogin = new Date().toISOString();
          StorageService.saveUser(user);
          return user;
      }
      return null;
  },
  
  hashPassword, // Export for use in settings

  // --- Products ---
  getProducts: (): Product[] => load(DB_KEYS.PRODUCTS, []),
  saveProduct: (product: Product) => {
    const list = load<Product[]>(DB_KEYS.PRODUCTS, []);
    // Ensure numbers are numbers
    product.currentStock = Number(product.currentStock);
    product.mrp = Number(product.mrp);
    product.purchasePrice = Number(product.purchasePrice);
    
    if (product.id === 0) {
      product.id = Date.now();
      list.push(product);
    } else {
      const idx = list.findIndex(p => p.id === product.id);
      if (idx !== -1) list[idx] = product;
    }
    save(DB_KEYS.PRODUCTS, list);
    notifyChange('products');
  },
  deleteProduct: (id: number) => {
    let list = load<Product[]>(DB_KEYS.PRODUCTS, []);
    list = list.filter(p => p.id !== id);
    save(DB_KEYS.PRODUCTS, list);
    notifyChange('products');
  },
  
  // --- Stock Logic ---
  updateStock: (productId: number, quantityChange: number, reason: string, referenceId: string = '') => {
      const products = load<Product[]>(DB_KEYS.PRODUCTS, []);
      const product = products.find(p => p.id === productId);
      
      let productName = 'Unknown';
      if (product) {
          productName = product.name;
          // CRITICAL: Force number conversion to avoid string concatenation issues
          const current = Number(product.currentStock);
          const change = Number(quantityChange);
          product.currentStock = current + change;
          save(DB_KEYS.PRODUCTS, products);
      }

      // History
      const history = load<StockHistory[]>(DB_KEYS.STOCK_HISTORY, []);
      history.unshift({
          id: Date.now(),
          timestamp: new Date().toISOString(),
          productId,
          productName,
          changeAmount: Number(quantityChange),
          reason,
          referenceId
      });
      if (history.length > 1000) history.length = 1000;
      save(DB_KEYS.STOCK_HISTORY, history);
        notifyChange('stock');
  },

  getStockHistory: (): StockHistory[] => load(DB_KEYS.STOCK_HISTORY, []),

  // --- Customers ---
  getCustomers: (): Customer[] => load(DB_KEYS.CUSTOMERS, []),
  saveCustomer: (customer: Customer) => {
    const list = load<Customer[]>(DB_KEYS.CUSTOMERS, []);
    if (customer.id === 0) {
      customer.id = Date.now();
      list.push(customer);
    } else {
      const idx = list.findIndex(c => c.id === customer.id);
      if (idx !== -1) list[idx] = customer;
    }
    save(DB_KEYS.CUSTOMERS, list);
    notifyChange('customers');
  },
  mergeCustomers: (fromId: number, toId: number) => {
      const bills = load<Bill[]>(DB_KEYS.BILLS, []);
      let updatedBills = false;
      const customers = load<Customer[]>(DB_KEYS.CUSTOMERS, []);
      const toCustomer = customers.find(c => c.id === toId);

      if(!toCustomer) return; 

      bills.forEach(b => {
          if (b.customerId === fromId) {
              b.customerId = toId;
              b.customerName = toCustomer.name;
              b.customerPhone = toCustomer.phone;
              b.customerAddress = toCustomer.address;
              b.customerGstin = toCustomer.gstin;
              updatedBills = true;
          }
      });
      if (updatedBills) save(DB_KEYS.BILLS, bills);
      if (updatedBills) notifyChange('bills');

      const newCustomers = customers.filter(c => c.id !== fromId);
      save(DB_KEYS.CUSTOMERS, newCustomers);
        notifyChange('customers');
  },

  // --- Bills ---
  getBills: (): Bill[] => load(DB_KEYS.BILLS, []),
  saveBill: (bill: Bill) => {
    const list = load<Bill[]>(DB_KEYS.BILLS, []);
    bill.id = Date.now();
    list.push(bill);
    save(DB_KEYS.BILLS, list);

    notifyChange('bills');

    bill.items.forEach(item => {
        // deduct stock (negative change)
        StorageService.updateStock(item.productId, -item.quantity, 'sale', `Invoice: ${bill.invoiceNumber}`);
    });
  },
  getNextInvoiceNumber: (): string => {
    const settings = load(DB_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const bills = load<Bill[]>(DB_KEYS.BILLS, []);
    
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
  getSalesPersons: (): SalesPerson[] => load(DB_KEYS.SALES_PERSONS, [
      { id: 1, name: 'Admin', isActive: true }, 
      { id: 2, name: 'Counter Sale', isActive: true }
  ]),
  saveSalesPerson: (person: SalesPerson) => {
    // Corrected to ensure we load existing (including potential defaults) before saving
    const list = StorageService.getSalesPersons();
    if(person.id === 0) {
        person.id = Date.now();
        list.push(person);
    } else {
        const idx = list.findIndex(p => p.id === person.id);
        if(idx !== -1) list[idx] = person;
    }
    save(DB_KEYS.SALES_PERSONS, list);
    notifyChange('salesPersons');
  },

  // --- Backups ---
  performAutoBackup: () => {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const backups = load<BackupRecord[]>(DB_KEYS.BACKUPS, []);
      
      // Check if backup already exists for today
      const existing = backups.find(b => b.type === 'auto' && b.timestamp.startsWith(dateStr));
      if (existing) return;

      const fullData = JSON.stringify(localStorage);
      const newBackup: BackupRecord = {
          id: Date.now().toString(),
          timestamp: now.toISOString(),
          type: 'auto',
          size: fullData.length,
          data: fullData
      };
      
      const updatedBackups = [newBackup, ...backups].slice(0, 7); // Keep last 7
      save(DB_KEYS.BACKUPS, updatedBackups);
  },
  
  getBackups: (): BackupRecord[] => load(DB_KEYS.BACKUPS, []),
  
  restoreBackup: (backup: BackupRecord) => {
      try {
          const data = JSON.parse(backup.data);
          localStorage.clear();
          Object.keys(data).forEach(k => {
              localStorage.setItem(k, data[k]);
          });
          return true;
      } catch (e) {
          console.error("Restore failed", e);
          return false;
      }
  }
};