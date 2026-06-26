import { createRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { 
  FolderKanban, 
  Plus, 
  DollarSign, 
  Calendar,
  Building,
  ArrowRight
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/pipeline',
  component: PipelineComponent,
});

const STAGES = [
  { id: 'Qualified', label: 'ผู้สนใจผ่านเกณฑ์ (Qualified)', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5' },
  { id: 'Proposal', label: 'ยื่นข้อเสนอ/ใบเสนอราคา (Proposal)', color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5' },
  { id: 'Demo', label: 'นำเสนอ/สาธิตการใช้สื่อ (Demo)', color: 'border-purple-500/20 text-purple-400 bg-purple-500/5' },
  { id: 'Negotiation', label: 'เจรจาต่อรอง (Negotiation)', color: 'border-amber-500/20 text-amber-400 bg-amber-500/5' },
  { id: 'Won', label: 'ปิดการขายได้ (Won)', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' },
  { id: 'Lost', label: 'สูญเสียโอกาส (Lost)', color: 'border-rose-500/20 text-rose-400 bg-rose-500/5' }
];

function PipelineComponent() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLeadId, setNewLeadId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCloseDate, setNewCloseDate] = useState('');

  const fetchOppsAndLeads = () => {
    apiFetch('/api/opportunities')
      .then(data => setOpportunities(data))
      .catch(err => console.error('Failed to load opportunities:', err));

    apiFetch('/api/leads')
      .then(data => {
        setLeads(data);
        if (data.length > 0) setNewLeadId(data[0]._id);
      })
      .catch(err => console.error('Failed to load leads:', err));
  };

  useEffect(() => {
    fetchOppsAndLeads();
  }, []);

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    apiJson('/api/opportunities', {
      leadId: newLeadId,
      title: newTitle,
      value: Number(newValue) || 0,
      closeDate: newCloseDate || new Date().toISOString().split('T')[0]
    })
      .then(() => {
        setShowAddModal(false);
        setNewTitle('');
        setNewValue('');
        setNewCloseDate('');
        fetchOppsAndLeads();
      })
      .catch(err => console.error('Failed to create opportunity:', err));
  };

  const handleStageChange = (oppId: string, newStage: string) => {
    apiJson(`/api/opportunities/${oppId}/stage`, { stage: newStage }, { method: 'PUT' })
      .then(() => fetchOppsAndLeads())
      .catch(err => console.error('Failed to update stage:', err));
  };

  const getSchoolName = (leadId: string) => {
    const lead = leads.find(l => l._id === leadId);
    return lead ? lead.schoolName : 'ไม่ระบุโรงเรียน';
  };

  const calculateStageSum = (stageId: string) => {
    const sum = opportunities
      .filter(o => o.stage === stageId)
      .reduce((acc, curr) => acc + (curr.value || 0), 0);
    return sum.toLocaleString('th-TH');
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <FolderKanban className="text-indigo-400" /> Opportunity Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">ติดตามเป้าหมายการขายและประเมินมูลค่าโครงการในท่อเสนอขาย</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
        >
          <Plus size={14} /> เพิ่มดีลเสนอขาย
        </button>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start select-none">
        {STAGES.map(stage => {
          const stageOpps = opportunities.filter(o => o.stage === stage.id);
          return (
            <div key={stage.id} className="w-80 shrink-0 p-4 rounded-2xl bg-[#121826]/40 border border-slate-800 space-y-4">
              {/* Stage Header */}
              <div className={`p-3 rounded-xl border flex flex-col gap-1 ${stage.color}`}>
                <span className="text-[10.5px] font-black uppercase tracking-wider block">{stage.label}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] font-semibold text-slate-400">{stageOpps.length} ดีล</span>
                  <span className="text-xs font-black text-slate-200">{calculateStageSum(stage.id)} ฿</span>
                </div>
              </div>

              {/* Cards Wrapper */}
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {stageOpps.map(opp => (
                  <div key={opp._id} className="p-4 rounded-xl border border-slate-800/80 bg-[#090d16]/30 hover:border-slate-700 transition-all space-y-3 text-left">
                    <div>
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-500">
                        <Building size={10} /> {getSchoolName(opp.leadId)}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 mt-1.5 line-clamp-2 leading-relaxed">{opp.title}</h4>
                    </div>

                    <div className="flex justify-between items-center text-[10.5px] text-slate-400">
                      <span className="flex items-center gap-0.5 text-indigo-400 font-bold">
                        <DollarSign size={10} /> {opp.value.toLocaleString()} ฿
                      </span>
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Calendar size={10} /> {new Date(opp.closeDate).toLocaleDateString('th-TH')}
                      </span>
                    </div>

                    {/* Quick stage selector instead of drag and drop */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest">ย้ายสเตจ:</span>
                      <select 
                        value={opp.stage}
                        onChange={(e) => handleStageChange(opp._id, e.target.value)}
                        className="px-2 py-1 rounded border border-slate-800 bg-[#090d16] text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                      >
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>{s.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {stageOpps.length === 0 && (
                  <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-[10.5px]">
                    ไม่มีดีลในระยะนี้
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE OPPORTUNITY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateOpp} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">เพิ่มดีลโอกาสการขายใหม่</h3>
            
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">ชื่อโครงการ</label>
              <input 
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="โครงการจัดซื้อบอร์ด Coding"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">เลือกโรงเรียน (Lead)</label>
              <select 
                value={newLeadId}
                onChange={(e) => setNewLeadId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {leads.map(l => (
                  <option key={l._id} value={l._id}>{l.schoolName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">มูลค่าโครงการ (บาท)</label>
              <input 
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="150000"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">วันที่คาดว่าจะปิดการขาย</label>
              <input 
                type="date"
                value={newCloseDate}
                onChange={(e) => setNewCloseDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                เพิ่มโครงการ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
