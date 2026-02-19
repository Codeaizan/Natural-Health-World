# Natural Health World - BMS (Bill Management System)

A comprehensive billing and inventory management system for natural health businesses.

## Development

### Web Version (Browser)
```bash
npm run dev
# Opens at http://localhost:5173
```

### Desktop Version (Electron - Recommended for Auto-Save)
```bash
npm run dev:electron
# Launches Electron app with auto-save to Desktop/invoices
```

## Features

### ✅ Billing
- Create tax invoices (GST & Non-GST)
- Multi-item cart with discount & expiry date control
- Automatic PDF generation
- **Desktop version: Auto-saves bills to `Desktop/invoices` folder**

### ✅ Inventory
- Product management with stock levels
- Batch and expiry date tracking
- Stock adjustments and history

### ✅ Reports
- Sales summary and trends
- Product analytics
- Customer segmentation
- Staff performance
- Stock history
- **Real-time updates** when sales are made

### ✅ Customers
- Customer management
- GSTIN tracking
- Contact information

### ✅ Settings
- Company information
- GST configuration
- Bank details
- Invoice prefixes
- Terms & conditions

## Key Improvements

### Date/Timezone Fix
- Reports now correctly show today's date using local time (not UTC)
- Date range properly includes current day sales

### Real-Time Reports
- Reports automatically refresh when new sales are created
- Uses storage change notifications system

### Discount & Expiry Management
- Apply per-item discounts during billing (0-100%)
- Override product expiry date for special offers
- Tax calculated on discounted amounts

### PDF Export Options
1. **Web Version**: Click "Download PDF" to browser downloads folder
2. **Desktop Version**: Automatically saves to `Desktop/invoices/[InvoiceNumber].pdf`

## Desktop App (Electron)

### Building Executable
```bash
npm run build:electron
# Creates installer in dist/ folder
```

### Auto-Save Location
- **All bills automatically save to**: `C:\Users\[YourUsername]\Desktop\invoices\`
- **No prompts** - happens silently in the background
- **Folder created automatically** if it doesn't exist

### Running the Installed App
- After building, run the installer
- App will create desktop shortcut
- Billing PDFs auto-save to Desktop/invoices

## Production Build

### Web Only
```bash
npm run build
# Creates optimized build in dist/
```

### Desktop 
```bash
npm run build:electron
# Creates both web build and Electron installer
```

## Technical Stack

- **Frontend**: React 19 + TypeScript
- **Desktop**: Electron 28
- **UI**: Tailwind CSS + Lucide Icons
- **Charts**: Recharts
- **PDF Export**: html2pdf.js

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support
- Mobile: ⚠️ Limited (reports view optimized for desktop)

## Desktop App Support

- Windows: ✅ Full support (NSIS installer)
- macOS: ⚠️ Requires code signing
- Linux: ⚠️ May require additional setup

## Data Storage

- **Web**: LocalStorage (browser)
- **Desktop**: LocalStorage + Auto-save to Desktop/invoices

## Notes

- LocalStorage backup is auto-created daily
- All bills are stored locally (no cloud sync)
- Desktop app provides persistent file storage for audit trails
