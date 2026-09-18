import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

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
  const url    = `${BASE_URL}/booknpay/api/v1/bookings/${id}/`;

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
