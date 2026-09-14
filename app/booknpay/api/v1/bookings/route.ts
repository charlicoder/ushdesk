import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/bookings/`;

/**
 * GET /booknpay/api/v1/bookings?branch_id=...&date=...&status=...
 * Proxy to upstream — returns list of bookings. Forwards all query params.
 */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const url = qs ? `${UPSTREAM_URL}?${qs}` : UPSTREAM_URL;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

/**
 * POST /booknpay/api/v1/bookings
 * Proxy to upstream booknpay service — avoids browser CORS restrictions.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
