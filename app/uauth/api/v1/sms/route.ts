import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders, getApiBaseUrl, getUauthPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const LOCAL_DIRECT_URL = 'http://127.0.0.1:8002/api/v1/sms/';

/**
 * POST /uauth/api/v1/sms/
 * Proxies SMS dispatch request to ushauth with required auth and token headers.
 */
export async function POST(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const uauth = getUauthPath();
  const upstreamUrl = `${baseUrl}${uauth}/api/v1/sms/`;
  const body = await req.json().catch(() => ({}));
  const headers = getProxyHeaders(req);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const text = await upstream.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
      }
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway down or not responding, fallback to direct local instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(LOCAL_DIRECT_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
