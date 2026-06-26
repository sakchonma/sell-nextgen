import { createRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Forward,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/requests',
  component: RequestsIndexComponent,
});

const DEPARTMENTS = [
  { id: 'AdminSupport', label: 'Admin Support' },
  { id: 'Finance', label: 'Finance' },
  { id: 'Academic', label: 'วิชาการ' },
  { id: 'Production', label: 'Production' },
];

function statusStyle(status: string) {
  if (status === 'Approved') return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
  if (status === 'Claimed') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (status === 'Acknowledged') return 'bg-sky-500/10 text-sky-300 border-sky-500/25';
  if (status === 'Rejected') return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
  if (status === 'Completed') return 'bg-slate-800 text-slate-300 border-slate-700';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
}

function RequestsIndexComponent() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'approval' | 'claim' | 'mine' | 'ack'>('all');
  const [forwardRequest, setForwardRequest] = useState<any | null>(null);
  const [forwardDepartment, setForwardDepartment] = useState('Academic');
  const [forwardReason, setForwardReason] = useState('');
  const [declineRequest, setDeclineRequest] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState('');

  const fetchData = () => {
    Promise.all([
      apiFetch('/api/requests'),
      apiFetch('/api/users'),
      apiFetch('/api/leads').catch(() => []),
    ])
      .then(([requestData, userData, leadData]) => {
        setRequests(Array.isArray(requestData) ? requestData : []);
        setUsers(Array.isArray(userData) ? userData : []);
        setLeads(Array.isArray(leadData) ? leadData : []);
      })
      .catch(err => {
        console.error('Failed to load requests:', err);
        setError('โหลดข้อมูลคำขอไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getUserName = (id?: string) => users.find(item => item._id === id)?.name || id || '-';
  const getLeadName = (id?: string) => leads.find(item => item._id === id)?.schoolName || '-';
  const getDeptLabel = (id: string) => DEPARTMENTS.find(item => item.id === id)?.label || id;

  const pendingApprovals = requests.filter(item => item.approvalFlow?.status === 'Pending');
  const claimQueue = requests.filter(item =>
    item.approvalFlow?.status !== 'Pending' &&
    ['Approved', 'Acknowledged', 'Submitted'].includes(item.status)
  );
  const ackQueue = requests.filter(item =>
    (item.acknowledgements || []).some((ack: any) => ack.userId === user?._id && !ack.acknowledged)
  );
  const mine = requests.filter(item => item.creatorId === user?._id || item.assignment?.assignedToId === user?._id);

  const visibleRequests = useMemo(() => {
    if (activeTab === 'approval') return pendingApprovals;
    if (activeTab === 'claim') return claimQueue;
    if (activeTab === 'mine') return mine;
    if (activeTab === 'ack') return ackQueue;
    return requests;
  }, [activeTab, requests, pendingApprovals, claimQueue, mine, ackQueue]);

  const runAction = (url: string, body: any = {}, method = 'PUT') => {
    setError('');
    return apiJson(url, body, { method })
      .then(() => fetchData())
      .catch(err => setError(err.message));
  };

  const approveRequest = (id: string) => runAction(`/api/requests/${id}/approve`, { status: 'Approved' });
  const rejectRequest = (id: string) => runAction(`/api/requests/${id}/approve`, { status: 'Rejected', reason: 'Rejected from approval dashboard' });
  const claimRequest = (id: string) => runAction(`/api/requests/${id}/claim`);
  const ackRequest = (id: string) => runAction(`/api/requests/${id}/ack`);

  const submitDecline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineRequest) return;
    runAction(`/api/requests/${declineRequest._id}/decline`, { reason: declineReason }).then(() => {
      setDeclineRequest(null);
      setDeclineReason('');
    });
  };

  const submitForward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forwardRequest) return;
    runAction(`/api/requests/${forwardRequest._id}/forward`, {
      targetDepartment: forwardDepartment,
      reason: forwardReason,
    }).then(() => {
      setForwardRequest(null);
      setForwardReason('');
      setForwardDepartment('Academic');
    });
  };

  const tabs = [
    { id: 'all', label: 'ทั้งหมด', count: requests.length },
    { id: 'approval', label: 'รออนุมัติ', count: pendingApprovals.length },
    { id: 'claim', label: 'รอรับงาน', count: claimQueue.length },
    { id: 'ack', label: 'รอรับทราบ', count: ackQueue.length },
    { id: 'mine', label: 'ของฉัน', count: mine.length },
  ];

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-indigo-400" /> ระบบคำขอ
          </h2>
          <p className="text-xs text-slate-400 mt-1">อนุมัติคำขอ รับงานสนับสนุน ส่งต่อแผนก และติดตามสถานะงานประสานงาน</p>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 rounded-lg border border-slate-800 bg-[#121826]/60 text-slate-400 hover:text-slate-200" title="รีเฟรชข้อมูล">
            <RefreshCw size={16} />
          </button>
          <Link to="/requests/create" className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all">
            <Plus size={14} /> สร้างคำขอ
          </Link>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="border-b border-slate-800 flex gap-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {tab.label} <span className="text-[10px] text-slate-500">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {visibleRequests.map(request => {
          const canApprove = user && user.rank >= 4 && request.approvalFlow?.status === 'Pending';
          const canAck = (request.acknowledgements || []).some((ack: any) => ack.userId === user?._id && !ack.acknowledged);
          const canClaim = request.approvalFlow?.status !== 'Pending' && ['Approved', 'Acknowledged', 'Submitted'].includes(request.status);
          const canOperate = user && (user.rank === 2 || user.rank >= 4);

          return (
            <div key={request._id} className="p-5 rounded-xl border border-slate-800 bg-[#121826]/40 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black tracking-widest text-slate-500">{request.requestNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] border font-bold ${statusStyle(request.status)}`}>{request.status}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 mt-2">{request.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{request.reason || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                </div>
                {request.status === 'Submitted' && request.approvalFlow?.status === 'Approved' && (
                  <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 text-[9px] font-black border border-indigo-500/20 animate-pulse">รอรับงาน</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10.5px] text-slate-400">
                <div className="p-2 rounded bg-[#090d16]/40 border border-slate-800/70">
                  <span className="block text-slate-500 mb-0.5">ผู้สร้าง</span>
                  <span className="text-slate-200">{getUserName(request.creatorId)}</span>
                </div>
                <div className="p-2 rounded bg-[#090d16]/40 border border-slate-800/70">
                  <span className="block text-slate-500 mb-0.5">แผนกปลายทาง</span>
                  <span className="text-slate-200">{getDeptLabel(request.targetDepartment)}</span>
                </div>
                <div className="p-2 rounded bg-[#090d16]/40 border border-slate-800/70">
                  <span className="block text-slate-500 mb-0.5">โรงเรียน</span>
                  <span className="text-slate-200">{getLeadName(request.leadId)}</span>
                </div>
                <div className="p-2 rounded bg-[#090d16]/40 border border-slate-800/70">
                  <span className="block text-slate-500 mb-0.5">เวลา</span>
                  <span className="text-slate-200 flex items-center gap-1"><Clock size={10} /> {new Date(request.startAt).toLocaleString('th-TH')}</span>
                </div>
              </div>

              {request.assignment?.forwardHistory?.length > 0 && (
                <div className="text-[10.5px] text-slate-400 border-t border-slate-800 pt-3">
                  <span className="inline-flex items-center gap-1 text-slate-500 font-bold mb-1"><ArrowRightLeft size={11} /> ประวัติส่งต่อ</span>
                  {request.assignment.forwardHistory.slice(-2).map((item: any, idx: number) => (
                    <div key={idx}>{getDeptLabel(item.fromDepartment)} → {getDeptLabel(item.toDepartment)} · {item.reason}</div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                {canApprove && (
                  <>
                    <button onClick={() => approveRequest(request._id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold hover:bg-emerald-500/20">
                      <Check size={12} /> อนุมัติ
                    </button>
                    <button onClick={() => rejectRequest(request._id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-semibold hover:bg-rose-500/20">
                      <X size={12} /> ปฏิเสธ
                    </button>
                  </>
                )}
                {canAck && (
                  <button onClick={() => ackRequest(request._id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-semibold hover:bg-sky-500/20">
                    <CheckCircle2 size={12} /> รับทราบ
                  </button>
                )}
                {canOperate && canClaim && (
                  <button onClick={() => claimRequest(request._id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-semibold hover:bg-indigo-500">
                    <Check size={12} /> รับงาน + ลงปฏิทิน
                  </button>
                )}
                {canOperate && request.status !== 'Rejected' && request.status !== 'Completed' && (
                  <>
                    <button onClick={() => { setForwardRequest(request); setForwardDepartment(request.targetDepartment === 'Academic' ? 'AdminSupport' : 'Academic'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-semibold hover:bg-slate-700">
                      <Forward size={12} /> ส่งต่อ
                    </button>
                    <button onClick={() => setDeclineRequest(request)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-semibold hover:bg-rose-500/20">
                      <X size={12} /> ปฏิเสธงาน
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visibleRequests.length === 0 && (
        <div className="py-16 rounded-xl border border-slate-800 bg-[#121826]/30 text-center text-slate-500 text-xs">
          ไม่มีคำขอในกลุ่มนี้
        </div>
      )}

      {forwardRequest && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitForward} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">ส่งต่องานไปแผนกอื่น</h3>
            <select value={forwardDepartment} onChange={e => setForwardDepartment(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none">
              {DEPARTMENTS.map(dept => <option key={dept.id} value={dept.id}>{dept.label}</option>)}
            </select>
            <textarea value={forwardReason} onChange={e => setForwardReason(e.target.value)} rows={3} placeholder="เหตุผลในการส่งต่อ..." className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" required />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setForwardRequest(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">ส่งต่อ</button>
            </div>
          </form>
        </div>
      )}

      {declineRequest && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitDecline} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">ปฏิเสธงาน</h3>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="ระบุเหตุผลที่ไม่สามารถปฏิบัติงานได้..." className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" required />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeclineRequest(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-semibold text-white">ยืนยันปฏิเสธ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
