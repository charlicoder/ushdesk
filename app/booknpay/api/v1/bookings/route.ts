import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const LOCAL_DIRECT_URL = 'http://127.0.0.1:8003/api/v1/bookings/';

/**
 * GET /booknpay/api/v1/bookings?branch_id=...&date=...&status=...
 * Proxy to upstream — returns list of bookings. Forwards all query params.
 */
export async function GET(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamUrl = `${baseUrl}${booknpay}/api/v1/bookings/`;

  const qs = req.nextUrl.searchParams.toString();
  const url = qs ? `${upstreamUrl}?${qs}` : upstreamUrl;
  const directUrl = qs ? `${LOCAL_DIRECT_URL}?${qs}` : LOCAL_DIRECT_URL;
  const headers = getProxyHeaders(req);

  try {
    const upstream = await fetch(url, {
      headers,
      cache: 'no-store',
    });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const text = await upstream.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
      }
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway down or not responding, fallback to direct local instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(directUrl, {
      headers,
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
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamUrl = `${baseUrl}${booknpay}/api/v1/bookings/`;

  const body = await req.json().catch(() => ({}));
  const bodyStr = JSON.stringify(body);
  const headers = getProxyHeaders(req);

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const text = await upstream.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
      }
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway down or not responding, fallback to direct local instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(LOCAL_DIRECT_URL, {
      method: 'POST',
      headers,
      body: bodyStr,
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
