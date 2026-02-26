/**
 * General Audit Log Service
 * Tracks all significant user actions across the application.
 * Stored in localStorage under 'nhw_audit_logs'.
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  category: 'billing' | 'inventory' | 'customer' | 'settings' | 'tax' | 'auth' | 'export' | 'data';
  action: string;
  details: string;
  metadata?: Record<string, any>;
}

const AUDIT_KEY = 'nhw_audit_logs';
const MAX_LOGS = 5000; // Keep last 5000 entries
const MAX_AGE_DAYS = 90; // Auto-prune entries older than 90 days

const pruneByAge = (logs: AuditLogEntry[]): AuditLogEntry[] => {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return logs.filter(l => new Date(l.timestamp).getTime() >= cutoff);
};

const load = (): AuditLogEntry[] => {
  try {
    const data = localStorage.getItem(AUDIT_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const save = (logs: AuditLogEntry[]): void => {
  try {
    // Prune old entries first, then cap count
    let trimmed = pruneByAge(logs);
    trimmed = trimmed.length > MAX_LOGS ? trimmed.slice(-MAX_LOGS) : trimmed;
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
    } catch (quotaErr) {
      // QuotaExceededError — aggressively halve and retry
      console.warn('Audit log quota exceeded, pruning aggressively...');
      const halved = trimmed.slice(-Math.floor(trimmed.length / 2));
      try {
        localStorage.setItem(AUDIT_KEY, JSON.stringify(halved));
      } catch {
        // Last resort: keep only the latest 200 entries
        localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed.slice(-200)));
      }
    }
  } catch (err) {
    console.error('Failed to save audit logs:', err);
  }
};

const getCurrentUser = (): string => {
  return sessionStorage.getItem('nhw_user') || 'system';
};

export const AuditLogService = {
  log: (
    category: AuditLogEntry['category'],
    action: string,
    details: string,
    metadata?: Record<string, any>
  ): void => {
    const logs = load();
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      user: getCurrentUser(),
      category,
      action,
      details,
      metadata,
    };
    logs.push(entry);
    save(logs);
  },

  getLogs: (options?: {
    category?: AuditLogEntry['category'];
    startDate?: string;
    endDate?: string;
    user?: string;
    search?: string;
    limit?: number;
  }): AuditLogEntry[] => {
    let logs = load();

    // Sort newest first
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.category) {
      logs = logs.filter(l => l.category === options.category);
    }
    if (options?.startDate) {
      const start = new Date(options.startDate).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (options?.endDate) {
      const end = new Date(options.endDate).getTime() + 86400000; // Include end day
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    if (options?.user) {
      logs = logs.filter(l => l.user === options.user);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      logs = logs.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    }
    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  },

  clearLogs: (): void => {
    localStorage.removeItem(AUDIT_KEY);
  },

  getStats: () => {
    const logs = load();
    const categories: Record<string, number> = {};
    const users: Record<string, number> = {};

    logs.forEach(l => {
      categories[l.category] = (categories[l.category] || 0) + 1;
      users[l.user] = (users[l.user] || 0) + 1;
    });

    return {
      totalEntries: logs.length,
      categories,
      users,
      oldestEntry: logs.length > 0 ? logs[0].timestamp : null,
      newestEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    };
  },
};
