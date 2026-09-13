import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
const UAUTH    = process.env.API_UAUTH    ?? '/uauth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const qs     = req.nextUrl.searchParams.toString();
  // Forwards branch_id and any other query params to the upstream
  const url    = `${BASE_URL}${UAUTH}/api/v1/services/${id}/arrangements/${qs ? `?${qs}` : ''}`;

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
