import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { TaxComplianceService } from '../services/compliance';
import { Bill, GSTR1Data, GSTR2Data, TaxAuditLog, ComplianceAlert, TaxAdjustment } from '../types';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  Download,
  Plus,
  X,
  Clock,
  Lock,
  AlertCircle,
} from 'lucide-react';

const TaxCompliance: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'gstr1' | 'gstr2' | 'reconciliation' | 'adjustments' | 'audit' | 'alerts'>('overview');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null);
  const [gstr2Data, setGstr2Data] = useState<GSTR2Data | null>(null);
  const [auditLogs, setAuditLogs] = useState<TaxAuditLog[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  const [adjustments, setAdjustments] = useState<TaxAdjustment[]>([]);
  const [tdsAmount, setTdsAmount] = useState<string>('');
  const [exciseAmount, setExciseAmount] = useState<string>('');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const billsData = await StorageService.getBills();
        const settings = await StorageService.getSettings();

        setBills(billsData);

        // Generate GSTR data
        const gstr1 = TaxComplianceService.generateGSTR1(billsData, selectedMonth, selectedYear);
        const gstr2 = TaxComplianceService.generateGSTR2(billsData, selectedMonth, selectedYear);

        setGstr1Data(gstr1);
        setGstr2Data(gstr2);

        // Load logs and alerts
        setAuditLogs(TaxComplianceService.getTaxAuditLogs());
        setComplianceAlerts(TaxComplianceService.getComplianceAlerts());
        setAdjustments(TaxComplianceService.getTaxAdjustments());

        // Check compliance
        TaxComplianceService.checkCompliance(billsData, settings);
      } catch (err) {
        console.error('Error loading tax compliance data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, selectedYear]);

  const taxSummary = gstr1Data && TaxComplianceService.generateTaxSummary(bills, selectedMonth, selectedYear);
  const reconciliation = gstr1Data && gstr2Data && TaxComplianceService.reconcileTaxes(selectedMonth, selectedYear);

  const handleFileGSTR1 = () => {
    if (gstr1Data) {
      const updated = { ...gstr1Data, status: 'filed' as const, filingDate: new Date().toISOString() };
      TaxComplianceService.saveGSTR1(updated);
      setGstr1Data(updated);
      alert('GSTR-1 filed successfully');
    }
  };

  const handleFileGSTR2 = () => {
    if (gstr2Data) {
      const updated = { ...gstr2Data, status: 'filed' as const, filingDate: new Date().toISOString() };
      TaxComplianceService.saveGSTR2(updated);
      setGstr2Data(updated);
      alert('GSTR-2 filed successfully');
    }
  };

  const handleAddAdjustment = (type: 'tds' | 'excise') => {
    const amount = type === 'tds' ? parseFloat(tdsAmount) : parseFloat(exciseAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const adjustment: TaxAdjustment = {
      id: `adj_${Date.now()}`,
      date: new Date().toISOString(),
      type: type === 'tds' ? 'tds' : 'tcs',
      amount,
      description: type === 'tds' ? `TDS @ 2% adjustment` : `Excise duty @ 5% adjustment`,
    };

    TaxComplianceService.addTaxAdjustment(adjustment);
    setAdjustments([...adjustments, adjustment]);
    setTdsAmount('');
    setExciseAmount('');
    setShowAdjustmentForm(false);
  };

  const handleDismissAlert = (alertId: string) => {
    TaxComplianceService.dismissAlert(alertId);
    setComplianceAlerts(complianceAlerts.filter(a => a.id !== alertId));
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading tax data...</p>
      </div>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tax & Compliance Management</h1>
          <p className="text-gray-600 mt-2">GST Reconciliation, GSTR Filing & Tax Audit Trail</p>
        </div>

        {/* Compliance Alerts */}
        {complianceAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
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
                  {alert.severity === 'critical' && <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />}
                  {alert.severity === 'warning' && <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />}
                  {alert.severity === 'info' && <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />}
                  <div>
                    <h3 className={`font-semibold ${alert.severity === 'critical' ? 'text-red-900' : alert.severity === 'warning' ? 'text-yellow-900' : 'text-blue-900'}`}>
                      {alert.title}
                    </h3>
                    <p className={`text-sm mt-1 ${alert.severity === 'critical' ? 'text-red-800' : alert.severity === 'warning' ? 'text-yellow-800' : 'text-blue-800'}`}>
                      {alert.description}
                    </p>
                  </div>
                </div>
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

        {/* Month/Year Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Period</label>
            <div className="flex gap-3">
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

        {/* Tax Summary Cards */}
        {taxSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">Total GST Collected</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">₹{taxSummary.totalGstCollected.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">CGST • SGST • IGST</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">GST Liability</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">₹{taxSummary.totalGstLiability.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Net Payable</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">TDS Adjustments</p>
              <p className="text-2xl font-bold text-green-600 mt-2">-₹{taxSummary.tdsAdjustments.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">@ 2% TDS</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600 font-medium">Net Tax Liability</p>
              <p className={`text-2xl font-bold mt-2 ${taxSummary.netTaxLiability > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{Math.abs(taxSummary.netTaxLiability).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{taxSummary.netTaxLiability > 0 ? 'To be paid' : 'Refund due'}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
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
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && taxSummary && reconciliation && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">GST Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-700">CGST (9%)</p>
                      <p className="text-xl font-bold text-blue-600 mt-2">₹{taxSummary.cgstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.cgstCollected.toFixed(0)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-700">SGST (9%)</p>
                      <p className="text-xl font-bold text-green-600 mt-2">₹{taxSummary.sgstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.sgstCollected.toFixed(0)}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-gray-700">IGST (18%)</p>
                      <p className="text-xl font-bold text-purple-600 mt-2">₹{taxSummary.igstCollected.toFixed(0)}</p>
                      <p className="text-xs text-gray-600 mt-1">Collected: ₹{taxSummary.igstCollected.toFixed(0)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Reconciliation Status</h3>
                  <div className={`p-4 rounded-lg border-2 ${reconciliation.status === 'reconciled' ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-center gap-3">
                      {reconciliation.status === 'reconciled' ? (
                        <CheckCircle className="text-green-600" size={24} />
                      ) : (
                        <AlertCircle className="text-yellow-600" size={24} />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {reconciliation.status === 'reconciled' ? 'Reconciled' : 'Needs Review'}
                        </p>
                        <p className="text-sm text-gray-600">
                          GSTR-1 Tax: ₹{reconciliation.gstr1TaxAmount.toFixed(0)} | GSTR-2 Tax: ₹{reconciliation.gstr2TaxAmount.toFixed(0)} | Discrepancy: ₹{reconciliation.discrepancy.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GSTR-1 Tab */}
            {activeTab === 'gstr1' && gstr1Data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">GSTR-1 (Sales)</h3>
                    <p className="text-sm text-gray-600 mt-1">{gstr1Data.gstItems.length} items found</p>
                  </div>
                  <div className="flex gap-2">
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
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2">
                      <Download size={18} />
                      Export
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    Total Taxable Value: <span className="text-blue-600 font-bold">₹{gstr1Data.totalTaxableValue.toFixed(0)}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-2">
                    Total Tax Amount: <span className="text-blue-600 font-bold">₹{gstr1Data.totalTaxAmount.toFixed(0)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-3">Status: <span className="font-semibold uppercase text-blue-700">{gstr1Data.status}</span></p>
                </div>

                {gstr1Data.gstItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Invoice</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Customer</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">HSN</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Taxable Value</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax %</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax Amt</th>
                        </tr>
                      </thead>
                      <tbody>
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

            {/* GSTR-2 Tab */}
            {activeTab === 'gstr2' && gstr2Data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">GSTR-2 (Purchases)</h3>
                    <p className="text-sm text-gray-600 mt-1">{gstr2Data.purchaseItems.length} items found</p>
                  </div>
                  <div className="flex gap-2">
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
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2">
                      <Download size={18} />
                      Export
                    </button>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    Total Taxable Value: <span className="text-green-600 font-bold">₹{gstr2Data.totalTaxableValue.toFixed(0)}</span>
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-2">
                    Total Tax Amount: <span className="text-green-600 font-bold">₹{gstr2Data.totalTaxAmount.toFixed(0)}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-3">Status: <span className="font-semibold uppercase text-green-700">{gstr2Data.status}</span></p>
                </div>

                {gstr2Data.purchaseItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Invoice</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Vendor</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">HSN</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Taxable Value</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax %</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Tax Amt</th>
                        </tr>
                      </thead>
                      <tbody>
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

            {/* Reconciliation Tab */}
            {activeTab === 'reconciliation' && reconciliation && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Tax Reconciliation Report</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">GSTR-1 (Sales)</p>
                    <p className="text-xl font-bold text-blue-600 mt-2">₹{reconciliation.gstr1TaxAmount.toFixed(0)}</p>
                    <p className="text-xs text-gray-600 mt-1">Taxable: ₹{reconciliation.gstr1TaxableValue.toFixed(0)}</p>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">GSTR-2 (Purchases)</p>
                    <p className="text-xl font-bold text-green-600 mt-2">₹{reconciliation.gstr2TaxAmount.toFixed(0)}</p>
                    <p className="text-xs text-gray-600 mt-1">Taxable: ₹{reconciliation.gstr2TaxableValue.toFixed(0)}</p>
                  </div>
                </div>

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

            {/* Adjustments Tab */}
            {activeTab === 'adjustments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Tax Adjustments (TDS, Excise)</h3>
                  <button
                    onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Add Adjustment
                  </button>
                </div>

                {showAdjustmentForm && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3 mb-4">
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddAdjustment('tds')}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Add TDS
                      </button>
                      <button
                        onClick={() => handleAddAdjustment('excise')}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                      >
                        Add Excise
                      </button>
                      <button
                        onClick={() => setShowAdjustmentForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {adjustments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No adjustments yet</p>
                  ) : (
                    adjustments.map(adj => (
                      <div key={adj.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{adj.description}</p>
                            <p className="text-xs text-gray-600 mt-1">{new Date(adj.date).toLocaleDateString()}</p>
                          </div>
                          <p className="text-lg font-bold text-green-600">-₹{adj.amount.toFixed(0)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Audit Trail Tab */}
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
                          <p className="font-semibold text-gray-900">{log.action}</p>
                          <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                          <p className="text-xs text-gray-500 mt-2">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${log.taxImpact >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {log.taxImpact >= 0 ? '+' : '-'}₹{Math.abs(log.taxImpact).toFixed(0)}
                          </p>
                          <Lock className="text-gray-400 mt-2" size={16} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Alerts Tab */}
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
                          <p className="font-semibold text-gray-900">{alert.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                          {alert.dueDate && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <Clock size={14} />
                              Due: {new Date(alert.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              alert.severity === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : alert.severity === 'warning'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
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

        {/* Info Box */}
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

export default TaxCompliance;
