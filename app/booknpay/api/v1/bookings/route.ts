import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/bookings/`;

function buildHeaders(authHeader: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'X-USHSPA-TOKEN': APP_TOKEN,
  };
  const bearer = authHeader.replace('Bearer ', '').trim();
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  return headers;
}

/**
 * GET /booknpay/api/v1/bookings?branch_id=...&date=...&status=...
 * Proxy to upstream — returns list of bookings. Forwards all query params.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const qs = req.nextUrl.searchParams.toString();
  const url = qs ? `${UPSTREAM_URL}?${qs}` : UPSTREAM_URL;

  try {
    const upstream = await fetch(url, { headers: buildHeaders(authHeader) });
    const data = await upstream.json().catch(() => ({}));
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
  const authHeader = req.headers.get('authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: buildHeaders(authHeader),
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
