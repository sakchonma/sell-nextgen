import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate({ to: '/dashboard' });
      } else {
        navigate({ to: '/login' });
      }
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#090d16] text-slate-400 font-bold">
      Redirecting to dashboard...
    </div>
  );
}
