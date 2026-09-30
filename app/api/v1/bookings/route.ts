import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  // Forward all query params but clamp page_size to the backend maximum
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const rawSize = parseInt(params.get('page_size') ?? '20', 10);
  params.set('page_size', String(Math.min(rawSize, MAX_PAGE_SIZE)));

  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/?${params.toString()}`;

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

export async function POST(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/`;

  try {
    const body = await req.json().catch(() => ({}));
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
