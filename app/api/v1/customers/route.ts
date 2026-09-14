import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
const UAUTH    = process.env.API_UAUTH    ?? '/uauth';

const CUSTOMERS_URL = `${BASE_URL}${UAUTH}/api/v1/customers/`;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  const url    = params ? `${CUSTOMERS_URL}?${params}` : CUSTOMERS_URL;

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
    const upstream = await fetch(CUSTOMERS_URL, {
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
