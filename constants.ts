import { CompanySettings } from './types';

// Natural Health World Color Palette
export const COLORS = {
  cream: '#EBF4DD',
  sageGreen: '#90AB8B',
  mediumGreen: '#5A7863',
  darkText: '#3B4953',
  darkGreen: '#1F2121',
  white: '#FFFFFF',
  danger: '#EF4444',
  warning: '#F59E0B',
};

export const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Natural Health World',
  tagline: 'The Herbal Healing',
  subtitle: 'Manufacturer of Ayurvedic Medicines',
  certifications: 'GMP Certified Company',
  address: '4, Circus Range, Kolkata - 700 019',
  factoryAddress: '',
  phone: '9143746966',
  email: 'skr.nhw@gmail.com',
  instagram: '@naturalhealthworld',
  
  gstin: '19ABCDE1234F1Z5',
  stateName: 'West Bengal',
  stateCode: '19',

  gstBankName: 'STATE BANK OF INDIA',
  gstAccountNo: '42567178838',
  gstIfsc: 'SBIN0011534',
  gstBranch: 'Ballygunge',
  gstUpi: 'nhw@sbi',

  nonGstBankName: 'Local Bank',
  nonGstAccountNo: '',
  nonGstIfsc: '',
  nonGstBranch: '',
  nonGstUpi: '',

  invoicePrefix: 'NH',
  invoiceStartNumber: 1,
  footerText: 'Thank you for choosing Natural Health World.',
  terms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid within due date.\n3. Subject to Kolkata Jurisdiction.',
};

export const CATEGORIES = [
  'Ayurvedic Medicine',
  'Herbal Supplements',
  'Health & Wellness',
  'Personal Care',
  'Beauty Products',
  'General',
];