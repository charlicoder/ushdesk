import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const BOOKNPAY = process.env['API_BOOKNPAY'] ?? '/booknpay';

const UPSTREAM_URL = `${BASE_URL}${BOOKNPAY}/api/v1/payments/`;

const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  // Forward all query params but clamp page_size to the backend maximum
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const rawSize = parseInt(params.get('page_size') ?? '20', 10);
  params.set('page_size', String(Math.min(rawSize, MAX_PAGE_SIZE)));

  const url = `${UPSTREAM_URL}?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

/**
 * POST /api/v1/payments
 * Creates a payment record (including refunds) via the booknpay upstream.
 * Used by BookingCancellationModal to record refund entries in the ledger.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const qs   = req.nextUrl.searchParams.toString();
    const url  = qs ? `${UPSTREAM_URL}?${qs}` : UPSTREAM_URL;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body,
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
