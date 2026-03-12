// Import named TypeScript types used throughout the analytics calculations
import {
  Bill,                       // A single sales invoice with items, totals, and tax breakdown
  Product,                    // A product record with stock, pricing, and category info
  ProfitLossStatement,        // Shape of a P&L output object (revenue, costs, margins)
  CashFlowStatement,          // Shape of a cash flow output (operating, investing, net)
  InventoryValuation,         // FIFO/LIFO/Weighted-Average valuation per product
  YearOverYearComparison,     // Metric comparison across two calendar years
  CustomReport,               // User-saved custom report definition
  AnalyticsMetric,            // A single KPI card metric (label, value, change %)
} from '../types';
import { StorageService } from './storage'; // Unified storage API (SQLite or Dexie depending on environment)

// localStorage key constants — keeps all key strings in one place for easy renaming
const ANALYTICS_DB_KEYS = {
  CUSTOM_REPORTS: 'nhw_custom_reports', // Key for the JSON array of user-saved custom reports
};

// Generic helper: read and JSON-parse a localStorage item; returns defaultValue on miss or parse error
const load = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key); // Read raw JSON string from localStorage
  if (!data) return defaultValue;         // Key not found — return provided default
  try {
    return JSON.parse(data); // Parse and return the deserialized value
  } catch {
    return defaultValue; // Malformed JSON — return safe default
  }
};

// Generic helper: JSON-stringify a value and store it in localStorage under the given key
const save = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data)); // Serialise and persist to localStorage
};

