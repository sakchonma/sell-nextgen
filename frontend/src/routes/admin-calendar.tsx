import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Users2,
  X,
} from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/admin-calendar',
  component: AdminCalendarComponent,
});

type AdminCalendarEvent = {
  id: string;
  source: 'task' | 'request';
  title: string;
  description?: string;
  type?: string;
  status: string;
  approvalStatus?: string;
  requestNumber?: string;
  department: string;
  startAt: string;
  endAt: string;
  ownerId?: string;
  ownerName?: string;
  creatorName?: string;
  leadName?: string;
  editable: boolean;
};

type CalendarPermissions = {
  canEdit: boolean;
  scope: 'all' | 'department';
  supportDepartment?: string | null;
};

const SOURCE_LABELS = {
  task: 'Task',
  request: 'Request',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  AdminSupport: 'Admin Support',
  Finance: 'Finance',
  Academic: 'วิชาการ',
  Production: 'Production',
  Management: 'Management',
  Sales: 'Sales',
  General: 'General',
};

const TASK_STATUSES = ['Pending', 'Completed', 'Overdue'];
const REQUEST_STATUSES = ['Submitted', 'Approved', 'Rejected', 'Acknowledged', 'Claimed', 'Completed'];
const REQUEST_DEPARTMENTS = ['AdminSupport', 'Finance', 'Academic', 'Production'];

function authHeaders(contentType = false) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
  if (contentType) headers['Content-Type'] = 'application/json';
  return headers;
}

function dateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function timeValue(value: string) {
  return new Date(value).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function formatDateInput(value: string) {
  return dateKey(value);
}

function formatTimeInput(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function departmentLabel(value: string) {
  return DEPARTMENT_LABELS[value] || value;
}

function statusStyle(status: string) {
  if (['Completed', 'Claimed', 'Acknowledged'].includes(status)) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  if (['Approved'].includes(status)) return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25';
  if (['Rejected', 'Overdue'].includes(status)) return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
}

function sourceStyle(source: 'task' | 'request') {
  if (source === 'request') return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
  return 'border-violet-500/20 bg-violet-500/10 text-violet-300';
}

function AdminCalendarComponent() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AdminCalendarEvent[]>([]);
  const [permissions, setPermissions] = useState<CalendarPermissions | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'task' | 'request'>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<AdminCalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEvents = () => {
    setError('');
    fetch('/api/admin-calendar/events', { headers: authHeaders() })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'โหลดปฏิทินกลางไม่สำเร็จ');
        }
        return res.json();
      })
      .then(data => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setPermissions(data.permissions || null);
      })
      .catch(err => {
        setEvents([]);
        setError(err.message || 'โหลดปฏิทินกลางไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, idx) => new Date(year, month, idx + 1));
  }, [currentDate]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.startAt);
      const inMonth = eventDate.getMonth() === currentDate.getMonth() && eventDate.getFullYear() === currentDate.getFullYear();
      const matchDepartment = departmentFilter === 'All' || event.department === departmentFilter;
      const matchSource = sourceFilter === 'All' || event.source === sourceFilter;
      const matchStatus = statusFilter === 'All' || event.status === statusFilter;
      return inMonth && matchDepartment && matchSource && matchStatus;
    });
  }, [events, currentDate, departmentFilter, sourceFilter, statusFilter]);

  const departments = useMemo(() => {
    return Array.from(new Set(events.map(event => event.department))).sort();
  }, [events]);

  const statuses = useMemo(() => {
    return Array.from(new Set(events.map(event => event.status))).sort();
  }, [events]);

  const monthStats = useMemo(() => {
    const requestCount = filteredEvents.filter(event => event.source === 'request').length;
    const taskCount = filteredEvents.filter(event => event.source === 'task').length;
    const departmentCount = new Set(filteredEvents.map(event => event.department)).size;
    return { total: filteredEvents.length, requestCount, taskCount, departmentCount };
  }, [filteredEvents]);

  const openEdit = (event: AdminCalendarEvent) => {
    if (!permissions?.canEdit) return;
    setSelectedEvent(event);
    setEditTitle(event.title);
    setEditDate(formatDateInput(event.startAt));
    setEditStart(formatTimeInput(event.startAt));
    setEditEnd(formatTimeInput(event.endAt));
    setEditStatus(event.status);
    setEditDepartment(event.department);
    setError('');
  };

  const saveEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setSaving(true);
    setError('');

    const body: Record<string, string> = {
      title: editTitle,
      startAt: new Date(`${editDate}T${editStart}`).toISOString(),
      endAt: new Date(`${editDate}T${editEnd}`).toISOString(),
      status: editStatus,
    };

    if (selectedEvent.source === 'request') {
      body.targetDepartment = editDepartment;
    }

    fetch(`/api/admin-calendar/events/${selectedEvent.source}/${selectedEvent.id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(body),
    })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'บันทึกปฏิทินกลางไม่สำเร็จ');
        }
        return res.json();
      })
      .then(() => {
        setSelectedEvent(null);
        fetchEvents();
      })
      .catch(err => setError(err.message || 'บันทึกปฏิทินกลางไม่สำเร็จ'))
      .finally(() => setSaving(false));
  };

  const getEventsForDay = (day: Date) => {
    const key = dateKey(day);
    return filteredEvents.filter(event => dateKey(event.startAt) === key);
  };

  const canUsePage = user && [2, 4, 5].includes(user.rank);

  if (!canUsePage) {
    return (
      <div className="space-y-4 text-slate-100 text-left animate-fade-in">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <CalendarDays className="text-indigo-400" /> ปฏิทินกลางองค์กร
        </h2>
        <div className="p-6 rounded-xl border border-slate-800 bg-[#121826]/40 text-sm text-slate-400">
          บัญชีนี้ไม่มีสิทธิ์เข้าถึงปฏิทินกลางองค์กร
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <CalendarDays className="text-indigo-400" /> ปฏิทินกลางองค์กร
          </h2>
          <p className="text-xs text-slate-400 mt-1">รวมแผนปฏิบัติการจากงานนัดหมายและคำขอทุกแผนกไว้ในมุมมองเดียว</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold ${permissions?.canEdit ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-slate-800/70 border-slate-700 text-slate-300'}`}>
            {permissions?.canEdit ? <Pencil size={12} /> : <Lock size={12} />}
            {permissions?.canEdit ? 'Executive Edit Mode' : 'Read-only'}
          </span>
          {permissions?.scope === 'department' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-300 text-[10px] font-bold">
              <Users2 size={12} /> {departmentLabel(permissions.supportDepartment || '')}
            </span>
          )}
          <button
            onClick={fetchEvents}
            className="p-2 rounded-lg border border-slate-800 bg-[#121826]/60 text-slate-400 hover:text-slate-200"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Events', value: monthStats.total, icon: CalendarDays },
          { label: 'Requests', value: monthStats.requestCount, icon: CheckCircle2 },
          { label: 'Tasks', value: monthStats.taskCount, icon: Clock },
          { label: 'Departments', value: monthStats.departmentCount, icon: Users2 },
        ].map(item => (
          <div key={item.label} className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
              <item.icon size={15} className="text-indigo-400" />
            </div>
            <span className="block text-xl font-bold text-slate-100 mt-2">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-[#121826]/40 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex items-center justify-between xl:justify-start gap-3">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft size={14} />
          </button>
          <h3 className="min-w-40 text-center text-sm font-semibold text-slate-200">
            {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer"
            title="เดือนถัดไป"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 xl:w-[620px]">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16]/60 text-[10px] text-slate-500">
            <Filter size={12} />
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="w-full bg-transparent text-slate-300 outline-none">
              <option value="All">ทุกแผนก</option>
              {departments.map(dept => <option key={dept} value={dept}>{departmentLabel(dept)}</option>)}
            </select>
          </label>
          <label className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16]/60 text-[10px] text-slate-500">
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)} className="w-full bg-transparent text-slate-300 outline-none">
              <option value="All">ทุกประเภท</option>
              <option value="task">Task</option>
              <option value="request">Request</option>
            </select>
          </label>
          <label className="px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16]/60 text-[10px] text-slate-500">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-transparent text-slate-300 outline-none">
              <option value="All">ทุกสถานะ</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const isToday = dateKey(new Date()) === dateKey(day);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[180px] rounded-xl border p-4 bg-[#121826]/25 ${isToday ? 'border-indigo-500/70' : 'border-slate-800/80'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className={`block text-xs font-bold ${isToday ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {day.toLocaleDateString('th-TH', { weekday: 'short' })} {day.getDate()}
                  </span>
                  <span className="block text-[9px] text-slate-600 mt-0.5">{dayEvents.length} event</span>
                </div>
                {dayEvents.length > 0 && <span className="h-2 w-2 rounded-full bg-indigo-400" />}
              </div>

              <div className="mt-3 space-y-2">
                {dayEvents.slice(0, 4).map(event => (
                  <button
                    key={`${event.source}-${event.id}`}
                    onClick={() => openEdit(event)}
                    disabled={!permissions?.canEdit}
                    className="w-full text-left rounded-lg border border-slate-800 bg-slate-950/40 p-2 transition-all hover:border-slate-700 disabled:cursor-default disabled:hover:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase ${sourceStyle(event.source)}`}>
                        {SOURCE_LABELS[event.source]}
                      </span>
                      <span className="text-[9px] text-slate-500 flex items-center gap-1">
                        <Clock size={9} /> {timeValue(event.startAt)}
                      </span>
                    </div>
                    <span className="block mt-1.5 text-[10px] font-bold text-slate-200 line-clamp-2">{event.title}</span>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] text-slate-500">{departmentLabel(event.department)}</span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[8px] font-bold ${statusStyle(event.status)}`}>{event.status}</span>
                    </div>
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <span className="block text-right text-[9px] text-slate-500 font-semibold">+ อีก {dayEvents.length - 4} รายการ</span>
                )}
                {dayEvents.length === 0 && (
                  <div className="pt-8 text-center text-[10px] text-slate-600">ไม่มีแผนงาน</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvent && permissions?.canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveEvent} className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0f1625] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-black uppercase ${sourceStyle(selectedEvent.source)}`}>
                  {SOURCE_LABELS[selectedEvent.source]}
                </span>
                <h3 className="mt-2 text-sm font-bold text-slate-100">แก้ไขแผนงาน</h3>
              </div>
              <button type="button" onClick={() => setSelectedEvent(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200" title="ปิด">
                <X size={16} />
              </button>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
              ชื่อแผนงาน
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                วันที่
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                เริ่ม
                <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                สิ้นสุด
                <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                สถานะ
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500">
                  {(selectedEvent.source === 'task' ? TASK_STATUSES : REQUEST_STATUSES).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              {selectedEvent.source === 'request' && (
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  แผนก
                  <select value={editDepartment} onChange={e => setEditDepartment(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs normal-case tracking-normal text-slate-200 outline-none focus:border-indigo-500">
                    {REQUEST_DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{departmentLabel(dept)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setSelectedEvent(null)} className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200">
                ยกเลิก
              </button>
              <button disabled={saving} type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
                <Save size={14} /> {saving ? 'กำลังบันทึก' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
