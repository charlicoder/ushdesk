import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getDirectBooknpayUrl, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

function getUpstreamUrl(id: string): string {
  const directUrl = getDirectBooknpayUrl();
  if (directUrl) {
    return `${directUrl}/api/v1/bookings/${id}/`;
  }
  const baseUrl = getApiBaseUrl();
  const booknpayPath = getBooknpayPath();
  return `${baseUrl}${booknpayPath}/api/v1/bookings/${id}/`;
}

/**
 * GET /api/v1/booknpay/bookings/[id]
 *
 * Fetches a single booking's full detail from the upstream booknpay service.
 * Used by BookingDetailModal.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = getUpstreamUrl(id);

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache:   'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

/**
 * PATCH /api/v1/booknpay/bookings/[id]
 *
 * Partially updates a booking resource (e.g. sessions, services, status).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = getUpstreamUrl(id);

  try {
    const body = await req.json().catch(() => ({}));
    const upstream = await fetch(url, {
      method:  'PATCH',
      headers: getProxyHeaders(req),
      body:    JSON.stringify(body),
      cache:   'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

/**
 * PUT /api/v1/booknpay/bookings/[id]
 *
 * Full update for a booking resource.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = getUpstreamUrl(id);

  try {
    const body = await req.json().catch(() => ({}));
    const upstream = await fetch(url, {
      method:  'PUT',
      headers: getProxyHeaders(req),
      body:    JSON.stringify(body),
      cache:   'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
