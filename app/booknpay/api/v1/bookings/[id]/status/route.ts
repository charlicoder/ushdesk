import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * PATCH /booknpay/api/v1/bookings/[id]/status
 * Proxy to upstream booknpay service — avoids browser CORS restrictions.
 * Example body: { status: "cancelled", payment_status: "refunded", reason: "..." }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }     = await params;
  const body       = await req.json().catch(() => ({}));
  const baseUrl    = getApiBaseUrl();
  const booknpay   = getBooknpayPath();
  const url        = `${baseUrl}${booknpay}/api/v1/bookings/${id}/status/`;

  const payload = {
    ...body,
    status: body.status ?? 'confirmed',
  };

  try {
    const upstream = await fetch(url, {
      method: 'PATCH',
      headers: getProxyHeaders(req),
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text ? { detail: text } : { detail: upstream.statusText || 'Upstream error' };
    }
    if (!upstream.ok) {
      console.error(`[PATCH /booknpay/api/v1/bookings/${id}/status/] upstream ${upstream.status}:`, text);
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    console.error(`[PATCH /booknpay/api/v1/bookings/${id}/status/] proxy error:`, err);
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export const POST = PATCH;
