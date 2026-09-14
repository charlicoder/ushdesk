import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// IMPORTANT: Use bracket notation process.env['VAR'] instead of process.env['VAR']
// Next.js bundler statically replaces dot-notation process.env['X'] at build time
// with the literal build-time value (or undefined). Bracket notation forces a
// true runtime lookup in the Lambda, picking up Amplify's injected env vars.

export async function POST(req: NextRequest) {
  const baseUrl  = (process.env['API_BASE_URL']  ?? 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth    = (process.env['API_UAUTH']     ?? '/uauth').replace(/\/+$/, '');
  const appToken =  process.env['API_APP_TOKEN'] ?? '';
  const loginUrl = `${baseUrl}${uauth}/api/v1/auth/login/`;

  console.log('[AUTH PROXY] baseUrl:', baseUrl);
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
