import React, { useEffect, useState } from 'react';                            // React hooks
import { useToast } from '../components/Toast';                                 // Toast notifications
import { StorageService } from '../services/storage';                           // Database access
import { Bill, CompanySettings } from '../types';                              // Type definitions
import { Eye, Download, Trash2, Search, Printer, X } from 'lucide-react';     // Icons
import { numberToWords, generateInvoiceHTML } from '../utils';                  // Utility functions
import { generateInvoicePDF, generateInvoicePDFBlob } from '../services/pdfGenerator'; // PDF generation
import { TableSkeleton } from '../components/Skeleton';                         // Skeleton loader
import EmptyState from '../components/EmptyState';                             // Empty state component

const Invoices: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);                             // All invoices/bills
  const [settings, setSettings] = useState<CompanySettings | null>(null);    // Company settings
  const [searchTerm, setSearchTerm] = useState('');                           // Search filter
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);       // Selected bill for preview
  const [showPreview, setShowPreview] = useState(false);                      // Show/hide preview modal
  const [loading, setLoading] = useState(true);                              // Loading state
  const toast = useToast();                                                   // Toast system

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

  // Utility to make a safe filename from invoice number
  const getInvoiceFilename = (invoiceNumber: string) =>
    invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '-');

  // === HANDLER: Generate PDF & download or save invoice ===
  const downloadBillAsPDF = async (bill: Bill) => {
    if (!settings) return;
    try {
      try {
        // === TAURI PATH: Use native save dialog ===
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { getInvoicesPath } = await import('../services/dataPath');

        // Get custom invoices directory path
        const invoicesDir = await getInvoicesPath();
        // Create safe filename from invoice number (remove special chars)
        const safeInvoiceNo = getInvoiceFilename(bill.invoiceNumber);
        const defaultPath = invoicesDir
          ? `${invoicesDir}\\${safeInvoiceNo}.pdf`
          : `${safeInvoiceNo}.pdf`;

        // Show OS native save dialog
        const filePath = await save({
          defaultPath,
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });

        // Write file if user confirmed save dialog
        if (filePath) {
          const pdfBytes = generateInvoicePDF(bill, settings);
          await writeFile(filePath, pdfBytes);
          toast.success('Invoice Saved', filePath);
        }
      } catch {
        // === FALLBACK: Browser download (if Tauri dialogs fail) ===
        // Fallback: browser download
        const blob = generateInvoicePDFBlob(bill, settings);
        const url = URL.createObjectURL(blob);
        // Create safe filename from invoice number
        const safeInvoiceNo = getInvoiceFilename(bill.invoiceNumber);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeInvoiceNo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Invoice Downloaded', 'Saved to your browser downloads folder.');
      }
    } catch (err) {
      console.error('PDF download failed:', err);
      toast.error('Download Failed', 'Failed to generate invoice PDF. Please try again.');
    }
  };

  // === HANDLER: Open invoice in print dialog window ===
  const printBill = (bill: Bill) => {
    if (!settings) return;

    // Print the same HTML that is displayed in the bill preview.
    // This ensures WYSIWYG — what you see in the preview is what gets printed.
    try {
      // Generate invoice HTML rendering
      const invoiceHTML = generateInvoiceHTML(bill, settings);

      // Open new window for printing (must be allowed by browser)
      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      if (!printWindow) {
        toast.error('Print Failed', 'Pop-up blocked. Please allow pop-ups and try again.');
        return;
      }

      // Write HTML document with print styles
      printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${bill.invoiceNumber}</title>
  <style>
    {/* A4 page sizing and margins for printing */}
    @page {
      size: A4;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 10mm;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      {/* Preserve exact colors during print */}
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  {/* Insert invoice HTML content */}
  ${invoiceHTML}
  <script>
    {/* Close window after printing completed */}
    window.onafterprint = function() { window.close(); };
    {/* Fire print dialog after brief delay for page rendering */}
    setTimeout(function() { window.print(); }, 300);
  </script>
</body>
</html>`);
      printWindow.document.close();
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Print Failed', 'Could not generate the invoice for printing.');
    }
  };

  // === HANDLER: Delete invoice and restore product stock ===
  const deleteBill = async (billId: number) => {
    // Show confirmation dialog with danger flag (red styling)
    const confirmed = await toast.confirm({
      title: 'Delete Invoice',
      message: 'Are you sure you want to delete this invoice? Stock will be restored.',
      confirmText: 'Delete',
      danger: true
    });
    if (!confirmed) return;
    
    // Delete bill from database and restore stock quantities
    await StorageService.deleteBill(billId);
    
    // Refresh bills list from database, sorted by date (newest first)
    const updatedBills = await StorageService.getBills();
    setBills(updatedBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    // Clear preview if deleted bill was selected
    if (selectedBill?.id === billId) {
      setSelectedBill(null);
      setShowPreview(false);
    }
  };

  // === COMPONENT: Invoice preview renderer ===
  // Renders invoice HTML safely inside a div (dangerouslySetInnerHTML used here because HTML is generated by pdfGenerator which is trusted)
  const BillPreview = ({ bill }: { bill: Bill }) => {
    if (!settings) return null;
    // Generate invoice HTML from bill and settings
    const html = generateInvoiceHTML(bill, settings);
    return (
      <div
        id={`bill-preview-${bill.id}`}
        className="bg-white p-6 text-gray-900 font-sans"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* === PAGE HEADER === */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-2">View, search, and download your invoices</p>
        </div>

        {/* === SEARCH SECTION === Filter invoices by invoice number or customer name */}
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

        {/* === INVOICES LIST OR PREVIEW === Conditional rendering based on preview state */}
        {showPreview && selectedBill ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
            {/* === PREVIEW HEADER WITH ACTIONS === Print, download, close buttons */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invoice #{selectedBill.invoiceNumber}</h2>
                <p className="text-sm text-gray-600">{new Date(selectedBill.date).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                {/* Print button - opens print dialog */}
                <button
                  onClick={() => printBill(selectedBill)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print
                </button>
                {/* Download PDF button */}
                <button
                  onClick={() => downloadBillAsPDF(selectedBill)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Download size={18} />
                  Download PDF
                </button>
                {/* Close preview button */}
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* === INVOICE PREVIEW === Scrollable invoice HTML rendering */}
            <div className="overflow-auto max-h-96 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <BillPreview bill={selectedBill} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            {/* === EMPTY STATE OR INVOICES TABLE === */}
            {filteredBills.length === 0 ? (
              <EmptyState type="invoices" title="No invoices found" description={searchTerm ? 'Try a different search term' : 'Create your first bill to see invoices here'} />
            ) : (
              <div className="overflow-x-auto">
                {/* === INVOICES TABLE === Sortable list of all invoices */}
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
                    {/* === TABLE ROWS === Map each bill to a row with view/download/print/delete actions */}
                    {filteredBills.map((bill, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        {/* Invoice number (blue, clickable) */}
                        <td className="px-6 py-4 font-semibold text-blue-600">{bill.invoiceNumber}</td>
                        {/* Invoice date (formatted) */}
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(bill.date).toLocaleDateString()}
                        </td>
                        {/* Customer name */}
                        <td className="px-6 py-4 text-sm text-gray-900">{bill.customerName}</td>
                        {/* Item count */}
                        <td className="px-6 py-4 text-center text-sm text-gray-600">{bill.items.length}</td>
                        {/* Grand total in INR (formatted with thousands separator) */}
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          ₹{bill.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        {/* === ACTION BUTTONS === View/Download/Print/Delete with hover colors */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {/* View invoice preview button */}
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
                            {/* Download PDF button */}
                            <button
                              onClick={() => downloadBillAsPDF(bill)}
                              title="Download PDF"
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Download size={18} />
                            </button>
                            {/* Print invoice button */}
                            <button
                              onClick={() => printBill(bill)}
                              title="Print Invoice"
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <Printer size={18} />
                            </button>
                            {/* Delete invoice button (red color) */}
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

        {/* === STATS SECTION === KPI cards showing invoice count, revenue, today's count */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Total invoices count */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 font-medium">Total Invoices</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{bills.length}</p>
          </div>
          {/* Total revenue from all invoices (sum of grandTotal) */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              ₹{bills.reduce((sum, b) => sum + b.grandTotal, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          {/* Count of invoices created today */}
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

// === EXPORT === React component for invoice viewer/management
export default Invoices;
