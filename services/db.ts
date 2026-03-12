// Dexie is a thin wrapper around IndexedDB that provides a promise-based API
import Dexie, { Table } from 'dexie';
// Import all domain types so Dexie tables are strongly typed
import { CompanySettings, Product, Customer, Bill, SalesPerson, StockHistory, BackupRecord, User } from '../types';

// Generic key-value row shape used by the 'data' table (stores settings, etc.)
export interface StoredData {
  key: string;   // Primary key — unique string identifier (e.g. 'nhw_settings')
  value: any;    // JSON-serialisable arbitrary payload stored against the key
}

// NHWDatabase holds ALL IndexedDB object stores for the browser storage backend.
// Extends Dexie so that migrations (version upgrades) are handled automatically.
export class NHWDatabase extends Dexie {
  // Declare table properties — the '!' non-null assertion satisfies TypeScript;
  // Dexie populates these at runtime via the version().stores() call below.
  data!: Table<StoredData>;         // Generic key-value store (app settings, etc.)
  products!: Table<Product>;        // Medicines / goods catalogue
  customers!: Table<Customer>;      // Customer contact and GST details
  bills!: Table<Bill>;              // Completed sales invoices
  salesPersons!: Table<SalesPerson>; // Staff who can be attached to bills
  stockHistory!: Table<StockHistory>; // Audit trail of every stock movement
  backups!: Table<BackupRecord>;    // Saved backup snapshots with metadata
  users!: Table<User>;              // App login accounts

  constructor() {
    super('NaturalHealthWorldDB'); // IndexedDB database name shown in DevTools
    this.version(3).stores({
      // Simple key-value store for settings — key is the primary key
      data: 'key',
      
      // Products table — '++id' = auto-increment PK; 'name' = searchable index
      products: '++id, name',
      
      // Customers table — indexed by gstin for GST lookups and phone for search
      customers: '++id, gstin, phone',
      
      // Bills table — compound index [customerId+date] supports per-customer history queries
      bills: '++id, invoiceNumber, customerId, [customerId+date]',
      
      // Sales persons — only needs auto-increment PK, no search indexes required
      salesPersons: '++id',
      
      // Stock history — compound index [productId+timestamp] enables efficient product ledger queries
      stockHistory: '++id, timestamp, productId, [productId+timestamp]',
      
      // Backups — indexed by timestamp so the latest backup is easily retrieved
      backups: '++id, timestamp',
      
      // Users — '&username' = unique index; duplicate usernames are rejected by Dexie
      users: '&username'
    });
  }
}

// Create the single shared database instance used across the entire browser storage backend
export const db = new NHWDatabase();

// Open the database as soon as the module loads; log any open failure to the console
db.open().catch(err => console.error('Failed to open database:', err));

// Retrieve a value from the generic key-value 'data' store.
// Returns defaultValue when the key does not exist.
export const getKeyValue = async (key: string, defaultValue: any = null): Promise<any> => {
  const record = await db.data.get(key); // Look up the row by its primary key
  return record ? record.value : defaultValue; // Unwrap the 'value' field or fall back
};

// Persist a value to the generic key-value 'data' store.
// 'put' either inserts a new row or overwrites an existing one with the same key.
export const setKeyValue = async (key: string, value: any): Promise<void> => {
  await db.data.put({ key, value }); // Upsert the {key, value} row
};

// Remove a row from the generic key-value 'data' store by its key.
export const deleteKeyValue = async (key: string): Promise<void> => {
  await db.data.delete(key); // Hard-delete the row; no-op if key does not exist
};

// Perform a basic health check on the database by counting rows in the 'data' table.
// Returns true when the database is open and responsive, false on any error.
export const checkDatabaseStatus = async (): Promise<boolean> => {
  try {
    await db.table('data').count(); // Any valid query confirms the database is accessible
    return true;  // Database is healthy
  } catch (error) {
    console.error('Database error:', error); // Log the underlying Dexie/IDB error
    return false; // Signal that the database is unavailable
  }
};
