import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /booknpay/api/v1/refunds/
 * Proxy to upstream booknpay — returns paginated list of refunds with analytics.
 */
export async function GET(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/refunds/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
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
