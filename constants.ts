// Import the CompanySettings interface from the types file for type safety
import { CompanySettings } from './types';

// Define a constant object containing the color palette for Natural Health World branding
// Natural Health World Color Palette
export const COLORS = {
  // Cream color used for light backgrounds
  cream: '#EBF4DD',
  // Sage green color for secondary UI elements
  sageGreen: '#90AB8B',
  // Medium green color for primary UI elements
  mediumGreen: '#5A7863',
  // Dark text color for readability
  darkText: '#3B4953',
  // Dark green color for primary branding
  darkGreen: '#1F2121',
  // White color for contrast
  white: '#FFFFFF',
  // Danger/error color for alerts and warnings
  danger: '#EF4444',
  // Warning color for caution messages
  warning: '#F59E0B',
};

// Export a constant object containing default company settings
export const DEFAULT_SETTINGS: CompanySettings = {
  // Company name
  name: 'Natural Health World',
  // Company tagline
  tagline: 'The Herbal Healing',
  // Company subtitle describing their product
  subtitle: 'Manufacturer of Ayurvedic Medicines',
  // Company certifications and credentials
  certifications: 'GMP Certified Company',
  // Primary company address
  address: '4, Circus Range, Kolkata - 700 019',
  // Factory address (optional)
  factoryAddress: '',
  // Company phone number
  phone: '9143746966',
  // Company email address
  email: 'skr.nhw@gmail.com',
  // Company Instagram handle
  instagram: '@naturalhealthworld',
  
  // GST Identification Number
  gstin: '19ABCDE1234F1Z5',
  // PAN (Permanent Account Number) (optional)
  panNumber: '',
  // State name for GST purposes
  stateName: 'West Bengal',
  // State code for GST registration
  stateCode: '19',

  // GST bank account holder name
  gstBankName: 'STATE BANK OF INDIA',
  // GST bank account number
  gstAccountNo: '42567178838',
  // GST bank IFSC code for fund transfers
  gstIfsc: 'SBIN0011534',
  // GST bank branch name
  gstBranch: 'Ballygunge',
  // GST bank UPI ID for digital payments
  gstUpi: 'nhw@sbi',

  // Non-GST bank name for cash payments
  nonGstBankName: 'Local Bank',
  // Non-GST bank account number
  nonGstAccountNo: '',
  // Non-GST bank IFSC code
  nonGstIfsc: '',
  // Non-GST bank branch name
  nonGstBranch: '',
  // Non-GST bank UPI ID
  nonGstUpi: '',

  // Prefix for GST invoice numbering (e.g., NH/0001/25-26)
  invoicePrefix: 'NH',
  // Starting number for GST invoice sequence
  invoiceStartNumber: 1,
  // Prefix for non-GST invoice numbering (e.g., NHW/0001/25-26)
  nonGstInvoicePrefix: 'NHW',
  // Starting number for non-GST invoice sequence
  nonGstInvoiceStartNumber: 1,
  // Footer text to display on invoices
  footerText: 'Thank you for choosing Natural Health World.',
  // Terms and conditions text for invoices with multiple lines
  terms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid within due date.\n3. Subject to Kolkata Jurisdiction.',
};

// Export a constant array of product categories available in the system
export const CATEGORIES = [
  // Category for Ayurvedic medicines
  'Ayurvedic Medicine',
  // Category for herbal supplements
  'Herbal Supplements',
  // Category for general health and wellness products
  'Health & Wellness',
  // Category for personal care items
  'Personal Care',
  // Category for beauty products
  'Beauty Products',
  // General category for miscellaneous products
  'General',
];