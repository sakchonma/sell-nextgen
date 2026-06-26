import { createRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  Keyboard,
  Link2,
  ListChecks,
  Loader2,
  Mail,
  MessageSquareCode,
  Mic,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  UserRound
} from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/ai-logger',
  component: AILoggerComponent,
});

type TaskType = 'Call' | 'Meeting' | 'Demo' | 'FollowUp' | 'Other';
type UrgencyLevel = 'Low' | 'Medium' | 'High';

interface MatchedLead {
  _id: string;
  schoolName: string;
  zone?: string;
  status?: string;
  primaryContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

interface ParsedLog {
  title: string;
  type: TaskType;
  dateStr: string;
  timeStr: string;
  schoolMentioned?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  urgency: UrgencyLevel;
  notes: string;
  confidence: number;
  missingFields: string[];
  aiLogId?: string;
  leadId?: string;
  matchedLead?: MatchedLead | null;
}

interface AILogEntry {
  _id: string;
  rawText: string;
  parsed: ParsedLog;
  leadId?: string;
  taskId?: string;
  status: 'Parsed' | 'Confirmed';
  createdAt: string;
  confirmedAt?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
  { value: 'Call', label: 'Call' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Demo', label: 'Demo' },
  { value: 'FollowUp', label: 'FollowUp' },
  { value: 'Other', label: 'Other' }
];

const urgencyOptions: Array<{ value: UrgencyLevel; label: string; className: string }> = [
  { value: 'Low', label: 'Low', className: 'border-slate-700 bg-slate-800/60 text-slate-300' },
  { value: 'Medium', label: 'Medium', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  { value: 'High', label: 'High', className: 'border-rose-500/30 bg-rose-500/10 text-rose-300' }
];

const examples = [
  'โทรหาครูแอน โรงเรียนอนุบาลชลบุรี พรุ่งนี้บ่ายสามโมง เพื่อติดตามใบเสนอราคา Robotics Kit ด่วน',
  'นัดสาธิตระบบให้โรงเรียนเชียงใหม่คริสเตียน วันศุกร์นี้สิบโมงเช้า ติดต่อครูสุเทพ',
  'ประชุมกับผอ. โรงเรียนสุราษฎร์พิทยา 2026-07-02 14:30 เรื่องแผนอบรมครู'
];

function getTodayDateStr() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
}

async function getApiMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

function AILoggerComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [recognitionSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [parseError, setParseError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [parsedData, setParsedData] = useState<ParsedLog | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('Call');
  const [dateStr, setDateStr] = useState(getTodayDateStr());
  const [timeStr, setTimeStr] = useState('13:00');
  const [notes, setNotes] = useState('');
  const [schoolMentioned, setSchoolMentioned] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Medium');
  const [leadId, setLeadId] = useState<string | undefined>();
  const [aiLogId, setAiLogId] = useState<string | undefined>();
  const [matchedLead, setMatchedLead] = useState<MatchedLead | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AILogEntry[]>([]);

  const fetchRecentLogs = async () => {
    try {
      const res = await fetch('/api/ai/logs', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!res.ok) return;
      const data = await res.json() as AILogEntry[];
      setRecentLogs(data);
    } catch (err) {
      console.error('Failed to load AI logs:', err);
    }
  };

  useEffect(() => {
    if (user && user.rank >= 3) {
      fetchRecentLogs();
    }
  }, [user?._id]);

  const applyParsedData = (data: ParsedLog) => {
    setParsedData(data);
    setTitle(data.title || '');
    setType(data.type || 'Call');
    setDateStr(data.dateStr || getTodayDateStr());
    setTimeStr(data.timeStr || '13:00');
    setSchoolMentioned(data.schoolMentioned || '');
    setContactName(data.contactName || '');
    setContactPhone(data.contactPhone || '');
    setContactEmail(data.contactEmail || '');
    setUrgency(data.urgency || 'Medium');
    setNotes(data.notes || '');
    setLeadId(data.leadId);
    setAiLogId(data.aiLogId);
    setMatchedLead(data.matchedLead || null);
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setParsedData(null);
    setSavedSuccess(false);
    setParseError('');
    setSaveError('');

    try {
      const res = await fetch('/api/ai/parse-log', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ text: inputText.trim() })
      });

      if (!res.ok) {
        throw new Error(await getApiMessage(res, 'ไม่สามารถประมวลผลข้อความด้วย AI ได้'));
      }

      const data = await res.json() as ParsedLog;
      applyParsedData(data);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'ไม่สามารถประมวลผลข้อความด้วย AI ได้');
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setParseError('เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียงภาษาไทยโดยตรง');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<any>)
        .map(result => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setInputText(prev => [prev.trim(), transcript].filter(Boolean).join(' '));
      }
    };
    recognition.onerror = (event: any) => {
      setParseError(event?.error === 'not-allowed'
        ? 'ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาตสิทธิ์ไมโครโฟนในเบราว์เซอร์'
        : 'การถอดเสียงไม่สำเร็จ กรุณาลองใหม่หรือพิมพ์ข้อความแทน');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    try {
      setParseError('');
      recognition.start();
      setIsListening(true);
    } catch {
      setParseError('ไม่สามารถเริ่มบันทึกเสียงได้ในตอนนี้');
      setIsListening(false);
    }
  };

  const handleSaveToCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/ai/confirm-log', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          type,
          dateStr,
          timeStr,
          schoolMentioned: schoolMentioned.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          urgency,
          notes: notes.trim(),
          leadId,
          aiLogId,
          confidence: parsedData?.confidence,
          missingFields: parsedData?.missingFields || [],
          rawText: inputText.trim(),
          participantIds: user?._id ? [user._id] : []
        })
      });

      if (!res.ok) {
        throw new Error(await getApiMessage(res, 'ไม่สามารถบันทึกงานจาก AI Logger ได้'));
      }

      setSavedSuccess(true);
      fetchRecentLogs();
      setTimeout(() => {
        navigate({ to: '/tasks' });
      }, 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกงานจาก AI Logger ได้');
    } finally {
      setSaving(false);
    }
  };

  if (user && user.rank < 3) {
    return (
      <div className="max-w-xl mx-auto p-6 rounded-2xl border border-slate-800 bg-[#121826]/60 text-slate-100">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-slate-500" size={22} />
          <div>
            <h2 className="text-sm font-semibold">ไม่มีสิทธิ์ใช้งาน AI Logger</h2>
            <p className="text-xs text-slate-400 mt-1">เมนูนี้เปิดให้ทีมขายและผู้บริหารที่มีสิทธิ์ AI Chat ใช้งาน</p>
          </div>
        </div>
      </div>
    );
  }

  const activeUrgency = urgencyOptions.find(item => item.value === urgency) || urgencyOptions[1];

  return (
    <div className="space-y-6 text-slate-100 text-left max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <MessageSquareCode className="text-indigo-400" /> AI บันทึกกิจกรรมด้วยเสียง/แชต
          </h2>
          <p className="text-xs text-slate-400 mt-1">แปลงข้อความสนทนาเป็นงานนัดหมาย ตรวจสอบ แล้วบันทึกเข้าปฏิทินของฝ่ายขาย</p>
        </div>
        {parsedData && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-[10px] text-indigo-200 font-semibold self-start md:self-auto">
            <Sparkles size={12} />
            Confidence {Math.round((parsedData.confidence || 0) * 100)}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] gap-6 items-start">
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Keyboard size={13} /> ข้อความต้นทาง
            </h3>
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!recognitionSupported || loading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700 bg-[#090d16] text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300'
              }`}
              title={recognitionSupported ? 'บันทึกเสียงภาษาไทย' : 'เบราว์เซอร์นี้ยังไม่รองรับ Speech Recognition'}
            >
              {isListening ? <Square size={12} /> : <Mic size={12} />}
              {isListening ? 'หยุดบันทึก' : 'บันทึกเสียง'}
            </button>
          </div>

          <form onSubmit={handleParse} className="space-y-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="เช่น โทรหาครูแอน โรงเรียนอนุบาลชลบุรี พรุ่งนี้บ่ายสามโมง เพื่อติดตามใบเสนอราคา Robotics Kit ด่วน"
              rows={7}
              className="w-full p-4 rounded-xl border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-6 resize-none"
              required
            />

            {parseError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-xs font-semibold text-white shadow-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังประมวลผล...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>ประมวลผลด้วย AI</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80">
            <span className="block text-[9.5px] font-black uppercase tracking-widest text-slate-500 mb-2">ตัวอย่างข้อความ</span>
            <div className="space-y-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInputText(example)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-800/60 bg-[#090d16]/30 text-[10.5px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 transition-all"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl glass-panel relative overflow-hidden min-h-[520px]">
          {savedSuccess && (
            <div className="absolute inset-0 bg-slate-950/90 z-30 flex items-center justify-center">
              <div className="text-center space-y-2 animate-scale-up">
                <CheckCircle className="text-emerald-400 mx-auto" size={40} />
                <h4 className="text-sm font-semibold text-slate-100">บันทึกนัดหมายสำเร็จแล้ว</h4>
                <p className="text-[10px] text-slate-400">กำลังนำคุณไปยังตารางงาน</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">AI Output Review</h3>
            {parsedData && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${activeUrgency.className}`}>
                <ShieldCheck size={11} /> {activeUrgency.label}
              </span>
            )}
          </div>

          {parsedData ? (
            <form onSubmit={handleSaveToCalendar} className="space-y-4">
              {matchedLead && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-[10.5px] text-emerald-200 flex items-start gap-2">
                  <Link2 size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">เชื่อมกับ Lead: {matchedLead.schoolName}</span>
                    <span className="block text-emerald-300/70 mt-0.5">{matchedLead.zone || 'ไม่ระบุพื้นที่'} {matchedLead.status ? `• ${matchedLead.status}` : ''}</span>
                  </div>
                </div>
              )}

              {parsedData.missingFields?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>AI ยังไม่มั่นใจบางช่อง: {parsedData.missingFields.join(', ')}</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">หัวข้อกิจกรรม</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1">ประเภท</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {taskTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1">ความเร่งด่วน</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {urgencyOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Calendar size={10} /> วันที่
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Clock size={10} /> เวลา
                  </label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                  <Building size={10} /> โรงเรียนที่เอ่ยถึง
                </label>
                <input
                  type="text"
                  value={schoolMentioned}
                  onChange={(e) => setSchoolMentioned(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <UserRound size={10} /> ผู้ติดต่อ
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Phone size={10} /> โทร
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Mail size={10} /> อีเมล
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">บันทึกย่อ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-5"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>ยืนยันบันทึกลงตารางงาน</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="min-h-[420px] flex items-center justify-center text-center text-slate-500 text-xs">
              <div className="space-y-3">
                <MessageSquareCode size={36} className="mx-auto text-slate-700" />
                <p>ผลลัพธ์ AI จะแสดงที่นี่หลังประมวลผลข้อความ</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <ListChecks size={13} /> ประวัติ AI Logger ล่าสุด
          </h3>
          <span className="text-[10px] text-slate-500">{recentLogs.length} รายการ</span>
        </div>

        {recentLogs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentLogs.slice(0, 6).map(log => (
              <button
                key={log._id}
                type="button"
                onClick={() => {
                  setInputText(log.rawText || '');
                  if (log.parsed) {
                    applyParsedData({
                      ...log.parsed,
                      aiLogId: log._id,
                      leadId: log.leadId || log.parsed.leadId
                    });
                  }
                }}
                className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/35 hover:border-indigo-500/30 hover:bg-slate-900/70 transition-all text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1">{log.parsed?.title || 'AI log'}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] border font-bold ${
                    log.status === 'Confirmed'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }`}>
                    {log.status}
                  </span>
                </div>
                <p className="mt-2 text-[10.5px] text-slate-500 line-clamp-2">{log.rawText}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[9.5px] text-slate-600">
                  <span>{log.parsed?.type || 'Other'} • {log.parsed?.urgency || 'Medium'}</span>
                  <span>{new Date(log.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            ยังไม่มีประวัติการใช้ AI Logger
          </div>
        )}
      </section>
    </div>
  );
}
