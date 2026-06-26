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
  Grid3X3
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'month'>('list');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');
  
  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Meeting');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
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
  };

  useEffect(() => {
    fetchTasksData();
  }, [user]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (new Date(endAt) <= new Date(startAt)) {
      setFormError('วันและเวลาสิ้นสุดต้องมากกว่าวันและเวลาเริ่มต้น');
      return;
    }
    apiJson('/api/tasks', {
      title,
      description,
      type,
      startAt,
      endAt,
      participantIds: [...invitedIds, user?._id]
    })
      .then(() => {
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        setInvitedIds([]);
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
          onClick={() => setShowAddModal(true)}
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
          {filteredSchedule.length === 0 && (
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
            <h3 className="text-base font-semibold text-slate-100">สร้างงานหรือการนัดหมายใหม่</h3>
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
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">วันและเวลาสิ้นสุด</label>
                <input 
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

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
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                บันทึกนัดหมาย
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
                {(selectedTask.creatorId === user?._id || (user?.rank || 0) >= 4) && (
                  <button onClick={() => handleDeleteTask(selectedTask)} className="p-2 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10" title="ลบนัดหมาย">
                    <Trash2 size={14} />
                  </button>
                )}
                <button onClick={() => setSelectedTask(null)} className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200">ปิด</button>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{selectedTask.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>

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
