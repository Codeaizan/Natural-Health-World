// Service to manage the user-selected data directory path.
// The path is persisted in the SQLite settings table under the key 'data_path'.
// This module also provides helpers for the invoices and backups sub-folder paths.

// StorageService provides a unified read/write API over the underlying SQLite database
import { StorageService } from './storage';
// exists and mkdir are Tauri filesystem plugin APIs — not available in plain browser builds
import { exists, mkdir } from '@tauri-apps/plugin-fs';

// Key used when storing/retrieving the data directory path from the settings table
const DATA_PATH_KEY = '__data_path__';

// Module-level in-memory cache to avoid repeated DB reads on every path lookup
let _cachedPath: string | null = null;

/**
 * Get the configured data directory path.
 * Returns null if first-run setup hasn't been completed yet.
 */
export const getDataPath = async (): Promise<string | null> => {
  if (_cachedPath) return _cachedPath; // Return the cached value immediately if already loaded

  try {
    const settings = await StorageService.getSettings(); // Read all settings from the database
    // The data path is stored as a special extra key inside the general settings object
    const raw = (settings as any)[DATA_PATH_KEY]; // Cast to 'any' because DATA_PATH_KEY is a dynamic field
    if (raw && typeof raw === 'string') { // Only accept a non-empty string value
      _cachedPath = raw; // Cache the value for future calls to avoid repeated DB reads
      return raw; // Return the retrieved path string
    }
  } catch {
    // Settings not yet loaded — fall through to the direct DB query fallback below
  }

  // Fallback: directly query the settings table when StorageService isn't ready yet
  try {
    const isTauri = !!(window as any).__TAURI_INTERNALS__; // Detect if running inside the Tauri desktop wrapper
    if (isTauri) {
      const Database = (await import('@tauri-apps/plugin-sql')).default; // Dynamically import the SQL plugin
      const db = await Database.load('sqlite:nhw_data.db'); // Open the SQLite database file
      const rows: any[] = await db.select(
        "SELECT value FROM settings WHERE key = $1", // Parameterised query prevents SQL injection
        [DATA_PATH_KEY] // Bind the key constant as the query parameter
      );
      if (rows.length > 0 && rows[0].value) { // Ensure at least one matching row was returned
        _cachedPath = rows[0].value; // Cache the value
        return _cachedPath; // Return the path from the database row
      }
    }
  } catch {
    // DB not ready (e.g. first app launch before migration) — fall through to null
  }

  return null; // No path configured — first-run setup has not been completed
};

/**
 * Save the data directory path to the database.
 */
export const setDataPath = async (path: string): Promise<void> => {
  const isTauri = !!(window as any).__TAURI_INTERNALS__; // File-system paths only apply inside Tauri desktop
  if (!isTauri) return; // Browser fallback does not use a local file-system path

  const Database = (await import('@tauri-apps/plugin-sql')).default; // Dynamically load the SQL plugin
  const db = await Database.load('sqlite:nhw_data.db'); // Open the SQLite database
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)", // Upsert: insert new or overwrite existing
    [DATA_PATH_KEY, path] // Bind the settings key and the new directory path
  );
  _cachedPath = path; // Update the in-memory cache so the next read is instant
};

/**
 * Get the invoices sub-folder path.
 */
export const getInvoicesPath = async (): Promise<string | null> => {
  const base = await getDataPath(); // Retrieve the configured root data directory
  return base ? `${base}\\invoices` : null; // Append the 'invoices' subfolder or return null
};

/**
 * Get the backups sub-folder path.
 */
export const getBackupsPath = async (): Promise<string | null> => {
  const base = await getDataPath(); // Retrieve the configured root data directory
  return base ? `${base}\\backups` : null; // Append the 'backups' subfolder or return null
};

/**
 * Ensure that the data directory and its sub-folders exist.
 * Creates them if missing (e.g. user manually deleted a folder).
 */
export const ensureDataFolders = async (): Promise<void> => {
  const base = await getDataPath(); // Retrieve root directory; abort if not configured
  if (!base) return; // No path set — nothing to create

  // Iterate over the three directories that must always exist
  for (const dir of [base, `${base}\\invoices`, `${base}\\backups`]) {
    try {
      if (!(await exists(dir))) {             // Only create if the directory is missing
        await mkdir(dir, { recursive: true }); // Create the directory and any missing parents
      }
    } catch {
      // Best-effort — a single folder failure should not abort the remaining iterations
    }
  }
};

/**
 * Check whether the first-run setup has been completed.
 */
export const isFirstRunComplete = async (): Promise<boolean> => {
  const path = await getDataPath(); // Read the persisted data directory path
  return path !== null && path.length > 0; // A non-null, non-empty path means setup is complete
};

/**
 * Clear the cached path (used when changing location from Settings).
 */
export const clearCachedPath = (): void => {
  _cachedPath = null; // Purge the in-memory cache so the next call re-reads from the database
};
