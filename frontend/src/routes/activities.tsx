import { createRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { Activity, Bell, Clock, Phone, Mail, Users, RefreshCw } from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';
import { useActivityTypes } from '../hooks/useActivityTypes';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/activities',
  component: ActivitiesComponent,
});

const REMINDER_OPTIONS = [
  { label: 'ไม่เตือน', value: 0 },
  { label: '15 นาที', value: 15 },
  { label: '30 นาที', value: 30 },
  { label: '1 ชั่วโมง', value: 60 },
  { label: '1 วัน', value: 1440 },
];

function ActivitiesComponent() {
  const { user } = useAuth();
  const { selectOptions: logTypeOptions } = useActivityTypes('log');
  const [feed, setFeed] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [form, setForm] = useState({
    leadId: '',
    type: 'Call',
    content: '',
    startAt: '',
    endAt: '',
    reminderMinutesBefore: '30',
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/api/activities'),
      apiFetch('/api/leads').catch(() => []),
    ])
      .then(([activityData, leadData]) => {
        setFeed(activityData.feed || []);
        setUpcoming(activityData.upcoming || []);
        setLeads(Array.isArray(leadData) ? leadData : []);
      })
      .catch(err => setError(err.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredLeads = leads.filter(lead =>
    lead.schoolName.toLowerCase().includes(leadSearch.trim().toLowerCase())
  );

  const selectLead = (lead: { _id: string; schoolName: string } | null) => {
    if (!lead) {
      setForm(prev => ({ ...prev, leadId: '' }));
      setLeadSearch('');
    } else {
      setForm(prev => ({ ...prev, leadId: lead._id }));
      setLeadSearch(lead.schoolName);
    }
    setShowLeadDropdown(false);
  };

  const handleLog = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.leadId) {
      setError('กรุณาเลือกโรงเรียน');
      return;
    }
    setSaving(true);
    apiJson('/api/activities/log', {
      leadId: form.leadId,
      type: form.type,
      content: form.content,
      startAt: form.startAt,
      endAt: form.endAt || undefined,
      reminderMinutesBefore: Number(form.reminderMinutesBefore) || 0,
    })
      .then(() => {
        setForm({
          leadId: '',
          type: 'Call',
          content: '',
          startAt: '',
          endAt: '',
          reminderMinutesBefore: '30',
        });
        setLeadSearch('');
        fetchData();
      })
      .catch(err => setError(err.message || 'บันทึกกิจกรรมไม่สำเร็จ'))
      .finally(() => setSaving(false));
  };

  const typeIcon = (type: string) => {
    if (type === 'Call') return <Phone size={12} />;
    if (type === 'Email') return <Mail size={12} />;
    if (type === 'Meeting') return <Users size={12} />;
    return <Activity size={12} />;
  };

  const upcomingBoxClass = (item: any) => {
    if (item.status === 'Completed') return 'border-emerald-600 bg-emerald-200';
    if (item.overdue) return 'border-rose-500 bg-rose-200';
    return 'border-slate-800 bg-[#090d16]/30';
  };

  const upcomingTextClass = (item: any) => (
    item.status === 'Completed' || item.overdue ? 'text-slate-900' : 'text-slate-200'
  );

  const upcomingMetaClass = (item: any) => (
    item.status === 'Completed' || item.overdue ? 'text-slate-800' : 'text-slate-500'
  );

  const upcomingStatusLabel = (item: any) => {
    if (item.status === 'Completed') return 'อัปเดตแล้ว';
    if (item.overdue) return 'เลยกำหนด';
    return 'รอดำเนินการ';
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Activity className="text-indigo-400" /> กิจกรรม & ติดตามงาน
          </h2>
          <p className="text-xs text-slate-400 mt-1">บันทึกการโทร อีเมล นัดหมาย และตั้ง Reminder — ซิงก์กับงาน นัดหมาย และปฏิทิน</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200">
          <RefreshCw size={14} /> รีเฟรช
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 p-6 rounded-2xl glass-panel space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">บันทึกกิจกรรมด่วน</h3>
          <form onSubmit={wrapFormSubmit(handleLog)} className="space-y-3">
            <div className="relative">
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">โรงเรียน</label>
              <input
                type="text"
                value={leadSearch}
                onChange={e => {
                  setLeadSearch(e.target.value);
                  setForm(prev => ({ ...prev, leadId: '' }));
                  setShowLeadDropdown(true);
                }}
                onFocus={() => setShowLeadDropdown(true)}
                onBlur={() => setTimeout(() => setShowLeadDropdown(false), 150)}
                placeholder="ค้นหาชื่อโรงเรียน..."
                className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200"
              />
              {showLeadDropdown && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-[#090d16] shadow-xl">
                  {filteredLeads.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">ไม่พบโรงเรียน</div>
                  ) : (
                    filteredLeads.map(lead => (
                      <button
                        key={lead._id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => selectLead(lead)}
                        className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                      >
                        {lead.schoolName}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">ประเภท</label>
              <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                {logTypeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">เริ่ม</label>
                <input type="datetime-local" value={form.startAt} onChange={e => setForm(prev => ({ ...prev, startAt: e.target.value }))} required className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">สิ้นสุด</label>
                <input type="datetime-local" value={form.endAt} onChange={e => setForm(prev => ({ ...prev, endAt: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">Reminder</label>
              <select value={form.reminderMinutesBefore} onChange={e => setForm(prev => ({ ...prev, reminderMinutesBefore: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-semibold mb-1">รายละเอียด</label>
              <textarea value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} rows={3} required placeholder="สรุปการติดต่อ..." className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            </div>
            <button type="submit" disabled={saving} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'บันทึกกิจกรรม'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl glass-panel space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Bell size={14} /> งานที่ต้องติดตาม (7 วัน)
            </h3>
            {loading ? (
              <div className="text-xs text-slate-500 py-6 text-center">กำลังโหลด...</div>
            ) : upcoming.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">ไม่มีงานที่ต้องติดตามในช่วงนี้</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(item => (
                  <div key={item._id} className={`p-3 rounded-xl border ${upcomingBoxClass(item)}`}>
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase ${item.status === 'Completed' ? 'text-emerald-800' : 'text-indigo-700'}`}>{item.type}</span>
                          <span className={`text-[9px] font-bold ${item.status === 'Completed' ? 'text-emerald-800' : item.overdue ? 'text-rose-800' : 'text-slate-400'}`}>
                            {upcomingStatusLabel(item)}
                          </span>
                        </div>
                        <h4 className={`text-sm font-semibold ${upcomingTextClass(item)}`}>{item.title}</h4>
                        {item.schoolName && (
                          <Link to="/leads/$leadId" params={{ leadId: item.leadId }} className={`text-[10px] hover:underline ${upcomingMetaClass(item)}`}>
                            {item.schoolName}
                          </Link>
                        )}
                      </div>
                      <div className={`text-right text-[10px] shrink-0 ${upcomingMetaClass(item)}`}>
                        <span className="flex items-center gap-1 justify-end"><Clock size={10} /> {new Date(item.startAt).toLocaleString('th-TH')}</span>
                        {item.reminderAt && <span className={`block mt-1 font-semibold ${item.status === 'Completed' ? 'text-emerald-900' : 'text-amber-800'}`}>เตือน: {new Date(item.reminderAt).toLocaleString('th-TH')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-2xl glass-panel space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Feed</h3>
            {loading ? (
              <div className="text-xs text-slate-500 py-6 text-center">กำลังโหลด...</div>
            ) : feed.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">ยังไม่มีกิจกรรม</div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {feed.map(item => (
                  <div key={item._id} className="p-3 rounded-xl border border-slate-800 bg-[#121826]/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-[9px] font-bold text-indigo-300">
                          {typeIcon(item.activityType)} {item.kind} · {item.activityType}
                        </span>
                        <h4 className="mt-2 text-sm font-semibold text-slate-200">{item.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                        {item.schoolName && item.leadId && (
                          <Link to="/leads/$leadId" params={{ leadId: item.leadId }} className="text-[10px] text-slate-500 hover:text-indigo-300 mt-1 block">
                            {item.schoolName}
                          </Link>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{new Date(item.createdAt).toLocaleString('th-TH')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
