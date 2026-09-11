import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/payments/`;

function buildHeaders(authHeader: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'X-USHSPA-TOKEN': APP_TOKEN,
  };
  const token = authHeader.replace(/^(Bearer\s+)+/i, '').trim();
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * POST /booknpay/api/v1/payments
 * Proxy to upstream booknpay — creates a payment record for a voucher.
 * Forwards all query params (e.g. customer_id) to the upstream.
 * Requires employee auth token (Authorization: Bearer <token>).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  // Forward query params (e.g. customer_id required by app-token auth)
  const qs  = req.nextUrl.searchParams.toString();
  const url = qs ? `${UPSTREAM_URL}?${qs}` : UPSTREAM_URL;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(authHeader),
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
