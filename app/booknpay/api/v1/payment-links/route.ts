import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /booknpay/api/v1/payment-links/
 * List payment links (?target_type=booking&target_id=...).
 */
export async function GET(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
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

/**
 * POST /booknpay/api/v1/payment-links/
 * Create & share a payment link.
 */
export async function POST(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/`;
  const body = await req.json().catch(() => ({}));

  try {
    const upstream = await fetch(url, {
      method: 'POST',
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

/**
 * DELETE /booknpay/api/v1/payment-links/?target_type=...&target_id=...
 * Cancel with gateway and delete payment link records for a target.
 */
export async function DELETE(req: NextRequest) {
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const qs = req.nextUrl.searchParams.toString();
  const url = `${baseUrl}${booknpay}/api/v1/payment-links/${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: getProxyHeaders(req),
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
