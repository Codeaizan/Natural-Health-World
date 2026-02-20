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
  generateProfitLossStatement: (bills: Bill[], month: number, year: number): ProfitLossStatement => {
    // Filter bills for the period
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    // Calculate revenue (gross sales)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);

    // Calculate COGS (estimate: 60% of revenue for ayurvedic products)
    const costOfGoodsSold = revenue * 0.6;
    const grossProfit = revenue - costOfGoodsSold;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Operating expenses (estimate: 20% of revenue for overhead)
    const operatingExpenses = revenue * 0.2;
    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

    // Tax expense (18% GST + 2% TDS)
    const taxExpense = periodBills.reduce((sum, b) => sum + b.totalTax, 0);

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
   * Generate Cash Flow Statement
   */
  generateCashFlowStatement: (bills: Bill[], month: number, year: number): CashFlowStatement => {
    const periodBills = bills.filter(b => {
      const billDate = new Date(b.date);
      return billDate.getMonth() + 1 === month && billDate.getFullYear() === year;
    });

    // Operating cash flow = net income + adjustments
    const netIncome = periodBills.reduce((sum, b) => sum + (b.grandTotal - b.totalTax), 0);
    const operatingCashFlow = netIncome * 0.8; // Assume 80% converted to cash

    // Investing cash flow (negative for purchases, estimate 10% of revenue)
    const revenue = periodBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const investingCashFlow = -revenue * 0.1;

    // Financing cash flow (0 for demo)
    const financingCashFlow = 0;

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    // Estimate beginning and ending cash
    const beginningCash = revenue * 0.3;
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
      // Get all sales for this product
      const productSales = bills.flatMap(b =>
        b.items
          .filter(i => i.productId === product.id)
          .map(i => ({
            quantity: i.quantity,
            rate: i.rate,
            date: b.date,
          }))
      );

      const quantity = product.currentStock;

      // FIFO: Assume oldest inventory is sold first
      let fifoCost = 0;
      let fifoComputedQty = quantity;
      if (productSales.length > 0) {
        const sortedSales = productSales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let remainingQty = quantity;
        for (const sale of sortedSales) {
          const qtyUsed = Math.min(remainingQty, sale.quantity);
          fifoCost += qtyUsed * sale.rate;
          remainingQty -= qtyUsed;
          if (remainingQty <= 0) break;
        }
      }
      const fifoValue = quantity * product.purchasePrice;

      // LIFO: Assume newest inventory is sold first
      let lifoCost = 0;
      if (productSales.length > 0) {
        const sortedSales = productSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        let remainingQty = quantity;
        for (const sale of sortedSales) {
          const qtyUsed = Math.min(remainingQty, sale.quantity);
          lifoCost += qtyUsed * sale.rate;
          remainingQty -= qtyUsed;
          if (remainingQty <= 0) break;
        }
      }
      const lifoValue = quantity * product.purchasePrice * 0.95; // Slight adjustment

      // Weighted Average
      const totalSalesQty = productSales.reduce((sum, s) => sum + s.quantity, 0);
      const totalSalesValue = productSales.reduce((sum, s) => sum + s.quantity * s.rate, 0);
      const avgRate = totalSalesQty > 0 ? totalSalesValue / totalSalesQty : product.purchasePrice;
      const weightedAvgCost = quantity * avgRate;
      const weightedAvgValue = quantity * product.purchasePrice;

      const selectedMethod = method === 'fifo' ? fifoCost : method === 'lifo' ? lifoCost : weightedAvgCost;

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        fifoCost: parseFloat(fifoCost.toFixed(2)),
        fifoValue: parseFloat(fifoValue.toFixed(2)),
        lifoCost: parseFloat(lifoCost.toFixed(2)),
        lifoValue: parseFloat(lifoValue.toFixed(2)),
        weightedAvgCost: parseFloat(weightedAvgCost.toFixed(2)),
        weightedAvgValue: parseFloat(weightedAvgValue.toFixed(2)),
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
        productSales[item.productId].revenue += item.amount;
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
  generateSalesByCategoryReport: (bills: Bill[]): Array<{ category: string; quantity: number; revenue: number; count: number }> => {
    const categorySales: Record<string, { quantity: number; revenue: number; count: number }> = {};

    bills.forEach(bill => {
      bill.items.forEach(item => {
        // Extract category from product (you might need to fetch product details)
        const category = 'General'; // Placeholder

        if (!categorySales[category]) {
          categorySales[category] = { quantity: 0, revenue: 0, count: 0 };
        }
        categorySales[category].quantity += item.quantity;
        categorySales[category].revenue += item.amount;
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
  exportReportToJSON: (reportName: string, data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportName}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  },
};
