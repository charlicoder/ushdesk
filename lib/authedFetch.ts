'use client';

/**
 * authedFetch — authenticated fetch with automatic token refresh.
 *
 * Flow:
 *  1. Attaches `Authorization: Bearer <access_token>` from localStorage.
 *  2. On 401 WITH a stored refresh token: attempts a silent token refresh via
 *     POST /api/v1/auth/refresh.
 *  3. On successful refresh: saves new token, fires `ush:token-refreshed` so
 *     the Redux store can stay in sync, then retries the original request once.
 *  4. On failed refresh OR no refresh token: returns the original 401 response
 *     to the calling component so it can show an error. We do NOT dispatch any
 *     logout event here — global session expiry is handled exclusively by the
 *     12-hour TTL timer in providers.tsx.
 *
 * Use `authedFetch` as a drop-in replacement for `fetch` in client components.
 */

const TOKEN_KEY   = 'ush_access_token';
const REFRESH_KEY = 'ush_refresh_token';
const LOGINAT_KEY = 'ush_login_at';

// Single in-flight refresh promise to prevent parallel refresh storms
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ush:token-refreshed', { detail: { token: newToken } }),
        );
      }
    }

    return newToken;
  } catch {
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `fetch` with transparent token auth + silent refresh.
 *
 * IMPORTANT: This function never triggers a global logout. It only:
 *  - Attaches the current token to every request.
 *  - On 401, silently tries a token refresh and retries once if it succeeds.
 *  - On refresh failure (or no refresh token), returns the original 401 to the
 *    caller so the component can show a friendly error message.
 *
 * Global logout is handled solely by the session TTL timer in providers.tsx.
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

  // 2. Not a 401 — return as-is
  if (res.status !== 401) return res;

  // 3. Got a 401 — check whether we have a refresh token to attempt with
  const storedRefresh = getStoredRefreshToken();
  if (!storedRefresh) {
    // No refresh token available — return the 401 to the caller.
    // Do NOT wipe storage or dispatch logout here; the page will show an error.
    return res;
  }

  // 4. Deduplicate: ensure only one refresh is in-flight across all concurrent requests
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;

  // 5. Refresh failed — return the original 401 to the caller.
  //    Do NOT wipe auth storage or trigger a global logout. The calling page
  //    will show an error. The session TTL timer handles real session expiry.
  if (!newToken) {
    return res;
  }

  // 6. Refresh succeeded — retry the original request with the new token
  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers: retryHeaders });
}
