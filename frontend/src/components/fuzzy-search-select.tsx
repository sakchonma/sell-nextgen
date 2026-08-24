import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

function normalizeLocationQuery(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(อำเภอ|อ\.|เขต|จังหวัด|จ\.)/, '');
}

function rankOption(query: string, option: string) {
  const q = normalizeLocationQuery(query);
  const o = normalizeLocationQuery(option);
  if (!q) return 1;
  if (o === q) return 100;
  if (o.startsWith(q)) return 80;
  if (o.includes(q)) return 50;
  return 0;
}

export function FuzzySearchSelect({
  value,
  onChange,
  options,
  placeholder,
  required,
  inputClassName = 'w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500'
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  inputClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const ranked = options
      .map(option => ({ option, score: rankOption(value, option) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.option.localeCompare(b.option, 'th'));
    return ranked.slice(0, 8).map(item => item.option);
  }, [options, value]);

  const trimmed = value.trim();
  const hasExact = options.some(option => normalizeLocationQuery(option) === normalizeLocationQuery(trimmed));
  const canCreate = Boolean(trimmed) && !hasExact;
  const menuItems = canCreate ? [...matches, `__create__:${trimmed}`] : matches;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight(prev => Math.min(prev + 1, Math.max(menuItems.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(prev => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && menuItems[highlight]) {
      event.preventDefault();
      const item = menuItems[highlight];
      choose(item.startsWith('__create__:') ? trimmed : item);
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />
      {open && menuItems.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
          {menuItems.map((item, index) => {
            const isCreate = item.startsWith('__create__:');
            const label = isCreate ? `เพิ่ม “${trimmed}”` : item;
            return (
              <button
                key={item}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => choose(isCreate ? trimmed : item)}
                className={`block w-full text-left px-3 py-2 text-xs ${
                  index === highlight ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
