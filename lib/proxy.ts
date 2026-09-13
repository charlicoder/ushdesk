import type { NextRequest } from 'next/server';

const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': lang,
    'X-USHSPA-TOKEN': APP_TOKEN,
    ...extra,
  };

  const cleanAuth = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (cleanAuth && cleanAuth !== 'null' && cleanAuth !== 'undefined') {
    headers['Authorization'] = authHeader;
  }

  return headers;
}
