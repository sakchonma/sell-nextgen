import { createRoute } from '@tanstack/react-router';
import { Route as RootRoute } from './__root';
import { Fragment, useEffect, useState } from 'react';
import { Users, ShieldAlert, Settings, PlusCircle, Edit, Trash2, KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, apiJson } from '../lib/api';

const PERMISSION_LABELS: Record<string, string> = {
  viewDashboard: 'Dashboard',
  manageLeads: 'Leads',
  managePipeline: 'Pipeline',
  manageTasks: 'Tasks',
  useAIChat: 'AI',
  viewTeamOverview: 'Team Overview',
  manageProducts: 'Products',
  manageDiscounts: 'Discounts',
  manageUsersAndRoles: 'Users & Roles',
  editAdminCalendar: 'Admin Calendar',
  manageQuotes: 'Quotes',
  approveRequests: 'Request Approval'
};

function defaultPermissions(seed: any = {}) {
  return Object.keys(PERMISSION_LABELS).reduce((acc, key) => ({
    ...acc,
    [key]: Boolean(seed?.[key])
  }), {});
}

// Simple modal component
function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg glass-panel">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminComponent() {
  const { user } = useAuth();
  const isRoot = user?.rank === 5;
  const canManagePasswords = user?.email === 'root@nextgen.co.th';
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [passwordError, setPasswordError] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>(defaultPermissions());
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const fetchUsers = async () => {
    setUsers(await apiFetch('/api/users').catch(() => []));
  };
  const fetchRoles = async () => {
    setRoles(await apiFetch('/api/roles').catch(() => []));
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  // ----- User CRUD -----
  const handleUserSubmit = async (e: any) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value,
      email: form.email.value,
      rank: Number(form.rank.value),
      roleId: form.roleId.value,
      status: form.status.value,
      ...(canManagePasswords && !editingUser && form.password?.value ? { password: form.password.value } : {}),
    };
    const method = editingUser ? 'PUT' : 'POST';
    const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
    try {
      await apiJson(url, data, { method });
      await fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleUserDelete = async (id: string) => {
    if (!window.confirm('ยืนยันการลบผู้ใช้?')) return;
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handlePasswordSubmit = async (e: any) => {
    e.preventDefault();
    if (!passwordUser) return;
    const form = e.target;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    setPasswordError('');
    if (password !== confirmPassword) {
      setPasswordError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    try {
      await apiJson(`/api/users/${passwordUser._id}/password`, { password }, { method: 'PUT' });
      setPasswordUser(null);
      await fetchUsers();
    } catch (err: any) {
      setPasswordError(err.message || 'แก้ไขรหัสผ่านไม่สำเร็จ');
    }
  };

  // ----- Role CRUD -----
  const handleRoleSubmit = async (e: any) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      name: form.name.value,
      rank: Number(form.rank.value),
      color: form.color.value,
      permissions: rolePermissions,
    };
    const method = editingRole ? 'PUT' : 'POST';
    const url = editingRole ? `/api/roles/${editingRole._id}` : '/api/roles';
    try {
      await apiJson(url, data, { method });
      await fetchRoles();
      setShowRoleModal(false);
      setEditingRole(null);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleRoleDelete = async (id: string) => {
    if (!window.confirm('ยืนยันการลบบทบาท?')) return;
    try {
      await apiFetch(`/api/roles/${id}`, { method: 'DELETE' });
      await fetchRoles();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const openRoleModal = (role: any = null) => {
    setEditingRole(role);
    setRolePermissions(defaultPermissions(role?.permissions));
    setShowRoleModal(true);
  };

  const openUserModal = (targetUser: any = null) => {
    setEditingUser(targetUser);
    setSelectedRoleId(targetUser?.roleId || roles[0]?._id || '');
    setShowUserModal(true);
  };

  const roleById = (roleId: string) => roles.find(role => role._id === roleId);
  const userNameById = (userId?: string) => users.find(item => item._id === userId)?.name || '-';
  const dateLabel = (value?: string) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const selectedRole = roleById(selectedRoleId || editingUser?.roleId);
  const groupedUsers = users.reduce((acc: Record<string, any[]>, item) => {
    const role = roleById(item.roleId);
    const key = `Rank ${item.rank} · ${role?.name || item.roleId || 'No role'}`;
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {});

  return (
    <div className="p-8 animate-fade-in space-y-8">
      {/* Tab selector */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-t ${activeTab === 'users' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Users size={18} className="inline mr-2" /> Users
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-t ${activeTab === 'roles' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <ShieldAlert size={18} className="inline mr-2" /> Roles
        </button>
      </div>

      {activeTab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-200">จัดการ Users</h3>
            {isRoot && (
              <button
                onClick={() => openUserModal(null)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded hover:bg-indigo-600/30"
              >
                <PlusCircle size={16} /> เพิ่มผู้ใช้
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-slate-900/50 rounded-xl border border-slate-800">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2 text-xs text-slate-400">Name</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Email</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Role</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Status</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Last Login</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Password Changed</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Updated By</th>
                  {isRoot && <th className="px-4 py-2 text-xs text-slate-400">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedUsers).map(([groupName, groupUsers]) => (
                  <Fragment key={groupName}>
                    <tr key={groupName} className="border-t border-slate-800 bg-slate-950/60">
                      <td colSpan={isRoot ? 8 : 7} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                        {groupName} ({groupUsers.length})
                      </td>
                    </tr>
                    {groupUsers.map(u => {
                      const role = roleById(u.roleId);
                      return (
                        <tr key={u._id} className="border-t border-slate-800 hover:bg-slate-800/30">
                          <td className="px-4 py-2 text-sm text-slate-200">{u.name}</td>
                          <td className="px-4 py-2 text-sm text-slate-200">{u.email}</td>
                          <td className="px-4 py-2 text-sm text-slate-200">{role?.name || u.roleId}</td>
                          <td className="px-4 py-2 text-sm text-slate-200">{u.status || 'active'}</td>
                          <td className="px-4 py-2 text-xs text-slate-400">{dateLabel(u.lastLoginAt)}</td>
                          <td className="px-4 py-2 text-xs text-slate-400">{dateLabel(u.passwordChangedAt)}</td>
                          <td className="px-4 py-2 text-xs text-slate-400">{userNameById(u.updatedBy)}</td>
                          {isRoot && (
                            <td className="px-4 py-2 space-x-2">
                              <button onClick={() => openUserModal(u)} className="text-amber-400 hover:text-amber-300">
                                <Edit size={16} />
                              </button>
                              {canManagePasswords && (
                                <button onClick={() => { setPasswordUser(u); setPasswordError(''); }} className="text-indigo-400 hover:text-indigo-300" title="แก้ไขรหัสผ่าน">
                                  <KeyRound size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleUserDelete(u._id)}
                                disabled={u._id === user?._id}
                                className="text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                title={u._id === user?._id ? 'ไม่สามารถลบตัวเองได้' : 'ลบผู้ใช้'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-200">จัดการ Roles</h3>
            {isRoot && (
              <button
                onClick={() => openRoleModal(null)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded hover:bg-indigo-600/30"
              >
                <PlusCircle size={16} /> เพิ่มบทบาท
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-slate-900/50 rounded-xl border border-slate-800">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2 text-xs text-slate-400">Name</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Rank</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Color</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Permissions</th>
                  {isRoot && <th className="px-4 py-2 text-xs text-slate-400">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r._id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-sm text-slate-200">{r.name}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{r.rank}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{r.color}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">
                      <div className="flex flex-wrap gap-1 max-w-lg">
                        {Object.entries(r.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => (
                          <span key={key} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
                            {PERMISSION_LABELS[key] || key}
                          </span>
                        ))}
                      </div>
                    </td>
                    {isRoot && (
                      <td className="px-4 py-2 space-x-2">
                        <button onClick={() => openRoleModal(r)} className="text-amber-400 hover:text-amber-300">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleRoleDelete(r._id)}
                          disabled={r.isSystemRole || users.some(item => item.roleId === r._id)}
                          className="text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={r.isSystemRole ? 'ไม่สามารถลบบทบาทระบบได้' : users.some(item => item.roleId === r._id) ? 'ยังมีผู้ใช้งานบทบาทนี้' : 'ลบบทบาท'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <Modal title={editingUser ? 'แก้ไขผู้ใช้' : 'สร้างผู้ใช้'} onClose={() => setShowUserModal(false)}>
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อ</label>
              <input name="name" defaultValue={editingUser?.name} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">อีเมล</label>
              <input name="email" type="email" defaultValue={editingUser?.email} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rank (1‑5)</label>
              <input name="rank" type="number" min="1" max="5" defaultValue={editingUser?.rank} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role</label>
              <select
                name="roleId"
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
              >
                {roles.map(role => (
                  <option key={role._id} value={role._id}>{role.name} · Rank {role.rank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">สถานะผู้ใช้</label>
              <select name="status" defaultValue={editingUser?.status || 'active'} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Permission Preview</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(selectedRole?.permissions || {}).filter(([, enabled]) => enabled).map(([key]) => (
                  <span key={key} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
                    {PERMISSION_LABELS[key] || key}
                  </span>
                ))}
                {!selectedRole && <span className="text-xs text-slate-500">เลือก role เพื่อดูสิทธิ์ที่จะได้รับ</span>}
                {selectedRole && Object.values(selectedRole.permissions || {}).every(enabled => !enabled) && <span className="text-xs text-slate-500">Role นี้ยังไม่มี permission</span>}
              </div>
            </div>
            {canManagePasswords && !editingUser && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">รหัสผ่านเริ่มต้น</label>
                <input name="password" type="password" minLength={8} placeholder="เว้นว่างเพื่อสร้างรหัสเริ่มต้นและบังคับเปลี่ยน" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
                <p className="mt-1 text-[10px] text-slate-500">รหัสที่กำหนดเองต้องมีอย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข</p>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600">ยกเลิก</button>
              <button type="submit" className="px-4 py-1 text-sm bg-indigo-600 text-indigo-100 rounded hover:bg-indigo-500">บันทึก</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Password Modal */}
      {passwordUser && canManagePasswords && (
        <Modal title={`แก้ไขรหัสผ่าน: ${passwordUser.name}`} onClose={() => setPasswordUser(null)}>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-xs text-indigo-200">
              การแก้ไขรหัสผ่านทำได้เฉพาะบัญชี root@nextgen.co.th เท่านั้น
            </div>
            {passwordError && (
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs text-rose-300">
                {passwordError}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">รหัสผ่านใหม่</label>
              <input name="password" type="password" minLength={8} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input name="confirmPassword" type="password" minLength={8} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setPasswordUser(null)} className="px-4 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600">ยกเลิก</button>
              <button type="submit" className="px-4 py-1 text-sm bg-indigo-600 text-indigo-100 rounded hover:bg-indigo-500">บันทึกรหัสผ่าน</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <Modal title={editingRole ? 'แก้ไขบทบาท' : 'สร้างบทบาท'} onClose={() => setShowRoleModal(false)}>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">ชื่อบทบาท</label>
              <input name="name" defaultValue={editingRole?.name} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rank (1‑5)</label>
              <input name="rank" type="number" min="1" max="5" defaultValue={editingRole?.rank} required className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Color (hex or css class)</label>
              <input name="color" defaultValue={editingRole?.color} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 rounded-xl border border-slate-800 bg-slate-950/40">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(rolePermissions[key])}
                      onChange={(e) => setRolePermissions(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-slate-700 text-indigo-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Preview ก่อนบันทึก</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(rolePermissions).filter(([, enabled]) => enabled).map(([key]) => (
                  <span key={key} className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300">
                    {PERMISSION_LABELS[key] || key}
                  </span>
                ))}
                {Object.values(rolePermissions).every(enabled => !enabled) && <span className="text-xs text-slate-500">ยังไม่ได้เปิด permission ใด</span>}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600">ยกเลิก</button>
              <button type="submit" className="px-4 py-1 text-sm bg-indigo-600 text-indigo-100 rounded hover:bg-indigo-500">บันทึก</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/admin',
  component: AdminComponent,
});
