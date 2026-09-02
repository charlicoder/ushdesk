import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/bookings/`;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,
        'Authorization':  authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
