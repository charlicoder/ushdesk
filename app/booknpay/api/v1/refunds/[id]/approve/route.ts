import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * POST /booknpay/api/v1/refunds/[id]/approve/
 * Proxy to upstream booknpay — approves a refund request.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const baseUrl = getApiBaseUrl();
  const booknpay = getBooknpayPath();
  const url = `${baseUrl}${booknpay}/api/v1/refunds/${id}/approve/`;

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
    if (!upstream.ok) {
      console.error(`[POST /booknpay/api/v1/refunds/${id}/approve/] upstream ${upstream.status}:`, text);
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
