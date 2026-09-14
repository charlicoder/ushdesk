import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';

/**
 * PATCH /booknpay/api/v1/bookings/[id]/status
 * Proxy to upstream booknpay service — avoids browser CORS restrictions.
 * Example body: { status: "confirmed", payment_status: "pending", reason: "..." }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }     = await params;
  const body       = await req.json().catch(() => ({}));
  const url        = `${BASE_URL}/booknpay/api/v1/bookings/${id}/status/`;

  const payload = {
    status: body.status ?? 'confirmed',
    ...body,
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
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export const POST = PATCH;
