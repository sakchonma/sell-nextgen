import { createRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth, User } from '../hooks/useAuth';
import { 
  CheckSquare, 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  Check, 
  X, 
  AlertTriangle,
  Info,
  MessageSquare,
  Trash2,
  List,
  Grid3X3,
  Edit,
  Repeat2,
  Link as LinkIcon
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/tasks',
  component: TasksComponent,
});

function TasksComponent() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [coworkers, setCoworkers] = useState<User[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'month' | 'week' | 'day'>('list');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  
  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Meeting');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [leadId, setLeadId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState('30');
  const [recurrenceRule, setRecurrenceRule] = useState('none');
  const [recurrenceCount, setRecurrenceCount] = useState('1');
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  
  // Reject Dialog State
  const [declineTask, setDeclineTask] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineError, setDeclineError] = useState('');

  const fetchTasksData = () => {
    apiFetch('/api/tasks')
      .then(data => setTasks(data))
      .catch(err => console.error('Failed to load tasks:', err));

    apiFetch('/api/users')
      .then(data => setCoworkers(data.filter((u: any) => u._id !== user?._id)))
      .catch(err => console.error('Failed to load coworkers:', err));
    apiFetch('/api/leads')
      .then(data => setLeads(Array.isArray(data) ? data : []))
      .catch(() => setLeads([]));
    apiFetch('/api/opportunities')
      .then(data => setOpportunities(Array.isArray(data) ? data : []))
      .catch(() => setOpportunities([]));
  };

  useEffect(() => {
    fetchTasksData();
  }, [user]);

  const resetTaskForm = () => {
    setTitle('');
    setDescription('');
    setType('Meeting');
    setStartAt('');
    setEndAt('');
    setLeadId('');
    setOpportunityId('');
    setReminderMinutesBefore('30');
    setRecurrenceRule('none');
    setRecurrenceCount('1');
    setInvitedIds([]);
    setConflicts([]);
    setEditingTask(null);
  };

  const openEditTask = (task: any) => {
    setEditingTask(task);
    setTitle(task.title || '');
    setDescription(task.description || '');
    setType(task.type || 'Meeting');
    setStartAt(new Date(task.startAt).toISOString().slice(0, 16));
    setEndAt(new Date(task.endAt).toISOString().slice(0, 16));
    setLeadId(task.leadId || '');
    setOpportunityId(task.opportunityId || '');
    setInvitedIds((task.participants || []).map((p: any) => p.userId).filter((id: string) => id !== user?._id));
    setReminderMinutesBefore('30');
    setRecurrenceRule('none');
    setRecurrenceCount('1');
    setFormError('');
    setShowAddModal(true);
  };

  const checkConflicts = () => {
    if (!startAt || !endAt) return;
    apiJson('/api/tasks/conflicts', {
      startAt,
      endAt,
      participantIds: [...invitedIds, user?._id].filter(Boolean)
    })
      .then(data => setConflicts(data.conflicts || []))
      .catch(() => setConflicts([]));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (new Date(endAt) <= new Date(startAt)) {
      setFormError('วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น');
      return;
    }
    const payload = {
      title,
      description,
      type,
      startAt,
      endAt,
      leadId: leadId || undefined,
      opportunityId: opportunityId || undefined,
      reminderMinutesBefore: Number(reminderMinutesBefore),
      recurrenceRule,
      recurrenceCount: Number(recurrenceCount) || 1,
      participantIds: [...invitedIds, user?._id].filter(Boolean)
    };
    const request = editingTask
      ? apiJson(`/api/tasks/${editingTask._id}`, { ...payload, recurrenceRule: undefined, recurrenceCount: undefined }, { method: 'PUT' })
      : apiJson('/api/tasks', payload);
    request
      .then(() => {
        setShowAddModal(false);
        resetTaskForm();
        fetchTasksData();
      })
      .catch(err => setFormError(err.message || 'สร้างนัดหมายไม่สำเร็จ'));
  };

  const handleRespond = (taskId: string, status: string, reason?: string) => {
    apiJson(`/api/tasks/${taskId}/respond`, { status, reason }, { method: 'PUT' })
      .then(() => {
        setDeclineTask(null);
        setDeclineReason('');
        setDeclineError('');
        fetchTasksData();
      })
      .catch(err => {
        console.error('Failed to respond:', err);
        setDeclineError(err.message);
      });
  };

  const handleDeleteTask = (task: any) => {
    if (!window.confirm(`ยืนยันการลบนัดหมาย "${task.title}"?`)) return;
    apiFetch(`/api/tasks/${task._id}`, { method: 'DELETE' })
      .then(() => {
        setSelectedTask(null);
        fetchTasksData();
      })
      .catch(err => alert(err.message || 'ลบนัดหมายไม่สำเร็จ'));
  };

  const setTaskCompletion = (task: any, complete: boolean) => {
    apiJson(`/api/tasks/${task._id}/${complete ? 'complete' : 'reopen'}`, {}, { method: 'PUT' })
      .then(updated => {
        setSelectedTask(updated);
        fetchTasksData();
      })
      .catch(err => alert(err.message || 'อัปเดตสถานะงานไม่สำเร็จ'));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !comment.trim()) return;
    apiJson(`/api/tasks/${selectedTask._id}/comments`, { content: comment.trim() })
      .then(updated => {
        setSelectedTask(updated);
        setComment('');
        fetchTasksData();
      })
      .catch(err => alert(err.message || 'เพิ่มคอมเมนต์ไม่สำเร็จ'));
  };

  const handleDeclineClick = (task: any) => {
    setDeclineTask(task);
    setDeclineReason('');
    setDeclineError('');
  };

  const handleDeclineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineTask) return;
    handleRespond(declineTask._id, 'Declined', declineReason);
  };

  const toggleInvite = (id: string) => {
    setInvitedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Invitations where user is pending response
  const pendingInvites = tasks.filter(t => 
    t.participants.some(p => p.userId === user?._id && p.status === 'Pending')
  );

  // Accepted or owned tasks
  const mySchedule = tasks.filter(t => 
    t.creatorId === user?._id ||
    t.participants.some(p => p.userId === user?._id && p.status === 'Accepted')
  );
  const now = new Date();
  const filteredSchedule = mySchedule.filter(t => {
    if (activeFilter === 'pending') return t.status === 'Pending';
    if (activeFilter === 'overdue') return t.status !== 'Completed' && new Date(t.endAt) < now;
    if (activeFilter === 'completed') return t.status === 'Completed';
    return true;
  });
  const monthBuckets = filteredSchedule.reduce<Record<string, any[]>>((acc, task) => {
    const key = new Date(task.startAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    acc[key] = [...(acc[key] || []), task];
    return acc;
  }, {});
  const weekStart = new Date();
  weekStart.setDate(now.getDate() - now.getDay());
  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + idx);
    return day;
  });
  const dayTasks = filteredSchedule.filter(t => new Date(t.startAt).toDateString() === now.toDateString());
  const typeColor = (task: any) => {
    if (task.status === 'Completed') return 'border-emerald-500/25 bg-emerald-500/10';
    if (new Date(task.endAt) < now) return 'border-rose-500/25 bg-rose-500/10';
    if (task.type === 'Demo') return 'border-purple-500/25 bg-purple-500/10';
    if (task.type === 'Call') return 'border-blue-500/25 bg-blue-500/10';
    return 'border-indigo-500/20 bg-indigo-500/5';
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <CheckSquare className="text-indigo-400" /> งาน & นัดหมาย
          </h2>
          <p className="text-xs text-slate-400 mt-1">บริหารจัดการนัดพบปะ ตารางสิทธิ์งาน และคำเชิญตอบรับเข้าร่วม</p>
        </div>
        <button 
          onClick={() => { resetTaskForm(); setShowAddModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
        >
          <Plus size={14} /> สร้างนัดหมายใหม่
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'ทั้งหมด', count: mySchedule.length },
            { id: 'pending', label: 'รอดำเนินการ', count: mySchedule.filter(t => t.status === 'Pending').length },
            { id: 'overdue', label: 'เกินกำหนด', count: mySchedule.filter(t => t.status !== 'Completed' && new Date(t.endAt) < now).length },
            { id: 'completed', label: 'เสร็จแล้ว', count: mySchedule.filter(t => t.status === 'Completed').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold ${activeFilter === tab.id ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'}`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg border ${viewMode === 'list' ? 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-400'}`} title="List view"><List size={14} /></button>
          <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg border ${viewMode === 'month' ? 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-400'}`} title="Month grouped view"><Grid3X3 size={14} /></button>
          <button onClick={() => setViewMode('week')} className={`px-2 py-1 rounded-lg border text-[10px] ${viewMode === 'week' ? 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-400'}`}>Week</button>
          <button onClick={() => setViewMode('day')} className={`px-2 py-1 rounded-lg border text-[10px] ${viewMode === 'day' ? 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10' : 'border-slate-800 text-slate-400'}`}>Day</button>
          <a href="/api/tasks/export.ics" className="px-2 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200">Export ICS</a>
        </div>
      </div>

      {/* PENDING INVITATIONS BANNER */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3">
          <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-400">คำเชิญรอตอบรับ ({pendingInvites.length} รายการ)</span>
          {pendingInvites.map(invite => (
            <div key={invite._id} className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Calendar size={10} /> {new Date(invite.startAt).toLocaleString('th-TH')}
                </span>
                <h4 className="text-xs font-bold text-slate-100">{invite.title}</h4>
                <p className="text-[11px] text-slate-400">{invite.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
              </div>

              <div className="flex gap-2 self-end md:self-auto">
                <button 
                  onClick={() => handleRespond(invite._id, 'Accepted')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white cursor-pointer"
                >
                  <Check size={12} /> เข้าร่วม
                </button>
                <button 
                  onClick={() => handleRespond(invite._id, 'Acknowledged')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 cursor-pointer"
                >
                  <Info size={12} /> รับทราบ
                </button>
                <button 
                  onClick={() => handleDeclineClick(invite)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-[10px] font-semibold text-red-400 border border-red-500/20 cursor-pointer"
                >
                  <X size={12} /> ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCHEDULE LIST */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">ตารางนัดหมายของคุณ</h3>
        <div className="divide-y divide-slate-800 max-h-[50vh] overflow-y-auto pr-2">
          {viewMode === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 py-1">
              {weekDays.map(day => {
                const items = filteredSchedule.filter(t => new Date(t.startAt).toDateString() === day.toDateString());
                return (
                  <div key={day.toISOString()} className="rounded-xl border border-slate-800 bg-[#090d16]/30 p-3 min-h-40">
                    <div className="text-[10px] font-black text-slate-400 mb-2">{day.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' })}</div>
                    <div className="space-y-2">
                      {items.map(task => (
                        <button key={task._id} onClick={() => setSelectedTask(task)} className={`w-full p-2 rounded-lg border text-left ${typeColor(task)}`}>
                          <div className="text-[9px] text-slate-500">{new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-[10px] font-semibold text-slate-200 line-clamp-2">{task.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {viewMode === 'day' && (
            <div className="py-2 space-y-3">
              {dayTasks.map(task => (
                <button key={task._id} onClick={() => setSelectedTask(task)} className={`w-full p-4 rounded-xl border text-left ${typeColor(task)}`}>
                  <div className="text-[10px] text-slate-500">{new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                  <h4 className="text-sm font-bold text-slate-200 mt-1">{task.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{task.description || 'ไม่มีรายละเอียด'}</p>
                </button>
              ))}
              {dayTasks.length === 0 && <div className="py-12 text-center text-xs text-slate-500">วันนี้ยังไม่มีงาน</div>}
            </div>
          )}
          {viewMode === 'month' && Object.entries(monthBuckets).map(([day, items]) => (
            <div key={day} className="py-4 first:pt-0 last:pb-0">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3">{day}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(task => (
                  <button key={task._id} onClick={() => setSelectedTask(task)} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/30 text-left hover:border-indigo-500/30 transition-all">
                    <span className="text-[9px] text-slate-500">{new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    <h4 className="text-xs font-bold text-slate-200 mt-1">{task.title}</h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{task.description || 'ไม่มีรายละเอียด'}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {viewMode === 'list' && filteredSchedule.map(task => (
            <div key={task._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                    {task.type}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                    <Clock size={10} /> {new Date(task.startAt).toLocaleString('th-TH')} - {new Date(task.endAt).toLocaleTimeString('th-TH')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-200">{task.title}</h4>
                <p className="text-[11px] text-slate-400">{task.description}</p>
                <button onClick={() => setSelectedTask(task)} className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300">
                  <MessageSquare size={11} /> รายละเอียดและคอมเมนต์ ({task.comments?.length || 0})
                </button>
              </div>

              {/* Invited participants display */}
              <div className="flex flex-wrap gap-1.5">
                {task.participants.map((p: any, pidx: number) => (
                  <span 
                    key={pidx} 
                    className={`px-1.5 py-0.5 rounded text-[9px] border font-medium ${p.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : p.status === 'Declined' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                    title={p.reason ? `ปฏิเสธเนื่องจาก: ${p.reason}` : ''}
                  >
                    User {p.userId.replace('u', '')} ({p.status})
                  </span>
                ))}
              </div>
            </div>
          ))}
          {filteredSchedule.length === 0 && viewMode !== 'day' && (
            <div className="py-12 text-center text-slate-500 text-xs">
              ยังไม่มีตารางนัดหมายที่เปิดรับหรือดูแลอยู่
            </div>
          )}
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTask} className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-slate-100">{editingTask ? 'แก้ไขงานหรือนัดหมาย' : 'สร้างงานหรือการนัดหมายใหม่'}</h3>
            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{formError}</div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-1">หัวข้อกิจกรรม</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="นัดหมายสาธิตการใช้บอร์ดหุ่นยนต์"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-1">รายละเอียดงาน</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="สาธิตชุดหุ่นยนต์ระดับประถม (Robotics Kit v3)"
                  rows={2}
                  className="w-full p-3 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ประเภทนัดหมาย</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting (ประชุม)</option>
                  <option value="Demo">Demo (สาธิตระบบ)</option>
                  <option value="FollowUp">FollowUp (ติดตามงาน)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div></div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">วันและเวลาเริ่มต้น</label>
                <input 
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => { setStartAt(e.target.value); setTimeout(checkConflicts, 0); }}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">วันและเวลาสิ้นสุด</label>
                <input 
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => { setEndAt(e.target.value); setTimeout(checkConflicts, 0); }}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <select value={leadId} onChange={e => setLeadId(e.target.value)} className="px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                <option value="">ไม่ผูก Lead</option>
                {leads.map(lead => <option key={lead._id} value={lead._id}>{lead.schoolName}</option>)}
              </select>
              <select value={opportunityId} onChange={e => setOpportunityId(e.target.value)} className="px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                <option value="">ไม่ผูก Opportunity</option>
                {opportunities.map(opp => <option key={opp._id} value={opp._id}>{opp.title}</option>)}
              </select>
              <input type="number" min="0" max="10080" value={reminderMinutesBefore} onChange={e => setReminderMinutesBefore(e.target.value)} placeholder="Reminder minutes" className="px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
              {!editingTask && (
                <div className="flex gap-2">
                  <select value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200">
                    <option value="none">ไม่ทำซ้ำ</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <input type="number" min="1" max="24" value={recurrenceCount} onChange={e => setRecurrenceCount(e.target.value)} className="w-20 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                </div>
              )}
            </div>

            {conflicts.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-300">
                พบเวลาชน {conflicts.length} รายการ แต่ยังสามารถบันทึกได้
              </div>
            )}

            {/* Invite coworkers checklist */}
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-2">เชิญชวนผู้ร่วมงาน (Coworkers)</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-slate-800 p-3 rounded-lg bg-[#090d16]/30">
                {coworkers.map(cw => (
                  <label key={cw._id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={invitedIds.includes(cw._id)}
                  onChange={() => toggleInvite(cw._id)}
                      onBlur={checkConflicts}
                      className="rounded text-indigo-500 border-slate-800 focus:ring-indigo-500"
                    />
                    <span>{cw.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button"
                onClick={() => { setShowAddModal(false); resetTaskForm(); }}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                {editingTask ? 'บันทึกการแก้ไข' : 'บันทึกนัดหมาย'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-700">{selectedTask.type}</span>
                <h3 className="text-base font-semibold text-slate-100 mt-2">{selectedTask.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{new Date(selectedTask.startAt).toLocaleString('th-TH')} - {new Date(selectedTask.endAt).toLocaleString('th-TH')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditTask(selectedTask)} className="p-2 rounded-lg border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10" title="แก้ไขนัดหมาย">
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => setTaskCompletion(selectedTask, selectedTask.status !== 'Completed')}
                  className="p-2 rounded-lg border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/10"
                  title={selectedTask.status === 'Completed' ? 'Reopen task' : 'Mark complete'}
                >
                  <Check size={14} />
                </button>
                {(selectedTask.creatorId === user?._id || (user?.rank || 0) >= 4) && (
                  <button onClick={() => handleDeleteTask(selectedTask)} className="p-2 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10" title="ลบนัดหมาย">
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={() => setSelectedTask(null)} className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200">ปิด</button>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{selectedTask.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            {(selectedTask.leadId || selectedTask.opportunityId || selectedTask.requestId) && (
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-800"><LinkIcon size={10} /> Lead: {selectedTask.leadId || '-'}</span>
                {selectedTask.opportunityId && <span className="px-2 py-1 rounded border border-slate-800">Opportunity: {selectedTask.opportunityId}</span>}
                {selectedTask.requestId && <span className="px-2 py-1 rounded border border-slate-800">Request: {selectedTask.requestId}</span>}
              </div>
            )}
            {(selectedTask.recurrenceRule && selectedTask.recurrenceRule !== 'none') && (
              <div className="inline-flex items-center gap-1 text-[10px] text-indigo-300">
                <Repeat2 size={11} /> Recurring: {selectedTask.recurrenceRule}
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">ผู้เข้าร่วม</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTask.participants?.map((p: any) => (
                  <span key={p.userId} className={`px-2 py-1 rounded-lg border text-[10px] ${p.status === 'Accepted' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : p.status === 'Declined' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {coworkers.find(cw => cw._id === p.userId)?.name || (p.userId === user?._id ? user.name : p.userId)}: {p.status}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">คอมเมนต์</h4>
              <div className="space-y-2">
                {(selectedTask.comments || []).map((item: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/40">
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] font-semibold text-indigo-300">{item.authorName}</span>
                      <span className="text-[9px] text-slate-500">{new Date(item.createdAt).toLocaleString('th-TH')}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{item.content}</p>
                  </div>
                ))}
                {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                  <div className="py-6 text-center text-xs text-slate-500">ยังไม่มีคอมเมนต์</div>
                )}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="เพิ่มคอมเมนต์..." className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">ส่ง</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE DIALOG (FORCE REASON CHECK) */}
      {declineTask && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDeclineSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <AlertTriangle className="text-rose-400 shrink-0" size={20} />
              <h3 className="text-base font-semibold text-slate-100">ปฏิเสธคำเชิญตารางงาน</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              คุณกำลังปฏิเสธงานนัดหมาย: <span className="font-bold text-slate-200">"{declineTask.title}"</span>. 
              เนื่องจากผู้เชิญมี Rank สิทธิ์ที่สูงกว่า คุณจึงจำเป็นต้องระบุเหตุผลที่ชัดเจนในการปฏิเสธครั้งนี้.
            </p>

            {declineError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {declineError}
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">ระบุเหตุผล (บังคับ)</label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="ระบุเหตุผล เช่น ติดนัดอบรมลูกค้าภายนอกพื้นที่, ลาพักร้อน..."
                rows={3}
                className="w-full p-3 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                required
              ></textarea>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button"
                onClick={() => setDeclineTask(null)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                ส่งเหตุผลปฏิเสธ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
