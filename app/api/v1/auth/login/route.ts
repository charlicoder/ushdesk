import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Force dynamic rendering — prevents Next.js from inlining process.env values
// at build time. Without this, Amplify Lambda gets the build-time fallback
// (127.0.0.1:8000) instead of the runtime env var.

export async function POST(req: NextRequest) {
  // Read env vars inside the handler — guarantees Amplify runtime values
  // are used, not stale module-level constants baked at cold-start.
  const baseUrl  = (process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const uauth    = (process.env.API_UAUTH     ?? '/uauth').replace(/\/+$/, '');
  const appToken =  process.env.API_APP_TOKEN ?? '';
  const loginUrl = `${baseUrl}${uauth}/api/v1/auth/login/`;

  console.log('[AUTH PROXY] →', loginUrl);

  try {
    const body = await req.json();

    const upstream = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        ...(appToken ? { 'X-USHSPA-TOKEN': appToken } : {}),
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
    console.error(`[AUTH PROXY] fetch failed (${loginUrl}):`, message);
    return NextResponse.json(
      { detail: `Cannot reach auth server at ${loginUrl}: ${message}` },
      { status: 502 },
    );
  }
}
