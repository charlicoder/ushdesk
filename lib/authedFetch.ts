'use client';

/**
 * authedFetch — authenticated fetch with automatic token refresh.
 *
 * Flow:
 *  1. Attaches `Authorization: Bearer <access_token>` from localStorage.
 *  2. On 401: attempts to refresh via POST /api/v1/auth/refresh.
 *  3. On successful refresh: saves new token, fires `ush:token-refreshed`
 *     so the Redux store can stay in sync, then retries the original request.
 *  4. On failed refresh: clears all stored auth data and fires
 *     `ush:logout-required` so the app can redirect to /login.
 *
 * Use `authedFetch` as a drop-in replacement for `fetch` in client components.
 */

const TOKEN_KEY   = 'ush_access_token';
const REFRESH_KEY = 'ush_refresh_token';
const LOGINAT_KEY = 'ush_login_at';

// Single in-flight refresh to prevent parallel refresh storms
let refreshPromise: Promise<string | null> | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? null;
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY) ?? null;
}

function saveNewToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LOGINAT_KEY, String(Date.now()));
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LOGINAT_KEY);
}

// ── Refresh logic ──────────────────────────────────────────────────────────────

async function doRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!res.ok) return null;

    const data: Record<string, unknown> = await res.json().catch(() => ({}));

    // Backend may return the new access token under different keys
    const newToken =
      (data.access as string) ??
      (data.access_token as string) ??
      ((data.data as Record<string, unknown>)?.access_token as string) ??
      ((data.data as Record<string, unknown>)?.access as string) ??
      null;

    if (newToken) {
      saveNewToken(newToken);
      // Notify the Redux layer (providers.tsx listens for this)
      window.dispatchEvent(
        new CustomEvent('ush:token-refreshed', { detail: { token: newToken } }),
      );
    }

    return newToken;
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `fetch` that handles token auth + silent refresh.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // 1. Attach current token
  const token = getStoredToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers });

  // 2. If not a 401, return as-is
  if (res.status !== 401) return res;

  // 3. 401 — ensure only one refresh is in flight at a time
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;

  // 4. Refresh failed → clear auth, signal logout
  if (!newToken) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ush:logout-required'));
    }
    return res; // return original 401
  }

  // 5. Retry original request with new token
  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers: retryHeaders });
}
