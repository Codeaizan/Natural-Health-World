import React, { useEffect, useState, useMemo } from 'react';                 // React hooks
import { useToast } from '../components/Toast';                              // Toast notifications
import { StorageService } from '../services/storage';                         // Database operations
import { TaxComplianceService } from '../services/compliance';                // Tax calculations & reconciliation
import { Bill, GSTR1Data, GSTR2Data, TaxAuditLog, ComplianceAlert, TaxAdjustment } from '../types'; // Type definitions
import {
  FileText,                                                                   // Icons for filing status
  AlertTriangle,                                                              // Critical alert icon
  CheckCircle,                                                                // Reconciled status icon
  Download,                                                                   // Export download button
  Plus,                                                                       // Add new item
  X,                                                                          // Close modal
  Clock,                                                                      // Due date timer
  Lock,                                                                       // Audit log locked icon
  AlertCircle,                                                                // Info/warning icon
} from 'lucide-react';

const TaxCompliance: React.FC = () => {
  const toast = useToast();                                                  // Toast system
  const [bills, setBills] = useState<Bill[]>([]);                            // All bills for tax processing
  // Active tab state (overview | gstr1 | gstr2 | reconciliation | adjustments | audit | alerts)
  const [activeTab, setActiveTab] = useState<'overview' | 'gstr1' | 'gstr2' | 'reconciliation' | 'adjustments' | 'audit' | 'alerts'>('overview');
  // Selected month for GSTR filing (1-12)
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  // Selected year for GSTR filing
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  // GSTR-1 data (sales tax records)
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null);
  // GSTR-2 data (purchase tax records)
  const [gstr2Data, setGstr2Data] = useState<GSTR2Data | null>(null);
  // Audit logs for tax transactions
  const [auditLogs, setAuditLogs] = useState<TaxAuditLog[]>([]);
  // Compliance alerts (deadlines, discrepancies, etc)
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  // Tax adjustments (TDS, excise, etc)
  const [adjustments, setAdjustments] = useState<TaxAdjustment[]>([]);
  // TDS adjustment input field
  const [tdsAmount, setTdsAmount] = useState<string>('');
  // Excise duty adjustment input field
  const [exciseAmount, setExciseAmount] = useState<string>('');
  // Show/hide adjustment form modal
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  // Loading state during data fetch
  const [loading, setLoading] = useState(true);

  // === LIFECYCLE: Load bills, generate GSTR data, check compliance on mount ===
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch all bills from database
        const billsData = await StorageService.getBills();
        const settings = await StorageService.getSettings();

        setBills(billsData);

        // Generate GSTR-1 (sales) and GSTR-2 (purchases) data for selected month/year
        const gstr1 = TaxComplianceService.generateGSTR1(billsData, selectedMonth, selectedYear);
        const gstr2 = TaxComplianceService.generateGSTR2(billsData, selectedMonth, selectedYear);

        setGstr1Data(gstr1);
        setGstr2Data(gstr2);

        // Load tax audit logs and adjustments from database
        setAuditLogs(TaxComplianceService.getTaxAuditLogs());
        setAdjustments(TaxComplianceService.getTaxAdjustments());

        // Check compliance rules (GST discrepancies, filing deadlines, etc) then reload alerts
        TaxComplianceService.checkCompliance(billsData, settings);
        setComplianceAlerts(TaxComplianceService.getComplianceAlerts());
      } catch (err) {
        console.error('Error loading tax compliance data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, selectedYear]);

  // === MEMOIZED: Calculate tax summary (collections, liability, TDS adjustments) ===
  const taxSummary = useMemo(() => {
    return gstr1Data ? TaxComplianceService.generateTaxSummary(bills, selectedMonth, selectedYear) : null;
  }, [gstr1Data, bills, selectedMonth, selectedYear]);

  // === MEMOIZED: Reconciliation status (matching GSTR-1 vs GSTR-2 taxes) ===
  const reconciliation = useMemo(() => {
    return (gstr1Data && gstr2Data) ? TaxComplianceService.reconcileTaxes(selectedMonth, selectedYear) : null;
  }, [gstr1Data, gstr2Data, selectedMonth, selectedYear]);

  // === HANDLER: Mark GSTR-1 as filed and update status ===
  const handleFileGSTR1 = () => {
    if (gstr1Data) {
      // Update GSTR-1 with filed status and current timestamp
      const updated = { ...gstr1Data, status: 'filed' as const, filingDate: new Date().toISOString() };
      // Persist to database
      TaxComplianceService.saveGSTR1(updated);
      setGstr1Data(updated);
      toast.success('GSTR-1 Filed', 'GSTR-1 filed successfully');
    }
  };

  // === HANDLER: Mark GSTR-2 as filed and update status ===
  const handleFileGSTR2 = () => {
    if (gstr2Data) {
      // Update GSTR-2 with filed status and current timestamp
      const updated = { ...gstr2Data, status: 'filed' as const, filingDate: new Date().toISOString() };
      // Persist to database
      TaxComplianceService.saveGSTR2(updated);
      setGstr2Data(updated);
      toast.success('GSTR-2 Filed', 'GSTR-2 filed successfully');
    }
  };

  // === HANDLER: Add TDS or excise tax adjustment to liabilitydeduction ===
  const handleAddAdjustment = (type: 'tds' | 'excise') => {
    // Parse input amount based on adjustment type
    const amount = type === 'tds' ? parseFloat(tdsAmount) : parseFloat(exciseAmount);
    // Validate: amount must be positive number
    if (isNaN(amount) || amount <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    // Create adjustment record
    const adjustment: TaxAdjustment = {
      id: `adj_${Date.now()}`,
      date: new Date().toISOString(),
      type: type === 'tds' ? 'tds' : 'excise',
      amount,
      // Set description based on type and standard rates
      description: type === 'tds' ? `TDS @ 2% adjustment` : `Excise duty @ 5% adjustment`,
    };

    // Save to database and update UI
    TaxComplianceService.addTaxAdjustment(adjustment);
    setAdjustments([...adjustments, adjustment]);
    // Clear form inputs and close form
    setTdsAmount('');
    setExciseAmount('');
    setShowAdjustmentForm(false);
  };

  // === HANDLER: Dismiss/close a compliance alert ===
  const handleDismissAlert = (alertId: string) => {
    // Remove alert from database and UI state
    TaxComplianceService.dismissAlert(alertId);
    setComplianceAlerts(complianceAlerts.filter(a => a.id !== alertId));
  };

  // === HANDLER: Export GSTR data to JSON file for government portal upload ===
  const handleExportGSTR = async (type: 'gstr1' | 'gstr2') => {
    const data = type === 'gstr1' ? gstr1Data : gstr2Data;
    if (!data) return;
    // Generate export payload with filing-compliant format
    const exportPayload = TaxComplianceService.exportForFiling(
      type === 'gstr1' ? data as GSTR1Data : gstr1Data!,
      type === 'gstr2' ? data as GSTR2Data : gstr2Data!
    );
    const jsonStr = JSON.stringify(type === 'gstr1' ? { gstr1: exportPayload.gstr1, items: (data as GSTR1Data).gstItems } : { gstr2: exportPayload.gstr2, items: (data as GSTR2Data).purchaseItems }, null, 2);
    // Create filename: gstr1_2024_03.json or gstr2_2024_03.json
    const filename = `${type}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.json`;
    try {
      // === TAURI PATH: Use native save dialog ===
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({ defaultPath: filename, filters: [{ name: 'JSON Files', extensions: ['json'] }] });
      if (filePath) {
        await writeTextFile(filePath, jsonStr);
        toast.success('Export Complete', `${type.toUpperCase()} exported to: ${filePath}`);
      }
    } catch {
      // === FALLBACK: Browser download (if Tauri fails) ===
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Export Complete', `${type.toUpperCase()} downloaded`);
    }
  };

  // === LOADING STATE === Show spinner while data loads ===
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading tax data...</p>
      </div>
    );
  }

  // === CONSTANTS === Month names and current date info ===
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* === PAGE HEADER === */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tax & Compliance Management</h1>
          <p className="text-gray-600 mt-2">GST Reconciliation, GSTR Filing & Tax Audit Trail</p>
        </div>

        {/* === COMPLIANCE ALERTS SECTION === Shows critical/warning/info alerts at top === */}
        {complianceAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {/* Render each alert with severity-based styling */}
            {complianceAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border flex items-start justify-between ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex gap-3">
                  {/* Icon varies by severity */}
                  {alert.severity === 'critical' && <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />}
                  {alert.severity === 'warning' && <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />}
                  {alert.severity === 'info' && <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />}
                  {/* Alert title and description */}
                  <div>
                    <h3 className={`font-semibold ${alert.severity === 'critical' ? 'text-red-900' : alert.severity === 'warning' ? 'text-yellow-900' : 'text-blue-900'}`}>
                      {alert.title}
                    </h3>
                    <p className={`text-sm mt-1 ${alert.severity === 'critical' ? 'text-red-800' : alert.severity === 'warning' ? 'text-yellow-800' : 'text-blue-800'}`}>
                      {alert.description}
                    </p>
                  </div>
                </div>
                {/* Dismiss button */}
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* === PERIOD SELECTOR === Dropdown for month and year selection === */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Period</label>
            <div className="flex gap-3">
              {/* Month selector */}
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {monthNames.map((month, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {month}
                  </option>
                ))}
              </select>
              {/* Year selector (current ±2 years) */}
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* === TAX SUMMARY CARDS === KPI stats for GST collection, liability, TDS, net liability === */}
        {taxSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Total GST collected (CGST + SGST + IGST) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">Total GST Collected</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">₹{taxSummary.totalGstCollected.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">CGST • SGST • IGST</p>
            </div>
            {/* Total GST liability (amount to be paid to government) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">GST Liability</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">₹{taxSummary.totalGstLiability.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Net Payable</p>
            </div>
            {/* TDS deductions made during the period */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">TDS Adjustments</p>
              <p className="text-2xl font-bold text-green-600 mt-2">-₹{taxSummary.tdsAdjustments.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">@ 2% TDS</p>
            </div>
            {/* Final tax liability after all adjustments and credits */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">Net Tax Liability</p>
              <p className={`text-2xl font-bold mt-2 ${taxSummary.netTaxLiability > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{Math.abs(taxSummary.netTaxLiability).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{taxSummary.netTaxLiability > 0 ? 'To be paid' : 'Refund due'}</p>
            </div>
          </div>
        )}

        {/* === TABS NAVIGATION === 7 tabs: overview, gstr1, gstr2, reconciliation, adjustments, audit, alerts === */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            {/* Each tab button toggles activeTab state */}
            {(['overview', 'gstr1', 'gstr2', 'reconciliation', 'adjustments', 'audit', 'alerts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {/* Uppercase tab name (overview, GSTR1, etc) */}
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* === OVERVIEW TAB === Shows GST breakdown (CGST/SGST/IGST) and reconciliation status === */}
            {activeTab === 'overview' && taxSummary && reconciliation && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">GST Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CGST (Central GST, 9%) */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-700">CGST (9%)</p>
                      <p className="text-xl font-bold text-blue-600 mt-2">₹{taxSummary.cgstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.cgstCollected.toFixed(0)}</p>
                    </div>
                    {/* SGST (State GST, 9%) */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-700">SGST (9%)</p>
                      <p className="text-xl font-bold text-green-600 mt-2">₹{taxSummary.sgstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.sgstCollected.toFixed(0)}</p>
                    </div>
                    {/* IGST (Integrated GST for inter-state, 18%) */}
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-700">IGST (18%)</p>
                      <p className="text-xl font-bold text-purple-600 mt-2">₹{taxSummary.igstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.igstCollected.toFixed(0)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Reconciliation Status</h3>
                  {/* Reconciliation status box with icon */}
                  <div className={`p-4 rounded-lg border-2 ${reconciliation.status === 'reconciled' ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-center gap-3">
                      {reconciliation.status === 'reconciled' ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <AlertCircle className="text-yellow-600" size={24} />
                      )}
                      <div>
                        {/* Status title (Reconciled or Needs Review) */}
                        <p className="font-semibold text-gray-900">
                          {reconciliation.status === 'reconciled' ? 'Reconciled' : 'Needs Review'}
                        </p>
                        {/* Tax amounts and discrepancy */}
                        <p className="text-sm text-gray-600">
                          GSTR-1 Tax: ₹{reconciliation.gstr1TaxAmount.toFixed(0)} | GSTR-2 Tax: ₹{reconciliation.gstr2TaxAmount.toFixed(0)} | Discrepancy: ₹{reconciliation.discrepancy.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === GSTR-1 TAB === Sales (outbound) GST transactions for filing */}
            {activeTab === 'gstr1' && gstr1Data && (
              <div className="space-y-4">
                {/* Header with filing button and export */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">GSTR-1 (Sales)</h3>
                    <p className="text-sm text-gray-600 mt-1">{gstr1Data.gstItems.length} items found</p>
                  </div>
                  <div className="flex gap-2">
                    {/* File GSTR-1 button: disabled if already filed */}
                    <button
                      onClick={handleFileGSTR1}
                      disabled={gstr1Data.status === 'filed'}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                        gstr1Data.status === 'filed'
                          ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <FileText size={18} />
                      {gstr1Data.status === 'filed' ? 'Filed' : 'File Now'}
                    </button>
                    {/* Export GSTR-1 data to JSON */}
                    <button onClick={() => handleExportGSTR('gstr1')} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2">
                      <Download size={18} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Summary box: total taxable value and tax amount */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    Total Taxable Value: <span className="text-blue-600 font-bold">₹{gstr1Data.totalTaxableValue.toFixed(0)}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-2">
                    Total Tax Amount: <span className="text-blue-600 font-bold">₹{gstr1Data.totalTaxAmount.toFixed(0)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-3">Status: <span className="font-semibold uppercase text-blue-700">{gstr1Data.status}</span></p>
                </div>

                {/* Table: list of invoices with HSN codes, taxable values, and tax amounts */}
                {gstr1Data.gstItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Invoice</th>  {/* Invoice number */}
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Customer</th>  {/* Buyer name */}
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">HSN</th>  {/* Harmonized System of Nomenclature code */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Taxable Value</th>  {/* Amount before tax */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax %</th>  {/* Tax rate (9/18/28%) */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax Amt</th>  {/* Calculated tax amount */}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Map first 10 GSTR-1 items to table rows */}
                        {gstr1Data.gstItems.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900 font-medium">{item.invoiceNumber}</td>
                            <td className="px-4 py-2 text-gray-700">{item.customerName}</td>
                            <td className="px-4 py-2 text-gray-700">{item.hsnCode}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">₹{item.taxableValue.toFixed(0)}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{item.taxRate.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">₹{item.taxAmount.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* === GSTR-2 TAB === Purchase (inbound) GST transactions for filing */}
            {activeTab === 'gstr2' && gstr2Data && (
              <div className="space-y-4">
                {/* Header with filing button and export */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">GSTR-2 (Purchases)</h3>
                    <p className="text-sm text-gray-600 mt-1">{gstr2Data.purchaseItems.length} items found</p>
                  </div>
                  <div className="flex gap-2">
                    {/* File GSTR-2 button: disabled if already filed */}
                    <button
                      onClick={handleFileGSTR2}
                      disabled={gstr2Data.status === 'filed'}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                        gstr2Data.status === 'filed'
                          ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <FileText size={18} />
                      {gstr2Data.status === 'filed' ? 'Filed' : 'File Now'}
                    </button>
                    {/* Export GSTR-2 data to JSON */}
                    <button onClick={() => handleExportGSTR('gstr2')} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2">
                      <Download size={18} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Summary box: total taxable value and tax amount */}
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    Total Taxable Value: <span className="text-green-600 font-bold">₹{gstr2Data.totalTaxableValue.toFixed(0)}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-2">
                    Total Tax Amount: <span className="text-green-600 font-bold">₹{gstr2Data.totalTaxAmount.toFixed(0)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-3">Status: <span className="font-semibold uppercase text-green-700">{gstr2Data.status}</span></p>
                </div>

                {/* Table: list of purchase invoices with HSN codes, values, and taxes */}
                {gstr2Data.purchaseItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Invoice</th>  {/* Vendor invoice number */}
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Vendor</th>  {/* Supplier name */}
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">HSN</th>  {/* Harmonized System of Nomenclature code */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Taxable Value</th>  {/* Amount before tax */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax %</th>  {/* Tax rate (9/18/28%) */}
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax Amt</th>  {/* Calculated tax amount for ITC (input tax credit) */}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Map first 10 GSTR-2 items (purchases) to table rows */}
                        {gstr2Data.purchaseItems.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900 font-medium">{item.invoiceNumber}</td>
                            <td className="px-4 py-2 text-gray-700">{item.customerName}</td>
                            <td className="px-4 py-2 text-gray-700">{item.hsnCode}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">₹{item.taxableValue.toFixed(0)}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{item.taxRate.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">₹{item.taxAmount.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* === RECONCILIATION TAB === Compare GSTR-1 (sales) vs GSTR-2 (purchases) to find discrepancies */}
            {activeTab === 'reconciliation' && reconciliation && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Tax Reconciliation Report</h3>

                {/* Two-column grid: GSTR-1 vs GSTR-2 comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* GSTR-1 (Sales) summary box */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">GSTR-1 (Sales)</p>
                    <p className="text-xl font-bold text-blue-600 mt-2">₹{reconciliation.gstr1TaxAmount.toFixed(0)}</p>
                    <p className="text-xs text-gray-600 mt-1">Taxable: ₹{reconciliation.gstr1TaxableValue.toFixed(0)}</p>
                  </div>

                  {/* GSTR-2 (Purchases) summary box */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">GSTR-2 (Purchases)</p>
                    <p className="text-xl font-bold text-green-600 mt-2">₹{reconciliation.gstr2TaxAmount.toFixed(0)}</p>
                    <p className="text-xs text-gray-600 mt-1">Taxable: ₹{reconciliation.gstr2TaxableValue.toFixed(0)}</p>
                  </div>
                </div>

                {/* Discrepancy alert box: green if reconciled, yellow if discrepancy */}
                <div className={`p-4 rounded-lg border-2 ${reconciliation.discrepancy === 0 ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                  <p className={reconciliation.discrepancy === 0 ? 'text-green-800' : 'text-yellow-800'}>
                    <span className="font-semibold">Discrepancy:</span> ₹{reconciliation.discrepancy.toFixed(0)} ({reconciliation.discrepancyPercent.toFixed(2)}%)
                  </p>
                  <p className={`text-sm mt-2 ${reconciliation.discrepancy === 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {reconciliation.status === 'reconciled' ? '✓ Reconciled - All values match' : '⚠ Needs review - Discrepancy detected'}
                  </p>
                </div>
              </div>
            )}

            {/* === ADJUSTMENTS TAB === Manual TDS (tax deducted at source) and Excise adjustments */}
            {activeTab === 'adjustments' && (
              <div className="space-y-4">
                {/* Header with add adjustment button */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Tax Adjustments (TDS, Excise)</h3>
                  <button
                    onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}  // Toggle form visibility
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add Adjustment
                  </button>
                </div>

                {/* Form: add new TDS or Excise adjustment */}
                {showAdjustmentForm && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3 mb-4">
                    {/* TDS input: Tax deducted at source (typically 2%) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">TDS Amount (@ 2%)</label>
                      <input
                        type="number"
                        value={tdsAmount}
                        onChange={e => setTdsAmount(e.target.value)}
                        placeholder="Enter TDS amount"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    {/* Excise input: Excise duty (typically 5%) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Excise Duty Amount (@ 5%)</label>
                      <input
                        type="number"
                        value={exciseAmount}
                        onChange={e => setExciseAmount(e.target.value)}
                        placeholder="Enter excise duty amount"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    {/* Form action buttons */}
                    <div className="flex gap-2">
                      {/* Add TDS button */}
                      <button
                        onClick={() => handleAddAdjustment('tds')}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Add TDS
                      </button>
                      {/* Add Excise button */}
                      <button
                        onClick={() => handleAddAdjustment('excise')}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Add Excise
                      </button>
                      {/* Cancel button*/}
                      <button
                        onClick={() => setShowAdjustmentForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* List of previous adjustments (TDS/Excise) */}
                <div className="space-y-2">
                  {adjustments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No adjustments yet</p>
                  ) : (
                    adjustments.map(adj => (
                      <div key={adj.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{adj.description}</p>  {/* TDS or Excise description */}
                            <p className="text-xs text-gray-600 mt-1">{new Date(adj.date).toLocaleDateString()}</p>  {/* Adjustment date */}
                          </div>
                          <p className="text-lg font-bold text-green-600">-₹{adj.amount.toFixed(0)}</p>  {/* Shows as credit (reduction) */}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* === AUDIT TRAIL TAB === Immutable log of all tax actions (filed reports, adjustments) sorted newest first */}
            {activeTab === 'audit' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Audit Trail</h3>
                {auditLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No audit logs yet</p>
                ) : (
                  auditLogs.slice().reverse().map(log => (
                    <div key={log.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* Action name: e.g., "GSTR-1 Filed", "TDS Adjustment Added" */}
                          <p className="font-semibold text-gray-900">{log.action}</p>
                          {/* Detailed description of the action */}
                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                          {/* Timestamp of when action occurred (immutable record) */}
                          <p className="text-xs text-gray-500 mt-2">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          {/* Tax impact: positive = liability increase (red), negative = credit (green) */}
                          <p className={`font-bold text-lg ${log.taxImpact >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {log.taxImpact >= 0 ? '+' : '-'}₹{Math.abs(log.taxImpact).toFixed(0)}
                          </p>
                          {/* Locked icon: audit trail records cannot be modified */}
                          <Lock className="text-gray-400 mt-2" size={16} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* === ALERTS TAB === Compliance notifications with severity levels (critical/warning/info) and due dates */}
            {activeTab === 'alerts' && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Alerts & Notifications</h3>
                {complianceAlerts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No active alerts</p>
                ) : (
                  complianceAlerts.map(alert => (
                    <div key={alert.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          {/* Alert title: e.g., "GSTR-1 Due", "Tax Deposit Required" */}
                          <p className="font-semibold text-gray-900">{alert.title}</p>
                          {/* Alert description with specifics and recommended action */}
                          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                          {/* Optional due date with clock icon */}
                          {alert.dueDate && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <Clock size={14} />
                              Due: {new Date(alert.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {/* Severity badge: critical (red) / warning (yellow) / info (blue) */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              alert.severity === 'critical'
                                ? 'bg-red-100 text-red-800'  // Critical: red background
                                : alert.severity === 'warning'
                                ? 'bg-yellow-100 text-yellow-800'  // Warning: yellow background
                                : 'bg-blue-100 text-blue-800'  // Info: blue background
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* === INFO BOX --- Tax compliance guidelines === */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Tax Compliance Guidelines</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• GSTR-1 must be filed by 10th of next month (11th for non-business)</li>
                <li>• GSTR-2 must be filed by 15th of next month</li>
                <li>• TDS @ 2% is deducted on B2B transactions</li>
                <li>• Excise @ 5% applies to select ayurvedic preparations</li>
                <li>• Monthly reconciliation of GSTR-1 and GSTR-2 is recommended</li>
                <li>• All transactions must be recorded in audit trail for regulatory compliance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === EXPORT === React component for GST compliance management
export default TaxCompliance;
