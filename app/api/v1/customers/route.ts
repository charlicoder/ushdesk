import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * Helper: build gateway and direct URLs for the customers endpoint.
 * All env vars are read at runtime (inside the function) to ensure
 * Amplify Lambda environment injection works correctly.
 */
function buildUrls(qs?: string) {
  const baseUrl = (process.env['API_BASE_URL'] || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth   = (process.env['API_UAUTH']    || '/uauth').replace(/\/+$/, '');

  const gatewayBase = `${baseUrl}${uauth}/api/v1/customers/`;
  const gatewayUrl  = qs ? `${gatewayBase}?${qs}` : gatewayBase;

  const isLocal   = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directBase = isLocal ? 'http://127.0.0.1:8002/api/v1/customers/' : null;
  const directUrl  = directBase ? (qs ? `${directBase}?${qs}` : directBase) : null;

  return { gatewayUrl, directUrl, gatewayBase, directBase };
}

/**
 * GET /api/v1/customers?page=1&page_size=20&...
 * Proxies → ushauth /api/v1/customers/
 * Falls back to direct ushauth:8002 when gateway (Kong) returns 502/504.
 */
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const { gatewayUrl, directUrl } = buildUrls(qs);
  const headers = getProxyHeaders(req);

  // Attempt 1: via gateway
  try {
    const upstream = await fetch(gatewayUrl, {
      headers,
      cache: 'no-store',
    });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

  // Attempt 2: direct to ushauth service
  if (directUrl) {
    try {
      const upstream = await fetch(directUrl, { headers, cache: 'no-store' });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy error';
      return NextResponse.json({ detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
}

/**
 * POST /api/v1/customers
 * Create a new customer — proxied to ushauth.
 * If upstream rejects and last_name is empty, retries with last_name='.'
 */
export async function POST(req: NextRequest) {
  const { gatewayBase, directBase } = buildUrls();
  const headers = getProxyHeaders(req);

  try {
    const body = await req.json();

    const attempt = async (baseUrl: string) => {
      let upstream = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // If upstream rejects and last_name is empty/missing, retry with '.'
      if (!upstream.ok && (!body?.last_name || !String(body.last_name).trim())) {
        const retryUpstream = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...body, last_name: '.' }),
        });
        if (retryUpstream.ok) upstream = retryUpstream;
      }

      return upstream;
    };

    // Attempt 1: gateway
    try {
      const upstream = await attempt(gatewayBase);
      if (upstream.status !== 502 && upstream.status !== 504) {
        const data = await upstream.json().catch(() => ({}));
        return NextResponse.json(data, { status: upstream.status });
      }
    } catch {
      // Gateway unreachable
    }

    // Attempt 2: direct
    if (directBase) {
      const upstream = await attempt(directBase);
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
