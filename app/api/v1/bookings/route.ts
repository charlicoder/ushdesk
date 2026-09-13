import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
const BOOKNPAY = process.env.API_BOOKNPAY ?? '/booknpay';

const UPSTREAM_URL = `${BASE_URL}${BOOKNPAY}/api/v1/bookings/`;

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  // Forward all query params but clamp page_size to the backend maximum
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const rawSize = parseInt(params.get('page_size') ?? '20', 10);
  params.set('page_size', String(Math.min(rawSize, MAX_PAGE_SIZE)));

  const url = `${UPSTREAM_URL}?${params.toString()}`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
