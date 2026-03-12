import React, { useState, useEffect, useMemo } from 'react';                   // React hooks for component logic
import { useToast } from '../components/Toast';                               // Toast notification system
import { AuditLogService, AuditLogEntry } from '../services/auditLog';       // Service to fetch general audit logs
import { TaxComplianceService } from '../services/compliance';                // Service to fetch tax-related audit logs
import { TaxAuditLog } from '../types';                                      // Type definition for tax audit log entries
import {
  Search, Filter, Trash2, Download, Clock, User, AlertCircle,              // Icons for search, filter, delete, download, clock, user, alert
  ShoppingCart, Package, Users, Settings, FileText, Shield, Database, Upload // Icons for category indicators
} from 'lucide-react';                                                       // Icon library

// Map category names to their corresponding icons
const categoryIcons: Record<string, React.ElementType> = {
  billing: ShoppingCart,                                                    // Shopping cart icon for billing category
  inventory: Package,                                                       // Package icon for inventory category
  customer: Users,                                                          // Users icon for customer category
  settings: Settings,                                                       // Settings icon for settings category
  tax: FileText,                                                            // File text icon for tax category
  auth: Shield,                                                             // Shield icon for authentication category
  export: Upload,                                                           // Upload icon for export category
  data: Database,                                                           // Database icon for data category
};

// Map category names to their Tailwind CSS color classes for styling
const categoryColors: Record<string, string> = {
  billing: 'bg-blue-100 text-blue-700',                                    // Blue for billing
  inventory: 'bg-green-100 text-green-700',                                // Green for inventory
  customer: 'bg-purple-100 text-purple-700',                               // Purple for customer
  settings: 'bg-gray-100 text-gray-700',                                   // Gray for settings
  tax: 'bg-orange-100 text-orange-700',                                    // Orange for tax
  auth: 'bg-red-100 text-red-700',                                         // Red for auth
  export: 'bg-cyan-100 text-cyan-700',                                     // Cyan for export
  data: 'bg-indigo-100 text-indigo-700',                                   // Indigo for data
};

