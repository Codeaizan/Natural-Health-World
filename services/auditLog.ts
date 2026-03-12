/**
 * General Audit Log Service
 * Tracks all significant user actions across the application.
 * Stored in localStorage under 'nhw_audit_logs'.
 */

// Shape of a single audit log entry written whenever a user performs a significant action
export interface AuditLogEntry {
  id: string;          // Unique ID: "audit_<ms-timestamp>_<6-char-random>" (e.g. audit_1709123456789_ab3f)
  timestamp: string;   // ISO-8601 date-time string of when the action occurred
  user: string;        // Username of the person who triggered the action (or 'system' for automated tasks)
  category: 'billing' | 'inventory' | 'customer' | 'settings' | 'tax' | 'auth' | 'export' | 'data'; // Functional area
  action: string;      // Short verb phrase (e.g. "Created invoice", "Deleted product")
  details: string;     // Human-readable description with full specifics
  metadata?: Record<string, any>; // Optional structured key-value data for programmatic inspection
}

// localStorage key where the JSON array of audit entries is persisted
const AUDIT_KEY = 'nhw_audit_logs';
// Hard cap on stored entries — oldest entries are discarded once exceeded
const MAX_LOGS = 5000; // Keep last 5000 entries
// Entries older than this many days are automatically purged on every write operation
const MAX_AGE_DAYS = 90; // Auto-prune entries older than 90 days

// Remove log entries that fall outside the 90-day retention window.
// Returns a new filtered array; does not mutate the original.
const pruneByAge = (logs: AuditLogEntry[]): AuditLogEntry[] => {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Cutoff in milliseconds
  return logs.filter(l => new Date(l.timestamp).getTime() >= cutoff); // Keep entries at or after cutoff
};

// Read all stored audit entries from localStorage.
// Returns an empty array when no data exists or when JSON parsing fails (avoids crashing callers).
const load = (): AuditLogEntry[] => {
  try {
    const data = localStorage.getItem(AUDIT_KEY); // Read the raw JSON string from browser storage
    return data ? JSON.parse(data) : []; // Parse into array or fall back to empty default
  } catch {
    return []; // JSON parse error or storage unavailable — return safe empty array
  }
};

// Persist the provided log array to localStorage.
// Prunes by age, caps at MAX_LOGS, and retries with fewer entries if QuotaExceededError is thrown.
const save = (logs: AuditLogEntry[]): void => {
  try {
    // First pass: drop entries older than 90 days, then trim to the maximum count
    let trimmed = pruneByAge(logs); // Remove aged entries
    trimmed = trimmed.length > MAX_LOGS ? trimmed.slice(-MAX_LOGS) : trimmed; // Cap to newest MAX_LOGS
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed)); // Write trimmed array as JSON
    } catch (quotaErr) {
      // QuotaExceededError — aggressively halve and retry
      console.warn('Audit log quota exceeded, pruning aggressively...'); // Alert developer
      const halved = trimmed.slice(-Math.floor(trimmed.length / 2)); // Keep only the newest half
      try {
        localStorage.setItem(AUDIT_KEY, JSON.stringify(halved)); // Second attempt with half the entries
      } catch {
        // Last resort: keep only the latest 200 entries to free maximum localStorage space
        localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed.slice(-200)));
      }
    }
  } catch (err) {
    console.error('Failed to save audit logs:', err); // Log unexpected errors without crashing
  }
};

// Retrieve the currently logged-in username from sessionStorage.
// Falls back to 'system' when no session is active (e.g. scheduled/automated tasks).
const getCurrentUser = (): string => {
  return sessionStorage.getItem('nhw_user') || 'system'; // 'nhw_user' is written on successful login
};

// Public API object — all external callers should use these methods instead of the private helpers above
export const AuditLogService = {
  // Record a new audit event. Builds a timestamped entry and appends it to the persisted log.
  log: (
    category: AuditLogEntry['category'], // Functional area that triggered the event (e.g. 'billing')
    action: string,                       // Short label for the event (e.g. "Deleted product")
    details: string,                      // Longer human-readable description (e.g. "Deleted 'Paracetamol 500mg'")
    metadata?: Record<string, any>        // Optional structured data for programmatic analysis
  ): void => {
    const logs = load(); // Load existing entries from localStorage before appending
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, // Unique ID: ms timestamp + 6 random chars
      timestamp: new Date().toISOString(), // Capture the exact moment the action occurred
      user: getCurrentUser(),              // Attribute the entry to the logged-in user (or 'system')
      category,  // Category value passed by the caller
      action,    // Action label passed by the caller
      details,   // Description passed by the caller
      metadata,  // Optional extra data (may be undefined)
    };
    logs.push(entry); // Append the new entry to the in-memory array
    save(logs);        // Persist the updated array back to localStorage
  },

  // Return a filtered, sorted list of audit entries.
  // All filter options are optional — calling with no arguments returns ALL entries (newest first).
  getLogs: (options?: {
    category?: AuditLogEntry['category']; // Narrow results to one functional area
    startDate?: string;                   // ISO date string — include entries from this date onward
    endDate?: string;                     // ISO date string — include entries up to and including this date
    user?: string;                        // Show only entries created by this specific user
    search?: string;                      // Case-insensitive text search across action, details, and category
    limit?: number;                       // Maximum number of results to return
  }): AuditLogEntry[] => {
    let logs = load(); // Load all persisted entries from localStorage

    // Sort newest first so the most recent actions appear at the top
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.category) {
      logs = logs.filter(l => l.category === options.category); // Retain only entries matching the requested category
    }
    if (options?.startDate) {
      const start = new Date(options.startDate).getTime(); // Convert ISO string to ms for comparison
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= start); // Drop entries before the start date
    }
    if (options?.endDate) {
      const end = new Date(options.endDate).getTime() + 86400000; // +24 h in ms so the end day is fully included
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= end); // Drop entries after the end day
    }
    if (options?.user) {
      logs = logs.filter(l => l.user === options.user); // Show only the specified user's actions
    }
    if (options?.search) {
      const q = options.search.toLowerCase(); // Normalise to lowercase for case-insensitive matching
      logs = logs.filter(l =>
        l.action.toLowerCase().includes(q) ||   // Match against the action label
        l.details.toLowerCase().includes(q) ||  // Match against the details description
        l.category.toLowerCase().includes(q)    // Match against the category name
      );
    }
    if (options?.limit) {
      logs = logs.slice(0, options.limit); // Truncate to the requested maximum number of results
    }

    return logs; // Return the filtered and sorted array
  },

  // Permanently delete ALL audit log entries from localStorage.
  clearLogs: (): void => {
    localStorage.removeItem(AUDIT_KEY); // Remove the entire JSON blob in a single operation
  },

  // Return aggregate statistics about the stored audit logs.
  // Used by the Audit Logs page header to display summary cards.
  getStats: () => {
    const logs = load(); // Load all entries from localStorage
    const categories: Record<string, number> = {}; // Will hold { billing: N, inventory: N, ... }
    const users: Record<string, number> = {};       // Will hold { admin: N, staff: N, ... }

    logs.forEach(l => {
      categories[l.category] = (categories[l.category] || 0) + 1; // Increment this category's running total
      users[l.user] = (users[l.user] || 0) + 1;                   // Increment this user's running total
    });

    return {
      totalEntries: logs.length,  // Grand total of all stored entries
      categories,                  // Per-category breakdown object
      users,                       // Per-user breakdown object
      oldestEntry: logs.length > 0 ? logs[0].timestamp : null,             // Earliest entry's timestamp (or null if empty)
      newestEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null, // Most recent entry's timestamp (or null)
    };
  },
};
