// === IMPORTS & DEPENDENCIES ===
import React, { useState, useEffect, useMemo } from 'react'; // React hooks for component state/effects/memoization
import { StorageService } from '../services/storage'; // CRUD operations for bills/products/customers/settings
import { AuditLogService } from '../services/auditLog'; // Immutable audit trail for all exports
import { Bill, Product, CompanySettings, Customer } from '../types'; // TypeScript interfaces for domain models
import { // Lucide React icons for UI: file download, shopping/inventory visuals, date/alerts/info
  Download, ShoppingCart, Package, Users, Calendar,
  AlertCircle, CheckCircle, ChevronDown, ChevronUp, Info
} from 'lucide-react';

// === TYPE DEFINITIONS ===
// Export type union: vouchers (sales invoices), stock-items (product masters), ledgers (customer + GL accounts)
type ExportType = 'vouchers' | 'stock-items' | 'ledgers';

// === FUNCTION: generateTallyVouchersXML ===
// Purpose: Convert bill records into Tally-compatible XML format for sales invoice import
// Params: bills (Bill[] to export), settings (CompanySettings with company name/GSTIN)
// Returns: XML string with complete Tally import envelope containing all vouchers with ledger entries
const generateTallyVouchersXML = (bills: Bill[], settings: CompanySettings): string => {
  // === HELPER FUNCTION: XML Escape ===
  // Escapes XML special characters to safely embed text in XML elements
  // & → &amp;, < → &lt;, > → &gt;, " → &quot; (prevents XML parse errors)
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // === XML STRUCTURE SETUP ===
  // Standard XML declaration + Tally import envelope with header
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`; // UTF-8 encoding
  xml += `<ENVELOPE>\n`; // Root container for Tally import
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`; // Instruct Tally to import data
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`; // Begin import data section
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>Vouchers</REPORTNAME>\n`;
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`; // Set active company context in Tally
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`; // Start actual data payload

  // === LOOP: Create VOUCHER element for each bill ===
  for (const bill of bills) {
    // === DATE FORMATTING === Convert ISO date string to Tally format YYYYMMDD (no hyphens)
    // Example: "2024-12-25" → "20241225"
    const billDate = new Date(bill.date); // Parse ISO date string to Date object
    const tallyDate = `${billDate.getFullYear()}${String(billDate.getMonth() + 1).padStart(2, '0')}${String(billDate.getDate()).padStart(2, '0')}`; // Format: YYYYMMDD

    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`; // UDF = user-defined fields namespace
    xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create">\n`; // Voucher type = Sales, action = create new
    xml += `            <DATE>${tallyDate}</DATE>\n`; // Transaction date in Tally format
    xml += `            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`; // Voucher category (not purchase/journal/debit note)
    xml += `            <VOUCHERNUMBER>${escXml(bill.invoiceNumber)}</VOUCHERNUMBER>\n`; // Unique invoice ID (XML-escaped for safety)
    xml += `            <REFERENCE>${escXml(bill.invoiceNumber)}</REFERENCE>\n`; // Reference field (typically invoice number)
    xml += `            <PARTYLEDGERNAME>${escXml(bill.customerName)}</PARTYLEDGERNAME>\n`; // Customer name (must exist as Sundry Debtor ledger)
    xml += `            <NARRATION>Invoice ${escXml(bill.invoiceNumber)} - ${escXml(bill.customerName)}</NARRATION>\n`; // Memo/note on transaction
    xml += `            <ISINVOICE>Yes</ISINVOICE>\n`; // Mark as invoice (enables GST compliance features)

    // === GST PARTY DETAILS (if GST-registered bill) ===
    if (bill.isGstBill && settings.gstin) { // Only add if bill is GST-classified AND company has GSTIN
      xml += `            <BASICBUYERADDRESS.LIST>\n`; // Buyer address list (required for GST invoices)
      if (bill.customerAddress) xml += `              <BASICBUYERADDRESS>${escXml(bill.customerAddress)}</BASICBUYERADDRESS>\n`; // Customer delivery address
      xml += `            </BASICBUYERADDRESS.LIST>\n`;
      if (bill.customerGstin) xml += `            <PARTYGSTIN>${escXml(bill.customerGstin)}</PARTYGSTIN>\n`; // Buyer's GST registration number
    }

    // === LEDGER ENTRIES (Journal debit/credit pairs that balance the invoice) ===
    // Entry 1: Customer Debtor — Money owed by customer (debit to Sundry Debtors)
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>${escXml(bill.customerName)}</LEDGERNAME>\n`; // Customer account (under Sundry Debtors group)
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`; // Mark as debit/receivable increase
    xml += `              <AMOUNT>-${bill.grandTotal.toFixed(2)}</AMOUNT>\n`; // Negative = debit (customer owes us invoice total)
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // === ENTRY 2: Sales Account — Revenue recognized on sale (credit to Sales/Income) ===
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Sales Account</LEDGERNAME>\n`; // Standard revenue GL account
    xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`; // Mark as credit/income increase
    xml += `              <AMOUNT>${bill.subTotal.toFixed(2)}</AMOUNT>\n`; // Positive = credit (income flow)
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;

    // === GST ENTRIES (if GST bill) — Tax collected becomes liability to government ===
    if (bill.isGstBill) { // Only if this is a GST-classified bill
      // CGST: Central GST @ 9% (intra-state sales)
      if (bill.cgstAmount > 0) { // Only include if CGST amount exists
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>CGST</LEDGERNAME>\n`; // Central GST liability account
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`; // Mark as credit/liability increase (we owe to govt)
        xml += `              <AMOUNT>${bill.cgstAmount.toFixed(2)}</AMOUNT>\n`; // Positive = credit (liability collected)
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
      // SGST: State GST @ 9% (intra-state sales)
      if (bill.sgstAmount > 0) { // Only include if SGST amount exists
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>SGST</LEDGERNAME>\n`; // State GST liability account
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`; // Mark as credit/liability increase
        xml += `              <AMOUNT>${bill.sgstAmount.toFixed(2)}</AMOUNT>\n`; // Positive = credit (liability)
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
      // IGST: Integrated GST @ 18% (inter-state sales only)
      if (bill.igstAmount > 0) { // Only include if IGST amount exists (inter-state)
        xml += `            <ALLLEDGERENTRIES.LIST>\n`;
        xml += `              <LEDGERNAME>IGST</LEDGERNAME>\n`; // Integrated GST (inter-state) liability
        xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`; // Mark as credit/liability increase
        xml += `              <AMOUNT>${bill.igstAmount.toFixed(2)}</AMOUNT>\n`; // Positive = credit (liability)
        xml += `            </ALLLEDGERENTRIES.LIST>\n`;
      }
    }

    // === ROUND-OFF ENTRY (if needed) — Penny rounding to perfectly balance transaction ===
    // Example: Invoice total = 1000.01, round to 1000.00 → need -0.01 entry to balance
    if (bill.roundOff !== 0) { // Only add if round-off is non-zero
      xml += `            <ALLLEDGERENTRIES.LIST>\n`;
      xml += `              <LEDGERNAME>Round Off</LEDGERNAME>\n`; // System GL account for rounding differences
      xml += `              <ISDEEMEDPOSITIVE>${bill.roundOff < 0 ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>\n`; // If negative = debit, positive = credit
      xml += `              <AMOUNT>${(-bill.roundOff).toFixed(2)}</AMOUNT>\n`; // Negate round-off to balance (if bill.roundOff=-0.01, amount=+0.01)
      xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    }

    // === INVENTORY ENTRIES (Physical goods tracked with rates) ===
    // Each line item becomes an inventory entry linking to Sales Account GL
    for (const item of bill.items) { // Loop through each product line in bill
      const lineAmount = (item.discountedAmount ?? item.amount).toFixed(2); // Use discounted amt if available, else full
      xml += `            <ALLINVENTORYENTRIES.LIST>\n`;
      xml += `              <STOCKITEMNAME>${escXml(item.productName)}</STOCKITEMNAME>\n`; // Stock item master name reference
      xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`; // Inventory dec = credit (stock out)
      xml += `              <RATE>${item.rate.toFixed(2)}/Nos</RATE>\n`; // Sale rate per unit (unit=Nos for qty-tracked)
      xml += `              <AMOUNT>${lineAmount}</AMOUNT>\n`; // Line value after discount (qty × rate × (1-discount%))
      xml += `              <ACTUALQTY>${item.quantity} Nos</ACTUALQTY>\n`; // Physical qty delivered to customer
      xml += `              <BILLEDQTY>${item.quantity} Nos</BILLEDQTY>\n`; // Qty charged on invoice
      if (item.discount && item.discount > 0) { // Only include discount if non-zero %
        xml += `              <DISCOUNT>${item.discount.toFixed(2)}%</DISCOUNT>\n`; // Line-level discount %
      }
      // === ACCOUNTING ALLOCATION === Links inventory entry to GL account
      xml += `              <ACCOUNTINGALLOCATIONS.LIST>\n`;
      xml += `                <LEDGERNAME>Sales Account</LEDGERNAME>\n`; // This item's revenue goes to Sales GL
      xml += `                <AMOUNT>${lineAmount}</AMOUNT>\n`; // Amount to allocate (matches line amount)
      xml += `              </ACCOUNTINGALLOCATIONS.LIST>\n`;
      xml += `            </ALLINVENTORYENTRIES.LIST>\n`;
    }

    xml += `          </VOUCHER>\n`; // Close voucher element
    xml += `        </TALLYMESSAGE>\n`; // Close message wrapper
  }

  // === CLOSE XML STRUCTURE ===
  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml; // Return complete XML string ready for Tally import
};

const generateTallyStockItemsXML = (products: Product[], settings: CompanySettings): string => {
  // === HELPER FUNCTION: XML Escape ===
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // === XML STRUCTURE SETUP ===
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`; // UTF-8 encoding
  xml += `<ENVELOPE>\n`; // Root container for Tally import
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`; // Instruct Tally to import data
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`; // Begin import data section
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>All Masters</REPORTNAME>\n`; // Report type = master data (stock items)
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`; // Set active company context
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`; // Start data payload

  // === SECTION 1: Create Stock Groups (Categories) ===
  // Stock Groups organize products by category in Tally's hierarchy
  const categories = [...new Set(products.map(p => p.category))]; // Extract unique categories from products
  for (const cat of categories) { // Loop through each category
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <STOCKGROUP NAME="${escXml(cat)}" ACTION="Create">\n`; // Create new stock group with category name
    xml += `            <NAME.LIST><NAME>${escXml(cat)}</NAME></NAME.LIST>\n`; // Name list contains single name
    xml += `            <PARENT>Primary</PARENT>\n`; // Parent group = Primary (Tally standard hierarchy)
    xml += `          </STOCKGROUP>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  // === SECTION 2: Create Stock Items (Products) ===
  // Each product becomes a stock item master in Tally with opening balance/value/rate
  for (const p of products) { // Loop through all products
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <STOCKITEM NAME="${escXml(p.name)}" ACTION="Create">\n`; // Create new stock item with product name
    xml += `            <NAME.LIST><NAME>${escXml(p.name)}</NAME></NAME.LIST>\n`; // Name list
    xml += `            <PARENT>${escXml(p.category)}</PARENT>\n`; // Parent stock group (the category created above)
    
    // === UNIT SETUP ===
    xml += `            <BASEUNITS>${escXml(p.unit || 'Nos')}</BASEUNITS>\n`; // Base unit of measure (Nos=Number if not specified)
    
    // === OPENING BALANCE SETUP ===
    // Opening balance = inventory at import time (initializes stock in Tally)
    xml += `            <OPENINGBALANCE>${p.currentStock} ${escXml(p.unit || 'Nos')}</OPENINGBALANCE>\n`; // Current qty in our DB
    
    // === OPENING VALUE & RATE ===
    // Value-at-opening for inventory GL account = quantity × purchase price
    xml += `            <OPENINGVALUE>${(p.purchasePrice * p.currentStock).toFixed(2)}</OPENINGVALUE>\n`; // Total cost = qty × unit cost
    xml += `            <OPENINGRATE>${p.purchasePrice.toFixed(2)}/${escXml(p.unit || 'Nos')}</OPENINGRATE>\n`; // Cost per unit for valuation
    
    // === OPTIONAL FIELDS ===
    if (p.hsnCode) xml += `            <HSNCODE>${escXml(p.hsnCode)}</HSNCODE>\n`; // HSN/SAC code for tax classification (if exists)
    if (p.gstRate > 0) xml += `            <GSTRATE>${p.gstRate}</GSTRATE>\n`; // GST rate % for this product (if taxable)
    
    xml += `          </STOCKITEM>\n`; // Close stock item
    xml += `        </TALLYMESSAGE>\n`; // Close message wrapper
  }

  // === CLOSE XML STRUCTURE ===
  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml; // Return complete master data XML
};

// === FUNCTION: generateTallyLedgersXML ===
// Purpose: Create customer ledgers and system GL accounts needed for transaction entries
// Params: customers (Customer[] to export), settings (CompanySettings with company name)
// Returns: XML string with ledger masters for import into Tally
const generateTallyLedgersXML = (customers: Customer[], settings: CompanySettings): string => {
  // === HELPER FUNCTION: XML Escape ===
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // === XML STRUCTURE SETUP ===
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`; // UTF-8 encoding
  xml += `<ENVELOPE>\n`; // Root container for Tally import
  xml += `  <HEADER>\n`;
  xml += `    <TALLYREQUEST>Import Data</TALLYREQUEST>\n`; // Instruct Tally to import data
  xml += `  </HEADER>\n`;
  xml += `  <BODY>\n`;
  xml += `    <IMPORTDATA>\n`; // Begin import data section
  xml += `      <REQUESTDESC>\n`;
  xml += `        <REPORTNAME>All Masters</REPORTNAME>\n`; // Report type = ledger masters
  xml += `        <STATICVARIABLES>\n`;
  xml += `          <SVCURRENTCOMPANY>${escXml(settings.name)}</SVCURRENTCOMPANY>\n`; // Set active company context
  xml += `        </STATICVARIABLES>\n`;
  xml += `      </REQUESTDESC>\n`;
  xml += `      <REQUESTDATA>\n`; // Start data payload

  // === SECTION 1: Create Customer Ledgers (under Sundry Debtors) ===
  // Each customer becomes a ledger account under the Sundry Debtors group (receivables)
  for (const c of customers) { // Loop through each customer
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <LEDGER NAME="${escXml(c.name)}" ACTION="Create">\n`; // Create new ledger with customer name
    xml += `            <NAME.LIST><NAME>${escXml(c.name)}</NAME></NAME.LIST>\n`; // Name list
    xml += `            <PARENT>Sundry Debtors</PARENT>\n`; // Parent group = Sundry Debtors (receivables group in Tally)
    
    // === OPTIONAL CUSTOMER DETAILS ===
    if (c.address) xml += `            <ADDRESS.LIST><ADDRESS>${escXml(c.address)}</ADDRESS></ADDRESS.LIST>\n`; // Customer delivery address
    if (c.gstin) xml += `            <PARTYGSTIN>${escXml(c.gstin)}</PARTYGSTIN>\n`; // Customer GST registration number (for GST invoices)
    if (c.phone) xml += `            <LEDGERPHONE>${escXml(c.phone)}</LEDGERPHONE>\n`; // Customer phone number
    if (c.email) xml += `            <LEDGEREMAIL>${escXml(c.email)}</LEDGEREMAIL>\n`; // Customer email address
    
    xml += `          </LEDGER>\n`; // Close ledger
    xml += `        </TALLYMESSAGE>\n`; // Close message wrapper
  }

  // === SECTION 2: Create System GL Accounts ===
  // Standard ledgers required for transactions (Sales, GST accounts, Rounding)
  // These must exist as GL masters before vouchers can reference them
  const standardLedgers = [ // Array of system ledgers to create
    { name: 'Sales Account', parent: 'Sales Accounts', taxType: '' }, // Revenue GL (Primary account type)
    { name: 'CGST', parent: 'Duties & Taxes', taxType: 'CGST' }, // Central GST liability (9% intra-state)
    { name: 'SGST', parent: 'Duties & Taxes', taxType: 'SGST' }, // State GST liability (9% intra-state)
    { name: 'IGST', parent: 'Duties & Taxes', taxType: 'IGST' }, // Integrated GST liability (18% inter-state)
    { name: 'Round Off', parent: 'Indirect Expenses', taxType: '' }, // Rounding adjustment account
  ];

  for (const ledger of standardLedgers) { // Create each standard ledger
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <LEDGER NAME="${escXml(ledger.name)}" ACTION="Create">\n`; // Create ledger with system name
    xml += `            <NAME.LIST><NAME>${escXml(ledger.name)}</NAME></NAME.LIST>\n`; // Name list
    xml += `            <PARENT>${escXml(ledger.parent)}</PARENT>\n`; // Parent GL group (Sales Accounts, Duties & Taxes, etc.)
    if (ledger.taxType) xml += `            <TAXTYPE>${escXml(ledger.taxType)}</TAXTYPE>\n`; // Tax type for GST ledgers (if applicable)
    xml += `          </LEDGER>\n`; // Close ledger
    xml += `        </TALLYMESSAGE>\n`; // Close message wrapper
  }

  // === CLOSE XML STRUCTURE ===
  xml += `      </REQUESTDATA>\n`;
  xml += `    </IMPORTDATA>\n`;
  xml += `  </BODY>\n`;
  xml += `</ENVELOPE>`;
  return xml; // Return complete ledger masters XML
};

// === REACT COMPONENT: TallyExport ===
// Purpose: Main page for exporting sales data to Tally accounting software
// Allows user to export invoices, products, and customers as XML for seamless integration
const TallyExport: React.FC = () => {
  // === STATE: Data from Database ===
  const [bills, setBills] = useState<Bill[]>([]); // All sales invoices in system
  const [products, setProducts] = useState<Product[]>([]); // All product masters
  const [customers, setCustomers] = useState<Customer[]>([]); // All customer records
  const [settings, setSettings] = useState<CompanySettings | null>(null); // Company settings (name, GSTIN, etc.)
  const [loading, setLoading] = useState(true); // Page loading state (show spinner while fetching data)

  // === STATE: Export Configuration ===
  const [exportType, setExportType] = useState<ExportType>('vouchers'); // Which data type to export (vouchers/stock-items/ledgers)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' }); // Start/end dates for bill filtering
  const [exporting, setExporting] = useState(false); // In-progress flag (disable buttons during export)
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null); // Result message (success or error)
  const [showPreview, setShowPreview] = useState(false); // Show/hide XML preview panel

  // === LIFECYCLE: Load Data on Mount ===
  useEffect(() => {
    loadData(); // Fetch all database records when component mounts
  }, []);

  // === HANDLER: Load Data from Database ===
  // Fetches bills, products, customers, settings from storage in parallel
  const loadData = async () => {
    try {
      // Load all 4 data types in parallel for performance
      const [b, p, c, s] = await Promise.all([
        StorageService.getBills(), // Fetch all invoices
        StorageService.getProducts(), // Fetch all products
        StorageService.getCustomers(), // Fetch all customers
        StorageService.getSettings(), // Fetch company settings
      ]);
      // Update state with fetched data
      setBills(b);
      setProducts(p);
      setCustomers(c);
      setSettings(s);
    } catch (err) {
      console.error('Failed to load data for Tally export:', err); // Log errors to console
    } finally {
      setLoading(false); // Stop loading spinner regardless of success/failure
    }
  };

  // === MEMOIZED: Filtered Bills (for Date Range) ===
  // Memoized to avoid recalculating on every render
  // Returns bills filtered by start/end date (empty dates = no filter)
  const filteredBills = useMemo(() => {
    let filtered = bills; // Start with all bills
    if (dateRange.start) { // If start date specified, filter bills >= start date
      filtered = filtered.filter(b => b.date >= dateRange.start);
    }
    if (dateRange.end) { // If end date specified, filter bills <= end date
      filtered = filtered.filter(b => b.date <= dateRange.end);
    }
    return filtered; // Return filtered array
  }, [bills, dateRange]); // Recalculate if bills or dateRange changes

  // === FUNCTION: Generate XML Based on Export Type ===
  // Calls appropriate XML generator function (vouchers/stock-items/ledgers)
  const generateXML = (): string => {
    if (!settings) return ''; // Return empty if settings not loaded
    switch (exportType) { // Switch on export type
      case 'vouchers': return generateTallyVouchersXML(filteredBills, settings); // Generate sales vouchers XML
      case 'stock-items': return generateTallyStockItemsXML(products, settings); // Generate stock items XML
      case 'ledgers': return generateTallyLedgersXML(customers, settings); // Generate ledgers XML
      default: return ''; // Default: return empty
    }
  };

  // === MEMOIZED: XML Preview (First 3000 chars) ===
  // Memoized to avoid regenerating XML on every render
  // Truncates to 3000 characters to keep DOM lightweight
  const previewXML = useMemo(() => {
    if (!showPreview || !settings) return ''; // Return empty if preview hidden or settings not loaded
    const xml = generateXML(); // Generate full XML
    // Return first 3000 chars with truncation indicator if longer
    return xml.length > 3000 ? xml.slice(0, 3000) + '\n\n... (truncated)' : xml;
  }, [showPreview, exportType, filteredBills, products, customers, settings]); // Recalc if any of these change

  // === HANDLER: Export XML to File ===
  // Generates XML and saves to disk (Tauri) or browser download (fallback)
  const handleExport = async () => {
    if (!settings) return; // Guard: exit if settings not loaded
    setExporting(true); // Show loading state (disable export button)
    setExportResult(null); // Clear previous result message

    try {
      const xml = generateXML(); // Generate XML string based on current export type
      
      // Define filename based on export type + current date (YYYY-MM-DD)
      const fileNames: Record<ExportType, string> = {
        vouchers: `tally_vouchers_${new Date().toISOString().split('T')[0]}.xml`, // Example: tally_vouchers_2024-12-25.xml
        'stock-items': `tally_stock_items_${new Date().toISOString().split('T')[0]}.xml`,
        ledgers: `tally_ledgers_${new Date().toISOString().split('T')[0]}.xml`,
      };

      try {
        // === TAURI PATH === Try to save using Tauri (desktop app)
        const { save } = await import('@tauri-apps/plugin-dialog'); // Import Tauri save dialog
        const { writeTextFile } = await import('@tauri-apps/plugin-fs'); // Import Tauri file write
        
        // Open file save dialog with suggested filename and XML filter
        const filePath = await save({
          defaultPath: fileNames[exportType], // Suggested filename
          filters: [{ name: 'XML Files', extensions: ['xml'] }], // Only XML files shown
        });
        
        if (filePath) { // If user selected a path (not cancelled)
          await writeTextFile(filePath, xml); // Write XML string to file
          setExportResult({ success: true, message: `File saved to: ${filePath}` }); // Show success message
          AuditLogService.log('export', 'Tally Export', `Exported ${exportType} as Tally XML`); // Log audit trail
        }
      } catch {
        // === FALLBACK === If Tauri fails (e.g., in browser), use browser download
        const blob = new Blob([xml], { type: 'application/xml' }); // Create XML blob
        const url = URL.createObjectURL(blob); // Create object URL (browser memory reference)
        const link = document.createElement('a'); // Create anchor element
        link.href = url; // Set href to blob URL
        link.download = fileNames[exportType]; // Set download filename
        document.body.appendChild(link); // Add link to DOM (required for click to work)
        link.click(); // Trigger download
        document.body.removeChild(link); // Clean up link from DOM
        URL.revokeObjectURL(url); // Free up blob memory
        setExportResult({ success: true, message: 'File downloaded to your browser downloads folder' }); // Show success
        AuditLogService.log('export', 'Tally Export', `Exported ${exportType} as Tally XML (browser)`); // Log with (browser) flag
      }
    } catch (err: any) {
      // If anything fails, show error message
      setExportResult({ success: false, message: err.message || 'Export failed' });
    } finally {
      setExporting(false); // Stop loading state (re-enable export button)
    }
  };

  // === DATA: Export Type Selection Cards ===
  // Array of card definitions for export type selector buttons
  const exportCards: { type: ExportType; icon: React.ElementType; title: string; desc: string; count: number }[] = [
    {
      type: 'vouchers', // Export type identifier
      icon: ShoppingCart, // Lucide icon component
      title: 'Sales Vouchers', // Display title
      desc: 'Export invoices/bills as Tally Sales vouchers', // Description text
      count: filteredBills.length, // Record count (filtered bills)
    },
    {
      type: 'stock-items',
      icon: Package,
      title: 'Stock Items',
      desc: 'Export products as Tally stock items with opening balances',
      count: products.length, // Total products
    },
    {
      type: 'ledgers',
      icon: Users,
      title: 'Ledger Masters',
      desc: 'Export customers + standard GST ledgers to Tally',
      count: customers.length + 5, // Customers + 5 system ledgers (Sales, CGST, SGST, IGST, Round Off)
    },
  ];

  // === RENDER: Loading State ===
  if (loading) { // Show loading spinner while data is being fetched
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading data...</div>
      </div>
    );
  }

  // === RENDER: Main UI ===
  return (
    <div className="space-y-6"> {/* Container with vertical spacing between sections */}
      {/* === INFO BANNER === Explains Tally integration and import order */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" /> {/* Info icon */}
        <div>
          <p className="text-sm font-medium text-blue-800">Tally Integration</p> {/* Title */}
          <p className="text-xs text-blue-600 mt-0.5"> {/* Description */}
            Export your data in Tally-compatible XML format. Import the generated files into Tally Prime or Tally ERP 9
            via <strong>Gateway of Tally &gt; Import Data</strong>. Export ledgers first, then stock items, then vouchers for best results.
          </p>
        </div>
      </div>

      {/* === EXPORT TYPE SELECTION === 3-card grid showing data types to export */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> {/* Responsive grid: 1 col on mobile, 3 on desktop */}
        {exportCards.map(({ type, icon: Icon, title, desc, count }) => (
          <button
            key={type} // React list key
            onClick={() => { // On click: select this export type and clear previous result
              setExportType(type);
              setExportResult(null);
            }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${ // Border changes color based on selection
              exportType === type
                ? 'border-green-500 bg-green-50' // Active: green border + green background
                : 'border-gray-200 bg-white hover:border-gray-300' // Inactive: gray border + white background
            }`}
          >
            {/* Card header: icon + title + count */}
            <div className="flex items-center gap-3 mb-2">
              {/* Icon container with background */}
              <div className={`p-2 rounded-lg ${ // Icon background color based on selection
                exportType === type
                  ? 'bg-green-100 text-green-700' // Active: green background
                  : 'bg-gray-100 text-gray-500' // Inactive: gray background
              }`}>
                <Icon size={20} /> {/* Lucide icon component */}
              </div>
              {/* Title and count */}
              <div>
                <p className={`font-semibold text-sm ${ // Title color based on selection
                  exportType === type
                    ? 'text-green-700' // Active: green text
                    : 'text-gray-700' // Inactive: gray text
                }`}>{title}</p>
                <p className="text-xs text-gray-400">{count} records</p> {/* Record count in smaller text */}
              </div>
            </div>
            {/* Card description */}
            <p className="text-xs text-gray-500">{desc}</p>
          </button>
        ))}
      </div>

      {/* === DATE RANGE FILTER === Only shown when "vouchers" export type selected */}
      {exportType === 'vouchers' && (
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Calendar size={16} /> Date Range Filter {/* Calendar icon + label */}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {/* Start date input */}
            <input
              type="date" // HTML5 date picker
              value={dateRange.start} // Current start date value
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} // Update start date
              className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm"
            />
            {/* "to" label */}
            <span className="text-gray-400 text-sm">to</span>
            {/* End date input */}
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} // Update end date
              className="px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm"
            />
            {/* Count: X of Y invoices selected */}
            <span className="text-xs text-gray-400">
              {filteredBills.length} of {bills.length} invoices selected
            </span>
          </div>
        </div>
      )}

      {/* === EXPORT ACTIONS === Summary, preview button, export button */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Export summary and details */}
          <div>
            {/* Ready to export message with selected type */}
            <p className="text-sm font-medium text-gray-700">
              Ready to export: <span className="font-bold capitalize">{exportType.replace('-', ' ')}</span> {/* Replace hyphen with space for display */}
            </p>
            {/* Conditional details based on export type */}
            <p className="text-xs text-gray-400 mt-0.5">
              {exportType === 'vouchers' && `${filteredBills.length} sales vouchers will be exported`} {/* Vouchers: filtered bill count */}
              {exportType === 'stock-items' && `${products.length} stock items across ${new Set(products.map(p => p.category)).size} categories`} {/* Stock: product + category count */}
              {exportType === 'ledgers' && `${customers.length} customer ledgers + 5 standard GST/system ledgers`} {/* Ledgers: customer + 5 system ledgers */}
            </p>
          </div>
          {/* Right: Action buttons (preview + export) */}
          <div className="flex items-center gap-2">
            {/* PREVIEW BUTTON: Toggle XML preview panel */}
            <button
              onClick={() => setShowPreview(!showPreview)} // Toggle preview visibility
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50"
            >
              {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {/* Chevron changes direction */}
              Preview XML
            </button>
            {/* EXPORT BUTTON: Start export process */}
            <button
              onClick={handleExport} // Call export handler
              disabled={exporting} // Disable while exporting
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export XML'} {/* Show loading text during export */}
            </button>
          </div>
        </div>

        {/* === EXPORT RESULT MESSAGE === Shows after export completes (success or error) */}
        {exportResult && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${ // Color based on success/failure
            exportResult.success
              ? 'bg-green-50 text-green-700 border border-green-200' // Success: green box
              : 'bg-red-50 text-red-700 border border-red-200' // Error: red box
          }`}>
            {exportResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {/* Circle icon based on result */}
            {exportResult.message} {/* Success/error message text */}
          </div>
        )}

        {/* === XML PREVIEW === Collapsible section showing first 3000 chars of XML */}
        {showPreview && (
          <div className="mt-3">
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed">
              {previewXML || 'No data to preview'} {/* Show preview or empty state */}
            </pre>
          </div>
        )}
      </div>

      {/* === IMPORT INSTRUCTIONS === 5-step guide for importing in Tally */}
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <p className="text-sm font-semibold text-gray-700 mb-3">How to Import in Tally</p> {/* Section title */}
        <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside"> {/* Numbered list */}
          <li><strong>Step 1:</strong> Export <em>Ledger Masters</em> first — this creates Customer ledgers and GST duty ledgers in Tally.</li> {/* Step 1: Ledgers */}
          <li><strong>Step 2:</strong> Export <em>Stock Items</em> — this creates product masters under their categories with opening balances.</li> {/* Step 2: Stock */}
          <li><strong>Step 3:</strong> Export <em>Sales Vouchers</em> — this creates the actual sales transactions referencing the above masters.</li> {/* Step 3: Vouchers */}
          <li><strong>Step 4:</strong> In Tally Prime, go to <strong>Gateway → Import Data → XML (via path)</strong>. Select each file and import in order.</li> {/* Step 4: Import in Tally UI */}
          <li><strong>Note:</strong> If a ledger or stock item already exists in Tally, the import will merge/update rather than duplicate.</li> {/* Note: Merge behavior */}
        </ol>
      </div>
    </div>
  );
};

export default TallyExport; {/* Export component as default */}
