// Service to manage the user-selected data directory path.
// The path is persisted in the SQLite settings table under the key 'data_path'.
// This module also provides helpers for the invoices and backups sub-folder paths.

import { StorageService } from './storage';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

const DATA_PATH_KEY = '__data_path__';

let _cachedPath: string | null = null;

/**
 * Get the configured data directory path.
 * Returns null if first-run setup hasn't been completed yet.
 */
export const getDataPath = async (): Promise<string | null> => {
  if (_cachedPath) return _cachedPath;

  try {
    const settings = await StorageService.getSettings();
    // The data path is stored as a special key in settings
    const raw = (settings as any)[DATA_PATH_KEY];
    if (raw && typeof raw === 'string') {
      _cachedPath = raw;
      return raw;
    }
  } catch {
    // Settings not loaded yet
  }

  // Fallback: directly query the DB setting
  try {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      const db = await Database.load('sqlite:nhw_data.db');
      const rows: any[] = await db.select(
        "SELECT value FROM settings WHERE key = $1",
        [DATA_PATH_KEY]
      );
      if (rows.length > 0 && rows[0].value) {
        _cachedPath = rows[0].value;
        return _cachedPath;
      }
    }
  } catch {
    // DB not ready
  }

  return null;
};

/**
 * Save the data directory path to the database.
 */
export const setDataPath = async (path: string): Promise<void> => {
  const isTauri = !!(window as any).__TAURI_INTERNALS__;
  if (!isTauri) return;

  const Database = (await import('@tauri-apps/plugin-sql')).default;
  const db = await Database.load('sqlite:nhw_data.db');
  await db.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
    [DATA_PATH_KEY, path]
  );
  _cachedPath = path;
};

/**
 * Get the invoices sub-folder path.
 */
export const getInvoicesPath = async (): Promise<string | null> => {
  const base = await getDataPath();
  return base ? `${base}\\invoices` : null;
};

/**
 * Get the backups sub-folder path.
 */
export const getBackupsPath = async (): Promise<string | null> => {
  const base = await getDataPath();
  return base ? `${base}\\backups` : null;
};

/**
 * Ensure that the data directory and its sub-folders exist.
 * Creates them if missing (e.g. user manually deleted a folder).
 */
export const ensureDataFolders = async (): Promise<void> => {
  const base = await getDataPath();
  if (!base) return;

  for (const dir of [base, `${base}\\invoices`, `${base}\\backups`]) {
    try {
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true });
      }
    } catch {
      // Best-effort
    }
  }
};

/**
 * Check whether the first-run setup has been completed.
 */
export const isFirstRunComplete = async (): Promise<boolean> => {
  const path = await getDataPath();
  return path !== null && path.length > 0;
};

/**
 * Clear the cached path (used when changing location from Settings).
 */
export const clearCachedPath = (): void => {
  _cachedPath = null;
};
