import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  defaultEventSchedule,
  endTimeOptions,
  eventScheduleFromRange,
  formatDurationLabel,
  resolveEventRange
} from './datetime';

describe('event schedule', () => {
  it('defaults to current hour and plus 30 minutes', () => {
    const schedule = defaultEventSchedule(new Date(2026, 7, 21, 10, 55, 0));
    expect(schedule).toEqual({
      startDate: '2026-08-21',
      startTime: '10:00',
      endDate: '2026-08-21',
      endTime: '10:30',
      allDay: false
    });
  });

  it('treats missing end as start plus 30 minutes', () => {
    const range = resolveEventRange({
      startDate: '2026-08-21',
      startTime: '10:00',
      endDate: '',
      endTime: '',
      allDay: false
    });
    expect(range?.startAt).toEqual(new Date(2026, 7, 21, 10, 0));
    expect(range?.endAt).toEqual(new Date(2026, 7, 21, 10, 30));
  });

  it('uses dates only for all-day events', () => {
    const range = resolveEventRange({
      startDate: '2026-08-21',
      startTime: '10:00',
      endDate: '2026-08-22',
      endTime: '10:30',
      allDay: true
    });
    expect(range?.startAt).toEqual(new Date(2026, 7, 21, 0, 0));
    expect(range?.endAt).toEqual(new Date(2026, 7, 22, 23, 59));
  });

  it('detects all-day from midnight-to-end-of-day range', () => {
    const schedule = eventScheduleFromRange(
      new Date(2026, 7, 21, 0, 0),
      new Date(2026, 7, 21, 23, 59)
    );
    expect(schedule.allDay).toBe(true);
    expect(schedule.startDate).toBe('2026-08-21');
    expect(schedule.endDate).toBe('2026-08-21');
  });

  it('labels end-time options with duration from start', () => {
    expect(formatDurationLabel(0)).toBe('0 นาที');
    expect(formatDurationLabel(30)).toBe('30 นาที');
    expect(formatDurationLabel(60)).toBe('1 ชม.');
    expect(formatDurationLabel(90)).toBe('1.5 ชม.');
    expect(endTimeOptions('10:00')[2]).toMatchObject({ time: '10:30', minutes: 30 });
  });

  it('shifts a date key by days', () => {
    expect(addDaysToDateKey('2026-08-31', 1)).toBe('2026-09-01');
  });
});
