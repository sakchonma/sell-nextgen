import { createRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { wrapFormSubmit } from '../hooks/useSaveConfirm';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/change-password',
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    if (newPassword === currentPassword) {
      setError('รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านปัจจุบัน');
      return;
    }
    setSaving(true);
    changePassword(currentPassword, newPassword)
      .then(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('เปลี่ยนรหัสผ่านสำเร็จ');
      })
      .catch(err => setError(err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6 text-slate-100 text-left animate-fade-in max-w-xl">
      <div>
        <h2 className="text-xl font-bold font-display text-slate-100 flex items-center gap-2">
          <KeyRound className="text-indigo-400" /> เปลี่ยนรหัสผ่าน
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {user?.email} — ตั้งรหัสผ่านใหม่สำหรับบัญชีนี้
        </p>
      </div>

      <form onSubmit={wrapFormSubmit(handleSubmit)} className="p-6 rounded-2xl glass-panel space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">{success}</div>
        )}

        <label className="block">
          <span className="block text-xs text-slate-400 font-semibold mb-1">รหัสผ่านปัจจุบัน</span>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-slate-400 font-semibold mb-1">รหัสผ่านใหม่</span>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-slate-400 font-semibold mb-1">ยืนยันรหัสผ่านใหม่</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200"
          />
        </label>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร รวมตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข
        </p>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </form>
    </div>
  );
}
