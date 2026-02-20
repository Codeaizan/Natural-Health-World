import { Bill, GSTR1Data, GSTR2Data, GSTItem, TaxAuditLog, ComplianceAlert, TaxReconciliation, TaxSummary, TaxAdjustment } from '../types';
import { StorageService } from './storage';

const TAX_DB_KEYS = {
  GSTR1_DATA: 'nhw_gstr1_data',
  GSTR2_DATA: 'nhw_gstr2_data',
  TAX_AUDIT_LOGS: 'nhw_tax_audit_logs',
  COMPLIANCE_ALERTS: 'nhw_compliance_alerts',
  TAX_ADJUSTMENTS: 'nhw_tax_adjustments',
  TAX_RECONCILIATION: 'nhw_tax_reconciliation',
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

export const TaxComplianceService = {
  /**
   * Generate GSTR-1 data (Sales) for a given month/year
   */
  generateGSTR1: (bills: Bill[], month: number, year: number): GSTR1Data => {
    const gstItems: GSTItem[] = [];
    let totalTaxableValue = 0;
    let totalTaxAmount = 0;

    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year) {
        bill.items.forEach(item => {
          const taxAmount = item.quantity * item.rate * (bill.isGstBill ? (bill.cgstAmount + bill.sgstAmount + bill.igstAmount) / bill.subTotal : 0);
          const gstItem: GSTItem = {
            invoiceNumber: bill.invoiceNumber,
            date: bill.date,
            customerName: bill.customerName,
            customerGstin: bill.customerGstin,
            hsnCode: item.hsnCode || '',
            quantity: item.quantity,
            taxableValue: item.amount,
            taxRate: item.quantity * item.rate > 0 ? (taxAmount / (item.quantity * item.rate)) * 100 : 0,
            taxAmount: taxAmount || 0,
            itemDescription: item.productName,
          };
          gstItems.push(gstItem);
          totalTaxableValue += gstItem.taxableValue;
          totalTaxAmount += gstItem.taxAmount;
        });
      }
    });

    const existingGSTR1 = load<GSTR1Data[]>(TAX_DB_KEYS.GSTR1_DATA, []).find(
      g => g.month === month && g.year === year
    );

    const gstr1: GSTR1Data = {
      month,
      year,
      filingDate: existingGSTR1?.filingDate,
      gstItems,
      totalTaxableValue,
      totalTaxAmount,
      status: existingGSTR1?.status || 'draft',
    };

    TaxComplianceService.logTaxAudit('GSTR-1 Generated', `GSTR-1 data generated for ${month}/${year}`, totalTaxAmount);
    return gstr1;
  },

  /**
   * Generate GSTR-2 data (Purchases) - simulated from bills marked as purchases
   */
  generateGSTR2: (bills: Bill[], month: number, year: number): GSTR2Data => {
    const purchaseItems: GSTItem[] = [];
    let totalTaxableValue = 0;
    let totalTaxAmount = 0;

    // For demo purposes, we'll treat some bills as purchases based on specific criteria
    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year) {
        bill.items.forEach(item => {
          const taxAmount = item.quantity * item.rate * (bill.isGstBill ? (bill.cgstAmount + bill.sgstAmount + bill.igstAmount) / bill.subTotal : 0);
          const purchaseItem: GSTItem = {
            invoiceNumber: bill.invoiceNumber,
            date: bill.date,
            customerName: bill.customerName,
            customerGstin: bill.customerGstin,
            hsnCode: item.hsnCode || '',
            quantity: item.quantity,
            taxableValue: item.amount,
            taxRate: item.quantity * item.rate > 0 ? (taxAmount / (item.quantity * item.rate)) * 100 : 0,
            taxAmount,
            itemDescription: item.productName,
          };
          purchaseItems.push(purchaseItem);
          totalTaxableValue += purchaseItem.taxableValue;
          totalTaxAmount += purchaseItem.taxAmount;
        });
      }
    });

    const existingGSTR2 = load<GSTR2Data[]>(TAX_DB_KEYS.GSTR2_DATA, []).find(
      g => g.month === month && g.year === year
    );

    const gstr2: GSTR2Data = {
      month,
      year,
      filingDate: existingGSTR2?.filingDate,
      purchaseItems,
      totalTaxableValue,
      totalTaxAmount,
      status: existingGSTR2?.status || 'draft',
    };

    TaxComplianceService.logTaxAudit('GSTR-2 Generated', `GSTR-2 data generated for ${month}/${year}`, totalTaxAmount);
    return gstr2;
  },

  /**
   * Save GSTR-1 filing
   */
  saveGSTR1: (gstr1: GSTR1Data) => {
    const gstr1List = load<GSTR1Data[]>(TAX_DB_KEYS.GSTR1_DATA, []);
    const existingIndex = gstr1List.findIndex(g => g.month === gstr1.month && g.year === gstr1.year);
    
    if (existingIndex >= 0) {
      gstr1List[existingIndex] = gstr1;
    } else {
      gstr1List.push(gstr1);
    }
    save(TAX_DB_KEYS.GSTR1_DATA, gstr1List);
    TaxComplianceService.logTaxAudit('GSTR-1 Saved', `GSTR-1 saved for ${gstr1.month}/${gstr1.year}`, gstr1.totalTaxAmount);
  },

  /**
   * Save GSTR-2 filing
   */
  saveGSTR2: (gstr2: GSTR2Data) => {
    const gstr2List = load<GSTR2Data[]>(TAX_DB_KEYS.GSTR2_DATA, []);
    const existingIndex = gstr2List.findIndex(g => g.month === gstr2.month && g.year === gstr2.year);
    
    if (existingIndex >= 0) {
      gstr2List[existingIndex] = gstr2;
    } else {
      gstr2List.push(gstr2);
    }
    save(TAX_DB_KEYS.GSTR2_DATA, gstr2List);
    TaxComplianceService.logTaxAudit('GSTR-2 Saved', `GSTR-2 saved for ${gstr2.month}/${gstr2.year}`, gstr2.totalTaxAmount);
  },

  /**
   * Get all GSTR-1 filings
   */
  getGSTR1List: (): GSTR1Data[] => load(TAX_DB_KEYS.GSTR1_DATA, []),

  /**
   * Get all GSTR-2 filings
   */
  getGSTR2List: (): GSTR2Data[] => load(TAX_DB_KEYS.GSTR2_DATA, []),

  /**
   * Calculate TDS (Tax Deducted at Source) - 2% standard
   */
  calculateTDS: (billAmount: number, tdsRate: number = 2): number => {
    return (billAmount * tdsRate) / 100;
  },

  /**
   * Calculate Excise Duty - 5% standard for ayurvedic medicines
   */
  calculateExciseDuty: (taxableValue: number, exciseRate: number = 5): number => {
    return (taxableValue * exciseRate) / 100;
  },

  /**
   * Add tax adjustment (TDS, Excise, etc.)
   */
  addTaxAdjustment: (adjustment: TaxAdjustment) => {
    const adjustments = load<TaxAdjustment[]>(TAX_DB_KEYS.TAX_ADJUSTMENTS, []);
    adjustments.push(adjustment);
    save(TAX_DB_KEYS.TAX_ADJUSTMENTS, adjustments);
    TaxComplianceService.logTaxAudit(
      `Tax Adjustment: ${adjustment.type}`,
      adjustment.description,
      adjustment.amount
    );
  },

  /**
   * Get all tax adjustments
   */
  getTaxAdjustments: (): TaxAdjustment[] => load(TAX_DB_KEYS.TAX_ADJUSTMENTS, []),

  /**
   * Log tax audit trail
   */
  logTaxAudit: (action: string, details: string, taxImpact: number) => {
    const logs = load<TaxAuditLog[]>(TAX_DB_KEYS.TAX_AUDIT_LOGS, []);
    const log: TaxAuditLog = {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      taxImpact,
    };
    logs.push(log);
    save(TAX_DB_KEYS.TAX_AUDIT_LOGS, logs);
  },

  /**
   * Get tax audit logs
   */
  getTaxAuditLogs: (): TaxAuditLog[] => load(TAX_DB_KEYS.TAX_AUDIT_LOGS, []),

  /**
   * Add compliance alert
   */
  addComplianceAlert: (alert: ComplianceAlert) => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []);
    alerts.push(alert);
    save(TAX_DB_KEYS.COMPLIANCE_ALERTS, alerts);
  },

  /**
   * Get active compliance alerts
   */
  getComplianceAlerts: (): ComplianceAlert[] => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []);
    return alerts.filter(a => a.status === 'active');
  },

  /**
   * Dismiss compliance alert
   */
  dismissAlert: (alertId: string) => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []);
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'dismissed';
      save(TAX_DB_KEYS.COMPLIANCE_ALERTS, alerts);
    }
  },

  /**
   * Reconcile GSTR-1 and GSTR-2 for a month
   */
  reconcileTaxes: (month: number, year: number): TaxReconciliation => {
    const gstr1List = TaxComplianceService.getGSTR1List();
    const gstr2List = TaxComplianceService.getGSTR2List();

    const gstr1 = gstr1List.find(g => g.month === month && g.year === year);
    const gstr2 = gstr2List.find(g => g.month === month && g.year === year);

    const gstr1TaxableValue = gstr1?.totalTaxableValue || 0;
    const gstr1TaxAmount = gstr1?.totalTaxAmount || 0;
    const gstr2TaxableValue = gstr2?.totalTaxableValue || 0;
    const gstr2TaxAmount = gstr2?.totalTaxAmount || 0;

    const discrepancy = gstr1TaxAmount - gstr2TaxAmount;
    const discrepancyPercent = gstr1TaxAmount > 0 ? (discrepancy / gstr1TaxAmount) * 100 : 0;

    const reconciliation: TaxReconciliation = {
      month,
      year,
      gstr1TaxableValue,
      gstr1TaxAmount,
      gstr2TaxableValue,
      gstr2TaxAmount,
      irrReceivedAmount: 0,
      irrFiledAmount: 0,
      discrepancy,
      discrepancyPercent,
      status: Math.abs(discrepancyPercent) < 1 ? 'reconciled' : 'needs_review',
    };

    TaxComplianceService.logTaxAudit(
      'Tax Reconciliation',
      `Reconciliation for ${month}/${year}`,
      discrepancy
    );

    return reconciliation;
  },

  /**
   * Generate tax summary for a month
   */
  generateTaxSummary: (bills: Bill[], month: number, year: number): TaxSummary => {
    let cgstCollected = 0;
    let sgstCollected = 0;
    let igstCollected = 0;

    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year && bill.isGstBill) {
        cgstCollected += bill.cgstAmount;
        sgstCollected += bill.sgstAmount;
        igstCollected += bill.igstAmount;
      }
    });

    const totalGstCollected = cgstCollected + sgstCollected + igstCollected;

    // Liabilities (typically 50% of collected for demo)
    const cgstLiability = cgstCollected * 0.5;
    const sgstLiability = sgstCollected * 0.5;
    const igstLiability = igstCollected * 0.5;
    const totalGstLiability = cgstLiability + sgstLiability + igstLiability;

    // Get TDS adjustments for the month
    const adjustments = TaxComplianceService.getTaxAdjustments();
    const tdsAdjustments = adjustments
      .filter(a => {
        const adjDate = new Date(a.date);
        return adjDate.getMonth() + 1 === month && adjDate.getFullYear() === year && a.type === 'tds';
      })
      .reduce((sum, a) => sum + a.amount, 0);

    const netTaxLiability = totalGstLiability - tdsAdjustments;

    return {
      month,
      year,
      cgstCollected,
      sgstCollected,
      igstCollected,
      totalGstCollected,
      cgstLiability,
      sgstLiability,
      igstLiability,
      totalGstLiability,
      tdsAdjustments,
      netTaxLiability,
    };
  },

  /**
   * Check compliance and generate alerts
   */
  checkCompliance: (bills: Bill[], settings: any) => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    // Check GSTR-1 filing deadline (10th of next month)
    const gstr1Deadline = new Date(year, month, 10);
    const gstr1Filed = TaxComplianceService.getGSTR1List().some(
      g => g.month === (month === 12 ? 1 : month + 1) && g.year === (month === 12 ? year + 1 : year) && g.status === 'filed'
    );

    if (!gstr1Filed && today >= new Date(gstr1Deadline.getTime() - 2 * 24 * 60 * 60 * 1000)) {
      const existingAlert = TaxComplianceService.getComplianceAlerts().find(
        a => a.type === 'filing_due' && a.title.includes('GSTR-1')
      );

      if (!existingAlert) {
        TaxComplianceService.addComplianceAlert({
          id: `alert_gstr1_${Date.now()}`,
          type: 'filing_due',
          severity: 'critical',
          title: 'GSTR-1 Filing Due',
          description: 'GSTR-1 filing deadline approaching. Please file by 10th of next month.',
          dueDate: gstr1Deadline.toISOString(),
          status: 'active',
          createdDate: today.toISOString(),
        });
      }
    }

    // Check for reconciliation
    const lastReconciliation = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const gstr1 = TaxComplianceService.getGSTR1List().find(
      g => g.month === lastReconciliation.getMonth() + 1 && g.year === lastReconciliation.getFullYear()
    );
    const gstr2 = TaxComplianceService.getGSTR2List().find(
      g => g.month === lastReconciliation.getMonth() + 1 && g.year === lastReconciliation.getFullYear()
    );

    if (gstr1 && gstr2 && gstr1.totalTaxAmount !== gstr2.totalTaxAmount) {
      const existingAlert = TaxComplianceService.getComplianceAlerts().find(
        a => a.type === 'reconciliation_needed'
      );

      if (!existingAlert) {
        TaxComplianceService.addComplianceAlert({
          id: `alert_recon_${Date.now()}`,
          type: 'reconciliation_needed',
          severity: 'warning',
          title: 'Tax Reconciliation Needed',
          description: 'GSTR-1 and GSTR-2 amounts do not match. Please review and reconcile.',
          status: 'active',
          createdDate: today.toISOString(),
        });
      }
    }
  },

  /**
   * Export data to JSON for filing
   */
  exportForFiling: (gstr1: GSTR1Data, gstr2: GSTR2Data) => {
    return {
      gstr1: {
        month: gstr1.month,
        year: gstr1.year,
        totalTaxableValue: gstr1.totalTaxableValue,
        totalTaxAmount: gstr1.totalTaxAmount,
        itemCount: gstr1.gstItems.length,
        exportedOn: new Date().toISOString(),
      },
      gstr2: {
        month: gstr2.month,
        year: gstr2.year,
        totalTaxableValue: gstr2.totalTaxableValue,
        totalTaxAmount: gstr2.totalTaxAmount,
        itemCount: gstr2.purchaseItems.length,
        exportedOn: new Date().toISOString(),
      },
    };
  },
};
