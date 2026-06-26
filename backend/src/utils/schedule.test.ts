import { describe, expect, it } from 'vitest';
import { doTimeRangesOverlap, evaluateAvailability, getAvailabilityStatus } from './schedule.js';

describe('schedule utilities', () => {
  it('detects overlapping time ranges', () => {
    expect(doTimeRangesOverlap(
      { startAt: '2026-06-26T09:00:00.000Z', endAt: '2026-06-26T10:00:00.000Z' },
      { startAt: '2026-06-26T09:30:00.000Z', endAt: '2026-06-26T10:30:00.000Z' }
    )).toBe(true);
  });

  it('does not treat adjacent time ranges as conflicts', () => {
    expect(doTimeRangesOverlap(
      { startAt: '2026-06-26T09:00:00.000Z', endAt: '2026-06-26T10:00:00.000Z' },
      { startAt: '2026-06-26T10:00:00.000Z', endAt: '2026-06-26T11:00:00.000Z' }
    )).toBe(false);
  });

  it('maps conflict counts to availability status', () => {
    expect(getAvailabilityStatus(0)).toBe('Free');
    expect(getAvailabilityStatus(1)).toBe('SemiBusy');
    expect(getAvailabilityStatus(2)).toBe('SemiBusy');
    expect(getAvailabilityStatus(3)).toBe('Busy');
  });

  it('returns both status and conflict count', () => {
    expect(evaluateAvailability([{}, {}])).toEqual({ status: 'SemiBusy', conflictCount: 2 });
  });
});
