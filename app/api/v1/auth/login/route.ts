import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// IMPORTANT: Use bracket notation process.env['VAR'] instead of process.env['VAR']
// Next.js bundler statically replaces dot-notation process.env['X'] at build time
// with the literal build-time value (or undefined). Bracket notation forces a
// true runtime lookup in the Lambda, picking up Amplify's injected env vars.

export async function POST(req: NextRequest) {
  const baseUrl  = (process.env.API_BASE_URL  || process.env['API_BASE_URL']  || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth    = (process.env.API_UAUTH     || process.env['API_UAUTH']     || '/uauth').replace(/\/+$/, '');
  const appToken = (process.env.API_APP_TOKEN || process.env['API_APP_TOKEN'] || 'ushspa').trim();
  const primaryUrl = `${baseUrl}${uauth}/api/v1/auth/login/`;

  // Fallback direct URL if gateway (e.g. Kong :8000) returns 502 in local environment
  const isLocalGateway = baseUrl.includes('127.0.0.1:8000') || baseUrl.includes('localhost:8000');
  const directFallbackUrl = isLocalGateway ? 'http://127.0.0.1:8002/api/v1/auth/login/' : null;

  console.log('[AUTH PROXY] baseUrl:', baseUrl);
  console.log('[AUTH PROXY] →', primaryUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'Connection':   'close',
    ...(appToken ? { 'X-USHSPA-TOKEN': appToken, 'USHSPA-TOKEN': appToken } : {}),
  };

  try {
    const body = await req.json();
    const payloadStr = JSON.stringify(body);

    const callEndpoint = async (url: string) => {
      return fetch(url, {
        method: 'POST',
        headers,
        body: payloadStr,
      });
    };

    let upstream = await callEndpoint(primaryUrl).catch((err) => {
      console.warn(`[AUTH PROXY] primary fetch error (${primaryUrl}):`, err);
      return null;
    });

    // If upstream gateway returned 502 Bad Gateway / invalid upstream, try direct fallback or retry
    if (!upstream || upstream.status === 502 || upstream.status === 503) {
      if (upstream) {
        console.warn(`[AUTH PROXY] primary returned ${upstream.status}, trying fallback / retry...`);
      }
      if (directFallbackUrl) {
        console.log('[AUTH PROXY] trying direct fallback →', directFallbackUrl);
        const fallbackRes = await callEndpoint(directFallbackUrl).catch((err) => {
          console.warn(`[AUTH PROXY] fallback error (${directFallbackUrl}):`, err);
          return null;
        });
        if (fallbackRes && fallbackRes.status !== 502 && fallbackRes.status !== 503) {
          upstream = fallbackRes;
        }
      }

      // If still failed or 502, wait 350ms and retry primary one more time
      if (!upstream || upstream.status === 502 || upstream.status === 503) {
        await new Promise((r) => setTimeout(r, 350));
        const retryRes = await callEndpoint(primaryUrl).catch(() => null);
        if (retryRes) {
          upstream = retryRes;
        }
      }
    }

    if (!upstream) {
      return NextResponse.json(
        { detail: `Cannot reach auth server at ${primaryUrl}` },
        { status: 502 }
      );
    }

    console.log('[AUTH PROXY] status:', upstream.status);

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error('[AUTH PROXY] error body:', JSON.stringify(data));
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    console.error(`[AUTH PROXY] fetch failed (${primaryUrl}):`, message);
    return NextResponse.json(
      { detail: `Cannot reach auth server at ${primaryUrl}: ${message}` },
      { status: 502 },
    );
  }
}
