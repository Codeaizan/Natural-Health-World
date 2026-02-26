import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { AuditLogService, AuditLogEntry } from '../services/auditLog';
import { TaxComplianceService } from '../services/compliance';
import { TaxAuditLog } from '../types';
import { useTheme } from '../services/theme';
import {
  Search, Filter, Trash2, Download, Clock, User, AlertCircle,
  ShoppingCart, Package, Users, Settings, FileText, Shield, Database, Upload
} from 'lucide-react';

const categoryIcons: Record<string, React.ElementType> = {
  billing: ShoppingCart,
  inventory: Package,
  customer: Users,
  settings: Settings,
  tax: FileText,
  auth: Shield,
  export: Upload,
  data: Database,
};

const categoryColors: Record<string, string> = {
  billing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  inventory: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  customer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  settings: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  tax: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  auth: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  data: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const AuditLogs: React.FC = () => {
  const { isDark } = useTheme();
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [taxLogs, setTaxLogs] = useState<TaxAuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'tax'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadLogs = () => {
    try {
      const generalLogs = AuditLogService.getLogs();
      setLogs(generalLogs);
    } catch (err) {
      console.error('Failed to load general audit logs:', err);
      setLogs([]);
    }
    try {
      const tax = TaxComplianceService.getTaxAuditLogs();
      setTaxLogs(tax.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error('Failed to load tax audit logs:', err);
      setTaxLogs([]);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeTab]);

  const filteredLogs = useMemo(() => {
    let filtered = [...logs];
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(l => l.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        (l.user && l.user.toLowerCase().includes(q))
      );
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    return filtered;
  }, [logs, categoryFilter, startDate, endDate, searchQuery]);

  const filteredTaxLogs = useMemo(() => {
    let filtered = [...taxLogs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    return filtered;
  }, [taxLogs, searchQuery, startDate, endDate]);

  const stats = useMemo(() => AuditLogService.getStats(), [logs]);

  const handleClearLogs = async () => {
    const confirmed = await toast.confirm({
      title: 'Clear Audit Logs',
      message: 'Are you sure you want to clear ALL audit logs? This cannot be undone.',
      confirmText: 'Clear All',
      danger: true
    });
    if (confirmed) {
      AuditLogService.clearLogs();
      loadLogs();
    }
  };

  const handleExportLogs = async () => {
    const data = activeTab === 'general' ? filteredLogs : filteredTaxLogs;
    const jsonStr = JSON.stringify(data, null, 2);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: `audit_logs_${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });
      if (filePath) {
        await writeTextFile(filePath, jsonStr);
        toast.success('Export Complete', `Audit logs exported to: ${filePath}`);
      }
    } catch {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const allCategories = ['all', 'billing', 'inventory', 'customer', 'settings', 'tax', 'auth', 'export', 'data'];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Total Entries</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalEntries}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Tax Audit Logs</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{taxLogs.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Categories</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Object.keys(stats.categories).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Active Users</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{Object.keys(stats.users).length}</p>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Tab Buttons */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-green-600 text-green-700 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              General Audit Log ({filteredLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tax'
                  ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Tax Audit Log ({filteredTaxLogs.length})
            </button>
          </div>
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${
                showFilters
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Filter size={16} /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 items-center">
              {activeTab === 'general' && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                >
                  {allCategories.map(c => (
                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              )}
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
              />
              <button
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setStartDate(''); setEndDate(''); }}
                className="text-xs text-red-500 underline"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Log Entries */}
        <div className="max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' ? (
            filteredLogs.length === 0 ? (
              <div key="general-empty" className="p-8 text-center text-gray-400 dark:text-gray-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No audit log entries found</p>
                <p className="text-xs mt-1">Actions across the app will be logged here automatically</p>
              </div>
            ) : (
              <div key="general-list" className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredLogs.map((log, idx) => {
                  const Icon = categoryIcons[log.category] || AlertCircle;
                  const colorClass = categoryColors[log.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={`${log.id}_${idx}`} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${colorClass}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{log.action}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
                              {log.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{log.details}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(log.timestamp)} {formatTime(log.timestamp)}</span>
                            <span className="flex items-center gap-1"><User size={12} /> {log.user}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Tax Audit Logs Tab */
            filteredTaxLogs.length === 0 ? (
              <div key="tax-empty" className="p-8 text-center text-gray-400 dark:text-gray-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No tax audit logs found</p>
              </div>
            ) : (
              <div key="tax-list" className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredTaxLogs.map((log, idx) => (
                  <div key={`${log.id}_${idx}`} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg mt-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{log.action}</span>
                          {typeof log.taxImpact === 'number' && log.taxImpact !== 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                              log.taxImpact > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            }`}>
                              {log.taxImpact > 0 ? '+' : ''}₹{log.taxImpact.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{log.details}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(log.timestamp)} {formatTime(log.timestamp)}</span>
                          {log.userId && <span className="flex items-center gap-1"><User size={12} /> {log.userId}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
