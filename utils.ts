
export const searchMatch = (text: string, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  
  // Simple substring
  if (t.includes(q)) return true;
  
  // Tokenized search (e.g. "vit c" matches "Vitamin C")
  const tokens = q.split(/\s+/).filter(token => token.length > 0);
  if (tokens.length === 0) return true;
  
  return tokens.every(token => t.includes(token));
};

export const numberToWords = (num: number): string => {
  const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const getLT20 = (n: number) => a[n];
  const getGT20 = (n: number) => b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');

  const convertInteger = (value: number): string => {
    if (value === 0) return '';
    const numStr = Math.floor(value).toString();
    if (numStr.length > 9) return 'Overflow';

    const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';

    let str = '';
    str += (Number(n[1]) !== 0) ? (getLT20(Number(n[1])) || getGT20(Number(n[1]))) + 'Crore ' : '';
    str += (Number(n[2]) !== 0) ? (getLT20(Number(n[2])) || getGT20(Number(n[2]))) + 'Lakh ' : '';
    str += (Number(n[3]) !== 0) ? (getLT20(Number(n[3])) || getGT20(Number(n[3]))) + 'Thousand ' : '';
    str += (Number(n[4]) !== 0) ? (getLT20(Number(n[4])) || getGT20(Number(n[4]))) + 'Hundred ' : '';
    str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (getLT20(Number(n[5])) || getGT20(Number(n[5]))) : '';
    return str.trim();
  };

  if (num === 0) return 'Zero Rupees Only';

  const rupees = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - rupees) * 100);

  let result = '';
  if (rupees > 0) {
    const rupeesWords = convertInteger(rupees);
    if (rupeesWords === 'Overflow') return 'Overflow';
    result = rupeesWords + ' Rupees';
  }

  if (paise > 0) {
    const paiseWords = convertInteger(paise);
    if (result) {
      result += ' and ' + paiseWords + ' Paise';
    } else {
      result = paiseWords + ' Paise';
    }
  }

  return (result || 'Zero Rupees') + ' Only';
};

/**
 * Save a CSV string using Tauri's native save dialog.
 * Falls back to browser download if Tauri is not available.
 */
export const saveCsvFile = async (filename: string, csvContent: string): Promise<void> => {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (filePath) {
      await writeTextFile(filePath, csvContent);
    }
  } catch {
    // Fallback: browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};