import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowRight,
  Building,
  Calendar,
  DollarSign,
  FolderKanban,
  History,
  Link as LinkIcon,
  Plus,
  Search,
  TrendingUp,
  X
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { filterLeadsBySearch } from '../lib/lead-search';
import { SALES_FUNNEL_STAGES, getPipelineColumnStyle, normalizeLeadStage, resolveLeadPipelineValue } from '../lib/sales-funnel-stages';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/pipeline',
  component: PipelineComponent,
});

const STAGES = SALES_FUNNEL_STAGES.map(stage => ({
  id: stage.code,
  label: stage.labelTh,
  color: getPipelineColumnStyle(stage.code),
}));

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('th-TH');
}

function PipelineComponent() {
  const { user } = useAuth();
  const canManagePipeline = (user?.rank || 0) >= 4;
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [pendingStage, setPendingStage] = useState<{ lead: any; stage: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLeadId, setNewLeadId] = useState('');
  const [newLeadSearch, setNewLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newCloseDate, setNewCloseDate] = useState('');
  const [newProbability, setNewProbability] = useState('20');

  const fetchData = () => {
    Promise.all([
      apiFetch<any[]>('/api/opportunities').catch(() => []),
      apiFetch<any[]>('/api/leads').catch(() => []),
      apiFetch<any[]>('/api/users').catch(() => []),
      apiFetch<any[]>('/api/opportunities/forecast').catch(() => []),
      apiFetch<any[]>('/api/quotes').catch(() => [])
    ]).then(([opps, leadData, userData, forecastData, quoteData]) => {
      setOpportunities(opps);
      setLeads(leadData);
      setUsers(userData);
      setForecast(forecastData);
      setQuotes(quoteData);
    });
  };

  const openAddModal = () => {
    setError('');
    setNewTitle('');
    setNewLeadId('');
    setNewLeadSearch('');
    setShowLeadDropdown(false);
    setNewValue('');
    setNewCloseDate('');
    setNewProbability('20');
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setShowLeadDropdown(false);
  };

  const selectLead = (lead: { _id: string; schoolName: string } | null) => {
    if (!lead) {
      setNewLeadId('');
      setNewLeadSearch('');
    } else {
      setNewLeadId(lead._id);
      setNewLeadSearch(lead.schoolName);
    }
    setShowLeadDropdown(false);
  };

  const filteredLeads = useMemo(
    () => filterLeadsBySearch(leads, newLeadSearch),
    [leads, newLeadSearch]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const pipelineLeads = useMemo(
    () => leads.filter(lead => !lead.archived),
    [leads]
  );

  const oppByLeadId = useMemo(() => {
    const map = new Map<string, any>();
    opportunities.forEach(opp => {
      if (opp.leadId) map.set(opp.leadId, opp);
    });
    return map;
  }, [opportunities]);

  const resolveLeadStage = (lead: any) => normalizeLeadStage(lead?.stage);

  const selectedOpp = selectedLead ? oppByLeadId.get(selectedLead._id) || null : null;
  const selectedLeadQuotes = useMemo(
    () => quotes.filter(quote => quote.leadId === selectedLead?._id),
    [quotes, selectedLead?._id]
  );

  const visibleStages = useMemo(
    () => (stageFilter === 'All' ? STAGES : STAGES.filter(stage => stage.id === stageFilter)),
    [stageFilter]
  );

  const userName = (userId?: string) => users.find(user => user._id === userId)?.name || 'ไม่ระบุ';

  const calculateStageSum = (stageId: string) => pipelineLeads
    .filter(lead => resolveLeadStage(lead) === stageId)
    .reduce((acc, lead) => acc + resolveLeadPipelineValue(lead._id, stageId as any, opportunities, quotes), 0);

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newLeadId) {
      setError('กรุณาเลือกโรงเรียนจากรายการที่ค้นหา');
      return;
    }
    apiJson('/api/opportunities', {
      leadId: newLeadId,
      title: newTitle,
      value: Number(newValue) || 0,
      closeDate: newCloseDate,
      probability: Number(newProbability) || 20
    })
      .then(() => {
        closeAddModal();
        setNewTitle('');
        setNewLeadId('');
        setNewLeadSearch('');
        setNewValue('');
        setNewCloseDate('');
        setNewProbability('20');
        fetchData();
      })
      .catch(err => setError(err.message || 'สร้าง opportunity ไม่สำเร็จ'));
  };

  const updateLeadStage = (lead: any, stage: string, reason?: string) => {
    if (!canManagePipeline) return;
    apiJson(`/api/leads/${lead._id}`, {
      stage,
      transferReason: reason,
    }, { method: 'PUT' })
      .then(() => {
        setPendingStage(null);
        setLostReason('');
        fetchData();
      })
      .catch(err => setError(err.message || 'อัปเดต stage ไม่สำเร็จ'));
  };

  const handleStageChange = (lead: any, stage: string) => {
    if (!canManagePipeline || stage === resolveLeadStage(lead)) return;
    if (stage === 'Lost') {
      setPendingStage({ lead, stage });
      setLostReason('');
      return;
    }
    updateLeadStage(lead, stage);
  };

  const handleDrop = (stage: string) => {
    if (!canManagePipeline) return;
    const lead = pipelineLeads.find(item => item._id === draggingId);
    setDraggingId('');
    if (lead) handleStageChange(lead, stage);
  };

  const saveOpportunity = (patch: Record<string, unknown>) => {
    if (!selectedOpp || !canManagePipeline) return;
    apiJson(`/api/opportunities/${selectedOpp._id}`, patch, { method: 'PUT' })
      .then(updated => {
        setOpportunities(prev => prev.map(item => item._id === selectedOpp._id ? updated : item));
        fetchData();
      })
      .catch(err => setError(err.message || 'บันทึก opportunity ไม่สำเร็จ'));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <FolderKanban className="text-indigo-400" /> Opportunity Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {canManagePipeline
              ? 'ติดตาม Lead/โรงเรียนตามสถานะการขาย — ลากหรือเปลี่ยนสเตจได้ (Manager+) · มูลค่าจากดีล/ใบเสนอราคาเมื่อมี'
              : 'ดู Lead/โรงเรียนตามสถานะการขาย — เปลี่ยนสถานะได้ที่หน้า Leads & โรงเรียน'}
          </p>
        </div>
        {canManagePipeline && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
          >
            <Plus size={14} /> เพิ่มดีลเสนอขาย
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStageFilter('All')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${stageFilter === 'All' ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-800 text-slate-400 hover:bg-slate-800/60'}`}
        >
          ทั้งหมด
        </button>
        {STAGES.map(stage => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setStageFilter(stage.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${stageFilter === stage.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-800 text-slate-400 hover:bg-slate-800/60'}`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {forecast.slice(0, 4).map(item => (
          <div key={`${item.month}-${item.ownerId}`} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40">
            <div className="text-[10px] text-slate-500">{item.month} · {item.ownerName}</div>
            <div className="mt-2 text-lg font-black text-slate-100">{formatMoney(item.weightedForecast)} ฿</div>
            <div className="mt-1 text-[10px] text-slate-400">{item.dealCount} ดีล · Pipeline {formatMoney(item.pipelineValue)} ฿</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start select-none">
        {visibleStages.map(stage => {
          const stageLeads = pipelineLeads.filter(lead => resolveLeadStage(lead) === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={e => canManagePipeline && e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
              className="w-80 shrink-0 p-4 rounded-2xl bg-[#121826]/40 border border-slate-800 space-y-4 min-h-[420px]"
            >
              <div className={`p-3 rounded-xl border flex flex-col gap-1 ${stage.color}`}>
                <span className="text-[10.5px] font-black uppercase tracking-wider block">{stage.label}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] font-semibold text-slate-400">{stageLeads.length} Lead</span>
                  <span className="text-xs font-black text-slate-200">{formatMoney(calculateStageSum(stage.id))} ฿</span>
                </div>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {stageLeads.map(lead => {
                  const opp = oppByLeadId.get(lead._id);
                  const value = resolveLeadPipelineValue(lead._id, stage.id as any, opportunities, quotes);
                  return (
                  <button
                    key={lead._id}
                    draggable={canManagePipeline}
                    onDragStart={() => canManagePipeline && setDraggingId(lead._id)}
                    onClick={() => setSelectedLead(lead)}
                    className={`w-full p-4 rounded-xl border border-slate-800/80 bg-[#090d16]/30 hover:border-slate-700 transition-all space-y-3 text-left ${canManagePipeline ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                  >
                    <div>
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-500">
                        <Building size={10} /> {lead.zone || 'ไม่ระบุโซน'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">{lead.schoolName}</h4>
                      {opp?.title && opp.title !== `ดีล ${lead.schoolName}` && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{opp.title}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-400">
                      <span className="flex items-center gap-0.5 text-indigo-400 font-bold">
                        <DollarSign size={10} /> {formatMoney(value)} ฿
                      </span>
                      {opp?.closeDate ? (
                        <span className="flex items-center gap-0.5 text-slate-500">
                          <Calendar size={10} /> {new Date(opp.closeDate).toLocaleDateString('th-TH')}
                        </span>
                      ) : (
                        <span className="text-slate-600">{lead.status || 'Lead'}</span>
                      )}
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <TrendingUp size={10} /> {opp?.probability ?? 20}%
                      </span>
                      <span className="text-slate-500">{userName(lead.assignedTo)}</span>
                    </div>

                    {canManagePipeline && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">ย้ายสเตจ</span>
                        <select
                          value={resolveLeadStage(lead)}
                          onClick={e => e.stopPropagation()}
                          onChange={(e) => handleStageChange(lead, e.target.value)}
                          className="px-2 py-1 rounded border border-slate-800 bg-[#090d16] text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                        >
                          {STAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                      </div>
                    )}
                  </button>
                  );
                })}
                {stageLeads.length === 0 && (
                  <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-[10.5px]">
                    {canManagePipeline ? 'ลาก Lead มาวางในระยะนี้ได้' : 'ยังไม่มี Lead ในสถานะนี้'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && canManagePipeline && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateOpp} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">เพิ่มดีลโอกาสการขายใหม่</h3>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="ชื่อโครงการ" required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={newLeadSearch}
                onChange={e => {
                  setNewLeadSearch(e.target.value);
                  setNewLeadId('');
                  setShowLeadDropdown(true);
                }}
                onFocus={() => setShowLeadDropdown(true)}
                onBlur={() => setTimeout(() => setShowLeadDropdown(false), 150)}
                placeholder="พิมพ์ชื่อโรงเรียนเพื่อค้นหา..."
                autoComplete="off"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              {showLeadDropdown && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-[#090d16] shadow-xl">
                  {filteredLeads.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      {newLeadSearch.trim() ? `ไม่พบโรงเรียนที่ตรงกับ "${newLeadSearch.trim()}"` : 'ไม่มีโรงเรียนในระบบ'}
                    </div>
                  ) : (
                    <>
                      {newLeadSearch.trim() && (
                        <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-800/80">
                          แสดง {filteredLeads.length} รายการที่ใกล้เคียงที่สุด
                        </div>
                      )}
                      {filteredLeads.map(lead => (
                        <button
                          key={lead._id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => selectLead(lead)}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-800 ${newLeadId === lead._id ? 'bg-indigo-500/10 text-indigo-200' : 'text-slate-200'}`}
                        >
                          <span className="font-medium">{lead.schoolName}</span>
                          {lead.zone && <span className="text-slate-500"> · {lead.zone}</span>}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <input type="number" min="0" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="มูลค่าโครงการ" required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <input type="number" min="0" max="100" value={newProbability} onChange={e => setNewProbability(e.target.value)} placeholder="Probability %" className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <input type="date" value={newCloseDate} onChange={e => setNewCloseDate(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={closeAddModal} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่มโครงการ</button>
            </div>
          </form>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedLead.schoolName}</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedLead.zone} · {userName(selectedLead.assignedTo)}</p>
                <p className="text-[10px] text-indigo-300 mt-1">สถานะการขาย: {STAGES.find(item => item.id === resolveLeadStage(selectedLead))?.label || resolveLeadStage(selectedLead)}</p>
                {selectedOpp && <p className="text-[10px] text-slate-500 mt-1">ดีล: {selectedOpp.title}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>

            {selectedOpp && canManagePipeline ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input defaultValue={selectedOpp.title} onBlur={e => e.target.value !== selectedOpp.title && saveOpportunity({ title: e.target.value })} className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <input type="number" defaultValue={selectedOpp.value} onBlur={e => saveOpportunity({ value: Number(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <input type="number" min="0" max="100" defaultValue={selectedOpp.probability ?? 20} onBlur={e => saveOpportunity({ probability: Number(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <input type="date" defaultValue={new Date(selectedOpp.closeDate).toISOString().split('T')[0]} onBlur={e => saveOpportunity({ closeDate: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <select defaultValue={selectedOpp.assignedTo} onChange={e => saveOpportunity({ assignedTo: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                  {users.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                </select>
              </div>
            ) : selectedOpp ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-300">
                <div className="p-3 rounded-lg border border-slate-800 bg-[#121826]/40">มูลค่า {formatMoney(selectedOpp.value)} ฿</div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#121826]/40">Probability {selectedOpp.probability ?? 20}%</div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#121826]/40">ปิด {new Date(selectedOpp.closeDate).toLocaleDateString('th-TH')}</div>
                <div className="p-3 rounded-lg border border-slate-800 bg-[#121826]/40">{userName(selectedOpp.assignedTo)}</div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 text-xs text-slate-400">
                ยังไม่มี Opportunity สำหรับ Lead นี้ — มูลค่าจะแสดงเมื่อสร้างดีลหรือใบเสนอราคา
              </div>
            )}

            {selectedOpp && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><History size={13} /> Stage History</h4>
                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                  {(selectedOpp.stageHistory || []).slice().reverse().map((item: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40">
                      <div className="text-xs text-slate-200">{item.fromStage || 'Start'} <ArrowRight size={11} className="inline mx-1" /> {item.toStage}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{userName(item.changedBy)} · {new Date(item.changedAt).toLocaleString('th-TH')}</div>
                      {item.reason && <div className="mt-1 text-[10px] text-slate-400">{item.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><LinkIcon size={13} /> Linked Quotes</h4>
                <div className="mt-3 space-y-2">
                  {selectedLeadQuotes.map(quote => {
                    const checked = (selectedOpp.quoteIds || []).includes(quote._id);
                    return (
                      <label key={quote._id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-800 text-xs text-slate-300">
                        <span>{quote.quoteNumber} · {quote.status}</span>
                        {canManagePipeline ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const current = selectedOpp.quoteIds || [];
                              const quoteIds = e.target.checked ? [...current, quote._id] : current.filter((id: string) => id !== quote._id);
                              saveOpportunity({ quoteIds });
                            }}
                          />
                        ) : (
                          <span className="text-slate-500">{checked ? 'Linked' : '-'}</span>
                        )}
                      </label>
                    );
                  })}
                  {selectedLeadQuotes.length === 0 && <div className="text-xs text-slate-500">ยังไม่มี quote ของ lead นี้</div>}
                </div>
              </div>
            </div>
            )}

            {selectedOpp?.lostReason && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                Lost reason: {selectedOpp.lostReason}
              </div>
            )}
          </div>
        </div>
      )}

      {pendingStage && canManagePipeline && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              updateLeadStage(pendingStage.lead, pendingStage.stage, lostReason);
            }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-100">ระบุเหตุผลที่ Lost</h3>
            <textarea value={lostReason} onChange={e => setLostReason(e.target.value)} rows={4} required className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingStage(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white">บันทึก Lost</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
