import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth, User } from '../hooks/useAuth';
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Filter,
  MapPin,
  Target,
  TrendingUp,
  Users2,
  Zap,
} from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/team-overview',
  component: TeamOverviewComponent,
});

type Lead = {
  _id: string;
  schoolName: string;
  address?: string;
  zone?: string;
  status: string;
  score?: number;
  assignedTo: string;
};

type Opportunity = {
  _id: string;
  leadId: string;
  title: string;
  stage: string;
  value: number;
  closeDate?: string;
  assignedTo: string;
};

type AdminEvent = {
  id: string;
  source: 'task' | 'request';
  title: string;
  status: string;
  startAt: string;
  ownerId?: string;
};

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function money(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿';
}

function stageStyle(stage: string) {
  if (stage === 'Won') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (stage === 'Lost') return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
  if (stage === 'Proposal' || stage === 'Negotiation') return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function leadStyle(status: string) {
  if (status === 'Hot') return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
  if (status === 'Customer') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (status === 'Warm') return 'bg-sky-500/10 text-sky-300 border-sky-500/25';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

function TeamOverviewComponent() {
  const { user } = useAuth();
  const [salesReps, setSalesReps] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [error, setError] = useState('');

  const fetchData = () => {
    setError('');
    const headers = authHeaders();
    Promise.all([
      fetch('/api/users', { headers }).then(res => res.json()),
      fetch('/api/leads', { headers }).then(res => res.json()),
      fetch('/api/opportunities', { headers }).then(res => res.json()),
      fetch('/api/admin-calendar/events', { headers }).then(res => res.ok ? res.json() : { events: [] }),
    ])
      .then(([userData, leadData, oppData, calendarData]) => {
        const reps = Array.isArray(userData) ? userData.filter((item: User) => item.rank === 3) : [];
        setSalesReps(reps);
        setLeads(Array.isArray(leadData) ? leadData : []);
        setOpps(Array.isArray(oppData) ? oppData : []);
        setEvents(Array.isArray(calendarData.events) ? calendarData.events : []);
        setSelectedRepId(prev => prev || reps[0]?._id || '');
      })
      .catch(err => {
        console.error('Failed to load team overview:', err);
        setError('โหลดข้อมูลภาพรวมทีมไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const zones = useMemo(() => {
    return Array.from(new Set([
      ...salesReps.map(rep => rep.zone).filter(Boolean),
      ...leads.map(lead => lead.zone).filter(Boolean),
    ] as string[])).sort();
  }, [salesReps, leads]);

  const visibleReps = useMemo(() => {
    if (zoneFilter === 'All') return salesReps;
    return salesReps.filter(rep => rep.zone === zoneFilter);
  }, [salesReps, zoneFilter]);

  const getRepStats = (repId: string) => {
    const repLeads = leads.filter(lead => lead.assignedTo === repId);
    const repOpps = opps.filter(opp => opp.assignedTo === repId);
    const repTasks = events.filter(event => event.source === 'task' && event.ownerId === repId);
    const wonOpps = repOpps.filter(opp => opp.stage === 'Won');
    const lostOpps = repOpps.filter(opp => opp.stage === 'Lost');
    const openOpps = repOpps.filter(opp => !['Won', 'Lost'].includes(opp.stage));
    const closedCount = wonOpps.length + lostOpps.length;
    const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;
    const pipeline = openOpps.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);
    const wonValue = wonOpps.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0);
    const hotLeads = repLeads.filter(lead => lead.status === 'Hot').length;
    const nextClose = openOpps
      .filter(opp => opp.closeDate)
      .sort((a, b) => new Date(a.closeDate || '').getTime() - new Date(b.closeDate || '').getTime())[0];

    return {
      leads: repLeads,
      opportunities: repOpps,
      tasks: repTasks,
      totalDeals: repOpps.length,
      openDeals: openOpps.length,
      wonDeals: wonOpps.length,
      lostDeals: lostOpps.length,
      winRate,
      pipeline,
      wonValue,
      hotLeads,
      nextClose,
    };
  };

  const teamStats = useMemo(() => {
    return visibleReps.reduce((acc, rep) => {
      const stats = getRepStats(rep._id);
      acc.pipeline += stats.pipeline;
      acc.wonValue += stats.wonValue;
      acc.deals += stats.totalDeals;
      acc.wonDeals += stats.wonDeals;
      acc.hotLeads += stats.hotLeads;
      return acc;
    }, { pipeline: 0, wonValue: 0, deals: 0, wonDeals: 0, hotLeads: 0 });
  }, [visibleReps, leads, opps, events]);

  const selectedRep = visibleReps.find(rep => rep._id === selectedRepId) || visibleReps[0];
  const selectedStats = selectedRep ? getRepStats(selectedRep._id) : null;

  const canUsePage = user && user.rank >= 4;

  if (!canUsePage) {
    return (
      <div className="space-y-4 text-slate-100 text-left animate-fade-in">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Users2 className="text-indigo-400" /> ภาพรวมทีม
        </h2>
        <div className="p-6 rounded-xl border border-slate-800 bg-[#121826]/40 text-sm text-slate-400">
          บัญชีนี้ไม่มีสิทธิ์เข้าถึงภาพรวมทีมขาย
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Users2 className="text-indigo-400" /> ภาพรวมทีมขาย
          </h2>
          <p className="text-xs text-slate-400 mt-1">ติดตาม pipeline, win rate, ยอดปิดการขาย และความเข้มของ lead แยกรายพนักงานขาย</p>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#121826]/60 text-[10px] text-slate-500 lg:w-64">
          <Filter size={12} />
          <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className="w-full bg-transparent text-slate-300 outline-none">
            <option value="All">ทุกภูมิภาค</option>
            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Active Pipeline', value: money(teamStats.pipeline), icon: TrendingUp },
          { label: 'Won Value', value: money(teamStats.wonValue), icon: CheckCircle2 },
          { label: 'Deals', value: teamStats.deals, icon: Briefcase },
          { label: 'Hot Leads', value: teamStats.hotLeads, icon: Zap },
        ].map(item => (
          <div key={item.label} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
              <item.icon size={15} className="text-indigo-400" />
            </div>
            <span className="block text-lg font-bold text-slate-100 mt-2">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleReps.map(rep => {
            const stats = getRepStats(rep._id);
            const isSelected = selectedRep?._id === rep._id;

            return (
              <button
                key={rep._id}
                onClick={() => setSelectedRepId(rep._id)}
                className={`h-full min-h-56 text-left p-5 rounded-xl border bg-[#121826]/40 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">{rep.name}</h4>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                      <MapPin size={10} /> {rep.zone || 'ไม่ระบุเขต'}
                    </span>
                  </div>
                  <span className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
                    {rep.name.charAt(0)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5">
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2">
                    <span className="block text-base font-bold text-slate-100">{stats.totalDeals}</span>
                    <span className="block text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Deals</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2">
                    <span className="block text-base font-bold text-slate-100">{stats.winRate}%</span>
                    <span className="block text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Win Rate</span>
                  </div>
                  <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-2">
                    <span className="block text-base font-bold text-slate-100">{stats.hotLeads}</span>
                    <span className="block text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Hot</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 text-[10px]">
                  <div>
                    <span className="block text-slate-500">Pipeline</span>
                    <span className="block text-indigo-300 font-bold mt-0.5">{money(stats.pipeline)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-slate-500">Won</span>
                    <span className="block text-emerald-300 font-bold mt-0.5">{money(stats.wonValue)}</span>
                  </div>
                </div>
              </button>
            );
          })}

          {visibleReps.length === 0 && (
            <div className="md:col-span-2 p-8 rounded-xl border border-slate-800 bg-[#121826]/40 text-center text-xs text-slate-500">
              ไม่พบพนักงานขายในภูมิภาคที่เลือก
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 min-h-[480px]">
          {selectedRep && selectedStats ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{selectedRep.name}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                    <MapPin size={10} /> {selectedRep.zone || 'ไม่ระบุเขต'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] text-slate-500">Close Stats</span>
                  <span className="block text-sm font-bold text-slate-100 mt-0.5">{selectedStats.wonDeals}W / {selectedStats.lostDeals}L</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3">
                  <span className="block text-[10px] text-slate-500">Open Deals</span>
                  <span className="block text-lg font-bold text-slate-100 mt-1">{selectedStats.openDeals}</span>
                </div>
                <div className="rounded-lg bg-slate-950/40 border border-slate-800 p-3">
                  <span className="block text-[10px] text-slate-500">Tasks</span>
                  <span className="block text-lg font-bold text-slate-100 mt-1">{selectedStats.tasks.length}</span>
                </div>
              </div>

              {selectedStats.nextClose && (
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                    <Target size={12} /> Next Close
                  </span>
                  <p className="text-xs font-semibold text-slate-100 mt-2">{selectedStats.nextClose.title}</p>
                  <span className="text-[10px] text-slate-400">
                    {new Date(selectedStats.nextClose.closeDate || '').toLocaleDateString('th-TH')} · {money(Number(selectedStats.nextClose.value) || 0)}
                  </span>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1">
                  <Briefcase size={12} /> Deals
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedStats.opportunities.map(opp => (
                    <div key={opp._id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-200 line-clamp-2">{opp.title}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[8px] font-bold ${stageStyle(opp.stage)}`}>{opp.stage}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{money(Number(opp.value) || 0)}</span>
                        <span className="inline-flex items-center gap-0.5"><ArrowUpRight size={10} /> {opp.closeDate ? new Date(opp.closeDate).toLocaleDateString('th-TH') : '-'}</span>
                      </div>
                    </div>
                  ))}
                  {selectedStats.opportunities.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีดีลในความดูแล</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Leads</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedStats.leads.map(lead => (
                    <div key={lead._id} className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="block text-xs font-semibold text-slate-200">{lead.schoolName}</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">{lead.address || lead.zone || '-'}</span>
                        </div>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[8px] font-bold ${leadStyle(lead.status)}`}>{lead.status}</span>
                      </div>
                    </div>
                  ))}
                  {selectedStats.leads.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500">ยังไม่มี lead ในความดูแล</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-500">เลือกพนักงานขายเพื่อดูรายละเอียด</div>
          )}
        </div>
      </div>
    </div>
  );
}
