import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const UAUTH    = process.env['API_UAUTH']    ?? '/uauth';

const UPSTREAM_URL = `${BASE_URL}${UAUTH}/api/v1/employees/leaves/`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `${UPSTREAM_URL}${id}/`;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
    });

    if (upstream.status === 204 || upstream.status === 205 || upstream.status === 304) {
      return new NextResponse(null, { status: upstream.status });
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = `${UPSTREAM_URL}${id}/`;

  try {
    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: getProxyHeaders(req),
    });

    if (upstream.status === 204 || upstream.status === 205 || upstream.status === 304) {
      return new NextResponse(null, { status: upstream.status });
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