// The AnalyticsService object — stateless service that derives financial insights from bill/product data
export const AnalyticsService = {
  /**
   * Generate Profit & Loss Statement for a period
   */
  // Calculate a full P&L for a single calendar month.
  // Revenue = sum of grandTotal, COGS = quantity × purchasePrice per item, margins as %.
  generateProfitLossStatement: (bills: Bill[], products: Product[], month: number, year: number): ProfitLossStatement => {
    // Keep only bills that fall within the requested month/year
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date); // Parse ISO date string
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year; // getMonth() is 0-indexed
    });

    // Total revenue = sum of all bill grand totals (includes tax)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // Build a productId → purchasePrice lookup so COGS can be computed per line item
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; }); // Map id to purchase cost

    // COGS = Σ across all bills of Σ(item.quantity × purchasePrice)
    const costOfGoodsSold = periodBills.reduce((sum, b) => {
      return sum + b.items.reduce((itemSum, item) => {
        const purchasePrice = purchasePriceMap[item.productId] || 0; // 0 if product was deleted
        return itemSum + (item.quantity * purchasePrice);            // Cost for this line item
      }, 0);
    }, 0);

    const grossProfit = revenue - costOfGoodsSold;                                      // Gross profit = revenue - COGS
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;          // As a percentage of revenue

    // Operating expenses are not tracked — set to 0 as a placeholder for future OpEx module
    const operatingExpenses = 0;                                                         // Placeholder: actual rent/utilities/salaries not tracked
    const operatingProfit = grossProfit - operatingExpenses;                            // EBIT
    const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;       // Operating margin %

    // Income tax not tracked — set to 0 (GST is pass-through, not a business expense)
    const taxExpense = 0;

    const netProfit = operatingProfit - taxExpense;                                     // Net profit after tax
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;             // Net margin %

    return {
      period: `${month}/${year}`,                                          // Period label e.g. '4/2024'
      revenue,                                                              // Gross sales total
      costOfGoodsSold,                                                      // Total purchase cost of goods sold
      grossProfit,                                                          // Revenue minus COGS
      grossProfitMargin: parseFloat(grossProfitMargin.toFixed(2)),          // Rounded to 2 decimal places
      operatingExpenses,                                                    // Always 0 in current implementation
      operatingProfit,                                                      // Gross profit minus operating expenses
      operatingMargin: parseFloat(operatingMargin.toFixed(2)),              // Rounded to 2 dp
      taxExpense,                                                           // Always 0 in current implementation
      netProfit,                                                            // Final bottom-line profit
      netProfitMargin: parseFloat(netProfitMargin.toFixed(2)),             // Rounded to 2 dp
    };
  },

  /**
   * Compute net cash flow for a single month (helper)
   */
  // Private helper used by generateCashFlowStatement to compute one month's net cash flow.
  // net = revenue − COGS − gstCollected (GST is collected on behalf of govt, not business income)
  _monthNetCashFlow: (bills: Bill[], products: Product[], month: number, year: number): number => {
    const periodBills = bills.filter(b => {
      const d = new Date(b.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year; // Filter to the given month/year
    });
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0); // Total sales including GST
    const gstCollected = periodBills.reduce((sum, b) => sum + b.totalTax, 0); // GST portion (pass-through)
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; }); // Build id→purchasePrice lookup
    const cogs = periodBills.reduce((sum, b) =>
      sum + b.items.reduce((s, item) => s + (item.quantity * (purchasePriceMap[item.productId] || 0)), 0)
    , 0);
    return revenue - cogs - gstCollected; // Net operating cash inflow for the month
  },

  /**
   * Generate Cash Flow Statement
   * beginningCash is calculated as the cumulative net cash flow of all prior months.
   */
  // Build a full cash flow statement for the requested month/year.
  // beginningCash is computed by accumulating every prior month's net cash flow starting from the earliest bill.
  generateCashFlowStatement: (bills: Bill[], products: Product[], month: number, year: number): CashFlowStatement => {
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year; // This month's bills only
    });

    // Operating cash inflow = total revenue received (grandTotal already includes GST)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const gstCollected = periodBills.reduce((sum, b) => sum + b.totalTax, 0); // GST collected (to be remitted)

    // Build purchasePrice lookup from product list
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; });

    // COGS = cash paid for goods that were sold this period
    const cogs = periodBills.reduce((sum, b) => {
      return sum + b.items.reduce((itemSum, item) => {
        const pp = purchasePriceMap[item.productId] || 0; // Lookup purchase price (0 if deleted)
        return itemSum + (item.quantity * pp);             // Line-item cost
      }, 0);
    }, 0);

    // Free cash flow from operations; investing/financing not tracked → 0
    const operatingCashFlow = revenue - cogs - gstCollected;
    const investingCashFlow = 0;  // Not tracked (no capital expenditure or investments recorded)
    const financingCashFlow = 0;  // Not tracked (no loans or equity transactions recorded)

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow; // Total net change in cash

    // Calculate opening cash balance as sum of all prior months' net cash flow
    let beginningCash = 0;
    if (bills.length > 0) {
      const allDates = bills.map(b => new Date(b.date));                               // All bill dates
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));           // Earliest bill date
      let curYear = minDate.getFullYear();                                             // Start from the year of first bill
      let curMonth = minDate.getMonth() + 1;                                          // Start from the month of first bill (1-indexed)

      // Accumulate net cash flow month by month until we reach the requested period
      while (curYear < year || (curYear === year && curMonth < month)) {
        beginningCash += AnalyticsService._monthNetCashFlow(bills, products, curMonth, curYear);
        curMonth++;                   // Advance to next month
        if (curMonth > 12) {
          curMonth = 1;              // Wrap month to January
          curYear++;                 // Advance to next year
        }
      }
    }

    const endingCash = beginningCash + netCashFlow; // Closing cash = opening + net for this month

    return {
      period: `${month}/${year}`,                                         // Period label e.g. '4/2024'
      operatingCashFlow: parseFloat(operatingCashFlow.toFixed(2)),        // Rounded to 2 dp
      investingCashFlow: parseFloat(investingCashFlow.toFixed(2)),        // Always 0 currently
      financingCashFlow,                                                   // Always 0 currently
      netCashFlow: parseFloat(netCashFlow.toFixed(2)),                    // Total net for the period
      beginningCash: parseFloat(beginningCash.toFixed(2)),                // Opening balance
      endingCash: parseFloat(endingCash.toFixed(2)),                      // Closing balance
    };
  },

  /**
   * Calculate inventory valuation using FIFO, LIFO, or Weighted Average
   */
  // Returns a per-product valuation for each item in stock.
  // NOTE: Since only one purchase price per product is stored, FIFO/LIFO/Weighted Avg all produce the same value.
  calculateInventoryValuation: (
    products: Product[],
    bills: Bill[],
    method: 'fifo' | 'lifo' | 'weighted_avg' = 'fifo'  // Valuation method (functionally identical with current data model)
  ): InventoryValuation[] => {
    return products.map(product => {
      const quantity = product.currentStock;             // Quantity currently on hand
      // All three methods resolve to quantity × purchasePrice (single-lot model)
      const valuationAmount = quantity * product.purchasePrice;

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        fifoCost: parseFloat(valuationAmount.toFixed(2)),         // FIFO unit cost (= purchasePrice)
        fifoValue: parseFloat(valuationAmount.toFixed(2)),        // FIFO total value
        lifoCost: parseFloat(valuationAmount.toFixed(2)),         // LIFO unit cost (= purchasePrice, same as FIFO)
        lifoValue: parseFloat(valuationAmount.toFixed(2)),        // LIFO total value
        weightedAvgCost: parseFloat(valuationAmount.toFixed(2)),  // Weighted-avg unit cost (= purchasePrice)
        weightedAvgValue: parseFloat(valuationAmount.toFixed(2)), // Weighted-avg total value
        method,                                                   // Which method was requested (informational)
      };
    });
  },

  /**
   * Generate Year-over-Year comparison
   */
  // Compare revenue, invoice count, average bill, and tax for the current vs previous calendar year.
  generateYearOverYearComparison: (bills: Bill[], currentYear: number): YearOverYearComparison[] => {
    const previousYear = currentYear - 1; // The comparison baseline year

    // Current-year aggregations
    const currentYearBills = bills.filter(b => new Date(b.date).getFullYear() === currentYear); // Bills in the current year
    const currentYearRevenue = currentYearBills.reduce((sum, b) => sum + b.grandTotal, 0);      // Total revenue
    const currentYearCount = currentYearBills.length;                                           // Number of invoices
    const currentYearAvgBill = currentYearCount > 0 ? currentYearRevenue / currentYearCount : 0; // Average invoice value
    const currentYearTax = currentYearBills.reduce((sum, b) => sum + b.totalTax, 0);            // Total GST collected

    // Previous-year aggregations
    const previousYearBills = bills.filter(b => new Date(b.date).getFullYear() === previousYear);
    const previousYearRevenue = previousYearBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const previousYearCount = previousYearBills.length;
    const previousYearAvgBill = previousYearCount > 0 ? previousYearRevenue / previousYearCount : 0;
    const previousYearTax = previousYearBills.reduce((sum, b) => sum + b.totalTax, 0);

    // Calculate percentage change from previous to current; returns 0 if baseline is 0 (avoid ÷0)
    const calculateChangePercent = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    // Build a single YearOverYearComparison row for a named metric
    const createComparison = (metric: string, year1: number, year2: number): YearOverYearComparison => {
      const change = year2 - year1;                                           // Absolute change
      const changePercent = calculateChangePercent(year2, year1);            // Relative change %
      return {
        metric,
        year1,                                                                // Previous-year value
        year2,                                                                // Current-year value
        change,
        changePercent: parseFloat(changePercent.toFixed(2)),                 // Rounded to 2 dp
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',         // Direction indicator
      };
    };

    return [
      createComparison('Total Revenue', previousYearRevenue, currentYearRevenue),
      createComparison('Invoice Count', previousYearCount, currentYearCount),
      createComparison('Average Bill Value', previousYearAvgBill, currentYearAvgBill),
      createComparison('Tax Collected', previousYearTax, currentYearTax),
    ];
  },

  /**
   * Generate key metrics dashboard
   */
  // Produce the 5 KPI cards shown on the Analytics page dashboard for the selected month.
  // Each metric includes the current value, the previous month's value, and the change %.
  generateMetricsDashboard: (bills: Bill[], products: Product[], month: number, year: number): AnalyticsMetric[] => {
    // This month's bills
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    // Previous month's bills (wraps year correctly for January)
    const prevMonthBills = bills.filter(b => {
      const billDate = new Date(b.date);
      const prevMonth = month === 1 ? 12 : month - 1;       // January → December of prior year
      const prevYear = month === 1 ? year - 1 : year;       // Decrement year only for January
      return billDate.getMonth() + 1 === prevMonth && billDate.getFullYear() === prevYear;
    });

    const currentRevenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0); // This month's revenue
    const prevRevenue = prevMonthBills.reduce((sum, b) => sum + b.grandTotal, 0); // Last month's revenue

    const currentInvoices = periodBills.length;  // Invoice count this month
    const prevInvoices = prevMonthBills.length;  // Invoice count last month

    const currentAvgBill = currentInvoices > 0 ? currentRevenue / currentInvoices : 0; // Average ticket this month
    const prevAvgBill = prevInvoices > 0 ? prevRevenue / prevInvoices : 0;              // Average ticket last month

    const lowStockProducts = products.filter(p => p.currentStock <= p.minStockLevel).length; // Products at or below minimum stock
    const totalInventoryValue = products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0); // Total value at cost

    // % change helper — returns 0 if previous is 0 to avoid division-by-zero
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    return [
      {
        label: 'Total Revenue',
        value: currentRevenue,                                                                // This month's revenue in ₹
        previousValue: prevRevenue,                                                           // Last month for comparison
        changePercent: parseFloat(calculateChange(currentRevenue, prevRevenue).toFixed(2)),   // MoM change %
        unit: '₹',
      },
      {
        label: 'Invoices',
        value: currentInvoices,                                                               // Invoice count this month
        previousValue: prevInvoices,
        changePercent: parseFloat(calculateChange(currentInvoices, prevInvoices).toFixed(2)),
      },
      {
        label: 'Average Bill Value',
        value: parseFloat(currentAvgBill.toFixed(2)),                                        // Avg ticket in ₹
        previousValue: parseFloat(prevAvgBill.toFixed(2)),
        changePercent: parseFloat(calculateChange(currentAvgBill, prevAvgBill).toFixed(2)),
        unit: '₹',
      },
      {
        label: 'Inventory Value',
        value: totalInventoryValue,                                                           // Total stock value at cost in ₹
        unit: '₹',
      },
      {
        label: 'Low Stock Items',
        value: lowStockProducts,                                                              // Count of products at/below minimum
      },
    ];
  },

  /**
   * Generate sales by product report
   */
  // Aggregate total units sold and revenue per product across all provided bills, sorted by revenue descending.
  generateSalesByProductReport: (bills: Bill[]): Array<{ productName: string; quantity: number; revenue: number; avgPrice: number }> => {
    const productSales: Record<number, { productName: string; quantity: number; revenue: number }> = {}; // Accumulator keyed by productId

    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.productId]) {
          // First encounter for this product — initialise the accumulator entry
          productSales[item.productId] = {
            productName: item.productName, // Denormalised product name from the bill item
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;                    // Accumulate units sold
        productSales[item.productId].revenue += item.discountedAmount || item.amount; // Use discounted amount if available
      });
    });

    return Object.values(productSales)
      .map(p => ({
        productName: p.productName,
        quantity: p.quantity,
        revenue: parseFloat(p.revenue.toFixed(2)),                        // Rounded to 2 dp
        avgPrice: p.quantity > 0 ? parseFloat((p.revenue / p.quantity).toFixed(2)) : 0, // Revenue per unit
      }))
      .sort((a, b) => b.revenue - a.revenue); // Sort highest-revenue products first
  },

  /**
   * Generate sales by category report
   */
  // Aggregate sales by product category using an optional productId→category map.
  // Falls back to 'General' for items whose product cannot be found.
  generateSalesByCategoryReport: (bills: Bill[], products?: Product[]): Array<{ category: string; quantity: number; revenue: number; count: number }> => {
    const categorySales: Record<string, { quantity: number; revenue: number; count: number }> = {}; // Accumulator by category

    // Build a productId → category lookup from the products array (if provided)
    const categoryMap: Record<number, string> = {};
    if (products) {
      products.forEach(p => { categoryMap[p.id] = p.category || 'General'; }); // Default to 'General' if no category
    }

    bills.forEach(bill => {
      bill.items.forEach(item => {
        const category = categoryMap[item.productId] || 'General'; // Lookup category; fallback to General

        if (!categorySales[category]) {
          categorySales[category] = { quantity: 0, revenue: 0, count: 0 }; // Initialise accumulator for new category
        }
        categorySales[category].quantity += item.quantity;                    // Accumulate units sent
        categorySales[category].revenue += item.discountedAmount || item.amount; // Accumulate discounted revenue
        categorySales[category].count += 1;                                   // Count line items (not bills)
      });
    });

    return Object.entries(categorySales)
      .map(([category, data]) => ({
        category,
        ...data,
        revenue: parseFloat(data.revenue.toFixed(2)), // Rounded to 2 dp
      }))
      .sort((a, b) => b.revenue - a.revenue); // Sort highest-revenue categories first
  },

  /**
   * Save custom report
   */
  // Upsert a custom report into the localStorage list (update if id matches, add if new)
  saveCustomReport: (report: CustomReport) => {
    const reports = load<CustomReport[]>(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []); // Load existing reports
    const existingIndex = reports.findIndex(r => r.id === report.id);           // Check if this id already exists

    if (existingIndex >= 0) {
      reports[existingIndex] = report;  // Replace existing report
    } else {
      reports.push(report);             // Append new report
    }

    save(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, reports); // Persist the updated array
  },

  /**
   * Get all custom reports
   */
  // Return the full list of user-saved custom reports from localStorage
  getCustomReports: (): CustomReport[] => load(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []),

  /**
   * Delete custom report
   */
  // Remove a custom report by id and persist the filtered array back to localStorage
  deleteCustomReport: (reportId: string) => {
    const reports = load<CustomReport[]>(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []); // Load existing reports
    const filtered = reports.filter(r => r.id !== reportId);                    // Exclude the target report
    save(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, filtered);                           // Persist the filtered list
  },

  /**
   * Export report to JSON
   */
  // Save a report dataset to a JSON file.
  // On Tauri: shows a native save dialog and writes via the FS plugin.
  // Browser fallback: creates an <a> tag download.
  exportReportToJSON: async (reportName: string, data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);             // Serialise with 2-space indentation
      const bytes = new TextEncoder().encode(jsonString);           // Convert string to Uint8Array for Tauri FS
      const { save } = await import('@tauri-apps/plugin-dialog');   // Tauri dialog plugin (native save dialog)
      const { writeFile } = await import('@tauri-apps/plugin-fs'); // Tauri FS plugin (file write)

      // Open native "Save As" dialog with a pre-filled filename including today's date
      const filePath = await save({
        defaultPath: `${reportName}_${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }], // Only show .json in the dialog
      });

      if (filePath) {
        await writeFile(filePath, bytes); // Write the bytes to the user-chosen path
      }
    } catch (err) {
      console.error('Export failed:', err); // Log the Tauri error; fall back to browser download
      // Browser fallback — create a temporary Blob URL and click it to trigger download
      const jsonString = JSON.stringify(data, null, 2); // Re-serialise for the blob
      const blob = new Blob([jsonString], { type: 'application/json' }); // Wrap in a Blob
      const url = URL.createObjectURL(blob);    // Create a temporary object URL
      const link = document.createElement('a'); // Create an invisible anchor element
      link.href = url;                          // Point the anchor at the blob URL
      link.download = `${reportName}_${new Date().toISOString().split('T')[0]}.json`; // Filename for download
      link.click();                             // Programmatically trigger the download
      URL.revokeObjectURL(url);                 // Free the blob memory after click
    }
  },
};
