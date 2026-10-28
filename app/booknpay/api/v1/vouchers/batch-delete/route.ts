import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders, getApiBaseUrl, getBooknpayPath, getDirectBooknpayUrl } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const LOCAL_DIRECT_URL = 'http://127.0.0.1:8003/api/v1/vouchers/batch-delete/';

/**
 * POST /booknpay/api/v1/vouchers/batch-delete
 * Proxy to upstream booknpay — batch delete gift vouchers.
 */
export async function POST(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const upstreamUrl = `${baseUrl}${booknpay}/api/v1/vouchers/batch-delete/`;

  const directBase = getDirectBooknpayUrl();
  const directUrl = directBase ? `${directBase}/api/v1/vouchers/batch-delete/` : LOCAL_DIRECT_URL;

  const body = await req.json().catch(() => ({}));
  const bodyStr = JSON.stringify(body);
  const headers = getProxyHeaders(req, { 'Content-Type': 'application/json' });

  // Attempt 1: Gateway proxy
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
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
    // Gateway down or not responding, fallback to direct instance
  }

  // Attempt 2: Direct local fallback
  try {
    const upstream = await fetch(directUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
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

