# Natural Health World — Business Management System

A full-featured desktop billing and inventory management system built for natural health product businesses. Ships as a lightweight native app (~3.3 MB) powered by **Tauri 2**, **React 19**, and **SQLite**.

---

## Highlights

- **Billing & Invoicing** — GST-aware cart with CGST/SGST/IGST auto-split, fiscal-year invoice numbering, PDF download & print
- **Inventory** — product master with stock tracking, low-stock & expiry alerts, CSV import/export, bulk price updates
- **Customers** — full CRM with purchase history, merge, CSV export
- **Reports** — Sales, Products, GST, Sales Team, Customers, Stock History with date filters and CSV export
- **Analytics** — P&L, Cash Flow, Inventory Valuation (FIFO/LIFO/WA), Year-over-Year, Sales Analysis
- **Forecasting** — demand prediction with product-level charts and restock recommendations
- **Tax Compliance** — GSTR-1/2 filing, reconciliation, TDS adjustments, audit trail, compliance alerts
- **Backup** — daily auto-backup (max 7), manual JSON export/import, full restore
- **Security** — SHA-256 hashed passwords, 30-min inactivity auto-logout

> See [FEATURES.md](FEATURES.md) for the complete feature reference.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · TypeScript 5.8 · Vite 6 |
| Styling | Tailwind CSS 4 · PostCSS |
| Charts | Recharts 3 |
| PDF | html2pdf.js |
| Icons | Lucide React |
| Desktop | Tauri 2.10 (Rust + WebView2) |
| Database | SQLite via `tauri-plugin-sql` (desktop) · IndexedDB/Dexie.js (browser fallback) |
| CI/CD | GitHub Actions — Windows, macOS (ARM + Intel), Linux |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | Required for frontend build |
| **Rust** | 1.70+ | Required for Tauri builds only |
| **Visual Studio Build Tools** | 2022 | Windows only — "Desktop development with C++" workload |
| **WebView2** | Latest | Pre-installed on Windows 10/11 |

macOS: install Xcode Command Line Tools (`xcode-select --install`).  
Linux: see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Codeaizan/Natural-Health-World.git
cd Natural-Health-World
npm install
```

### 2. Run in Browser (development)

```bash
npm run dev
```

Opens at `http://localhost:3000`. Uses IndexedDB for storage in this mode.

### 3. Run as Desktop App (Tauri)

```bash
npm run tauri:dev
```

Launches the native window with SQLite storage.

### 4. Build Installer

```bash
npm run tauri:build
```

Outputs installers to `src-tauri/target/release/bundle/`:
- **Windows:** `.exe` (NSIS) and `.msi`
- **macOS:** `.dmg`
- **Linux:** `.deb` and `.AppImage`

---

## Default Login

| Username | Password |
|---|---|
| `admin` | `admin123` |

> Change the password immediately via **Settings → Users**.

---

## Project Structure

```
├── index.html / index.tsx      # Entry point
├── App.tsx                     # Router & auth guard
├── components/Layout.tsx       # Sidebar + top bar shell
├── pages/                      # One file per page
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Billing.tsx
│   ├── Invoices.tsx
│   ├── Inventory.tsx
│   ├── Customers.tsx
│   ├── Reports.tsx
│   ├── Analytics.tsx
│   ├── Forecasting.tsx
│   ├── TaxCompliance.tsx
│   └── Settings.tsx
├── services/
│   ├── storage.ts              # Smart wrapper (auto-detects Tauri/browser)
│   ├── sqliteStorage.ts        # SQLite backend (Tauri)
│   ├── dexieStorage.ts         # IndexedDB backend (browser)
│   ├── analytics.ts            # Analytics calculations
│   ├── compliance.ts           # Tax compliance engine
│   └── forecasting.ts          # Demand forecasting
├── types.ts                    # All TypeScript interfaces
├── constants.ts                # Colours, defaults, categories
├── utils.ts                    # Shared helpers
├── src-tauri/                  # Tauri/Rust backend
│   ├── src/lib.rs              # Plugin registration & SQL migrations
│   ├── tauri.conf.json         # App config, window size, plugins
│   └── Cargo.toml              # Rust dependencies
└── .github/workflows/build.yml # CI/CD pipeline
```

---

## CI/CD

Pushing a version tag triggers GitHub Actions to build installers for all platforms:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Artifacts are attached to a draft GitHub Release.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (browser mode) |
| `npm run build` | Production frontend build |
| `npm run preview` | Preview production build |
| `npm run tauri:dev` | Launch Tauri desktop app in dev mode |
| `npm run tauri:build` | Build native installers |

---

## Data Storage

- **Desktop (Tauri):** SQLite database at `AppData/Roaming/com.naturalhealthworld.bms/nhw_data.db`
- **Browser fallback:** IndexedDB (automatically used when running via `npm run dev`)
- The storage wrapper detects the environment at runtime — no code changes needed

---

## License

This project is proprietary software. All rights reserved.
