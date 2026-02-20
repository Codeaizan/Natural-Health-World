import React, { useEffect, useState, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { Bill, StockHistory, Product, SalesPerson } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { COLORS } from '../constants';
import { 
    Trophy, TrendingUp, Calculator, Download, Printer, 
    PieChart as PieChartIcon, Users, FileText, ShoppingBag, BadgeIndianRupee 
} from 'lucide-react';

const Reports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'gst' | 'staff' | 'customers' | 'stock'>('sales');
    
    // Initialize dates with current month range (using local time, not UTC)
    const getDefaultDates = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const firstDay = `${year}-${month}-01`;
        const endDay = `${year}-${month}-${day}`;
        return { firstDay, endDay };
    };
    
    const { firstDay, endDay } = getDefaultDates();
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(endDay);
    const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('all');

    // Data State
    const [allBills, setAllBills] = useState<Bill[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
    const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);

    useEffect(() => {
        const loadAll = async () => {
            const bills = await StorageService.getBills();
            const products = await StorageService.getProducts();
            const salesPersons = await StorageService.getSalesPersons();
            const stockHistory = await StorageService.getStockHistory();
            setAllBills(bills);
            setProducts(products);
            setSalesPersons(salesPersons);
            setStockHistory(stockHistory);
        };

        loadAll();

        // Subscribe to storage changes so reports refresh when data mutates elsewhere
        const onChange = () => loadAll();
        if ((StorageService as any).addChangeListener) {
            (StorageService as any).addChangeListener(onChange);
        }

        return () => {
            if ((StorageService as any).removeChangeListener) {
                (StorageService as any).removeChangeListener(onChange);
            }
        };
    }, []);

    // --- Derived Data (Filtered) ---
    const filteredBills = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        return allBills.filter(b => {
            const d = new Date(b.date).getTime();
            return d >= start && d <= end;
        });
    }, [allBills, startDate, endDate]);

    // --- 1. Sales Summary Metrics ---
    const salesMetrics = useMemo(() => {
        const totalSales = filteredBills.reduce((sum, b) => sum + b.grandTotal, 0);
        const totalBills = filteredBills.length;
        const avgBillValue = totalBills > 0 ? totalSales / totalBills : 0;
        const totalTax = filteredBills.reduce((sum, b) => sum + (b.totalTax || 0), 0);
        
        // Daily Trend
        const dailyMap = new Map<string, number>();
        filteredBills.forEach(b => {
            const d = b.date.split('T')[0];
            dailyMap.set(d, (dailyMap.get(d) || 0) + b.grandTotal);
        });
        const dailyData = Array.from(dailyMap.entries())
            .map(([date, total]) => ({ date, total }))
            .sort((a,b) => a.date.localeCompare(b.date));

        return { totalSales, totalBills, avgBillValue, totalTax, dailyData };
    }, [filteredBills]);

    // --- 2. Product Analysis ---
    const productMetrics = useMemo(() => {
        const prodMap = new Map<number, { name: string, qty: number, rev: number, cat: string }>();
        const catMap = new Map<string, number>();

        filteredBills.forEach(b => {
            b.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                const category = product?.category || 'General';

                const current = prodMap.get(item.productId) || { name: item.productName, qty: 0, rev: 0, cat: category };
                prodMap.set(item.productId, {
                    ...current,
                    qty: current.qty + item.quantity,
                    rev: current.rev + item.amount
                });

                catMap.set(category, (catMap.get(category) || 0) + item.amount);
            });
        });

        const allProducts = Array.from(prodMap.values());
        const topByQty = [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, 10);
        const topByRev = [...allProducts].sort((a, b) => b.rev - a.rev).slice(0, 10);
        
        const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

        return { topByQty, topByRev, categoryData };
    }, [filteredBills, products]);

    // --- 3. Staff Performance ---
    const staffMetrics = useMemo(() => {
        const metrics = salesPersons.map(sp => {
            const spBills = filteredBills.filter(b => b.salesPersonId === sp.id || b.salesPersonName === sp.name);
            const revenue = spBills.reduce((sum, b) => sum + b.grandTotal, 0);
            const count = spBills.length;
            const avg = count > 0 ? revenue / count : 0;
            return { ...sp, revenue, count, avg };
        });
        
        if (selectedSalesPerson === 'all') return metrics;
        return metrics.filter(sp => sp.id.toString() === selectedSalesPerson);
    }, [filteredBills, salesPersons, selectedSalesPerson]);

    // --- 4. GST Report (HSN) ---
    const gstMetrics = useMemo(() => {
        const gstBills = filteredBills.filter(b => b.isGstBill);
        const totalTaxable = gstBills.reduce((sum, b) => sum + b.taxableAmount, 0);
        const totalCGST = gstBills.reduce((sum, b) => sum + b.cgstAmount, 0);
        const totalSGST = gstBills.reduce((sum, b) => sum + b.sgstAmount, 0);
        const totalIGST = gstBills.reduce((sum, b) => sum + (b.igstAmount || 0), 0);
        
        // HSN Summary
        const hsnMap = new Map<string, { qty: number, taxable: number, tax: number }>();
        gstBills.forEach(b => {
            b.items.forEach(item => {
                const hsn = item.hsnCode || 'N/A';
                const cur = hsnMap.get(hsn) || { qty: 0, taxable: 0, tax: 0 };
                
                // Item amount is taxable value in GST bill logic
                const itemTaxable = item.amount; 
                const itemTax = itemTaxable * 0.05; 

                hsnMap.set(hsn, {
                    qty: cur.qty + item.quantity,
                    taxable: cur.taxable + itemTaxable,
                    tax: cur.tax + itemTax
                });
            });
        });

        const hsnData = Array.from(hsnMap.entries()).map(([hsn, data]) => ({
            hsn, ...data
        }));

        return { totalTaxable, totalCGST, totalSGST, totalIGST, totalTax: totalCGST + totalSGST + totalIGST, hsnData };
    }, [filteredBills]);

    // --- 4.5. Stock History (Filtered by Date) ---
    const filteredStockHistory = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        return stockHistory.filter(s => {
            const d = new Date(s.timestamp).getTime();
            return d >= start && d <= end;
        });
    }, [stockHistory, startDate, endDate]);

    // --- 5. Customer Analytics ---
    const customerMetrics = useMemo(() => {
        const custMap = new Map<number, { name: string, bills: number, rev: number }>();
        const uniqueCustomers = new Set<number>();
        let newCustomers = 0;
        let returningCustomers = 0;

        filteredBills.forEach(b => {
            uniqueCustomers.add(b.customerId);
            const cur = custMap.get(b.customerId) || { name: b.customerName, bills: 0, rev: 0 };
            custMap.set(b.customerId, {
                name: b.customerName,
                bills: cur.bills + 1,
                rev: cur.rev + b.grandTotal
            });
        });

        // Determine New vs Returning
        // "New" = First bill date is within range
        // "Returning" = First bill date is before start date
        // Need to check ALL bills for this
        const custFirstBillDate = new Map<number, number>();
        allBills.forEach(b => {
            const d = new Date(b.date).getTime();
            if (!custFirstBillDate.has(b.customerId) || d < custFirstBillDate.get(b.customerId)!) {
                custFirstBillDate.set(b.customerId, d);
            }
        });

        const startTs = new Date(startDate).getTime();
        uniqueCustomers.forEach(cid => {
            const firstDate = custFirstBillDate.get(cid) || 0;
            if (firstDate >= startTs) newCustomers++;
            else returningCustomers++;
        });

        const topCustomers = Array.from(custMap.values()).sort((a,b) => b.rev - a.rev).slice(0, 10);

        return { newCustomers, returningCustomers, topCustomers };
    }, [filteredBills, allBills, startDate]);

    // --- Export Functionality ---
    const handleExport = () => {
        let headers: string[] = [];
        let rows: (string | number)[][] = [];
        let filename = `report_${activeTab}_${startDate}_${endDate}.csv`;

        switch(activeTab) {
            case 'sales':
                headers = ["Date", "Sales Amount"];
                rows = salesMetrics.dailyData.map(d => [d.date, d.total]);
                break;
            case 'products':
                headers = ["Product Name", "Category", "Quantity Sold", "Revenue"];
                rows = productMetrics.topByRev.map(p => [p.name, p.cat, p.qty, p.rev]);
                break;
            case 'staff':
                headers = ["Sales Person", "Bills Generated", "Total Revenue", "Avg Bill Value"];
                rows = staffMetrics.map(s => [s.name, s.count, s.revenue, s.avg]);
                break;
            case 'gst':
                headers = ["HSN Code", "Quantity", "Taxable Value", "Tax Amount", "Total Amount"];
                rows = gstMetrics.hsnData.map(h => [h.hsn, h.qty, h.taxable, h.tax, h.taxable + h.tax]);
                break;
            case 'customers':
                headers = ["Customer Name", "Bills Count", "Total Spend"];
                rows = customerMetrics.topCustomers.map(c => [c.name, c.bills, c.rev]);
                break;
            case 'stock':
                headers = ["Date", "Product", "Change", "Reason", "Notes"];
                rows = stockHistory.map(s => [s.timestamp, s.productName, s.changeAmount, s.reason, s.referenceId || '']);
                break;
        }

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    // --- Components ---
    const KpiCard = ({ title, value, subtext, icon: Icon, color }: any) => (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className={`p-3 rounded-lg mr-4 ${color} bg-opacity-10`}>
                <Icon size={24} className={color.replace('bg-', 'text-')} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <h3 className="text-xl font-bold text-gray-800">{value}</h3>
                {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
            </div>
        </div>
    );

    const COLORS_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Filter Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 no-print">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'sales', label: 'Sales Summary', icon: TrendingUp },
                        { id: 'products', label: 'Products', icon: ShoppingBag },
                        { id: 'gst', label: 'GST Report', icon: FileText },
                        { id: 'staff', label: 'Sales Team', icon: Users },
                        { id: 'customers', label: 'Customers', icon: Users },
                        { id: 'stock', label: 'Stock History', icon: Trophy }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id 
                                ? 'bg-green-600 text-white shadow-md' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <tab.icon size={16} className="mr-2" /> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-gray-50 border rounded-lg px-2 py-1">
                        <input type="date" className="bg-transparent text-sm p-1 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span className="text-gray-400 mx-1">-</span>
                        <input type="date" className="bg-transparent text-sm p-1 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <button onClick={handlePrint} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg border" title="Print View">
                        <Printer size={18} />
                    </button>
                    <button onClick={handleExport} className="flex items-center px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 text-sm font-medium">
                        <Download size={16} className="mr-2" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* --- SALES SUMMARY --- */}
                {activeTab === 'sales' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="Total Revenue" value={`₹${salesMetrics.totalSales.toLocaleString()}`} icon={BadgeIndianRupee} color="text-green-600 bg-green-600" />
                            <KpiCard title="Total Bills" value={salesMetrics.totalBills} icon={FileText} color="text-blue-600 bg-blue-600" />
                            <KpiCard title="Avg Bill Value" value={`₹${salesMetrics.avgBillValue.toFixed(0)}`} icon={Calculator} color="text-purple-600 bg-purple-600" />
                            <KpiCard title="Total Tax Collected" value={`₹${salesMetrics.totalTax.toLocaleString()}`} icon={FileText} color="text-amber-600 bg-amber-600" />
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border h-96">
                            <h3 className="font-bold text-gray-700 mb-4">Daily Sales Trend</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesMetrics.dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip formatter={(val: number) => `₹${val}`} />
                                    <Line type="monotone" dataKey="total" stroke={COLORS.mediumGreen} strokeWidth={3} dot={{r:4}} activeDot={{r:8}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* --- PRODUCT ANALYSIS --- */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-700 mb-4">Category Distribution (Revenue)</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={productMetrics.categoryData} 
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" cy="50%" 
                                                outerRadius={80} 
                                                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {productMetrics.categoryData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS_CHART[index % COLORS_CHART.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val: number) => `₹${val.toLocaleString()}`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-700 mb-4">Top 5 Products by Revenue</h3>
                                <div className="space-y-3">
                                    {productMetrics.topByRev.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                            <div>
                                                <p className="font-medium text-sm">{p.name}</p>
                                                <p className="text-xs text-gray-500">{p.cat}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-700">₹{p.rev.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">{p.qty} sold</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="font-bold text-gray-700 mb-4">Top Products by Quantity</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3 text-right">Qty Sold</th>
                                            <th className="p-3 text-right">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {productMetrics.topByQty.map((p, i) => (
                                            <tr key={i}>
                                                <td className="p-3 font-medium">{p.name}</td>
                                                <td className="p-3 text-gray-500">{p.cat}</td>
                                                <td className="p-3 text-right font-bold">{p.qty}</td>
                                                <td className="p-3 text-right">₹{p.rev.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- GST REPORTS --- */}
                {activeTab === 'gst' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <KpiCard title="Taxable Value" value={`₹${gstMetrics.totalTaxable.toLocaleString()}`} icon={BadgeIndianRupee} color="text-gray-600 bg-gray-600" />
                            <KpiCard title="CGST Output" value={`₹${gstMetrics.totalCGST.toLocaleString()}`} icon={FileText} color="text-blue-600 bg-blue-600" />
                            <KpiCard title="SGST Output" value={`₹${gstMetrics.totalSGST.toLocaleString()}`} icon={FileText} color="text-blue-600 bg-blue-600" />
                            <KpiCard title="IGST Output" value={`₹${gstMetrics.totalIGST.toLocaleString()}`} icon={FileText} color="text-purple-600 bg-purple-600" />
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="font-bold text-gray-700 mb-4">HSN Summary</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="p-3">HSN Code</th>
                                            <th className="p-3 text-right">Quantity</th>
                                            <th className="p-3 text-right">Taxable Value</th>
                                            <th className="p-3 text-right">Tax Amount</th>
                                            <th className="p-3 text-right">Total Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {gstMetrics.hsnData.map((h, i) => (
                                            <tr key={i}>
                                                <td className="p-3 font-mono">{h.hsn}</td>
                                                <td className="p-3 text-right">{h.qty}</td>
                                                <td className="p-3 text-right">₹{h.taxable.toFixed(2)}</td>
                                                <td className="p-3 text-right">₹{h.tax.toFixed(2)}</td>
                                                <td className="p-3 text-right font-bold">₹{(h.taxable + h.tax).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {gstMetrics.hsnData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No GST bills found in this period.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- SALES TEAM --- */}
                {activeTab === 'staff' && (
                    <div className="space-y-6">
                         <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
                            <Users size={20} className="text-gray-500" />
                            <select 
                                className="p-2 border rounded"
                                value={selectedSalesPerson}
                                onChange={(e) => setSelectedSalesPerson(e.target.value)}
                            >
                                <option value="all">All Sales Persons</option>
                                {salesPersons.map(sp => (
                                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                                ))}
                            </select>
                         </div>

                         <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="font-bold text-gray-700 mb-4">Staff Performance</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="p-3">Sales Person</th>
                                        <th className="p-3 text-right">Bills Generated</th>
                                        <th className="p-3 text-right">Avg Bill Value</th>
                                        <th className="p-3 text-right">Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {staffMetrics.map((s, i) => (
                                        <tr key={i}>
                                            <td className="p-3 font-medium">{s.name}</td>
                                            <td className="p-3 text-right">{s.count}</td>
                                            <td className="p-3 text-right">₹{s.avg.toFixed(0)}</td>
                                            <td className="p-3 text-right font-bold text-green-700">₹{s.revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                )}

                {/* --- CUSTOMERS --- */}
                {activeTab === 'customers' && (
                    <div className="space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <KpiCard title="New Customers" value={customerMetrics.newCustomers} subtext="First bill in this period" icon={Users} color="text-green-600 bg-green-600" />
                            <KpiCard title="Returning Customers" value={customerMetrics.returningCustomers} subtext="Billed before this period" icon={Users} color="text-blue-600 bg-blue-600" />
                         </div>

                         <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h3 className="font-bold text-gray-700 mb-4">Top 10 Customers</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="p-3">Customer Name</th>
                                        <th className="p-3 text-right">Bills Count</th>
                                        <th className="p-3 text-right">Total Spend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {customerMetrics.topCustomers.map((c, i) => (
                                        <tr key={i}>
                                            <td className="p-3 font-medium">{c.name}</td>
                                            <td className="p-3 text-right">{c.bills}</td>
                                            <td className="p-3 text-right font-bold text-green-700">₹{c.rev.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                )}

                {/* --- STOCK HISTORY --- */}
                {activeTab === 'stock' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 className="font-bold text-gray-700 mb-4">Stock Movement History</h3>
                        {filteredStockHistory.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No stock movements found in this period.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Product</th>
                                            <th className="p-3 text-right">Change</th>
                                            <th className="p-3">Reason</th>
                                            <th className="p-3">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredStockHistory.map((s, i) => (
                                            <tr key={i}>
                                                <td className="p-3">{new Date(s.timestamp).toLocaleDateString()}</td>
                                                <td className="p-3 font-medium">{s.productName}</td>
                                                <td className={`p-3 text-right font-bold ${s.changeAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {s.changeAmount > 0 ? '+' : ''}{s.changeAmount}
                                                </td>
                                                <td className="p-3 capitalize">
                                                     <span className={`px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700`}>
                                                        {s.reason}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-gray-500 max-w-xs truncate">{s.referenceId}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <style>{`
              @media print {
                .no-print { display: none !important; }
                body { background: white; }
                .space-y-6 { margin-top: 0; }
                .bg-white { background: white !important; }
                .border { border: 1px solid #ddd !important; }
                .shadow-sm { box-shadow: none !important; }
                .rounded-xl { border-radius: 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #f5f5f5 !important; font-weight: bold; }
                .grid { display: block; }
                .md\\:grid-cols-2, .lg\\:grid-cols-4, .lg\\:grid-cols-2 { display: grid; grid-template-columns: 1fr 1fr; }
                @page { margin: 0.5in; }
              }
            `}</style>
        </div>
    );
};

export default Reports;