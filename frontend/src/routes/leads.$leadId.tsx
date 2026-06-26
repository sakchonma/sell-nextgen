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
  Activity
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/leads/$leadId',
  component: LeadDetailComponent,
});

function LeadDetailComponent() {
  const { leadId } = useParams({ from: '/leads/$leadId' });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'ai-coach'>('details');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [coachNote, setCoachNote] = useState('');

  const fetchLeadDetail = () => {
    apiFetch(`/api/leads/${leadId}`)
      .then(data => setLead(data))
      .catch(err => console.error('Failed to load lead details:', err));
  };

  useEffect(() => {
    fetchLeadDetail();
  }, [leadId]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    const newContact = { name: newContactName, position: newContactPosition, phone: newContactPhone };
    const updatedContacts = [...(lead.contacts || []), newContact];

    apiJson(`/api/leads/${leadId}`, { contacts: updatedContacts }, { method: 'PUT' })
      .then(() => {
        setShowAddContact(false);
        setNewContactName('');
        setNewContactPosition('');
        setNewContactPhone('');
        fetchLeadDetail();
      })
      .catch(err => console.error('Failed to add contact:', err));
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !lead) return;

    const newNote = { author: user?.name || 'ผู้ใช้งานระบบ', content: newNoteContent, createdAt: new Date() };

    apiJson(`/api/leads/${leadId}`, { notes: [newNote] }, { method: 'PUT' })
      .then(() => {
        setNewNoteContent('');
        fetchLeadDetail();
      })
      .catch(err => console.error('Failed to add note:', err));
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
      createdAt: new Date()
    };
    apiJson(`/api/leads/${leadId}`, { notes: [newNote] }, { method: 'PUT' })
      .then(() => {
        setCoachNote('');
        fetchLeadDetail();
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

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <Link to="/leads/index" className="hover:text-indigo-400">Leads & โรงเรียน</Link>
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

            {showAddContact && (
              <form onSubmit={handleAddContact} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/50 space-y-2">
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
                  <span className="block font-semibold text-xs text-slate-200">{contact.name}</span>
                  <span className="block text-[10px] text-slate-400">{contact.position}</span>
                  <div className="flex items-center gap-4 text-[10.5px] text-slate-500 pt-1">
                    <span className="flex items-center gap-0.5"><Phone size={10} /> {contact.phone}</span>
                    {contact.email && <span className="flex items-center gap-0.5"><Mail size={10} /> {contact.email}</span>}
                  </div>
                </div>
              ))}
              {(!lead.contacts || lead.contacts.length === 0) && (
                <div className="text-center py-6 text-[10.5px] text-slate-500">ยังไม่มีรายชื่อผู้ติดต่อ</div>
              )}
            </div>
          </div>

          {/* Notes and History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Note form */}
            <div className="p-6 rounded-2xl glass-panel">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">เพิ่มบันทึกการประชุม/ความคืบหน้า (Notes)</h3>
              <form onSubmit={handleAddNote} className="space-y-3">
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
                    <div className="flex justify-between items-center">
                      <span className="text-[10.5px] font-semibold text-indigo-400 flex items-center gap-1">
                        <User size={10} /> {note.author}
                      </span>
                      <span className="text-[9px] text-slate-500">{new Date(note.createdAt).toLocaleString('th-TH')}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{note.content}</p>
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
            <form onSubmit={handleCoachNote} className="flex gap-2">
              <input value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="บันทึก action item จาก AI Coach..." className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">บันทึก</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
