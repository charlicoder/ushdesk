import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

const UPSTREAM_URL = `${BASE_URL}/booknpay/api/v1/vouchers/`;

export async function GET(req: NextRequest) {
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const url    = params.toString() ? `${UPSTREAM_URL}?${params.toString()}` : UPSTREAM_URL;

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
