import React, { useEffect, useState, useMemo } from 'react'; // React core + hooks
import { StorageService } from '../services/storage';  // Unified storage service
import { Bill, Product, Customer } from '../types';     // TypeScript types
import { COLORS } from '../constants';                 // App-wide colour tokens
import { DollarSign, ShoppingBag, AlertTriangle, Clock, Package, Users, FileText, TrendingUp, TrendingDown } from 'lucide-react'; // Lucide icons for KPI cards and activity
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Recharts components
import { DashboardSkeleton } from '../components/Skeleton'; // Loading skeleton

// Timeframe options for the sales chart — TradingView-style buttons
const TIMEFRAMES = [
  { label: '7D',  days: 7,   key: '7d'  },
  { label: '14D', days: 14,  key: '14d' },
  { label: '1M',  days: 30,  key: '1m'  },
  { label: '3M',  days: 90,  key: '3m'  },
  { label: '6M',  days: 180, key: '6m'  },
  { label: '1Y',  days: 365, key: '1y'  },
] as const;

// Chart type options
const CHART_TYPES = ['area', 'bar', 'line'] as const;
type ChartType = typeof CHART_TYPES[number];

// Main dashboard page
const Dashboard: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');
  const [chartType, setChartType] = useState<ChartType>('area');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [billsData, productsData, customersData] = await Promise.all([
          StorageService.getBills(),
          StorageService.getProducts(),
          StorageService.getCustomers(),
        ]);
        setBills(billsData);
        setProducts(productsData);
        setCustomers(customersData);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // KPI metrics
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyBills = bills.filter(b => {
    const d = new Date(b.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalSales = monthlyBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalBills = monthlyBills.length;
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockLevel).length;

  // Expiry Logic — products expiring within 90 days
  const expiringProducts = products.filter(p => {
    if (!p.expiryDate) return false;
    const today = new Date();
    const exp = new Date(p.expiryDate);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 90;
  });

  // Chart data — computed based on selected timeframe
  const timeframe = TIMEFRAMES.find(t => t.key === selectedTimeframe) || TIMEFRAMES[2];

  const chartData = useMemo(() => {
    const days = timeframe.days;
    // For longer timeframes, aggregate into buckets to keep the chart readable
    let bucketSize = 1; // days per bucket
    if (days > 90) bucketSize = 7;       // Weekly for 6M+
    else if (days > 30) bucketSize = 3;  // 3-day buckets for 3M

    const bucketCount = Math.ceil(days / bucketSize);
    return Array.from({ length: bucketCount }, (_, i) => {
      const bucketEnd = new Date();
      bucketEnd.setHours(23, 59, 59, 999);
      bucketEnd.setDate(bucketEnd.getDate() - (bucketCount - 1 - i) * bucketSize);
      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketStart.getDate() - bucketSize + 1);
      bucketStart.setHours(0, 0, 0, 0);

      const bucketSales = bills.filter(b => {
        const d = new Date(b.date);
        return d >= bucketStart && d <= bucketEnd;
      }).reduce((sum, b) => sum + b.grandTotal, 0);

      // Format label based on bucket size
      const label = bucketSize === 1
        ? bucketEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        : `${bucketStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;

      return { name: label, sales: Math.round(bucketSales) };
    });
  }, [bills, timeframe.days]);

  // Recent activity — last 5 bills sorted by date
  const recentActivity = useMemo(() => {
    return [...bills]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [bills]);

  if (loading) return <DashboardSkeleton />;

  // Reusable KPI stat card
  const StatCard = ({ title, value, icon: Icon, color }: any) => {
    const colorMap: any = {
      'emerald': { bg: 'bg-emerald-100', text: 'text-emerald-600' },
      'blue':    { bg: 'bg-blue-100',    text: 'text-blue-600'    },
      'amber':   { bg: 'bg-amber-100',   text: 'text-amber-600'   },
      'red':     { bg: 'bg-red-100',     text: 'text-red-600'     },
      'purple':  { bg: 'bg-purple-100',  text: 'text-purple-600'  },
      'indigo':  { bg: 'bg-indigo-100',  text: 'text-indigo-600'  },
    };

    const key = Object.keys(colorMap).find(k => color.includes(k)) || 'gray';
    const bgClass = colorMap[key]?.bg || 'bg-gray-100';
    const textClass = colorMap[key]?.text || 'text-gray-600';

    return (
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
        <div className={`p-3 rounded-full mr-4 ${bgClass}`}>
          <Icon size={22} className={textClass} />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
        </div>
      </div>
    );
  };

  // Render the chart based on selected type
  const renderChart = () => {
    const commonProps = { data: chartData };
    const axisProps = { axisLine: false, tickLine: false };

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axisProps} fontSize={12} />
          <YAxis {...axisProps} fontSize={12} />
          <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Sales']} />
          <Bar dataKey="sales" fill={COLORS.mediumGreen} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axisProps} fontSize={12} />
          <YAxis {...axisProps} fontSize={12} />
          <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Sales']} />
          <Line type="monotone" dataKey="sales" stroke={COLORS.mediumGreen} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      );
    }

    // Default: Area chart
    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.mediumGreen} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.mediumGreen} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" {...axisProps} fontSize={12} />
        <YAxis {...axisProps} fontSize={12} />
        <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Sales']} />
        <Area type="monotone" dataKey="sales" stroke={COLORS.mediumGreen} strokeWidth={2} fill="url(#salesGradient)" />
      </AreaChart>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Products"
          value={products.length}
          icon={Package}
          color="text-purple-600"
        />
        <StatCard
          title="Total Customers"
          value={customers.length}
          icon={Users}
          color="text-indigo-600"
        />
        <StatCard
          title="Revenue (This Month)"
          value={`₹${totalSales.toLocaleString()}`}
          icon={DollarSign}
          color="text-emerald-600"
        />
        <StatCard
          title="Bills (This Month)"
          value={totalBills}
          icon={ShoppingBag}
          color="text-blue-600"
        />
        <StatCard
          title="Low Stock"
          value={lowStockCount}
          icon={AlertTriangle}
          color="text-amber-600"
        />
        <StatCard
          title="Expiring Soon"
          value={expiringProducts.length}
          icon={Clock}
          color="text-red-600"
        />
      </div>

      {/* Sales Chart with TradingView-style timeframe switcher */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-bold text-gray-800">Sales Trend</h3>
          <div className="flex items-center gap-3">
            {/* Chart type toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {CHART_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    chartType === type
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {/* TradingView-style timeframe buttons */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.key}
                  onClick={() => setSelectedTimeframe(tf.key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedTimeframe === tf.key
                      ? 'bg-green-700 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom grid: Recent Activity + Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity — last 5 transactions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-80">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
          <div className="overflow-auto flex-1">
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                No transactions yet
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((bill) => {
                  const billDate = new Date(bill.date);
                  return (
                    <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-emerald-50">
                          <FileText size={16} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{bill.invoiceNumber}</p>
                          <p className="text-xs text-gray-400">{bill.customerName || 'Walk-in'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">₹{bill.grandTotal.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">
                          {billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                          {billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Inventory Alerts</h3>
            <div className="space-x-2">
              <span className="text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                Low Stock: {lowStockCount}
              </span>
              <span className="text-xs font-semibold px-2 py-1 bg-red-100 text-red-800 rounded-full">
                Expiring: {expiringProducts.length}
              </span>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.filter(p => p.currentStock <= p.minStockLevel).map(p => (
                  <tr key={`low-${p.id}`} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {p.name}
                      <div className="text-xs text-gray-400">Stock: {p.currentStock}</div>
                    </td>
                    <td className="py-2 px-3 text-amber-600 font-bold text-xs">Low Stock</td>
                  </tr>
                ))}
                {expiringProducts.map(p => (
                  <tr key={`exp-${p.id}`} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {p.name}
                      <div className="text-xs text-gray-400">Exp: {p.expiryDate}</div>
                    </td>
                    <td className="py-2 px-3 text-red-600 font-bold text-xs">Expiring</td>
                  </tr>
                ))}
                {lowStockCount === 0 && expiringProducts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center py-10 text-gray-400">Inventory is healthy</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;