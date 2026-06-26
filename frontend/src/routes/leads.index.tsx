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

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/leads/index',
  component: LeadsIndexComponent,
});

function LeadsIndexComponent() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadAddress, setNewLeadAddress] = useState('');
  const [newLeadZone, setNewLeadZone] = useState('ภาคเหนือ');
  const [updatingLeadId, setUpdatingLeadId] = useState('');

  const fetchLeads = () => {
    apiFetch('/api/leads')
      .then(data => setLeads(data))
      .catch(err => console.error('Failed to load leads:', err));
  };

  useEffect(() => {
    fetchLeads();
  }, [user]);

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    apiJson('/api/leads', {
      schoolName: newLeadName,
      address: newLeadAddress,
      zone: newLeadZone,
      status: 'Cold',
      score: 10
    })
      .then(() => {
        setShowAddModal(false);
        setNewLeadName('');
        setNewLeadAddress('');
        fetchLeads();
      })
      .catch(err => console.error('Failed to add lead: ' + err));
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

  const getStatusStyle = (status: string) => {
    if (status === 'Hot') return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
    if (status === 'Warm') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
    if (status === 'Cold') return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
  };

  const filteredLeads = Array.isArray(leads)
    ? leads.filter(l => {
        const matchesSearch = l.schoolName.toLowerCase().includes(search.toLowerCase()) ||
                              l.address.toLowerCase().includes(search.toLowerCase());
        const matchesZone = selectedZone === 'All' || l.zone === selectedZone;
        const matchesStatus = selectedStatus === 'All' || l.status === selectedStatus;
        return matchesSearch && matchesZone && matchesStatus;
      })
    : [];

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
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus size={14} /> เพิ่มข้อมูลโรงเรียน
        </button>
      </div>

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
            <option value="ภาคเหนือ">ภาคเหนือ</option>
            <option value="ภาคตะวันออก">ภาคตะวันออก</option>
            <option value="ภาคใต้">ภาคใต้</option>
            <option value="ภาคตะวันตก">ภาคตะวันตก</option>
            <option value="ภาคอีสาน">ภาคอีสาน</option>
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
                <div className="relative shrink-0">
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
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                <MapPin size={10} /> {lead.address} ({lead.zone})
              </span>

              {/* Contacts count */}
              <div className="text-[11px] text-slate-400 mt-4 flex items-center gap-1">
                <UserCheck size={12} className="text-slate-500" />
                <span>จำนวนผู้ติดต่อ: {lead.contacts?.length || 0} คน</span>
              </div>
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
                <option value="ภาคเหนือ">ภาคเหนือ</option>
                <option value="ภาคตะวันออก">ภาคตะวันออก</option>
                <option value="ภาคใต้">ภาคใต้</option>
                <option value="ภาคตะวันตก">ภาคตะวันตก</option>
                <option value="ภาคอีสาน">ภาคอีสาน</option>
              </select>
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
