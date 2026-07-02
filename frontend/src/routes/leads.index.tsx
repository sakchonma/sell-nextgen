import { createRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { 
  Search, 
  MapPin, 
  Filter, 
  Plus, 
  GraduationCap, 
  TrendingUp,
  UserCheck,
  Loader2
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

const ZONE_OPTIONS = ['ภาคเหนือ', 'ภาคกลาง', 'ภาคตะวันออก', 'ภาคใต้', 'ภาคตะวันตก', 'ภาคอีสาน'];
const LEAD_STAGE_OPTIONS = ['New Lead', 'Contacted', 'Interested', 'Demo Scheduled', 'Proposal Sent', 'Pilot/Trial', 'Closed Won', 'Closed Lost'];

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/leads/',
  component: LeadsIndexComponent,
});

function LeadsIndexComponent() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedOwner, setSelectedOwner] = useState('All');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadAddress, setNewLeadAddress] = useState('');
  const [newLeadZone, setNewLeadZone] = useState('ภาคเหนือ');
  const [newLeadStage, setNewLeadStage] = useState('New Lead');
  const [newLeadSource, setNewLeadSource] = useState('Outbound');
  const [newLeadCampaign, setNewLeadCampaign] = useState('');
  const [leadError, setLeadError] = useState('');
  const [leadMessage, setLeadMessage] = useState('');
  const [updatingLeadId, setUpdatingLeadId] = useState('');

  const fetchLeads = () => {
    apiFetch('/api/leads')
      .then(data => setLeads(data))
      .catch(err => console.error('Failed to load leads:', err));
  };

  useEffect(() => {
    fetchLeads();
    apiFetch('/api/users').then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => setUsers([]));
  }, [user]);

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');
    setLeadMessage('');
    apiJson('/api/leads', {
      schoolName: newLeadName,
      address: newLeadAddress,
      zone: newLeadZone,
      status: 'Cold',
      stage: newLeadStage,
      score: 10,
      source: newLeadSource,
      campaign: newLeadCampaign || undefined
    })
      .then(() => {
        setShowAddModal(false);
        setNewLeadName('');
        setNewLeadAddress('');
        setNewLeadStage('New Lead');
        setNewLeadCampaign('');
        fetchLeads();
      })
      .catch(err => setLeadError(err.message || 'เพิ่มลีดไม่สำเร็จ'));
  };

  const handleImportCsv = async (file?: File) => {
    if (!file) return;
    setLeadError('');
    setLeadMessage('');
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx');
      const body = isExcel ? await file.arrayBuffer() : await file.text();
      const res = await fetch('/api/leads/import.csv', {
        method: 'POST',
        headers: {
          'Content-Type': isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import CSV ไม่สำเร็จ');
      setLeadMessage(`Import สำเร็จ ${data.imported} รายการ${data.skipped?.length ? `, ข้าม ${data.skipped.length} รายการ` : ''}`);
      fetchLeads();
    } catch (err: any) {
      setLeadError(err.message || 'Import CSV ไม่สำเร็จ');
    }
  };

  const handleStatusChange = (lead: any, status: string) => {
    if (lead.status === status) return;
    const previousStatus = lead.status;
    setUpdatingLeadId(lead._id);
    setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, status } : item));

    apiJson(`/api/leads/${lead._id}`, { status }, { method: 'PUT' })
      .then(updatedLead => {
        setLeads(prev => prev.map(item => item._id === lead._id ? updatedLead : item));
      })
      .catch(err => {
        console.error('Failed to update lead status:', err);
        setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, status: previousStatus } : item));
      })
      .finally(() => setUpdatingLeadId(''));
  };

  const handleStageChange = (lead: any, stage: string) => {
    if ((lead.stage || 'New Lead') === stage) return;
    const previousStage = lead.stage || 'New Lead';
    setUpdatingLeadId(lead._id);
    setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, stage } : item));

    apiJson(`/api/leads/${lead._id}`, { stage }, { method: 'PUT' })
      .then(updatedLead => {
        setLeads(prev => prev.map(item => item._id === lead._id ? updatedLead : item));
      })
      .catch(err => {
        console.error('Failed to update lead stage:', err);
        setLeads(prev => prev.map(item => item._id === lead._id ? { ...item, stage: previousStage } : item));
      })
      .finally(() => setUpdatingLeadId(''));
  };

  const getStatusStyle = (status: string) => {
    if (status === 'Hot') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
    if (status === 'Warm') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    if (status === 'Cold') return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  };

  const getStageStyle = (stage: string) => {
    if (stage === 'Closed Won') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    if (stage === 'Closed Lost') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
    if (stage === 'Proposal Sent' || stage === 'Pilot/Trial') return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
    if (stage === 'Demo Scheduled') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    if (stage === 'Interested') return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
    if (stage === 'Contacted') return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  const filteredLeads = Array.isArray(leads)
    ? leads.filter(l => {
        const matchesSearch = l.schoolName.toLowerCase().includes(search.toLowerCase()) ||
                              l.address.toLowerCase().includes(search.toLowerCase());
        const matchesZone = selectedZone === 'All' || l.zone === selectedZone;
        const matchesStatus = selectedStatus === 'All' || l.status === selectedStatus;
        const matchesOwner = selectedOwner === 'All' || l.assignedTo === selectedOwner;
        const matchesMinScore = !minScore || Number(l.score || 0) >= Number(minScore);
        const matchesMaxScore = !maxScore || Number(l.score || 0) <= Number(maxScore);
        return matchesSearch && matchesZone && matchesStatus && matchesOwner && matchesMinScore && matchesMaxScore;
      })
    : [];

  const ownerName = (ownerId?: string) => users.find(item => item._id === ownerId)?.name || 'ไม่ระบุผู้ดูแล';

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <GraduationCap className="text-indigo-400" /> Leads & โรงเรียน
          </h2>
          <p className="text-xs text-slate-400 mt-1">บริหารจัดการข้อมูลโรงเรียนและรายชื่อผู้ติดต่อที่กำลังดูแลเสนอขาย</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <label className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer">
            Import CSV/XLSX
            <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => handleImportCsv(e.target.files?.[0])} />
          </label>
          <a
            href="/api/leads/export.csv"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700"
          >
            Export CSV
          </a>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus size={14} /> เพิ่มข้อมูลโรงเรียน
          </button>
        </div>
      </div>

      {leadMessage && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{leadMessage}</div>}
      {leadError && !showAddModal && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{leadError}</div>}

      {/* SEARCH AND FILTERS */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อโรงเรียน หรือที่อยู่..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Zone Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1"><Filter size={12} /> เขตพื้นที่:</span>
          <select 
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none"
          >
            <option value="All">ทุกภาค</option>
            {ZONE_OPTIONS.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1"><Filter size={12} /> สถานะ:</span>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none"
          >
            <option value="All">ทุกสถานะ</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
            <option value="Hot">Hot</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1"><UserCheck size={12} /> ผู้ดูแล:</span>
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none"
          >
            <option value="All">ทุกคน</option>
            {users.map(item => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Score:</span>
          <input value={minScore} onChange={e => setMinScore(e.target.value)} type="number" min="0" max="100" placeholder="min" className="w-20 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300" />
          <input value={maxScore} onChange={e => setMaxScore(e.target.value)} type="number" min="0" max="100" placeholder="max" className="w-20 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300" />
        </div>
      </div>

      {/* LEADS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLeads.map(lead => (
          <div key={lead._id} className="p-5 rounded-2xl glass-card text-left flex flex-col justify-between h-48 border border-slate-800 bg-[#121826]/30">
            <div>
              <div className="flex justify-between items-start gap-3">
                <Link 
                  to="/leads/$leadId"
                  params={{ leadId: lead._id }}
                  className="font-bold text-slate-200 hover:text-indigo-400 font-display text-sm tracking-wide line-clamp-1 hover:underline transition-all"
                >
                  {lead.schoolName}
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <div className="relative">
                    <select
                      value={['Cold', 'Warm', 'Hot'].includes(lead.status) ? lead.status : 'Cold'}
                      onChange={(e) => handleStatusChange(lead, e.target.value)}
                      disabled={updatingLeadId === lead._id}
                      className={`appearance-none pr-6 pl-2 py-1 rounded text-[8.5px] border font-bold outline-none cursor-pointer disabled:cursor-wait ${getStatusStyle(lead.status)}`}
                      title="เปลี่ยนสถานะลีด"
                    >
                      <option value="Cold">Cold</option>
                      <option value="Warm">Warm</option>
                      <option value="Hot">Hot</option>
                    </select>
                    {updatingLeadId === lead._id ? (
                      <Loader2 size={10} className="absolute right-1.5 top-1.5 animate-spin text-slate-400" />
                    ) : (
                      <span className="pointer-events-none absolute right-1.5 top-1 text-[9px] text-current">▾</span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={LEAD_STAGE_OPTIONS.includes(lead.stage) ? lead.stage : 'New Lead'}
                      onChange={(e) => handleStageChange(lead, e.target.value)}
                      disabled={updatingLeadId === lead._id}
                      className={`appearance-none max-w-32 pr-6 pl-2 py-1 rounded text-[8.5px] border font-bold outline-none cursor-pointer disabled:cursor-wait ${getStageStyle(lead.stage || 'New Lead')}`}
                      title="เปลี่ยน Stage"
                    >
                      {LEAD_STAGE_OPTIONS.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-1.5 top-1 text-[9px] text-current">▾</span>
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                <MapPin size={10} /> {lead.address} ({lead.zone})
              </span>

              {/* Contacts count */}
              <div className="text-[11px] text-slate-400 mt-4 flex items-center gap-1">
                <UserCheck size={12} className="text-slate-500" />
                <span>{ownerName(lead.assignedTo)} · ผู้ติดต่อ {lead.contacts?.length || 0} คน</span>
              </div>
              {(lead.source || lead.campaign) && (
                <div className="text-[10px] text-slate-500 mt-2">
                  Source: {lead.source || '-'} {lead.campaign ? `· ${lead.campaign}` : ''}
                </div>
              )}
            </div>

            {/* Score slide / representative */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest">Score:</span>
                <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${lead.score}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-semibold text-slate-300">{lead.score}</span>
              </div>

              <span className="text-[10.5px] text-indigo-400 font-semibold hover:underline">
                <Link to="/leads/$leadId" params={{ leadId: lead._id }} className="flex items-center gap-0.5">
                  จัดการลีด <TrendingUp size={10} />
                </Link>
              </span>
            </div>
          </div>
        ))}
        {filteredLeads.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">
            ไม่พบข้อมูลโรงเรียนในเงื่อนไขการค้นหา
          </div>
        )}
      </div>

      {/* ADD LEAD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddLead} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">เพิ่มลีดโรงเรียนเป้าหมายใหม่</h3>
            {leadError && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{leadError}</div>}
            
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">ชื่อโรงเรียน</label>
              <input 
                type="text"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                placeholder="โรงเรียนวิทยาศาสตร์อัจฉริยะ"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">ที่ตั้ง/จังหวัด</label>
              <input 
                type="text"
                value={newLeadAddress}
                onChange={(e) => setNewLeadAddress(e.target.value)}
                placeholder="อ.เมือง จ.เชียงใหม่"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">เขตพื้นที่ (ภาค)</label>
              <select 
                value={newLeadZone}
                onChange={(e) => setNewLeadZone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {ZONE_OPTIONS.map(zone => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Stage</label>
              <select
                value={newLeadStage}
                onChange={(e) => setNewLeadStage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {LEAD_STAGE_OPTIONS.map(stage => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Source</label>
                <select value={newLeadSource} onChange={e => setNewLeadSource(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                  <option value="Outbound">Outbound</option>
                  <option value="Referral">Referral</option>
                  <option value="Event">Event</option>
                  <option value="Website">Website</option>
                  <option value="Existing Customer">Existing Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Campaign</label>
                <input value={newLeadCampaign} onChange={e => setNewLeadCampaign(e.target.value)} placeholder="เช่น Coding Roadshow" className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              </div>
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
                บันทึกโรงเรียน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
