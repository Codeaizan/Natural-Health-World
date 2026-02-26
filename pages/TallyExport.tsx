import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { AuditLogService } from '../services/auditLog';
import { useTheme } from '../services/theme';
import { Bill, Product, CompanySettings, Customer } from '../types';
import {
  Download, ShoppingCart, Package, Users, Calendar,
  AlertCircle, CheckCircle, ChevronDown, ChevronUp, Info
} from 'lucide-react';

type ExportType = 'vouchers' | 'stock-items' | 'ledgers';

const generateTallyVouchersXML = (bills: Bill[], settings: CompanySettings): string => {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ENVELOPE>\n`;
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`;
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`;
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`;

  for (const bill of bills) {
    const billDate = new Date(bill.date);
    const tallyDate = `${billDate.getFullYear()}${String(billDate.getMonth() + 1).padStart(2, '0')}${String(billDate.getDate()).padStart(2, '0')}`;

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create">\n`;
    xml += `            <DATE>${tallyDate}</DATE>\n`;
    xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
    xml += `            <VOUCHERNUMBER>${escXml(bill.invoiceNumber)}</VOUCHERNUMBER>\n`;
    xml += `            <REFERENCE>${escXml(bill.invoiceNumber)}</REFERENCE>\n`;
    xml += `            <PARTYLEDGERNAME>${escXml(bill.customerName)}</PARTYLEDGERNAME>\n`;
    xml += `            <NARRATION>Invoice ${escXml(bill.invoiceNumber)} - ${escXml(bill.customerName)}</NARRATION>\n`;
    xml += `            <ISINVOICE>Yes</ISINVOICE>\n`;

    if (bill.isGstBill && settings.gstin) {
      xml += `            <BASICBUYERADDRESS.LIST>\n`;
      if (bill.customerAddress) xml += `              <BASICBUYERADDRESS>${escXml(bill.customerAddress)}</BASICBUYERADDRESS>\n`;
      xml += `            </BASICBUYERADDRESS.LIST>\n`;
      if (bill.customerGstin) xml += `            <PARTYGSTIN>${escXml(bill.customerGstin)}</PARTYGSTIN>\n`;
    }

    // Party (Debtor) ledger entry
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>${escXml(bill.customerName)}</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>-${bill.grandTotal.toFixed(2)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // Sales ledger entry
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Sales Account</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>${bill.subTotal.toFixed(2)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // GST entries
    if (bill.isGstBill) {
      if (bill.cgstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>CGST</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${bill.cgstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
      if (bill.sgstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>SGST</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${bill.sgstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
      if (bill.igstAmount > 0) {
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>IGST</LEDGERNAME>\n`;
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `              <AMOUNT>${bill.igstAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
    }

    // Round-off
    if (bill.roundOff !== 0) {
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Round Off</LEDGERNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>${bill.roundOff < 0 ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>\n`;
      xml += `              <AMOUNT>${(-bill.roundOff).toFixed(2)}</AMOUNT>\n`;
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // Inventory entries for each line item
    for (const item of bill.items) {
      const lineAmount = (item.discountedAmount ?? item.amount).toFixed(2);
      xml += `            <ALLINVENTORYENTRIES.LIST>\n`;
      xml += `              <STOCKITEMNAME>${escXml(item.productName)}</STOCKITEMNAME>\n`;
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
      xml += `              <RATE>${item.rate.toFixed(2)}/Nos</RATE>\n`;
      xml += `              <AMOUNT>${lineAmount}</AMOUNT>\n`;
      xml += `              <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>\n`;
      xml += `              <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>\n`;
      if (item.discount && item.discount > 0) {
        xml += `              <DISCOUNT>${item.discount.toFixed(2)}%</DISCOUNT>\n`;
      }
      xml += `              <ACCOUNTINGALLOCATIONS.LIST>\n`;
      xml += `                <LEDGERNAME>Sales Account</LEDGERNAME>\n`;
      xml += `                <AMOUNT>${lineAmount}</AMOUNT>\n`;
      xml += `              </ACCOUNTINGALLOCATIONS.LIST>\n`;
      xml += `            </ALLINVENTORYENTRIES.LIST>\n`;
    }

    xml += `          </VOUCHER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml;
};

const generateTallyStockItemsXML = (products: Product[], settings: CompanySettings): string => {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ENVELOPE>\n`;
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`;
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>All Masters</REPORTNAME>\n`;
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`;
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`;

  // Stock Groups by category
  const categories = [...new Set(products.map(p => p.category))];
  for (const cat of categories) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <STOCKGROUP NAME="${escXml(cat)}" ACTION="Create">\n`;
    xml += `            <NAME.LIST><NAME>${escXml(cat)}</NAME></NAME.LIST>\n`;
    xml += `            <PARENT>Primary</PARENT>\n`;
    xml += `          </STOCKGROUP>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  // Stock Items
  for (const p of products) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <STOCKITEM NAME="${escXml(p.name)}" ACTION="Create">\n`;
    xml += `            <NAME.LIST><NAME>${escXml(p.name)}</NAME></NAME.LIST>\n`;
    xml += `            <PARENT>${escXml(p.category)}</PARENT>\n`;
    xml += `            <BASEUNITS>${escXml(p.unit || 'Nos')}</BASEUNITS>\n`;
    xml += `            <OPENINGBALANCE>${p.currentStock} ${escXml(p.unit || 'Nos')}</OPENINGBALANCE>\n`;
    xml += `            <OPENINGVALUE>${(p.purchasePrice * p.currentStock).toFixed(2)}</OPENINGVALUE>\n`;
    xml += `            <OPENINGRATE>${p.purchasePrice.toFixed(2)}/${escXml(p.unit || 'Nos')}</OPENINGRATE>\n`;
    if (p.hsnCode) xml += `            <HSNCODE>${escXml(p.hsnCode)}</HSNCODE>\n`;
    if (p.gstRate > 0) xml += `            <GSTRATE>${p.gstRate}</GSTRATE>\n`;
    xml += `          </STOCKITEM>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml;
};

const generateTallyLedgersXML = (customers: Customer[], settings: CompanySettings): string => {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<ENVELOPE>\n`;
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`;
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>All Masters</REPORTNAME>\n`;
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`;
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`;

  // Sundry Debtors group — customers
  for (const c of customers) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <LEDGER NAME="${escXml(c.name)}" ACTION="Create">\n`;
    xml += `            <NAME.LIST><NAME>${escXml(c.name)}</NAME></NAME.LIST>\n`;
    xml += `            <PARENT>Sundry Debtors</PARENT>\n`;
    if (c.address) xml += `            <ADDRESS.LIST><ADDRESS>${escXml(c.address)}</ADDRESS></ADDRESS.LIST>\n`;
    if (c.gstin) xml += `            <PARTYGSTIN>${escXml(c.gstin)}</PARTYGSTIN>\n`;
    if (c.phone) xml += `            <LEDGERPHONE>${escXml(c.phone)}</LEDGERPHONE>\n`;
    if (c.email) xml += `            <LEDGEREMAIL>${escXml(c.email)}</LEDGEREMAIL>\n`;
    xml += `          </LEDGER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  // Standard ledgers needed for transactions
  const standardLedgers = [
    { name: 'Sales Account', parent: 'Sales Accounts', taxType: '' },
    { name: 'CGST', parent: 'Duties & Taxes', taxType: 'CGST' },
    { name: 'SGST', parent: 'Duties & Taxes', taxType: 'SGST' },
    { name: 'IGST', parent: 'Duties & Taxes', taxType: 'IGST' },
    { name: 'Round Off', parent: 'Indirect Expenses', taxType: '' },
  ];

  for (const ledger of standardLedgers) {
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <LEDGER NAME="${escXml(ledger.name)}" ACTION="Create">\n`;
    xml += `            <NAME.LIST><NAME>${escXml(ledger.name)}</NAME></NAME.LIST>\n`;
    xml += `            <PARENT>${escXml(ledger.parent)}</PARENT>\n`;
    if (ledger.taxType) xml += `            <TAXTYPE>${escXml(ledger.taxType)}</TAXTYPE>\n`;
    xml += `          </LEDGER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml;
};

const TallyExport: React.FC = () => {
  useTheme();
  const [bills, setBills] = useState<Bill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [exportType, setExportType] = useState<ExportType>('vouchers');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [b, p, c, s] = await Promise.all([
        StorageService.getBills(),
        StorageService.getProducts(),
        StorageService.getCustomers(),
        StorageService.getSettings(),
      ]);
      setBills(b);
      setProducts(p);
      setCustomers(c);
      setSettings(s);
    } catch (err) {
      console.error('Failed to load data for Tally export:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = useMemo(() => {
    let filtered = bills;
    if (dateRange.start) {
      filtered = filtered.filter(b => b.date >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(b => b.date <= dateRange.end);
    }
    return filtered;
  }, [bills, dateRange]);

  const generateXML = (): string => {
    if (!settings) return '';
    switch (exportType) {
      case 'vouchers': return generateTallyVouchersXML(filteredBills, settings);
      case 'stock-items': return generateTallyStockItemsXML(products, settings);
      case 'ledgers': return generateTallyLedgersXML(customers, settings);
      default: return '';
    }
  };

  const previewXML = useMemo(() => {
    if (!showPreview || !settings) return '';
    const xml = generateXML();
    // Return first 3000 chars for preview
    return xml.length > 3000 ? xml.slice(0, 3000) + '\n\n... (truncated)' : xml;
  }, [showPreview, exportType, filteredBills, products, customers, settings]);

  const handleExport = async () => {
    if (!settings) return;
    setExporting(true);
    setExportResult(null);

    try {
      const xml = generateXML();
      const fileNames: Record<ExportType, string> = {
        vouchers: `tally_vouchers_${new Date().toISOString().split('T')[0]}.xml`,
        'stock-items': `tally_stock_items_${new Date().toISOString().split('T')[0]}.xml`,
        ledgers: `tally_ledgers_${new Date().toISOString().split('T')[0]}.xml`,
      };

      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const filePath = await save({
          defaultPath: fileNames[exportType],
          filters: [{ name: 'XML Files', extensions: ['xml'] }],
        });
        if (filePath) {
          await writeTextFile(filePath, xml);
          setExportResult({ success: true, message: `File saved to: ${filePath}` });
          AuditLogService.log('export', 'Tally Export', `Exported ${exportType} as Tally XML`);
        }
      } catch {
        // Fallback: browser download
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileNames[exportType];
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setExportResult({ success: true, message: 'File downloaded to your browser downloads folder' });
        AuditLogService.log('export', 'Tally Export', `Exported ${exportType} as Tally XML (browser)`);
      }
    } catch (err: any) {
      setExportResult({ success: false, message: err.message || 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const exportCards: { type: ExportType; icon: React.ElementType; title: string; desc: string; count: number }[] = [
    {
      type: 'vouchers',
      icon: ShoppingCart,
      title: 'Sales Vouchers',
      desc: 'Export invoices/bills as Tally Sales vouchers',
      count: filteredBills.length,
    },
    {
      type: 'stock-items',
      icon: Package,
      title: 'Stock Items',
      desc: 'Export products as Tally stock items with opening balances',
      count: products.length,
    },
    {
      type: 'ledgers',
      icon: Users,
      title: 'Ledger Masters',
      desc: 'Export customers + standard GST ledgers to Tally',
      count: customers.length + 5, // +5 standard ledgers
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 dark:text-gray-500">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Tally Integration</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Export your data in Tally-compatible XML format. Import the generated files into Tally Prime or Tally ERP 9
            via <strong>Gateway of Tally &gt; Import Data</strong>. Export ledgers first, then stock items, then vouchers for best results.
          </p>
        </div>
      </div>

      {/* Export Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exportCards.map(({ type, icon: Icon, title, desc, count }) => (
          <button
            key={type}
            onClick={() => { setExportType(type); setExportResult(null); }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              exportType === type
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                exportType === type
                  ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                <Icon size={20} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${
                  exportType === type
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-700 dark:text-gray-200'
                }`}>{title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{count} records</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
          </button>
        ))}
      </div>

      {/* Date Range Filter for Vouchers */}
      {exportType === 'vouchers' && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Calendar size={16} /> Date Range Filter
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {filteredBills.length} of {bills.length} invoices selected
            </span>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ready to export: <span className="font-bold capitalize">{exportType.replace('-', ' ')}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {exportType === 'vouchers' && `${filteredBills.length} sales vouchers will be exported`}
              {exportType === 'stock-items' && `${products.length} stock items across ${new Set(products.map(p => p.category)).size} categories`}
              {exportType === 'ledgers' && `${customers.length} customer ledgers + 5 standard GST/system ledgers`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Preview XML
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export XML'}
            </button>
          </div>
        </div>

        {/* Export Result */}
        {exportResult && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
            exportResult.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {exportResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {exportResult.message}
          </div>
        )}

        {/* XML Preview */}
        {showPreview && (
          <div className="mt-3">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed">
              {previewXML || 'No data to preview'}
            </pre>
          </div>
        )}
      </div>

      {/* Import Instructions */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">How to Import in Tally</p>
        <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-2 list-decimal list-inside">
          <li><strong>Step 1:</strong> Export <em>Ledger Masters</em> first — this creates Customer ledgers and GST duty ledgers in Tally.</li>
          <li><strong>Step 2:</strong> Export <em>Stock Items</em> — this creates product masters under their categories with opening balances.</li>
          <li><strong>Step 3:</strong> Export <em>Sales Vouchers</em> — this creates the actual sales transactions referencing the above masters.</li>
          <li><strong>Step 4:</strong> In Tally Prime, go to <strong>Gateway → Import Data → XML (via path)</strong>. Select each file and import in order.</li>
          <li><strong>Note:</strong> If a ledger or stock item already exists in Tally, the import will merge/update rather than duplicate.</li>
        </ol>
      </div>
    </div>
  );
};

export default TallyExport;
