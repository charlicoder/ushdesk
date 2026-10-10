import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getProxyHeaders, getUauthPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const baseUrl = getApiBaseUrl();
  const uauth = getUauthPath();
  const upstreamUrl = `${baseUrl}${uauth}/api/v1/find-availabilities-for-reschedule-appointment/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: getProxyHeaders(req),
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
