import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
const UAUTH    = process.env.API_UAUTH    ?? '/uauth';

/**
 * GET /api/v1/services/slim
 * Proxies → /uauth/api/v1/services-slim/
 * Returns a lightweight list of services (id, name, duration, price).
 */
export async function GET(req: NextRequest) {
  const qs  = req.nextUrl.searchParams.toString();
  const url = `${BASE_URL}${UAUTH}/api/v1/services-slim/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
