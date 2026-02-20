# Natural Health World — Feature Reference

A comprehensive catalog of every feature in the Business Management System.

---

## Table of Contents

1. [Authentication & Security](#1-authentication--security)
2. [Dashboard](#2-dashboard)
3. [Billing](#3-billing)
4. [Invoices](#4-invoices)
5. [Inventory Management](#5-inventory-management)
6. [Customer Management](#6-customer-management)
7. [Reports](#7-reports)
8. [Analytics](#8-analytics)
9. [Forecasting](#9-forecasting)
10. [Tax Compliance (GST)](#10-tax-compliance-gst)
11. [Settings](#11-settings)
12. [Data Management & Backup](#12-data-management--backup)
13. [Cross-Cutting Concerns](#13-cross-cutting-concerns)

---

## 1. Authentication & Security

- **Login screen** with username and password fields
- **SHA-256 password hashing** via Web Crypto API — passwords never stored in plain text
- **Session persistence** — remains logged in until explicit logout or inactivity timeout
- **30-minute inactivity auto-logout** — automatic session expiry with redirect to login
- **Default admin account** — seeded on first launch (`admin` / `admin123`)
- **Role-based users** — admin and user roles
- **Last login tracking** for each user

## 2. Dashboard

- **4 KPI cards:**
  - Total Products (count from inventory)
  - Total Customers
  - Total Revenue (sum of all bill grand totals)
  - Low Stock Items (products below minimum stock level)
- **Monthly Sales Chart** — Recharts `BarChart` showing last 6 months of revenue
- **Low Stock Alerts** — table of products below minimum stock level with current vs required quantities
- **Recent Activity** — latest 5 transactions at a glance

## 3. Billing

### Cart System
- Product search with real-time dropdown results
- Add-to-cart with quantity control (increment / decrement / manual entry)
- Per-item customisable discount (percentage)
- Editable expiry date per line item
- Real-time line totals recalculation
- Remove individual items from cart

### GST Engine
- **GST / Non-GST toggle** per bill
- Automatic tax split: **CGST + SGST** (intra-state) or **IGST** (inter-state)
- Tax rate pulled from each product's GST-rate field
- Per-item tax breakdown in the bill
- HSN code carried through from product master

### Customer & Sales Rep
- Customer selection from existing records or inline creation
- Customer GSTIN auto-populated when available
- Sales person selection (from active sales reps)
- Customer phone, email, address carried into invoice

### Invoice Generation
- **Fiscal-year invoice numbering** — format `PREFIX/NNNN/YY-YY` (e.g., `NH/0001/25-26`)
- Configurable invoice prefix and start number
- **Smart round-off** to nearest rupee
- Grand total calculation: subtotal + tax − discount ± round-off

### Invoice Preview & Output
- Full preview modal with company header, logo, dual bank accounts
- **PDF download** via html2pdf.js
- **Print** support with optimised print CSS
- Terms & conditions footer
- Itemised table with HSN, batch, expiry, MRP, rate, discount, amount

### Post-Sale
- Automatic stock deduction on bill creation
- Stock history entry recorded for each item sold

## 4. Invoices

- **Paginated invoice list** with search by invoice number or customer name
- **Date range filtering**
- **Invoice preview** — full modal with identical layout to billing preview
- **Delete invoice** with confirmation dialog
- **Stock restoration** — deleting an invoice automatically restores stock quantities for every line item
- **Print & PDF** from the invoice list view
- Sort by date (newest first)

## 5. Inventory Management

### Product CRUD
- Add / Edit products with modal form
- Fields: Name, Category, HSN Code, Unit, Package Size, Batch Number, Expiry Date, MRP, Selling Price, Purchase Price, GST Rate, Current Stock, Minimum Stock Level
- **6 product categories:** Ayurvedic Medicine, Herbal Supplements, Health & Wellness, Personal Care, Beauty Products, General
- Inline discount percentage with auto-calculated selling price

### Search & Filter
- Text search across product name, HSN, batch
- Category filter dropdown
- Low-stock-only toggle
- Expiry-within-90-days toggle

### Stock Operations
- **Stock adjustment dialog** — add or remove stock with reason (Purchase, Return, Damage, Adjustment, Other)
- Adjustment recorded in stock history with timestamp, reason, and change amount
- Auto-prune: keeps only the latest 1,000 stock history records

### Bulk Operations
- **Bulk price update** — select multiple products, set new MRP/selling price in one action
- **CSV import** — upload products from CSV with column mapping, duplicate handling, and validation
- **CSV export** — download full product catalogue as CSV

### Alerts
- Low stock badge on products below minimum level
- Expiry warning badge on products expiring within 90 days

## 6. Customer Management

- **Add / Edit customers** with modal form
- Fields: Name, Phone, Email, Address, GSTIN
- **Search** by name, phone, or email
- **Purchase history** — expandable per-customer view showing all invoices with totals
- **Customer merge** — combine two customer records; all bills from the source customer are reassigned to the target, then the source is deleted
- **CSV export** — download customer list as CSV
- **Delete customer** with confirmation

## 7. Reports

### 6 Report Tabs

| Tab | Content |
|---|---|
| **Sales Report** | Revenue, bill count, average order value, top-selling products table |
| **Product Report** | Stock levels, product count by category, full product table |
| **GST Report** | HSN-wise tax summary, CGST / SGST / IGST breakdown, taxable value totals |
| **Sales Team** | Per-salesperson revenue, bill count, average sale; sortable table |
| **Customer Report** | Customer count, top customers by revenue, per-customer spend table |
| **Stock History** | Stock movements log with product, change, reason, reference, timestamp |

### Common Features
- **Date range filter** on all tabs
- **CSV export** per tab
- **Print view** with optimised print CSS and hidden controls

## 8. Analytics

### 6 Analytics Tabs

| Tab | Content |
|---|---|
| **Overview** | Operating Profit card with margin %, Net Profit card, Ending Cash Balance |
| **P&L Statement** | Revenue → COGS → Gross Profit → OpEx → Operating Profit → Tax → Net Profit (all with margin %) |
| **Cash Flow** | Operating / Investing / Financing cash flows, Net Cash Flow, Beginning & Ending Cash |
| **Inventory Valuation** | Per-product table with FIFO, LIFO, and Weighted Average values; selectable valuation method |
| **Year-over-Year** | Metric comparison cards: Year 1 vs Year 2 with change % and trend arrows |
| **Sales Analysis** | Top-selling products dual-axis bar chart (Revenue + Quantity), full sales-by-product table |

### Controls
- Month and Year selectors
- Inventory valuation method picker (FIFO / LIFO / Weighted Average)
- Export button
- 5 dynamic metric cards with trend indicators

## 9. Forecasting

- **Forecast period selector** — 7, 14, 30, 60, or 90 days
- **4 overview cards:**
  - Total Forecasted Revenue
  - Average Daily Revenue
  - Products Tracked
  - High Demand Items
- **Overall Sales Forecast** — line chart of predicted daily sales
- **Product-Level Forecasting:**
  - Scrollable product list with trend badges (upward / downward / stable)
  - Per-product average daily sales
  - Selected product bar chart (predicted units per day)
  - Total Forecasted Units and Average Daily Demand
- **Demand Recommendations (3 panels):**
  - High Demand products (top 5)
  - Low Demand products (top 5)
  - Stable Demand products (top 5)
- **Forecasting Insights** info box — methodology explanation and caveats

## 10. Tax Compliance (GST)

### 7 Tabs

| Tab | Content |
|---|---|
| **Overview** | GST breakdown (CGST 9%, SGST 9%, IGST 18%), reconciliation status indicator |
| **GSTR-1 (Sales)** | Invoice table with HSN, taxable value, tax amount; File GSTR-1 button; export |
| **GSTR-2 (Purchases)** | Same structure as GSTR-1 for purchase items; File GSTR-2 button |
| **Reconciliation** | GSTR-1 vs GSTR-2 comparison cards; discrepancy calculation with percentage |
| **Adjustments** | Add TDS (2%) or Excise Duty (5%) adjustments; adjustment history list |
| **Audit Trail** | Chronological log of tax actions with timestamp, tax impact (₹), lock icon |
| **Alerts** | Compliance alerts with severity badges (critical / warning / info) and due dates |

### Controls
- Month and Year selectors for tax period
- Compliance alerts banner with dismiss
- 4 Tax Summary cards: Total GST Collected, GST Liability, TDS Adjustments, Net Tax Liability
- Tax Compliance Guidelines info box

## 11. Settings

### 5 Tabs

| Tab | Content |
|---|---|
| **Company** | Logo upload (max 5 MB with preview), Company Name, Tagline, Subtitle, Certifications, Office & Factory addresses, Phone, Email, Instagram, GSTIN, State Name & Code |
| **Billing** | GST Bank Account (Primary): Bank, A/C No, IFSC, Branch, UPI · Non-GST Account (Personal): same fields · Invoice Prefix, Start Number, Footer Text, Terms & Conditions |
| **Sales** | Add / Activate / Deactivate sales representatives |
| **Users** | Create or update users (username + password), SHA-256 hashing, existing user list with last login |
| **Data** | Backup & Restore section + Danger Zone (see below) |

## 12. Data Management & Backup

### Automatic Backup
- **Daily auto-backup** — runs in the background
- **Max 7 backups** retained — oldest are pruned automatically

### Manual Backup
- **Download Backup (.JSON)** — full export of all data (settings, products, customers, bills, sales persons, stock history, users) with app version metadata
- **Import Backup** — upload a `.json` file; validates format, clears existing data, restores all tables, auto-reloads the application
- Status feedback during operations (loading / success / error)

### Danger Zone
- **Clear All Data** — requires double confirmation (confirm dialog + type the word `DELETE`)
- Permanently removes all products, customers, bills, sales persons, stock history, backups, users, and settings

## 13. Cross-Cutting Concerns

| Area | Details |
|---|---|
| **Storage** | SQLite via Tauri (desktop) with IndexedDB/Dexie.js fallback (browser). Smart wrapper auto-detects environment. |
| **Reactive UI** | Observer-pattern change listeners notify components of data mutations in real time |
| **Responsive Layout** | Collapsible sidebar, full-height scrollable content area |
| **Theming** | Consistent green/cream colour palette across all pages |
| **Print Support** | Dedicated print CSS hides navigation and controls; optimised for A4 |
| **Currency** | Indian Rupee (₹) formatting throughout |
| **Date Handling** | ISO dates in storage, localised display (`DD/MM/YYYY`), fiscal-year-aware invoice numbering |
| **Tauri Desktop** | Native Windows/macOS/Linux builds via Tauri 2; ~3.3 MB installer |
| **CI/CD** | GitHub Actions workflow for multi-platform builds (Windows `.exe`, macOS `.dmg` ARM+Intel, Linux `.deb`/`.AppImage`) triggered on version tags |

---

*Auto-generated feature reference for Natural Health World BMS v1.0.0*
