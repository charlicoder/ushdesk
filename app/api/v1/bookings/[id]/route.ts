import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/${id}/`;

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/${id}/`;

  try {
    const body = await req.json().catch(() => ({}));
    const upstream = await fetch(url, {
      method: 'PATCH',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/bookings/${id}/`;

  try {
    const body = await req.json().catch(() => ({}));
    const upstream = await fetch(url, {
      method: 'PUT',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

