export function stripLeadingZeros(raw: string, allowDecimal = false): string {
  if (raw === '') return '';
  let next = allowDecimal ? raw.replace(/[^\d.]/g, '') : raw.replace(/\D/g, '');
  if (allowDecimal) {
    const dot = next.indexOf('.');
    if (dot !== -1) {
      next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`;
    }
  }
  if (next === '.') return '0.';
  if (allowDecimal && next.includes('.')) {
    const [intPart, frac = ''] = next.split('.');
    const intNorm = intPart === '' ? '0' : intPart.replace(/^0+(?=\d)/, '');
    return `${intNorm}.${frac}`;
  }
  if (/^0+$/.test(next)) return '0';
  return next.replace(/^0+(?=\d)/, '');
}

export function parseNumericInput(raw: string): number {
  if (raw === '' || raw === '.' || raw === '0.') return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}
