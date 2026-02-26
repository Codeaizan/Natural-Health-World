import {
  Bill,
  Product,
  ProfitLossStatement,
  CashFlowStatement,
  InventoryValuation,
  YearOverYearComparison,
  CustomReport,
  AnalyticsMetric,
} from '../types';
import { StorageService } from './storage';

const ANALYTICS_DB_KEYS = {
  CUSTOM_REPORTS: 'nhw_custom_reports',
};

const load = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const save = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const AnalyticsService = {
  /**
   * Generate Profit & Loss Statement for a period
   */
  generateProfitLossStatement: (bills: Bill[], products: Product[], month: number, year: number): ProfitLossStatement => {
    // Filter bills for the period
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    // Calculate revenue (gross sales)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // Build a purchasePrice lookup from products
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; });

    // Calculate actual COGS from sold items' purchase prices
    const costOfGoodsSold = periodBills.reduce((sum, b) => {
      return sum + b.items.reduce((itemSum, item) => {
        const purchasePrice = purchasePriceMap[item.productId] || 0;
        return itemSum + (item.quantity * purchasePrice);
      }, 0);
    }, 0);

    const grossProfit = revenue - costOfGoodsSold;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Operating expenses - GST collected is NOT a business expense (it's passed to govt)
    // Use a minimal overhead estimate based on bill count (rent, utilities, salaries)
    // NOTE: Without actual expense tracking, this remains an estimate
    const operatingExpenses = 0; // Set to 0 — user should add actual OpEx tracking
    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

    // Tax expense = income tax estimate (not GST, which is pass-through)
    // Without income tax tracking, set to 0
    const taxExpense = 0;

    const netProfit = operatingProfit - taxExpense;
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      period: `${month}/${year}`,
      revenue,
      costOfGoodsSold,
      grossProfit,
      grossProfitMargin: parseFloat(grossProfitMargin.toFixed(2)),
      operatingExpenses,
      operatingProfit,
      operatingMargin: parseFloat(operatingMargin.toFixed(2)),
      taxExpense,
      netProfit,
      netProfitMargin: parseFloat(netProfitMargin.toFixed(2)),
    };
  },

  /**
   * Compute net cash flow for a single month (helper)
   */
  _monthNetCashFlow: (bills: Bill[], products: Product[], month: number, year: number): number => {
    const periodBills = bills.filter(b => {
      const d = new Date(b.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const gstCollected = periodBills.reduce((sum, b) => sum + b.totalTax, 0);
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; });
    const cogs = periodBills.reduce((sum, b) =>
      sum + b.items.reduce((s, item) => s + (item.quantity * (purchasePriceMap[item.productId] || 0)), 0)
    , 0);
    return revenue - cogs - gstCollected;
  },

  /**
   * Generate Cash Flow Statement
   * beginningCash is calculated as the cumulative net cash flow of all prior months.
   */
  generateCashFlowStatement: (bills: Bill[], products: Product[], month: number, year: number): CashFlowStatement => {
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    // Operating cash flow = revenue received (grandTotal includes GST)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const gstCollected = periodBills.reduce((sum, b) => sum + b.totalTax, 0);

    // Build purchasePrice lookup
    const purchasePriceMap: Record<number, number> = {};
    products.forEach(p => { purchasePriceMap[p.id] = p.purchasePrice; });

    // COGS outflow (what was paid for the goods sold)
    const cogs = periodBills.reduce((sum, b) => {
      return sum + b.items.reduce((itemSum, item) => {
        const pp = purchasePriceMap[item.productId] || 0;
        return itemSum + (item.quantity * pp);
      }, 0);
    }, 0);

    // Operating cash flow = revenue - COGS - GST (pass-through to govt)
    const operatingCashFlow = revenue - cogs - gstCollected;

    // Without actual investment/financing tracking, set to 0
    const investingCashFlow = 0;
    const financingCashFlow = 0;

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    // Compute beginningCash as cumulative net cash flow of ALL prior months
    // Find the earliest bill and iterate each month up to (but not including) the current one
    let beginningCash = 0;
    if (bills.length > 0) {
      const allDates = bills.map(b => new Date(b.date));
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      let curYear = minDate.getFullYear();
      let curMonth = minDate.getMonth() + 1; // 1-indexed

      while (curYear < year || (curYear === year && curMonth < month)) {
        beginningCash += AnalyticsService._monthNetCashFlow(bills, products, curMonth, curYear);
        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
    }

    const endingCash = beginningCash + netCashFlow;

    return {
      period: `${month}/${year}`,
      operatingCashFlow: parseFloat(operatingCashFlow.toFixed(2)),
      investingCashFlow: parseFloat(investingCashFlow.toFixed(2)),
      financingCashFlow,
      netCashFlow: parseFloat(netCashFlow.toFixed(2)),
      beginningCash: parseFloat(beginningCash.toFixed(2)),
      endingCash: parseFloat(endingCash.toFixed(2)),
    };
  },

  /**
   * Calculate inventory valuation using FIFO, LIFO, or Weighted Average
   */
  calculateInventoryValuation: (
    products: Product[],
    bills: Bill[],
    method: 'fifo' | 'lifo' | 'weighted_avg' = 'fifo'
  ): InventoryValuation[] => {
    return products.map(product => {
      const quantity = product.currentStock;

      // Note: Since this system tracks a single purchase price per product (no purchase lot/layer history),
      // FIFO, LIFO, and Weighted Average all produce the same valuation: quantity × purchasePrice.
      // If multiple purchase lots at different costs are added in the future, this logic should be updated.
      const valuationAmount = quantity * product.purchasePrice;

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        fifoCost: parseFloat(valuationAmount.toFixed(2)),
        fifoValue: parseFloat(valuationAmount.toFixed(2)),
        lifoCost: parseFloat(valuationAmount.toFixed(2)),
        lifoValue: parseFloat(valuationAmount.toFixed(2)),
        weightedAvgCost: parseFloat(valuationAmount.toFixed(2)),
        weightedAvgValue: parseFloat(valuationAmount.toFixed(2)),
        method,
      };
    });
  },

  /**
   * Generate Year-over-Year comparison
   */
  generateYearOverYearComparison: (bills: Bill[], currentYear: number): YearOverYearComparison[] => {
    const previousYear = currentYear - 1;

    // Current year metrics
    const currentYearBills = bills.filter(b => new Date(b.date).getFullYear() === currentYear);
    const currentYearRevenue = currentYearBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const currentYearCount = currentYearBills.length;
    const currentYearAvgBill = currentYearCount > 0 ? currentYearRevenue / currentYearCount : 0;
    const currentYearTax = currentYearBills.reduce((sum, b) => sum + b.totalTax, 0);

    // Previous year metrics
    const previousYearBills = bills.filter(b => new Date(b.date).getFullYear() === previousYear);
    const previousYearRevenue = previousYearBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const previousYearCount = previousYearBills.length;
    const previousYearAvgBill = previousYearCount > 0 ? previousYearRevenue / previousYearCount : 0;
    const previousYearTax = previousYearBills.reduce((sum, b) => sum + b.totalTax, 0);

    const calculateChangePercent = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const createComparison = (metric: string, year1: number, year2: number): YearOverYearComparison => {
      const change = year2 - year1;
      const changePercent = calculateChangePercent(year2, year1);
      return {
        metric,
        year1,
        year2,
        change,
        changePercent: parseFloat(changePercent.toFixed(2)),
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
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
  generateMetricsDashboard: (bills: Bill[], products: Product[], month: number, year: number): AnalyticsMetric[] => {
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    const prevMonthBills = bills.filter(b => {
      const billDate = new Date(b.date);
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      return billDate.getMonth() + 1 === prevMonth && billDate.getFullYear() === prevYear;
    });

    const currentRevenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const prevRevenue = prevMonthBills.reduce((sum, b) => sum + b.grandTotal, 0);

    const currentInvoices = periodBills.length;
    const prevInvoices = prevMonthBills.length;

    const currentAvgBill = currentInvoices > 0 ? currentRevenue / currentInvoices : 0;
    const prevAvgBill = prevInvoices > 0 ? prevRevenue / prevInvoices : 0;

    const lowStockProducts = products.filter(p => p.currentStock <= p.minStockLevel).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + p.currentStock * p.purchasePrice, 0);

    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    return [
      {
        label: 'Total Revenue',
        value: currentRevenue,
        previousValue: prevRevenue,
        changePercent: parseFloat(calculateChange(currentRevenue, prevRevenue).toFixed(2)),
        unit: '₹',
      },
      {
        label: 'Invoices',
        value: currentInvoices,
        previousValue: prevInvoices,
        changePercent: parseFloat(calculateChange(currentInvoices, prevInvoices).toFixed(2)),
      },
      {
        label: 'Average Bill Value',
        value: parseFloat(currentAvgBill.toFixed(2)),
        previousValue: parseFloat(prevAvgBill.toFixed(2)),
        changePercent: parseFloat(calculateChange(currentAvgBill, prevAvgBill).toFixed(2)),
        unit: '₹',
      },
      {
        label: 'Inventory Value',
        value: totalInventoryValue,
        unit: '₹',
      },
      {
        label: 'Low Stock Items',
        value: lowStockProducts,
      },
    ];
  },

  /**
   * Generate sales by product report
   */
  generateSalesByProductReport: (bills: Bill[]): Array<{ productName: string; quantity: number; revenue: number; avgPrice: number }> => {
    const productSales: Record<number, { productName: string; quantity: number; revenue: number }> = {};

    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            productName: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.discountedAmount || item.amount;
      });
    });

    return Object.values(productSales)
      .map(p => ({
        productName: p.productName,
        quantity: p.quantity,
        revenue: parseFloat(p.revenue.toFixed(2)),
        avgPrice: parseFloat((p.revenue / p.quantity).toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  /**
   * Generate sales by category report
   */
  generateSalesByCategoryReport: (bills: Bill[], products?: Product[]): Array<{ category: string; quantity: number; revenue: number; count: number }> => {
    const categorySales: Record<string, { quantity: number; revenue: number; count: number }> = {};

    // Build a productId → category lookup from products array
    const categoryMap: Record<number, string> = {};
    if (products) {
      products.forEach(p => { categoryMap[p.id] = p.category || 'General'; });
    }

    bills.forEach(bill => {
      bill.items.forEach(item => {
        const category = categoryMap[item.productId] || 'General';

        if (!categorySales[category]) {
          categorySales[category] = { quantity: 0, revenue: 0, count: 0 };
        }
        categorySales[category].quantity += item.quantity;
        categorySales[category].revenue += item.discountedAmount || item.amount;
        categorySales[category].count += 1;
      });
    });

    return Object.entries(categorySales)
      .map(([category, data]) => ({
        category,
        ...data,
        revenue: parseFloat(data.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  },

  /**
   * Save custom report
   */
  saveCustomReport: (report: CustomReport) => {
    const reports = load<CustomReport[]>(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []);
    const existingIndex = reports.findIndex(r => r.id === report.id);

    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.push(report);
    }

    save(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, reports);
  },

  /**
   * Get all custom reports
   */
  getCustomReports: (): CustomReport[] => load(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []),

  /**
   * Delete custom report
   */
  deleteCustomReport: (reportId: string) => {
    const reports = load<CustomReport[]>(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, []);
    const filtered = reports.filter(r => r.id !== reportId);
    save(ANALYTICS_DB_KEYS.CUSTOM_REPORTS, filtered);
  },

  /**
   * Export report to JSON
   */
  exportReportToJSON: async (reportName: string, data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const bytes = new TextEncoder().encode(jsonString);
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      const filePath = await save({
        defaultPath: `${reportName}_${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (filePath) {
        await writeFile(filePath, bytes);
      }
    } catch (err) {
      console.error('Export failed:', err);
      // Fallback to browser download
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportName}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  },
};
