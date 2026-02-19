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