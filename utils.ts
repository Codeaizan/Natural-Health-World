
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

  const regex = /^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/;
  const getLT20 = (n: number) => a[n];
  const getGT20 = (n: number) => b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');

  const numStr = Math.floor(num).toString();
  if (numStr.length > 9) return 'Overflow'; // Simple implementation limits
  
  const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (Number(n[1]) !== 0) ? (getLT20(Number(n[1])) || getGT20(Number(n[1]))) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (getLT20(Number(n[2])) || getGT20(Number(n[2]))) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (getLT20(Number(n[3])) || getGT20(Number(n[3]))) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (getLT20(Number(n[4])) || getGT20(Number(n[4]))) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (getLT20(Number(n[5])) || getGT20(Number(n[5]))) : '';

  return str.trim() + ' Rupees Only';
};