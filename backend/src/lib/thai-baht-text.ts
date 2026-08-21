const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

function readIntegerPart(value: number): string {
  if (value === 0) return DIGITS[0];

  function read(n: number): string {
    if (n < 10) return DIGITS[n];
    if (n < 20) {
      if (n === 10) return 'สิบ';
      const ones = n % 10;
      return 'สิบ' + (ones === 1 ? 'เอ็ด' : DIGITS[ones]);
    }
    if (n < 100) {
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      const tensText = tens === 2 ? 'ยี่สิบ' : `${DIGITS[tens]}สิบ`;
      return tensText + (ones ? (ones === 1 ? 'เอ็ด' : DIGITS[ones]) : '');
    }
    if (n < 1000) {
      const hundreds = Math.floor(n / 100);
      const rest = n % 100;
      return `${DIGITS[hundreds]}ร้อย${rest ? (rest < 10 ? 'ศูนย์' + read(rest) : read(rest)) : ''}`;
    }
    if (n < 10000) {
      const thousands = Math.floor(n / 1000);
      const rest = n % 1000;
      return `${read(thousands)}พัน${rest ? read(rest) : ''}`;
    }
    if (n < 100000) {
      const tenThousands = Math.floor(n / 10000);
      const rest = n % 10000;
      return `${read(tenThousands)}หมื่น${rest ? read(rest) : ''}`;
    }
    if (n < 1000000) {
      const hundredThousands = Math.floor(n / 100000);
      const rest = n % 100000;
      return `${read(hundredThousands)}แสน${rest ? read(rest) : ''}`;
    }
    const millions = Math.floor(n / 1000000);
    const rest = n % 1000000;
    return `${read(millions)}ล้าน${rest ? read(rest) : ''}`;
  }

  return read(value);
}

export function thaiBahtText(amount: number): string {
  const normalized = Math.round(Number(amount || 0) * 100) / 100;
  const baht = Math.floor(normalized);
  const satang = Math.round((normalized - baht) * 100);

  let text = readIntegerPart(baht) + 'บาท';
  if (satang > 0) {
    text += readIntegerPart(satang) + 'สตางค์';
  } else {
    text += 'ถ้วน';
  }
  return text;
}
