import React, { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { StorageService } from '../services/storage';
import { Bill, CompanySettings } from '../types';
import { Eye, Download, Trash2, Search, Printer, X } from 'lucide-react';
import { numberToWords } from '../utils';
import html2pdf from 'html2pdf.js';
import { TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const Invoices: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const loadData = async () => {
      const billsData = await StorageService.getBills();
      const settingsData = await StorageService.getSettings();
      setBills(billsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setSettings(settingsData);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      bill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const downloadBillAsPDF = async (bill: Bill) => {
    if (!settings) return;

    // Try to find the element in the DOM; if not rendered, create a temporary one
    let element = document.getElementById(`bill-preview-${bill.id}`);
    let tempContainer: HTMLDivElement | null = null;

    if (!element) {
      // Create an off-screen container so html2pdf can render the bill
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '210mm';
      tempContainer.id = `bill-preview-temp-${bill.id}`;
      document.body.appendChild(tempContainer);

      // Import ReactDOM to render the bill preview into the temp container
      const ReactDOM = await import('react-dom/client');
      const root = ReactDOM.createRoot(tempContainer);
      root.render(<BillPreview bill={bill} />);
      // Wait for React to flush the render — poll until content appears (max 2s)
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (tempContainer!.innerHTML.length > 100 || attempts >= 20) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(check, 100);
      });
      element = tempContainer;

      // Store root ref for cleanup
      (tempContainer as any).__reactRoot = root;
    }

    try {
      const opt = {
        margin: 5,
        filename: `${bill.invoiceNumber}.pdf`,
        image: { type: 'png', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
      };

      // Strip oklch() colors that html2pdf/html2canvas can't parse
      const stripOklch = (el: HTMLElement) => {
        el.querySelectorAll('*').forEach(node => {
          const s = (node as HTMLElement).style;
          if (s) {
            const cs = getComputedStyle(node as HTMLElement);
            if (cs.color?.includes('oklch')) s.color = '#1f2937';
            if (cs.backgroundColor?.includes('oklch')) s.backgroundColor = 'transparent';
            if (cs.borderColor?.includes('oklch')) s.borderColor = '#e5e7eb';
          }
        });
      };
      stripOklch(element);

      // Generate PDF as blob
      const pdfBlob: Blob = await html2pdf().set(opt).from(element).outputPdf('blob');
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      try {
        // Use Tauri native save dialog
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { getInvoicesPath } = await import('../services/dataPath');

        const invoicesDir = await getInvoicesPath();
        const defaultPath = invoicesDir
          ? `${invoicesDir}\\${bill.invoiceNumber}.pdf`
          : `${bill.invoiceNumber}.pdf`;

        const filePath = await save({
          defaultPath,
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });

        if (filePath) {
          await writeFile(filePath, pdfBytes);
          toast.success('Invoice Saved', filePath);
        }
      } catch {
        // Fallback: browser download
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${bill.invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Invoice Downloaded', 'Saved to your browser downloads folder.');
      }
    } catch (err) {
      console.error('PDF download failed:', err);
      toast.error('Download Failed', 'Failed to generate invoice PDF. Please try again.');
    } finally {
      // Clean up temporary container if we created one
      if (tempContainer) {
        // Unmount React root to prevent memory leak
        const root = (tempContainer as any).__reactRoot;
        if (root) root.unmount();
        if (tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      }
    }
  };

  const printBill = (bill: Bill) => {
    const printWindow = window.open('', '', 'height=900,width=1000');
    if (!printWindow) return;

    const element = document.getElementById(`bill-preview-${bill.id}`);
    if (!element) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${bill.invoiceNumber}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fff; padding: 24px; }
  .invoice-wrap { max-width: 800px; margin: 0 auto; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .justify-end { justify-content: flex-end; }
  .items-start { align-items: flex-start; }
  .items-end { align-items: flex-end; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .text-3xl { font-size: 1.875rem; }
  .text-2xl { font-size: 1.5rem; }
  .text-lg { font-size: 1.125rem; }
  .text-sm { font-size: 0.875rem; }
  .text-xs { font-size: 0.75rem; }
  .text-gray-900 { color: #111827; }
  .text-gray-700 { color: #374151; }
  .text-gray-600 { color: #4b5563; }
  .text-gray-500 { color: #6b7280; }
  .text-gray-400 { color: #9ca3af; }
  .text-blue-600 { color: #2563eb; }
  .bg-white { background-color: #fff; }
  .bg-gray-100 { background-color: #f3f4f6; }
  .bg-gray-200 { background-color: #e5e7eb; }
  .bg-blue-100 { background-color: #dbeafe; }
  .border-b { border-bottom: 1px solid #e5e7eb; }
  .border-b-2 { border-bottom: 2px solid #9ca3af; }
  .border-t { border-top: 1px solid #e5e7eb; }
  .border-t-2 { border-top: 2px solid #e5e7eb; }
  .mb-1 { margin-bottom: 0.25rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mt-1 { margin-top: 0.25rem; }
  .mt-6 { margin-top: 1.5rem; }
  .mt-12 { margin-top: 3rem; }
  .p-2 { padding: 0.5rem; }
  .p-3 { padding: 0.75rem; }
  .p-8 { padding: 2rem; }
  .pb-4 { padding-bottom: 1rem; }
  .pt-3 { padding-top: 0.75rem; }
  .pt-4 { padding-top: 1rem; }
  .rounded { border-radius: 0.25rem; }
  .w-72 { width: 18rem; }
  .w-full { width: 100%; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .gap-6 { gap: 1.5rem; }
  .whitespace-pre-wrap { white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.75rem; }
  th { padding: 0.5rem; background: #e5e7eb; border-bottom: 2px solid #9ca3af; }
  td { padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
  .totals-row { display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #d1d5db; font-size: 0.875rem; }
  .totals-grand { display: flex; justify-content: space-between; padding: 0.5rem; background: #dbeafe; font-weight: 700; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
  .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
  .footer { margin-top: 3rem; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 1rem; border-top: 2px solid #e5e7eb; }
  @media print { body { padding: 0; } @page { margin: 15mm; } }
</style>
</head>
<body>
${element.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const deleteBill = async (billId: number) => {
    const confirmed = await toast.confirm({
      title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice? Stock will be restored.',
      confirmText: 'Delete',
      danger: true
    });
    if (!confirmed) return;
    
    await StorageService.deleteBill(billId);
    
    // Refresh from database
    const updatedBills = await StorageService.getBills();
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
            <th className="p-2 text-right">Disc%</th>
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
              <td className="p-2 text-right text-gray-600">{item.discount ? `${item.discount}%` : '-'}</td>
              <td className="p-2 text-right font-semibold">₹{(item.discountedAmount || item.amount).toFixed(2)}</td>
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
              {bill.igstAmount > 0 ? (
                <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                  <span>IGST</span>
                  <span>₹{bill.igstAmount.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                    <span>CGST</span>
                    <span>₹{bill.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2 border-b border-gray-300 text-sm">
                    <span>SGST</span>
                    <span>₹{bill.sgstAmount.toFixed(2)}</span>
                  </div>
                </>
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
          <span className="font-semibold">Amount in Words:</span> {numberToWords(bill.grandTotal)}
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
              <EmptyState type="invoices" title="No invoices found" description={searchTerm ? 'Try a different search term' : 'Create your first bill to see invoices here'} />
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
