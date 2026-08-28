import { NextRequest, NextResponse } from 'next/server';

// Server-only env vars — always available in Next.js Route Handlers
const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const UAUTH     = process.env.API_UAUTH     ?? '/uauth';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

// Full backend login URL: http://127.0.0.1:8000/uauth/api/v1/auth/login/
const LOGIN_URL = `${BASE_URL}${UAUTH}/api/v1/auth/login/`;

export async function POST(req: NextRequest) {
  console.log('[AUTH PROXY] →', LOGIN_URL);

  try {
    const body = await req.json();

    const upstream = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,   // Kong gateway app token
      },
      body: JSON.stringify(body),
    });

    console.log('[AUTH PROXY] status:', upstream.status);

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error('[AUTH PROXY] error body:', JSON.stringify(data));
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    console.error('[AUTH PROXY] fetch failed:', message);
    return NextResponse.json(
      { detail: `Cannot reach auth server: ${message}` },
      { status: 502 },
    );
  }
}
