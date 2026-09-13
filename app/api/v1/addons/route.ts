import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy';

const BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
const UAUTH    = process.env.API_UAUTH    ?? '/uauth';

const ADDONS_URL = `${BASE_URL}${UAUTH}/api/v1/addons/`;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  const url    = params ? `${ADDONS_URL}?${params}` : ADDONS_URL;

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
