/**
 * Pure jsPDF-based invoice PDF generator.
 * No DOM rendering, no html2canvas — builds the PDF programmatically.
 * 100% reliable in Tauri WebView2 / Chromium environments.
 */
import { jsPDF } from 'jspdf'; // jsPDF library — generates PDF files entirely in JavaScript without any server
import { numberToWords } from '../utils'; // Utility to convert a numeric amount to its English words representation (e.g. 1050 → "One Thousand Fifty")

// Internal shape of a bill passed into the PDF generator — mirrors the Bill type but flattened for PDF rendering
interface InvoiceBill {
  invoiceNumber: string;       // Formatted invoice number e.g. "INV/0042/24-25"
  date: string;                // ISO date string of the bill date
  customerName: string;        // Customer's full name printed in the "BILLED TO" box
  customerPhone: string;       // Customer's phone number printed below their name
  customerAddress?: string;    // Optional: delivery/billing address printed if provided
  customerGstin?: string;      // Optional: customer's GST registration number for B2B invoices
  salesPersonName: string;     // Name of the sales person who created the bill
  isGstBill: boolean;          // true → full GST invoice with tax breakdown; false → simple invoice
  subTotal: number;            // Sum of all item amounts before any discount or tax
  taxableAmount: number;       // Subtotal after discount — the base on which GST is computed
  cgstAmount: number;          // Central GST component (half of total GST for intra-state sales)
  sgstAmount: number;          // State GST component (the other half for intra-state sales)
  igstAmount: number;          // Integrated GST amount used for inter-state sales (replaces CGST+SGST)
  totalTax: number;            // Total tax = CGST + SGST or IGST (whichever applies)
  roundOff: number;            // Rounding adjustment (+/−0.49) to make grandTotal a whole number
  grandTotal: number;          // Final payable amount after tax and round-off
  items: {                     // Array of line items sold on this bill
    productName: string;       // Product name printed in the items table
    hsnCode?: string;          // HSN/SAC code for GST classification; printed in table or "−" if absent
    quantity: number;          // Units sold
    rate: number;              // Per-unit selling price before discount
    amount: number;            // rate × quantity (before discount)
    discount?: number;         // Discount percentage applied (e.g. 10 for 10%)
    discountedAmount?: number; // amount after discount = amount − (amount × discount / 100)
    batchNumber?: string;      // Batch number for pharma/FSSAI traceability; optional
    expiryDate?: string;       // Expiry date in YYYY-MM or full date format; displayed as MM/YYYY
  }[];
}

// Company/store settings used to personalise every printed invoice
interface InvoiceSettings {
  name: string;           // Company trade name — printed in GREEN uppercase at top-left
  tagline: string;        // One-line brand slogan printed below the name
  subtitle?: string;      // Optional: secondary tagline printed in italic grey below tagline
  certifications?: string; // Optional: ISO/FSSAI/organic cert string shown above signature
  address: string;        // Registered/office address printed in the header
  factoryAddress?: string; // Optional: factory address — printed on a second line if provided
  phone: string;          // Contact phone number for the header
  email: string;          // Contact email for the header
  website?: string;       // Optional: website URL (not currently printed but stored)
  instagram?: string;     // Optional: Instagram handle printed in the header
  logo?: string;          // Optional: base64-encoded logo image (not rendered in current version)
  gstin: string;          // Company's GST Identification Number printed in the GST info box
  panNumber?: string;     // Optional: PAN printed in the GST info box
  stateName?: string;     // Optional: state name for the GST info box (e.g. "West Bengal")
  stateCode?: string;     // Optional: state code printed alongside stateName
  gstBankName: string;    // Bank name used for GST bills (e.g. primary business account)
  gstAccountNo: string;   // Account number for GST bills
  gstIfsc: string;        // IFSC code for GST bills
  gstBranch?: string;     // Optional: branch name for GST bills
  gstUpi?: string;        // Optional: UPI ID for GST bills
  nonGstBankName: string; // Bank name for non-GST / cash invoices
  nonGstAccountNo: string; // Account number for non-GST bills
  nonGstIfsc: string;     // IFSC for non-GST bills
  nonGstBranch?: string;  // Optional: branch for non-GST bills
  nonGstUpi?: string;     // Optional: UPI ID for non-GST bills
  invoicePrefix: string;  // Prefix string for invoice numbering (e.g. "INV")
  footerText?: string;    // Optional: centred footer text printed below the dashed separator
  terms?: string;         // Optional: newline-separated terms & conditions; defaults to 3 standard terms if absent
}

// A4 dimensions in mm
const PAGE_W = 210;  // A4 page width in millimetres
const PAGE_H = 297;  // A4 page height in millimetres
const MARGIN = 10;   // Left, right, and top margin in mm — gives a clean 10 mm border
const CONTENT_W = PAGE_W - 2 * MARGIN; // Usable content width = 210 − 20 = 190 mm

