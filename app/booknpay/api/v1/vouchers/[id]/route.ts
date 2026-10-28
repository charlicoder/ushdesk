import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders, getApiBaseUrl, getBooknpayPath, getDirectBooknpayUrl } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /booknpay/api/v1/vouchers/[id]
 * Proxy to upstream — fetch gift voucher details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamBase = `${baseUrl}${booknpay}/api/v1/vouchers/${id}/`;

  const directBase = getDirectBooknpayUrl();
  const directFallbackBase = directBase ? `${directBase}/api/v1/vouchers/${id}/` : `http://127.0.0.1:8003/api/v1/vouchers/${id}/`;

  const qs = req.nextUrl.searchParams.toString();
  const upstreamUrl = qs ? `${upstreamBase}?${qs}` : upstreamBase;
  const directUrl = qs ? `${directFallbackBase}?${qs}` : directFallbackBase;
  const headers = getProxyHeaders(req);

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
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
    // Gateway down or not responding, fallback to direct instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(directUrl, {
      method: 'GET',
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
 * PATCH /booknpay/api/v1/vouchers/[id]
 * Proxy to upstream — partial update of a gift voucher.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json().catch(() => ({}));
  const { id } = await params;

  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamBase = `${baseUrl}${booknpay}/api/v1/vouchers/${id}/`;

  const directBase = getDirectBooknpayUrl();
  const directFallbackBase = directBase ? `${directBase}/api/v1/vouchers/${id}/` : `http://127.0.0.1:8003/api/v1/vouchers/${id}/`;

  const qs = req.nextUrl.searchParams.toString();
  const upstreamUrl = qs ? `${upstreamBase}?${qs}` : upstreamBase;
  const directUrl = qs ? `${directFallbackBase}?${qs}` : directFallbackBase;

  const bodyStr = JSON.stringify(body);
  const headers = getProxyHeaders(req, { 'Content-Type': 'application/json' });

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'PATCH',
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
    // Gateway down or not responding, fallback to direct instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(directUrl, {
      method: 'PATCH',
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

/**
 * DELETE /booknpay/api/v1/vouchers/[id]
 * Proxy to upstream — delete a gift voucher.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamBase = `${baseUrl}${booknpay}/api/v1/vouchers/${id}/`;

  const directBase = getDirectBooknpayUrl();
  const directFallbackBase = directBase ? `${directBase}/api/v1/vouchers/${id}/` : `http://127.0.0.1:8003/api/v1/vouchers/${id}/`;

  const qs = req.nextUrl.searchParams.toString();
  const upstreamUrl = qs ? `${upstreamBase}?${qs}` : upstreamBase;
  const directUrl = qs ? `${directFallbackBase}?${qs}` : directFallbackBase;
  const headers = getProxyHeaders(req);

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'DELETE',
      headers,
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
    // Gateway down or not responding, fallback to direct instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(directUrl, {
      method: 'DELETE',
      headers,
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
