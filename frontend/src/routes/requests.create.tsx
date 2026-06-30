import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Send,
} from 'lucide-react';
import { apiFetch, apiJson, authHeaders } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/requests/create',
  component: RequestCreateComponent,
});

const DEPARTMENTS = [
  { id: 'AdminSupport', label: 'Admin Support', hint: 'ประสานงาน เอกสาร นัดหมาย และงานธุรการ' },
  { id: 'Finance', label: 'Finance', hint: 'ค่าใช้จ่าย เบิกจ่าย ใบกำกับ และเอกสารการเงิน' },
  { id: 'Academic', label: 'วิชาการ', hint: 'ผู้เชี่ยวชาญหลักสูตร Demo และเอกสารวิชาการ' },
  { id: 'Production', label: 'Production', hint: 'สื่อการสอน อุปกรณ์ และการจัดเตรียมส่งมอบ' },
];

const REQUEST_TYPES = [
  { id: 'AdminSupport', label: 'ขอประสานงานสนับสนุน' },
  { id: 'Expense', label: 'ขอเบิกค่าใช้จ่าย/เอกสารการเงิน' },
  { id: 'MarketingMaterial', label: 'ขอสื่อ/เอกสารประกอบการขาย' },
];

const SUB_TYPES = [
  'ประสานงานลูกค้า',
  'เข้าร่วม Onsite',
  'เตรียมเอกสาร',
  'Demo/Training',
  'ตรวจสอบค่าใช้จ่าย',
  'จัดส่งสื่อ',
];

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function RequestCreateComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    leadId: '',
    type: 'AdminSupport',
    targetDepartment: 'AdminSupport',
    targetUserId: '',
    reason: '',
    priority: 'Medium',
    attachmentName: '',
    attachmentUrl: '',
    date: todayString(),
    startTime: '10:00',
    endTime: '11:00',
    subTypes: ['ประสานงานลูกค้า'],
  });

  useEffect(() => {
    Promise.all([
      apiFetch('/api/leads').catch(() => []),
      apiFetch('/api/users').catch(() => []),
    ]).then(([leadData, userData]) => {
      const normalizedLeads = Array.isArray(leadData) ? leadData : [];
      setLeads(normalizedLeads);
      setUsers(Array.isArray(userData) ? userData : []);
      if (!form.leadId && normalizedLeads[0]) {
        setForm(prev => ({ ...prev, leadId: normalizedLeads[0]._id }));
      }
    });
  }, []);

  const departmentUsers = useMemo(() => {
    return users.filter(item => {
      const email = item.email || '';
      if (form.targetDepartment === 'AdminSupport') return email.includes('central');
      if (form.targetDepartment === 'Finance') return email.includes('finance');
      if (form.targetDepartment === 'Academic') return email.includes('academic');
      if (form.targetDepartment === 'Production') return email.includes('prod');
      return false;
    });
  }, [users, form.targetDepartment]);

  useEffect(() => {
    setForm(prev => ({ ...prev, targetUserId: '' }));
  }, [form.targetDepartment]);

  const checkAvailability = () => {
    if (!form.date || !form.targetDepartment) return;
    setLoadingAvailability(true);
    setAvailability(null);
    const params = new URLSearchParams({ date: form.date, department: form.targetDepartment });
    if (form.targetUserId) params.set('targetUserId', form.targetUserId);
    fetch(`/api/requests/availability?${params.toString()}`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setAvailability(data))
      .catch(err => {
        console.error('Failed to check availability:', err);
        setError('ตรวจสอบคิวงานไม่สำเร็จ');
      })
      .finally(() => setLoadingAvailability(false));
  };

  useEffect(() => {
    if (step === 2) checkAvailability();
  }, [step, form.date, form.targetDepartment]);

  const toggleSubType = (value: string) => {
    setForm(prev => ({
      ...prev,
      subTypes: prev.subTypes.includes(value)
        ? prev.subTypes.filter(item => item !== value)
        : [...prev.subTypes, value],
    }));
  };

  const startAt = new Date(`${form.date}T${form.startTime}`);
  const endAt = new Date(`${form.date}T${form.endTime}`);
  const isAutoApproved = (user?.rank || 0) >= 4;
  const selectedLead = leads.find(lead => lead._id === form.leadId);
  const selectedUser = users.find(item => item._id === form.targetUserId);
  const selectedDepartment = DEPARTMENTS.find(item => item.id === form.targetDepartment);

  const canGoStep2 = form.title.trim() && form.reason.trim() && form.leadId;
  const canGoStep3 = form.date && form.startTime && form.endTime && endAt > startAt;

  const submitRequest = (isDraft = false) => {
    setError('');
    if (!canGoStep3) {
      setError('กรุณาระบุวันเวลาให้ถูกต้อง');
      return;
    }
    setSubmitting(true);
    apiJson('/api/requests', {
        title: form.title,
        leadId: form.leadId,
        type: form.type,
        subTypes: form.subTypes,
        targetDepartment: form.targetDepartment,
        targetUserId: form.targetUserId || undefined,
        reason: form.reason,
        priority: form.priority,
        isDraft,
        attachments: form.attachmentName ? [{ name: form.attachmentName, url: form.attachmentUrl || undefined }] : [],
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      })
      .then(() => navigate({ to: '/requests' }))
      .catch(err => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in max-w-6xl mx-auto">
      <div>
        <Link to="/requests" className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-400 mb-2">
          <ArrowLeft size={12} /> กลับไปหน้าระบบคำขอ
        </Link>
        <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
          <ClipboardList className="text-indigo-400" /> สร้างคำขอสนับสนุน
        </h2>
        <p className="text-xs text-slate-400 mt-1">กรอกข้อมูล ตรวจคิวแผนกปลายทาง และยืนยันก่อนส่งเข้าสู่ approval flow</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 1, label: 'รายละเอียดคำขอ' },
          { id: 2, label: 'ตรวจคิวงาน' },
          { id: 3, label: 'ยืนยันส่งคำขอ' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setStep(item.id)}
            className={`p-3 rounded-lg border text-left transition-all ${step === item.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-[#121826]/40 text-slate-500'}`}
          >
            <span className="block text-[9px] font-black uppercase tracking-widest">Step {item.id}</span>
            <span className="block text-xs font-semibold mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">หัวข้อคำขอ</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ขอทีมวิชาการร่วม Demo ให้โรงเรียน..." className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">โรงเรียน/Lead ที่เกี่ยวข้อง</label>
                <select value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none">
                  {leads.map(lead => <option key={lead._id} value={lead._id}>{lead.schoolName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ประเภทคำขอ</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none">
                  {REQUEST_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-2">แผนกปลายทาง</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEPARTMENTS.map(dept => (
                  <button
                    type="button"
                    key={dept.id}
                    onClick={() => setForm({ ...form, targetDepartment: dept.id })}
                    className={`p-3 rounded-lg border text-left transition-all ${form.targetDepartment === dept.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-[#090d16]/40 hover:border-slate-700'}`}
                  >
                    <span className="block text-xs font-semibold text-slate-200">{dept.label}</span>
                    <span className="block text-[10px] text-slate-500 mt-1">{dept.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">ระบุบุคคลปลายทาง (ไม่บังคับ)</label>
              <select value={form.targetUserId} onChange={e => setForm({ ...form, targetUserId: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none">
                <option value="">ให้แผนกรับงานเอง</option>
                {departmentUsers.map(item => <option key={item._id} value={item._id}>{item.name} · {item.email}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Priority / SLA</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none">
                  <option value="Low">Low · 72h</option>
                  <option value="Medium">Medium · 48h</option>
                  <option value="High">High · 24h</option>
                  <option value="Urgent">Urgent · 8h</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ชื่อไฟล์แนบ</label>
                <input value={form.attachmentName} onChange={e => setForm({ ...form, attachmentName: e.target.value })} placeholder="proposal.pdf" className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ลิงก์ไฟล์แนบ</label>
                <input value={form.attachmentUrl} onChange={e => setForm({ ...form, attachmentUrl: e.target.value })} placeholder="https://..." className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-2">ประเภทย่อย</label>
              <div className="flex flex-wrap gap-2">
                {SUB_TYPES.map(item => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => toggleSubType(item)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${form.subTypes.includes(item) ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-[#090d16]/40 text-slate-500 hover:text-slate-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">เหตุผล/รายละเอียดคำขอ</label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={4} placeholder="ระบุบริบทลูกค้า สิ่งที่ต้องการให้ช่วย และผลลัพธ์ที่คาดหวัง..." className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500" required />
            </div>
          </div>

          <aside className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Approval Flow</h3>
            <div className={`p-3 rounded-lg border text-[11px] ${isAutoApproved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
              {isAutoApproved ? 'บัญชีนี้เป็น Manager/Exec: คำขอจะ auto-approve และส่งให้ผู้บริหารคนอื่นรับทราบ' : 'บัญชีนี้เป็น Sales: คำขอจะรอ Manager/Exec อนุมัติก่อนเข้าคิวแผนกสนับสนุน'}
            </div>
            <button disabled={!canGoStep2} onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white disabled:opacity-40">
              ถัดไป <ChevronRight size={14} />
            </button>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">วันที่ต้องการ</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">เริ่มเวลา</label>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">สิ้นสุด</label>
                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none" />
              </div>
            </div>

            <button onClick={checkAvailability} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200">
              <CalendarCheck size={14} /> ตรวจสอบคิวอีกครั้ง
            </button>

            <div className="rounded-xl border border-slate-800 bg-[#090d16]/40 p-5 min-h-[260px]">
              {loadingAvailability ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">กำลังตรวจสอบคิวงาน...</div>
              ) : availability ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border ${availability.status === 'Free' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : availability.status === 'SemiBusy' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                    สถานะแผนก {selectedDepartment?.label}: {availability.status}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">คิวที่ชนในวันเดียวกัน</h3>
                    <div className="space-y-2">
                      {availability.busySlots?.map((slot: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-[#121826]/50 text-xs text-slate-300 flex items-center justify-between">
                          <span>{slot.title}</span>
                          <span className="text-slate-500">{slot.time}</span>
                        </div>
                      ))}
                      {availability.busySlots?.length === 0 && <div className="py-8 text-center text-slate-500 text-xs">ไม่พบคิวชนในวันดังกล่าว</div>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availability.suggestions?.map((date: string) => (
                      <button key={date} onClick={() => setForm({ ...form, date })} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] hover:bg-slate-700">
                        แนะนำ {new Date(date).toLocaleDateString('th-TH')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-500">เลือกวันเวลาเพื่อเริ่มตรวจสอบคิว</div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-3">
            {!canGoStep3 && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /> เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น
              </div>
            )}
            <div className="text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2"><Clock size={14} className="text-indigo-400" /> {startAt.toLocaleString('th-TH')} - {endAt.toLocaleTimeString('th-TH')}</div>
              <div>แผนก: <span className="text-slate-200">{selectedDepartment?.label}</span></div>
              <div>บุคคล: <span className="text-slate-200">{selectedUser?.name || 'ให้แผนกรับงานเอง'}</span></div>
            </div>
            <button disabled={!canGoStep3} onClick={() => setStep(3)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white disabled:opacity-40">
              ตรวจสรุป <ChevronRight size={14} />
            </button>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">สรุปคำขอก่อนส่ง</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                ['หัวข้อ', form.title],
                ['โรงเรียน', selectedLead?.schoolName || '-'],
                ['ประเภท', REQUEST_TYPES.find(item => item.id === form.type)?.label || form.type],
                ['แผนกปลายทาง', selectedDepartment?.label || form.targetDepartment],
                ['บุคคลปลายทาง', selectedUser?.name || 'ให้แผนกรับงานเอง'],
                ['Priority', form.priority],
                ['ไฟล์แนบ', form.attachmentName || '-'],
                ['วันเวลา', `${startAt.toLocaleString('th-TH')} - ${endAt.toLocaleTimeString('th-TH')}`],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40">
                  <span className="block text-[10px] text-slate-500 mb-1">{label}</span>
                  <span className="text-slate-200">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40">
              <span className="block text-[10px] text-slate-500 mb-1">ประเภทย่อย</span>
              <div className="flex flex-wrap gap-2">
                {form.subTypes.map(item => <span key={item} className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 text-[10px] border border-indigo-500/20">{item}</span>)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-[#090d16]/40">
              <span className="block text-[10px] text-slate-500 mb-1">รายละเอียด</span>
              <p className="text-xs text-slate-300 whitespace-pre-line">{form.reason}</p>
            </div>
          </div>

          <aside className="rounded-xl border border-slate-800 bg-[#121826]/40 p-5 space-y-4">
            <div className={`p-3 rounded-lg border text-[11px] ${isAutoApproved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
              {isAutoApproved ? 'หลังส่ง ระบบจะอนุมัติทันทีและส่งให้ผู้บริหารคนอื่นรับทราบ' : 'หลังส่ง คำขอจะอยู่ในคิวรอ Manager/Exec อนุมัติ'}
            </div>
            <button disabled={submitting} onClick={() => submitRequest(false)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg disabled:opacity-50">
              {submitting ? 'กำลังส่งคำขอ...' : <><Send size={14} /> ส่งคำขอ</>}
            </button>
            <button disabled={submitting} onClick={() => submitRequest(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 hover:text-slate-100 disabled:opacity-50">
              บันทึกแบบร่าง
            </button>
            <button onClick={() => setStep(2)} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200">
              <Check size={14} /> กลับไปแก้เวลา
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