// Colors — every color is a [R, G, B] tuple matching the HTML/CSS preview values
const DARK = [31, 41, 55] as const;          // #1f2937 — near-black used for headings, table header bg, grand total bg
const GREEN = [22, 101, 52] as const;        // #166534 — dark green for company name and certifications text
const GRAY = [107, 114, 128] as const;       // #6b7280 — medium grey for secondary labels (addresses, field names)
const LIGHT_GRAY = [249, 250, 251] as const; // #f9fafb — very light grey background for bordered info boxes
const BORDER = [229, 231, 235] as const;     // #e5e7eb — subtle grey border colour used throughout
const WHITE = [255, 255, 255] as const;      // Pure white — used for text on dark backgrounds (table header, grand total row)
const MUTED = [156, 163, 175] as const;      // #9ca3af — muted grey for secondary right-side labels like "TAX INVOICE"
const TEXT = [55, 65, 81] as const;          // #374151 — standard body-text colour
const LIGHT_BG = [243, 244, 246] as const;   // #f3f4f6 — slightly darker light grey (alternate use for bg sections)

const fmt = (n: number) => `Rs. ${n.toFixed(2)}`; // Format a number as Indian Rupees with 2 decimal places (e.g. 1050 → "Rs. 1050.00")

/**
 * Draw a filled rectangle.
 */
function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: readonly [number, number, number]) { // Helper: draw a solid filled rectangle at (x, y) with width w and height h in the given RGB color
  doc.setFillColor(color[0], color[1], color[2]); // Set jsPDF fill color to the provided RGB tuple
  doc.rect(x, y, w, h, 'F'); // Draw a filled (no border) rectangle using 'F' style
}

/**
 * Draw a bordered rectangle.
 */
function drawBorderedRect(doc: jsPDF, x: number, y: number, w: number, h: number, fillColor: readonly [number, number, number], borderColor: readonly [number, number, number]) { // Helper: draw a rectangle that has both a fill and a visible border
  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);   // Set the interior fill color
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]); // Set the border/stroke color
  doc.setLineWidth(0.2); // Set border line width to 0.2 mm (thin but visible)
  doc.rect(x, y, w, h, 'FD'); // 'FD' = Fill and Draw (border) — renders both fill and stroke at once
}

/**
 * Helper to wrap long text into lines that fit within maxWidth.
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] { // Split a long string into an array of shorter strings that each fit within maxWidth mm
  return doc.splitTextToSize(text, maxWidth); // jsPDF built-in: breaks text at spaces to stay within the given width in current font/size
}

/**
 * Internal: Generate the jsPDF document object.
 */
