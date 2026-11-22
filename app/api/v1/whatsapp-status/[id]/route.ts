import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getNoticePath, getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/whatsapp-status/[id]
 * Proxies → ushnotice /v1/notifications/{id}
 * Returns full attempt history (wamid, error_code, error_message, latency) and status transitions.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const baseUrl = getApiBaseUrl();
  const noticePath = getNoticePath();

  const encodedId = encodeURIComponent(id);
  const gatewayUrl = `${baseUrl}${noticePath}/v1/notifications/${encodedId}`;
  const isLocal = baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost');
  const directUrl = isLocal ? `http://127.0.0.1:8004/v1/notifications/${encodedId}` : null;

  const headers = getProxyHeaders(req);

  // Attempt 1: via Kong gateway
  try {
    const upstream = await fetch(gatewayUrl, { headers, cache: 'no-store' });
    if (upstream.status !== 502 && upstream.status !== 504) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    }
  } catch {
    // Gateway unreachable
  }

  // Attempt 2: direct to local ushnotice
  if (directUrl) {
    try {
      const upstream = await fetch(directUrl, { headers, cache: 'no-store' });
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy error';
      return NextResponse.json({ detail: message }, { status: 502 });
    }
  }

  return NextResponse.json({ detail: 'Cannot reach notification service' }, { status: 502 });
}
