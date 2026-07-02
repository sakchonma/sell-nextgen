import { createRootRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth, User } from '../hooks/useAuth';
import { apiFetch, apiJson, authHeaders } from '../lib/api';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Calendar, 
  FileText, 
  PlusCircle, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  UserSquare2, 
  MessageSquareCode, 
  FolderHeart,
  TrendingUp,
  Sliders,
  DollarSign,
  Bell,
  CheckCircle2,
  Users2,
  EyeOff,
  SlidersHorizontal,
  Archive
} from 'lucide-react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { user, isAuthenticated, isLoading, logout, swapUser, changePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canUseQuickSwapper = user?.email === 'root@nextgen.co.th' && !import.meta.env.PROD;
  const [showSwapper, setShowSwapper] = useState(false);
  const [swapperUsers, setSwapperUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifCategory, setNotifCategory] = useState('All');
  const [notifUnreadOnly, setNotifUnreadOnly] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<any>(null);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Load 14 test users for quick swap
  useEffect(() => {
    if (!canUseQuickSwapper) return;
    fetch('/api/users', { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setSwapperUsers(data))
      .catch(err => {
        console.error('Failed to load users for swapper:', err);
        // Fallback to standard mock users list if backend is not running yet
        setSwapperUsers([
          { _id: 'u1', name: 'ดร.วิชัย สุริยา', email: 'exec@nextgen.co.th', rank: 5, roleId: 'r_exec' },
          { _id: 'u2', name: 'พิชาภรณ์ วงศ์ศรี', email: 'assist@nextgen.co.th', rank: 4, roleId: 'r_asst' },
          { _id: 'u3', name: 'จิราพร มั่นคง', email: 'manager@nextgen.co.th', rank: 4, roleId: 'r_manager' },
          { _id: 'u4', name: 'ธนกร รุ่งเรือง', email: 'sales1@nextgen.co.th', rank: 3, zone: 'ภาคเหนือ', roleId: 'r_sales' },
          { _id: 'u5', name: 'นภัสสร ใจดี', email: 'sales2@nextgen.co.th', rank: 3, zone: 'ภาคตะวันออก', roleId: 'r_sales' },
          { _id: 'u6', name: 'กฤษฎา สุขใส', email: 'sales3@nextgen.co.th', rank: 3, zone: 'ภาคใต้', roleId: 'r_sales' },
          { _id: 'u7', name: 'อรอุมา พรมดี', email: 'sales4@nextgen.co.th', rank: 3, zone: 'ภาคตะวันตก', roleId: 'r_sales' },
          { _id: 'u8', name: 'ปิยะ ศรีทอง', email: 'sales5@nextgen.co.th', rank: 3, zone: 'ภาคอีสาน', roleId: 'r_sales' },
          { _id: 'u15', name: 'ศุภกิจ ใจกลาง', email: 'sales6@nextgen.co.th', rank: 3, zone: 'ภาคกลาง', roleId: 'r_sales' },
          { _id: 'u9', name: 'วรากร ดีงาม', email: 'central@nextgen.co.th', rank: 2, roleId: 'r_support' }
        ]);
      });
  }, [canUseQuickSwapper]);

  const loadNotifications = () => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams({ category: notifCategory, limit: '40' });
    if (notifUnreadOnly) params.set('unread', 'true');
    apiFetch<any>(`/api/notifications?${params.toString()}`)
      .then(data => setNotifications(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []))
      .catch(err => console.error('Failed to load notifications:', err));
  };

  useEffect(() => {
    loadNotifications();
    if (!isAuthenticated) return;
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, user?._id, notifCategory, notifUnreadOnly]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch('/api/notifications/preferences')
      .then(data => setNotifPrefs(data))
      .catch(() => undefined);
  }, [isAuthenticated, user?._id]);

  const handleSwap = (u: User) => {
    swapUser(u);
    setShowSwapper(false);
  };

  const hasAccess = (requiredRanks: number[]) => {
    if (!user) return false;
    // Root (rank 5) has full access to all menus
    if (user.rank === 5) return true;
    return requiredRanks.includes(user.rank);
  };

  const getRoleName = (u: User) => {
    if (u.rank === 5) return 'ผู้บริหาร (Exec)';
    if (u.rank === 4 && u.email.includes('assist')) return 'ผู้ช่วยผู้บริหาร (Asst)';
    if (u.rank === 4) return 'Sales Manager';
    if (u.rank === 3) return `Sales (${u.zone || ''})`;
    if (u.rank === 2) {
      if (u.email.includes('central')) return 'Admin Support';
      if (u.email.includes('finance')) return 'Finance';
      if (u.email.includes('academic')) return 'วิชาการ';
      if (u.email.includes('prod')) return 'Production';
    }
    return 'Staff';
  };

  const getRoleColor = (rank: number) => {
    if (rank === 5) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (rank === 4) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (rank === 3) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#090d16] text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-widest text-slate-400 animate-pulse font-medium">
            กำลังโหลด NEXTGEN...
          </p>
        </div>
      </div>
    );
  }

  const isPublicPage = ['/login'].includes(location.pathname);

  if (isPublicPage) {
    return <Outlet />;
  }
  if (!isAuthenticated) {
    // Redirect unauthenticated users to login page
    navigate({ to: '/login' });
    return null;
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const requestUnreadCount = notifications.filter(n => !n.isRead && String(n.type).startsWith('Request')).length;
  const quoteUnreadCount = notifications.filter(n => !n.isRead && String(n.type).startsWith('Quote')).length;

  const markAllNotificationsRead = () => {
    apiJson('/api/notifications/read-all', {}, { method: 'PUT' })
      .then(() => setNotifications(prev => prev.map(item => ({ ...item, isRead: true }))))
      .catch(err => console.error('Failed to mark notifications read:', err));
  };

  const markNotificationUnread = (notif: any, e: React.MouseEvent) => {
    e.stopPropagation();
    apiJson(`/api/notifications/${notif._id}/unread`, {}, { method: 'PUT' })
      .then(() => setNotifications(prev => prev.map(item => item._id === notif._id ? { ...item, isRead: false } : item)))
      .catch(err => console.error('Failed to mark notification unread:', err));
  };

  const cleanupNotifications = () => {
    apiJson('/api/notifications/cleanup', {}, { method: 'PUT' })
      .then(() => loadNotifications())
      .catch(err => console.error('Failed to cleanup notifications:', err));
  };

  const saveNotificationPreferences = (nextPrefs: any) => {
    setNotifPrefs(nextPrefs);
    apiJson('/api/notifications/preferences', nextPrefs, { method: 'PUT' }).catch(err => console.error('Failed to save notification prefs:', err));
  };

  const openNotification = (notif: any) => {
    apiJson(`/api/notifications/${notif._id}/read`, {}, { method: 'PUT' }).catch(() => undefined);
    setNotifications(prev => prev.map(item => item._id === notif._id ? { ...item, isRead: true } : item));
    setShowNotif(false);
    if (notif.targetUrl) navigate({ to: notif.targetUrl as any });
  };

  const handleForcedPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    changePassword(currentPassword, newPassword)
      .then(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      })
      .catch((err) => setPasswordChangeError(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#090d16] text-slate-100 overflow-x-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-full lg:w-64 glass-panel border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between shrink-0 lg:h-screen sticky top-0 z-50">
        <div>
          {/* Logo / Header */}
          <div className="p-4 lg:p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
                NG
              </div>
              <div>
                <span className="font-semibold text-sm tracking-wider text-slate-200">NEXTGEN</span>
                <span className="block text-[10px] text-slate-400 uppercase tracking-widest">Sale & Support</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-800 border border-slate-700 text-slate-400">v2.0</span>
          </div>

          {/* Sidebar Links */}
          <nav className="p-3 lg:p-4 flex gap-2 overflow-x-auto lg:block lg:space-y-1.5 lg:overflow-y-auto lg:max-h-[calc(100vh-170px)]">
            <Link 
              to="/dashboard"
              activeProps={{ className: 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500' }}
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <LayoutDashboard size={18} />
              <span>แผงควบคุม (Dashboard)</span>
            </Link>

            {/* Menu options based on role */}
            <Link 
              to="/leads" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <Users size={18} />
              <span>Leads & โรงเรียน</span>
            </Link>

            <Link 
              to="/pipeline" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <TrendingUp size={18} />
              <span>Opportunity Pipeline</span>
            </Link>

            <Link 
              to="/tasks" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <CheckCircle2 size={18} />
              <span>งาน & นัดหมาย</span>
            </Link>

            <Link 
              to="/calendar" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <Calendar size={18} />
              <span>ปฏิทินกลาง</span>
            </Link>

            {hasAccess([2, 4, 5]) && (
              <Link 
                to="/admin-calendar" 
                className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
              >
                <Calendar size={18} />
                <span>Admin Calendar</span>
              </Link>
            )}

            {hasAccess([3, 4, 5]) && (
              <Link 
                to="/ai-logger" 
                className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
              >
                <MessageSquareCode size={18} />
                <span>AI บันทึกด้วยการคุย</span>
              </Link>
            )}

            {hasAccess([4, 5]) && (
              <Link 
                to="/team-overview" 
                className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
              >
                <Users2 size={18} />
                <span>ภาพรวมทีม</span>
              </Link>
            )}

            <Link 
              to="/reports" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <FileText size={18} />
              <span>รายงานกิจกรรม</span>
            </Link>

            {hasAccess([4, 5]) && (
              <>
                <div className="hidden lg:block pt-4 pb-1 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">จัดการระบบ</div>
                <Link 
                  to="/products" 
                  className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
                >
                  <Briefcase size={18} />
                  <span>สินค้า & ราคา</span>
                </Link>
                <Link 
                  to="/discount-settings" 
                  className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
                >
                  <Sliders size={18} />
                  <span>ตั้งค่าส่วนลด</span>
                </Link>
              </>
            )}

            {hasAccess([4, 5]) && (
                <Link 
                  to="/admin" 
                  className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
                >
                  <Settings size={18} />
                  <span>จัดการ Users & Roles</span>
                </Link>
            )}

            <div className="hidden lg:block pt-4 pb-1 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">ธุรกรรม & คำขอ</div>
            <Link 
              to="/quotes" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <DollarSign size={18} />
              <span>ใบเสนอราคา</span>
              {quoteUnreadCount > 0 && <span className="ml-auto min-w-5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold text-center">{quoteUnreadCount}</span>}
            </Link>
            <Link 
              to="/requests" 
              className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 rounded-lg text-sm transition-all shrink-0"
            >
              <FolderHeart size={18} />
              <span>ระบบคำขอ (Requests)</span>
              {requestUnreadCount > 0 && <span className="ml-auto min-w-5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold text-center">{requestUnreadCount}</span>}
            </Link>
          </nav>
        </div>

        {/* User Swapper Footer */}
        <div className="hidden lg:block p-4 border-t border-slate-800 bg-slate-900/40">
          {user && (
            <div className="flex items-center justify-between gap-3">
              <button 
                onClick={() => canUseQuickSwapper && setShowSwapper(true)}
                className={`w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold transition-all relative group ${canUseQuickSwapper ? 'hover:scale-105 hover:border-indigo-400 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                title={canUseQuickSwapper ? 'คลิกเพื่อสลับผู้ใช้ด่วน' : user.email}
              >
                {user.name.charAt(0)}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#090d16] rounded-full"></div>
              </button>
              
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-slate-200 truncate">{user.name}</span>
                <span className="block text-[10px] text-slate-400 truncate">{user.email}</span>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] border font-medium mt-1 ${getRoleColor(user.rank)}`}>
                  {getRoleName(user)}
                </span>
              </div>

              <button 
                onClick={logout}
                className="text-slate-500 hover:text-red-400 p-1 rounded-lg transition-all"
                title="ออกจากระบบ"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* HEADER / NAVBAR */}
        <header className="h-auto min-h-16 border-b border-slate-800 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3 bg-slate-900/30 sticky top-0 backdrop-blur-md z-40">
          <div className="flex items-center gap-4">
            <h1 className="font-display font-medium text-base sm:text-lg text-slate-200">
              {location.pathname === '/dashboard' ? 'แดชบอร์ดภาพรวม' : 'ยินดีต้อนรับสู่ระบบบริหารงานขาย'}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* User details badge */}
            {user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[11px] font-medium text-slate-300">
                  สิทธิ์ปัจจุบัน: <span className="text-slate-100">{getRoleName(user)}</span>
                </span>
              </div>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotif(!showNotif)}
                className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotif && (
                <div className="absolute right-0 mt-2 w-80 glass-panel border border-slate-800 rounded-xl shadow-2xl z-50 p-4 animate-scale-up">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="text-xs font-semibold text-slate-200">การแจ้งเตือน</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowNotifPrefs(!showNotifPrefs)} className="text-slate-500 hover:text-slate-200" title="ตั้งค่าแจ้งเตือน">
                        <SlidersHorizontal size={14} />
                      </button>
                      <button onClick={cleanupNotifications} className="text-slate-500 hover:text-slate-200" title="Archive เก่ากว่า 90 วัน">
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        อ่านทั้งหมดแล้ว
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <select value={notifCategory} onChange={e => setNotifCategory(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-slate-800 bg-[#090d16] text-[10px] text-slate-300 outline-none">
                      <option value="All">ทุกหมวด</option>
                      <option value="Request">Request</option>
                      <option value="Quote">Quote</option>
                      <option value="Task">Task</option>
                      <option value="Calendar">Calendar</option>
                      <option value="System">System</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-slate-400">
                      <input type="checkbox" checked={notifUnreadOnly} onChange={e => setNotifUnreadOnly(e.target.checked)} className="accent-indigo-500" />
                      ยังไม่อ่าน
                    </label>
                  </div>
                  {showNotifPrefs && notifPrefs && (
                    <div className="mb-3 p-3 rounded-lg border border-slate-800 bg-[#090d16]/60 space-y-2">
                      {['Request', 'Quote', 'Task', 'Calendar', 'System'].map(category => (
                        <label key={category} className="flex items-center justify-between text-[10px] text-slate-300">
                          <span>{category}</span>
                          <input
                            type="checkbox"
                            checked={notifPrefs.categories?.[category] !== false}
                            onChange={e => saveNotificationPreferences({
                              ...notifPrefs,
                              categories: { ...(notifPrefs.categories || {}), [category]: e.target.checked }
                            })}
                            className="accent-indigo-500"
                          />
                        </label>
                      ))}
                      <label className="flex items-center justify-between text-[10px] text-slate-300 border-t border-slate-800 pt-2">
                        <span>Digest only</span>
                        <input type="checkbox" checked={Boolean(notifPrefs.digestOnly)} onChange={e => saveNotificationPreferences({ ...notifPrefs, digestOnly: e.target.checked })} className="accent-indigo-500" />
                      </label>
                    </div>
                  )}
                  <div className="space-y-3">
                    {notifications.map(notif => (
                      <button key={notif._id} onClick={() => openNotification(notif)} className={`w-full p-2.5 rounded-lg border text-left transition-all ${notif.isRead ? 'bg-transparent border-transparent' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-semibold text-slate-200">{notif.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={(e) => markNotificationUnread(notif, e)} className="text-slate-600 hover:text-indigo-300" title="ทำเครื่องหมายว่ายังไม่อ่าน">
                              <EyeOff size={12} />
                            </button>
                            <span className="text-[9px] text-slate-500">{new Date(notif.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{notif.message}</p>
                        <span className="inline-block mt-2 px-1.5 py-0.5 rounded border border-slate-800 text-[9px] text-slate-500">{notif.category || notif.type}</span>
                      </button>
                    ))}
                    {notifications.length === 0 && (
                      <div className="py-8 text-center text-[11px] text-slate-500">ยังไม่มีการแจ้งเตือน</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 min-w-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* QUICK USER SWAPPER MODAL */}
      {user?.forcePasswordChange && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <form onSubmit={handleForcedPasswordChange} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">ตั้งรหัสผ่านใหม่</h3>
              <p className="text-xs text-slate-400 mt-1">บัญชีนี้ยังใช้รหัสผ่านเริ่มต้น กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานต่อ</p>
            </div>
            {passwordChangeError && (
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-300">
                {passwordChangeError}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">รหัสผ่านปัจจุบัน</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">รหัสผ่านใหม่</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200" />
            </div>
            <button type="submit" className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500">
              บันทึกรหัสผ่านใหม่
            </button>
          </form>
        </div>
      )}

      {canUseQuickSwapper && showSwapper && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <UserSquare2 className="text-indigo-400" />
                  สลับผู้ใช้งานจำลอง (Quick Account Swapper)
                </h3>
                <p className="text-xs text-slate-400 mt-1">ทดสอบเปลี่ยนมุมมองสิทธิ์ในการแสดงผลของ Sidebar และ Dashboard ได้ทันที</p>
              </div>
              <button 
                onClick={() => setShowSwapper(false)}
                className="text-xs text-slate-500 hover:text-slate-300 font-medium cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Grouped by Rank */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Executive & Management</h4>
                  <div className="space-y-2">
                    {swapperUsers.filter(u => u.rank >= 4).map(u => (
                      <button
                        key={u._id}
                        onClick={() => handleSwap(u)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between hover:bg-slate-800 hover:border-slate-700 transition-all group ${user?._id === u._id ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900'}`}
                      >
                        <div>
                          <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">{u.name}</span>
                          <span className="block text-[10px] text-slate-500">{u.email}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${getRoleColor(u.rank)}`}>
                          {getRoleName(u)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Sales & Support Staff</h4>
                  <div className="space-y-2">
                    {swapperUsers.filter(u => u.rank < 4).map(u => (
                      <button
                        key={u._id}
                        onClick={() => handleSwap(u)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between hover:bg-slate-800 hover:border-slate-700 transition-all group ${user?._id === u._id ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900'}`}
                      >
                        <div>
                          <span className="block text-xs font-semibold text-slate-200 group-hover:text-white">{u.name}</span>
                          <span className="block text-[10px] text-slate-500">{u.email}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${getRoleColor(u.rank)}`}>
                          {getRoleName(u)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
