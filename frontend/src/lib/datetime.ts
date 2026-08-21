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

export type EventScheduleValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
};

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatTimeInput(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

export function addDaysToDateKey(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return dateKey(new Date(year, (month || 1) - 1, (day || 1) + days));
}

export function minutesOfDay(timeStr: string): number {
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function timeFromMinutes(total: number): string {
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  if (minutes % 60 === 0) return `${minutes / 60} ชม.`;
  if (minutes % 30 === 0) return `${minutes / 60} ชม.`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ชม. ${minutes % 60} นาที`;
}

export function quarterHourTimes(): string[] {
  return Array.from({ length: 24 * 4 }, (_, index) => timeFromMinutes(index * 15));
}

export function endTimeOptions(startTime: string): { time: string; minutes: number; label: string }[] {
  const startMinutes = minutesOfDay(startTime || '00:00');
  return Array.from({ length: 24 * 4 }, (_, index) => {
    const minutes = index * 15;
    const time = timeFromMinutes(startMinutes + minutes);
    return { time, minutes, label: `${time} (${formatDurationLabel(minutes)})` };
  });
}

export function defaultEventSchedule(now = new Date()): EventScheduleValue {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    startDate: dateKey(start),
    startTime: formatTimeInput(start),
    endDate: dateKey(end),
    endTime: formatTimeInput(end),
    allDay: false
  };
}

function looksAllDay(start: Date, end: Date): boolean {
  if (start.getHours() !== 0 || start.getMinutes() !== 0) return false;
  if (end.getHours() === 23 && end.getMinutes() >= 59) return true;
  return end.getHours() === 0 && end.getMinutes() === 0 && dateKey(end) !== dateKey(start);
}

export function eventScheduleFromRange(startAt: string | Date, endAt?: string | Date | null): EventScheduleValue {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 30 * 60 * 1000);
  const allDay = looksAllDay(start, end);
  const fallback = defaultEventSchedule(start);
  let endDate = dateKey(end);
  if (allDay && end.getHours() === 0 && end.getMinutes() === 0) {
    endDate = addDaysToDateKey(dateKey(end), -1);
  }
  return {
    startDate: dateKey(start),
    startTime: allDay ? fallback.startTime : formatTimeInput(start),
    endDate,
    endTime: allDay ? fallback.endTime : formatTimeInput(end),
    allDay
  };
}

export function resolveEventRange(value: EventScheduleValue): { startAt: Date; endAt: Date } | null {
  if (!value.startDate) return null;

  if (value.allDay) {
    const startAt = parseLocalDateTime(value.startDate, '00:00');
    const endDate = value.endDate || value.startDate;
    const endAt = parseLocalDateTime(endDate, '23:59');
    return { startAt, endAt };
  }

  if (!value.startTime) return null;
  const startAt = parseLocalDateTime(value.startDate, value.startTime);

  if (!value.endDate && !value.endTime) {
    return { startAt, endAt: new Date(startAt.getTime() + 30 * 60 * 1000) };
  }

  const endDate = value.endDate || value.startDate;
  const endTime = value.endTime || timeFromMinutes(minutesOfDay(value.startTime) + 30);
  let endAt = parseLocalDateTime(endDate, endTime);
  if (endAt.getTime() <= startAt.getTime() && !value.endDate) {
    endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startAt, endAt };
}
