/** Local calendar date key YYYY-MM-DD (avoids UTC shift from toISOString). */
export function dateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isSameLocalDay(a: string | Date, b: string | Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function isTodayLocal(value: string | Date): boolean {
  return isSameLocalDay(value, new Date());
}
