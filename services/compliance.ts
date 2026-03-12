// Import types for GST compliance, tax audit trail, alerts, and reconciliation
import { Bill, GSTR1Data, GSTR2Data, GSTItem, TaxAuditLog, ComplianceAlert, TaxReconciliation, TaxSummary, TaxAdjustment } from '../types';
import { StorageService } from './storage'; // Unified storage API (used for bills; tax data itself stays in localStorage)

// localStorage key constants â€” centralised for easy renaming
const TAX_DB_KEYS = {
  GSTR1_DATA: 'nhw_gstr1_data',                    // JSON array of GSTR-1 (sales) filing objects
  GSTR2_DATA: 'nhw_gstr2_data',                    // JSON array of GSTR-2 (purchase) filing objects
  TAX_AUDIT_LOGS: 'nhw_tax_audit_logs',            // Append-only tax action audit trail
  COMPLIANCE_ALERTS: 'nhw_compliance_alerts',      // Active/dismissed compliance alert list
  TAX_ADJUSTMENTS: 'nhw_tax_adjustments',          // TDS, excise, and other tax adjustment records
  TAX_RECONCILIATION: 'nhw_tax_reconciliation',    // Saved reconciliation results
};

const MAX_TAX_AUDIT_AGE_DAYS = 365; // Prune tax audit logs older than 1 year to prevent quota overflow
const MAX_TAX_AUDIT_ENTRIES = 5000; // Maximum number of tax audit log entries to retain

// Generic helper: read and JSON-parse a localStorage value; returns defaultValue on miss or parse error
const load = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key); // Read raw JSON string from localStorage
  if (!data) return defaultValue;         // Key not present â€” return default
  try {
    return JSON.parse(data); // Deserialise the stored JSON
  } catch {
    return defaultValue; // Malformed JSON â€” return safe default
  }
};

// Generic helper: JSON-stringify and save to localStorage.
// On QuotaExceededError: prunes old tax audit logs then retries the write.
const save = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data)); // Serialise and persist
  } catch (quotaErr) {
    // localStorage is full â€” remove old tax audit entries to free space
    console.warn('localStorage quota exceeded, pruning tax audit logs...');
    try {
      const cutoff = Date.now() - MAX_TAX_AUDIT_AGE_DAYS * 24 * 60 * 60 * 1000; // Timestamp boundary: 1 year ago
      const logsRaw = localStorage.getItem(TAX_DB_KEYS.TAX_AUDIT_LOGS);          // Read existing audit logs
      if (logsRaw) {
        const logs: TaxAuditLog[] = JSON.parse(logsRaw);   // Deserialise audit entries
        const pruned = logs
          .filter(l => new Date(l.timestamp).getTime() >= cutoff) // Keep only entries within 1 year
          .slice(-MAX_TAX_AUDIT_ENTRIES);                          // Keep at most MAX_TAX_AUDIT_ENTRIES newest
        localStorage.setItem(TAX_DB_KEYS.TAX_AUDIT_LOGS, JSON.stringify(pruned)); // Persist pruned logs
      }
      localStorage.setItem(key, JSON.stringify(data)); // Retry the original save after freeing space
    } catch {
      console.error('Failed to save to localStorage even after pruning'); // Log if retry also fails
    }
  }
};

