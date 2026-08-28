'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';

export interface PaginationMeta {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

interface UseBookingsResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  refetch: () => void;
}

/**
 * Fetches bookings from the proxy, unwraps { success, data, meta.pagination }.
 * Backend max page_size is 100 (enforced by proxy).
 */
export function useBookings<T>(
  proxyPath: string,
  fallback: T[] = [],
): UseBookingsResult<T> {
  const token = useAppSelector((s) => s.auth.token);

  const [data,       setData]       = useState<T[]>(fallback);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [tick,       setTick]       = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(proxyPath, { headers })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          const detail = (json as Record<string, unknown>)?.error;
          throw new Error(
            typeof detail === 'object'
              ? (detail as Record<string, string>).message ?? `Request failed (${res.status})`
              : String(detail ?? (json as Record<string, string>).message ?? `Request failed (${res.status})`),
          );
        }

        // Unwrap { success, data: [...], meta: { pagination: {...} } }
        let list: T[] = [];
        let meta: PaginationMeta | null = null;

        if (Array.isArray(json)) {
          list = json as T[];
        } else if (json?.success && Array.isArray(json?.data)) {
          list = json.data as T[];
          const p = (json?.meta as Record<string, unknown>)?.pagination;
          if (p && typeof p === 'object') meta = p as PaginationMeta;
        } else if (Array.isArray(json?.results)) {
          list = json.results as T[];
        } else if (Array.isArray(json?.data)) {
          list = json.data as T[];
        }

        setData(list.length > 0 ? list : fallback);
        setPagination(meta);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn(`[useBookings] ${proxyPath}:`, err.message);
        setError(err.message);
        setData(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyPath, token, tick]);

  return { data, loading, error, pagination, refetch };
}
