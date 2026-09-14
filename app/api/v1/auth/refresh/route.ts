import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Force dynamic — prevents Next.js from inlining process.env at build time.

export async function POST(req: NextRequest) {
  const baseUrl    = (process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const uauth      = (process.env.API_UAUTH     ?? '/uauth').replace(/\/+$/, '');
  const appToken   =  process.env.API_APP_TOKEN ?? '';
  const refreshUrl = `${baseUrl}${uauth}/api/v1/auth/refresh/`;

  try {
    const body = await req.json().catch(() => ({}));

    const upstream = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        ...(appToken ? { 'X-USHSPA-TOKEN': appToken } : {}),
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
    return NextResponse.json(
      { detail: `Cannot reach auth server at ${(process.env.API_BASE_URL ?? '127.0.0.1:8000')}: ${message}` },
      { status: 502 },
    );
  }
}
