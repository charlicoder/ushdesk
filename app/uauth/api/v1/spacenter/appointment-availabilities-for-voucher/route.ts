import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getProxyHeaders, getUauthPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const baseUrl = getApiBaseUrl();
  const uauth = getUauthPath();
  const upstreamUrl = `${baseUrl}${uauth}/api/v1/spacenter/appointment-availabilities-for-voucher/`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
      cache: 'no-store',
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
