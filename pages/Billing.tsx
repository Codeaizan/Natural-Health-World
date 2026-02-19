import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Product, Customer, SalesPerson, CartItem, Bill, BillItem } from '../types';
import { COLORS } from '../constants';
import { Search, Plus, Trash2, Printer, CheckCircle, Users, X, Save, Eraser, Instagram, Phone, Mail, MapPin } from 'lucide-react';
import { searchMatch, numberToWords } from '../utils';

const Billing: React.FC = () => {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Selection
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<number>(1);
  const [isGstBill, setIsGstBill] = useState(false);

  const [lastBill, setLastBill] = useState<Bill | null>(null);

  // New Customer Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});

  useEffect(() => {
    setProducts(StorageService.getProducts());
    setCustomers(StorageService.getCustomers());
    setSalesPersons(StorageService.getSalesPersons());
  }, []);

  // -- Handlers --

  const addToCart = () => {
    if (!selectedProduct) return;
    
    // Check if immediate quantity exceeds stock
    if (quantity > selectedProduct.currentStock) {
        alert(`Insufficient stock! Available: ${selectedProduct.currentStock}, Requested: ${quantity}`);
        return;
    }

    const existingItem = cart.find(item => item.id === selectedProduct.id);
    if (existingItem) {
        // Update
        const newQty = existingItem.quantity + quantity;
        if (newQty > selectedProduct.currentStock) {
            alert(`Cannot add more than stock! Available: ${selectedProduct.currentStock}, Already in cart: ${existingItem.quantity}, Adding: ${quantity}`);
            return;
        }
        setCart(cart.map(item => item.id === selectedProduct.id ? { ...item, quantity: newQty, totalAmount: newQty * item.sellingPrice } : item));
    } else {
        // Add
        setCart([...cart, { ...selectedProduct, quantity, totalAmount: quantity * selectedProduct.sellingPrice }]);
    }
    // Reset inputs
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity(1);
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
      if (cart.length > 0 && window.confirm("Are you sure you want to clear the cart?")) {
          setCart([]);
      }
  };

  const handleAddNewCustomer = (e: React.FormEvent) => {
      e.preventDefault();
      if(!newCustomer.name || !newCustomer.phone) {
          alert("Name and Phone are required");
          return;
      }
       // Basic GSTIN Validation
       if (newCustomer.gstin) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(newCustomer.gstin)) {
            alert('Invalid GSTIN format. It should be 15 characters.');
            return;
        }
      }

      const customer: Customer = {
          id: 0, // Storage will assign
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email || '',
          address: newCustomer.address || '',
          gstin: newCustomer.gstin || ''
      };
      
      StorageService.saveCustomer(customer);
      
      // Refresh list and auto-select
      const updatedList = StorageService.getCustomers();
      setCustomers(updatedList);
      // Find the newly added customer (highest ID)
      const added = updatedList.reduce((prev, current) => (prev.id > current.id) ? prev : current);
      
      setSelectedCustomer(added);
      setCustomerSearch(added.name);
      
      setIsCustomerModalOpen(false);
      setNewCustomer({});
  };

  // -- Calculations --
  
  const calculateBillTotals = () => {
    const settings = StorageService.getSettings();
    let taxable = 0;
    let totalTax = 0;
    
    // State Code Logic
    const companyStateCode = settings.stateCode || '19'; // Default 19 (WB)
    let isInterState = false;

    if (isGstBill && selectedCustomer?.gstin) {
        // Extract first 2 digits of Customer GSTIN
        const custStateCode = selectedCustomer.gstin.substring(0, 2);
        // If Customer State Code exists and is different from Company State Code
        if (custStateCode && custStateCode !== companyStateCode) {
            isInterState = true;
        }
    }

    cart.forEach(item => {
        const itemTaxable = item.sellingPrice * item.quantity;
        taxable += itemTaxable;
        if(isGstBill) {
            const taxAmount = itemTaxable * (item.gstRate / 100);
            totalTax += taxAmount;
        }
    });
    
    let cgst = 0, sgst = 0, igst = 0;

    if (isGstBill) {
        if (isInterState) {
            igst = totalTax;
        } else {
            cgst = totalTax / 2;
            sgst = totalTax / 2;
        }
    }
    
    const grandTotalRaw = taxable + totalTax;
    const roundOff = Math.round(grandTotalRaw) - grandTotalRaw;
    const grandTotal = Math.round(grandTotalRaw);

    return { taxable, tax: totalTax, cgst, sgst, igst, roundOff, grandTotal, isInterState };
  };

  const totals = calculateBillTotals();

  const handleGenerateBill = () => {
    if (cart.length === 0) return;
    if (!selectedCustomer) {
        alert('Please select a customer');
        return;
    }
    if (isGstBill && !selectedCustomer.gstin) {
        alert('GST Bill requires Customer GSTIN');
        return;
    }

    // Find the Sales Person in state (which includes inactive ones loaded from DB)
    const salesPerson = salesPersons.find(sp => sp.id === selectedSalesPerson);
    
    // Strict Check: Must be valid and ACTIVE
    if (!salesPerson) {
        alert('Invalid Sales Person');
        return;
    }
    if (!salesPerson.isActive) {
        alert('Selected Sales Person is not active. Please select a valid Sales Person.');
        return;
    }

    const billItems: BillItem[] = cart.map(item => ({
        productId: item.id,
        productName: item.name,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        mrp: item.mrp,
        rate: item.sellingPrice,
        amount: item.totalAmount,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate
    }));

    const newBill: Bill = {
        id: 0,
        invoiceNumber: StorageService.getNextInvoiceNumber(),
        date: new Date().toISOString(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        customerGstin: selectedCustomer.gstin,
        salesPersonId: selectedSalesPerson,
        salesPersonName: salesPerson.name,
        isGstBill,
        subTotal: totals.taxable,
        taxableAmount: totals.taxable,
        cgstAmount: totals.cgst,
        sgstAmount: totals.sgst,
        igstAmount: totals.igst,
        totalTax: totals.tax,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        items: billItems
    };

    StorageService.saveBill(newBill);
    setLastBill(newBill);
    // Clear cart
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch('');
    // Refresh products to update stock
    setProducts(StorageService.getProducts());
  };

  const InvoiceView = ({ bill }: { bill: Bill }) => {
      const settings = StorageService.getSettings();
      
      const termsList = settings.terms 
        ? settings.terms.split('\n').filter(t => t.trim() !== '') 
        : [
            'Goods once sold will not be taken back.',
            'Interest @ 18% p.a. will be charged if bill is not paid within due date.',
            'Subject to Kolkata Jurisdiction.'
          ];

      return (
          <div id="printable-area" className="p-8 bg-white text-gray-800 text-sm font-sans relative min-h-[1000px] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
                <div className="flex gap-4">
                    {settings.logo && (
                        <img src={settings.logo} alt="Logo" className="h-24 w-auto object-contain" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-green-800 uppercase tracking-wide">{settings.name}</h1>
                        <p className="font-bold text-lg text-gray-700">{settings.tagline}</p>
                        {settings.subtitle && <p className="text-sm text-gray-500 italic mb-1">{settings.subtitle}</p>}
                        
                        <div className="text-xs mt-2 space-y-0.5 text-gray-600">
                            <p className="max-w-xs"><span className="font-semibold">Office:</span> {settings.address}</p>
                            {settings.factoryAddress && (
                                <p className="max-w-xs"><span className="font-semibold">Factory:</span> {settings.factoryAddress}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1">
                                <span className="flex items-center"><Phone size={10} className="mr-1"/> {settings.phone}</span>
                                <span className="flex items-center"><Mail size={10} className="mr-1"/> {settings.email}</span>
                            </div>
                            {settings.instagram && (
                                <p className="flex items-center text-pink-600"><Instagram size={10} className="mr-1"/> {settings.instagram}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold uppercase tracking-widest text-gray-400">Tax Invoice</h2>
                    <div className="mt-4">
                        <p className="text-gray-500 text-xs uppercase">Invoice No</p>
                        <p className="font-bold text-lg">{bill.invoiceNumber}</p>
                    </div>
                    <div className="mt-2">
                        <p className="text-gray-500 text-xs uppercase">Date</p>
                        <p className="font-bold">{new Date(bill.date).toLocaleDateString()}</p>
                    </div>
                    <div className="mt-2">
                         <p className="text-gray-500 text-xs uppercase">Sales Rep</p>
                         <p className="font-bold">{bill.salesPersonName}</p>
                    </div>
                     <div className="mt-4 p-2 bg-gray-50 rounded border text-xs text-left">
                        <p><span className="font-semibold">GSTIN:</span> {settings.gstin}</p>
                        {settings.stateName && <p><span className="font-semibold">State:</span> {settings.stateName} ({settings.stateCode})</p>}
                    </div>
                </div>
            </div>

            {/* Customer & Shipping */}
            <div className="flex justify-between mb-6 bg-gray-50 p-4 rounded border border-gray-100">
                <div className="w-1/2 pr-4 border-r border-gray-200">
                    <h3 className="font-bold text-gray-600 uppercase text-xs mb-2">Billed To</h3>
                    <p className="font-bold text-lg text-gray-800">{bill.customerName}</p>
                    <p className="text-gray-700">{bill.customerPhone}</p>
                    <p className="max-w-xs text-gray-600 text-xs mt-1">{bill.customerAddress}</p>
                    {bill.customerGstin && <p className="font-mono text-xs mt-2 font-bold bg-white inline-block px-1 border">GSTIN: {bill.customerGstin}</p>}
                </div>
                {/* Bank Details */}
                <div className="w-1/2 pl-4 text-xs">
                     <h3 className="font-bold text-gray-600 uppercase text-xs mb-2">Bank Details</h3>
                     {bill.isGstBill ? (
                        <div className="space-y-1">
                            <p><span className="text-gray-500 w-16 inline-block">Bank:</span> <span className="font-semibold">{settings.gstBankName}</span></p>
                            <p><span className="text-gray-500 w-16 inline-block">A/c No:</span> <span className="font-mono font-bold">{settings.gstAccountNo}</span></p>
                            <p><span className="text-gray-500 w-16 inline-block">IFSC:</span> <span className="font-mono">{settings.gstIfsc}</span></p>
                            {settings.gstBranch && <p><span className="text-gray-500 w-16 inline-block">Branch:</span> {settings.gstBranch}</p>}
                            {settings.gstUpi && <p><span className="text-gray-500 w-16 inline-block">UPI:</span> {settings.gstUpi}</p>}
                        </div>
                     ) : (
                        <div className="space-y-1">
                            <p><span className="text-gray-500 w-16 inline-block">Bank:</span> <span className="font-semibold">{settings.nonGstBankName || 'Cash'}</span></p>
                            <p><span className="text-gray-500 w-16 inline-block">A/c No:</span> <span className="font-mono font-bold">{settings.nonGstAccountNo || '-'}</span></p>
                            {settings.nonGstIfsc && <p><span className="text-gray-500 w-16 inline-block">IFSC:</span> <span className="font-mono">{settings.nonGstIfsc}</span></p>}
                            {settings.nonGstBranch && <p><span className="text-gray-500 w-16 inline-block">Branch:</span> {settings.nonGstBranch}</p>}
                            {settings.nonGstUpi && <p><span className="text-gray-500 w-16 inline-block">UPI:</span> {settings.nonGstUpi}</p>}
                        </div>
                     )}
                </div>
            </div>

            {/* Items Table */}
            <div className="flex-1">
                <table className="w-full mb-6 border-collapse text-xs">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="py-2 px-2 text-center w-10">#</th>
                            <th className="py-2 px-2 text-left">Item Description</th>
                            <th className="py-2 px-2 text-left w-20">HSN</th>
                            <th className="py-2 px-2 text-left w-24">Batch/Exp</th>
                            <th className="py-2 px-2 text-right w-16">Qty</th>
                            <th className="py-2 px-2 text-right w-20">Rate</th>
                            <th className="py-2 px-2 text-right w-24">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bill.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-2 px-2 text-center text-gray-500">{idx + 1}</td>
                                <td className="py-2 px-2 font-medium">
                                    {item.productName}
                                </td>
                                <td className="py-2 px-2 text-gray-500">{item.hsnCode}</td>
                                <td className="py-2 px-2 text-gray-500">
                                    <div>{item.batchNumber}</div>
                                    <div>{item.expiryDate}</div>
                                </td>
                                <td className="py-2 px-2 text-right font-bold">{item.quantity}</td>
                                <td className="py-2 px-2 text-right">{item.rate.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-bold">{item.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end break-inside-avoid">
                <div className="w-2/5 space-y-2">
                    <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Taxable Amount</span>
                        <span className="font-semibold">₹{bill.taxableAmount.toFixed(2)}</span>
                    </div>
                    {bill.isGstBill && (
                        <>
                            {bill.igstAmount > 0 ? (
                                <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 text-xs">
                                    <span>IGST</span>
                                    <span>₹{bill.igstAmount.toFixed(2)}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 text-xs">
                                        <span>CGST</span>
                                        <span>₹{bill.cgstAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 text-xs">
                                        <span>SGST</span>
                                        <span>₹{bill.sgstAmount.toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                     <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600 text-xs">
                        <span>Round Off</span>
                        <span>{bill.roundOff > 0 ? '+' : ''}{bill.roundOff.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-3 bg-gray-800 text-white px-2 rounded font-bold text-lg mt-2">
                        <span>Grand Total</span>
                        <span>₹{bill.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 mb-8 break-inside-avoid">
                 <p className="text-gray-500 text-xs uppercase mb-1">Amount in Words:</p>
                 <p className="font-bold italic text-gray-800 bg-gray-50 p-2 rounded border border-gray-200">
                    {numberToWords(bill.grandTotal)}
                 </p>
            </div>
            
            <div className="pt-8 border-t-2 border-dashed border-gray-300 flex justify-between items-end text-xs text-gray-500 break-inside-avoid mt-auto">
                <div className="w-1/2 pr-4">
                    <p className="font-bold mb-1">Terms & Conditions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        {termsList.map((term, i) => (
                            <li key={i}>{term}</li>
                        ))}
                    </ul>
                </div>
                <div className="text-center w-1/3">
                    {settings.certifications && (
                        <p className="mb-4 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded inline-block">{settings.certifications}</p>
                    )}
                    <p className="mb-8 font-bold text-gray-800 text-lg uppercase">{settings.name}</p>
                    <div className="h-10"></div> {/* Sign Space */}
                    <p className="border-t border-gray-400 pt-1">Authorised Signatory</p>
                </div>
            </div>
            {settings.footerText && (
                <div className="text-center text-xs text-gray-400 mt-4 border-t pt-2">
                    {settings.footerText}
                </div>
            )}
          </div>
      )
  }

  // Filter products for autocomplete
  const filteredProducts = productSearch 
    ? products.filter(p => {
        const str = `${p.name} ${p.category} ${p.hsnCode || ''} ${p.batchNumber || ''}`;
        return searchMatch(str, productSearch);
    }) 
    : [];

  // Filter customers for autocomplete
  const filteredCustomers = customerSearch
    ? customers.filter(c => {
        const str = `${c.name} ${c.phone} ${c.email || ''} ${c.gstin || ''}`;
        return searchMatch(str, customerSearch);
    })
    : [];

  // Active Sales Persons only for dropdown
  const activeSalesPersons = salesPersons.filter(sp => sp.isActive);

  return (
    <>
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-6">
      {/* LEFT: Product Selection & Cart */}
      <div className="w-full md:w-3/5 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Search & Add */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex gap-2">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input 
                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Search Product (Name, Batch)..."
                    value={productSearch}
                    onChange={(e) => {
                        setProductSearch(e.target.value);
                        setSelectedProduct(null);
                    }}
                />
                {filteredProducts.length > 0 && !selectedProduct && (
                    <div className="absolute z-10 w-full bg-white shadow-xl max-h-60 overflow-y-auto mt-1 rounded-md border">
                        {filteredProducts.map(p => (
                            <div 
                                key={p.id} 
                                className="p-2 hover:bg-green-50 cursor-pointer border-b last:border-0"
                                onClick={() => {
                                    setSelectedProduct(p);
                                    setProductSearch(p.name);
                                }}
                            >
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-gray-500">Stock: {p.currentStock} | ₹{p.sellingPrice} | Batch: {p.batchNumber}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <input 
                type="number" 
                min="1" 
                className="w-20 px-2 border rounded-lg" 
                value={quantity} 
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
            <button 
                className="bg-green-600 text-white px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
                onClick={addToCart}
                disabled={!selectedProduct}
            >
                Add
            </button>
        </div>

        {/* Cart Table */}
        <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 z-0">
                    <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {cart.map((item, idx) => (
                        <tr key={idx}>
                            <td className="p-3">{item.name}</td>
                            <td className="p-3 text-right">₹{item.sellingPrice}</td>
                            <td className="p-3 text-center">{item.quantity}</td>
                            <td className="p-3 text-right">₹{item.totalAmount.toFixed(2)}</td>
                            <td className="p-3 text-center">
                                <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {cart.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cart is empty</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Totals Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm mb-1">
                <button 
                    onClick={clearCart} 
                    className="text-red-500 text-xs flex items-center hover:text-red-700"
                    disabled={cart.length === 0}
                >
                    <Eraser size={14} className="mr-1"/> Clear Cart
                </button>
                <div className="text-right">
                    <div className="flex justify-end items-center gap-4 text-sm mb-1">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">₹{totals.taxable.toFixed(2)}</span>
                    </div>
                    {isGstBill && (
                        <div className="flex justify-end items-center gap-4 text-sm mb-1">
                            <span className="text-gray-600">Tax {totals.igst > 0 ? '(IGST)' : '(CGST+SGST)'}:</span>
                            <span className="font-semibold text-red-600">+ ₹{totals.tax.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-end items-center gap-4 text-xl font-bold mt-2 pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-green-700">₹{totals.grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* RIGHT: Customer & Settings */}
      <div className="w-full md:w-2/5 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center"><Users size={18} className="mr-2"/> Customer Details</h3>
            
            <div className="relative mb-3">
                <input 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Search Customer (Name/Phone)..."
                    value={customerSearch}
                    onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomer(null);
                    }}
                />
                 {filteredCustomers.length > 0 && !selectedCustomer && (
                    <div className="absolute z-10 w-full bg-white shadow-xl max-h-40 overflow-y-auto mt-1 rounded-md border">
                        {filteredCustomers.map(c => (
                            <div 
                                key={c.id} 
                                className="p-2 hover:bg-green-50 cursor-pointer border-b"
                                onClick={() => {
                                    setSelectedCustomer(c);
                                    setCustomerSearch(c.name);
                                }}
                            >
                                <div className="font-medium">{c.name}</div>
                                <div className="text-xs text-gray-500">{c.phone}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedCustomer ? (
                <div className="bg-green-50 p-3 rounded-lg border border-green-100 mb-3 text-sm">
                    <div className="flex justify-between items-start">
                        <p className="font-bold">{selectedCustomer.name}</p>
                        {totals.isInterState && <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">Inter-State</span>}
                    </div>
                    <p>{selectedCustomer.phone}</p>
                    <p className="text-gray-500 truncate">{selectedCustomer.address}</p>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs text-red-500 mt-2 underline">Change</button>
                </div>
            ) : (
                <div className="text-center p-2 mb-3">
                    <button 
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="text-sm text-blue-600 underline hover:text-blue-800"
                    >
                        + Add New Customer
                    </button>
                </div>
            )}

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Sales Person *</label>
                    <select 
                        className="w-full p-2 border rounded mt-1"
                        value={selectedSalesPerson}
                        onChange={(e) => setSelectedSalesPerson(Number(e.target.value))}
                    >
                        {activeSalesPersons.map(sp => (
                            <option key={sp.id} value={sp.id}>{sp.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded border">
                    <input 
                        type="checkbox" 
                        id="gstToggle"
                        className="w-5 h-5 text-green-600 rounded"
                        checked={isGstBill}
                        onChange={(e) => setIsGstBill(e.target.checked)}
                    />
                    <label htmlFor="gstToggle" className="font-medium text-gray-700 select-none cursor-pointer">
                        Generate GST Invoice
                    </label>
                </div>
            </div>
        </div>

        <button 
            className="w-full py-4 bg-green-700 text-white text-lg font-bold rounded-xl shadow hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            onClick={handleGenerateBill}
            disabled={cart.length === 0}
        >
            <CheckCircle className="mr-2" />
            Generate Bill
        </button>
      </div>
    </div>

    {/* New Customer Modal */}
    {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-lg font-bold">Add New Customer</h3>
                    <button onClick={() => setIsCustomerModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                </div>
                <form onSubmit={handleAddNewCustomer} className="space-y-4">
                    <input required placeholder="Name *" className="w-full p-2 border rounded" value={newCustomer.name || ''} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}/>
                    <input required placeholder="Phone *" className="w-full p-2 border rounded" value={newCustomer.phone || ''} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}/>
                    <input type="email" placeholder="Email" className="w-full p-2 border rounded" value={newCustomer.email || ''} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}/>
                    <input 
                        placeholder="GSTIN (e.g. 19ABCDE1234F1Z5)" 
                        className="w-full p-2 border rounded" 
                        value={newCustomer.gstin || ''} 
                        maxLength={15}
                        onChange={e => setNewCustomer({...newCustomer, gstin: e.target.value.toUpperCase()})}
                    />
                    <textarea placeholder="Address" className="w-full p-2 border rounded h-20" value={newCustomer.address || ''} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}/>
                    
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded flex items-center">
                            <Save size={16} className="mr-2" /> Save & Select
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )}

    {/* Print Preview Modal */}
    {lastBill && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 no-print">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center">
                        <CheckCircle className="text-green-600 mr-2" size={20} />
                        Invoice Generated
                    </h3>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => window.print()} 
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Printer size={18} className="mr-2" /> Print / Save PDF
                        </button>
                        <button 
                            onClick={() => setLastBill(null)} 
                            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto bg-gray-100 p-4 md:p-8 flex justify-center">
                     <div className="shadow-lg">
                        <InvoiceView bill={lastBill} />
                     </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Billing;