function generateInvoicePDFDoc(bill: InvoiceBill, settings: InvoiceSettings): jsPDF { // Private builder — constructs the complete jsPDF document for one invoice
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); // Create a new A4 portrait PDF with millimetre units
  let y = MARGIN; // Current vertical cursor position; moves down as content is added

  const dateStr = new Date(bill.date).toLocaleDateString('en-IN'); // Format the bill date for Indian locale (DD/MM/YYYY)
  const bank = bill.isGstBill // Pick the correct bank account details based on whether this is a GST bill
    ? { name: settings.gstBankName, acNo: settings.gstAccountNo, ifsc: settings.gstIfsc, branch: settings.gstBranch, upi: settings.gstUpi } // Use primary (GST) bank details for tax invoices
    : { name: settings.nonGstBankName || 'Cash', acNo: settings.nonGstAccountNo || '-', ifsc: settings.nonGstIfsc, branch: settings.nonGstBranch, upi: settings.nonGstUpi }; // Use secondary bank details for cash/non-GST invoices; fall back to "Cash" if not set

  const termsList = settings.terms // Parse the terms & conditions from settings
    ? settings.terms.split('\n').filter((t: string) => t.trim()) // Split multi-line terms string into individual non-empty lines
    : ['Goods once sold will not be taken back.', 'Interest @ 18% p.a. will be charged if bill is not paid within due date.', 'Subject to Kolkata Jurisdiction.']; // Default three standard terms when none are configured

  // =========================================================================
  // HEADER (matches generateInvoiceHTML preview exactly)
  // =========================================================================
  // Left side — Company name (20px → ~15pt, bold, green, uppercase)
  doc.setFont('helvetica', 'bold');                              // Switch to bold Helvetica for the company name
  doc.setFontSize(15);                                           // ~20px equivalent in jsPDF points
  doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);                // Dark green #166534 — brand colour
  doc.text(settings.name.toUpperCase(), MARGIN, y + 6);         // Print company name in UPPERCASE at top-left

  // Right side — Invoice type label (18px → ~14pt, bold, uppercase, light gray #9ca3af)
  doc.setFontSize(14);                                           // Slightly smaller than company name
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);               // Muted grey — secondary emphasis
  const invoiceType = bill.isGstBill ? 'TAX INVOICE' : 'INVOICE'; // GST bills = "TAX INVOICE"; simple bills = "INVOICE"
  doc.text(invoiceType, PAGE_W - MARGIN, y + 6, { align: 'right' }); // Right-align this label at the right margin

  y += 9; // Move cursor down past the company name/invoice type row

  // Tagline (13px → ~10pt, bold, #374151)
  doc.setFont('helvetica', 'bold');            // Bold font for tagline
  doc.setFontSize(10);                         // ~13px equivalent
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]); // Standard dark body text colour
  doc.text(settings.tagline, MARGIN, y + 3);   // Print tagline below the company name
  y += 5; // Move cursor down past the tagline

  // Subtitle (10px → ~8pt, italic, #6b7280)
  if (settings.subtitle) {                              // Only print if a subtitle is configured
    doc.setFont('helvetica', 'italic');                 // Italic for the subtitle
    doc.setFontSize(8);                                 // ~10px equivalent
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);        // Medium grey — less prominent than tagline
    doc.text(settings.subtitle, MARGIN, y + 2.5);       // Print subtitle below tagline
    y += 3.5; // Move cursor down past the subtitle line
  }

  // Address info (9px → ~7pt, #6b7280, bold labels)
  doc.setFontSize(7);                                   // Small font for address block
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);          // Grey colour for all address lines

  doc.setFont('helvetica', 'bold');                     // Bold label "Office: "
  doc.text('Office: ', MARGIN, y + 2.5);               // Print "Office:" label
  const officeX = MARGIN + doc.getTextWidth('Office: '); // Compute x position right after the "Office: " label
  doc.setFont('helvetica', 'normal');                   // Normal weight for the address value
  doc.text(settings.address, officeX, y + 2.5);        // Print office address on the same line
  y += 3; // Move down past the office address line

  if (settings.factoryAddress) {                        // Only print factory address if configured
    doc.setFont('helvetica', 'bold');                   // Bold "Factory: " label
    doc.text('Factory: ', MARGIN, y + 2.5);            // Print "Factory:" label
    const factX = MARGIN + doc.getTextWidth('Factory: '); // X position after the "Factory: " label
    doc.setFont('helvetica', 'normal');                 // Normal weight for the factory address
    doc.text(settings.factoryAddress, factX, y + 2.5); // Print factory address on the same line
    y += 3; // Move down past the factory address line
  }

  // Phone & Email line
  doc.setFont('helvetica', 'normal');                                    // Normal weight for contact info
  doc.text(`${settings.phone}   |   ${settings.email}`, MARGIN, y + 2.5); // Print phone and email separated by " | "
  y += 3; // Move down past the phone/email line

  if (settings.instagram) {          // Only print Instagram handle if configured
    doc.text(settings.instagram, MARGIN, y + 2.5); // Print Instagram handle on its own line
    y += 3; // Move down past the Instagram line
  }

  // Right side — Invoice No (positioned relative to right)
  const rightBlockStartY = MARGIN + 12; // Vertical start of the right-side invoice metadata block — 12 mm below top margin

  doc.setFont('helvetica', 'normal');                          // Normal weight for the "INVOICE NO" label
  doc.setFontSize(7);                                          // Small grey label above the invoice number
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);                 // Grey colour for the label
  doc.text('INVOICE NO', PAGE_W - MARGIN, rightBlockStartY, { align: 'right' }); // Print "INVOICE NO" label right-aligned

  doc.setFont('helvetica', 'bold');                                                    // Bold font for the invoice number value
  doc.setFontSize(11);                                                                  // Larger size so the invoice number stands out
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                                          // Near-black text colour for the number
  doc.text(bill.invoiceNumber, PAGE_W - MARGIN, rightBlockStartY + 4.5, { align: 'right' }); // Print the actual invoice number below the label

  // Date
  doc.setFont('helvetica', 'normal');                                                   // Normal weight for "DATE" label
  doc.setFontSize(7);                                                                   // Same small size as "INVOICE NO" label
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);                                          // Grey for the label
  doc.text('DATE', PAGE_W - MARGIN, rightBlockStartY + 9.5, { align: 'right' });        // Print "DATE" label above the date value
  doc.setFont('helvetica', 'bold');                                                    // Bold for the date value
  doc.setFontSize(8);                                                                   // Slightly larger than label
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                                          // Dark text for the date
  doc.text(dateStr, PAGE_W - MARGIN, rightBlockStartY + 13, { align: 'right' });        // Print the formatted date (DD/MM/YYYY) below "DATE"

  // GST Info box (if tax invoice) — bordered box matching HTML preview
  if (bill.isGstBill) {                                                        // Only render the GST info box for tax invoices
    const gstBoxY = rightBlockStartY + 16;                                     // Position the GST box below the date block
    const gstBoxX = PAGE_W - MARGIN - 55;                                     // Align the 55 mm wide box to the right margin
    const gstLines: string[] = [];                                             // Lines of text to print inside the bordered box
    gstLines.push(`GSTIN: ${settings.gstin}`);                                 // First line: company GSTIN
    if (settings.panNumber) gstLines.push(`PAN: ${settings.panNumber}`);       // Second line: PAN if configured
    if (settings.stateName) gstLines.push(`State: ${settings.stateName} (${settings.stateCode || ''})`); // Third line: state name and code

    const gstBoxH = 4 + gstLines.length * 3.2;                                // Box height = 4 mm padding + 3.2 mm per line
    drawBorderedRect(doc, gstBoxX, gstBoxY, 55, gstBoxH, LIGHT_GRAY, BORDER); // Draw light-grey bordered box for the GST info

    doc.setFont('helvetica', 'normal');                                        // Normal weight for GST info text
    doc.setFontSize(7);                                                        // Small text to fit in the box
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);                               // Dark text for readability
    for (let i = 0; i < gstLines.length; i++) {                               // Print each GST info line
      doc.text(gstLines[i], gstBoxX + 2, gstBoxY + 3 + i * 3.2);             // Indent 2 mm from left edge; space lines 3.2 mm apart
    }

    // Ensure y is past the GST box so separator doesn't overlap it
    const gstBoxBottom = gstBoxY + gstBoxH + 2;                               // Bottom of GST box + 2 mm clearance
    if (y < gstBoxBottom) y = gstBoxBottom;                                   // Push y cursor below the GST box if it hasn't gotten there yet
  }

  // Header separator (2px → ~0.7mm solid line matching HTML border-bottom: 2px)
  y += 1;                                                                      // Small gap before the separator line
  doc.setDrawColor(DARK[0], DARK[1], DARK[2]);                                 // Dark line colour — matches HTML section divider
  doc.setLineWidth(0.7);                                                       // 0.7 mm line width ≈ 2px CSS border
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);                                    // Draw horizontal rule spanning the full content width
  y += 3;                                                                      // Gap after the separator before the next section

  // =========================================================================
  // CUSTOMER SECTION
  // =========================================================================
  const custBoxH = 20 + (bill.customerAddress ? 3 : 0) + (bill.customerGstin ? 3 : 0); // Calculate box height: 20 mm base + 3 mm for address if present + 3 mm for GSTIN if present
  drawBorderedRect(doc, MARGIN, y, CONTENT_W, custBoxH, LIGHT_GRAY, BORDER); // Draw the bordered "BILLED TO" customer info box

  doc.setFont('helvetica', 'normal');                          // Normal weight for the "BILLED TO" label
  doc.setFontSize(6);                                          // Very small label font
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);                 // Grey colour for the label
  doc.text('BILLED TO', MARGIN + 3, y + 4);                   // Print "BILLED TO" header inside the box

  doc.setFont('helvetica', 'bold');                            // Bold for the customer name — most prominent item in the box
  doc.setFontSize(10);                                         // Larger font so the name is clearly readable
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                 // Dark text for the customer name
  doc.text(bill.customerName, MARGIN + 3, y + 9);             // Print customer name 9 mm from top of box

  doc.setFont('helvetica', 'normal');                          // Normal weight for phone number
  doc.setFontSize(8);                                          // Standard small body text size
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                 // Dark text for phone
  doc.text(bill.customerPhone, MARGIN + 3, y + 13);           // Print phone number below name

  let custY = y + 13; // Cursor within the customer box; starts after the phone number
  if (bill.customerAddress) {                                  // Only print address if it was provided
    custY += 3.5;                                              // Drop down 3.5 mm for address line
    doc.setFontSize(7);                                        // Smaller font for address
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);               // Grey for address text
    const addrLines = wrapText(doc, bill.customerAddress, 90); // Wrap address to fit within 90 mm
    doc.text(addrLines, MARGIN + 3, custY);                    // Print wrapped address lines
    custY += (addrLines.length - 1) * 2.5;                    // Advance cursor for each extra wrapped line
  }
  if (bill.customerGstin) {                                    // Only print GSTIN if the customer has one
    custY += 3.5;                                              // Drop down 3.5 mm for the GSTIN line
    doc.setFont('helvetica', 'bold');                          // Bold to highlight GSTIN
    doc.setFontSize(7);                                        // Small but bold text
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);               // Dark text for GSTIN
    doc.text(`GSTIN: ${bill.customerGstin}`, MARGIN + 3, custY); // Print "GSTIN: XXXXXXXXXXXXXX"
  }

  y += custBoxH + 3; // Advance global y cursor past the customer box plus 3 mm gap

  // =========================================================================
  // ITEMS TABLE
  // =========================================================================
  // Column positions
  const cols = {          // Left-edge x positions for each table column (all in mm from page left)
    num: MARGIN,          // "#" column — row number
    name: MARGIN + 8,     // "Item Description" column
    hsn: MARGIN + 80,     // "HSN" column — HSN/SAC code
    batch: MARGIN + 100,  // "Batch/Exp" column — batch number and expiry
    qty: MARGIN + 125,    // "Qty" column — units sold
    rate: MARGIN + 140,   // "Rate" column — per-unit price
    disc: MARGIN + 160,   // "Disc" column — discount percentage
    amt: MARGIN + 175,    // "Amount" column — final line amount
  };
  const colWidths = {  // Widths of each column in mm — must sum to ≤ CONTENT_W
    num: 8,            // Row number column width
    name: 72,          // Product name column width — largest to accommodate long names
    hsn: 20,           // HSN code column width
    batch: 25,         // Batch/expiry column width
    qty: 15,           // Quantity column width
    rate: 20,          // Rate column width
    disc: 15,          // Discount column width
    amt: 15,           // Amount column width
  };

  // Table header
  const headerH = 6; // Header row height in mm
  drawRect(doc, MARGIN, y, CONTENT_W, headerH, DARK); // Fill the header row with the near-black DARK colour

  doc.setFont('helvetica', 'bold');                                                          // Bold text for all header labels
  doc.setFontSize(7);                                                                        // Small font to fit all 8 column labels
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);                                            // White text on the dark header background
  doc.text('#', cols.num + 3, y + 4, { align: 'center' });                                  // Row number header
  doc.text('Item Description', cols.name + 1, y + 4);                                       // Product name header
  doc.text('HSN', cols.hsn + colWidths.hsn / 2, y + 4, { align: 'center' });               // HSN code header (centred)
  doc.text('Batch/Exp', cols.batch + 1, y + 4);                                             // Batch/expiry header
  doc.text('Qty', cols.qty + colWidths.qty - 1, y + 4, { align: 'right' });                 // Quantity header (right-aligned)
  doc.text('Rate', cols.rate + colWidths.rate - 1, y + 4, { align: 'right' });              // Rate header (right-aligned)
  doc.text('Disc', cols.disc + colWidths.disc - 1, y + 4, { align: 'right' });              // Discount header (right-aligned)
  doc.text('Amount', cols.amt + colWidths.amt, y + 4, { align: 'right' });                  // Amount header (right-aligned)
  y += headerH; // Advance y past the header row

  // Table rows
  doc.setFont('helvetica', 'normal'); // Reset to normal weight for body rows
  doc.setFontSize(7);                 // Small font matching the header
  const rowH = 5.5;                   // Height of each data row in mm

  for (let i = 0; i < bill.items.length; i++) { // Loop over each line item on the bill
    const item = bill.items[i]; // Current line item (product, qty, rate, discount, batch, etc.)

    // Check if we need a new page
    if (y + rowH > PAGE_H - 60) { // If the row would go beyond the bottom safe zone (60 mm from bottom)
      doc.addPage();               // Add a new A4 page and reset the cursor
      y = MARGIN;                  // Reset y to the top margin of the new page
    }

    // Alternate row background
    if (i % 2 === 0) {                               // Even rows (0, 2, 4…) get a very light background
      drawRect(doc, MARGIN, y, CONTENT_W, rowH, [250, 250, 250]); // Near-white stripe for readability
    }

    // Draw bottom border
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]); // Light grey border colour
    doc.setLineWidth(0.1);                             // Very thin 0.1 mm border line
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH); // Horizontal rule at the bottom of this row

    const rowTextY = y + 3.8; // Vertical midpoint for text within the row (3.8 mm from row top)

    // #
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);          // Grey colour for the row number
    doc.text(String(i + 1), cols.num + 3, rowTextY, { align: 'center' }); // Print 1-based row number, centred in the column

    // Item name (wrap if too long)
    doc.setFont('helvetica', 'bold');                     // Bold product name for emphasis
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);           // Dark text for product name
    const nameLines = wrapText(doc, item.productName, colWidths.name - 2); // Wrap product name to fit within the name column
    doc.text(nameLines[0], cols.name + 1, rowTextY);       // Print the first line of the (possibly wrapped) name
    doc.setFont('helvetica', 'normal');                   // Reset to normal weight for all other columns

    // HSN
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);           // Grey for the HSN code
    doc.text(item.hsnCode || '-', cols.hsn + colWidths.hsn / 2, rowTextY, { align: 'center' }); // Centred HSN code or "−" if not set

    // Batch/Exp
    let batchText = '';                                        // Build the batch/expiry display string
    if (item.batchNumber) batchText = item.batchNumber;        // Start with batch number if available
    if (item.expiryDate) {                                     // Append expiry date if provided
      const exp = item.expiryDate.length === 7                 // YYYY-MM format (7 chars) needs reformatting
        ? `${item.expiryDate.split('-')[1]}/${item.expiryDate.split('-')[0]}` // Convert YYYY-MM → MM/YYYY for display
        : item.expiryDate;                                     // Other formats used as-is
      batchText += (batchText ? ' ' : '') + exp;              // Append with a space separator if batchNumber was set
    }
    doc.text(batchText || '', cols.batch + 1, rowTextY); // Print batch/expiry text or empty string

    // Qty
    doc.setFont('helvetica', 'bold');                            // Bold quantity for emphasis
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);                  // Dark text
    doc.text(String(item.quantity), cols.qty + colWidths.qty - 1, rowTextY, { align: 'right' }); // Right-aligned quantity

    // Rate
    doc.setFont('helvetica', 'normal');                          // Normal weight for monetary values
    doc.text(item.rate.toFixed(2), cols.rate + colWidths.rate - 1, rowTextY, { align: 'right' }); // Right-aligned rate with 2 decimal places

    // Discount
    doc.text(item.discount ? `${item.discount.toFixed(0)}%` : '-', cols.disc + colWidths.disc - 1, rowTextY, { align: 'right' }); // Right-aligned discount % or "−" if no discount

    // Amount
    doc.setFont('helvetica', 'bold');                            // Bold for the final line amount
    doc.text((item.discountedAmount || item.amount).toFixed(2), cols.amt + colWidths.amt, rowTextY, { align: 'right' }); // Use discountedAmount if present, otherwise raw amount; right-aligned

    y += rowH; // Advance cursor past this row

    // If item name was multi-line, add extra rows
    if (nameLines.length > 1) { // Product name wrapped onto additional lines
      for (let ln = 1; ln < nameLines.length; ln++) { // Print each additional wrapped line of the product name
        doc.setFont('helvetica', 'normal');            // Normal weight (non-bold) for continuation lines
        doc.setFontSize(6);                            // Slightly smaller than the main row font for visual hierarchy
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);   // Grey to de-emphasise the continuation text
        doc.text(nameLines[ln], cols.name + 1, y + 2.5); // Print continuation line 2.5 mm from top of the extra space
        y += 3;                                        // Advance cursor 3 mm per extra name line
      }
    }
  }

  y += 3; // Gap between last item row and the totals section

  // =========================================================================
  // TOTALS (right-aligned)
  // =========================================================================
  const totalsW = 80;                    // Width of the totals block in mm
  const totalsX = PAGE_W - MARGIN - totalsW; // Left edge of the totals block (right-aligned within content area)
  const totRowH = 5;                     // Height of each totals row in mm

  const drawTotalRow = (label: string, value: string, bold = false) => { // Helper to draw one labelled amount row in the totals block
    if (y + totRowH > PAGE_H - 40) { // If this row would overflow the page
      doc.addPage();                  // Start a new page
      y = MARGIN;                     // Reset cursor to top margin
    }
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]); // Light grey bottom border for each totals row
    doc.setLineWidth(0.1);                             // Very thin border line
    doc.line(totalsX, y + totRowH, totalsX + totalsW, y + totRowH); // Draw horizontal rule at the bottom of this row

    doc.setFont('helvetica', bold ? 'bold' : 'normal'); // Bold if this is an emphasised row (e.g. Taxable Amount)
    doc.setFontSize(7);                                 // Small consistent font for all totals rows
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);        // Dark text for readability
    doc.text(label, totalsX + 3, y + 3.5);              // Print the row label (left-aligned within the block)
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); // Repeat bold setting for the value text
    doc.text(value, totalsX + totalsW - 3, y + 3.5, { align: 'right' }); // Print the formatted value (right-aligned)
    y += totRowH; // Advance cursor past this totals row
  };

  drawTotalRow('Taxable Amount', fmt(bill.taxableAmount), true); // Taxable Amount row — bold because it's the key subtotal line

  if (bill.isGstBill) {                          // Tax breakdown rows — only shown on GST invoices
    if (bill.igstAmount > 0) {                   // Inter-state sale: IGST only (no CGST/SGST split)
      drawTotalRow('IGST', fmt(bill.igstAmount)); // IGST row
    } else {
      drawTotalRow('CGST', fmt(bill.cgstAmount)); // Intra-state: CGST half
      drawTotalRow('SGST', fmt(bill.sgstAmount)); // Intra-state: SGST half
    }
  }

  if (bill.roundOff !== 0) {                       // Only show round-off row if there is a non-zero adjustment
    drawTotalRow('Round Off', `${bill.roundOff > 0 ? '+' : ''}${bill.roundOff.toFixed(2)}`); // Show sign explicitly (+0.49 or −0.21 etc.)
  }

  // Grand Total row (dark background)
  drawRect(doc, totalsX, y, totalsW, 7, DARK);                        // Dark background for the grand total row
  doc.setFont('helvetica', 'bold');                                    // Bold for grand total label and value
  doc.setFontSize(9);                                                  // Slightly larger font so the total stands out
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);                      // White text on dark background
  doc.text('Grand Total', totalsX + 3, y + 5);                        // Print "Grand Total" label
  doc.text(fmt(bill.grandTotal), totalsX + totalsW - 3, y + 5, { align: 'right' }); // Print formatted grand total value
  y += 10; // Advance past the grand total row (7 mm row + 3 mm gap)

  // =========================================================================
  // AMOUNT IN WORDS
  // =========================================================================
  if (y + 8 > PAGE_H - 35) { // If the words box + safe zone would exceed page height
    doc.addPage();             // Start a new page
    y = MARGIN;                // Reset cursor to top margin
  }
  drawBorderedRect(doc, MARGIN, y, CONTENT_W, 7, LIGHT_GRAY, BORDER); // Bordered box for the amount-in-words line
  doc.setFont('helvetica', 'bold');                                     // Bold for "Amount in Words:" label
  doc.setFontSize(7);                                                   // Small font to fit everything on one line
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                          // Dark text
  doc.text('Amount in Words:', MARGIN + 3, y + 4.5);                   // Print label
  doc.setFont('helvetica', 'italic');                                   // Italic for the words text — visually distinct from label
  doc.setFontSize(7);                                                   // Same font size
  const wordsText = numberToWords(bill.grandTotal);                     // Convert grand total to English words (e.g. "One Thousand Two Hundred Forty Five")
  const wordsX = MARGIN + 3 + doc.getTextWidth('Amount in Words: ') + 1; // Compute x start of the words text — right after the label
  doc.text(wordsText, wordsX, y + 4.5);                                // Print the words on the same line as the label
  y += 10; // Advance past the words box (7 mm box + 3 mm gap)

  // =========================================================================
  // BANK DETAILS
  // =========================================================================
  if (y + 14 > PAGE_H - 25) { // If the bank box + safe zone would exceed page height
    doc.addPage();              // Start a new page
    y = MARGIN;                 // Reset cursor to top margin
  }

  const bankLines: string[] = []; // Lines to print inside the bank details box
  bankLines.push(`Bank: ${bank.name}    A/c No: ${bank.acNo}    IFSC: ${bank.ifsc}`); // First line: bank name, account number, IFSC — all on one line for compactness
  const bankLine2Parts: string[] = [];                     // Components of the optional second bank detail line
  if (bank.branch) bankLine2Parts.push(`Branch: ${bank.branch}`); // Add branch if available
  if (bank.upi) bankLine2Parts.push(`UPI: ${bank.upi}`);          // Add UPI ID if available
  if (bankLine2Parts.length > 0) bankLines.push(bankLine2Parts.join('    ')); // Combine non-empty parts into the second detail line

  const bankBoxH = 6 + bankLines.length * 3.5;                           // Box height: 6 mm header space + 3.5 mm per detail line
  drawBorderedRect(doc, MARGIN, y, CONTENT_W, bankBoxH, LIGHT_GRAY, BORDER); // Draw bordered light-grey bank details box

  doc.setFont('helvetica', 'normal');                                    // Normal weight for "BANK DETAILS FOR PAYMENT" label
  doc.setFontSize(6);                                                    // Very small label
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);                           // Grey for label
  doc.text('BANK DETAILS FOR PAYMENT', MARGIN + 3, y + 3.5);            // Print section header inside the box

  doc.setFont('helvetica', 'normal');                                    // Normal weight for the bank details values
  doc.setFontSize(7);                                                    // Standard small body font
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                           // Dark text for readability
  for (let i = 0; i < bankLines.length; i++) {                          // Print each bank detail line
    doc.text(bankLines[i], MARGIN + 3, y + 6.5 + i * 3.5);             // Indent 3 mm from left; space lines 3.5 mm apart
  }
  y += bankBoxH + 3; // Advance past the bank details box plus 3 mm gap

  // =========================================================================
  // FOOTER: Terms + Signature
  // =========================================================================
  if (y + 30 > PAGE_H - MARGIN) { // If the footer block (≥30 mm) would overflow the page
    doc.addPage();                  // Start a new page for the footer
    y = MARGIN;                     // Reset cursor to top margin
  }

  // Dashed line
  doc.setDrawColor(209, 213, 219);        // Light grey dashed separator (#d1d5db)
  doc.setLineWidth(0.3);                  // Slightly thicker line for the dashed separator
  doc.setLineDashPattern([2, 1], 0);      // Dash pattern: 2 mm on, 1 mm off
  doc.line(MARGIN, y, PAGE_W - MARGIN, y); // Draw dashed horizontal rule spanning content width
  doc.setLineDashPattern([], 0);          // Reset to solid line for all subsequent drawing
  y += 3; // Small gap after the dashed line

  // Terms (left side)
  doc.setFont('helvetica', 'bold');        // Bold for the "Terms & Conditions:" heading
  doc.setFontSize(7);                      // Small font
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]); // Grey for the heading
  doc.text('Terms & Conditions:', MARGIN, y + 2); // Print the terms heading
  y += 4; // Gap below the heading

  doc.setFont('helvetica', 'normal');          // Normal weight for each term item
  doc.setFontSize(6);                          // Very small font for terms to fit multiple lines
  for (const term of termsList) {              // Iterate over each term line
    const lines = wrapText(doc, `• ${term}`, CONTENT_W * 0.55); // Wrap term with bullet to fit in 55% of content width (left column)
    for (const line of lines) {                // Print each wrapped line of this term
      doc.text(line, MARGIN + 2, y + 2);       // Indent the bullet line 2 mm from margin
      y += 2.5;                                // 2.5 mm line spacing for terms
    }
  }

  // Signature (right side) — position relative to terms
  const sigX = PAGE_W - MARGIN - 50;                         // X start of the 50 mm wide signature block (right side)
  const sigY = y - (termsList.length * 2.5) - 2;             // Align signature block's top with the start of the terms list

  if (settings.certifications) {                              // Print certifications above the company name if configured
    doc.setFont('helvetica', 'bold');                         // Bold for certifications text
    doc.setFontSize(6);                                       // Very small to fit on one line
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);            // Green colour for certifications (FSSAI/ISO badge feel)
    doc.text(settings.certifications, sigX + 25, sigY + 2, { align: 'center' }); // Centred within the signature block
  }

  doc.setFont('helvetica', 'bold');                           // Bold for the company name above the signature line
  doc.setFontSize(9);                                         // Slightly larger font for the company name
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);                 // Dark text for the company name
  doc.text(settings.name.toUpperCase(), sigX + 25, sigY + 8, { align: 'center' }); // Print company name in UPPERCASE, centred

  // Signature line
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]); // Grey line for the signature underline
  doc.setLineWidth(0.2);                        // Thin 0.2 mm line for the signature blank
  doc.line(sigX + 5, sigY + 22, sigX + 45, sigY + 22); // Horizontal line spanning most of the signature block

  doc.setFont('helvetica', 'normal');                      // Normal weight for "Authorised Signatory" label
  doc.setFontSize(7);                                      // Small label below the signature line
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);              // Grey for the label
  doc.text('Authorised Signatory', sigX + 25, sigY + 25, { align: 'center' }); // Centred label below the signature line

  // Make sure y is at least past the signature
  y = Math.max(y, sigY + 28); // Ensure global y is below the end of the signature block so we don't overlap

  // Footer text
  if (settings.footerText) {                                // Only print footer text if configured
    y += 2;                                                 // Small gap before the footer separator
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);       // Light grey thin separator above footer text
    doc.setLineWidth(0.1);                                   // Very thin line
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);                // Horizontal rule before footer text
    y += 3;                                                 // Gap below the separator
    doc.setFont('helvetica', 'normal');                     // Normal weight for footer text
    doc.setFontSize(6);                                     // Small font for footer
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);             // Grey for footer text
    doc.text(settings.footerText, PAGE_W / 2, y, { align: 'center' }); // Print footer text centred on the page
  }

  // Return the jsPDF doc object
  return doc; // Return the fully built jsPDF document for the caller to extract bytes or a Blob
}

/**
 * Generate a complete invoice PDF as a Uint8Array.
 */
export function generateInvoicePDF(bill: InvoiceBill, settings: InvoiceSettings): Uint8Array { // Public API: produce binary PDF bytes for use with Tauri fs.writeFile to save to disk
  const doc = generateInvoicePDFDoc(bill, settings); // Build the full jsPDF document
  const arrayBuffer = doc.output('arraybuffer');     // Serialise the jsPDF document to a raw ArrayBuffer
  return new Uint8Array(arrayBuffer);                // Wrap the ArrayBuffer in a Uint8Array for Tauri's file-write API
}

/**
 * Generate a PDF Blob for browser-based operations.
 */
export function generateInvoicePDFBlob(bill: InvoiceBill, settings: InvoiceSettings): Blob { // Public API: produce a Blob for browser-based download (e.g. URL.createObjectURL)
  const doc = generateInvoicePDFDoc(bill, settings); // Build the full jsPDF document
  const arrayBuffer = doc.output('arraybuffer');     // Serialise to ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/pdf' }); // Wrap in a Blob with the correct PDF MIME type for browser download
}
