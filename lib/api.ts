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

const TOKEN_KEY = 'ush_access_token';
const USER_KEY  = 'ush_auth_user';

export function saveToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
