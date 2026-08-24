import { createRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Plus, 
  Sparkles, 
  ChevronRight, 
  FileText,
  User,
  Activity,
  Repeat2,
  Paperclip,
  Save,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useActivityTypes } from '../hooks/useActivityTypes';
import { formatTaskType } from '../lib/task-types';
import { apiFetch, apiJson } from '../lib/api';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';
import { ModalShell } from '../components/ui';
import { FuzzySearchSelect } from '../components/fuzzy-search-select';
import { provinceToZone } from '../lib/province-zone';
import {
  APPOINTMENT_KIND_OPTIONS,
  DOCUMENT_CHANNEL_OPTIONS,
  SALES_FUNNEL_STAGE_OPTIONS,
  stageRequiresEventAt,
  temperatureFromStage,
} from '../lib/sales-funnel-stages';

const LEAD_STATUS_OPTIONS = ['Cold', 'Warm', 'Hot', 'Customer'];

function toDatetimeLocalValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function noteKey(note: { createdAt: string | Date; author: string }) {
  return `${new Date(note.createdAt).toISOString()}|${note.author}`;
}

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/leads/$leadId',
  component: LeadDetailComponent,
});

function LeadDetailComponent() {
  const { leadId } = useParams({ from: '/leads/$leadId' });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { types: noteTypes, selectOptions: noteTypeOptions } = useActivityTypes('note');
  const [lead, setLead] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'ai-coach'>('details');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState('General');
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [editContactForm, setEditContactForm] = useState({ name: '', position: '', phone: '', email: '' });
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteType, setEditNoteType] = useState('General');
  const [coachNote, setCoachNote] = useState('');
  const [newRemarkContent, setNewRemarkContent] = useState('');
  const [editProfile, setEditProfile] = useState({
    schoolName: '',
    address: '',
    zone: '',
    gradeLevels: '',
    educationAuthority: '',
    district: '',
    province: '',
    studentCount: '',
    upperElementaryStudentCount: '',
    lastContactedAt: '',
    nextCallAt: '',
    documentChannel: '',
    appointmentKind: '',
    stageEventAt: '',
    schoolSize: '',
    originalStep: '',
    remarks: '',
    legacySaleName: '',
    status: 'Cold',
    stage: 'TargetSchool',
    score: '',
    source: '',
    campaign: ''
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [showSaveOk, setShowSaveOk] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [locationOptions, setLocationOptions] = useState<{ districts: string[]; provinces: string[] }>({ districts: [], provinces: [] });

  const fetchLeadDetail = () => {
    apiFetch(`/api/leads/${leadId}`)
      .then(data => {
        setLead(data);
        setTransferTo(data.assignedTo || '');
        setEditProfile({
          schoolName: data.schoolName || '',
          address: data.address || '',
          zone: data.zone || '',
          gradeLevels: data.gradeLevels || '',
          educationAuthority: data.educationAuthority || '',
          district: data.district || '',
          province: data.province || '',
          studentCount: data.studentCount !== undefined && data.studentCount !== null ? String(data.studentCount) : '',
          upperElementaryStudentCount: data.upperElementaryStudentCount !== undefined && data.upperElementaryStudentCount !== null ? String(data.upperElementaryStudentCount) : '',
          lastContactedAt: data.lastContactedAt || '',
          nextCallAt: data.nextCallAt || '',
          documentChannel: data.documentChannel || '',
          appointmentKind: data.appointmentKind || '',
          stageEventAt: toDatetimeLocalValue(data.stageEventAt),
          schoolSize: data.schoolSize || '',
          originalStep: data.originalStep || '',
          remarks: data.remarks || '',
          legacySaleName: data.legacySaleName || '',
          status: data.status || 'Cold',
          stage: data.stage || 'TargetSchool',
          score: data.score !== undefined && data.score !== null ? String(data.score) : '',
          source: data.source || '',
          campaign: data.campaign || ''
        });
      })
      .catch(err => console.error('Failed to load lead details:', err));
  };

  const fetchActivity = () => {
    apiFetch(`/api/leads/${leadId}/activity`)
      .then(data => setActivities(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load lead activity:', err));
  };

  useEffect(() => {
    fetchLeadDetail();
    fetchActivity();
    apiFetch('/api/users').then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => setUsers([]));
    apiFetch('/api/leads/locations')
      .then(data => setLocationOptions({
        districts: Array.isArray(data?.districts) ? data.districts : [],
        provinces: Array.isArray(data?.provinces) ? data.provinces : []
      }))
      .catch(() => setLocationOptions({ districts: [], provinces: [] }));
  }, [leadId]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    const newContact = {
      name: newContactName,
      position: newContactPosition,
      phone: newContactPhone,
      email: newContactEmail.trim() || undefined
    };
    const updatedContacts = [...(lead.contacts || []), newContact];

    apiJson(`/api/leads/${leadId}`, { contacts: updatedContacts }, { method: 'PUT' })
      .then(() => {
        setShowAddContact(false);
        setNewContactName('');
        setNewContactPosition('');
        setNewContactPhone('');
        setNewContactEmail('');
        fetchLeadDetail();
      })
      .catch(err => console.error('Failed to add contact:', err));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !lead) return;

    const newNote = { author: user?.name || 'ผู้ใช้งานระบบ', content: newNoteContent, type: newNoteType, createdAt: new Date() };

    apiJson(`/api/leads/${leadId}`, { notes: [newNote] }, { method: 'PUT' })
      .then(() => {
        setNewNoteContent('');
        setNewNoteType('General');
        fetchLeadDetail();
        fetchActivity();
      })
      .catch(err => console.error('Failed to add note:', err));
  };

  const handleEditProfileChange = (field: keyof typeof editProfile, value: string) => {
    setEditProfile(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'stage' ? { status: temperatureFromStage(value) } : {}),
      ...(field === 'province' && value.trim() ? { zone: provinceToZone(value) } : {}),
    }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...editProfile,
      status: temperatureFromStage(editProfile.stage),
      documentChannel: editProfile.documentChannel || undefined,
      appointmentKind: editProfile.appointmentKind || undefined,
      stageEventAt: editProfile.stageEventAt ? new Date(editProfile.stageEventAt).toISOString() : '',
      studentCount: editProfile.studentCount ? Number(editProfile.studentCount) : undefined,
      upperElementaryStudentCount: editProfile.upperElementaryStudentCount ? Number(editProfile.upperElementaryStudentCount) : undefined,
      score: editProfile.score ? Number(editProfile.score) : undefined
    };
    apiJson(`/api/leads/${leadId}`, payload, { method: 'PUT' })
      .then(data => {
        setLead(data);
        fetchActivity();
        setSaveMessage('บันทึกเรียบร้อย');
        setShowSaveOk(true);
      })
      .catch(err => {
        console.error('Failed to save lead profile:', err);
        setSaveMessage(err?.message || 'บันทึกไม่สำเร็จ');
        setShowSaveOk(true);
      });
  };

  const handleAddRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemarkContent.trim() || !lead) return;
    apiJson(`/api/leads/${leadId}`, {
      remarkLogs: [{ content: newRemarkContent.trim(), author: user?.name || 'ผู้ใช้งานระบบ', createdAt: new Date() }]
    }, { method: 'PUT' })
      .then(() => {
        setNewRemarkContent('');
        fetchLeadDetail();
      })
      .catch(err => console.error('Failed to add remark:', err));
  };

  const generateAICoach = () => {
    setLoadingAI(true);
    apiJson(`/api/leads/${leadId}/ai-coach`, {})
      .then(data => {
        setAiSuggestions(data.suggestions);
        setLoadingAI(false);
      })
      .catch(err => {
        console.error('Failed to load AI Suggestions:', err);
        setLoadingAI(false);
      });
  };

  const handleCoachNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachNote.trim()) return;
    const newNote = {
      author: user?.name || 'ผู้ใช้งานระบบ',
      content: `[Coaching] ${coachNote.trim()}`,
      type: 'Coaching',
      createdAt: new Date()
    };
    apiJson(`/api/leads/${leadId}`, { notes: [newNote] }, { method: 'PUT' })
      .then(() => {
        setCoachNote('');
        fetchLeadDetail();
        fetchActivity();
      })
      .catch(err => console.error('Failed to save coaching note:', err));
  };

  if (!lead) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-xs text-slate-500">
        กำลังดึงข้อมูลโรงเรียน...
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'Hot') return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
    if (status === 'Warm') return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    if (status === 'Cold') return 'text-blue-400 bg-blue-500/10 border-blue-500/25';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  };
  const saveContacts = (contacts: any[]) => {
    return apiJson(`/api/leads/${leadId}`, { contacts }, { method: 'PUT' })
      .then(data => {
        setLead(data);
        fetchActivity();
      });
  };

  const startEditContact = (index: number) => {
    const contact = lead.contacts[index];
    setEditingContactIndex(index);
    setEditContactForm({
      name: contact.name || '',
      position: contact.position || '',
      phone: contact.phone || '',
      email: contact.email || ''
    });
  };

  const handleSaveContactEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContactIndex === null) return;
    const contacts = [...(lead.contacts || [])];
    contacts[editingContactIndex] = {
      ...contacts[editingContactIndex],
      name: editContactForm.name,
      position: editContactForm.position,
      phone: editContactForm.phone,
      email: editContactForm.email.trim() || undefined
    };
    saveContacts(contacts)
      .then(() => setEditingContactIndex(null))
      .catch(err => console.error('Failed to update contact:', err));
  };

  const handleDeleteContact = (index: number) => {
    if (!window.confirm('ลบผู้ติดต่อนี้?')) return;
    const contacts = (lead.contacts || []).filter((_: any, i: number) => i !== index);
    saveContacts(contacts).catch(err => console.error('Failed to delete contact:', err));
  };

  const handleDeleteAttachment = (index: number) => {
    if (!window.confirm('ลบไฟล์แนบนี้?')) return;
    const attachments = (lead.attachments || []).filter((_: any, i: number) => i !== index);
    apiJson(`/api/leads/${leadId}`, { attachments }, { method: 'PUT' })
      .then(data => {
        setLead(data);
        fetchActivity();
      })
      .catch(err => console.error('Failed to delete attachment:', err));
  };

  const startEditNote = (note: any) => {
    setEditingNoteKey(noteKey(note));
    setEditNoteContent(note.content);
    setEditNoteType(note.type || 'General');
  };

  const handleSaveNoteEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteKey) return;
    apiJson(`/api/leads/${leadId}/notes/${encodeURIComponent(editingNoteKey)}`, {
      content: editNoteContent,
      type: editNoteType
    }, { method: 'PATCH' })
      .then(data => {
        setLead(data);
        setEditingNoteKey(null);
        fetchActivity();
      })
      .catch(err => console.error('Failed to update note:', err));
  };

  const handleDeleteNote = (note: any) => {
    if (!window.confirm('ลบบันทึกนี้?')) return;
    apiJson(`/api/leads/${leadId}/notes/${encodeURIComponent(noteKey(note))}`, {}, { method: 'DELETE' })
      .then(data => {
        setLead(data);
        fetchActivity();
      })
      .catch(err => console.error('Failed to delete note:', err));
  };

  const userName = (userId?: string) => users.find(item => item._id === userId)?.name || 'ไม่ระบุ';
  const handleTransferOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTo || transferTo === lead.assignedTo) return;
    apiJson(`/api/leads/${leadId}`, { assignedTo: transferTo, transferReason }, { method: 'PUT' })
      .then(data => {
        setLead(data);
        setTransferReason('');
        fetchActivity();
      })
      .catch(err => console.error('Failed to transfer lead owner:', err));
  };
  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachmentName.trim() || !attachmentUrl.trim()) return;
    const attachments = [
      ...(lead.attachments || []),
      {
        name: attachmentName.trim(),
        url: attachmentUrl.trim(),
        uploadedAt: new Date(),
        uploadedBy: user?._id
      }
    ];
    apiJson(`/api/leads/${leadId}`, { attachments }, { method: 'PUT' })
      .then(data => {
        setLead(data);
        setAttachmentName('');
        setAttachmentUrl('');
        fetchActivity();
      })
      .catch(err => console.error('Failed to add attachment:', err));
  };
  const handleArchiveLead = () => {
    if (!window.confirm('ยืนยัน archive lead นี้?')) return;
    apiFetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      .then(() => navigate({ to: '/leads' }))
      .catch(err => console.error('Failed to archive lead:', err));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <Link to="/leads" className="hover:text-indigo-400">Leads & โรงเรียน</Link>
        <ChevronRight size={12} />
        <span className="text-slate-300 truncate max-w-[200px]">{lead.schoolName}</span>
      </div>

      {/* HEADER SECTION */}
      <div className="p-6 rounded-2xl glass-card flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-md">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold font-display text-slate-100">{lead.schoolName}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <MapPin size={10} /> {lead.address} ({lead.zone})
              </span>
              <span className="text-slate-700 text-xs">•</span>
              <span className={`px-2 py-0.5 rounded text-[8.5px] border font-bold ${getStatusColor(lead.status)}`}>
                {lead.status}
              </span>
              <span className="text-slate-700 text-xs">•</span>
              <span className="text-[10px] text-slate-400">Score: {lead.score}%</span>
              <span className="text-slate-700 text-xs">•</span>
              <span className="text-[10px] text-slate-400">Owner: {userName(lead.assignedTo)}</span>
            </div>
            {(lead.source || lead.campaign) && (
              <div className="text-[10px] text-slate-500 mt-1">
                Source: {lead.source || '-'} {lead.campaign ? `· Campaign: ${lead.campaign}` : ''}
              </div>
            )}
            {(lead.gradeLevels || lead.studentCount || lead.upperElementaryStudentCount || lead.lastContactedAt || lead.nextCallAt || lead.schoolSize || lead.educationAuthority || lead.district || lead.province) && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px] text-slate-500">
                {lead.educationAuthority && <span className="px-2 py-0.5 rounded border border-slate-800">สังกัด: {lead.educationAuthority}</span>}
                {lead.district && <span className="px-2 py-0.5 rounded border border-slate-800">เขต: {lead.district}</span>}
                {lead.province && <span className="px-2 py-0.5 rounded border border-slate-800">จ.{lead.province}</span>}
                {lead.gradeLevels && <span className="px-2 py-0.5 rounded border border-slate-800">ระดับชั้น: {lead.gradeLevels}</span>}
                {lead.schoolSize && <span className="px-2 py-0.5 rounded border border-slate-800">{lead.schoolSize}</span>}
                {lead.studentCount !== undefined && <span className="px-2 py-0.5 rounded border border-slate-800">นร.: {Number(lead.studentCount).toLocaleString('th-TH')}</span>}
                {lead.upperElementaryStudentCount !== undefined && <span className="px-2 py-0.5 rounded border border-slate-800">ป.4-6: {Number(lead.upperElementaryStudentCount).toLocaleString('th-TH')}</span>}
                {lead.lastContactedAt && <span className="px-2 py-0.5 rounded border border-slate-800">ติดต่อล่าสุด: {lead.lastContactedAt}</span>}
                {lead.nextCallAt && <span className="px-2 py-0.5 rounded border border-slate-800">นัดโทร: {lead.nextCallAt}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleArchiveLead}
            className="flex items-center gap-1.5 px-4 py-2 border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15 rounded-lg text-xs font-semibold text-rose-300 cursor-pointer transition-all"
          >
            Archive Lead
          </button>
          <button 
            onClick={() => navigate({ to: '/quotes/build' })}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
          >
            สร้างใบเสนอราคา <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* TABS SELECT */}
      <div className="border-b border-slate-800 flex gap-4">
        {[
          { id: 'details', label: 'ผู้ติดต่อและข้อมูลบันทึก', icon: User },
          { id: 'activity', label: 'Activity Timeline', icon: Activity },
          { id: 'ai-coach', label: 'คำแนะนำการขาย AI Coach', icon: Sparkles }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contacts list */}
          <div className="lg:col-span-1 p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">รายชื่อผู้ติดต่อ</h3>
              <button 
                onClick={() => setShowAddContact(!showAddContact)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={10} /> เพิ่มผู้ติดต่อ
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Repeat2 size={13} /> Transfer Owner
              </h3>
              <form onSubmit={wrapFormSubmit(handleTransferOwner)} className="space-y-2">
                <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                  {users.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                </select>
                <input value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="เหตุผลการโอนงาน" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <button disabled={!transferTo || transferTo === lead.assignedTo} type="submit" className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white disabled:opacity-40">โอนผู้ดูแล</button>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Paperclip size={13} /> Attachments
              </h3>
              {(lead.attachments || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <a href={item.url} target="_blank" rel="noreferrer" className="flex-1 p-2 rounded-lg border border-slate-800 text-[10px] text-indigo-300 hover:bg-slate-800/50">
                    {item.name}
                  </a>
                  <button type="button" onClick={() => handleDeleteAttachment(idx)} className="px-2 py-1 rounded border border-rose-500/25 text-[9px] text-rose-300">ลบ</button>
                </div>
              ))}
              {!(lead.attachments || []).length && <div className="text-[10px] text-slate-500">ยังไม่มีไฟล์แนบ</div>}
              <form onSubmit={wrapFormSubmit(handleAddAttachment)} className="pt-2 space-y-2">
                <input value={attachmentName} onChange={e => setAttachmentName(e.target.value)} placeholder="ชื่อไฟล์/เอกสาร" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" />
                <input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="URL เอกสารหรือ proposal" className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" />
                <button type="submit" className="w-full px-3 py-2 rounded-lg bg-slate-800 text-[10px] font-semibold text-slate-200">เพิ่มไฟล์แนบ</button>
              </form>
            </div>

            {showAddContact && (
              <form onSubmit={wrapFormSubmit(handleAddContact)} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/50 space-y-2">
                <input 
                  type="text"
                  placeholder="ชื่อ-นามสกุล"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200 focus:outline-none"
                  required
                />
                <input 
                  type="text"
                  placeholder="ตำแหน่ง (เช่น ผู้อำนวยการ)"
                  value={newContactPosition}
                  onChange={(e) => setNewContactPosition(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200 focus:outline-none"
                  required
                />
                <input 
                  type="text"
                  placeholder="เบอร์โทรศัพท์"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200 focus:outline-none"
                  required
                />
                <input 
                  type="email"
                  placeholder="อีเมล (ถ้ามี)"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200 focus:outline-none"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowAddContact(false)}
                    className="px-2.5 py-1 rounded border border-slate-800 text-[10px] text-slate-400"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="px-2.5 py-1 bg-indigo-600 rounded text-[10px] text-white"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {lead.contacts && lead.contacts.map((contact: any, index: number) => (
                <div key={index} className="p-3.5 rounded-xl border border-slate-800 bg-[#090d16]/30 space-y-1.5">
                  {editingContactIndex === index ? (
                    <form onSubmit={wrapFormSubmit(handleSaveContactEdit)} className="space-y-2">
                      <input value={editContactForm.name} onChange={e => setEditContactForm({ ...editContactForm, name: e.target.value })} className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" required />
                      <input value={editContactForm.position} onChange={e => setEditContactForm({ ...editContactForm, position: e.target.value })} className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" />
                      <input value={editContactForm.phone} onChange={e => setEditContactForm({ ...editContactForm, phone: e.target.value })} className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" required />
                      <input type="email" value={editContactForm.email} onChange={e => setEditContactForm({ ...editContactForm, email: e.target.value })} className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[11px] text-slate-200" />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setEditingContactIndex(null)} className="px-2 py-1 text-[10px] text-slate-400">ยกเลิก</button>
                        <button type="submit" className="px-2 py-1 bg-indigo-600 rounded text-[10px] text-white">บันทึก</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-2">
                        <span className="block font-semibold text-xs text-slate-200">{contact.name}</span>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => startEditContact(index)} className="px-2 py-0.5 rounded border border-slate-700 text-[9px] text-slate-400">แก้ไข</button>
                          <button type="button" onClick={() => handleDeleteContact(index)} className="px-2 py-0.5 rounded border border-rose-500/25 text-[9px] text-rose-300">ลบ</button>
                        </div>
                      </div>
                      <span className="block text-[10px] text-slate-400">{contact.position}</span>
                      <div className="flex items-center gap-4 text-[10.5px] text-slate-500 pt-1">
                        <span className="flex items-center gap-0.5"><Phone size={10} /> {contact.phone}</span>
                        {contact.email && <span className="flex items-center gap-0.5"><Mail size={10} /> {contact.email}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {(!lead.contacts || lead.contacts.length === 0) && (
                <div className="text-center py-6 text-[10.5px] text-slate-500">ยังไม่มีรายชื่อผู้ติดต่อ</div>
              )}
            </div>
          </div>

          {/* Notes and History */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl glass-panel">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ข้อมูลโรงเรียนและข้อมูลนำเข้า</h3>
                <span className="text-[10px] text-slate-500">แก้ไขข้อมูลจากไฟล์ Excel หรือจากหน้าเว็บได้</span>
              </div>
              <form onSubmit={wrapFormSubmit(handleSaveProfile)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    อุณหภูมิ (อัตโนมัติ)
                    <select value={editProfile.status} disabled className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-400">
                      {LEAD_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    สถานะการขาย
                    <select value={editProfile.stage} onChange={e => handleEditProfileChange('stage', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                      {SALES_FUNNEL_STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Score (0-100)
                    <input type="number" min="0" max="100" value={editProfile.score} onChange={e => handleEditProfileChange('score', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Source
                    <input value={editProfile.source} onChange={e => handleEditProfileChange('source', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block md:col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Campaign
                    <input value={editProfile.campaign} onChange={e => handleEditProfileChange('campaign', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ชื่อโรงเรียน
                    <input value={editProfile.schoolName} onChange={e => handleEditProfileChange('schoolName', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" required />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    เขตพื้นที่ (ภาค)
                    <input value={editProfile.zone} onChange={e => handleEditProfileChange('zone', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    เขต/อำเภอ
                    <div className="mt-1.5">
                      <FuzzySearchSelect
                        value={editProfile.district}
                        onChange={value => handleEditProfileChange('district', value)}
                        options={locationOptions.districts}
                        placeholder="เช่น อำเภอคลองหลวง"
                        inputClassName="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    จังหวัด
                    <div className="mt-1.5">
                      <FuzzySearchSelect
                        value={editProfile.province}
                        onChange={value => handleEditProfileChange('province', value)}
                        options={locationOptions.provinces}
                        placeholder="เช่น ปทุมธานี"
                        inputClassName="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </label>
                  <label className="block md:col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ที่อยู่รวม
                    <input value={editProfile.address} onChange={e => handleEditProfileChange('address', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ระดับชั้น
                    <input value={editProfile.gradeLevels} onChange={e => handleEditProfileChange('gradeLevels', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    จำนวน นร.
                    <input type="number" min="0" value={editProfile.studentCount} onChange={e => handleEditProfileChange('studentCount', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    จำนวน นร. ป.4-6
                    <input type="number" min="0" value={editProfile.upperElementaryStudentCount} onChange={e => handleEditProfileChange('upperElementaryStudentCount', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    สังกัด/ประเภท
                    <input value={editProfile.educationAuthority} onChange={e => handleEditProfileChange('educationAuthority', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ขนาดโรงเรียน
                    <input value={editProfile.schoolSize} onChange={e => handleEditProfileChange('schoolSize', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ติดต่อลูกค้าล่าสุด
                    <input type="date" value={editProfile.lastContactedAt} onChange={e => handleEditProfileChange('lastContactedAt', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    นัดโทรครั้งถัดไป
                    <input type="date" value={editProfile.nextCallAt} onChange={e => handleEditProfileChange('nextCallAt', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                    <p className="mt-1 text-[10px] text-slate-500">บันทึกแล้วจะสร้างนัดในปฏิทินกลางอัตโนมัติ (09:00–10:00)</p>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editProfile.stage === 'DocumentSent' && (
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      ช่องทางเอกสาร
                      <select value={editProfile.documentChannel} onChange={e => handleEditProfileChange('documentChannel', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                        <option value="">เลือกช่องทาง</option>
                        {DOCUMENT_CHANNEL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                  )}
                  {editProfile.stage === 'Appointed' && (
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      ประเภทนัด
                      <select value={editProfile.appointmentKind} onChange={e => handleEditProfileChange('appointmentKind', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                        <option value="">เลือกประเภท</option>
                        {APPOINTMENT_KIND_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                  )}
                  {stageRequiresEventAt(editProfile.stage) && (
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      วันเวลานัด (สร้างในปฏิทิน)
                      <input type="datetime-local" value={editProfile.stageEventAt} onChange={e => handleEditProfileChange('stageEventAt', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                    </label>
                  )}
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ขั้นตอนเดิม
                    <input value={editProfile.originalStep} onChange={e => handleEditProfileChange('originalStep', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    ผู้ขายที่ผูกในระบบ
                    <input value={editProfile.legacySaleName} onChange={e => handleEditProfileChange('legacySaleName', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer">
                    <Save size={14} /> บันทึกข้อมูลโรงเรียน
                  </button>
                </div>
              </form>
            </div>

            <div className="p-6 rounded-2xl glass-panel space-y-4">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={13} className="text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Remarks</h3>
              </div>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {(lead.remarkLogs || []).length ? (lead.remarkLogs as any[]).map((item, idx) => (
                  <div key={`${item.createdAt}-${idx}`} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/40">
                    <div className="flex justify-between gap-2 text-[10px] text-slate-500">
                      <span>{item.author || 'Excel Import'}</span>
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : ''}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  </div>
                )) : (
                  <div className="text-[10.5px] text-slate-500">ยังไม่มี Remarks</div>
                )}
              </div>
              <form onSubmit={wrapFormSubmit(handleAddRemark)} className="space-y-2 pt-2 border-t border-slate-800">
                <textarea
                  value={newRemarkContent}
                  onChange={e => setNewRemarkContent(e.target.value)}
                  rows={3}
                  placeholder="เพิ่ม Remarks ใหม่ของโรงเรียนนี้"
                  className="w-full p-3 rounded-xl border border-slate-800 bg-[#090d16] text-xs text-slate-200"
                  required
                />
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white">เพิ่ม Remarks</button>
                </div>
              </form>
            </div>

            {/* Note form */}
            <div className="p-6 rounded-2xl glass-panel">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">เพิ่มบันทึกการประชุม/ความคืบหน้า (Notes)</h3>
              <form onSubmit={wrapFormSubmit(handleAddNote)} className="space-y-3">
                <select value={newNoteType} onChange={e => setNewNoteType(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                  {noteTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="ป้อนรายละเอียดการพูดคุย เช่น ผอ. ขอนัดสาธิตการใช้หุ่นยนต์ Coding ในวันศุกร์บ่ายสอง..."
                  rows={3}
                  className="w-full p-4 rounded-xl border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                ></textarea>
                <div className="flex justify-end">
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
                  >
                    บันทึกโน้ต
                  </button>
                </div>
              </form>
            </div>

            {/* Note history list */}
            <div className="p-6 rounded-2xl glass-panel space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ประวัติบันทึก</h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {lead.notes && lead.notes.slice().reverse().map((note: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-800/80 bg-[#121826]/10 space-y-2">
                    {editingNoteKey === noteKey(note) ? (
                      <form onSubmit={wrapFormSubmit(handleSaveNoteEdit)} className="space-y-2">
                        <select value={editNoteType} onChange={e => setEditNoteType(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                          {noteTypeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <textarea value={editNoteContent} onChange={e => setEditNoteContent(e.target.value)} rows={3} className="w-full p-3 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" required />
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={() => setEditingNoteKey(null)} className="px-2 py-1 text-[10px] text-slate-400">ยกเลิก</button>
                          <button type="submit" className="px-3 py-1 bg-indigo-600 rounded text-[10px] text-white">บันทึก</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10.5px] font-semibold text-indigo-400 flex items-center gap-1">
                            <User size={10} /> {note.author} · {formatTaskType(note.type || 'General', undefined, noteTypes)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500">{new Date(note.createdAt).toLocaleString('th-TH')}</span>
                            <button type="button" onClick={() => startEditNote(note)} className="px-2 py-0.5 rounded border border-slate-700 text-[9px] text-slate-400">แก้ไข</button>
                            <button type="button" onClick={() => handleDeleteNote(note)} className="px-2 py-0.5 rounded border border-rose-500/25 text-[9px] text-rose-300">ลบ</button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{note.content}</p>
                      </>
                    )}
                  </div>
                ))}
                {(!lead.notes || lead.notes.length === 0) && (
                  <div className="text-center py-8 text-xs text-slate-500">ยังไม่มีประวัติการบันทึกข้อมูล</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Timeline</h3>
          <div className="space-y-3">
            {activities.map(item => (
              <div key={item._id} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/35">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex px-2 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-[9px] font-bold text-indigo-300">{item.type}</span>
                    <h4 className="mt-2 text-sm font-semibold text-slate-200">{item.title}</h4>
                    <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                    <p className="mt-2 text-[10px] text-slate-500">โดย {item.actorName}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">{new Date(item.createdAt).toLocaleString('th-TH')}</span>
                </div>
              </div>
            ))}
            {activities.length === 0 && <div className="py-10 text-center text-xs text-slate-500">ยังไม่มี activity timeline</div>}
          </div>
        </div>
      )}

      {/* AI COACH TABS */}
      {activeTab === 'ai-coach' && (
        <div className="p-6 rounded-2xl glass-panel space-y-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <Sparkles size={16} className="text-indigo-400" />
                บทวิเคราะห์และคำแนะนำการเสนอขายด้วย AI (Sales AI Coach)
              </h3>
              <p className="text-xs text-slate-400 mt-1">ประมวลผลข้อมูลจากบันทึกและประวัติโรงเรียนผ่าน Gemini AI เพื่อเจาะลึกกลยุทธ์ปิดดีล</p>
            </div>
            <button 
              onClick={generateAICoach}
              disabled={loadingAI}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer disabled:opacity-50 transition-all"
            >
              {loadingAI ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังวิเคราะห์...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>วิเคราะห์ด้วย AI Coach</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {aiSuggestions.length > 0 ? (
              aiSuggestions.map((sug, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-left flex gap-3 animate-fade-in">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{sug}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                ยังไม่มีข้อมูลคำแนะนำ กดปุ่ม "วิเคราะห์ด้วย AI Coach" ด้านบนเพื่อเริ่มประมวลผลร่วมกับ Gemini AI
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-5 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-400" />
              Coaching Thread / Action Items
            </h4>
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {(lead.notes || []).filter((note: any) => String(note.content || '').startsWith('[Coaching]')).slice().reverse().map((note: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5">
                  <div className="flex justify-between gap-3">
                    <span className="text-[10px] font-semibold text-indigo-300">{note.author}</span>
                    <span className="text-[9px] text-slate-500">{new Date(note.createdAt).toLocaleString('th-TH')}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{String(note.content).replace('[Coaching] ', '')}</p>
                </div>
              ))}
              {!(lead.notes || []).some((note: any) => String(note.content || '').startsWith('[Coaching]')) && (
                <div className="py-6 text-center text-xs text-slate-500">ยังไม่มี action item จาก coaching</div>
              )}
            </div>
            <form onSubmit={wrapFormSubmit(handleCoachNote)} className="flex gap-2">
              <input value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="บันทึก action item จาก AI Coach..." className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">บันทึก</button>
            </form>
          </div>
        </div>
      )}

      {showSaveOk && (
        <ModalShell>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${saveMessage === 'บันทึกเรียบร้อย' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-100">{saveMessage}</h3>
            <button
              type="button"
              onClick={() => setShowSaveOk(false)}
              className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white"
            >
              OK
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
