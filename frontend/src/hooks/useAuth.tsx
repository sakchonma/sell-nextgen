import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authHeaders, clearStoredAuth, decodeJwtPayload, isTokenExpired } from '../lib/api';

export interface User {
  _id: string;
  name: string;
  email: string;
  rank: number;
  zone?: string;
  roleId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  swapUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }
    const { token, user } = await res.json();
    if (isTokenExpired(token, 0)) {
      throw new Error('Session token is invalid');
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const swapUser = useCallback(async (user: User) => {
    const res = await fetch('/api/auth/swap', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ targetUserId: user._id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Swap failed');
    }
    const { token, user: newUser } = await res.json();
    if (isTokenExpired(token, 0)) {
      throw new Error('Session token is invalid');
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(newUser));
    setState({ user: newUser, isAuthenticated: true, isLoading: false });
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (savedUser && token && !isTokenExpired(token)) {
      setState({
        user: JSON.parse(savedUser),
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      clearStoredAuth();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated) return;
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
      logout();
      return;
    }

    const payload = decodeJwtPayload(token);
    const msUntilExpiry = Math.max((payload.exp * 1000) - Date.now(), 0);
    const timer = window.setTimeout(logout, msUntilExpiry);
    const verifyOnFocus = () => {
      const latestToken = localStorage.getItem('token');
      if (!latestToken || isTokenExpired(latestToken)) logout();
    };

    window.addEventListener('focus', verifyOnFocus);
    document.addEventListener('visibilitychange', verifyOnFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', verifyOnFocus);
      document.removeEventListener('visibilitychange', verifyOnFocus);
    };
  }, [state.isAuthenticated, state.user?._id, logout]);

  const value = useMemo(() => ({ ...state, login, logout, swapUser }), [state, login, logout, swapUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
