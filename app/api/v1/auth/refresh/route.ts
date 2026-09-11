import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const UAUTH     = process.env.API_UAUTH     ?? '/uauth';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

// Correct ushauth refresh endpoint: /uauth/api/v1/auth/refresh/
const REFRESH_URL = `${BASE_URL}${UAUTH}/api/v1/auth/refresh/`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text ? { detail: text } : { detail: upstream.statusText || 'Refresh failed' };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
