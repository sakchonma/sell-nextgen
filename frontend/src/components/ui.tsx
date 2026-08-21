import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-12 text-center text-slate-500 text-xs">
      <div className="font-semibold text-slate-400">{title}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function StatusBadge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'rose' | 'indigo' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
  };
  return <span className={`px-2 py-0.5 rounded text-[9px] border font-bold ${tones[tone]}`}>{children}</span>;
}

export function ModalShell({ children, className = 'bg-black/75 backdrop-blur-sm' }: { children: ReactNode; className?: string }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
      {children}
    </div>,
    document.body
  );
}

export function PaginationControls({
  page,
  total,
  limit,
  onPageChange
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
      <span>Page {page} / {totalPages}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
