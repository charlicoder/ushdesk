import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'http://127.0.0.1:8000';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/vouchers/`;

/**
 * GET /booknpay/api/v1/vouchers
 * Proxy to upstream booknpay — returns paginated list of gift vouchers.
 * Requires employee auth token (Authorization: Bearer <token>).
 */
export async function GET(req: NextRequest) {
  const qs  = req.nextUrl.searchParams.toString();
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
 * POST /booknpay/api/v1/vouchers
 * Proxy to upstream booknpay — creates a new gift voucher.
 * Forwards all query params (e.g. customer_id) to the upstream.
 * Requires employee auth token (Authorization: Bearer <token>).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Forward query params (e.g. customer_id required by app-token auth)
  const qs  = req.nextUrl.searchParams.toString();
  const url = qs ? `${UPSTREAM_URL}?${qs}` : UPSTREAM_URL;

  try {
    const upstream = await fetch(url, {
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
