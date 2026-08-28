import { createRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Route as RootRoute } from './__root';
import { useAuth } from '../hooks/useAuth';
import { QuotesIndexComponent } from './quotes.index';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/portal/quotes',
  component: PortalQuotesPage,
});

function PortalQuotesPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) navigate({ to: '/portal/login' });
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-xs">
        กำลังโหลด...
      </div>
    );
  }

  if ((user?.rank || 0) < 4) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-[#121826] text-center space-y-4">
          <p className="text-sm text-slate-200">บัญชีนี้ไม่มีสิทธิ์อนุมัติใบเสนอราคา ต้องเป็น Level 4 ขึ้นไป</p>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate({ to: '/portal/login' });
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] p-4 sm:p-8">
      <QuotesIndexComponent variant="portal" />
    </div>
  );
}
