import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/vouchers/`;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  // Forward any query params
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const url    = params.toString() ? `${UPSTREAM_URL}?${params.toString()}` : UPSTREAM_URL;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'X-USHSPA-TOKEN': APP_TOKEN,
  };
  if (authHeader && authHeader.replace('Bearer ', '').trim()) {
    upstreamHeaders['Authorization'] = authHeader;
  }

  try {
    const upstream = await fetch(url, { headers: upstreamHeaders });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
