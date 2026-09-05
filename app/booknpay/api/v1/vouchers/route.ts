import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/vouchers/`;

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
 * GET /booknpay/api/v1/vouchers
 * Proxy to upstream booknpay — returns paginated list of gift vouchers.
 * Requires employee auth token (Authorization: Bearer <token>).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const qs  = req.nextUrl.searchParams.toString();
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
