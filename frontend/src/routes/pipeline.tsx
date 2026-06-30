import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import {
  ArrowRight,
  Building,
  Calendar,
  DollarSign,
  FolderKanban,
  History,
  Link as LinkIcon,
  Plus,
  TrendingUp,
  X
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/pipeline',
  component: PipelineComponent,
});

const STAGES = [
  { id: 'Qualified', label: 'ผู้สนใจผ่านเกณฑ์', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5' },
  { id: 'Proposal', label: 'ยื่นข้อเสนอ', color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5' },
  { id: 'Demo', label: 'สาธิตการใช้สื่อ', color: 'border-purple-500/20 text-purple-400 bg-purple-500/5' },
  { id: 'Negotiation', label: 'เจรจาต่อรอง', color: 'border-amber-500/20 text-amber-400 bg-amber-500/5' },
  { id: 'Won', label: 'ปิดการขายได้', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' },
  { id: 'Lost', label: 'สูญเสียโอกาส', color: 'border-rose-500/20 text-rose-400 bg-rose-500/5' }
];

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString('th-TH');
}

function PipelineComponent() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<any>(null);
  const [pendingStage, setPendingStage] = useState<{ opp: any; stage: string } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLeadId, setNewLeadId] = useState('');
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
      if (leadData.length > 0 && !newLeadId) setNewLeadId(leadData[0]._id);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const leadById = (leadId: string) => leads.find(lead => lead._id === leadId);
  const userName = (userId?: string) => users.find(user => user._id === userId)?.name || 'ไม่ระบุ';
  const selectedLeadQuotes = useMemo(() => quotes.filter(quote => quote.leadId === selectedOpp?.leadId), [quotes, selectedOpp?.leadId]);

  const calculateStageSum = (stageId: string) => opportunities
    .filter(opp => opp.stage === stageId)
    .reduce((acc, curr) => acc + (curr.value || 0), 0);

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    apiJson('/api/opportunities', {
      leadId: newLeadId,
      title: newTitle,
      value: Number(newValue) || 0,
      closeDate: newCloseDate,
      probability: Number(newProbability) || 20
    })
      .then(() => {
        setShowAddModal(false);
        setNewTitle('');
        setNewValue('');
        setNewCloseDate('');
        setNewProbability('20');
        fetchData();
      })
      .catch(err => setError(err.message || 'สร้าง opportunity ไม่สำเร็จ'));
  };

  const updateStage = (opp: any, stage: string, reason?: string) => {
    apiJson(`/api/opportunities/${opp._id}/stage`, {
      stage,
      lostReason: stage === 'Lost' ? reason : undefined,
      reason: stage !== 'Lost' ? reason : undefined
    }, { method: 'PUT' })
      .then(updated => {
        setOpportunities(prev => prev.map(item => item._id === opp._id ? updated : item));
        setSelectedOpp((current: any) => current?._id === opp._id ? { ...current, ...updated } : current);
        setPendingStage(null);
        setLostReason('');
        fetchData();
      })
      .catch(err => setError(err.message || 'อัปเดต stage ไม่สำเร็จ'));
  };

  const handleStageChange = (opp: any, stage: string) => {
    if (stage === opp.stage) return;
    if (stage === 'Lost') {
      setPendingStage({ opp, stage });
      setLostReason('');
      return;
    }
    updateStage(opp, stage);
  };

  const handleDrop = (stage: string) => {
    const opp = opportunities.find(item => item._id === draggingId);
    setDraggingId('');
    if (opp) handleStageChange(opp, stage);
  };

  const saveOpportunity = (patch: Record<string, unknown>) => {
    if (!selectedOpp) return;
    apiJson(`/api/opportunities/${selectedOpp._id}`, patch, { method: 'PUT' })
      .then(updated => {
        setSelectedOpp({ ...selectedOpp, ...updated });
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
          <p className="text-xs text-slate-400 mt-1">ติดตามเป้าหมายการขาย มูลค่า forecast และประวัติ stage ของแต่ละดีล</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
        >
          <Plus size={14} /> เพิ่มดีลเสนอขาย
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

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
        {STAGES.map(stage => {
          const stageOpps = opportunities.filter(opp => opp.stage === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
              className="w-80 shrink-0 p-4 rounded-2xl bg-[#121826]/40 border border-slate-800 space-y-4 min-h-[420px]"
            >
              <div className={`p-3 rounded-xl border flex flex-col gap-1 ${stage.color}`}>
                <span className="text-[10.5px] font-black uppercase tracking-wider block">{stage.label}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] font-semibold text-slate-400">{stageOpps.length} ดีล</span>
                  <span className="text-xs font-black text-slate-200">{formatMoney(calculateStageSum(stage.id))} ฿</span>
                </div>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {stageOpps.map(opp => (
                  <button
                    key={opp._id}
                    draggable
                    onDragStart={() => setDraggingId(opp._id)}
                    onClick={() => setSelectedOpp(opp)}
                    className="w-full p-4 rounded-xl border border-slate-800/80 bg-[#090d16]/30 hover:border-slate-700 transition-all space-y-3 text-left cursor-grab active:cursor-grabbing"
                  >
                    <div>
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-500">
                        <Building size={10} /> {leadById(opp.leadId)?.schoolName || 'ไม่ระบุโรงเรียน'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">{opp.title}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-400">
                      <span className="flex items-center gap-0.5 text-indigo-400 font-bold">
                        <DollarSign size={10} /> {formatMoney(opp.value)} ฿
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Calendar size={10} /> {new Date(opp.closeDate).toLocaleDateString('th-TH')}
                      </span>
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <TrendingUp size={10} /> {opp.probability ?? 20}%
                      </span>
                      <span className="text-slate-500">{userName(opp.assignedTo)}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">ย้ายสเตจ</span>
                      <select
                        value={opp.stage}
                        onClick={e => e.stopPropagation()}
                        onChange={(e) => handleStageChange(opp, e.target.value)}
                        className="px-2 py-1 rounded border border-slate-800 bg-[#090d16] text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                      >
                        {STAGES.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
                      </select>
                    </div>
                  </button>
                ))}
                {stageOpps.length === 0 && (
                  <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-[10.5px]">
                    ลากดีลมาวางในระยะนี้ได้
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateOpp} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">เพิ่มดีลโอกาสการขายใหม่</h3>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="ชื่อโครงการ" required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <select value={newLeadId} onChange={e => setNewLeadId(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
              {leads.map(lead => <option key={lead._id} value={lead._id}>{lead.schoolName}</option>)}
            </select>
            <input type="number" min="0" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="มูลค่าโครงการ" required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <input type="number" min="0" max="100" value={newProbability} onChange={e => setNewProbability(e.target.value)} placeholder="Probability %" className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <input type="date" value={newCloseDate} onChange={e => setNewCloseDate(e.target.value)} required className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่มโครงการ</button>
            </div>
          </form>
        </div>
      )}

      {selectedOpp && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedOpp.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{leadById(selectedOpp.leadId)?.schoolName} · {userName(selectedOpp.assignedTo)}</p>
              </div>
              <button onClick={() => setSelectedOpp(null)} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input defaultValue={selectedOpp.title} onBlur={e => e.target.value !== selectedOpp.title && saveOpportunity({ title: e.target.value })} className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <input type="number" defaultValue={selectedOpp.value} onBlur={e => saveOpportunity({ value: Number(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <input type="number" min="0" max="100" defaultValue={selectedOpp.probability ?? 20} onBlur={e => saveOpportunity({ probability: Number(e.target.value) || 0 })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <input type="date" defaultValue={new Date(selectedOpp.closeDate).toISOString().split('T')[0]} onBlur={e => saveOpportunity({ closeDate: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <select defaultValue={selectedOpp.assignedTo} onChange={e => saveOpportunity({ assignedTo: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                {users.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </div>

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
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            const current = selectedOpp.quoteIds || [];
                            const quoteIds = e.target.checked ? [...current, quote._id] : current.filter((id: string) => id !== quote._id);
                            saveOpportunity({ quoteIds });
                          }}
                        />
                      </label>
                    );
                  })}
                  {selectedLeadQuotes.length === 0 && <div className="text-xs text-slate-500">ยังไม่มี quote ของ lead นี้</div>}
                </div>
              </div>
            </div>

            {selectedOpp.lostReason && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                Lost reason: {selectedOpp.lostReason}
              </div>
            )}
          </div>
        </div>
      )}

      {pendingStage && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              updateStage(pendingStage.opp, pendingStage.stage, lostReason);
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
