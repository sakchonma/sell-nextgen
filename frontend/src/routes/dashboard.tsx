import { createRoute, Link } from '@tanstack/react-router';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  MapPin, 
  FileCheck, 
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/dashboard',
  component: DashboardComponent,
});

function DashboardComponent() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<any[]>('/api/leads').catch(() => []),
      apiFetch<any[]>('/api/opportunities').catch(() => []),
      apiFetch<any[]>('/api/tasks').catch(() => []),
      apiFetch<any[]>('/api/quotes').catch(() => []),
      apiFetch<any[]>('/api/requests').catch(() => []),
    ]).then(([leadData, opportunityData, taskData, quoteData, requestData]) => {
      setLeads(Array.isArray(leadData) ? leadData : []);
      setOpportunities(Array.isArray(opportunityData) ? opportunityData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setQuotes(Array.isArray(quoteData) ? quoteData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
    });
  }, [user?._id]);

  const metrics = useMemo(() => {
    const activePipeline = opportunities
      .filter(opp => !['Won', 'Lost'].includes(opp.stage))
      .reduce((sum, opp) => sum + Number(opp.value || 0), 0);
    const wonDeals = opportunities
      .filter(opp => opp.stage === 'Won')
      .reduce((sum, opp) => sum + Number(opp.value || 0), 0);
    const overdueTasks = tasks.filter(task => task.status !== 'Completed' && new Date(task.endAt) < new Date()).length;
    return {
      pipelineActive: `${activePipeline.toLocaleString('th-TH')} ฿`,
      wonDeals: `${wonDeals.toLocaleString('th-TH')} ฿`,
      hotLeads: leads.filter(lead => lead.status === 'Hot').length,
      overdueTasks
    };
  }, [leads, opportunities, tasks]);

  const leadStatusBars = useMemo(() => {
    const total = Math.max(leads.length, 1);
    const stages = [
      { key: 'Cold', stage: 'ลูกค้าเป้าหมายที่รอคัดเลือก (Cold)', color: 'from-blue-600 to-blue-500' },
      { key: 'Warm', stage: 'เริ่มติดต่อแนะนำหลักสูตร (Warm)', color: 'from-indigo-600 to-indigo-500' },
      { key: 'Hot', stage: 'เจรจาทำสัญญา/นัดสาธิต (Hot)', color: 'from-amber-600 to-amber-500' },
      { key: 'Customer', stage: 'ปิดดีลส่งมอบหลักสูตร (Customer)', color: 'from-emerald-600 to-emerald-500' }
    ];
    return stages.map(item => {
      const count = leads.filter(lead => lead.status === item.key).length;
      return { ...item, count, pct: `${Math.round((count / total) * 100)}%` };
    });
  }, [leads]);

  const recentActivities = useMemo(() => {
    const quoteActs = quotes.map(quote => ({
      title: quote.status === 'PendingApproval' ? 'ส่งใบเสนอราคารออนุมัติ' : 'อัปเดตใบเสนอราคา',
      body: `${quote.quoteNumber || 'Quote'} มูลค่า ${Number(quote.totalAmount || 0).toLocaleString('th-TH')} บาท`,
      time: quote.updatedAt || quote.createdAt,
      type: 'quote'
    }));
    const taskActs = tasks.map(task => ({
      title: 'บันทึกนัดหมาย/งาน',
      body: task.title,
      time: task.updatedAt || task.startAt,
      type: 'meeting'
    }));
    const requestActs = requests.map(request => ({
      title: 'อัปเดตคำขอสนับสนุน',
      body: `${request.requestNumber || 'Request'}: ${request.title}`,
      time: request.updatedAt || request.createdAt,
      type: 'request'
    }));
    return [...quoteActs, ...taskActs, ...requestActs]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5);
  }, [quotes, requests, tasks]);

  const todaysTasks = tasks
    .filter(task => new Date(task.startAt).toDateString() === new Date().toDateString())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const getRankTitle = (rank: number) => {
    if (rank === 5) return 'Executive';
    if (rank === 4) return 'Manager / Assistant';
    if (rank === 3) return 'Sales Agent';
    return 'Support Specialist';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl glass-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl"></div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center gap-1">
              <Sparkles size={10} /> Active Session
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-slate-400 text-xs">ระบายสีตามธีมระบบ</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-slate-100 flex items-center gap-2">
            สวัสดี, {user?.name || 'พนักงาน'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ยินดีต้อนรับสู่แผงควบคุมระบบนำส่งผลงานและการจัดการคำขอของแผนก.
          </p>
        </div>

        {/* Current User Role Info Card */}
        {user && (
          <div className="px-4 py-3 rounded-xl border border-slate-800 bg-[#090d16]/50 flex items-center gap-3 self-start md:self-auto">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
              {user.name.charAt(0)}
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-200">{getRankTitle(user.rank)}</span>
              {user.zone && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-400 mt-0.5">
                  <MapPin size={10} /> {user.zone}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Pipeline ทั้งหมด (Active)', val: metrics.pipelineActive, desc: 'ดีลกำลังดำเนินการเสนอขาย', icon: TrendingUp, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', to: '/pipeline' },
          { title: 'ปิดการขายได้ (Won)', val: metrics.wonDeals, desc: 'สะสมในรอบปีการขายปัจจุบัน', icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', to: '/pipeline' },
          { title: 'Hot Leads ในมือ', val: metrics.hotLeads, desc: 'โรงเรียนระดับความเร่งด่วนสูง', icon: Zap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', to: '/leads' },
          { title: 'งานเกินกำหนด (Overdue)', val: metrics.overdueTasks, desc: 'งานรอดำเนินการที่เลยเวลาส่ง', icon: AlertCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', to: '/tasks' }
        ].map((item, idx) => (
          <Link key={idx} to={item.to as any} className="p-5 rounded-2xl glass-card flex flex-col justify-between h-32 hover:border-indigo-500/30 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{item.title}</span>
              <div className={`p-2 rounded-lg border ${item.color}`}>
                <item.icon size={16} />
              </div>
            </div>
            <div>
              <span className="block font-display font-bold text-lg text-slate-100">{item.val}</span>
              <span className="block text-[9.5px] text-slate-500 mt-1">{item.desc}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* WORKSPACE CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Status Funnel and Activities */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl glass-card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">สัดส่วนสถานะลูกค้ารายโรงเรียน (Lead Status Funnel)</h3>
              <span className="text-[10px] text-indigo-400 font-semibold">อัปเดตเรียลไทม์</span>
            </div>
            
            {/* Funnel simulation bars */}
            <div className="space-y-4">
              {leadStatusBars.map((bar, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">{bar.stage}</span>
                    <span className="text-slate-400">{bar.count} โรงเรียน ({bar.pct})</span>
                  </div>
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${bar.color} rounded-full`}
                      style={{ width: bar.pct }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="p-6 rounded-2xl glass-card">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">กิจกรรมล่าสุดในเขตรับผิดชอบ</h3>
            <div className="relative pl-6 border-l border-slate-800 space-y-6">
              {recentActivities.map((act, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[#090d16]"></div>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{act.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{act.body}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">{new Date(act.time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีกิจกรรมล่าสุด</div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Dynamic Role Actions & Reminders */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-card border border-indigo-500/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
              <Zap size={14} className="text-indigo-400" />
              ทางลัดด่วน (Quick Actions)
            </h3>
            
            <div className="space-y-2">
              <Link
                to="/leads"
                className="w-full p-3 rounded-xl border border-slate-800 bg-[#090d16]/30 hover:bg-slate-800/40 text-left text-xs font-semibold text-slate-300 flex items-center justify-between transition-all group"
              >
                <span>➕ เพิ่มข้อมูล Lead โรงเรียนใหม่</span>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                to="/quotes/build"
                className="w-full p-3 rounded-xl border border-slate-800 bg-[#090d16]/30 hover:bg-slate-800/40 text-left text-xs font-semibold text-slate-300 flex items-center justify-between transition-all group"
              >
                <span>📄 สร้างใบเสนอราคา (QuoteBuilder)</span>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                to="/requests/create"
                className="w-full p-3 rounded-xl border border-slate-800 bg-[#090d16]/30 hover:bg-slate-800/40 text-left text-xs font-semibold text-slate-300 flex items-center justify-between transition-all group"
              >
                <span>📋 ส่งคำขอถึงแผนกสนับสนุน (Requests)</span>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* Pending tasks reminder card */}
          <div className="p-6 rounded-2xl glass-card">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" />
              แจ้งเตือนตารางงานวันนี้
            </h3>
            <div className="space-y-3">
              {todaysTasks.map((task, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/40 text-left">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">{task.type}</span>
                  <h4 className="text-xs font-semibold text-slate-200">{task.title}</h4>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {todaysTasks.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">วันนี้ยังไม่มีนัดหมาย</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
