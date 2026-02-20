import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { StorageService } from '../services/storage';
import { COLORS, CATEGORIES } from '../constants';
import { Plus, Search, Trash2, Edit2, AlertCircle, Download, Upload, AlertTriangle, Filter, Calculator, History, X, DollarSign } from 'lucide-react';
import { searchMatch } from '../utils';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  
  // Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});

  // Stock Adjustment Modal
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState<number>(0);
  const [stockAction, setStockAction] = useState<'add' | 'remove'>('add');
  const [stockReason, setStockReason] = useState<string>('restock');
  const [stockNotes, setStockNotes] = useState('');

  // Bulk Update Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'price_increase' | 'discount_update'>('price_increase');
  const [bulkValue, setBulkValue] = useState<number>(0);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    setProducts(StorageService.getProducts());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct.name || !currentProduct.mrp) return;

    const discount = Number(currentProduct.discountPercent || 0);
    const mrp = Number(currentProduct.mrp || 0);
    const sellingPrice = mrp - (mrp * discount / 100);

    const newProduct: Product = {
      id: currentProduct.id || 0,
      name: currentProduct.name,
      category: currentProduct.category || 'General',
      hsnCode: currentProduct.hsnCode || '',
      unit: currentProduct.unit || 'Nos',
      packageSize: currentProduct.packageSize || '',
      batchNumber: currentProduct.batchNumber || '',
      expiryDate: currentProduct.expiryDate || '',
      mrp: mrp,
      discountPercent: discount,
      sellingPrice: sellingPrice,
      purchasePrice: Number(currentProduct.purchasePrice || 0),
      gstRate: Number(currentProduct.gstRate || 5),
      currentStock: Number(currentProduct.currentStock || 0),
      minStockLevel: Number(currentProduct.minStockLevel || 10),
    };

    StorageService.saveProduct(newProduct);
    loadProducts();
    setIsModalOpen(false);
    setCurrentProduct({});
  };

  const handleDelete = (id: number) => {
    if(window.confirm('Are you sure you want to delete this product?')) {
        StorageService.deleteProduct(id);
        loadProducts();
    }
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
      e.preventDefault();
      if(!stockProduct || stockQty <= 0) return;
      if(!stockNotes.trim()) {
          alert("Please provide a note/reason for this adjustment.");
          return;
      }

      // CRITICAL: Ensure inputs are numbers
      const safeQty = Number(stockQty);
      const current = Number(stockProduct.currentStock);

      if (stockAction === 'remove' && safeQty > current) {
          alert("Cannot remove more stock than currently available.");
          return;
      }

      // If action is 'add', we send positive qty. If 'remove', we send negative.
      // The storage service adds this value to current stock.
      const quantityChange = stockAction === 'add' ? safeQty : -safeQty;
      
      let historyReason: any = 'adjustment';
      if (stockReason === 'restock') historyReason = 'restock';
      else if (stockReason === 'return') historyReason = 'return';
      
      StorageService.updateStock(
          stockProduct.id, 
          quantityChange, 
          historyReason, 
          stockNotes 
      );

      loadProducts();
      setIsStockModalOpen(false);
      resetStockForm();
  };

  const handleBulkUpdate = () => {
      if(!window.confirm(`Are you sure you want to apply this to ALL ${products.length} products?`)) return;
      
      const updatedProducts = products.map(p => {
          if (bulkAction === 'price_increase') {
             // Increase MRP by %
             const newMrp = p.mrp * (1 + (bulkValue / 100));
             const newSell = newMrp - (newMrp * p.discountPercent / 100);
             return { ...p, mrp: Number(newMrp.toFixed(2)), sellingPrice: Number(newSell.toFixed(2)) };
          } else {
             // Set Discount %
             const newSell = p.mrp - (p.mrp * bulkValue / 100);
             return { ...p, discountPercent: bulkValue, sellingPrice: Number(newSell.toFixed(2)) };
          }
      });
      
      updatedProducts.forEach(p => StorageService.saveProduct(p));
      loadProducts();
      setIsBulkModalOpen(false);
      alert("Bulk update complete.");
  };

  const resetStockForm = () => {
      setStockProduct(null);
      setStockQty(0);
      setStockAction('add');
      setStockReason('restock');
      setStockNotes('');
  };

  const openStockModal = (p: Product) => {
      setStockProduct(p);
      setStockQty(0);
      setStockAction('add');
      setStockReason('restock');
      setStockNotes('');
      setIsStockModalOpen(true);
  };

  // --- CSV Parser Helper ---
  const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                  current += '"';
                  i++;
              } else {
                  inQuotes = !inQuotes;
              }
          } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
          } else {
              current += char;
          }
      }
      result.push(current.trim());
      return result;
  };

  // --- CSV Export/Import ---
  const handleExport = (onlyLowStock: boolean = false) => {
      const dataToExport = onlyLowStock 
        ? products.filter(p => p.currentStock <= p.minStockLevel)
        : products;
      if(dataToExport.length === 0) { alert("No products to export."); return; }
      const headers = ["Name", "Category", "HSN", "Unit", "Package Size", "Batch", "Expiry (YYYY-MM-DD)", "MRP", "Discount %", "Purchase Price", "GST %", "Stock", "Min Stock"];
      const rows = dataToExport.map(p => [
          `"${p.name.replace(/"/g, '""')}"`, p.category, p.hsnCode, p.unit, p.packageSize || '', p.batchNumber || '', p.expiryDate || '',
          p.mrp, p.discountPercent, p.purchasePrice, p.gstRate, p.currentStock, p.minStockLevel
      ].join(","));
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `inventory.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          const text = evt.target?.result as string;
          try {
             const lines = text.split("\n").filter(l => l.trim());
             if (lines.length < 2) { alert("CSV file is empty."); return; }
             
             // Parse header to determine column order
             const headerLine = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
             const headers = headerLine.map(h => h.replace(/\s+\(.*?\)/, '')); // Remove "(INR)", "(YYYY-MM-DD)" etc
             
             // Detect which format we're dealing with
             const hasProduct = headers.some(h => h.includes('product') || h.includes('name'));
             const hasMRP = headers.some(h => h.includes('mrp'));
             const hasPackage = headers.some(h => h.includes('package') || h.includes('size'));
             
             if (!hasProduct || !hasMRP) {
                 alert("CSV must have 'Product' and 'MRP' columns.");
                 return;
             }
             
             // Find column indices
             const productIdx = headers.findIndex(h => h.includes('product') || h.includes('name'));
             const packageIdx = headers.findIndex(h => h.includes('package') || h.includes('size'));
             const mrpIdx = headers.findIndex(h => h.includes('mrp'));
             const categoryIdx = headers.findIndex(h => h.includes('category'));
             const hsnIdx = headers.findIndex(h => h.includes('hsn'));
             const unitIdx = headers.findIndex(h => h.includes('unit') && !h.includes('package'));
             const batchIdx = headers.findIndex(h => h.includes('batch'));
             const expiryIdx = headers.findIndex(h => h.includes('expiry'));
             const discIdx = headers.findIndex(h => h.includes('discount'));
             const purchIdx = headers.findIndex(h => h.includes('purchase'));
             const gstIdx = headers.findIndex(h => h.includes('gst'));
             const stockIdx = headers.findIndex(h => h.includes('stock') && !h.includes('min'));
             const minStockIdx = headers.findIndex(h => h.includes('min'));
             
             let count = 0;
             for(let i = 1; i < lines.length; i++) {
                 const cols = parseCSVLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim());
                 if(cols.length < 2) continue;
                 
                 // Extract values with fallbacks
                 const name = cols[productIdx] || '';
                 const mrpStr = cols[mrpIdx] || '0';
                 const mprNum = parseFloat(mrpStr);
                 
                 if (!name || isNaN(mprNum) || mprNum <= 0) continue;
                 
                 // Extract package size if present, otherwise use empty
                 let packageSize = '';
                 let unit = 'Nos';
                 if (packageIdx >= 0) {
                     packageSize = cols[packageIdx] || '';
                     // Try to extract unit from package size (e.g., "30 nos" -> unit="nos", size="30")
                     const match = packageSize.match(/(\d+)\s*([a-zA-Z]+)/);
                     if (match) {
                         unit = match[2];
                     }
                 }
                 if (unitIdx >= 0) unit = cols[unitIdx] || unit;
                 
                 const newP: Product = {
                     id: 0,
                     name: name,
                     category: categoryIdx >= 0 ? (cols[categoryIdx] || 'General') : 'General',
                     hsnCode: hsnIdx >= 0 ? (cols[hsnIdx] || '') : '',
                     unit: unit,
                     packageSize: packageSize,
                     batchNumber: batchIdx >= 0 ? (cols[batchIdx] || '') : '',
                     expiryDate: expiryIdx >= 0 ? (cols[expiryIdx] || '') : '',
                     mrp: mprNum,
                     discountPercent: discIdx >= 0 ? (parseFloat(cols[discIdx]) || 0) : 0,
                     purchasePrice: purchIdx >= 0 ? (parseFloat(cols[purchIdx]) || 0) : 0,
                     gstRate: gstIdx >= 0 ? (parseFloat(cols[gstIdx]) || 5) : 5,
                     currentStock: stockIdx >= 0 ? (parseFloat(cols[stockIdx]) || 0) : 0,
                     minStockLevel: minStockIdx >= 0 ? (parseFloat(cols[minStockIdx]) || 10) : 10,
                     sellingPrice: mprNum - (mprNum * ((discIdx >= 0 ? parseFloat(cols[discIdx]) : 0) || 0) / 100)
                 };
                 StorageService.saveProduct(newP);
                 count++;
             }
             if (count === 0) {
                 alert("No valid products found. Please check CSV format.\n\nExpected columns: Product (or Name), MRP, and optionally: Package Size, Category, HSN, Unit, Batch, Expiry, Discount %, Purchase Price, GST %, Stock, Min Stock");
             } else {
                 alert(`Imported ${count} products.`);
             }
             loadProducts();
          } catch (err) { console.error(err); alert("Failed to parse CSV: " + (err as Error).message); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const openEdit = (p: Product) => { setCurrentProduct(p); setIsModalOpen(true); };
  const openNew = () => { setCurrentProduct({ category: 'General', gstRate: 5, discountPercent: 0, unit: 'Nos', minStockLevel: 10 }); setIsModalOpen(true); };
  const checkExpiry = (dateStr?: string) => {
      if(!dateStr) return false;
      const today = new Date(); const exp = new Date(dateStr);
      if(isNaN(exp.getTime())) return false;
      const diffTime = exp.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 30;
  };

  // Filter & Valuation
  const filteredProducts = products.filter(p => {
    const matchesSearch = searchMatch(`${p.name} ${p.category} ${p.hsnCode || ''} ${p.batchNumber || ''}`, search);
    const matchesLowStock = filterLowStock ? p.currentStock <= p.minStockLevel : true;
    return matchesSearch && matchesLowStock;
  });

  const filteredValuation = filteredProducts.reduce((sum, p) => {
      // Force Number conversion for safety
      const price = Number(p.purchasePrice) || 0;
      const stock = Number(p.currentStock) || 0;
      return sum + (stock * price);
  }, 0);

  return (
    <div>
      {/* Header Actions */}
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                Inventory
                <span className="ml-4 text-sm font-normal bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center shadow-sm">
                    <Calculator size={14} className="mr-2"/>
                    Valuation: ₹{filteredValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            </h2>
            
            <div className="flex gap-2">
                 <button onClick={() => setIsBulkModalOpen(true)} className="flex items-center px-3 py-2 bg-purple-50 text-purple-700 rounded-lg border border-purple-200 text-sm hover:bg-purple-100">
                    <DollarSign size={16} className="mr-2"/> Bulk Update
                 </button>
                 <button onClick={() => handleExport(true)} className="flex items-center px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 border border-amber-200 text-sm">
                    <Download size={16} className="mr-2" /> Low Stock
                </button>
                <button onClick={openNew} className="flex items-center px-4 py-2 text-white rounded-lg shadow hover:shadow-md transition-all" style={{ backgroundColor: COLORS.mediumGreen }}>
                    <Plus size={20} className="mr-2" /> Add Product
                </button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="relative w-full xl:w-96">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input 
                    type="text" placeholder="Search products..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => setFilterLowStock(!filterLowStock)} className={`flex items-center px-3 py-2 rounded-lg border transition-colors text-sm ${filterLowStock ? 'bg-red-50 text-red-700 border-red-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                    <Filter size={16} className="mr-2" /> {filterLowStock ? 'Showing Low Stock' : 'Filter Low Stock'}
                </button>
                <div className="h-6 w-px bg-gray-300 mx-1"></div>
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary"><Upload size={16} className="mr-2" /> Import</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportFile} />
                <button onClick={() => handleExport(false)} className="btn-secondary"><Download size={16} className="mr-2" /> Export All</button>
            </div>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                <tr>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Stock</th>
                <th className="p-4 font-semibold">Batch / Expiry</th>
                <th className="p-4 font-semibold text-right">Purchase (Val)</th>
                <th className="p-4 font-semibold text-right">MRP / Sell</th>
                <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(p => {
                    const isExpiring = checkExpiry(p.expiryDate);
                    const isLowStock = p.currentStock <= p.minStockLevel;
                    return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isExpiring ? 'bg-amber-50/50' : ''}`}>
                        <td className="p-4">
                            <div className="font-medium text-gray-800">{p.name}</div>
                            <div className="text-xs text-gray-500">{p.category} | {p.packageSize}</div>
                            {isLowStock && <span className="text-xs text-red-500 flex items-center mt-1 font-semibold"><AlertCircle size={12} className="mr-1"/> Low Stock (Min: {p.minStockLevel})</span>}
                        </td>
                        <td className={`p-4 font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {p.currentStock} <span className="text-xs font-normal text-gray-400">{p.unit}</span>
                        </td>
                        <td className="p-4 text-sm">
                            <div className="text-gray-700">{p.batchNumber || '-'}</div>
                            {p.expiryDate && <div className={`flex items-center ${isExpiring ? 'text-amber-700 font-bold' : 'text-gray-500'}`}>{isExpiring && <AlertTriangle size={12} className="mr-1"/>}{p.expiryDate}</div>}
                        </td>
                        <td className="p-4 text-right">
                             {/* Exposed Purchase Price for Verification */}
                             <span className="text-sm font-mono text-gray-600">₹{p.purchasePrice}</span>
                        </td>
                        <td className="p-4 text-right text-sm">
                            <div className="flex flex-col">
                                <span className="text-gray-400 line-through text-xs">₹{p.mrp}</span>
                                <span className="font-semibold text-green-700">₹{p.sellingPrice.toFixed(2)}</span>
                            </div>
                        </td>
                        <td className="p-4 text-right">
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => openStockModal(p)} className="p-1 text-purple-600 hover:bg-purple-50 rounded" title="Adjust Stock"><History size={18} /></button>
                                <button onClick={() => openEdit(p)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(p.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={18} /></button>
                            </div>
                        </td>
                    </tr>
                )})}
                {filteredProducts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No products found.</td></tr>}
            </tbody>
            </table>
        </div>
      </div>

      {/* Product Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">{currentProduct.id ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Product Name *</label>
                <input required className="input" value={currentProduct.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} />
              </div>
              <div><label className="label">Category</label><select className="input" value={currentProduct.category || ''} onChange={e => setCurrentProduct({...currentProduct, category: e.target.value})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="label">HSN Code</label><input className="input" value={currentProduct.hsnCode || ''} onChange={e => setCurrentProduct({...currentProduct, hsnCode: e.target.value})} /></div>
              <div><label className="label">Package Size</label><input className="input" placeholder="e.g. 100ml" value={currentProduct.packageSize || ''} onChange={e => setCurrentProduct({...currentProduct, packageSize: e.target.value})} /></div>
              <div><label className="label">Batch Number</label><input className="input" value={currentProduct.batchNumber || ''} onChange={e => setCurrentProduct({...currentProduct, batchNumber: e.target.value})} /></div>
              <div><label className="label">Expiry Date</label><input type="date" className="input" value={currentProduct.expiryDate || ''} onChange={e => setCurrentProduct({...currentProduct, expiryDate: e.target.value})} /></div>
              <div><label className="label">Current Stock</label><input type="number" className="input" value={currentProduct.currentStock || 0} onChange={e => setCurrentProduct({...currentProduct, currentStock: Number(e.target.value)})} /></div>
              <div><label className="label">Min Stock Level</label><input type="number" className="input" value={currentProduct.minStockLevel || 10} onChange={e => setCurrentProduct({...currentProduct, minStockLevel: Number(e.target.value)})} /></div>
              <div><label className="label">MRP *</label><input required type="number" step="0.01" className="input" value={currentProduct.mrp || ''} onChange={e => setCurrentProduct({...currentProduct, mrp: Number(e.target.value)})} /></div>
              <div><label className="label">Purchase Price (For Valuation)</label><input type="number" step="0.01" className="input" value={currentProduct.purchasePrice || 0} onChange={e => setCurrentProduct({...currentProduct, purchasePrice: Number(e.target.value)})} /></div>
              <div><label className="label">Discount (%)</label><input type="number" step="0.01" className="input" value={currentProduct.discountPercent || 0} onChange={e => setCurrentProduct({...currentProduct, discountPercent: Number(e.target.value)})} /></div>
              <div><label className="label">GST Rate (%)</label><input type="number" className="input" value={currentProduct.gstRate || 5} onChange={e => setCurrentProduct({...currentProduct, gstRate: Number(e.target.value)})} /></div>
              <div><label className="label">Unit</label><input className="input" value={currentProduct.unit || 'Nos'} onChange={e => setCurrentProduct({...currentProduct, unit: e.target.value})} /></div>
              <div className="col-span-2 mt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white rounded-lg shadow" style={{ backgroundColor: COLORS.mediumGreen }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Stock Adjustment Modal */}
      {isStockModalOpen && stockProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Adjust Stock</h3>
                        <p className="text-sm text-gray-500">{stockProduct.name} (Current: {stockProduct.currentStock})</p>
                    </div>
                    <button onClick={() => setIsStockModalOpen(false)}><X className="text-gray-400" size={20}/></button>
                </div>
                <form onSubmit={handleStockAdjustment} className="p-4 space-y-4">
                    <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                        <button type="button" className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${stockAction === 'add' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`} onClick={() => { setStockAction('add'); setStockReason('restock'); }}><Plus size={16} className="inline mr-1"/> Add Stock</button>
                        <button type="button" className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${stockAction === 'remove' ? 'bg-white shadow text-red-700' : 'text-gray-500'}`} onClick={() => { setStockAction('remove'); setStockReason('adjustment'); }}><Trash2 size={16} className="inline mr-1"/> Remove Stock</button>
                    </div>
                    <div><label className="label">Reason</label><select className="input" value={stockReason} onChange={e => setStockReason(e.target.value)}>{stockAction === 'add' ? (<><option value="restock">New Stock / Restock</option><option value="return">Customer Return</option><option value="adjustment">Stock Correction (Found)</option></>) : (<><option value="damage">Damaged / Expired</option><option value="adjustment">Stock Correction (Lost)</option><option value="theft">Theft</option><option value="personal">Personal Use</option></>)}</select></div>
                    <div><label className="label">Quantity</label><input type="number" min="1" className="input" autoFocus value={stockQty || ''} onChange={e => setStockQty(Number(e.target.value))} /></div>
                    <div><label className="label">Notes (Mandatory)</label><textarea required className="input h-20" placeholder="Enter details..." value={stockNotes} onChange={e => setStockNotes(e.target.value)}/></div>
                    <div className="flex justify-end space-x-2 pt-2"><button type="button" onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 border rounded text-gray-600">Cancel</button><button type="submit" className={`px-4 py-2 text-white rounded shadow ${stockAction === 'add' ? 'bg-green-600' : 'bg-red-600'}`}>{stockAction === 'add' ? 'Add to Inventory' : 'Deduct from Inventory'}</button></div>
                </form>
              </div>
          </div>
      )}

      {/* Bulk Update Modal */}
      {isBulkModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
                   <h3 className="text-lg font-bold mb-4">Bulk Update</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="label">Action</label>
                           <select className="input" value={bulkAction} onChange={e => setBulkAction(e.target.value as any)}>
                               <option value="price_increase">Increase MRP by %</option>
                               <option value="discount_update">Set Discount % for All</option>
                           </select>
                       </div>
                       <div>
                           <label className="label">Value (%)</label>
                           <input type="number" className="input" value={bulkValue} onChange={e => setBulkValue(Number(e.target.value))} />
                       </div>
                       <div className="flex justify-end gap-2">
                           <button onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                           <button onClick={handleBulkUpdate} className="px-4 py-2 bg-purple-600 text-white rounded">Apply to All</button>
                       </div>
                   </div>
               </div>
          </div>
      )}

      <style>{`
        .label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: ${COLORS.sageGreen}; ring: 2px solid ${COLORS.sageGreen}; }
        .btn-secondary { display: flex; align-items: center; padding: 0.5rem 0.75rem; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; color: #374151; transition: background-color 0.15s; }
        .btn-secondary:hover { background-color: #f3f4f6; }
      `}</style>
    </div>
  );
};

export default Inventory;