// The TaxComplianceService â€” generates GST filings, reconciliations, tax summaries, and compliance alerts
export const TaxComplianceService = {
  /**
   * Generate GSTR-1 data (Sales) for a given month/year
   */
  // Build a GSTR-1 object from the bill list for the given month/year.
  // Each bill item becomes a GSTItem; tax rate is back-calculated from the bill-level tax total.
  generateGSTR1: (bills: Bill[], month: number, year: number): GSTR1Data => {
    const gstItems: GSTItem[] = []; // Will hold one GSTItem per bill line item
    let totalTaxableValue = 0;      // Running total of taxable values across all items
    let totalTaxAmount = 0;         // Running total of tax amounts across all items

    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year) { // Only process bills in the target period
        // Use per-item gstRate when available; fall back to bill-level average for legacy bills
        const billTaxTotal = bill.isGstBill ? (bill.cgstAmount + bill.sgstAmount + bill.igstAmount) : 0;
        const fallbackRate = bill.subTotal > 0 ? (billTaxTotal / bill.subTotal) * 100 : 0; // Fallback rate as %

        bill.items.forEach(item => {
          const itemTaxable = item.discountedAmount || item.amount;        // Taxable value for this line item
          const taxRatePercent = item.gstRate != null ? item.gstRate : fallbackRate; // Per-item rate in %
          const taxAmount = itemTaxable * (taxRatePercent / 100);          // Tax for this item
          const gstItem: GSTItem = {
            invoiceNumber: bill.invoiceNumber,         // Invoice reference for the return
            date: bill.date,                           // Bill date
            customerName: bill.customerName,           // Customer name (for B2C; GSTIN for B2B)
            customerGstin: bill.customerGstin,         // Customer GSTIN (optional for B2C)
            hsnCode: item.hsnCode || '',               // HSN/SAC code for the product
            quantity: item.quantity,                   // Units supplied
            taxableValue: itemTaxable,                 // Value before tax
            taxRate: Math.round(taxRatePercent * 100) / 100, // Rounded to 2 dp
            taxAmount: taxAmount || 0,                 // Tax amount for this item
            itemDescription: item.productName,         // Product name as description
          };
          gstItems.push(gstItem);              // Append to the filing items list
          totalTaxableValue += gstItem.taxableValue; // Accumulate taxable total
          totalTaxAmount += gstItem.taxAmount;       // Accumulate tax total
        });
      }
    });

    // Check if a previously saved GSTR-1 exists for this period (preserve filing date and status)
    const existingGSTR1 = load<GSTR1Data[]>(TAX_DB_KEYS.GSTR1_DATA, []).find(
      g => g.month === month && g.year === year
    );

    const gstr1: GSTR1Data = {
      month,
      year,
      filingDate: existingGSTR1?.filingDate,          // Preserve previously recorded filing date if exists
      gstItems,
      totalTaxableValue,
      totalTaxAmount,
      status: existingGSTR1?.status || 'draft',       // Preserve 'filed' status; default to 'draft' for new
    };

    TaxComplianceService.logTaxAudit('GSTR-1 Generated', `GSTR-1 data generated for ${month}/${year}`, totalTaxAmount);
    return gstr1;
  },

  /**
   * Generate GSTR-2 data (Purchases) - simulated from bills marked as purchases
   */
  // Build a GSTR-2 (input tax credit) object by treating the same bill data as simulated purchase entries.
  // In a real system, GSTR-2 comes from purchase invoices; here it mirrors GSTR-1 as a placeholder.
  generateGSTR2: (bills: Bill[], month: number, year: number): GSTR2Data => {
    const purchaseItems: GSTItem[] = []; // Will hold one GSTItem per bill line item (simulated as purchase)
    let totalTaxableValue = 0;            // Running total of taxable values
    let totalTaxAmount = 0;              // Running total of tax amounts

    // Simulate purchase data using the same bills (placeholder implementation)
    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year) { // Filter to target period
        const billTaxTotal = bill.isGstBill ? (bill.cgstAmount + bill.sgstAmount + bill.igstAmount) : 0;
        const fallbackRate = bill.subTotal > 0 ? (billTaxTotal / bill.subTotal) * 100 : 0; // Fallback rate as %

        bill.items.forEach(item => {
          const itemTaxable = item.discountedAmount || item.amount;
          const taxRatePercent = item.gstRate != null ? item.gstRate : fallbackRate; // Per-item rate in %
          const taxAmount = itemTaxable * (taxRatePercent / 100);
          const purchaseItem: GSTItem = {
            invoiceNumber: bill.invoiceNumber,
            date: bill.date,
            customerName: bill.customerName,
            customerGstin: bill.customerGstin,
            hsnCode: item.hsnCode || '',
            quantity: item.quantity,
            taxableValue: itemTaxable,
            taxRate: Math.round(taxRatePercent * 100) / 100,
            taxAmount: taxAmount || 0,
            itemDescription: item.productName,
          };
          purchaseItems.push(purchaseItem);           // Append simulated purchase item
          totalTaxableValue += purchaseItem.taxableValue;
          totalTaxAmount += purchaseItem.taxAmount;
        });
      }
    });

    // Preserve existing filing date and status if a GSTR-2 was previously filed
    const existingGSTR2 = load<GSTR2Data[]>(TAX_DB_KEYS.GSTR2_DATA, []).find(
      g => g.month === month && g.year === year
    );

    const gstr2: GSTR2Data = {
      month,
      year,
      filingDate: existingGSTR2?.filingDate,           // Preserve 'filed' date if previously filed
      purchaseItems,
      totalTaxableValue,
      totalTaxAmount,
      status: existingGSTR2?.status || 'draft',        // Default to 'draft' if not yet filed
    };

    TaxComplianceService.logTaxAudit('GSTR-2 Generated', `GSTR-2 data generated for ${month}/${year}`, totalTaxAmount);
    return gstr2;
  },

  /**
   * Save GSTR-1 filing
   */
  // Upsert the GSTR-1 record for the given month/year into localStorage
  saveGSTR1: (gstr1: GSTR1Data) => {
    const gstr1List = load<GSTR1Data[]>(TAX_DB_KEYS.GSTR1_DATA, []); // Load existing GSTR-1 filings
    const existingIndex = gstr1List.findIndex(g => g.month === gstr1.month && g.year === gstr1.year); // Find matching period
    
    if (existingIndex >= 0) {
      gstr1List[existingIndex] = gstr1;  // Replace existing record for this period
    } else {
      gstr1List.push(gstr1);             // New period â€” append the record
    }
    save(TAX_DB_KEYS.GSTR1_DATA, gstr1List); // Persist the updated list
    TaxComplianceService.logTaxAudit('GSTR-1 Saved', `GSTR-1 saved for ${gstr1.month}/${gstr1.year}`, gstr1.totalTaxAmount);
  },

  /**
   * Save GSTR-2 filing
   */
  // Upsert the GSTR-2 record for the given month/year into localStorage
  saveGSTR2: (gstr2: GSTR2Data) => {
    const gstr2List = load<GSTR2Data[]>(TAX_DB_KEYS.GSTR2_DATA, []); // Load existing GSTR-2 filings
    const existingIndex = gstr2List.findIndex(g => g.month === gstr2.month && g.year === gstr2.year); // Find matching period
    
    if (existingIndex >= 0) {
      gstr2List[existingIndex] = gstr2;  // Replace existing record for this period
    } else {
      gstr2List.push(gstr2);             // New period â€” append the record
    }
    save(TAX_DB_KEYS.GSTR2_DATA, gstr2List); // Persist the updated list
    TaxComplianceService.logTaxAudit('GSTR-2 Saved', `GSTR-2 saved for ${gstr2.month}/${gstr2.year}`, gstr2.totalTaxAmount);
  },

  /**
   * Get all GSTR-1 filings
   */
  // Return all saved GSTR-1 filing objects from localStorage
  getGSTR1List: (): GSTR1Data[] => load(TAX_DB_KEYS.GSTR1_DATA, []),

  /**
   * Get all GSTR-2 filings
   */
  // Return all saved GSTR-2 filing objects from localStorage
  getGSTR2List: (): GSTR2Data[] => load(TAX_DB_KEYS.GSTR2_DATA, []),

  /**
   * Calculate TDS (Tax Deducted at Source) - 2% standard
   */
  // Calculate the TDS amount for a given bill amount at the specified rate (default 2%)
  calculateTDS: (billAmount: number, tdsRate: number = 2): number => {
    return (billAmount * tdsRate) / 100; // Standard formula: amount Ã— rate / 100
  },

  /**
   * Calculate Excise Duty - 5% standard for ayurvedic medicines
   */
  // Calculate excise duty for a given taxable value at the specified rate (default 5% for ayurvedic)
  calculateExciseDuty: (taxableValue: number, exciseRate: number = 5): number => {
    return (taxableValue * exciseRate) / 100; // Excise = taxable Ã— rate / 100
  },

  /**
   * Add tax adjustment (TDS, Excise, etc.)
   */
  // Append a new tax adjustment record (TDS/Excise/other) to the localStorage list and log the audit trail
  addTaxAdjustment: (adjustment: TaxAdjustment) => {
    const adjustments = load<TaxAdjustment[]>(TAX_DB_KEYS.TAX_ADJUSTMENTS, []); // Load existing adjustments
    adjustments.push(adjustment);                                                 // Append the new adjustment
    save(TAX_DB_KEYS.TAX_ADJUSTMENTS, adjustments);                              // Persist the updated list
    TaxComplianceService.logTaxAudit(
      `Tax Adjustment: ${adjustment.type}`, // e.g. 'Tax Adjustment: tds'
      adjustment.description,
      adjustment.amount
    );
  },

  /**
   * Get all tax adjustments
   */
  // Return all saved tax adjustment records from localStorage
  getTaxAdjustments: (): TaxAdjustment[] => load(TAX_DB_KEYS.TAX_ADJUSTMENTS, []),

  /**
   * Log tax audit trail
   */
  // Append a single line to the tax action audit log.
   // Every GSTR generation, filing, reconciliation, and compliance check is logged here.
  logTaxAudit: (action: string, details: string, taxImpact: number) => {
    const logs = load<TaxAuditLog[]>(TAX_DB_KEYS.TAX_AUDIT_LOGS, []); // Load existing audit entries
    const log: TaxAuditLog = {
      id: `audit_${Date.now()}`,          // Unique ID using current Unix timestamp
      timestamp: new Date().toISOString(), // ISO datetime of the action
      action,                              // Short action label e.g. 'GSTR-1 Generated'
      details,                             // Human-readable description
      taxImpact,                           // Tax amount affected by this action
    };
    logs.push(log);                        // Append the new entry
    save(TAX_DB_KEYS.TAX_AUDIT_LOGS, logs); // Persist (save() handles quota pruning if needed)
  },

  /**
   * Get tax audit logs
   */
  // Return all saved tax audit log entries from localStorage
  getTaxAuditLogs: (): TaxAuditLog[] => load(TAX_DB_KEYS.TAX_AUDIT_LOGS, []),

  /**
   * Add compliance alert
   */
  // Append a compliance alert (filing deadline, reconciliation mismatch, etc.) to the active alerts list
  addComplianceAlert: (alert: ComplianceAlert) => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []); // Load existing alerts
    alerts.push(alert);                                                          // Append the new alert
    save(TAX_DB_KEYS.COMPLIANCE_ALERTS, alerts);                                // Persist the updated list
  },

  /**
   * Get active compliance alerts
   */
  // Return only the alerts that are still in 'active' status (dismiss to hide them)
  getComplianceAlerts: (): ComplianceAlert[] => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []); // Load all alerts
    return alerts.filter(a => a.status === 'active');                           // Keep only those not yet dismissed
  },

  /**
   * Dismiss compliance alert
   */
  // Mark an alert as 'dismissed' so it no longer appears in the active alerts list
  dismissAlert: (alertId: string) => {
    const alerts = load<ComplianceAlert[]>(TAX_DB_KEYS.COMPLIANCE_ALERTS, []); // Load all alerts
    const alert = alerts.find(a => a.id === alertId);                          // Find the target alert
    if (alert) {
      alert.status = 'dismissed';                                               // Change status to dismissed
      save(TAX_DB_KEYS.COMPLIANCE_ALERTS, alerts);                             // Persist the updated list
    }
  },

  /**
   * Reconcile GSTR-1 and GSTR-2 for a month
   */
  // Compare GSTR-1 (sales) and GSTR-2 (purchases) tax amounts for the given period
  // and determine whether they are within 1% tolerance ('reconciled') or need review.
  reconcileTaxes: (month: number, year: number): TaxReconciliation => {
    const gstr1List = TaxComplianceService.getGSTR1List(); // All GSTR-1 filings
    const gstr2List = TaxComplianceService.getGSTR2List(); // All GSTR-2 filings

    const gstr1 = gstr1List.find(g => g.month === month && g.year === year); // This period's GSTR-1
    const gstr2 = gstr2List.find(g => g.month === month && g.year === year); // This period's GSTR-2

    const gstr1TaxableValue = gstr1?.totalTaxableValue || 0; // 0 if no GSTR-1 exists for this period
    const gstr1TaxAmount = gstr1?.totalTaxAmount || 0;       // 0 if no GSTR-1 exists
    const gstr2TaxableValue = gstr2?.totalTaxableValue || 0; // 0 if no GSTR-2 exists for this period
    const gstr2TaxAmount = gstr2?.totalTaxAmount || 0;       // 0 if no GSTR-2 exists

    const discrepancy = gstr1TaxAmount - gstr2TaxAmount;                                        // Absolute difference
    const discrepancyPercent = gstr1TaxAmount > 0 ? (discrepancy / gstr1TaxAmount) * 100 : 0;  // Relative difference %

    const reconciliation: TaxReconciliation = {
      month,
      year,
      gstr1TaxableValue,
      gstr1TaxAmount,
      gstr2TaxableValue,
      gstr2TaxAmount,
      irrReceivedAmount: 0,   // ITC received (not tracked â€” placeholder)
      irrFiledAmount: 0,      // ITC filed (not tracked â€” placeholder)
      discrepancy,
      discrepancyPercent,
      status: Math.abs(discrepancyPercent) < 1 ? 'reconciled' : 'needs_review', // Within 1% = reconciled
    };

    TaxComplianceService.logTaxAudit(
      'Tax Reconciliation',
      `Reconciliation for ${month}/${year}`,
      discrepancy // Log the discrepancy amount as the tax impact
    );

    return reconciliation;
  },

  /**
   * Generate tax summary for a month
   */
  // Sum CGST, SGST, and IGST collected from GST bills in the given period.
  // Subtracts any TDS adjustments to arrive at the net tax liability.
  generateTaxSummary: (bills: Bill[], month: number, year: number): TaxSummary => {
    let cgstCollected = 0;  // Central GST collected this period
    let sgstCollected = 0;  // State GST collected this period
    let igstCollected = 0;  // Integrated GST collected this period

    bills.forEach(bill => {
      const billDate = new Date(bill.date);
      if (billDate.getMonth() + 1 === month && billDate.getFullYear() === year && bill.isGstBill) {
        // Only GST bills contribute to tax summary
        cgstCollected += bill.cgstAmount; // Accumulate CGST
        sgstCollected += bill.sgstAmount; // Accumulate SGST
        igstCollected += bill.igstAmount; // Accumulate IGST
      }
    });

    const totalGstCollected = cgstCollected + sgstCollected + igstCollected; // Total GST collected from customers

    // For simplicity, liabilities = collected amounts (no ITC deductions tracked)
    const cgstLiability = cgstCollected;  // CGST due to government
    const sgstLiability = sgstCollected;  // SGST due to government
    const igstLiability = igstCollected;  // IGST due to government
    const totalGstLiability = cgstLiability + sgstLiability + igstLiability; // Total GST liability

    // Look up any TDS adjustments that can reduce the net liability for this period
    const adjustments = TaxComplianceService.getTaxAdjustments(); // Load all adjustments
    const tdsAdjustments = adjustments
      .filter(a => {
        const adjDate = new Date(a.date);
        return adjDate.getMonth() + 1 === month && adjDate.getFullYear() === year && a.type === 'tds'; // TDS only
      })
      .reduce((sum, a) => sum + a.amount, 0); // Sum all TDS adjustments for this period

    const netTaxLiability = totalGstLiability - tdsAdjustments; // Net payable after TDS credit

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
  // Auto-generate compliance alerts for upcoming GSTR-1 filing deadlines and unresolved reconciliation gaps.
  // Should be called on dashboard load or periodically in the background.
  checkCompliance: (bills: Bill[], settings: any) => {
    const today = new Date();           // Current date for deadline comparisons
    const month = today.getMonth() + 1; // Current month (1-indexed)
    const year = today.getFullYear();   // Current year

    // GSTR-1 must be filed by the 10th of the following month
    const gstr1Deadline = new Date(year, month, 10); // 10th of the month AFTER current
    const gstr1Filed = TaxComplianceService.getGSTR1List().some(
      g => g.month === (month === 12 ? 1 : month + 1) && g.year === (month === 12 ? year + 1 : year) && g.status === 'filed'
    );

    // Alert if deadline is within 2 days and GSTR-1 hasn't been filed yet
    if (!gstr1Filed && today >= new Date(gstr1Deadline.getTime() - 2 * 24 * 60 * 60 * 1000)) {
      const existingAlert = TaxComplianceService.getComplianceAlerts().find(
        a => a.type === 'filing_due' && a.title.includes('GSTR-1') // Only add if no existing GSTR-1 deadline alert
      );

      if (!existingAlert) {
        TaxComplianceService.addComplianceAlert({
          id: `alert_gstr1_${Date.now()}`,             // Unique ID
          type: 'filing_due',                           // Deadline type
          severity: 'critical',                         // Needs immediate attention
          title: 'GSTR-1 Filing Due',
          description: 'GSTR-1 filing deadline approaching. Please file by 10th of next month.',
          dueDate: gstr1Deadline.toISOString(),         // The actual deadline
          status: 'active',
          createdDate: today.toISOString(),
        });
      }
    }

    // Check if last month's GSTR-1 and GSTR-2 totals differ (reconciliation needed)
    const lastReconciliation = new Date(today.getFullYear(), today.getMonth() - 1, 1); // First day of last month
    const gstr1 = TaxComplianceService.getGSTR1List().find(
      g => g.month === lastReconciliation.getMonth() + 1 && g.year === lastReconciliation.getFullYear()
    );
    const gstr2 = TaxComplianceService.getGSTR2List().find(
      g => g.month === lastReconciliation.getMonth() + 1 && g.year === lastReconciliation.getFullYear()
    );

    if (gstr1 && gstr2 && gstr1.totalTaxAmount !== gstr2.totalTaxAmount) {
      // Mismatch between GSTR-1 and GSTR-2 â€” add a reconciliation warning if not already active
      const existingAlert = TaxComplianceService.getComplianceAlerts().find(
        a => a.type === 'reconciliation_needed'
      );

      if (!existingAlert) {
        TaxComplianceService.addComplianceAlert({
          id: `alert_recon_${Date.now()}`, // Unique ID
          type: 'reconciliation_needed',   // Alert type
          severity: 'warning',             // Warning level (less urgent than deadline)
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
  // Return a condensed export object for both GSTR-1 and GSTR-2 for the portal filing workflow
  exportForFiling: (gstr1: GSTR1Data, gstr2: GSTR2Data) => {
    return {
      gstr1: {
        month: gstr1.month,                             // Filing month
        year: gstr1.year,                               // Filing year
        totalTaxableValue: gstr1.totalTaxableValue,     // Total supply value excluding tax
        totalTaxAmount: gstr1.totalTaxAmount,           // Total GST collected on sales
        itemCount: gstr1.gstItems.length,               // Number of line items in the return
        exportedOn: new Date().toISOString(),            // Timestamp of this export
      },
      gstr2: {
        month: gstr2.month,                             // Filing month
        year: gstr2.year,                               // Filing year
        totalTaxableValue: gstr2.totalTaxableValue,     // Total purchase value excluding tax
        totalTaxAmount: gstr2.totalTaxAmount,           // Total GST on purchases (ITC claim)
        itemCount: gstr2.purchaseItems.length,          // Number of purchase line items
        exportedOn: new Date().toISOString(),            // Timestamp of this export
      },
    };
  },
};
