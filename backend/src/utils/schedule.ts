export interface TimeRangeLike {
  startAt: Date | string;
  endAt: Date | string;
}

export interface AvailabilityResult {
  status: 'Free' | 'SemiBusy' | 'Busy';
  conflictCount: number;
}

export function toValidDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }
  return date;
}

export function doTimeRangesOverlap(a: TimeRangeLike, b: TimeRangeLike): boolean {
  const aStart = toValidDate(a.startAt).getTime();
  const aEnd = toValidDate(a.endAt).getTime();
  const bStart = toValidDate(b.startAt).getTime();
  const bEnd = toValidDate(b.endAt).getTime();

  return aStart < bEnd && bStart < aEnd;
}

export function getAvailabilityStatus(conflictCount: number): AvailabilityResult['status'] {
  if (conflictCount === 0) return 'Free';
  if (conflictCount < 3) return 'SemiBusy';
  return 'Busy';
}

export function evaluateAvailability(conflicts: unknown[]): AvailabilityResult {
  const conflictCount = conflicts.length;
  return {
    conflictCount,
    status: getAvailabilityStatus(conflictCount)
  };
}
