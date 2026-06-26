import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { BarChart3, CalendarClock, FileText, School, TrendingUp } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activityType, setActivityType] = useState<'all' | 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other'>('all');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/tasks').catch(() => []),
      apiFetch('/api/leads').catch(() => []),
      apiFetch('/api/quotes').catch(() => []),
    ])
      .then(([taskData, leadData, quoteData]) => {
        setTasks(Array.isArray(taskData) ? taskData : []);
        setLeads(Array.isArray(leadData) ? leadData : []);
        setQuotes(Array.isArray(quoteData) ? quoteData : []);
      })
      .finally(() => setLoading(false));
  }, []);

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
