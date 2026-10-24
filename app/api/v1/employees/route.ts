import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/employees
 * Proxies → ushauth /api/v1/employees/
 * Falls back to direct ushauth:8002 when gateway (Kong) returns 502/504.
 */
export async function GET(req: NextRequest) {
  const baseUrl = (process.env['API_BASE_URL'] || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth   = (process.env['API_UAUTH']    || '/uauth').replace(/\/+$/, '');

  const qs         = req.nextUrl.searchParams.toString();
  const gatewayUrl = `${baseUrl}${uauth}/api/v1/employees/${qs ? `?${qs}` : ''}`;

  const isLocal   = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directUrl = isLocal ? `http://127.0.0.1:8002/api/v1/employees/${qs ? `?${qs}` : ''}` : null;

  const headers = getProxyHeaders(req);

  // Attempt 1: via gateway
  try {
    const upstream = await fetch(gatewayUrl, { headers, cache: 'no-store' });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

  // Attempt 2: direct to ushauth service
  if (directUrl) {
    try {
      const upstream = await fetch(directUrl, { headers, cache: 'no-store' });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy error';
      return NextResponse.json({ detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
}
