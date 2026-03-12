// Export interface for company settings configuration containing basic company info
export interface CompanySettings {
  // Company/organization name
  name: string;
  // Company tagline or motto
  tagline: string;
  // Optional subtitle describing the company
  subtitle?: string;
  // Optional certifications the company holds
  certifications?: string;
  // Primary company address for billing
  address: string;
  // Optional factory address if different from primary address
  factoryAddress?: string;
  // Contact phone number for the company
  phone: string;
  // Email address for the company
  email: string;
  // Optional website URL for the company
  website?: string;
  // Optional Instagram handle for social media
  instagram?: string;
  // Optional company logo image
  logo?: string;
  
  // GST Configuration - GST (Goods and Services Tax) registration details
  // GST Identification Number 
  gstin: string;
  // Optional PAN (Permanent Account Number)
  panNumber?: string;
  // Optional state name where company is registered
  stateName?: string;
  // Optional state code for GST registration
  stateCode?: string;

  // GST Bank Details - Bank account used for GST billable transactions
  // Bank name for GST account
  gstBankName: string;
  // Account number for GST bank account
  gstAccountNo: string;
  // IFSC code for GST bank account for fund transfers
  gstIfsc: string;
  // Optional branch name for GST bank account
  gstBranch?: string;
  // Optional UPI ID for GST bank account
  gstUpi?: string;

  // Non-GST Bank Details - Bank account used for non-GST cash transactions
  // Bank name for non-GST account
  nonGstBankName: string;
  // Account number for non-GST bank account
  nonGstAccountNo: string;
  // IFSC code for non-GST bank account
  nonGstIfsc: string;
  // Optional branch name for non-GST bank account
  nonGstBranch?: string;
  // Optional UPI ID for non-GST bank account
  nonGstUpi?: string;

  // Invoice Settings - Configuration for invoice generation
  // Prefix for GST invoice numbering (e.g., 'NH')
  invoicePrefix: string;
  // Optional starting number for GST invoice sequence
  invoiceStartNumber?: number;
  // Prefix for non-GST invoice numbering (e.g., 'NHW')
  nonGstInvoicePrefix?: string;
  // Optional starting number for non-GST invoice sequence
  nonGstInvoiceStartNumber?: number;
  // Optional footer text to appear on invoices
  footerText?: string;
  // Optional terms and conditions text for invoices
  terms?: string;
}

// Export interface for user accounts with authentication details
export interface User {
  // Username for login authentication
  username: string;
  // Password stored as a hash for security
  passwordHash: string; // Stored as hash
  // Role determining user permissions (admin has full access, user has limited access)
  role: 'admin' | 'user';
  // Optional timestamp of last login
  lastLogin?: string;
}

// Export interface for backup records tracking
export interface BackupRecord {
  // Unique identifier for the backup
  id: string;
  // ISO timestamp when the backup was created
  timestamp: string;
  // Type of backup (automatic or manual)
  type: 'auto' | 'manual';
  // Size of the backup in bytes
  size: number;
  // Backup data serialized as a string
  data: string;
}

// Export interface for product inventory items
export interface Product {
  // Unique product identifier
  id: number;
  // Product name or title
  name: string;
  // Product category for organization
  category: string;
  // HSN Code (Harmonized System of Nomenclature) for tax classification
  hsnCode: string;
  // Unit of measurement (e.g., 'bottle', 'box', 'kg')
  unit: string;
  // Optional package size information
  packageSize?: string;
  // Optional batch number for tracking
  batchNumber?: string;
  // Optional expiry date in YYYY-MM format
  expiryDate?: string;
  // Maximum Retail Price
  mrp: number;
  // Discount percentage to apply
  discountPercent: number;
  // Selling price after discount
  sellingPrice: number;
  // Cost price for purchase accounting
  purchasePrice: number;
  // GST rate percentage applicable to product
  gstRate: number;
  // Current stock quantity in inventory
  currentStock: number;
  // Minimum stock level threshold for reordering
  minStockLevel: number;
}

// Export interface for customer information
export interface Customer {
  // Unique customer identifier
  id: number;
  // Customer name or business name
  name: string;
  // Contact phone number
  phone: string;
  // Optional email address
  email?: string;
  // Optional customer address
  address?: string;
  // Optional GST identification number if registered
  gstin?: string;
}

