import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

function getUpstreamUrls(endpointPath: string, queryString: string = ''): string[] {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const qs = queryString ? (queryString.startsWith('?') ? queryString : `?${queryString}`) : '';

  const urls: string[] = [];

  // 1. Primary gateway URL (e.g. http://127.0.0.1:8000/booknpay/api/v1/payments/)
  urls.push(`${baseUrl}${booknpay}${endpointPath}${qs}`);

  // 2. Direct booknpay service URL fallback
  const directBase = (process.env['BOOKNPAY_DIRECT_URL'] || 'http://127.0.0.1:8003').replace(/\/+$/, '');
  urls.push(`${directBase}${endpointPath}${qs}`);

  return urls;
}

async function proxyWithFallback(
  urls: string[],
  init: RequestInit,
): Promise<NextResponse> {
  let lastStatus = 502;
  let lastData: unknown = { detail: 'Upstream gateway error' };

  for (const url of urls) {
    try {
      const upstream = await fetch(url, {
        ...init,
        cache: 'no-store',
      });

      const text = await upstream.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text ? { detail: text } : { detail: upstream.statusText || 'Error' };
      }

      if (upstream.status < 500) {
        return NextResponse.json(parsed, { status: upstream.status });
      }

      lastStatus = upstream.status;
      lastData = parsed;
    } catch {
      // Network failure on this target, try next
    }
  }

  return NextResponse.json(lastData, { status: lastStatus });
}

/**
 * POST /booknpay/api/v1/payments
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const qs   = req.nextUrl.searchParams.toString();
  const urls = getUpstreamUrls('/api/v1/payments/', qs);

  return proxyWithFallback(urls, {
    method: 'POST',
    headers: getProxyHeaders(req),
    body,
  });
}

/**
 * GET /booknpay/api/v1/payments
 */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const urls = getUpstreamUrls('/api/v1/payments/', qs);

  return proxyWithFallback(urls, {
    method: 'GET',
    headers: getProxyHeaders(req),
  });
}
