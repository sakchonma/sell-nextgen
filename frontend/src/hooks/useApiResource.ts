import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export function useApiResource<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve(null);
    setLoading(true);
    setError('');
    return apiFetch<T>(url)
      .then(result => {
        setData(result);
        return result;
      })
      .catch(err => {
        setError(err.message || 'โหลดข้อมูลไม่สำเร็จ');
        return null;
      })
      .finally(() => setLoading(false));
  }, [url, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
