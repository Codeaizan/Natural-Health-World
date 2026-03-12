import React, { useEffect, useState } from 'react'; // React core + hooks for state and side-effects
import { Product } from '../types';                   // Product type from types.ts — defines all inventory item properties
import { StorageService } from '../services/storage'; // Unified storage service — fetch/save/delete products from SQLite/IndexedDB
import { COLORS, CATEGORIES } from '../constants';    // App colour tokens and product category list (\"General\", \"Pharma\", etc.)
import { Plus, Search, Trash2, Edit2, AlertCircle, Download, Upload, Filter, Calculator, History, X, DollarSign } from 'lucide-react'; // Icons for buttons and alerts
import { searchMatch } from '../utils';               // Utility function — fuzzy search across product name/category/HSN/batch
import { useToast } from '../components/Toast';       // Toast notification hook — success/error/warning/confirm messages
import { TableSkeleton } from '../components/Skeleton'; // Loading placeholder while products are being fetched from DB
import EmptyState from '../components/EmptyState';    // Empty state UI shown when products don't exist or search yields no results

// Main inventory management page — CRUD for products, CSV import/export, stock adjustments, bulk pricing updates
const Inventory: React.FC = () => {
  const toast = useToast(); // Toast hook instance for user notifications
  const [products, setProducts] = useState<Product[]>([]); // All products fetched from storage — state for re-rendering on changes
  const [loading, setLoading] = useState(true);           // true while initial product list is being loaded from storage
  const [search, setSearch] = useState('');               // Search query string — filtered in real-time as user types
  const [filterLowStock, setFilterLowStock] = useState(false); // true when \"Filter Low Stock\" toggle is active
  
  // Product Edit/Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);         // true when the product edit/create modal is open
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({}); // Product object being edited (or empty {} for new product)

  // Stock Adjustment Modal state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false); // true when the stock adjustment modal is open
  const [stockProduct, setStockProduct] = useState<Product | null>(null); // The specific product whose stock is being adjusted
  const [stockQty, setStockQty] = useState<number>(0);    // Quantity to add or remove in the adjustment
  const [stockAction, setStockAction] = useState<'add' | 'remove'>('add'); // Whether we're adding or removing stock
  const [stockReason, setStockReason] = useState<string>('restock'); // Reason for adjustment (\"restock\", \"damage\", \"theft\", etc.)
  const [stockNotes, setStockNotes] = useState('');       // User notes explaining the adjustment — mandatory field for traceability

  // Bulk Pricing Update Modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false); // true when the bulk update modal is open
  const [bulkAction, setBulkAction] = useState<'price_increase' | 'discount_update'>('price_increase'); // Action type: increase MRP % or set discount % for all
  const [bulkValue, setBulkValue] = useState<number>(0);  // Percentage value for the bulk action

  const fileInputRef = React.useRef<HTMLInputElement>(null); // Hidden file input ref — used to trigger CSV file picker

  useEffect(() => {
    loadProducts();                                             // On component mount, fetch all products from storage
  }, []);

  const loadProducts = async () => {
    const productsData = await StorageService.getProducts();   // Fetch all products from database
    setProducts(productsData);                                 // Update products state
    setLoading(false);                                         // Clear loading state
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();                                        // Prevent form default submission
    if (!currentProduct.name || !currentProduct.mrp) return;   // Validate required fields (name, MRP) before saving

    const discount = Number(currentProduct.discountPercent || 0); // Parse discount as number (default 0 if empty)
    const mrp = Number(currentProduct.mrp || 0);              // Parse MRP as number
    const sellingPrice = mrp - (mrp * discount / 100);        // Calculate selling price = MRP - discount%

    const newProduct: Product = {                              // Build complete product object with all fields
      id: currentProduct.id || 0,                             // Keep existing ID if editing, 0 for new product (DB will generate)
      name: currentProduct.name,                              // Product name
      category: currentProduct.category || 'General',         // Default to 'General' if not specified
      hsnCode: currentProduct.hsnCode || '',                  // HSN code for GST mapping (optional)
      unit: currentProduct.unit || 'Nos',                     // Unit of measurement (default 'Nos' = Nos)
      packageSize: currentProduct.packageSize || '',          // Package size description
      batchNumber: currentProduct.batchNumber || '',          // Batch/lot number for tracking
      expiryDate: currentProduct.expiryDate || '',            // Expiry date (for shelf-stable goods)
      mrp: mrp,                                               // Maximum Retail Price
      discountPercent: discount,                              // Discount percentage
      sellingPrice: sellingPrice,                             // Final selling price after discount
      purchasePrice: Number(currentProduct.purchasePrice || 0), // Cost price paid for product (for margin calc)
      gstRate: Number(currentProduct.gstRate || 5),           // GST rate % (default 5%)
      currentStock: Number(currentProduct.currentStock || 0), // Current inventory count
      minStockLevel: Number(currentProduct.minStockLevel || 10), // Reorder point — alert if stock < this
    };

    await StorageService.saveProduct(newProduct);             // Save or update product in database
    await loadProducts();                                      // Reload products list to reflect changes
    setIsModalOpen(false);                                    // Close the modal
    setCurrentProduct({});                                   // Reset form state
  };

  const handleDelete = async (id: number) => {
    const ok = await toast.confirm({ title: 'Delete Product', message: 'Are you sure you want to delete this product?', danger: true, confirmText: 'Delete' }); // Show confirmation dialog
    if (ok) {
        await StorageService.deleteProduct(id);              // Delete product from database
        await loadProducts();                                 // Reload products list
        toast.success('Product Deleted');                     // Show success toast
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();                                     // Prevent form submission
      if(!stockProduct || stockQty <= 0) return;             // Validate that a product is selected and qty > 0
      if(!stockNotes.trim()) {                               // Ensure user provided a note/reason
          toast.warning('Note Required', 'Please provide a note/reason for this adjustment.'); // Show warning toast
          return;                                            // Abort if no notes
      }

      const safeQty = Number(stockQty);                      // Parse qty as number
      const current = Number(stockProduct.currentStock);     // Get current stock level

      if (stockAction === 'remove' && safeQty > current) {   // Validate we're not removing more than available
          toast.error('Stock Error', 'Cannot remove more stock than currently available.'); // Show error toast
          return;                                            // Abort if insufficient stock
      }

      // Calculate signed quantity: positive for 'add', negative for 'remove'
      // This value is added to the current stock by the storage service
      const quantityChange = stockAction === 'add' ? safeQty : -safeQty; // Apply sign based on action
      
      let historyReason = stockReason || 'adjustment';       // Default reason if not provided
      
      await StorageService.updateStock(                       // Call storage service to adjust stock
          stockProduct.id,                                   // Product ID
          quantityChange,                                    // Signed quantity delta
          historyReason,                                     // Reason category (restock, damage, theft, etc.)
          stockNotes                                         // User notes for audit trail
      );

      await loadProducts();                                  // Reload products list with updated stock
      setIsStockModalOpen(false);                           // Close stock modal
      resetStockForm();                                     // Clear stock form state
  };

  const handleBulkUpdate = async () => {
      const ok = await toast.confirm({ title: 'Bulk Update', message: `Apply this to ALL ${products.length} products?`, confirmText: 'Apply' }); // Confirm bulk update affects all products
      if (!ok) return;                                       // User cancelled bulk update
      
      const updatedProducts = products.map(p => {           // Map over each product to apply the bulk action
          if (bulkAction === 'price_increase') {
             // Calculate new MRP with percentage increase
             const newMrp = p.mrp * (1 + (bulkValue / 100)); // MRP * (1 + increase%)
             const newSell = newMrp - (newMrp * p.discountPercent / 100); // Recalculate selling price with same discount%
             return { ...p, mrp: Number(newMrp.toFixed(2)), sellingPrice: Number(newSell.toFixed(2)) }; // Return updated product
          } else {
             // Set new discount percentage for all products
             const newSell = p.mrp - (p.mrp * bulkValue / 100); // Recalculate selling price with new discount%
             return { ...p, discountPercent: bulkValue, sellingPrice: Number(newSell.toFixed(2)) }; // Return updated product
          }
      });
      
      for (const p of updatedProducts) {
        await StorageService.saveProduct(p);                 // Save each updated product to database
      }
      await loadProducts();                                  // Reload products list from database
      setIsBulkModalOpen(false);                            // Close bulk update modal
      toast.success('Bulk Update Complete');                 // Show success toast
  };

  const resetStockForm = () => {
      setStockProduct(null);                                 // Clear selected product
      setStockQty(0);
      setStockAction('add');                                 // Reset action to 'add'
      setStockReason('restock');                             // Reset reason to 'restock'
      setStockNotes('');                                     // Clear notes
  };

  const openStockModal = (p: Product) => {
      setStockProduct(p);                                    // Set product to adjust
      setStockQty(0);                                        // Reset qty to 0
      setStockAction('add');                                 // Default to 'add'
      setStockReason('restock');                             // Default reason to 'restock'
      setStockNotes('');                                     // Clear notes
      setIsStockModalOpen(true);                             // Open modal
  };

  // --- CSV Parser Helper ---
  const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];                           // Array to store parsed fields
      let current = '';                                      // Current field being parsed
      let inQuotes = false;                                  // Track if inside quoted field
      for (let i = 0; i < line.length; i++) {               // Iterate through line characters
          const char = line[i];                              // Current character
          if (char === '"') {                                // If quote character
              if (inQuotes && line[i + 1] === '"') {         // If in quotes and next is also quote
                  current += '"';                            // Add escaped quote
                  i++;                                       // Skip next quote
              } else {
                  inQuotes = !inQuotes;                      // Toggle quote state
              }
          } else if (char === ',' && !inQuotes) {            // If comma outside quotes
              result.push(current.trim());                   // Add field to result
              current = '';                                  // Reset current field
          } else {
              current += char;                               // Add char to current field
          }
      }
      result.push(current.trim());                           // Add final field
      return result;                                         // Return parsed fields
  };

  // --- CSV Export/Import ---
  const handleExport = async (onlyLowStock: boolean = false) => {
      const dataToExport = onlyLowStock                      // Determine which products to export
        ? products.filter(p => p.currentStock <= p.minStockLevel) // Export only low stock items
        : products;                                          // Or export all products
      if(dataToExport.length === 0) { toast.warning('Nothing to Export', 'No products to export.'); return; } // Show warning if no data
      const headers = ["Name", "Category", "HSN", "Unit", "Package Size", "MRP", "Discount %", "Purchase Price", "GST %", "Stock", "Min Stock"]; // CSV column headers
      const csvEscape = (val: string) => {                   // Helper to escape CSV values with quotes/commas
          if (val.includes(',') || val.includes('"') || val.includes('\n')) { // If value has special chars
              return `"${val.replace(/"/g, '""')}"`;         // Wrap in quotes and escape internal quotes
          }
          return val;                                        // Return plain value if no special chars
      };
      const rows = dataToExport.map(p => [                  // Build CSV rows from products
          csvEscape(p.name), csvEscape(p.category), csvEscape(p.hsnCode), csvEscape(p.unit), csvEscape(p.packageSize || ''), // Name, Category, HSN, Unit, Package Size
          p.mrp, p.discountPercent, p.purchasePrice, p.gstRate, p.currentStock, p.minStockLevel // MRP, Discount%, Purchase Price, GST%, Stock, Min Stock
      ].join(","));                                          // Join columns with commas
      const csvContent = [headers.join(","), ...rows].join("\n"); // Combine header and rows with newlines
      const { saveCsvFile } = await import('../utils');      // Import CSV save utility
      await saveCsvFile('inventory.csv', csvContent);        // Save CSV file with all products
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];                      // Get first file from input
      if (!file) return;                                     // If no file, exit
      const reader = new FileReader();                       // Create file reader
      reader.onload = async (evt) => {                       // When file is read
          const text = evt.target?.result as string;        // Get file contents as text
          try {
             const lines = text.split("\n").filter(l => l.trim()); // Split by newlines and remove empty lines
             if (lines.length < 2) { toast.warning('Empty File', 'CSV file is empty.'); return; } // Ensure header + at least 1 row
             
             // Parse header to determine column positions/order
             const headerLine = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim()); // Parse header row and lowercase
             const headers = headerLine.map(h => h.replace(/\s+\(.*?\)/, '')); // Remove "(INR)", "(YYYY-MM-DD)" suffix from headers
             
             // Validate that CSV has required columns
             const hasProduct = headers.some(h => h.includes('product') || h.includes('name')); // Check for name/product column
             const hasMRP = headers.some(h => h.includes('mrp'));  // Check for MRP column
             const hasPackage = headers.some(h => h.includes('package') || h.includes('size')); // Check for package/size column
             
             if (!hasProduct || !hasMRP) {                   // If missing required columns
                 toast.error('Invalid CSV', "CSV must have 'Product' and 'MRP' columns."); // Show error
                 return;                                    // Exit
             }
             
             // Find column indices by searching header names
             const productIdx = headers.findIndex(h => h.includes('product') || h.includes('name')); // Product name column
             const packageIdx = headers.findIndex(h => h.includes('package') || h.includes('size')); // Package size column
             const mrpIdx = headers.findIndex(h => h.includes('mrp'));    // MRP column
             const categoryIdx = headers.findIndex(h => h.includes('category')); // Category column
             const hsnIdx = headers.findIndex(h => h.includes('hsn'));    // HSN code column
             const unitIdx = headers.findIndex(h => h.includes('unit') && !h.includes('package')); // Unit column (not "package unit")
             const _batchIdx = headers.findIndex(h => h.includes('batch')); // Batch number column (unused for now)
             const _expiryIdx = headers.findIndex(h => h.includes('expiry')); // Expiry date column (unused for now)
             const discIdx = headers.findIndex(h => h.includes('discount')); // Discount % column
             const purchIdx = headers.findIndex(h => h.includes('purchase')); // Purchase price column
             const gstIdx = headers.findIndex(h => h.includes('gst'));    // GST % column
             const stockIdx = headers.findIndex(h => h.includes('stock') && !h.includes('min')); // Current stock column
             const minStockIdx = headers.findIndex(h => h.includes('min')); // Min stock level column
             
             // Ask user: Clear existing products or merge with import?
             const clearFirst = await toast.confirm({
                 title: 'Import Mode',
                 message: 'Do you want to clear all existing products before importing?\n\nConfirm to clear and import fresh, Cancel to merge with existing products.',
                 confirmText: 'Clear & Import',
                 cancelText: 'Merge',
                 danger: true
             });
             
             if (clearFirst) {                               // If user chose to clear
                 await StorageService.deleteAllProducts();   // Delete all existing products
                 // Small delay to ensure database clear completes
                 await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms for DB
             }
             
             let count = 0;                                  // Counter for successful imports
             let errors: string[] = [];                      // Array to track import errors
             
             for(let i = 1; i < lines.length; i++) {        // Loop through data rows (skip header at i=0)
                 const cols = parseCSVLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim()); // Parse row and trim quotes
                 if(cols.length < 2) continue;              // Skip rows with fewer than 2 columns
                 
                 // Extract and validate core fields
                 const name = cols[productIdx] || '';        // Get product name
                 const mrpStr = cols[mrpIdx] || '0';         // Get MRP string
                 const mprNum = parseFloat(mrpStr);          // Parse MRP as number
                 
                 if (!name || isNaN(mprNum) || mprNum <= 0) { // Validate name and MRP > 0
                     if (name) errors.push(`Row ${i}: Missing or invalid MRP for "${name}"`); // Log error if name exists
                     continue;                              // Skip invalid row
                 }
                 
                 // Extract package size and unit (with fallback logic)
                 let packageSize = '';                       // Default empty package size
                 let unit = 'Nos';                           // Default unit to 'Nos'
                 if (packageIdx >= 0) {                      // If package column exists
                     packageSize = cols[packageIdx] || '';   // Get package size value
                     // Try to extract unit from package size (e.g., "30 nos" -> unit="nos", size="30")
                     const match = packageSize.match(/(\d+)\s*([a-zA-Z]+)/); // Match pattern: number + letters
                     if (match) {                            // If pattern found
                         unit = match[2];                    // Extract unit from regex group
                     }
                 }
                 if (unitIdx >= 0) unit = cols[unitIdx] || unit; // Override with explicit unit column if exists
                 
                 // Build new product object with parsed data
                 const newP: Product = {
                     id: 0,                                  // Auto-generate ID on save
                     name: name,                             // Product name
                     category: categoryIdx >= 0 ? (cols[categoryIdx] || 'General') : 'General', // Category from CSV or default 'General'
                     hsnCode: hsnIdx >= 0 ? (cols[hsnIdx] || '') : '', // HSN code or empty
                     unit: unit,                             // Unit (extracted or provided)
                     packageSize: packageSize,               // Package size
                     batchNumber: '',                        // Not imported from CSV
                     expiryDate: '',                         // Not imported from CSV
                     mrp: mprNum,                            // MRP
                     discountPercent: discIdx >= 0 ? (parseFloat(cols[discIdx]) || 0) : 0, // Discount % or 0
                     purchasePrice: purchIdx >= 0 ? (parseFloat(cols[purchIdx]) || 0) : 0, // Purchase price or 0
                     gstRate: gstIdx >= 0 ? (parseFloat(cols[gstIdx]) || 5) : 5, // GST % or default 5%
                     currentStock: stockIdx >= 0 ? (parseFloat(cols[stockIdx]) || 0) : 0, // Current stock or 0
                     minStockLevel: minStockIdx >= 0 ? (parseFloat(cols[minStockIdx]) || 10) : 10, // Min stock or default 10
                     sellingPrice: mprNum - (mprNum * ((discIdx >= 0 ? parseFloat(cols[discIdx]) : 0) || 0) / 100) // Calculate: MRP - discount
                 };
                 
                 try {
                     await StorageService.saveProduct(newP); // Save to database
                     count++;                                // Increment success counter
                 } catch (err) {
                     const errMsg = (err as Error).message;  // Get error message
                     errors.push(`Row ${i}: ${name} (${packageSize}) - ${errMsg.includes('duplicate') || errMsg.includes('unique') ? 'Duplicate product' : errMsg}`); // Add error to list
                     console.error(`Failed to import row ${i}:`, err); // Log error to console
                 }
             }
             
             // Show import summary
             if (count === 0) {                              // If no products imported
                 toast.error('Import Failed', 'No valid products found. Check CSV format.'); // Show error toast
             } else {                                        // If some products imported
                 let msg = `${count} products imported successfully.`; // Base success message
                 if (errors.length > 0) {                   // If there were errors
                     msg += ` ${errors.length} rows failed.`; // Add error count to message
                 }
                 toast.success('Import Complete', msg);      // Show success toast
             }
             await loadProducts();                           // Reload products from database
          } catch (err) { console.error(err); toast.error('CSV Error', 'Failed to parse CSV: ' + (err as Error).message); } // Log any parsing errors
      };
      reader.readAsText(file);                               // Read file as text
      e.target.value = '';                                  // Reset input value
  };

  const openEdit = (p: Product) => { setCurrentProduct(p); setIsModalOpen(true); }; // Populate form and open edit modal
  const openNew = () => { setCurrentProduct({ category: 'General', gstRate: 5, discountPercent: 0, unit: 'Nos', minStockLevel: 10 }); setIsModalOpen(true); }; // Open new product modal with defaults
  const checkExpiry = (dateStr?: string) => {                // Check if date is within 30 days of expiry
      if(!dateStr) return false;                             // No date = not expiring soon
      const today = new Date(); const exp = new Date(dateStr); // Parse dates
      if(isNaN(exp.getTime())) return false;                 // Invalid date format
      const diffTime = exp.getTime() - today.getTime();      // Days until expiry in milliseconds
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 30; // True if <= 30 days away
  };

  // Filter products based on search and low-stock toggle
  const filteredProducts = products.filter(p => {
    const matchesSearch = searchMatch(`${p.name} ${p.category} ${p.hsnCode || ''} ${p.batchNumber || ''}`, search); // Search across name, category, HSN, batch
    const matchesLowStock = filterLowStock ? p.currentStock <= p.minStockLevel : true; // Filter for low stock if toggle enabled
    return matchesSearch && matchesLowStock;                 // Return only products matching both conditions
  });

  // Calculate total inventory valuation (cost value)
  const filteredValuation = filteredProducts.reduce((sum, p) => {
      const price = Number(p.purchasePrice) || 0;           // Safe number conversion for purchase price
      const stock = Number(p.currentStock) || 0;            // Safe number conversion for stock qty
      return sum + (stock * price);                         // Add (qty * cost) to running total
  }, 0);                                                     // Start with 0

  return (
    <div>
      {/* Header Actions and Search/Filter Bar */}
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
      {loading ? <TableSkeleton rows={8} cols={5} /> : (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                <tr>
                <th className="p-4 font-semibold">Name</th>
                <th className="p-4 font-semibold">Stock</th>
                <th className="p-4 font-semibold text-right">Purchase (Val)</th>
                <th className="p-4 font-semibold text-right">MRP / Sell</th>
                <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(p => {
                    const isLowStock = p.currentStock <= p.minStockLevel;
                    return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                            <div className="font-medium text-gray-800">{p.name}</div>
                            <div className="text-xs text-gray-500">{p.category} | {p.packageSize}</div>
                            {isLowStock && <span className="text-xs text-red-500 flex items-center mt-1 font-semibold"><AlertCircle size={12} className="mr-1"/> Low Stock (Min: {p.minStockLevel})</span>}
                        </td>
                        <td className={`p-4 font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {p.currentStock} <span className="text-xs font-normal text-gray-400">{p.unit}</span>
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
                {filteredProducts.length === 0 && <tr><td colSpan={6} className="p-0"><EmptyState type="inventory" title="No products found" description={search ? 'Try a different search term' : 'Add your first product to get started'} action={!search ? { label: 'Add Product', onClick: () => openNew() } : undefined} /></td></tr>}
            </tbody>
            </table>
        </div>
      </div>
      )}

      {/* Product Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
              <div className="bg-white rounded-xl shadow-lg w-full max-w-md animate-slideUp">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-overlayFade">
               <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6 animate-slideUp">
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

    </div>
  );
};

export default Inventory;