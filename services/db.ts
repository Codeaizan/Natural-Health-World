import Dexie, { Table } from 'dexie';
import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';

export interface StoredData {
  key: string;
  value: any;
}

export class NHWDatabase extends Dexie {
  // Declare tables
  data!: Table<StoredData>;
  products!: Table<Product>;
  customers!: Table<Customer>;
  bills!: Table<Bill>;
  salesPersons!: Table<SalesPerson>;
  stockHistory!: Table<StockHistory>;
  backups!: Table<BackupRecord>;
  users!: Table<User>;

  constructor() {
    super('NaturalHealthWorldDB');
    this.version(3).stores({
      // Simple key-value store for settings
      data: 'key',
      
      // Products table - auto-increment ID, searchable by name
      products: '++id, name',
      
      // Customers table with indexes
      customers: '++id, gstin, phone',
      
      // Bills table with indexes for fast queries
      bills: '++id, invoiceNumber, customerId, [customerId+date]',
      
      // Sales persons
      salesPersons: '++id',
      
      // Stock history - indexed by productId for fast lookups
      stockHistory: '++id, timestamp, productId, [productId+timestamp]',
      
      // Backups
      backups: '++id, timestamp',
      
      // Users
      users: '&username'
    });
  }
}

// Export singleton instance
export const db = new NHWDatabase();

// Initialize database on load
db.open().catch(err => console.error('Failed to open database:', err));

// Helper function to get/set key-value data
export const getKeyValue = async (key: string, defaultValue: any = null): Promise<any> => {
  const record = await db.data.get(key);
  return record ? record.value : defaultValue;
};

export const setKeyValue = async (key: string, value: any): Promise<void> => {
  await db.data.put({ key, value });
};

export const deleteKeyValue = async (key: string): Promise<void> => {
  await db.data.delete(key);
};

// Helper function to check database status
export const checkDatabaseStatus = async (): Promise<boolean> => {
  try {
    await db.table('data').count();
    return true;
  } catch (error) {
    console.error('Database error:', error);
    return false;
  }
};
