import { NextRequest, NextResponse } from 'next/server';

import { getApiBaseUrl, getBooknpayPath, getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * PATCH /booknpay/api/v1/vouchers/[id]/delivery-status
 * Proxy to upstream — updates gift order delivery status.
 * Body: { status?: string; delivery_status: string; note?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body     = await req.json().catch(() => ({}));
  const { id }   = await params;

  const baseUrl      = getApiBaseUrl();
  const booknpay     = getBooknpayPath();
  const qs           = req.nextUrl.searchParams.toString();
  const upstreamBase = `${baseUrl}${booknpay}/api/v1/vouchers/${id}/delivery-status/`;
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

export const POST = PATCH;
