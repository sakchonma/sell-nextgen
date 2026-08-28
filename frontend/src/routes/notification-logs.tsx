import { createRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/notification-logs',
  component: NotificationLogsPage,
});

function outcomeStyle(outcome: string) {
  if (outcome === 'passed') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (outcome === 'skipped') return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
  return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
}

function outcomeLabel(outcome: string) {
  if (outcome === 'passed') return 'ผ่าน';
  if (outcome === 'skipped') return 'ข้าม';
  return 'ไม่ผ่าน';
}

function pretty(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function NotificationLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    apiFetch<any[]>('/api/nextopia-logs?limit=200')
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message || 'โหลดประวัติไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if ((user?.rank || 0) !== 5) return;
    load();
  }, [user?._id, user?.rank]);

  if ((user?.rank || 0) !== 5) {
    return (
      <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-sm text-rose-200">
        เมนูนี้เห็นได้เฉพาะ Rank 5 Executive
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <History className="text-indigo-400" /> ประวัติการยิง Notification
          </h2>
          <p className="text-xs text-slate-400 mt-1">ดู body ที่ส่งไป Nextopia และผลที่ได้รับกลับ — เฉพาะ Executive</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 hover:text-slate-100"
        >
          <RefreshCw size={14} /> รีเฟรช
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="p-4 rounded-2xl glass-panel overflow-x-auto">
        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">ยังไม่มีประวัติการยิง</div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-3 font-semibold">เวลา</th>
                <th className="py-2 pr-3 font-semibold">สถานะ</th>
                <th className="py-2 pr-3 font-semibold">HTTP</th>
                <th className="py-2 pr-3 font-semibold">หัวข้อ</th>
                <th className="py-2 font-semibold">ผู้รับ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {logs.map(log => {
                const recipients = Array.isArray(log.requestBody?.recipients)
                  ? log.requestBody.recipients.map((item: any) => item.email || item.userId).filter(Boolean).join(', ')
                  : '-';
                const open = openId === log._id;
                return (
                  <tr key={log._id} className="align-top">
                    <td colSpan={5} className="p-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? '' : log._id)}
                        className="w-full text-left px-0 py-3 hover:bg-slate-900/30"
                      >
                        <div className="grid grid-cols-[140px_90px_70px_1fr_1fr] gap-3 items-center">
                          <span className="text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString('th-TH') : '-'}</span>
                          <span className={`inline-flex justify-center px-2 py-0.5 rounded border text-[10px] font-bold ${outcomeStyle(log.outcome)}`}>
                            {outcomeLabel(log.outcome)}
                          </span>
                          <span className="text-slate-300">{log.httpStatus || '-'}</span>
                          <span className="text-slate-200 truncate">{log.requestBody?.title || '-'}</span>
                          <span className="text-slate-400 truncate">{recipients}</span>
                        </div>
                      </button>
                      {open && (
                        <div className="pb-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-800 bg-[#090d16] p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Body ที่ยิงไป</div>
                            <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-all">{pretty(log.requestBody)}</pre>
                            <div className="mt-2 text-[10px] text-slate-500">{log.method} {log.endpoint}</div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-[#090d16] p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">ผลที่ได้รับกลับ</div>
                            {log.skipReason && <div className="mb-2 text-[10px] text-amber-300">ข้าม: {log.skipReason}</div>}
                            {log.errorMessage && <div className="mb-2 text-[10px] text-rose-300">{log.errorMessage}</div>}
                            <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-all">{pretty(log.responseBody ?? log.responseText)}</pre>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
