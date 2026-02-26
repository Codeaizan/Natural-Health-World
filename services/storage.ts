// Auto-detecting StorageService wrapper
// Uses SQLite (via Tauri) when running as a desktop app
// Falls back to IndexedDB (via Dexie) when running in a browser

import type { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';
import { AuditLogService } from './auditLog';

// Detect if running inside Tauri desktop app
const isTauri = (): boolean => {
  return !!(window as any).__TAURI_INTERNALS__;
};

// --- Change notification (shared, works immediately) ---
const _listeners = new Set<(type?: string) => void>();

// Lazy-loaded backend
let _backend: any = null;
let _backendReady: Promise<any> | null = null;

const getBackend = (): Promise<any> => {
  if (_backend) return Promise.resolve(_backend);
  if (_backendReady) return _backendReady;

  _backendReady = (async () => {
    if (isTauri()) {
      const mod = await import('./sqliteStorage');
      _backend = mod.StorageService;
    } else {
      const mod = await import('./dexieStorage');
      _backend = mod.StorageService;
    }
    // Forward all existing listeners to backend
    _listeners.forEach(cb => _backend.addChangeListener(cb));
    return _backend;
  })();

  return _backendReady;
};

export const StorageService = {
  // --- Synchronous listener management (work immediately) ---
  addChangeListener: (cb: (type?: string) => void) => {
    _listeners.add(cb);
    if (_backend) _backend.addChangeListener(cb);
  },
  removeChangeListener: (cb: (type?: string) => void) => {
    _listeners.delete(cb);
    if (_backend) _backend.removeChangeListener(cb);
  },

  // --- Settings ---
  getSettings: async (): Promise<CompanySettings> => {
    const b = await getBackend();
    return b.getSettings();
  },
  saveSettings: async (settings: CompanySettings): Promise<void> => {
    const b = await getBackend();
    await b.saveSettings(settings);
    AuditLogService.log('settings', 'Settings Updated', `Company settings updated for "${settings.name}"`);
  },

  // --- Auth & Users ---
  getUsers: async (): Promise<User[]> => {
    const b = await getBackend();
    return b.getUsers();
  },
  saveUser: async (user: User): Promise<void> => {
    const b = await getBackend();
    return b.saveUser(user);
  },
  verifyCredentials: async (username: string, password: string): Promise<User | null> => {
    const b = await getBackend();
    return b.verifyCredentials(username, password);
  },
  hashPassword: async (password: string): Promise<string> => {
    const b = await getBackend();
    return b.hashPassword(password);
  },

  // --- Products ---
  getProducts: async (): Promise<Product[]> => {
    const b = await getBackend();
    return b.getProducts();
  },
  saveProduct: async (product: Product): Promise<void> => {
    const b = await getBackend();
    await b.saveProduct(product);
    AuditLogService.log('inventory', product.id ? 'Product Updated' : 'Product Added', `Product "${product.name}" (ID: ${product.id})`);
  },
  deleteProduct: async (id: number): Promise<void> => {
    const b = await getBackend();
    await b.deleteProduct(id);
    AuditLogService.log('inventory', 'Product Deleted', `Product ID: ${id} deleted`);
  },
  deleteAllProducts: async (): Promise<void> => {
    const b = await getBackend();
    return b.deleteAllProducts();
  },

  // --- Bills ---
  getBills: async (): Promise<Bill[]> => {
    const b = await getBackend();
    return b.getBills();
  },
  saveBill: async (bill: Bill): Promise<void> => {
    const b = await getBackend();
    await b.saveBill(bill);
    AuditLogService.log('billing', 'Bill Saved', `Invoice ${bill.invoiceNumber} for ${bill.customerName} - ₹${bill.grandTotal.toFixed(2)}`);
  },
  deleteBill: async (billId: number): Promise<void> => {
    const b = await getBackend();
    await b.deleteBill(billId);
    AuditLogService.log('billing', 'Bill Deleted', `Bill ID: ${billId} deleted`);
  },
  getNextInvoiceNumber: async (): Promise<string> => {
    const b = await getBackend();
    return b.getNextInvoiceNumber();
  },

  // --- Stock ---
  updateStock: async (productId: number, quantityChange: number, reason: string, referenceId: string = ''): Promise<void> => {
    const b = await getBackend();
    return b.updateStock(productId, quantityChange, reason, referenceId);
  },
  getStockHistory: async (): Promise<StockHistory[]> => {
    const b = await getBackend();
    return b.getStockHistory();
  },

  // --- Customers ---
  getCustomers: async (): Promise<Customer[]> => {
    const b = await getBackend();
    return b.getCustomers();
  },
  saveCustomer: async (customer: Customer): Promise<void> => {
    const b = await getBackend();
    await b.saveCustomer(customer);
    AuditLogService.log('customer', customer.id ? 'Customer Updated' : 'Customer Added', `Customer "${customer.name}" (ID: ${customer.id})`);
  },
  mergeCustomers: async (fromId: number, toId: number): Promise<void> => {
    const b = await getBackend();
    return b.mergeCustomers(fromId, toId);
  },

  // --- Sales Persons ---
  getSalesPersons: async (): Promise<SalesPerson[]> => {
    const b = await getBackend();
    return b.getSalesPersons();
  },
  saveSalesPerson: async (person: SalesPerson): Promise<void> => {
    const b = await getBackend();
    return b.saveSalesPerson(person);
  },

  // --- Backups ---
  performAutoBackup: async (): Promise<void> => {
    const b = await getBackend();
    return b.performAutoBackup();
  },
  getBackups: async (): Promise<BackupRecord[]> => {
    const b = await getBackend();
    return b.getBackups();
  },
  restoreBackup: async (backup: BackupRecord): Promise<boolean> => {
    const b = await getBackend();
    return b.restoreBackup(backup);
  },
  exportBackupFile: async (): Promise<string> => {
    const b = await getBackend();
    return b.exportBackupFile();
  },
  importBackupFile: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    const b = await getBackend();
    return b.importBackupFile(jsonData);
  },

  // --- Data Management ---
  clearAllData: async (): Promise<void> => {
    const b = await getBackend();
    AuditLogService.log('data', 'All Data Cleared', 'User cleared all application data');
    await b.clearAllData();
  }
};
