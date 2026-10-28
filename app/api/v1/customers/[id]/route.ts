import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * Helper: build gateway and direct URLs for a specific customer endpoint.
 */
function buildUrls(id: string) {
  const baseUrl = (process.env['API_BASE_URL'] || 'https://apidev.ushspa.co').replace(/\/+$/, '');
  const uauth   = (process.env['API_UAUTH']    || '/uauth').replace(/\/+$/, '');

  const gatewayUrl = `${baseUrl}${uauth}/api/v1/customers/${id}/`;

  const isLocal   = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directUrl = isLocal ? `http://127.0.0.1:8002/api/v1/customers/${id}/` : null;

  return { gatewayUrl, directUrl };
}

/**
 * GET /api/v1/customers/[id]
 * Retrieve customer details by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const { gatewayUrl, directUrl } = buildUrls(id);
  const headers = getProxyHeaders(req);

  try {
    const upstream = await fetch(gatewayUrl, { headers, cache: 'no-store' });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

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
 * PATCH /api/v1/customers/[id]
 * Update customer details or status.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const { gatewayUrl, directUrl } = buildUrls(id);
  const headers = getProxyHeaders(req);

  try {
    const body = await req.json();

    const attempt = async (targetUrl: string) => {
      return fetch(targetUrl, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    // Attempt 1: via gateway
    try {
      const upstream = await attempt(gatewayUrl);
      if (upstream.status !== 502 && upstream.status !== 504) {
        const data = await upstream.json().catch(() => ({}));
        return NextResponse.json(data, { status: upstream.status });
      }
    } catch {
      // Gateway unreachable
    }

    // Attempt 2: direct
    if (directUrl) {
      const upstream = await attempt(directUrl);
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

/**
 * DELETE /api/v1/customers/[id]
 * Delete customer by ID.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const { gatewayUrl, directUrl } = buildUrls(id);
  const headers = getProxyHeaders(req);

  const attempt = async (targetUrl: string) => {
    return fetch(targetUrl, {
      method: 'DELETE',
      headers,
    });
  };

  try {
    const upstream = await attempt(gatewayUrl);
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

  if (directUrl) {
    try {
      const upstream = await attempt(directUrl);
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy error';
      return NextResponse.json({ detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({ detail: 'Cannot reach auth server' }, { status: 502 });
}

