import { createRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/portal/login',
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated && (user?.rank || 0) >= 4) {
    navigate({ to: '/portal/quotes' });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const signedIn = await login(email, password);
      if ((signedIn.rank || 0) < 4) {
        logout();
        setError('บัญชีนี้ต้องเป็น Level 4 ขึ้นไปเพื่ออนุมัติใบเสนอราคา');
        return;
      }
      navigate({ to: '/portal/quotes' });
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-[#121826]/75 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h2 className="text-xl font-bold font-display text-slate-100">อนุมัติใบเสนอราคา</h2>
          <p className="text-xs text-slate-400 mt-1">เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน (Level 4)</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>
          )}
          <label className="block">
            <span className="block text-xs text-slate-400 font-semibold mb-1">อีเมล</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-slate-400 font-semibold mb-1">รหัสผ่าน</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </label>
          <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
