import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

/**
 * GET /booknpay/api/v1/bookings/[id]
 * Proxy to upstream booknpay service — returns full booking detail object.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }     = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const url        = `${BASE_URL}/booknpay/api/v1/bookings/${id}/`;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'X-USHSPA-TOKEN': APP_TOKEN,
  };
  const token = authHeader.replace(/^(Bearer\s+)+/i, '').trim();
  if (token && token !== 'null' && token !== 'undefined') {
    upstreamHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const upstream = await fetch(url, { headers: upstreamHeaders });
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
