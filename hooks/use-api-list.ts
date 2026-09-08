'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { authedFetch } from '@/lib/authedFetch';

interface UseApiListResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches a paginated or flat list from a Next.js proxy endpoint.
 * Handles the backend envelope: { success, data: T[] } or { results: T[] } or T[]
 * Falls back to `fallback` data when the request fails.
 *
 * Waits for auth store to be initialized (hydrated from localStorage) before
 * making any requests to avoid premature unauthenticated fetches.
 */
export function useApiList<T>(
  proxyPath: string,
  fallback: T[] = [],
): UseApiListResult<T> {
  const token       = useAppSelector((s) => s.auth.token);
  const initialized = useAppSelector((s) => s.auth.initialized);

  const [data, setData]       = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    // Don't fire until the Redux store has been hydrated from localStorage.
    // This prevents a premature unauthenticated request that would trigger
    // a 401 → failed refresh → clearAuth cycle on page navigation.
    if (!initialized) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    authedFetch(proxyPath, { headers })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(
            (json as Record<string, string>).detail ??
            (json as Record<string, string>).message ??
            `Request failed (${res.status})`,
          );
        }

        // Unwrap various envelope shapes
        let list: T[] = [];
        if (Array.isArray(json)) {
          list = json as T[];
        } else if (json?.success && Array.isArray(json?.data)) {
          list = json.data as T[];
        } else if (json?.success && json?.data && typeof json.data === 'object') {
          // Handle { success, data: { results: [...] } }
          const inner = json.data as Record<string, unknown>;
          list = (Array.isArray(inner.results) ? inner.results : Object.values(inner)) as T[];
        } else if (Array.isArray(json?.results)) {
          list = json.results as T[];
        } else if (Array.isArray(json?.data)) {
          list = json.data as T[];
        }

        setData(list.length > 0 ? list : fallback);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn(`[useApiList] ${proxyPath}:`, err.message);
        setError(err.message);
        setData(fallback);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyPath, token, initialized, tick]);

  return { data, loading, error, refetch };
}
