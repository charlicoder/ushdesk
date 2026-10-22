import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const baseUrl    = (process.env.API_BASE_URL  || process.env['API_BASE_URL']  || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth      = (process.env.API_UAUTH     || process.env['API_UAUTH']     || '/uauth').replace(/\/+$/, '');
  const appToken   = (process.env.API_APP_TOKEN || process.env['API_APP_TOKEN'] || 'ushspa').trim();
  const primaryUrl = `${baseUrl}${uauth}/api/v1/auth/refresh/`;

  const isLocalGateway = baseUrl.includes('127.0.0.1:8000') || baseUrl.includes('localhost:8000');
  const directFallbackUrl = isLocalGateway ? 'http://127.0.0.1:8002/api/v1/auth/refresh/' : null;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const refreshVal = rawBody.refresh || rawBody.refresh_token || '';
    const body = { refresh: refreshVal };
    const payloadStr = JSON.stringify(body);

    const headers: Record<string, string> = {
      'Content-Type':   'application/json',
      'Accept':         'application/json',
      'Connection':     'close',
      ...(appToken ? { 'X-USHSPA-TOKEN': appToken, 'USHSPA-TOKEN': appToken } : {}),
    };

    const callEndpoint = async (url: string) => {
      return fetch(url, {
        method: 'POST',
        headers,
        body: payloadStr,
      });
    };

    let upstream = await callEndpoint(primaryUrl).catch(() => null);

    if (!upstream || upstream.status === 502 || upstream.status === 503) {
      if (directFallbackUrl) {
        const fallbackRes = await callEndpoint(directFallbackUrl).catch(() => null);
        if (fallbackRes && fallbackRes.status !== 502 && fallbackRes.status !== 503) {
          upstream = fallbackRes;
        }
      }
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
    return NextResponse.json(
      { detail: `Cannot reach auth server at ${primaryUrl}: ${message}` },
      { status: 502 },
    );
  }
}
