import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { BarChart3, CalendarClock, Download, FileText, GitBranch, Printer, School, TrendingUp } from 'lucide-react';
import { apiFetch } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/reports',
  component: ReportsComponent,
});

function ReportsComponent() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activityType, setActivityType] = useState<'all' | 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other'>('all');

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    Promise.all([
      apiFetch('/api/tasks').catch(() => []),
      apiFetch('/api/leads').catch(() => []),
      apiFetch('/api/quotes').catch(() => []),
      apiFetch(`/api/reports/summary?${params.toString()}`).catch(() => null),
    ])
      .then(([taskData, leadData, quoteData, summaryData]) => {
        setTasks(Array.isArray(taskData) ? taskData : []);
        setLeads(Array.isArray(leadData) ? leadData : []);
        setQuotes(Array.isArray(quoteData) ? quoteData : []);
        setReportSummary(summaryData);
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
    const tasksThisMonth = tasks.filter(task => String(task.startAt || '').startsWith(monthKey));
    const hotLeads = leads.filter(lead => lead.status === 'Hot');
    const approvedQuotes = quotes.filter(quote => quote.status === 'Approved');
    const quoteValue = approvedQuotes.reduce((sum, quote) => sum + Number(quote.totalAmount || 0), 0);

    return {
      tasksThisMonth: tasksThisMonth.length,
      hotLeads: hotLeads.length,
      approvedQuotes: approvedQuotes.length,
      quoteValue
    };
  }, [tasks, leads, quotes]);

  const filteredActivities = [...tasks]
    .filter(activity => activityType === 'all' || activity.type === activityType)
    .filter(activity => {
      const ts = new Date(activity.startAt || activity.createdAt).getTime();
      if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && ts > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      return true;
    });

  const recentActivities = filteredActivities
    .sort((a, b) => new Date(b.startAt || b.createdAt).getTime() - new Date(a.startAt || a.createdAt).getTime())
    .slice(0, 8);

  const cards = [
    { label: 'กิจกรรมเดือนนี้', value: stats.tasksThisMonth, icon: CalendarClock, tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
    { label: 'Hot Leads', value: stats.hotLeads, icon: School, tone: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
    { label: 'ใบเสนอราคาอนุมัติ', value: stats.approvedQuotes, icon: FileText, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'มูลค่าอนุมัติ', value: `${stats.quoteValue.toLocaleString('th-TH')} ฿`, icon: TrendingUp, tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  ];

  const exportCsv = () => {
    const rows = [
      ['section', 'metric', 'value'],
      ['metrics', 'leads', reportSummary?.metrics?.leads ?? stats.hotLeads],
      ['metrics', 'opportunities', reportSummary?.metrics?.opportunities ?? 0],
      ['metrics', 'quotes', reportSummary?.metrics?.quotes ?? quotes.length],
      ['metrics', 'wonValue', reportSummary?.metrics?.wonValue ?? 0],
      ['quoteApproval', 'approved', reportSummary?.quoteApproval?.approved ?? 0],
      ['quoteApproval', 'pending', reportSummary?.quoteApproval?.pending ?? 0],
      ['quoteApproval', 'rejected', reportSummary?.quoteApproval?.rejected ?? 0],
      ['requestSla', 'breached', reportSummary?.requestSla?.breached ?? 0],
      ['taskReport', 'overdue', reportSummary?.taskReport?.overdue ?? 0],
      ...((reportSummary?.salesForecast || []).map((row: any) => ['salesForecast', row.ownerName, row.weightedForecast])),
      ...((reportSummary?.salesPerformance || []).map((row: any) => ['salesPerformance', row.name, row.wonValue]))
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nextgen-report-summary.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div>
        <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
          <BarChart3 className="text-indigo-400" /> รายงานกิจกรรม
        </h2>
        <p className="text-xs text-slate-400 mt-1">ภาพรวมกิจกรรมขาย Leads และใบเสนอราคาจากข้อมูลที่ระบบมีอยู่</p>
      </div>

      <section className="p-4 rounded-2xl glass-panel">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">จากวันที่</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ถึงวันที่</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">ประเภทกิจกรรม</label>
            <select value={activityType} onChange={(e) => setActivityType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              <option value="all">ทั้งหมด</option>
              <option value="Call">Call</option>
              <option value="Meeting">Meeting</option>
              <option value="Demo">Demo</option>
              <option value="FollowUp">FollowUp</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setDateFrom(''); setDateTo(''); setActivityType('all'); }} className="w-full px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 hover:bg-slate-800">
              ล้างตัวกรอง
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">Report scope: {reportSummary?.scope === 'team' ? 'ทีม/องค์กรตามสิทธิ์' : 'ข้อมูลส่วนตัวตามสิทธิ์'}</span>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800">
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`p-4 rounded-xl border ${card.tone}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{card.label}</span>
                <Icon size={18} />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-100">{loading ? '...' : card.value}</div>
            </div>
          );
        })}
      </div>

      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Conversion funnel</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ['Leads', reportSummary?.funnel?.leads || 0, '/leads'],
            ['Opportunities', reportSummary?.funnel?.opportunities || 0, '/pipeline'],
            ['Quotes', reportSummary?.funnel?.quotes || 0, '/quotes'],
            ['Won', reportSummary?.funnel?.won || 0, '/pipeline'],
          ].map(([label, value, href]) => (
            <a key={label} href={href as string} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                <GitBranch size={15} className="text-indigo-400" />
              </div>
              <span className="block mt-2 text-xl font-black text-slate-100">{loading ? '...' : value}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Quote approval report</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              <span className="block text-lg font-black">{reportSummary?.quoteApproval?.approved || 0}</span>
              Approved
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300">
              <span className="block text-lg font-black">{reportSummary?.quoteApproval?.pending || 0}</span>
              Pending
            </div>
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300">
              <span className="block text-lg font-black">{reportSummary?.quoteApproval?.rejected || 0}</span>
              Rejected
            </div>
          </div>
          <div className="text-xs text-slate-400">มูลค่าอนุมัติ: <span className="text-slate-100 font-semibold">{Number(reportSummary?.quoteApproval?.approvedValue || 0).toLocaleString('th-TH')} ฿</span></div>
        </div>

        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Request SLA / Task overdue</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 rounded-lg border border-slate-800 bg-[#121826]/40">
              <span className="block text-lg font-black text-slate-100">{reportSummary?.requestSla?.completed || 0}</span>
              Completed
            </div>
            <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-300">
              <span className="block text-lg font-black">{reportSummary?.requestSla?.breached || 0}</span>
              SLA Breach
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300">
              <span className="block text-lg font-black">{reportSummary?.taskReport?.overdue || 0}</span>
              Task Overdue
            </div>
          </div>
          <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 text-[10.5px] text-slate-400">
            {(reportSummary?.requestSla?.rows || []).slice(0, 6).map((row: any) => (
              <div key={row.requestNumber} className="py-2 flex items-center justify-between gap-3">
                <span className="truncate">{row.requestNumber} · {row.title}</span>
                <span className={row.breached ? 'text-rose-300' : 'text-slate-500'}>{row.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sales forecast</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[9.5px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3 text-right">Deals</th>
                <th className="py-2 pr-3 text-right">Pipeline</th>
                <th className="py-2 text-right">Weighted Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(reportSummary?.salesForecast || []).map((row: any) => (
                <tr key={row.ownerId}>
                  <td className="py-2 pr-3 font-semibold text-slate-200">{row.ownerName}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.zone}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.dealCount}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{Number(row.pipelineValue || 0).toLocaleString('th-TH')} ฿</td>
                  <td className="py-2 text-right text-slate-100 font-semibold">{Number(row.weightedForecast || 0).toLocaleString('th-TH')} ฿</td>
                </tr>
              ))}
              {(reportSummary?.salesForecast || []).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">ยังไม่มี forecast ในช่วงนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sales performance by user/zone</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[9.5px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3 text-right">Leads</th>
                <th className="py-2 pr-3 text-right">Quotes</th>
                <th className="py-2 pr-3 text-right">Won</th>
                <th className="py-2 text-right">Won Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(reportSummary?.salesPerformance || []).map((row: any) => (
                <tr key={row.userId}>
                  <td className="py-2 pr-3 font-semibold text-slate-200">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{row.zone}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.leads}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.quotes}</td>
                  <td className="py-2 pr-3 text-right text-slate-300">{row.won}</td>
                  <td className="py-2 text-right text-slate-100 font-semibold">{Number(row.wonValue || 0).toLocaleString('th-TH')} ฿</td>
                </tr>
              ))}
              {(reportSummary?.salesPerformance || []).length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">ยังไม่มีข้อมูล performance ในช่วงนี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">กิจกรรมล่าสุด ({filteredActivities.length})</h3>
        <div className="divide-y divide-slate-800">
          {recentActivities.map(activity => (
            <div key={activity._id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-700">{activity.type || 'Other'}</span>
                <h4 className="mt-1 text-xs font-semibold text-slate-200">{activity.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-1">{activity.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">
                {new Date(activity.startAt || activity.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          ))}
          {!loading && recentActivities.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">ยังไม่มีข้อมูลกิจกรรมสำหรับรายงาน</div>
          )}
        </div>
      </section>
    </div>
  );
}
