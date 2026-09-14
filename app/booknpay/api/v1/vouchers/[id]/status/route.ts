import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

/**
 * PATCH /booknpay/api/v1/vouchers/[id]/status
 * Proxy to upstream — updates voucher status (e.g. created → active).
 * Forwards all query params (e.g. customer_id) to the upstream.
 * Body: { status, payment_id, payment_data }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json().catch(() => ({}));
  const { id } = await params;

  // Forward query params (e.g. customer_id required by app-token auth)
  const qs = req.nextUrl.searchParams.toString();
  const upstreamBase = `${BASE_URL}/booknpay/api/v1/vouchers/${id}/status/`;
  const upstreamUrl  = qs ? `${upstreamBase}?${qs}` : upstreamBase;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'PATCH',
      headers: getProxyHeaders(req),
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
