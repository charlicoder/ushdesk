import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /booknpay/api/v1/payment-links/[...path]
 * Proxy to upstream — e.g. GET /booknpay/api/v1/payment-links/{link_id}/
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const subpath = path.join('/');
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/${subpath}/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
      redirect: 'manual',
    });
    const location = upstream.headers.get('location');
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      return NextResponse.redirect(new URL(location, req.url), upstream.status);
    }
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
 * POST /booknpay/api/v1/payment-links/[...path]
 * Proxy to upstream — e.g. POST /booknpay/api/v1/payment-links/{link_id}/sync/, /cancel/, /refund/
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const subpath = path.join('/');
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/${subpath}/${qs ? `?${qs}` : ''}`;
  const rawBody = await req.text().catch(() => '');
  const sigHeader = req.headers.get('myfatoorah-signature');
  const extraHeaders: Record<string, string> = {};
  if (sigHeader) {
    extraHeaders['MyFatoorah-Signature'] = sigHeader;
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: getProxyHeaders(req, extraHeaders),
      body: rawBody || JSON.stringify({}),
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
 * DELETE /booknpay/api/v1/payment-links/[...path]
 * Proxy to upstream — e.g. DELETE /booknpay/api/v1/payment-links/{link_id}/
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const subpath = path.join('/');
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/${subpath}/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: getProxyHeaders(req),
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
