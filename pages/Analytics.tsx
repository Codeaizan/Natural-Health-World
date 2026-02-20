import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { AnalyticsService } from '../services/analytics';
import {
  Bill,
  Product,
  ProfitLossStatement,
  CashFlowStatement,
  InventoryValuation,
  YearOverYearComparison,
  AnalyticsMetric,
} from '../types';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Package,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MetricCardProps {
  metric: AnalyticsMetric;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
    <p className="text-sm text-gray-600 font-medium">{metric.label}</p>
    <div className="flex items-baseline justify-between mt-2">
      <p className="text-2xl font-bold">
        {metric.unit === '₹' ? '₹' : ''}
        {metric.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
      {metric.changePercent !== undefined && metric.changePercent !== 0 && (
        <div className={`flex items-center gap-1 text-sm font-semibold ${metric.changePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {metric.changePercent > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {Math.abs(metric.changePercent).toFixed(1)}%
        </div>
      )}
    </div>
  </div>
);

const Analytics: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pnl' | 'cashflow' | 'inventory' | 'yoy' | 'sales'>('overview');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [inventoryMethod, setInventoryMethod] = useState<'fifo' | 'lifo' | 'weighted_avg'>('fifo');
  const [metrics, setMetrics] = useState<AnalyticsMetric[]>([]);
  const [pnlData, setPnlData] = useState<ProfitLossStatement | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowStatement | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryValuation[]>([]);
  const [yoyData, setYoyData] = useState<YearOverYearComparison[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const billsData = StorageService.getBills();
    const productsData = StorageService.getProducts();

    setBills(billsData);
    setProducts(productsData);

    // Generate all analytics data
    const dashboardMetrics = AnalyticsService.generateMetricsDashboard(billsData, productsData, selectedMonth, selectedYear);
    setMetrics(dashboardMetrics);

    const pnl = AnalyticsService.generateProfitLossStatement(billsData, selectedMonth, selectedYear);
    setPnlData(pnl);

    const cashFlow = AnalyticsService.generateCashFlowStatement(billsData, selectedMonth, selectedYear);
    setCashFlowData(cashFlow);

    const inventory = AnalyticsService.calculateInventoryValuation(productsData, billsData, inventoryMethod);
    setInventoryData(inventory);

    const yoy = AnalyticsService.generateYearOverYearComparison(billsData, selectedYear);
    setYoyData(yoy);

    const salesByProd = AnalyticsService.generateSalesByProductReport(billsData);
    setSalesByProduct(salesByProd);

    setLoading(false);
  }, [selectedMonth, selectedYear, inventoryMethod]);

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Generating analytics...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Advanced Reporting & Analytics</h1>
          <p className="text-gray-600 mt-2">P&L Statements, Cash Flow Analysis, Inventory Valuation & YoY Comparison</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6 flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {monthNames.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'inventory' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Valuation Method</label>
              <select
                value={inventoryMethod}
                onChange={e => setInventoryMethod(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="fifo">FIFO</option>
                <option value="lifo">LIFO</option>
                <option value="weighted_avg">Weighted Average</option>
              </select>
            </div>
          )}

          <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2 mt-6">
            <Download size={18} />
            Export
          </button>
        </div>

        {/* Dashboard Metrics */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {metrics.map((metric, idx) => (
              <MetricCard key={idx} metric={metric} />
            ))}
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {(['overview', 'pnl', 'cashflow', 'inventory', 'yoy', 'sales'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'overview' && 'Overview'}
                {tab === 'pnl' && 'P&L Statement'}
                {tab === 'cashflow' && 'Cash Flow'}
                {tab === 'inventory' && 'Inventory'}
                {tab === 'yoy' && 'Year-over-Year'}
                {tab === 'sales' && 'Sales Analysis'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && pnlData && cashFlowData && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview - {monthNames[selectedMonth - 1]} {selectedYear}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-800">Operating Profit</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">₹{pnlData.operatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-blue-700 mt-2">{pnlData.operatingMargin.toFixed(1)}% margin</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800">Net Profit</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">₹{pnlData.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-green-700 mt-2">{pnlData.netProfitMargin.toFixed(1)}% margin</p>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                      <p className="text-sm font-medium text-purple-800">Ending Cash</p>
                      <p className="text-3xl font-bold text-purple-600 mt-2">₹{cashFlowData.endingCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-purple-700 mt-2">Net flow: ₹{cashFlowData.netCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* P&L Statement Tab */}
            {activeTab === 'pnl' && pnlData && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss Statement</h3>

                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-medium text-gray-900">Revenue</span>
                    <span className="font-bold text-gray-900">₹{pnlData.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="font-medium text-gray-900">Cost of Goods Sold</span>
                    <span className="font-bold text-red-600">-₹{pnlData.costOfGoodsSold.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-100 rounded-lg border border-gray-300 font-semibold">
                    <span>Gross Profit</span>
                    <span className="text-blue-600">₹{pnlData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pnlData.grossProfitMargin.toFixed(1)}%)</span>
                  </div>

                  <div className="flex justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <span className="font-medium text-gray-900">Operating Expenses</span>
                    <span className="font-bold text-orange-600">-₹{pnlData.operatingExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-100 rounded-lg border border-gray-300 font-semibold">
                    <span>Operating Profit</span>
                    <span className="text-blue-600">₹{pnlData.operatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pnlData.operatingMargin.toFixed(1)}%)</span>
                  </div>

                  <div className="flex justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <span className="font-medium text-gray-900">Tax Expense</span>
                    <span className="font-bold text-yellow-600">-₹{pnlData.taxExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="flex justify-between p-3 bg-green-100 rounded-lg border border-green-300 font-semibold">
                    <span className="text-lg">Net Profit</span>
                    <span className="text-lg text-green-600">₹{pnlData.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pnlData.netProfitMargin.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Flow Tab */}
            {activeTab === 'cashflow' && cashFlowData && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Statement</h3>

                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-medium text-gray-900">Operating Cash Flow</span>
                    <span className={`font-bold ${cashFlowData.operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{cashFlowData.operatingCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <span className="font-medium text-gray-900">Investing Cash Flow</span>
                    <span className={`font-bold ${cashFlowData.investingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{cashFlowData.investingCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="font-medium text-gray-900">Financing Cash Flow</span>
                    <span className={`font-bold ${cashFlowData.financingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{cashFlowData.financingCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-100 rounded-lg border border-gray-300 font-semibold">
                    <span>Net Cash Flow</span>
                    <span className={`${cashFlowData.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{cashFlowData.netCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="mt-6 space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Beginning Cash:</span> ₹{cashFlowData.beginningCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Ending Cash:</span> ₹
                      <span className="font-bold text-lg">{cashFlowData.endingCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Valuation Tab */}
            {activeTab === 'inventory' && inventoryData.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Valuation - {inventoryMethod.toUpperCase()}</h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Product</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">Qty</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">FIFO Value</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">LIFO Value</th>
                        <th className="px-4 py-2 text-right text-gray-700 font-semibold">Weighted Avg Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData.slice(0, 15).map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900 font-medium">{item.productName}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{item.quantity}</td>
                          <td className="px-4 py-2 text-right text-gray-900">₹{item.fifoValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-2 text-right text-gray-900">₹{item.lifoValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-2 text-right text-gray-900">₹{item.weightedAvgValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Total Inventory Value ({inventoryMethod.toUpperCase()}):</span>
                    <span className="font-bold text-lg ml-2">
                      ₹{inventoryData
                        .reduce((sum, item) => {
                          if (inventoryMethod === 'fifo') return sum + item.fifoValue;
                          if (inventoryMethod === 'lifo') return sum + item.lifoValue;
                          return sum + item.weightedAvgValue;
                        }, 0)
                        .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Year-over-Year Tab */}
            {activeTab === 'yoy' && yoyData.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Year-over-Year Comparison</h3>

                <div className="space-y-3">
                  {yoyData.map((item, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{item.metric}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedYear - 1}: ₹{item.year1.toLocaleString('en-IN', { maximumFractionDigits: 0 })} → {selectedYear}:  ₹
                            {item.year2.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${item.trend === 'up' ? 'text-green-600' : item.trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                            {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                            {item.trend === 'up' && <TrendingUp size={14} className="text-green-600" />}
                            {item.trend === 'down' && <TrendingDown size={14} className="text-red-600" />}
                            {item.trend === 'stable' && '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales Analysis Tab */}
            {activeTab === 'sales' && salesByProduct.length > 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h3>

                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesByProduct.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="productName" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Revenue (₹)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Quantity', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue" />
                      <Bar yAxisId="right" dataKey="quantity" fill="#10b981" name="Quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Product</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Quantity Sold</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Revenue</th>
                          <th className="px-4 py-2 text-right text-gray-700 font-semibold">Avg Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesByProduct.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900 font-medium">{item.productName}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{item.quantity}</td>
                            <td className="px-4 py-2 text-right text-gray-900 font-semibold">₹{item.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="px-4 py-2 text-right text-gray-700">₹{item.avgPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-3">
            <BarChart3 className="text-blue-600 flex-shrink-0 mt-1" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Analytics Features</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <span className="font-medium">P&L Statement:</span> Track revenue, COGS, operating expenses, and net profit</li>
                <li>• <span className="font-medium">Cash Flow Analysis:</span> Monitor operating, investing, and financing cash flows</li>
                <li>• <span className="font-medium">Inventory Valuation:</span> Compare FIFO, LIFO, and Weighted Average methods</li>
                <li>• <span className="font-medium">Year-over-Year:</span> Compare metrics across consecutive years for trends</li>
                <li>• <span className="font-medium">Sales Analysis:</span> Identify top-performing products and categories</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
