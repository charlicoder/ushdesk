import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 100;

function getUpstreamUrls(endpointPath: string, queryString: string = ''): string[] {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const qs = queryString ? (queryString.startsWith('?') ? queryString : `?${queryString}`) : '';

  const urls: string[] = [];

  // 1. Primary gateway URL (e.g. http://127.0.0.1:8000/booknpay/api/v1/payments/)
  urls.push(`${baseUrl}${booknpay}${endpointPath}${qs}`);

  // 2. Direct booknpay service URL fallback (for local development or if gateway fails/restarts)
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

      // If response is valid HTTP (including 200, 400, 401, 403, 404, etc.), return it
      if (upstream.status < 500) {
        return NextResponse.json(parsed, { status: upstream.status });
      }

      // On 500, 502, 503, 504 from gateway, record and try fallback
      lastStatus = upstream.status;
      lastData = parsed;
    } catch {
      // Network failure on this target, try next
    }
  }

  return NextResponse.json(lastData, { status: lastStatus });
}

export async function GET(req: NextRequest) {
  // Forward all query params but clamp page_size to the backend maximum
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const rawSize = parseInt(params.get('page_size') ?? '20', 10);
  params.set('page_size', String(Math.min(rawSize, MAX_PAGE_SIZE)));
  if (params.has('date_from') && !params.has('from_date')) {
    params.set('from_date', params.get('date_from')!);
  }
  if (params.has('date_to') && !params.has('to_date')) {
    params.set('to_date', params.get('date_to')!);
  }

  const urls = getUpstreamUrls('/api/v1/payments/', params.toString());

  return proxyWithFallback(urls, {
    method: 'GET',
    headers: getProxyHeaders(req),
  });
}

/**
 * POST /api/v1/payments
 * Creates a payment record (including refunds) via the booknpay upstream.
 * Used by BookingCancellationModal to record refund entries in the ledger.
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
