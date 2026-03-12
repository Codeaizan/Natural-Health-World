import React, { useEffect, useState, useMemo } from 'react';                  // React hooks for component state and effects
import { StorageService } from '../services/storage';                          // Database access service
import { Bill, StockHistory, Product, SalesPerson } from '../types';           // TypeScript type definitions
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, // Recharts bar chart components
    LineChart, Line, PieChart, Pie, Cell, Legend                              // Recharts line, pie chart components
} from 'recharts';                                                             // Data visualization library
import { COLORS } from '../constants';                                         // App-wide color constants
import { 
    Trophy, TrendingUp, Calculator, Download, Printer,                        // Icons for KPI cards and buttons
    Users, FileText, ShoppingBag, BadgeIndianRupee                             // More icons
} from 'lucide-react';                                                         // Icon library

const Reports: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'gst' | 'staff' | 'customers' | 'stock'>('sales'); // Currently selected report tab
    
    // Initialize date range to current month (Month Start to Today)
    const getDefaultDates = () => {
        const now = new Date();                                               // Current date/time
        const year = now.getFullYear();                                       // Current year
        const month = String(now.getMonth() + 1).padStart(2, '0');           // Current month (01-12)
        const day = String(now.getDate()).padStart(2, '0');                  // Current day (01-31)
        const firstDay = `${year}-${month}-01`;                               // Month start date (YYYY-MM-01)
        const endDay = `${year}-${month}-${day}`;                             // Today's date (YYYY-MM-DD)
        return { firstDay, endDay };                                          // Return date range object
    };
    
    const { firstDay, endDay } = getDefaultDates();                           // Get default dates for initialization
    const [startDate, setStartDate] = useState(firstDay);                    // Report date range start
    const [endDate, setEndDate] = useState(endDay);                          // Report date range end
    const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('all'); // Filter for specific sales person

    // Data State — Store fetched data from database
    const [allBills, setAllBills] = useState<Bill[]>([]);                    // All bills in system
    const [products, setProducts] = useState<Product[]>([]);                  // All products in inventory
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);     // All sales staff members
    const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);    // Stock movement history

    useEffect(() => {
        const loadAll = async () => {
            const bills = await StorageService.getBills();                    // Fetch bills from database
            const products = await StorageService.getProducts();              // Fetch products from database
            const salesPersons = await StorageService.getSalesPersons();      // Fetch staff from database
            const stockHistory = await StorageService.getStockHistory();      // Fetch stock history from database
            setAllBills(bills);                                               // Update bills state
            setProducts(products);                                            // Update products state
            setSalesPersons(salesPersons);                                    // Update staff state
            setStockHistory(stockHistory);                                    // Update stock history state
        };

        loadAll();                                                             // Load all data on component mount

        // Subscribe to storage changes so reports auto-refresh when data changes elsewhere in the app
        const onChange = () => loadAll();                                     // Define callback to reload on change
        if ((StorageService as any).addChangeListener) {                      // Check if service supports listener
            (StorageService as any).addChangeListener(onChange);              // Register change listener
        }

        return () => {
            if ((StorageService as any).removeChangeListener) {               // Check if service supports removal
                (StorageService as any).removeChangeListener(onChange);       // Unregister listener on unmount
            }
        };
    }, []);

    // --- Derived Data (Filtered by Date Range) ---
    const filteredBills = useMemo(() => {
        const start = new Date(startDate).getTime();                           // Convert start date to timestamp
        const end = new Date(endDate).setHours(23, 59, 59, 999);             // Convert end date to timestamp (end of day)
        return allBills.filter(b => {
            const d = new Date(b.date).getTime();                             // Parse bill date to timestamp
            return d >= start && d <= end;                                    // Keep bills within date range
        });
    }, [allBills, startDate, endDate]);                                       // Recalculate when bills or dates change

    // --- 1. Sales Summary Metrics — Total revenue, bill count, tax, daily trend ---
    const salesMetrics = useMemo(() => {
        const totalSales = filteredBills.reduce((sum, b) => sum + b.grandTotal, 0); // Sum all bill amounts
        const totalBills = filteredBills.length;                              // Count of bills
        const avgBillValue = totalBills > 0 ? totalSales / totalBills : 0;   // Average revenue per bill
        const totalTax = filteredBills.reduce((sum, b) => sum + (b.totalTax || 0), 0); // Sum all tax collected
        
        // Daily Trend — Group sales by date for trend chart
        const dailyMap = new Map<string, number>();                          // Map to store date→sales
        filteredBills.forEach(b => {
            const d = b.date.split('T')[0];                                  // Extract date part (YYYY-MM-DD)
            dailyMap.set(d, (dailyMap.get(d) || 0) + b.grandTotal);          // Add to daily total
        });
        const dailyData = Array.from(dailyMap.entries())                      // Convert map to array
            .map(([date, total]) => ({ date, total }))                        // Map to objects with date/total
            .sort((a,b) => a.date.localeCompare(b.date));                    // Sort chronologically

        return { totalSales, totalBills, avgBillValue, totalTax, dailyData }; // Return metrics object
    }, [filteredBills]);                                                      // Recalculate when filtered bills change

    // --- 2. Product Analysis — Top products by qty/revenue, category breakdown ---
    const productMetrics = useMemo(() => {
        const prodMap = new Map<number, { name: string, qty: number, rev: number, cat: string }>(); // Product ID → metrics
        const catMap = new Map<string, number>();                            // Category → revenue

        filteredBills.forEach(b => {
            b.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);  // Find product by ID
                const category = product?.category || 'General';               // Default category to 'General'

                const current = prodMap.get(item.productId) || { name: item.productName, qty: 0, rev: 0, cat: category }; // Get existing or create new
                const itemRevenue = item.discountedAmount || item.amount;     // Use discounted amount if available
                prodMap.set(item.productId, {
                    ...current,
                    qty: current.qty + item.quantity,                         // Add quantity sold
                    rev: current.rev + itemRevenue                            // Add revenue
                });

                catMap.set(category, (catMap.get(category) || 0) + itemRevenue); // Add to category revenue
            });
        });

        const allProducts = Array.from(prodMap.values());                     // Get all product metrics
        const topByQty = [...allProducts].sort((a, b) => b.qty - a.qty).slice(0, 10); // Top 10 by quantity
        const topByRev = [...allProducts].sort((a, b) => b.rev - a.rev).slice(0, 10); // Top 10 by revenue
        
        const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })); // Convert to chart data

        return { topByQty, topByRev, categoryData };                           // Return product metrics
    }, [filteredBills, products]);                                            // Recalculate when bills/products change

    // --- 3. Staff Performance — Revenue per salesperson, bill count, average bill value ---
    const staffMetrics = useMemo(() => {
        const metrics = salesPersons.map(sp => {
            const spBills = filteredBills.filter(b => b.salesPersonId === sp.id || b.salesPersonName === sp.name); // Get bills by this person
            const revenue = spBills.reduce((sum, b) => sum + b.grandTotal, 0); // Total revenue generated
            const count = spBills.length;                                     // Number of bills
            const avg = count > 0 ? revenue / count : 0;                      // Average bill value
            return { ...sp, revenue, count, avg };                            // Return person with metrics
        });
        
        if (selectedSalesPerson === 'all') return metrics;                    // Return all if no filter
        return metrics.filter(sp => sp.id.toString() === selectedSalesPerson); // Return filtered by selected person
    }, [filteredBills, salesPersons, selectedSalesPerson]);                  // Recalculate when dependent data changes

    // --- 4. GST Report (by HSN Code) — Tax breakdown, itemized tax calculation ---
    const gstMetrics = useMemo(() => {
        const gstBills = filteredBills.filter(b => b.isGstBill);             // Keep only GST bills
        const totalTaxable = gstBills.reduce((sum, b) => sum + b.taxableAmount, 0); // Sum taxable amount
        const totalCGST = gstBills.reduce((sum, b) => sum + b.cgstAmount, 0); // Sum CGST (Central GST)
        const totalSGST = gstBills.reduce((sum, b) => sum + b.sgstAmount, 0); // Sum SGST (State GST)
        const totalIGST = gstBills.reduce((sum, b) => sum + (b.igstAmount || 0), 0); // Sum IGST (Integrated GST)
        
        // HSN Summary — Group by HSN code with tax calculations
        const hsnMap = new Map<string, { qty: number, taxable: number, tax: number }>(); // HSN → metrics
        gstBills.forEach(b => {
            b.items.forEach(item => {
                const hsn = item.hsnCode || 'N/A';                            // Get HSN code or default to 'N/A'
                const cur = hsnMap.get(hsn) || { qty: 0, taxable: 0, tax: 0 }; // Get existing or create new
                
                // Item taxable value (use discounted amount if available, else item amount)
                const itemTaxable = item.discountedAmount || item.amount;    // taxable value for item
                // Use per-item gstRate if available; fall back to bill-level average for legacy bills
                const itemGstRate = item.gstRate != null
                    ? item.gstRate / 100
                    : (b.taxableAmount > 0 ? (b.cgstAmount + b.sgstAmount + (b.igstAmount || 0)) / b.taxableAmount : 0);
                const itemTax = itemTaxable * itemGstRate;                    // Apply rate to item

                hsnMap.set(hsn, {
                    qty: cur.qty + item.quantity,                             // Add quantity
                    taxable: cur.taxable + itemTaxable,                       // Add taxable value
                    tax: cur.tax + itemTax                                    // Add tax amount
                });
            });
        });

        const hsnData = Array.from(hsnMap.entries()).map(([hsn, data]) => ({ hsn, ...data })); // Convert to array

        return { totalTaxable, totalCGST, totalSGST, totalIGST, totalTax: totalCGST + totalSGST + totalIGST, hsnData }; // Return GST metrics
    }, [filteredBills]);                                                      // Recalculate when filtered bills change

    // --- 4.5. Stock History (Filtered by Date) ---
    const filteredStockHistory = useMemo(() => {
        const start = new Date(startDate).getTime();                           // Convert start date to timestamp
        const end = new Date(endDate).setHours(23, 59, 59, 999);             // Convert end date to timestamp (end of day)
        return stockHistory.filter(s => {
            const d = new Date(s.timestamp).getTime();                        // Parse stock entry date
            return d >= start && d <= end;                                    // Keep entries within date range
        });
    }, [stockHistory, startDate, endDate]);                                   // Recalculate when stock history or dates change

    // --- 5. Customer Analytics — New vs returning, top customers ---
    const customerMetrics = useMemo(() => {
        const custMap = new Map<number, { name: string, bills: number, rev: number }>(); // Customer ID → metrics
        const uniqueCustomers = new Set<number>();                           // Unique customer IDs in period
        let newCustomers = 0;                                                 // Count of new customers
        let returningCustomers = 0;                                           // Count of returning customers

        filteredBills.forEach(b => {
            uniqueCustomers.add(b.customerId);                                // Add to unique set
            const cur = custMap.get(b.customerId) || { name: b.customerName, bills: 0, rev: 0 }; // Get existing or create
            custMap.set(b.customerId, {
                name: b.customerName,
                bills: cur.bills + 1,                                         // Increment bill count
                rev: cur.rev + b.grandTotal                                   // Add revenue
            });
        });

        // Determine New vs Returning customers by checking first bill date
        // "New" = First bill date is within selected range
        // "Returning" = First bill date is before selected start date
        const custFirstBillDate = new Map<number, number>();                // Customer ID → first bill timestamp
        allBills.forEach(b => {
            const d = new Date(b.date).getTime();                             // Parse date to timestamp
            if (!custFirstBillDate.has(b.customerId) || d < custFirstBillDate.get(b.customerId)!) { // Check if this is first bill
                custFirstBillDate.set(b.customerId, d);                       // Store first bill date
            }
        });

        const startTs = new Date(startDate).getTime();                        // Convert selected start date to timestamp
        uniqueCustomers.forEach(cid => {
            const firstDate = custFirstBillDate.get(cid) || 0;               // Get customer's first bill date
            if (firstDate >= startTs) newCustomers++;                          // If first bill in range, they're new
            else returningCustomers++;                                         // Otherwise they're returning
        });

        const topCustomers = Array.from(custMap.values()).sort((a,b) => b.rev - a.rev).slice(0, 10); // Top 10 by revenue

        return { newCustomers, returningCustomers, topCustomers };            // Return customer metrics
    }, [filteredBills, allBills, startDate]);                                // Recalculate when bills or dates change

    // --- Export Functionality — Convert report data to CSV format ---
    const csvEscape = (val: string | number): string => {
        if (typeof val === 'number') return val.toFixed(2);                  // Format numbers to 2 decimal places
        const s = String(val);                                               // Convert to string if not already
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {       // If value needs escaping
            return `"${s.replace(/"/g, '""')}"`;                             // Wrap in quotes and escape internal quotes
        }
        return s;                                                             // Return plain value if no special chars
    };

    const handleExport = async () => {
        let headers: string[] = [];                                           // CSV column headers
        let rows: (string | number)[][] = [];                                // CSV data rows
        let filename = `report_${activeTab}_${startDate}_${endDate}.csv`;    // Filename with report type and date range

        switch(activeTab) {                                                   // Export different formats based on active tab
            case 'sales':
                headers = ["Date", "Sales Amount"];                          // Sales report columns
                rows = salesMetrics.dailyData.map(d => [d.date, d.total]);  // Map daily data to rows
                break;
            case 'products':
                headers = ["Product Name", "Category", "Quantity Sold", "Revenue"]; // Product report columns
                rows = productMetrics.topByRev.map(p => [p.name, p.cat, p.qty, p.rev]); // Map product data
                break;
            case 'staff':
                headers = ["Sales Person", "Bills Generated", "Total Revenue", "Avg Bill Value"]; // Staff report columns
                rows = staffMetrics.map(s => [s.name, s.count, s.revenue, s.avg]); // Map staff data
                break;
            case 'gst':
                headers = ["HSN Code", "Quantity", "Taxable Value", "Tax Amount", "Total Amount"]; // GST report columns
                rows = gstMetrics.hsnData.map(h => [h.hsn, h.qty, h.taxable, h.tax, h.taxable + h.tax]); // Map HSN data
                break;
            case 'customers':
                headers = ["Customer Name", "Bills Count", "Total Spend"];   // Customer report columns
                rows = customerMetrics.topCustomers.map(c => [c.name, c.bills, c.rev]); // Map customer data
                break;
            case 'stock':
                headers = ["Date", "Product", "Change", "Reason", "Notes"]; // Stock history columns
                rows = filteredStockHistory.map(s => [s.timestamp, s.productName, s.changeAmount, s.reason, s.referenceId || '']); // Map stock data
                break;
        }

        const csvContent = [headers.join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n"); // Build CSV string
        const { saveCsvFile } = await import('../utils');                     // Import CSV save helper
        await saveCsvFile(filename, csvContent);                              // Save CSV file
    };

    const handlePrint = () => {
        window.print();                                                       // Trigger browser print dialog
    };

    // --- Components & Styling ---
    const kpiColorMap: Record<string, { iconBg: string; iconText: string }> = {
        'green': { iconBg: 'bg-green-100', iconText: 'text-green-600' },  // Green background and text colors
        'blue': { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },    // Blue background and text colors
        'purple': { iconBg: 'bg-purple-100', iconText: 'text-purple-600' }, // Purple background and text colors
        'amber': { iconBg: 'bg-amber-100', iconText: 'text-amber-600' }, // Amber/yellow background and text colors
        'gray': { iconBg: 'bg-gray-100', iconText: 'text-gray-600' },    // Gray background and text colors
    };

    const KpiCard = ({ title, value, subtext, icon: Icon, color }: any) => {
        // Extract base color name (e.g. "green" from "text-green-600 bg-green-600") — parse color from prop
        const colorName = Object.keys(kpiColorMap).find(c => color.includes(c)) || 'gray'; // Find matching color
        const { iconBg, iconText } = kpiColorMap[colorName];               // Get styles for color
        return (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center"> {/* KPI card container */}
                <div className={`p-3 rounded-lg mr-4 ${iconBg}`}>            {/* Icon container with background */}
                    <Icon size={24} className={iconText} />                 {/* Icon component with color */}
                </div>
                <div>                                                        {/* Text content container */}
                    <p className="text-sm text-gray-500 font-medium">{title}</p> {/* KPI label */}
                    <h3 className="text-xl font-bold text-gray-800">{value}</h3> {/* KPI value */}
                    {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>} {/* Optional subtext */}
                </div>
            </div>
        );
    };

    const COLORS_CHART = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']; // Colors for pie charts

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Filter Bar — Tab selector, date range picker, print/export buttons */}
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

            {/* Content Area — Display report based on active tab */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* --- SALES SUMMARY TAB --- Revenue trend, KPIs, daily sales line chart */}
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

                {/* --- PRODUCT ANALYSIS TAB --- Top products by revenue/qty, category pie chart */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border">
                                <h3 className="font-bold text-gray-700 mb-4">Category Distribution (Revenue)</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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

                {/* --- GST REPORTS TAB --- Tax breakdown by HSN code, CGST/SGST/IGST output totals */}
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

                {/* --- SALES TEAM TAB --- Staff performance with filter by person, revenue per person, avg bill */}
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

                {/* --- CUSTOMERS TAB --- New vs returning customers, top 10 customers by spend */}
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

                {/* --- STOCK HISTORY TAB --- Filtered stock movements (add/remove) with reason and notes */}
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