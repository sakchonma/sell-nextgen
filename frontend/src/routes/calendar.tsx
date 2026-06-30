import { createRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth, User } from '../hooks/useAuth';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User as UserIcon,
  Filter,
  Check,
  X,
  MessageSquare,
  List,
  Grid3X3
} from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/calendar',
  component: CalendarComponent,
});

function CalendarComponent() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [comment, setComment] = useState('');
  
  // Date control
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchCalendarData = () => {
    apiFetch('/api/tasks')
      .then(data => setTasks(data))
      .catch(err => console.error('Failed to load tasks:', err));

    apiFetch('/api/users')
      .then(data => setTeamMembers(data))
      .catch(err => console.error('Failed to load team:', err));
  };

  useEffect(() => {
    fetchCalendarData();
  }, [user]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const moveDate = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + days);
    setCurrentDate(next);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };

  const getCreatorName = (creatorId: string) => {
    const member = teamMembers.find(m => m._id === creatorId);
    return member ? member.name : 'ผู้ใช้อื่น';
  };

  // Filter tasks based on selected representative (Managers/Execs only)
  const filteredTasks = tasks.filter(t => {
    if (selectedUserFilter === 'All') return true;
    return t.creatorId === selectedUserFilter || t.participants.some((p: any) => p.userId === selectedUserFilter);
  });

  const getTasksForDay = (day: Date) => {
    const dayStr = day.toISOString().split('T')[0];
    return filteredTasks.filter(t => 
      new Date(t.startAt).toISOString().split('T')[0] === dayStr
    );
  };

  const days = getDaysInMonth(currentDate);
  const agendaTasks = [...filteredTasks]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .filter(task => new Date(task.startAt).getMonth() === currentDate.getMonth());
  const myParticipant = selectedTask?.participants?.find((p: any) => p.userId === user?._id);
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + idx);
    return day;
  });
  const dayTasks = filteredTasks
    .filter(task => new Date(task.startAt).toDateString() === currentDate.toDateString())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const taskColor = (task: any) => {
    if (task.status === 'Completed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
    if (new Date(task.endAt) < new Date()) return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
    if (task.type === 'Demo') return 'border-purple-500/25 bg-purple-500/10 text-purple-200';
    if (task.type === 'Call') return 'border-blue-500/25 bg-blue-500/10 text-blue-200';
    return 'border-indigo-500/20 bg-indigo-500/5 text-slate-200';
  };

  const respondToTask = (status: string) => {
    if (!selectedTask) return;
    apiJson(`/api/tasks/${selectedTask._id}/respond`, { status }, { method: 'PUT' })
      .then(updated => {
        setSelectedTask(updated);
        fetchCalendarData();
      })
      .catch(err => alert(err.message || 'ตอบรับนัดหมายไม่สำเร็จ'));
  };

  const addComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !comment.trim()) return;
    apiJson(`/api/tasks/${selectedTask._id}/comments`, { content: comment.trim() })
      .then(updated => {
        setSelectedTask(updated);
        setComment('');
        fetchCalendarData();
      })
      .catch(err => alert(err.message || 'เพิ่มคอมเมนต์ไม่สำเร็จ'));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <CalendarIcon className="text-indigo-400" /> ปฏิทินกลางองค์กร
          </h2>
          <p className="text-xs text-slate-400 mt-1">ปฏิทินงานนัดหมายร่วมแสดงผลกิจกรรมทีมและลูกค้าสัมพันธ์</p>
        </div>

        {/* Manager/Exec filter panel */}
        {user && user.rank >= 4 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#121826]/40">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Filter size={10} /> กรองรายคน:
            </span>
            <select 
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="px-2 py-1 rounded bg-[#090d16] border border-slate-800 text-[10px] text-slate-300 focus:outline-none"
            >
              <option value="All">แสดงทั้งทีม</option>
              {teamMembers.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CALENDAR NAVIGATION */}
      <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-200">
          {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
        </h3>
        
        <div className="flex gap-2">
          <button onClick={() => setViewMode('month')} className={`p-2 rounded-lg border ${viewMode === 'month' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-400'}`} title="Month view"><Grid3X3 size={14} /></button>
          <button onClick={() => setViewMode('week')} className={`px-2 py-1 rounded-lg border text-[10px] ${viewMode === 'week' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-400'}`}>Week</button>
          <button onClick={() => setViewMode('day')} className={`px-2 py-1 rounded-lg border text-[10px] ${viewMode === 'day' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-400'}`}>Day</button>
          <button onClick={() => setViewMode('agenda')} className={`p-2 rounded-lg border ${viewMode === 'agenda' ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 text-slate-400'}`} title="Agenda view"><List size={14} /></button>
          <a href="/api/tasks/export.ics" className="px-2 py-1 rounded-lg border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200">ICS</a>
          <button 
            onClick={() => viewMode === 'month' ? handlePrevMonth() : moveDate(viewMode === 'week' ? -7 : -1)}
            className="p-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <button 
            onClick={() => viewMode === 'month' ? handleNextMonth() : moveDate(viewMode === 'week' ? 7 : 1)}
            className="p-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* MONTH VIEW AGENDA LAYOUT */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map(day => {
            const items = filteredTasks.filter(task => new Date(task.startAt).toDateString() === day.toDateString());
            return (
              <div key={day.toISOString()} className="rounded-2xl border border-slate-800 bg-[#121826]/30 p-3 min-h-[260px]">
                <div className="text-[10px] font-black text-slate-400 mb-3">{day.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' })}</div>
                <div className="space-y-2">
                  {items.map(task => (
                    <button key={task._id} onClick={() => setSelectedTask(task)} className={`w-full p-2 rounded-lg border text-left ${taskColor(task)}`}>
                      <div className="text-[9px] opacity-70">{new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-[10px] font-semibold line-clamp-2">{task.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'day' && (
        <div className="p-6 rounded-2xl glass-panel space-y-3">
          {dayTasks.map(task => (
            <button key={task._id} onClick={() => setSelectedTask(task)} className={`w-full p-4 rounded-xl border text-left ${taskColor(task)}`}>
              <div className="text-[10px] opacity-70">{new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
              <h4 className="text-sm font-semibold mt-1">{task.title}</h4>
              <p className="text-xs opacity-75 mt-1">{task.description || 'ไม่มีรายละเอียด'}</p>
            </button>
          ))}
          {dayTasks.length === 0 && <div className="py-12 text-center text-xs text-slate-500">ไม่มีตารางงานในวันนี้</div>}
        </div>
      )}

      {viewMode === 'agenda' && (
        <div className="p-6 rounded-2xl glass-panel divide-y divide-slate-800">
          {agendaTasks.map(task => (
            <button key={task._id} onClick={() => setSelectedTask(task)} className="w-full py-3 first:pt-0 last:pb-0 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/20">
              <div>
                <span className="text-[9px] text-indigo-300 font-bold uppercase">{task.type}</span>
                <h4 className="text-xs font-semibold text-slate-200">{task.title}</h4>
                <p className="text-[10px] text-slate-500">{task.description || 'ไม่มีรายละเอียด'}</p>
              </div>
              <span className="text-[10px] text-slate-500">{new Date(task.startAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </button>
          ))}
          {agendaTasks.length === 0 && <div className="py-12 text-center text-xs text-slate-500">ไม่มีตารางงานในเดือนนี้</div>}
        </div>
      )}

      {viewMode === 'month' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {days.map((day, dIdx) => {
          const dayTasks = getTasksForDay(day);
          const isToday = new Date().toISOString().split('T')[0] === day.toISOString().split('T')[0];

          return (
            <div 
              key={dIdx} 
              className={`p-4 rounded-2xl border text-left flex flex-col justify-between min-h-[140px] transition-all bg-[#121826]/20 ${isToday ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800/80 hover:border-slate-700'}`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-xs font-bold font-display ${isToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {day.toLocaleDateString('th-TH', { weekday: 'short' })} {day.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </div>

              {/* Day Tasks list */}
              <div className="mt-3 space-y-2 flex-1">
                {dayTasks.slice(0, 2).map(task => (
                  <button key={task._id} onClick={() => setSelectedTask(task)} className={`w-full p-2 rounded border text-[10px] space-y-1 text-left hover:border-indigo-500/30 ${taskColor(task)}`}>
                    <span className="font-bold text-slate-300 block line-clamp-1">{task.title}</span>
                    <div className="flex items-center justify-between text-slate-500 text-[9px]">
                      <span className="flex items-center gap-0.5"><Clock size={8} /> {new Date(task.startAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-0.5"><UserIcon size={8} /> {getCreatorName(task.creatorId).split(' ')[0]}</span>
                    </div>
                  </button>
                ))}
                {dayTasks.length > 2 && (
                  <span className="text-[9px] text-slate-500 block text-right font-semibold">+ อีก {dayTasks.length - 2} งาน</span>
                )}
                {dayTasks.length === 0 && (
                  <span className="text-[10px] text-slate-600 block pt-4 text-center">ไม่มีตารางงาน</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="inline-flex px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400 border border-slate-700">{selectedTask.type}</span>
                <h3 className="text-base font-semibold text-slate-100 mt-2">{selectedTask.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{new Date(selectedTask.startAt).toLocaleString('th-TH')} - {new Date(selectedTask.endAt).toLocaleString('th-TH')}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200">ปิด</button>
            </div>
            <p className="text-xs text-slate-300">{selectedTask.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            {myParticipant?.status === 'Pending' && (
              <div className="flex gap-2">
                <button onClick={() => respondToTask('Accepted')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white"><Check size={12} /> เข้าร่วม</button>
                <button onClick={() => respondToTask('Acknowledged')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200"><MessageSquare size={12} /> รับทราบ</button>
                <button onClick={() => respondToTask('Declined')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/20 text-xs font-semibold text-rose-300"><X size={12} /> ปฏิเสธ</button>
              </div>
            )}
            <div className="space-y-3">
              {(selectedTask.comments || []).map((item: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-[#090d16]/40">
                  <div className="flex justify-between gap-3">
                    <span className="text-[10px] font-semibold text-indigo-300">{item.authorName}</span>
                    <span className="text-[9px] text-slate-500">{new Date(item.createdAt).toLocaleString('th-TH')}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{item.content}</p>
                </div>
              ))}
              <form onSubmit={addComment} className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="เพิ่มคอมเมนต์..." className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200" />
                <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white">ส่ง</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
