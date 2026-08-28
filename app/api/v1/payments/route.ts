import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const BOOKNPAY  = process.env.API_BOOKNPAY  ?? '/booknpay';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}${BOOKNPAY}/api/v1/payments/`;

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  // Forward all query params but clamp page_size to the backend maximum
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const rawSize = parseInt(params.get('page_size') ?? '20', 10);
  params.set('page_size', String(Math.min(rawSize, MAX_PAGE_SIZE)));

  const url = `${UPSTREAM_URL}?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,
        'Authorization':  authHeader,
      },
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
