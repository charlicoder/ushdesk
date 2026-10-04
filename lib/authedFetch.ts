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
const LOCALE_KEY  = 'ush_locale';

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

function getStoredLocale(): string {
  if (typeof window === 'undefined') return 'en';
  const val = localStorage.getItem(LOCALE_KEY);
  return val === 'ar' ? 'ar' : 'en';
}

function saveNewToken(token: string): void {
  if (typeof window === 'undefined') return;
  const clean = token.replace(/^(Bearer\s+)+/i, '').trim();
  localStorage.setItem(TOKEN_KEY, clean);
  localStorage.setItem(LOGINAT_KEY, String(Date.now()));
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(clean)}; path=/; max-age=86400; SameSite=Lax`;
}

function notifySessionExpired(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(LOGINAT_KEY);
  localStorage.removeItem('ush_auth_user');
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent('ush:session-expired', { detail: { reason: 'token_expired' } }),
  );
}

// ── Refresh logic ──────────────────────────────────────────────────────────────

async function doRefresh(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken, refresh_token: refreshToken }),
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
      const newRefreshToken =
        (data.refresh as string) ??
        (data.refresh_token as string) ??
        ((data.data as Record<string, unknown>)?.refresh_token as string) ??
        ((data.data as Record<string, unknown>)?.refresh as string) ??
        null;
      if (newRefreshToken && typeof window !== 'undefined') {
        localStorage.setItem(REFRESH_KEY, newRefreshToken);
      }
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
 * Flow:
 *  - Attaches the current token to every request.
 *  - On 401, silently tries a token refresh and retries once if it succeeds.
 *  - On refresh failure (or no refresh token), clears stale tokens and fires
 *    `ush:session-expired` so the user is guided to log in with fresh credentials.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  // 1. Attach current access token from localStorage (authoritative source)
  const token = getStoredToken();
  const headers = new Headers(init.headers ?? {});
  const rawToken = token || headers.get('Authorization') || '';
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  if (cleanToken && cleanToken !== 'null' && cleanToken !== 'undefined') {
    headers.set('Authorization', `Bearer ${cleanToken}`);
  }
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  // Attach user's language preference so the backend can localise responses
  if (!headers.has('Accept-Language') || !headers.get('Accept-Language')) {
    headers.set('Accept-Language', getStoredLocale());
  }

  const res = await fetch(input, { ...init, headers });

  // 2. Not a 401 — return as-is
  if (res.status !== 401) return res;

  // 3. Got a 401 — check whether we have a refresh token to attempt with
  const storedRefresh = getStoredRefreshToken();
  if (!storedRefresh) {
    notifySessionExpired();
    return res;
  }

  // 4. Deduplicate: ensure only one refresh is in-flight across all concurrent requests
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;

  // 5. Refresh failed — expired session
  if (!newToken) {
    notifySessionExpired();
    return res;
  }

  // 6. Refresh succeeded — retry the original request with the new token
  const retryHeaders = new Headers(init.headers ?? {});
  const cleanNewToken = newToken.replace(/^(Bearer\s+)+/i, '').trim();
  retryHeaders.set('Authorization', `Bearer ${cleanNewToken}`);
  if (!retryHeaders.has('Content-Type')) retryHeaders.set('Content-Type', 'application/json');
  if (!retryHeaders.has('Accept-Language') || !retryHeaders.get('Accept-Language')) {
    retryHeaders.set('Accept-Language', getStoredLocale());
  }

  return fetch(input, { ...init, headers: retryHeaders });
}
