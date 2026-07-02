import { createRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, User } from 'lucide-react';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/login',
  component: LoginComponent,
});

function LoginComponent() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate({ to: '/dashboard' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQuickSelect = (selEmail: string) => {
    setEmail(selEmail);
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-[#121826]/75 shadow-2xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h2 className="text-xl font-bold font-display text-slate-100">เข้าสู่ระบบ NEXTGEN</h2>
          <p className="text-xs text-slate-400 mt-1">กรอกข้อมูลหรือเลือกบัญชีทดลองเพื่อใช้งาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">อีเมลผู้ใช้</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exec@nextgen.co.th"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-800 bg-[#090d16] text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-600/35 transition-all cursor-pointer mt-2"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        {/* <div className="mt-8 border-t border-slate-800/80 pt-6">
          <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">
            บัญชีแนะนำในการทดสอบสิทธิ์
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'ผู้บริหาร (Exec)', email: 'exec@nextgen.co.th', password: '1234' },
              { label: 'ผู้จัดการ (Manager)', email: 'manager@nextgen.co.th', password: '1234' },
              { label: 'ฝ่ายขาย 1 (Sales)', email: 'sales1@nextgen.co.th', password: '1234' },
              { label: 'ฝ่ายสนับสนุน (Support)', email: 'central@nextgen.co.th', password: '1234' },
              { label: 'Root Admin', email: 'root@nextgen.co.th', password: 'S3cureRootPass!2026' }
            ].map(item => (
              <button
                key={item.email}
                onClick={() => {
                  setEmail(item.email);
                  setPassword(item.password);
                }}
                className="p-2 text-left rounded-lg border border-slate-800/60 bg-[#090d16]/40 hover:bg-slate-800/50 hover:border-slate-700 transition-all text-[11px]"
              >
                <span className="block font-semibold text-slate-300 truncate">{item.label}</span>
                <span className="block text-[9px] text-slate-500 truncate">{item.email}</span>
              </button>
            ))}
          </div>
        </div> */}
      </div>
    </div>
  );
}
