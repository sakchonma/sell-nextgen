import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { Percent, Save, Sliders, Trash2, UserPlus } from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/discount-settings',
  component: DiscountSettingsComponent,
});

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function DiscountSettingsComponent() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ roleLimits: [], individualLimits: [], history: [] });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserLimit, setSelectedUserLimit] = useState(10);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canManage = (user?.rank || 0) >= 4;

  const fetchData = () => {
    Promise.all([
      fetch('/api/roles', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }).then(res => res.json()),
      fetch('/api/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }).then(res => res.json()),
      fetch('/api/discount-settings', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }).then(res => res.json()),
    ])
      .then(([roleData, userData, discountData]) => {
        setRoles(Array.isArray(roleData) ? roleData : []);
        setUsers(Array.isArray(userData) ? userData : []);
        setSettings({
          roleLimits: discountData.roleLimits || [],
          individualLimits: discountData.individualLimits || [],
          history: discountData.history || [],
        });
      })
      .catch(err => {
        console.error('Failed to load discount settings:', err);
        setError('โหลดข้อมูลการตั้งค่าส่วนลดไม่สำเร็จ');
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const salesRoles = useMemo(() => roles.filter(role => role.rank >= 3), [roles]);
  const selectableUsers = useMemo(() => users.filter(u => u.rank >= 3), [users]);

  const getRoleLimit = (roleId: string) => {
    const found = settings.roleLimits.find((item: any) => item.roleId === roleId);
    return found?.maxDiscountPercent ?? 0;
  };

  const setRoleLimit = (roleId: string, value: number) => {
    setSettings((prev: any) => {
      const exists = prev.roleLimits.some((item: any) => item.roleId === roleId);
      const nextRoleLimits = exists
        ? prev.roleLimits.map((item: any) => item.roleId === roleId ? { ...item, maxDiscountPercent: value } : item)
        : [...prev.roleLimits, { roleId, maxDiscountPercent: value }];
      return { ...prev, roleLimits: nextRoleLimits };
    });
  };

  const addIndividualLimit = () => {
    if (!selectedUserId) return;
    setSettings((prev: any) => {
      const nextIndividualLimits = prev.individualLimits.some((item: any) => item.userId === selectedUserId)
        ? prev.individualLimits.map((item: any) => item.userId === selectedUserId ? { ...item, maxDiscountPercent: selectedUserLimit } : item)
        : [...prev.individualLimits, { userId: selectedUserId, maxDiscountPercent: selectedUserLimit }];
      return { ...prev, individualLimits: nextIndividualLimits };
    });
    setSelectedUserId('');
    setSelectedUserLimit(10);
  };

  const removeIndividualLimit = (userId: string) => {
    setSettings((prev: any) => ({
      ...prev,
      individualLimits: prev.individualLimits.filter((item: any) => item.userId !== userId),
    }));
  };

  const saveSettings = () => {
    if (!canManage) return;
    setMessage('');
    setError('');
    fetch('/api/discount-settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        roleLimits: settings.roleLimits,
        individualLimits: settings.individualLimits,
      }),
    })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'บันทึกการตั้งค่าไม่สำเร็จ');
        }
        return res.json();
      })
      .then(data => {
        setSettings(data);
        setMessage('บันทึกเกณฑ์ส่วนลดเรียบร้อยแล้ว');
      })
      .catch(err => setError(err.message));
  };

  const getUserName = (userId: string) => {
    const found = users.find(item => item._id === userId);
    return found ? `${found.name} (${found.email})` : userId;
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Sliders className="text-indigo-400" /> ตั้งค่าส่วนลด
          </h2>
          <p className="text-xs text-slate-400 mt-1">กำหนดเพดานส่วนลดตามบทบาทและรายบุคคลสำหรับ Quote Approval</p>
        </div>
        {canManage && (
          <button
            onClick={saveSettings}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white shadow-lg cursor-pointer transition-all"
          >
            <Save size={14} /> บันทึกการตั้งค่า
          </button>
        )}
      </div>

      {message && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{message}</div>}
      {error && <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-6">
        <div className="xl:col-span-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-xs text-indigo-200">
          Approval matrix: ส่วนลดที่เกินลิมิต Sales จะเข้า Manager approval และถ้าสูงกว่าลิมิต Manager จะต้องให้ Exec/Rank 5 อนุมัติเท่านั้น
          {user && user.rank < 5 && <span className="block mt-1 text-amber-200">บัญชี Manager/Finance แก้ได้เฉพาะ Sales role limit และ individual limit ของ Sales</span>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#121826]/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <Percent size={15} className="text-indigo-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ลิมิตตามบทบาท</h3>
          </div>
          <div className="divide-y divide-slate-800/80">
            {salesRoles.map(role => (
              <div key={role._id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-200">{role.name}</div>
                  <div className="text-[10px] text-slate-500">Rank {role.rank}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={getRoleLimit(role._id)}
                    onChange={e => setRoleLimit(role._id, Number(e.target.value))}
                    disabled={!canManage}
                    className="w-20 px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#121826]/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <UserPlus size={15} className="text-indigo-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ลิมิตรายบุคคล</h3>
          </div>

          {canManage && (
            <div className="p-4 border-b border-slate-800 grid grid-cols-1 md:grid-cols-[1fr_96px_auto] gap-3">
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-300 focus:outline-none"
              >
                <option value="">เลือกผู้ใช้</option>
                {selectableUsers.map(item => (
                  <option key={item._id} value={item._id}>{item.name} - {item.email}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={selectedUserLimit}
                onChange={e => setSelectedUserLimit(Number(e.target.value))}
                className="px-3 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-xs text-slate-200 text-right focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={addIndividualLimit}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                เพิ่ม
              </button>
            </div>
          )}

          <div className="divide-y divide-slate-800/80">
            {settings.individualLimits.map((limit: any) => (
              <div key={limit.userId} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-200">{getUserName(limit.userId)}</div>
                  <div className="text-[10px] text-slate-500">ลิมิตเฉพาะบุคคล</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-300">{limit.maxDiscountPercent}%</span>
                  {canManage && (
                    <button onClick={() => removeIndividualLimit(limit.userId)} className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20" title="ลบลิมิตรายบุคคล">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {settings.individualLimits.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">ยังไม่มีลิมิตรายบุคคล</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#121826]/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">ประวัติการเปลี่ยนแปลงล่าสุด</h3>
        </div>
        <div className="divide-y divide-slate-800/80">
          {(settings.history || []).slice(-5).reverse().map((item: any, index: number) => (
            <div key={`${item.changedAt}-${index}`} className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-300">{item.details}</span>
              <span className="text-[10px] text-slate-500">{item.changedBy} · {new Date(item.changedAt).toLocaleString('th-TH')}</span>
            </div>
          ))}
          {(settings.history || []).length === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs">ยังไม่มีประวัติการเปลี่ยนแปลง</div>
          )}
        </div>
      </div>
    </div>
  );
}
