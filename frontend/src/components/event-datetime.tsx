import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  addDaysToDateKey,
  dateKey,
  endTimeOptions,
  formatTimeInput,
  minutesOfDay,
  parseLocalDateTime,
  quarterHourTimes,
  timeFromMinutes,
  type EventScheduleValue
} from '../lib/datetime';

const chipClass =
  'h-8 px-2.5 rounded-md border border-slate-800 bg-[#090d16] text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-indigo-500';

function useMenuPosition(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const update = () => setRect(anchorRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  return rect;
}

function TimeMenu({
  open,
  anchorRef,
  options,
  selected,
  onSelect,
  onClose
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  options: { time: string; label: string }[];
  selected: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rect = useMenuPosition(open, anchorRef);

  useEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: 'center' });
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, anchorRef, onClose]);

  if (!open || !rect || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[80] max-h-56 min-w-[11rem] overflow-y-auto rounded-lg border border-slate-800 bg-[#090d16] py-1 shadow-xl"
      style={{ top: rect.bottom + 4, left: rect.left }}
    >
      {options.map(option => (
        <button
          key={`${option.time}-${option.label}`}
          type="button"
          ref={option.time === selected ? selectedRef : undefined}
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            onSelect(option.time);
            onClose();
          }}
          className={`flex w-full px-3 py-1.5 text-left text-xs ${
            option.time === selected ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-200 hover:bg-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export function EventDateTimeFields({
  value,
  onChange
}: {
  value: EventScheduleValue;
  onChange: (next: EventScheduleValue) => void;
}) {
  const [openMenu, setOpenMenu] = useState<'start' | 'end' | null>(null);
  const startTimeRef = useRef<HTMLButtonElement | null>(null);
  const endTimeRef = useRef<HTMLButtonElement | null>(null);
  const savedTimesRef = useRef({ startTime: value.startTime, endTime: value.endTime });

  const shiftEndWithStart = (nextStartDate: string, nextStartTime: string, previous: EventScheduleValue) => {
    if (previous.allDay || (!previous.endDate && !previous.endTime)) {
      return { endDate: previous.endDate, endTime: previous.endTime };
    }
    const prevStart = parseLocalDateTime(previous.startDate, previous.startTime || '00:00');
    const prevEnd = parseLocalDateTime(
      previous.endDate || previous.startDate,
      previous.endTime || timeFromMinutes(minutesOfDay(previous.startTime || '00:00') + 30)
    );
    const duration = Math.max(15 * 60 * 1000, prevEnd.getTime() - prevStart.getTime());
    const nextStart = parseLocalDateTime(nextStartDate, nextStartTime || previous.startTime || '00:00');
    const nextEnd = new Date(nextStart.getTime() + duration);
    return {
      endDate: dateKey(nextEnd),
      endTime: formatTimeInput(nextEnd)
    };
  };

  const setStartDate = (startDate: string) => {
    const shifted = shiftEndWithStart(startDate, value.startTime, value);
    onChange({ ...value, startDate, ...shifted });
  };

  const setStartTime = (startTime: string) => {
    savedTimesRef.current.startTime = startTime;
    const shifted = shiftEndWithStart(value.startDate, startTime, value);
    onChange({ ...value, startTime, ...shifted });
  };

  const setEndDate = (endDate: string) => {
    onChange({ ...value, endDate });
  };

  const setEndTime = (endTime: string, fromDurationMinutes?: number) => {
    savedTimesRef.current.endTime = endTime;
    if (!endTime) {
      onChange({ ...value, endTime: '' });
      return;
    }
    if (fromDurationMinutes !== undefined) {
      const days = Math.floor(fromDurationMinutes / (24 * 60));
      onChange({
        ...value,
        endTime,
        endDate: addDaysToDateKey(value.startDate, days)
      });
      return;
    }
    let endDate = value.endDate || value.startDate;
    if (endDate === value.startDate && endTime && value.startTime && endTime < value.startTime) {
      endDate = addDaysToDateKey(value.startDate, 1);
    } else if (endDate === addDaysToDateKey(value.startDate, 1) && endTime && value.startTime && endTime >= value.startTime) {
      endDate = value.startDate;
    }
    onChange({ ...value, endTime, endDate });
  };

  const toggleAllDay = (allDay: boolean) => {
    setOpenMenu(null);
    if (allDay) {
      savedTimesRef.current = { startTime: value.startTime, endTime: value.endTime };
      onChange({ ...value, allDay: true });
      return;
    }
    onChange({
      ...value,
      allDay: false,
      startTime: savedTimesRef.current.startTime || value.startTime,
      endTime: savedTimesRef.current.endTime || value.endTime
    });
  };

  const startOptions = quarterHourTimes().map(time => ({ time, label: time }));
  const endOptions = endTimeOptions(value.startTime || '00:00');

  return (
    <div className="col-span-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value.startDate}
          onChange={event => setStartDate(event.target.value)}
          required
          className={chipClass}
        />
        {!value.allDay && (
          <button
            ref={startTimeRef}
            type="button"
            onClick={() => setOpenMenu(openMenu === 'start' ? null : 'start')}
            className={chipClass}
          >
            {value.startTime || '--:--'}
          </button>
        )}
        <span className="text-xs text-slate-400">ถึง</span>
        {!value.allDay && (
          <button
            ref={endTimeRef}
            type="button"
            onClick={() => setOpenMenu(openMenu === 'end' ? null : 'end')}
            className={`${chipClass} ${!value.endTime ? 'text-slate-400' : ''}`}
          >
            {value.endTime || 'สิ้นสุด'}
          </button>
        )}
        <input
          type="date"
          value={value.endDate}
          onChange={event => setEndDate(event.target.value)}
          className={chipClass}
        />
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.allDay}
          onChange={event => toggleAllDay(event.target.checked)}
          className="rounded text-indigo-500 border-slate-800 focus:ring-indigo-500"
        />
        ตลอดวัน
      </label>
      <TimeMenu
        open={openMenu === 'start'}
        anchorRef={startTimeRef}
        options={startOptions}
        selected={value.startTime}
        onSelect={setStartTime}
        onClose={() => setOpenMenu(null)}
      />
      <TimeMenu
        open={openMenu === 'end'}
        anchorRef={endTimeRef}
        options={[{ time: '', label: 'ไม่ระบุ' }, ...endOptions.map(option => ({ time: option.time, label: option.label }))]}
        selected={value.endTime}
        onSelect={time => {
          const option = endOptions.find(item => item.time === time);
          setEndTime(time, option?.minutes);
        }}
        onClose={() => setOpenMenu(null)}
      />
    </div>
  );
}