const AuditLogs: React.FC = () => {
  const toast = useToast();                                                  // Toast notifications for user feedback
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);                    // General audit log entries (billing, inventory, etc.)
  const [taxLogs, setTaxLogs] = useState<TaxAuditLog[]>([]);               // Tax-specific audit log entries
  const [activeTab, setActiveTab] = useState<'general' | 'tax'>('general'); // Current tab view: general logs or tax logs
  const [searchQuery, setSearchQuery] = useState('');                       // Search query to filter logs by action/details/user
  const [categoryFilter, setCategoryFilter] = useState<string>('all');      // Filter logs by category (billing, inventory, etc.)
  const [startDate, setStartDate] = useState('');                           // Date range filter: start date
  const [endDate, setEndDate] = useState('');                               // Date range filter: end date
  const [showFilters, setShowFilters] = useState(false);                    // Toggle visibility of filter panel

  const loadLogs = () => {
    try {
      const generalLogs = AuditLogService.getLogs();                        // Fetch all general audit logs from service
      setLogs(generalLogs);                                                 // Update state with general logs
    } catch (err) {
      console.error('Failed to load general audit logs:', err);             // Log error if fetch fails
      setLogs([]);                                                          // Set empty array on error
    }
    try {
      const tax = TaxComplianceService.getTaxAuditLogs();                   // Fetch all tax audit logs from service
      setTaxLogs(tax.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); // Sort tax logs by timestamp (newest first)
    } catch (err) {
      console.error('Failed to load tax audit logs:', err);                 // Log error if fetch fails
      setTaxLogs([]);                                                       // Set empty array on error
    }
  };

  useEffect(() => {
    loadLogs();                                                              // Load logs when component mounts or tab changes
  }, [activeTab]);

  const filteredLogs = useMemo(() => {
    let filtered = [...logs];                                               // Copy general logs array
    if (categoryFilter !== 'all') {                                         // If category filter is active (not 'all')
      filtered = filtered.filter(l => l.category === categoryFilter);       // Keep only logs matching selected category
    }
    if (searchQuery) {                                                      // If search query is provided
      const q = searchQuery.toLowerCase();                                  // Convert search to lowercase for case-insensitive matching
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(q) ||                              // Match in action field
        l.details.toLowerCase().includes(q) ||                             // Match in details field
        (l.user && l.user.toLowerCase().includes(q))                       // Match in user field
      );
    }
    if (startDate) {                                                        // If start date filter is set
      const start = new Date(startDate).getTime();                          // Convert to timestamp
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= start); // Keep logs on or after start date
    }
    if (endDate) {                                                          // If end date filter is set
      const end = new Date(endDate).getTime() + 86400000;                   // Convert to timestamp and add 24 hours (to include entire end date)
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= end); // Keep logs on or before end date
    }
    return filtered;                                                        // Return filtered logs
  }, [logs, categoryFilter, startDate, endDate, searchQuery]);             // Recompute when any dependency changes

  const filteredTaxLogs = useMemo(() => {
    let filtered = [...taxLogs];                                            // Copy tax logs array
    if (searchQuery) {                                                      // If search query is provided
      const q = searchQuery.toLowerCase();                                  // Convert search to lowercase
      filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(q) ||                              // Match in action field
        l.details.toLowerCase().includes(q)                                // Match in details field
      );
    }
    if (startDate) {                                                        // If start date filter is set
      const start = new Date(startDate).getTime();                          // Convert to timestamp
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() >= start); // Keep logs on or after start date
    }
    if (endDate) {                                                          // If end date filter is set
      const end = new Date(endDate).getTime() + 86400000;                   // Convert to timestamp and add 24 hours
      filtered = filtered.filter(l => new Date(l.timestamp).getTime() <= end); // Keep logs on or before end date
    }
    return filtered;                                                        // Return filtered logs
  }, [taxLogs, searchQuery, startDate, endDate]);                          // Recompute when any dependency changes

  const stats = useMemo(() => AuditLogService.getStats(), [logs]);         // Calculate stats (total entries, categories, users) from logs

  const handleClearLogs = async () => {
    const confirmed = await toast.confirm({
      title: 'Clear Audit Logs',
      message: 'Are you sure you want to clear ALL audit logs? This cannot be undone.',
      confirmText: 'Clear All',
      danger: true
    });
    if (confirmed) {                                                        // If user confirmed deletion
      AuditLogService.clearLogs();                                          // Clear all logs from service
      loadLogs();                                                           // Reload logs (should be empty now)
    }
  };

  const handleExportLogs = async () => {
    const data = activeTab === 'general' ? filteredLogs : filteredTaxLogs; // Export filtered logs from active tab
    const jsonStr = JSON.stringify(data, null, 2);                         // Convert logs to JSON string with formatting
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');          // Import Tauri dialog plugin for file save dialog
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');     // Import Tauri file system plugin to write files
      const filePath = await save({
        defaultPath: `audit_logs_${new Date().toISOString().split('T')[0]}.json`, // Suggest filename with date
        filters: [{ name: 'JSON Files', extensions: ['json'] }],           // Filter to show JSON files
      });
      if (filePath) {                                                      // If user selected a save location
        await writeTextFile(filePath, jsonStr);                             // Write JSON to selected file
        toast.success('Export Complete', `Audit logs exported to: ${filePath}`); // Show success toast
      }
    } catch {
      // Fallback to browser download if Tauri fails (e.g., on web version)
      const blob = new Blob([jsonStr], { type: 'application/json' });     // Create blob from JSON string
      const url = URL.createObjectURL(blob);                               // Create temporary blob URL
      const link = document.createElement('a');                            // Create temporary link element
      link.href = url;                                                     // Set link href to blob URL
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`; // Set filename
      document.body.appendChild(link);                                      // Add link to DOM
      link.click();                                                         // Click to trigger browser download
      document.body.removeChild(link);                                      // Remove link from DOM
      URL.revokeObjectURL(url);                                             // Clean up blob URL
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);                                                // Parse ISO date string
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); // Format as DD-Mon-YYYY
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);                                                // Parse ISO date string
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); // Format as HH:MM:SS
  };

  const allCategories = ['all', 'billing', 'inventory', 'customer', 'settings', 'tax', 'auth', 'export', 'data']; // Available category filter options

  return (
    <div className="space-y-6">
      {/* Header Stats Cards — Display overall audit log statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total Entries</p>
          <p className="text-2xl font-bold text-gray-800">{stats.totalEntries}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold">Tax Audit Logs</p>
          <p className="text-2xl font-bold text-orange-600">{taxLogs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold">Categories</p>
          <p className="text-2xl font-bold text-blue-600">{Object.keys(stats.categories).length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-500 uppercase font-semibold">Active Users</p>
          <p className="text-2xl font-bold text-green-600">{Object.keys(stats.users).length}</p>
        </div>
      </div>

      {/* Tabs & Controls — Tab switcher, clear/export buttons, search bar, filter panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab Buttons — General Audit Log vs Tax Audit Log tabs */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              General Audit Log ({filteredLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tax'
                  ? 'border-orange-600 text-orange-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Tax Audit Log ({filteredTaxLogs.length})
            </button>
          </div>
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200"
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Search & Filters — Search bar and date range filter section */}
        <div className="p-4 border-b border-gray-200 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${
                showFilters
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600'
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
                  className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm"
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
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm"
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

        {/* Log Entries Display — Render general or tax logs based on active tab */}
        <div className="max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' ? (
            filteredLogs.length === 0 ? (
              <div key="general-empty" className="p-8 text-center text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No audit log entries found</p>
                <p className="text-xs mt-1">Actions across the app will be logged here automatically</p>
              </div>
            ) : (
              <div key="general-list" className="divide-y divide-gray-100">
                {filteredLogs.map((log, idx) => {
                  const Icon = categoryIcons[log.category] || AlertCircle;
                  const colorClass = categoryColors[log.category] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={`${log.id}_${idx}`} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${colorClass}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-gray-800">{log.action}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
                              {log.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">{log.details}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
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
              <div key="tax-empty" className="p-8 text-center text-gray-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No tax audit logs found</p>
              </div>
            ) : (
              <div key="tax-list" className="divide-y divide-gray-100">
                {filteredTaxLogs.map((log, idx) => (
                  <div key={`${log.id}_${idx}`} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg mt-0.5 bg-orange-100 text-orange-700">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-800">{log.action}</span>
                          {typeof log.taxImpact === 'number' && log.taxImpact !== 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                              log.taxImpact > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {log.taxImpact > 0 ? '+' : ''}₹{log.taxImpact.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{log.details}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
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
