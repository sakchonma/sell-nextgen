import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

export type ActivityTypeOption = {
  _id: string;
  code: string;
  label: string;
  labelTh?: string;
  scopes: Array<'task' | 'log' | 'note'>;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  allowCustomLabel?: boolean;
};

type CacheEntry = { data: ActivityTypeOption[]; at: number };
const cache: Record<string, CacheEntry> = {};
const TTL_MS = 60_000;

function cacheKey(scope?: string, includeInactive?: boolean) {
  return `${scope || 'all'}:${includeInactive ? '1' : '0'}`;
}

export function invalidateActivityTypesCache() {
  Object.keys(cache).forEach(key => delete cache[key]);
}

export function useActivityTypes(scope?: 'task' | 'log' | 'note', includeInactive = false) {
  const [types, setTypes] = useState<ActivityTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const key = cacheKey(scope, includeInactive);
    delete cache[key];
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (scope) params.set('scope', scope);
      if (includeInactive) params.set('includeInactive', '1');
      const query = params.toString();
      const data = await apiFetch<ActivityTypeOption[]>(`/api/activity-types${query ? `?${query}` : ''}`);
      const rows = Array.isArray(data) ? data : [];
      cache[key] = { data: rows, at: Date.now() };
      setTypes(rows);
    } catch (err: any) {
      setError(err?.message || 'โหลดประเภทกิจกรรมไม่สำเร็จ');
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, [scope, includeInactive]);

  useEffect(() => {
    const key = cacheKey(scope, includeInactive);
    const hit = cache[key];
    if (hit && Date.now() - hit.at < TTL_MS) {
      setTypes(hit.data);
      setLoading(false);
      return;
    }
    reload();
  }, [scope, includeInactive, reload]);

  const selectOptions = useMemo(
    () => types.map(row => ({ value: row.code, label: row.labelTh || row.label })),
    [types]
  );

  return { types, selectOptions, loading, error, reload };
}
