import type { NextRequest } from 'next/server';

// IMPORTANT: Use bracket notation process.env['VAR'] instead of process.env['VAR']
// Next.js bundler (webpack/turbopack) statically replaces dot-notation
// process.env['X'] at build time with the literal value (or undefined).
// Bracket notation forces a true runtime lookup — critical for Amplify SSR
// Lambdas where env vars are injected at invocation, not build time.

export function getApiBaseUrl(): string {
  return (
    process.env['API_BASE_URL'] ||
    process.env['NEXT_PUBLIC_API_BASE_URL'] ||
    'http://127.0.0.1:8000'
  ).replace(/\/+$/, '');
}

export function getAppToken(): string {
  return process.env['API_APP_TOKEN'] ?? '';
}

export function getUauthPath(): string {
  return (
    process.env['API_UAUTH'] ||
    process.env['NEXT_PUBLIC_UAUTH'] ||
    '/uauth'
  ).replace(/\/+$/, '');
}

export function getBooknpayPath(): string {
  return (
    process.env['API_BOOKNPAY'] ||
    process.env['NEXT_PUBLIC_BOOKNPAY'] ||
    '/booknpay'
  ).replace(/\/+$/, '');
}

export function getNoticePath(): string {
  return (
    process.env['API_NOTICE'] ||
    process.env['NEXT_PUBLIC_NOTICE'] ||
    '/unotice'
  ).replace(/\/+$/, '');
}

/**
 * Builds standard upstream proxy headers with authentication and language forwarding.
 * Standardizes Accept-Language to 'ar' or 'en'.
 */
export function getProxyHeaders(
  req: NextRequest,
  extra?: Record<string, string>,
): Record<string, string> {
  const authHeader = req.headers.get('authorization') ?? '';
  const rawLang = req.headers.get('accept-language') || 'en';
  const lang = rawLang.toLowerCase().includes('ar') ? 'ar' : 'en';
  const appToken = getAppToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': lang,
    ...(appToken ? { 'X-USHSPA-TOKEN': appToken } : {}),
    ...extra,
  };

  const cleanAuth = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (cleanAuth && cleanAuth !== 'null' && cleanAuth !== 'undefined') {
    headers['Authorization'] = authHeader;
  }

  return headers;
}
