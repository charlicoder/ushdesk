/**
 * Central API client for USH Desk backend services.
 * All paths are read from NEXT_PUBLIC_* environment variables.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
const UAUTH    = process.env.NEXT_PUBLIC_UAUTH    ?? '/uauth';
const BOOKNPAY = process.env.NEXT_PUBLIC_BOOKNPAY ?? '/booknpay';
const NOTICE   = process.env.NEXT_PUBLIC_NOTICE   ?? '/unotice';

export const API_PATHS = {
  /** Full base URL */
  base: BASE_URL,
  /** Auth service root */
  uauth: `${BASE_URL}${UAUTH}`,
  /** Book-and-pay service root */
  booknpay: `${BASE_URL}${BOOKNPAY}`,
  /** Notifications service root */
  notice: `${BASE_URL}${NOTICE}`,
} as const;

/** Auth service endpoints */
export const AUTH_ENDPOINTS = {
  login: `${BASE_URL}/api/v1/auth/login`,
  logout: `${BASE_URL}/api/v1/auth/logout/`,
  me: `${BASE_URL}/api/v1/auth/me/`,
} as const;

// ─── API Request Helper ───────────────────────────────────────────────────────

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(url: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = opts;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      (data as Record<string, string>)?.detail ??
      (data as Record<string, string>)?.message ??
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

// ─── Token helpers (localStorage) ────────────────────────────────────────────

const TOKEN_KEY   = 'ush_access_token';
const USER_KEY    = 'ush_auth_user';
const LOGINAT_KEY = 'ush_login_at';

/** 12 hours in milliseconds */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    // Record the exact time of login so we can enforce the 12-hour TTL
    localStorage.setItem(LOGINAT_KEY, String(Date.now()));
  }
}

/**
 * Returns the stored token.
 * If ush_login_at is present and the 12-hour TTL has elapsed, the session is
 * considered expired — returns null (but does NOT clear storage here; the TTL
 * timer in providers.tsx handles cleanup via the Redux logout action).
 * If ush_login_at is absent (e.g. older sessions), the token is returned as-is
 * so we don't silently log out users who were already authenticated.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  const token   = localStorage.getItem(TOKEN_KEY);
  const loginAt = localStorage.getItem(LOGINAT_KEY);

  if (!token) return null;

  // Only enforce the TTL when we actually have a recorded login timestamp.
  // If the timestamp is missing, trust the token — don't silently wipe it.
  if (loginAt) {
    const elapsed = Date.now() - Number(loginAt);
    if (elapsed > SESSION_TTL_MS) {
      return null; // expired — caller (TTL timer) will handle cleanup
    }
  }

  return token;
}

/** Returns how many milliseconds remain in the current session.
 * Returns SESSION_TTL_MS (full TTL) when the login timestamp is missing —
 * this prevents an instant logout for users whose sessions pre-date the
 * timestamp feature, giving the TTL timer a safe value to work with.
 */
export function getSessionRemainingMs(): number {
  if (typeof window === 'undefined') return 0;
  const loginAt = localStorage.getItem(LOGINAT_KEY);
  // No timestamp recorded: treat as a fresh full-TTL session rather than
  // returning 0 (which would instantly log the user out).
  if (!loginAt) return SESSION_TTL_MS;
  const remaining = SESSION_TTL_MS - (Date.now() - Number(loginAt));
  return Math.max(0, remaining);
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOGINAT_KEY);
    localStorage.removeItem('ush_refresh_token');
  }
}

export function saveUser(user: Record<string, unknown>): void {
  if (typeof window !== 'undefined')
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
