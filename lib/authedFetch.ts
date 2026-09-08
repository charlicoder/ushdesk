'use client';

/**
 * authedFetch — authenticated fetch with automatic token refresh.
 *
 * Flow:
 *  1. Attaches `Authorization: Bearer <access_token>` from localStorage.
 *  2. On 401 WITH a stored refresh token: attempts to refresh via POST /api/v1/auth/refresh.
 *  3. On successful refresh: saves new token, fires `ush:token-refreshed`
 *     so the Redux store can stay in sync, then retries the original request.
 *  4. On failed refresh: clears auth storage and fires `ush:logout-required`
 *     so the app can redirect to /login.
 *  5. On 401 WITHOUT a refresh token: just fires `ush:logout-required`
 *     (no storage is wiped prematurely, so the redirect can happen cleanly).
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

function dispatchLogoutRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ush:logout-required'));
  }
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
 *
 * Key behaviours vs the original:
 * - If no refresh token is stored, a 401 simply signals logout WITHOUT
 *   wiping localStorage first — this prevents losing tokens during the
 *   brief window before the redirect fires.
 * - Refresh failures do clear storage and then signal logout (genuine
 *   session expiry path).
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // 1. Attach current access token from localStorage (authoritative source)
  const token = getStoredToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers });

  // 2. Not a 401 — nothing to do
  if (res.status !== 401) return res;

  // 3. Got a 401. Check whether we even have a refresh token to attempt with.
  const storedRefresh = getStoredRefreshToken();
  if (!storedRefresh) {
    // No refresh token: session is simply over — signal logout without
    // wiping storage prematurely (let logout() action / redirect do that).
    dispatchLogoutRequired();
    return res;
  }

  // 4. We have a refresh token — ensure only one refresh is in-flight at a time
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;

  // 5. Refresh failed (token expired, revoked, etc.) → wipe auth + redirect
  if (!newToken) {
    clearAuth();
    dispatchLogoutRequired();
    return res; // return original 401
  }

  // 6. Refresh succeeded — retry the original request with the new token
  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers: retryHeaders });
}
