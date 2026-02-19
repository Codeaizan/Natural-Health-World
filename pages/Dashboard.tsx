import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { Bill, Product } from '../types';
import { COLORS } from '../constants';
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    setBills(StorageService.getBills());
    setProducts(StorageService.getProducts());
  }, []);

  // Metrics
  const totalSales = bills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalBills = bills.length;
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockLevel).length;
  const avgBillValue = totalBills > 0 ? totalSales / totalBills : 0;

  // Expiry Logic
  const expiringProducts = products.filter(p => {
      if(!p.expiryDate) return false;
      const today = new Date();
      const exp = new Date(p.expiryDate);
      const diffTime = exp.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // Expired or expiring in 30 days
  });

  // Chart Data: Last 7 days sales
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dailySales = bills
        .filter(b => b.date.startsWith(dateStr))
        .reduce((sum, b) => sum + b.grandTotal, 0);
    return { name: dateStr.slice(5), sales: dailySales };
  });

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
      <div className={`p-4 rounded-full mr-4 ${color} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`₹${totalSales.toLocaleString()}`} 
          icon={DollarSign} 
          color="text-emerald-600 bg-emerald-600" 
        />
        <StatCard 
          title="Total Bills" 
          value={totalBills} 
          icon={ShoppingBag} 
          color="text-blue-600 bg-blue-600" 
        />
        <StatCard 
          title="Low Stock" 
          value={lowStockCount} 
          icon={AlertTriangle} 
          color="text-amber-600 bg-amber-600" 
        />
        <StatCard 
          title="Expiring Soon" 
          value={expiringProducts.length} 
          icon={Clock} 
          color="text-red-600 bg-red-600" 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
          <h3 className="text-lg font-bold mb-4" style={{ color: COLORS.darkText }}>Sales Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="sales" fill={COLORS.mediumGreen} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-80">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: COLORS.darkText }}>Inventory Alerts</h3>
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