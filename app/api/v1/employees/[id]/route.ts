import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/employees/[id]
 * Proxies → ushauth /api/v1/employees/{id}/
 * Falls back to direct ushauth:8002 when gateway (Kong) returns 502/504.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = (process.env['API_BASE_URL'] || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth   = (process.env['API_UAUTH']    || '/uauth').replace(/\/+$/, '');

  const qs         = req.nextUrl.searchParams.toString();
  const gatewayUrl = `${baseUrl}${uauth}/api/v1/employees/${id}/${qs ? `?${qs}` : ''}`;

  const isLocal   = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directUrl = isLocal ? `http://127.0.0.1:8002/api/v1/employees/${id}/${qs ? `?${qs}` : ''}` : null;

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

/**
 * PATCH /api/v1/employees/[id]
 * Proxies → ushauth /api/v1/employees/{id}/
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = (process.env['API_BASE_URL'] || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth   = (process.env['API_UAUTH']    || '/uauth').replace(/\/+$/, '');

  const gatewayUrl = `${baseUrl}${uauth}/api/v1/employees/${id}/`;
  const isLocal    = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directUrl  = isLocal ? `http://127.0.0.1:8002/api/v1/employees/${id}/` : null;

  const headers = getProxyHeaders(req);
  const body    = await req.text();

  const tryFetch = async (url: string) =>
    fetch(url, { method: 'PATCH', headers, body, cache: 'no-store' });

  try {
    const upstream = await tryFetch(gatewayUrl);
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

  if (directUrl) {
    try {
      const upstream = await tryFetch(directUrl);
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy error';
      return NextResponse.json({ detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
}
