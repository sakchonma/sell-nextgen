export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = localStorage.getItem('token') || '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function decodeJwtPayload(token: string): any | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export async function apiFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: options.credentials || 'include',
    headers: authHeaders(options.headers || {})
  });
  if (res.status === 401) {
    clearStoredAuth();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiJson<T = any>(url: string, body: unknown, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(url, {
    method: options.method || 'POST',
    ...options,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }),
    body: JSON.stringify(body)
  });
}
