import { createRoute } from '@tanstack/react-router';
import { Route as RootRoute } from './__root';
import { useEffect, useState } from 'react';
import { Users, ShieldAlert, Settings, PlusCircle, Edit, Trash2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>(defaultPermissions());

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
    };
    const method = editingUser ? 'PUT' : 'POST';
    const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
    try {
      await apiJson(url, data, { method });
      await fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
    } catch {
      alert('Operation failed');
    }
  };

  const handleUserDelete = async (id: string) => {
    if (!window.confirm('ยืนยันการลบผู้ใช้?')) return;
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      await fetchUsers();
    } catch {
      alert('Delete failed');
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
    } catch {
      alert('Operation failed');
    }
  };

  const handleRoleDelete = async (id: string) => {
    if (!window.confirm('ยืนยันการลบบทบาท?')) return;
    try {
      await apiFetch(`/api/roles/${id}`, { method: 'DELETE' });
      await fetchRoles();
    } catch {
      alert('Delete failed');
    }
  };

  const openRoleModal = (role: any = null) => {
    setEditingRole(role);
    setRolePermissions(defaultPermissions(role?.permissions));
    setShowRoleModal(true);
  };

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
                onClick={() => { setEditingUser(null); setShowUserModal(true); }}
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
                  <th className="px-4 py-2 text-xs text-slate-400">Rank</th>
                  <th className="px-4 py-2 text-xs text-slate-400">Role ID</th>
                  {isRoot && <th className="px-4 py-2 text-xs text-slate-400">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-sm text-slate-200">{u.name}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{u.email}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{u.rank}</td>
                    <td className="px-4 py-2 text-sm text-slate-200">{u.roleId}</td>
                    {isRoot && (
                      <td className="px-4 py-2 space-x-2">
                        <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="text-amber-400 hover:text-amber-300">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleUserDelete(u._id)} className="text-rose-400 hover:text-rose-300">
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
                        <button onClick={() => handleRoleDelete(r._id)} className="text-rose-400 hover:text-rose-300">
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
              <label className="block text-xs text-slate-400 mb-1">Role ID</label>
              <input name="roleId" defaultValue={editingUser?.roleId} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600">ยกเลิก</button>
              <button type="submit" className="px-4 py-1 text-sm bg-indigo-600 text-indigo-100 rounded hover:bg-indigo-500">บันทึก</button>
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
