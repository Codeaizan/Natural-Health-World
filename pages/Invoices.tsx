import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { Bill, CompanySettings } from '../types';
import { Eye, Download, Trash2, Search, Printer, X } from 'lucide-react';
import { numberToWords } from '../utils';
import html2pdf from 'html2pdf.js';

const Invoices: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [filterCustomer, setFilterCustomer] = useState('');
  const printableRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBills(StorageService.getBills().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setSettings(StorageService.getSettings());
  }, []);

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      bill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = !filterCustomer || bill.invoiceNumber === filterCustomer;
    return matchesSearch && matchesCustomer;
  });

  const downloadBillAsPDF = (bill: Bill) => {
    const element = document.getElementById(`bill-preview-${bill.id}`);
    if (!element || !settings) return;

    const opt = {
      margin: 5,
      filename: `${bill.invoiceNumber}.pdf`,
      image: { type: 'png', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    html2pdf().set(opt).from(element).save();
  };

  const printBill = (bill: Bill) => {
    const printWindow = window.open('', '', 'height=900,width=1000');
    if (!printWindow) return;

    const element = document.getElementById(`bill-preview-${bill.id}`);
    if (!element) return;

    printWindow.document.write(element.innerHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const deleteBill = (billId: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    
    const currentBills = StorageService.getBills();
    const updatedBills = currentBills.filter(b => b.id !== billId);
    
    // Re-save all bills except the deleted one
    updatedBills.forEach(bill => {
      const existingBill = currentBills.find(b => b.id === bill.id);
      if (existingBill) {
        StorageService.saveBill(bill);
      }
    });

    setBills(updatedBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    if (selectedBill?.id === billId) {
      setSelectedBill(null);
      setShowPreview(false);
    }
  };

  const BillPreview = ({ bill }: { bill: Bill }) => (
    <div
      id={`bill-preview-${bill.id}`}
      className="bg-white p-8 text-gray-900 font-sans"
      style={{ minHeight: '1000px' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">{settings?.name}</h1>
          <p className="text-sm text-gray-600">{settings?.tagline}</p>
          <p className="text-xs text-gray-500 mt-1">{settings?.address}</p>
          <p className="text-xs text-gray-500">GSTIN: {settings?.gstin}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">INVOICE</p>
          <p className="text-lg font-bold text-blue-600">{bill.invoiceNumber}</p>
          <p className="text-xs text-gray-600">Date: {new Date(bill.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Customer & Bill Details */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">BILL TO:</p>
          <p className="font-semibold">{bill.customerName}</p>
          <p className="text-xs text-gray-600">{bill.customerPhone}</p>
          {bill.customerAddress && <p className="text-xs text-gray-600">{bill.customerAddress}</p>}
          {bill.customerGstin && <p className="text-xs text-gray-600">GSTIN: {bill.customerGstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-700 mb-2">DETAILS:</p>
          <p className="text-xs">
            <span className="font-semibold">Sales Person:</span> {bill.salesPersonName}
          </p>
          <p className="text-xs">
            <span className="font-semibold">Tax Type:</span> {bill.isGstBill ? 'GST Bill' : 'Non-GST'}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 text-xs border-collapse">
        <thead>
          <tr className="bg-gray-200 border-b-2 border-gray-400">
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-center">HSN</th>
            <th className="p-2 text-center">Qty</th>
            <th className="p-2 text-right">Rate</th>
            <th className="p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="p-2">{item.productName}</td>
              <td className="p-2 text-center text-gray-600">{item.hsnCode || '-'}</td>
              <td className="p-2 text-center text-gray-600">{item.quantity}</td>
              <td className="p-2 text-right">₹{item.rate.toFixed(2)}</td>
              <td className="p-2 text-right font-semibold">₹{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between p-2 border-b border-gray-300">
            <span className="text-sm">Subtotal</span>
            <span className="font-semibold">₹{bill.subTotal.toFixed(2)}</span>
          </div>

          {bill.isGstBill && (
            <>
              <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                <span>CGST @ 9%</span>
                <span>₹{bill.cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                <span>SGST @ 9%</span>
                <span>₹{bill.sgstAmount.toFixed(2)}</span>
              </div>
              {bill.igstAmount > 0 && (
                <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                  <span>IGST @ 18%</span>
                  <span>₹{bill.igstAmount.toFixed(2)}</span>
                </div>
              )}
            </>
          )}

          {bill.roundOff !== 0 && (
            <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
              <span>Round Off</span>
              <span>₹{bill.roundOff.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between p-2 bg-blue-100 font-bold">
            <span>TOTAL</span>
            <span>₹{bill.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="mb-6 p-3 bg-gray-100 rounded">
        <p className="text-xs">
          <span className="font-semibold">Amount in Words:</span> {numberToWords(Math.floor(bill.grandTotal))} Rupees Only
        </p>
      </div>

      {/* Terms */}
      {settings?.terms && (
        <div className="mb-4 text-xs text-gray-600 border-t pt-3">
          <p className="font-semibold mb-1">Terms & Conditions:</p>
          <p className="whitespace-pre-wrap text-xs">{settings.terms}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 flex justify-between items-end pt-4 border-t-2">
        <div>
          <p className="text-xs text-gray-600">Authorized By:</p>
          <p className="text-xs text-gray-600 mt-6">_________________</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Customer Signature:</p>
          <p className="text-xs text-gray-600 mt-6">_________________</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-2">View, search, and download your invoices</p>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search by Invoice or Customer</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List or Preview */}
        {showPreview && selectedBill ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
            {/* Preview Header with Actions */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invoice #{selectedBill.invoiceNumber}</h2>
                <p className="text-sm text-gray-600">{new Date(selectedBill.date).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printBill(selectedBill)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print
                </button>
                <button
                  onClick={() => downloadBillAsPDF(selectedBill)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Download size={18} />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice Preview */}
            <div className="overflow-auto max-h-96 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <BillPreview bill={selectedBill} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {filteredBills.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">No invoices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Items</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Amount</th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-blue-600">{bill.invoiceNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(bill.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{bill.customerName}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600">{bill.items.length}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          ₹{bill.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedBill(bill);
                                setShowPreview(true);
                              }}
                              title="View Invoice"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => downloadBillAsPDF(bill)}
                              title="Download PDF"
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Download size={18} />
                            </button>
                            <button
                              onClick={() => printBill(bill)}
                              title="Print Invoice"
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <Printer size={18} />
                            </button>
                            <button
                              onClick={() => deleteBill(bill.id)}
                              title="Delete Invoice"
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 font-medium">Total Invoices</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{bills.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              ₹{bills.reduce((sum, b) => sum + b.grandTotal, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 font-medium">Today's Invoices</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {bills.filter(b => new Date(b.date).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