// Export interface for salesperson records
export interface SalesPerson {
  // Unique salesperson identifier
  id: number;
  // Salesperson name
  name: string;
  // Flag indicating if salesperson is active or inactive
  isActive: boolean;
}

// Export interface for individual items in a bill
export interface BillItem {
  // ID of the product being billed
  productId: number;
  // Name of the product for display on bill
  productName: string;
  // Optional HSN code for the product
  hsnCode?: string;
  // Quantity of product in this bill item
  quantity: number;
  // Maximum Retail Price at time of sale
  mrp: number;
  // Actual rate charged for the product
  rate: number;
  // Total amount (rate × quantity)
  amount: number;
  // Optional discount percentage applied during billing
  discount?: number; // Discount in % applied during billing
  // Optional amount after discount is applied
  discountedAmount?: number; // Amount after discount
  // GST rate (%) applicable to this product (stored per-item for accurate tax apportionment)
  gstRate?: number;
  // Optional batch number for tracking
  batchNumber?: string;
  // Optional expiry date of the product
  expiryDate?: string;
}

// Export interface for complete bill/invoice information
export interface Bill {
  // Unique bill identifier
  id: number;
  // Invoice number for reference and tracking
  invoiceNumber: string;
  // Date the invoice was created in ISO format
  date: string;
  // ID of the customer making the purchase
  customerId: number;
  // Name of the customer
  customerName: string;
  // Contact phone of the customer
  customerPhone: string;
  // Optional address of the customer
  customerAddress?: string;
  // Optional GST ID of the customer
  customerGstin?: string;
  // ID of the salesperson handling the transaction
  salesPersonId: number;
  // Name of the salesperson
  salesPersonName: string;
  // Flag indicating if this is a GST-taxed bill (true) or cash bill (false)
  isGstBill: boolean;
  // Total amount before tax
  subTotal: number;
  // Taxable amount for GST calculation
  taxableAmount: number;
  // Central GST amount collected
  cgstAmount: number;
  // State GST amount collected
  sgstAmount: number;
  // Integrated GST amount collected (used for interstate sales)
  igstAmount: number; // Added IGST
  // Total tax amount (CGST + SGST + IGST)
  totalTax: number;
  // Rounding adjustment for final amount
  roundOff: number;
  // Final total amount including all taxes
  grandTotal: number;
  // Array of items included in this bill
  items: BillItem[];
}

// Export interface for shopping cart items (extends Product interface)
export interface CartItem extends Product {
  // Quantity of this item in cart
  quantity: number;
  // Total amount for this item (quantity × price)
  totalAmount: number;
  // Optional discount percentage applied during billing
  discount?: number; // Discount % applied during billing
  // Optional amount after discount is applied
  discountedAmount?: number; // Amount after discount
  // Optional expiry date override for this specific bill
  expiryDate?: string; // Overridable expiry date for this bill
}

// Export interface for tracking stock movements
export interface StockHistory {
  // Unique record identifier
  id: number;
  // ISO timestamp of the stock transaction
  timestamp: string;
  // ID of the product affected
  productId: number;
  // Name of the product for reference
  productName: string;
  // Change amount (positive for addition, negative for removal)
  changeAmount: number; // positive for add, negative for remove
  // Reason for stock change (e.g., 'sale', 'purchase', 'damage', 'return')
  reason: string;
  // Optional reference ID (e.g., invoice ID, PO ID)
  referenceId?: string;
}

// Tax & Compliance Interfaces - Interfaces for GST and tax compliance tracking
// Export interface for individual GST item details
export interface GSTItem {
  // Invoice number containing this item
  invoiceNumber: string;
  // Invoice date
  date: string;
  // Name of the customer
  customerName: string;
  // Optional GST ID of the customer
  customerGstin?: string;
  // HSN code for product classification
  hsnCode: string;
  // Quantity of product sold
  quantity: number;
  // Taxable value of the item for GST
  taxableValue: number;
  // Tax rate percentage applicable
  taxRate: number;
  // Tax amount calculated
  taxAmount: number;
  // Description of the item
  itemDescription: string;
}

