import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const LOCAL_DIRECT_BASE = 'http://127.0.0.1:8003/api/v1/bookings';

/**
 * GET /booknpay/api/v1/bookings/[id]
 * Proxy to upstream booknpay service — returns full booking detail object.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/${id}/`;
  const directUrl = `${LOCAL_DIRECT_BASE}/${id}/`;
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
 * PATCH /booknpay/api/v1/bookings/[id]
 * Proxy to upstream booknpay service — updates booking details.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const bodyStr = JSON.stringify(body);
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/${id}/`;
  const directUrl = `${LOCAL_DIRECT_BASE}/${id}/`;
  const headers = getProxyHeaders(req);

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(url, {
      method: req.method,
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
    const upstream = await fetch(directUrl, {
      method: req.method,
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

export const PUT = PATCH;
