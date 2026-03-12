
// Export a function that checks if a text contains a search query with flexible matching
export const searchMatch = (text: string, query: string): boolean => {
  // If query is empty, return true (all items match)
  if (!query) return true;
  // Convert query to lowercase and trim whitespace for case-insensitive matching
  const q = query.toLowerCase().trim();
  // Convert text to lowercase for comparison
  const t = text.toLowerCase();
  
  // Simple substring check - if text directly contains the query, it's a match
  // Simple substring
  if (t.includes(q)) return true;
  
  // Tokenized search (e.g. "vit c" matches "Vitamin C") - split query into tokens
  // Tokenized search (e.g. "vit c" matches "Vitamin C")
  const tokens = q.split(/\s+/).filter(token => token.length > 0);
  // If no tokens after filtering, return true (empty query)
  if (tokens.length === 0) return true;
  
  // Check if text contains all tokens (every word in query must be present)
  return tokens.every(token => t.includes(token));
};

// Export a function that converts numbers to words in Indian English format (Rupees and Paise)
export const numberToWords = (num: number): string => {
  // Define array of words for single digits (0-9) and teens (11-19)
  const a = [
      // Representing 0-19 in words
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 
      // Words for 11-19
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  // Define array of words for tens place (20, 30, 40, etc.)
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  // Helper function to get words for numbers less than 20
  const getLT20 = (n: number) => a[n];
  // Helper function to get words for numbers 20 and above
  const getGT20 = (n: number) => b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');

  // Helper function to convert integers to words
  const convertInteger = (value: number): string => {
    // If value is 0, return empty string
    if (value === 0) return '';
    // Convert value to string for processing
    const numStr = Math.floor(value).toString();
    // If number exceeds 9 digits (999,999,999), return overflow message
    if (numStr.length > 9) return 'Overflow';

    // Pad with zeros to 9 digits and extract parts: Crore, Lakh, Thousand, Hundred, Ones
    const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    // If regex doesn't match, return empty string
    if (!n) return '';

    // Build the words string by concatenating each part if non-zero
    let str = '';
    // Add Crore part (10 million) if non-zero
    str += (Number(n[1]) !== 0) ? (getLT20(Number(n[1])) || getGT20(Number(n[1]))) + 'Crore ' : '';
    // Add Lakh part (100 thousand) if non-zero
    str += (Number(n[2]) !== 0) ? (getLT20(Number(n[2])) || getGT20(Number(n[2]))) + 'Lakh ' : '';
    // Add Thousand part if non-zero
    str += (Number(n[3]) !== 0) ? (getLT20(Number(n[3])) || getGT20(Number(n[3]))) + 'Thousand ' : '';
    // Add Hundred part if non-zero
    str += (Number(n[4]) !== 0) ? (getLT20(Number(n[4])) || getGT20(Number(n[4]))) + 'Hundred ' : '';
    // Add Ones part if non-zero, with 'and' if there are preceding parts
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (getLT20(Number(n[5])) || getGT20(Number(n[5]))) : '';
    // Return trimmed string
    return str.trim();
  };

  // If number is 0, return special case
  if (num === 0) return 'Zero Rupees Only';

  // Extract rupees (whole number part) from the amount
  const rupees = Math.floor(Math.abs(num));
  // Extract paise (decimal part) - multiply by 100 to get paise value and round
  const paise = Math.round((Math.abs(num) - rupees) * 100);

  // Initialize result string
  let result = '';
  // If rupees part is greater than 0
  if (rupees > 0) {
    // Convert rupees to words
    const rupeesWords = convertInteger(rupees);
    // If conversion fails (overflow), return overflow message
    if (rupeesWords === 'Overflow') return 'Overflow';
    // Add rupees to result
    result = rupeesWords + ' Rupees';
  }

  // If paise part is greater than 0
  if (paise > 0) {
    // Convert paise to words
    const paiseWords = convertInteger(paise);
    // If result already contains rupees, append paise with 'and'
    if (result) {
      result += ' and ' + paiseWords + ' Paise';
    } else {
      // If only paise, just use paise words
      result = paiseWords + ' Paise';
    }
  }

  // Return final result with "Only" suffix (standard in Indian invoicing)
  return (result || 'Zero Rupees') + ' Only';
};

// Generate a self-contained HTML invoice string with inline styles.
/**
 * Generate a self-contained HTML invoice string with inline styles.
 * Used by PDF download and print — never depends on Tailwind CSS.
 * Designed to fit within a single A4 page (210×297mm).
 */
// Export function to generate HTML invoice from bill and company settings
export const generateInvoiceHTML = (
  // Parameter: bill object containing invoice details and items
  bill: { invoiceNumber: string; date: string; customerName: string; customerPhone: string; customerAddress?: string; customerGstin?: string; salesPersonName: string; isGstBill: boolean; subTotal: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; totalTax: number; roundOff: number; grandTotal: number; items: { productName: string; hsnCode?: string; quantity: number; rate: number; amount: number; discount?: number; discountedAmount?: number; batchNumber?: string; expiryDate?: string }[] },
  // Parameter: settings object with company information
  settings: { name: string; tagline: string; subtitle?: string; certifications?: string; address: string; factoryAddress?: string; phone: string; email: string; website?: string; instagram?: string; logo?: string; gstin: string; panNumber?: string; stateName?: string; stateCode?: string; gstBankName: string; gstAccountNo: string; gstIfsc: string; gstBranch?: string; gstUpi?: string; nonGstBankName: string; nonGstAccountNo: string; nonGstIfsc: string; nonGstBranch?: string; nonGstUpi?: string; invoicePrefix: string; footerText?: string; terms?: string }
): string => {
  // Define escape function to sanitize HTML special characters
  const esc = (s?: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Define format function to display numbers as currency with rupee symbol
  const fmt = (n: number) => '₹' + n.toFixed(2);
  // Convert bill date to locale-specific date string (Indian format: DD/MM/YYYY)
  const dateStr = new Date(bill.date).toLocaleDateString('en-IN');

  // Get terms list - either from settings or use default terms
  const termsList = settings.terms
    // If terms exist in settings, split by newline and filter empty lines
    ? settings.terms.split('\n').filter(t => t.trim())
    // Otherwise use default terms for Natural Health World
    : ['Goods once sold will not be taken back.', 'Interest @ 18% p.a. will be charged if bill is not paid within due date.', 'Subject to Kolkata Jurisdiction.'];

  // Select bank details based on whether this is a GST bill or cash bill
  const bank = bill.isGstBill
    // For GST bills, use GST bank account details
    ? { name: settings.gstBankName, acNo: settings.gstAccountNo, ifsc: settings.gstIfsc, branch: settings.gstBranch, upi: settings.gstUpi }
    // For cash bills, use non-GST bank or 'Cash' as fallback
    : { name: settings.nonGstBankName || 'Cash', acNo: settings.nonGstAccountNo || '-', ifsc: settings.nonGstIfsc, branch: settings.nonGstBranch, upi: settings.nonGstUpi };

  // Map bill items to HTML table rows
  const itemRows = bill.items.map((item, i) => {
    // Format expiry date - convert from YYYY-MM to MM/YYYY format
    const exp = item.expiryDate ? (item.expiryDate.length === 7 ? `${item.expiryDate.split('-')[1]}/${item.expiryDate.split('-')[0]}` : item.expiryDate) : '';
    // Return HTML table row with item details
    return `<tr>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280">${i+1}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;font-weight:500">${esc(item.productName)}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280">${esc(item.hsnCode) || '-'}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;color:#6b7280">${item.batchNumber ? esc(item.batchNumber) : ''}${exp ? (item.batchNumber ? '<br/>' : '') + exp : ''}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${item.quantity}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:right">${item.rate.toFixed(2)}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:right">${item.discount ? item.discount.toFixed(0) + '%' : '-'}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${(item.discountedAmount || item.amount).toFixed(2)}</td>
    </tr>`;
  // Join all rows into a single string
  }).join('');

  // Build tax rows HTML based on bill type
  // Tax rows
  let taxRows = '';
  // If this is a GST bill
  if (bill.isGstBill) {
    // If IGST is applied (interstate transaction)
    if (bill.igstAmount > 0) {
      // Show only IGST row
      taxRows = `<tr><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">IGST</td><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(bill.igstAmount)}</td></tr>`;
    } else {
      // Show CGST and SGST rows (intrastate transaction)
      taxRows = `<tr><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">CGST</td><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(bill.cgstAmount)}</td></tr>
      <tr><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">SGST</td><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(bill.sgstAmount)}</td></tr>`;
    }
  }

  // Build round-off row if rounding adjustment is non-zero
  const roundOffRow = bill.roundOff !== 0
    // If round-off is not zero, show the row
    ? `<tr><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">Round Off</td><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;text-align:right">${bill.roundOff > 0 ? '+' : ''}${bill.roundOff.toFixed(2)}</td></tr>`
    // If round-off is zero, don't show the row
    : '';

  // Build GST information block if this is a GST bill
  const gstInfoBlock = bill.isGstBill
    ? `<div style="margin-top:8px;padding:4px 6px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;font-size:10px;text-align:left">
        <div><b>GSTIN:</b> ${esc(settings.gstin)}</div>
        ${settings.panNumber ? `<div><b>PAN:</b> ${esc(settings.panNumber)}</div>` : ''}
        ${settings.stateName ? `<div><b>State:</b> ${esc(settings.stateName)} (${esc(settings.stateCode)})</div>` : ''}
      </div>`
    : '';

  // Return complete HTML invoice template with all sections
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;font-size:11px;padding:0;margin:0;box-sizing:border-box">
  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f2937;padding-bottom:8px;margin-bottom:8px">
    <div style="display:flex;gap:10px;align-items:flex-start">
      ${settings.logo ? `<img src="${settings.logo}" style="height:50px;width:auto;object-fit:contain" />` : ''}
      <div>
        <div style="font-size:20px;font-weight:bold;color:#166534;text-transform:uppercase;letter-spacing:1px">${esc(settings.name)}</div>
        <div style="font-weight:bold;font-size:13px;color:#374151">${esc(settings.tagline)}</div>
        ${settings.subtitle ? `<div style="font-size:10px;color:#6b7280;font-style:italic">${esc(settings.subtitle)}</div>` : ''}
        <div style="font-size:9px;color:#6b7280;margin-top:4px">
          <div><b>Office:</b> ${esc(settings.address)}</div>
          ${settings.factoryAddress ? `<div><b>Factory:</b> ${esc(settings.factoryAddress)}</div>` : ''}
          <div style="margin-top:2px">📞 ${esc(settings.phone)} &nbsp; ✉ ${esc(settings.email)}</div>
          ${settings.instagram ? `<div>📷 ${esc(settings.instagram)}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="text-align:right;min-width:160px">
      <div style="font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;color:#9ca3af">${bill.isGstBill ? 'Tax Invoice' : 'Invoice'}</div>
      <div style="margin-top:8px"><div style="font-size:9px;text-transform:uppercase;color:#6b7280">Invoice No</div><div style="font-weight:bold;font-size:14px">${esc(bill.invoiceNumber)}</div></div>
      <div style="margin-top:4px"><div style="font-size:9px;text-transform:uppercase;color:#6b7280">Date</div><div style="font-weight:bold">${dateStr}</div></div>
      ${gstInfoBlock}
    </div>
  </div>

  <!-- CUSTOMER -->
  <div style="background:#f9fafb;padding:8px 10px;border-radius:4px;border:1px solid #f3f4f6;margin-bottom:8px">
    <div style="font-weight:bold;text-transform:uppercase;font-size:9px;color:#6b7280;margin-bottom:2px">Billed To</div>
    <div style="font-weight:bold;font-size:13px">${esc(bill.customerName)}</div>
    <div style="color:#374151">${esc(bill.customerPhone)}</div>
    ${bill.customerAddress ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;max-width:300px">${esc(bill.customerAddress)}</div>` : ''}
    ${bill.customerGstin ? `<div style="font-family:monospace;font-size:10px;margin-top:3px;font-weight:bold;background:white;display:inline-block;padding:1px 4px;border:1px solid #e5e7eb">GSTIN: ${esc(bill.customerGstin)}</div>` : ''}
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px">
    <thead>
      <tr style="background:#1f2937;color:white">
        <th style="padding:4px;text-align:center;width:24px">#</th>
        <th style="padding:4px;text-align:left">Item Description</th>
        <th style="padding:4px;text-align:center;width:50px">HSN</th>
        <th style="padding:4px;text-align:left;width:60px">Batch/Exp</th>
        <th style="padding:4px;text-align:right;width:30px">Qty</th>
        <th style="padding:4px;text-align:right;width:50px">Rate</th>
        <th style="padding:4px;text-align:right;width:36px">Disc</th>
        <th style="padding:4px;text-align:right;width:60px">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:6px">
    <table style="width:220px;border-collapse:collapse;font-size:10px">
      <tr><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;color:#4b5563">Taxable Amount</td><td style="padding:2px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmt(bill.taxableAmount)}</td></tr>
      ${taxRows}
      ${roundOffRow}
      <tr style="background:#1f2937;color:white;font-weight:bold;font-size:13px"><td style="padding:6px 8px;border-radius:3px 0 0 3px">Grand Total</td><td style="padding:6px 8px;text-align:right;border-radius:0 3px 3px 0">${fmt(bill.grandTotal)}</td></tr>
    </table>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div style="background:#f9fafb;padding:5px 8px;border-radius:3px;border:1px solid #e5e7eb;margin-bottom:6px;font-size:10px">
    <b>Amount in Words:</b>
    <i>${numberToWords(bill.grandTotal)}</i>
  </div>

  <!-- BANK DETAILS -->
  <div style="background:#f9fafb;padding:5px 8px;border-radius:3px;border:1px solid #e5e7eb;margin-bottom:6px;font-size:10px">
    <div style="font-weight:bold;text-transform:uppercase;font-size:9px;color:#6b7280;margin-bottom:2px">Bank Details for Payment</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px 20px">
      <span><span style="color:#6b7280">Bank:</span> <b>${esc(bank.name)}</b></span>
      <span><span style="color:#6b7280">A/c No:</span> <b style="font-family:monospace">${esc(bank.acNo)}</b></span>
      <span><span style="color:#6b7280">IFSC:</span> <span style="font-family:monospace">${esc(bank.ifsc)}</span></span>
      ${bank.branch ? `<span><span style="color:#6b7280">Branch:</span> ${esc(bank.branch)}</span>` : ''}
      ${bank.upi ? `<span><span style="color:#6b7280">UPI:</span> ${esc(bank.upi)}</span>` : ''}
    </div>
  </div>

  <!-- FOOTER: Terms + Signature -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:2px dashed #d1d5db;padding-top:6px;margin-top:4px;font-size:9px;color:#6b7280">
    <div style="width:55%;padding-right:10px">
      <div style="font-weight:bold;margin-bottom:2px">Terms & Conditions:</div>
      <ul style="margin:0;padding-left:14px">${termsList.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
    <div style="text-align:center;width:35%">
      ${settings.certifications ? `<div style="font-size:9px;font-weight:600;color:#166534;background:#f0fdf4;padding:2px 6px;border-radius:3px;display:inline-block;margin-bottom:6px">${esc(settings.certifications)}</div>` : ''}
      <div style="font-weight:bold;font-size:14px;text-transform:uppercase;color:#1f2937;margin-bottom:30px">${esc(settings.name)}</div>
      <div style="border-top:1px solid #9ca3af;padding-top:2px">Authorised Signatory</div>
    </div>
  </div>

  ${settings.footerText ? `<div style="text-align:center;font-size:9px;color:#9ca3af;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:3px">${esc(settings.footerText)}</div>` : ''}
</div>`;
};

// Save a CSV string using Tauri's native save dialog.
/**
 * Save a CSV string using Tauri's native save dialog.
 * Falls back to browser download if Tauri is not available.
 */
// Export async function to save CSV file with fallback support
export const saveCsvFile = async (filename: string, csvContent: string): Promise<void> => {
  try {
    // Try to import Tauri's dialog plugin
    const { save } = await import('@tauri-apps/plugin-dialog');
    // Try to import Tauri's file system plugin
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    // Open native save dialog to get file path from user
    const filePath = await save({
      // Set default filename for the save dialog
      defaultPath: filename,
      // Set file type filter for CSV files
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    // If user selected a path (not cancelled)
    if (filePath) {
      // Write CSV content to the selected file path
      await writeTextFile(filePath, csvContent);
    }
  // If Tauri is not available, fall back to browser download
  } catch {
    // Fallback: browser download - create a blob from CSV content with UTF-8 encoding
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    // Create a temporary URL for the blob object
    const url = URL.createObjectURL(blob);
    // Create a temporary anchor element
    const link = document.createElement('a');
    // Set the href to the blob URL
    link.href = url;
    // Set the download attribute with the filename
    link.download = filename;
    // Append the anchor to the document body
    document.body.appendChild(link);
    // Trigger the click event to start download
    link.click();
    // Remove the anchor from the document after download completes
    document.body.removeChild(link);
    // Revoke the blob URL to free up memory
    URL.revokeObjectURL(url);
  }
};