// Export interface for GSTR1 filing data (outward supplies)
export interface GSTR1Data {
  // Month for the filing period (1-12)
  month: number;
  // Year for the filing period
  year: number;
  // Optional date when filing was submitted
  filingDate?: string;
  // Array of GST items for outward supplies
  gstItems: GSTItem[];
  // Total taxable value of all items
  totalTaxableValue: number;
  // Total tax amount of all items
  totalTaxAmount: number;
  // Status of the filing (draft, submitted, or amended)
  status: 'draft' | 'filed' | 'amended';
}

// Export interface for GSTR2 filing data (inward supplies)
export interface GSTR2Data {
  // Month for the filing period (1-12)
  month: number;
  // Year for the filing period
  year: number;
  // Optional date when filing was submitted
  filingDate?: string;
  // Array of GST items for inward supplies (purchases)
  purchaseItems: GSTItem[];
  // Total taxable value of all purchases
  totalTaxableValue: number;
  // Total tax amount on all purchases
  totalTaxAmount: number;
  // Status of the filing
  status: 'draft' | 'filed' | 'amended';
}

// Export interface for tax adjustments
export interface TaxAdjustment {
  // Unique adjustment identifier
  id: string;
  // Date of the tax adjustment
  date: string;
  // Type of tax adjustment (TDS, TCS, etc.)
  type: 'tds' | 'tcs' | 'excise' | 'advance_tax' | 'deferred';
  // Adjustment amount in rupees
  amount: number;
  // Description of the adjustment
  description: string;
  // Optional reference number for tracking
  referenceNumber?: string;
}

// Export interface for audit log entries
export interface TaxAuditLog {
  // Unique log entry identifier
  id: string;
  // ISO timestamp of the action
  timestamp: string;
  // Description of the action performed
  action: string;
  // Optional ID of the user who performed the action
  userId?: string;
  // Detailed information about the action
  details: string;
  // Optional ID of the bill affected by this action
  affectedBillId?: number;
  // Tax impact of this action
  taxImpact: number;
}

// Export interface for compliance alerts and notifications
export interface ComplianceAlert {
  // Unique alert identifier
  id: string;
  // Type of alert (filing due, reconciliation needed, etc.)
  type: 'filing_due' | 'reconciliation_needed' | 'threshold_breach' | 'compliance_reminder';
  // Severity level of the alert
  severity: 'info' | 'warning' | 'critical';
  // Alert title
  title: string;
  // Detailed description of the alert
  description: string;
  // Optional due date for the alert
  dueDate?: string;
  // Status of the alert (active, dismissed, or resolved)
  status: 'active' | 'dismissed' | 'resolved';
  // Date when the alert was created
  createdDate: string;
}

// Export interface for tax reconciliation between filings
export interface TaxReconciliation {
  // Month of reconciliation (1-12)
  month: number;
  // Year of reconciliation
  year: number;
  // Total taxable value from GSTR1 filings
  gstr1TaxableValue: number;
  // Total tax amount from GSTR1 filings
  gstr1TaxAmount: number;
  // Total taxable value from GSTR2 filings
  gstr2TaxableValue: number;
  // Total tax amount from GSTR2 filings
  gstr2TaxAmount: number;
  // Amount received through IRR (Input Refund Request)
  irrReceivedAmount: number;
  // Amount filed in IRR
  irrFiledAmount: number;
  // Discrepancy between filings
  discrepancy: number;
  // Discrepancy as a percentage
  discrepancyPercent: number;
  // Status of reconciliation (reconciled, pending, or needs review)
  status: 'reconciled' | 'pending' | 'needs_review';
  // Optional notes about the reconciliation
  notes?: string;
}

// Export interface for monthly tax summary
export interface TaxSummary {
  // Month of the summary (1-12)
  month: number;
  // Year of the summary
  year: number;
  // Central GST collected in the month
  cgstCollected: number;
  // State GST collected in the month
  sgstCollected: number;
  // Integrated GST collected in the month
  igstCollected: number;
  // Total GST collected (CGST + SGST + IGST)
  totalGstCollected: number;
  // CGST liability for the month
  cgstLiability: number;
  // SGST liability for the month
  sgstLiability: number;
  // IGST liability for the month
  igstLiability: number;
  // Total GST liability for the month
  totalGstLiability: number;
  // Adjustments from TDS (Tax Deducted at Source)
  tdsAdjustments: number;
  // Net tax liability after adjustments
  netTaxLiability: number;
}

