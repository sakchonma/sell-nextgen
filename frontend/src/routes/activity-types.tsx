import { createRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { invalidateActivityTypesCache, useActivityTypes } from '../hooks/useActivityTypes';
import { apiFetch } from '../lib/api';
import { ListTree, Plus, Save, Trash2 } from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/activity-types',
  component: ActivityTypesPage,
});

const SCOPE_OPTIONS = [
  { value: 'task', label: 'งาน/นัดหมาย (Tasks)' },
  { value: 'log', label: 'บันทึกกิจกรรม (Activity Log)' },
  { value: 'note', label: 'บันทึกโรงเรียน (Lead Notes)' },
] as const;

const emptyForm = {
  code: '',
  label: '',
  labelTh: '',
  scopes: ['task'] as Array<'task' | 'log' | 'note'>,
  sortOrder: 50,
  allowCustomLabel: false,
};

function ActivityTypesPage() {
  const { user } = useAuth();
  const { types, loading, error, reload } = useActivityTypes(undefined, true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', labelTh: '', scopes: ['task'] as Array<'task' | 'log' | 'note'>, sortOrder: 50, isActive: true, allowCustomLabel: false });
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

  const canManage = (user?.rank || 0) >= 4;
  const sortedTypes = useMemo(
    () => [...types].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'th')),
    [types]
  );

  const toggleScope = (scopes: Array<'task' | 'log' | 'note'>, scope: 'task' | 'log' | 'note', checked: boolean) => {
    if (checked) return Array.from(new Set([...scopes, scope]));
    return scopes.filter(item => item !== scope);
  };

  const createType = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setMessage('');
    try {
      await apiFetch('/api/activity-types', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      invalidateActivityTypesCache();
      await reload();
      setForm(emptyForm);
      setMessage('เพิ่มประเภทกิจกรรมแล้ว');
    } catch (err: any) {
      setFormError(err?.message || 'เพิ่มประเภทไม่สำเร็จ');
    }
  };

  const startEdit = (row: typeof types[number]) => {
    setEditingId(row._id);
    setEditForm({
      label: row.label,
      labelTh: row.labelTh || row.label,
      scopes: [...row.scopes],
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      allowCustomLabel: Boolean(row.allowCustomLabel),
    });
  };

  const saveEdit = async (id: string) => {
    setFormError('');
    setMessage('');
    try {
      await apiFetch(`/api/activity-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      invalidateActivityTypesCache();
      await reload();
      setEditingId(null);
      setMessage('บันทึกการแก้ไขแล้ว');
    } catch (err: any) {
      setFormError(err?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const deactivateType = async (id: string, isSystem: boolean) => {
    if (!window.confirm(isSystem ? 'ปิดใช้งานประเภทระบบนี้?' : 'ลบประเภทกิจกรรมนี้?')) return;
    setFormError('');
    setMessage('');
    try {
      await apiFetch(`/api/activity-types/${id}`, { method: 'DELETE' });
      invalidateActivityTypesCache();
      await reload();
      setMessage(isSystem ? 'ปิดใช้งานแล้ว' : 'ลบแล้ว');
    } catch (err: any) {
      setFormError(err?.message || 'ลบไม่สำเร็จ');
    }
  };

  if (!canManage) {
    return (
      <div className="p-6 text-slate-400">
        คุณไม่มีสิทธิ์จัดการประเภทกิจกรรม
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ListTree size={24} className="text-emerald-400" />
          ประเภทกิจกรรม
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          กำหนดประเภทที่ใช้ในงาน นัดหมาย บันทึกกิจกรรม และโน้ตโรงเรียน
        </p>
      </div>

      {message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{message}</div>}
      {(error || formError) && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{formError || error}</div>}

      <form onSubmit={createType} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Plus size={16} /> เพิ่มประเภทใหม่</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-slate-400">
            รหัส (ภาษาอังกฤษ)
            <input
              value={form.code}
              onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
              placeholder="SiteVisit"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            ลำดับ
            <input
              type="number"
              value={form.sortOrder}
              onChange={e => setForm(prev => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            ชื่อ (EN)
            <input
              value={form.label}
              onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </label>
          <label className="space-y-1 text-xs text-slate-400">
            ชื่อ (TH)
            <input
              value={form.labelTh}
              onChange={e => setForm(prev => ({ ...prev, labelTh: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          {SCOPE_OPTIONS.map(scope => (
            <label key={scope.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.scopes.includes(scope.value)}
                onChange={e => setForm(prev => ({ ...prev, scopes: toggleScope(prev.scopes, scope.value, e.target.checked) }))}
                className="accent-emerald-500"
              />
              {scope.label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.allowCustomLabel}
              onChange={e => setForm(prev => ({ ...prev, allowCustomLabel: e.target.checked }))}
              className="accent-emerald-500"
            />
            อนุญาตพิมพ์ชื่อเอง
          </label>
        </div>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
          <Plus size={16} /> เพิ่มประเภท
        </button>
      </form>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">รหัส</th>
              <th className="text-left px-4 py-3">ชื่อ</th>
              <th className="text-left px-4 py-3">ใช้ใน</th>
              <th className="text-left px-4 py-3">สถานะ</th>
              <th className="text-right px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">กำลังโหลด...</td></tr>
            )}
            {!loading && sortedTypes.map(row => (
              <tr key={row._id} className="border-t border-slate-800/80">
                <td className="px-4 py-3 font-mono text-emerald-300">{row.code}</td>
                <td className="px-4 py-3">
                  {editingId === row._id ? (
                    <div className="space-y-2">
                      <input value={editForm.label} onChange={e => setEditForm(prev => ({ ...prev, label: e.target.value }))} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white" />
                      <input value={editForm.labelTh} onChange={e => setEditForm(prev => ({ ...prev, labelTh: e.target.value }))} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white" placeholder="ชื่อไทย" />
                    </div>
                  ) : (
                    <div>
                      <div className="text-white">{row.labelTh || row.label}</div>
                      <div className="text-xs text-slate-500">{row.label}</div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === row._id ? (
                    <div className="flex flex-col gap-1">
                      {SCOPE_OPTIONS.map(scope => (
                        <label key={scope.value} className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={editForm.scopes.includes(scope.value)}
                            onChange={e => setEditForm(prev => ({ ...prev, scopes: toggleScope(prev.scopes, scope.value, e.target.checked) }))}
                            className="accent-emerald-500"
                          />
                          {scope.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.scopes.map(scope => (
                        <span key={scope} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{scope}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === row._id ? (
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))} className="accent-emerald-500" />
                      เปิดใช้งาน
                    </label>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded ${row.isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                      {row.isActive ? 'Active' : 'Inactive'}
                      {row.isSystem ? ' · System' : ''}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {editingId === row._id ? (
                      <button type="button" onClick={() => saveEdit(row._id)} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                        <Save size={14} /> บันทึก
                      </button>
                    ) : (
                      <button type="button" onClick={() => startEdit(row)} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                        แก้ไข
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deactivateType(row._id, row.isSystem)}
                      className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} /> {row.isSystem ? 'ปิด' : 'ลบ'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
