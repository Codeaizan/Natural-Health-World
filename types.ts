export interface CompanySettings {
  name: string;
  tagline: string;
  subtitle?: string;
  certifications?: string;
  address: string;
  factoryAddress?: string;
  phone: string;
  email: string;
  website?: string;
  instagram?: string;
  logo?: string;
  
  // GST Config
  gstin: string;
  stateName?: string;
  stateCode?: string;

  // GST Bank
  gstBankName: string;
  gstAccountNo: string;
  gstIfsc: string;
  gstBranch?: string;
  gstUpi?: string;

  // Non-GST Bank
  nonGstBankName: string;
  nonGstAccountNo: string;
  nonGstIfsc: string;
  nonGstBranch?: string;
  nonGstUpi?: string;

  // Invoice Settings
  invoicePrefix: string;
  invoiceStartNumber?: number;
  footerText?: string;
  terms?: string;
}

export interface User {
  username: string;
  passwordHash: string; // Stored as hash
  role: 'admin' | 'user';
  lastLogin?: string;
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  type: 'auto' | 'manual';
  size: number;
  data: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  hsnCode: string;
  unit: string;
  packageSize?: string;
  batchNumber?: string;
  expiryDate?: string;
  mrp: number;
  discountPercent: number;
  sellingPrice: number;
  purchasePrice: number;
  gstRate: number;
  currentStock: number;
  minStockLevel: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
}

export interface SalesPerson {
  id: number;
  name: string;
  isActive: boolean;
}

export interface BillItem {
  productId: number;
  productName: string;
  hsnCode?: string;
  quantity: number;
  mrp: number;
  rate: number;
  amount: number;
  discount?: number; // Discount in % applied during billing
  discountedAmount?: number; // Amount after discount
  batchNumber?: string;
  expiryDate?: string;
}

export interface Bill {
  id: number;
  invoiceNumber: string;
  date: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerGstin?: string;
  salesPersonId: number;
  salesPersonName: string;
  isGstBill: boolean;
  subTotal: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number; // Added IGST
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  items: BillItem[];
}

export interface CartItem extends Product {
  quantity: number;
  totalAmount: number;
  discount?: number; // Discount % applied during billing
  discountedAmount?: number; // Amount after discount
  expiryDate?: string; // Overridable expiry date for this bill
}

export interface StockHistory {
  id: number;
  timestamp: string;
  productId: number;
  productName: string;
  changeAmount: number; // positive for add, negative for remove
  reason: string;
  referenceId?: string;
}

// Tax & Compliance Interfaces
export interface GSTItem {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerGstin?: string;
  hsnCode: string;
  quantity: number;
  taxableValue: number;
  taxRate: number;
  taxAmount: number;
  itemDescription: string;
}

export interface GSTR1Data {
  month: number;
  year: number;
  filingDate?: string;
  gstItems: GSTItem[];
  totalTaxableValue: number;
  totalTaxAmount: number;
  status: 'draft' | 'filed' | 'amended';
}

export interface GSTR2Data {
  month: number;
  year: number;
  filingDate?: string;
  purchaseItems: GSTItem[];
  totalTaxableValue: number;
  totalTaxAmount: number;
  status: 'draft' | 'filed' | 'amended';
}

export interface TaxAdjustment {
  id: string;
  date: string;
  type: 'tds' | 'tcs' | 'advance_tax' | 'deferred';
  amount: number;
  description: string;
  referenceNumber?: string;
}

export interface TaxAuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  details: string;
  affectedBillId?: number;
  taxImpact: number;
}

export interface ComplianceAlert {
  id: string;
  type: 'filing_due' | 'reconciliation_needed' | 'threshold_breach' | 'compliance_reminder';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  dueDate?: string;
  status: 'active' | 'dismissed' | 'resolved';
  createdDate: string;
}

export interface TaxReconciliation {
  month: number;
  year: number;
  gstr1TaxableValue: number;
  gstr1TaxAmount: number;
  gstr2TaxableValue: number;
  gstr2TaxAmount: number;
  irrReceivedAmount: number;
  irrFiledAmount: number;
  discrepancy: number;
  discrepancyPercent: number;
  status: 'reconciled' | 'pending' | 'needs_review';
  notes?: string;
}

export interface TaxSummary {
  month: number;
  year: number;
  cgstCollected: number;
  sgstCollected: number;
  igstCollected: number;
  totalGstCollected: number;
  cgstLiability: number;
  sgstLiability: number;
  igstLiability: number;
  totalGstLiability: number;
  tdsAdjustments: number;
  netTaxLiability: number;
}

// Advanced Reporting & Analytics Interfaces
export interface ReportRow {
  label: string;
  value: number;
  percentage?: number;
  subRows?: ReportRow[];
}

export interface ProfitLossStatement {
  period: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossProfitMargin: number;
  operatingExpenses: number;
  operatingProfit: number;
  operatingMargin: number;
  taxExpense: number;
  netProfit: number;
  netProfitMargin: number;
}

export interface CashFlowStatement {
  period: string;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

export interface InventoryValuation {
  productId: number;
  productName: string;
  quantity: number;
  fifoCost: number;
  fifoValue: number;
  lifoCost: number;
  lifoValue: number;
  weightedAvgCost: number;
  weightedAvgValue: number;
  method: 'fifo' | 'lifo' | 'weighted_avg';
}

export interface YearOverYearComparison {
  metric: string;
  year1: number;
  year2: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  type: 'sales' | 'inventory' | 'customer' | 'product' | 'custom';
  displayMetrics: string[];
  dateRange: 'month' | 'quarter' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'customer';
  filters?: Record<string, any>;
  sortBy?: string;
  createdDate: string;
  lastModified: string;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
  unit?: string;
}