// Advanced Reporting & Analytics Interfaces - Interfaces for business intelligence

// Export interface for generic report rows with hierarchical structure
export interface ReportRow {
  // Label or name of the row
  label: string;
  // Numeric value for this row
  value: number;
  // Optional percentage value relative to total
  percentage?: number;
  // Optional sub-rows for hierarchical data
  subRows?: ReportRow[];
}

// Export interface for profit and loss statement
export interface ProfitLossStatement {
  // Period covered by this statement (e.g., 'January 2024' or 'Q1 2024')
  period: string;
  // Total revenue or sales amount
  revenue: number;
  // Cost of goods sold
  costOfGoodsSold: number;
  // Gross profit (revenue - COGS)
  grossProfit: number;
  // Gross profit as a percentage of revenue
  grossProfitMargin: number;
  // Operating expenses (rent, salaries, utilities, etc.)
  operatingExpenses: number;
  // Operating profit (gross profit - operating expenses)
  operatingProfit: number;
  // Operating profit as a percentage of revenue
  operatingMargin: number;
  // Tax expense for the period
  taxExpense: number;
  // Net profit after all expenses and taxes
  netProfit: number;
  // Net profit as a percentage of revenue
  netProfitMargin: number;
}

// Export interface for cash flow statement
export interface CashFlowStatement {
  // Period covered by this statement
  period: string;
  // Cash flow from operating activities
  operatingCashFlow: number;
  // Cash flow from investing activities
  investingCashFlow: number;
  // Cash flow from financing activities
  financingCashFlow: number;
  // Net cash flow for the period
  netCashFlow: number;
  // Cash balance at the beginning of the period
  beginningCash: number;
  // Cash balance at the end of the period
  endingCash: number;
}

// Export interface for inventory valuation using different methods
export interface InventoryValuation {
  // Product identifier
  productId: number;
  // Product name
  productName: string;
  // Quantity in stock
  quantity: number;
  // Cost per unit using FIFO (First In First Out) method
  fifoCost: number;
  // Total inventory value using FIFO method
  fifoValue: number;
  // Cost per unit using LIFO (Last In First Out) method
  lifoCost: number;
  // Total inventory value using LIFO method
  lifoValue: number;
  // Cost per unit using weighted average method
  weightedAvgCost: number;
  // Total inventory value using weighted average method
  weightedAvgValue: number;
  // Valuation method used (FIFO, LIFO, or weighted average)
  method: 'fifo' | 'lifo' | 'weighted_avg';
}

// Export interface for year-over-year comparison
export interface YearOverYearComparison {
  // Metric name being compared
  metric: string;
  // Value for the first year in comparison
  year1: number;
  // Value for the second year in comparison
  year2: number;
  // Absolute change between years
  change: number;
  // Percentage change between years
  changePercent: number;
  // Trend direction (up, down, or stable)
  trend: 'up' | 'down' | 'stable';
}

// Export interface for custom report definitions
export interface CustomReport {
  // Unique report identifier
  id: string;
  // Name of the custom report
  name: string;
  // Optional description of the report
  description?: string;
  // Type of report (sales, inventory, customer, product, or custom)
  type: 'sales' | 'inventory' | 'customer' | 'product' | 'custom';
  // Array of metric names to display in the report
  displayMetrics: string[];
  // Date range type for the report
  dateRange: 'month' | 'quarter' | 'year' | 'custom';
  // Optional start date for custom date ranges
  startDate?: string;
  // Optional end date for custom date ranges
  endDate?: string;
  // Optional grouping dimension for data aggregation
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'customer';
  // Optional filter conditions as key-value pairs
  filters?: Record<string, any>;
  // Optional field to sort results by
  sortBy?: string;
  // Date when the report was created
  createdDate: string;
  // Date when the report was last modified
  lastModified: string;
}

// Export interface for analytics metrics
export interface AnalyticsMetric {
  // Label or name of the metric
  label: string;
  // Current value of the metric
  value: number;
  // Optional previous value for comparison
  previousValue?: number;
  // Optional percentage change from previous value
  changePercent?: number;
  // Optional trend direction (up, down, or stable)
  trend?: 'up' | 'down' | 'stable';
  // Optional unit of measurement (e.g., '₹', '%', 'units')
  unit?: string;
}