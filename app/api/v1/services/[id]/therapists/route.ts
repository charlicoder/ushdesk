import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getDirectUauthUrl, getApiBaseUrl, getUauthPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const qs     = req.nextUrl.searchParams.toString();
  const directUrl = getDirectUauthUrl();
  const baseUrl   = getApiBaseUrl();
  const uauthPath = getUauthPath();

  const url = directUrl
    ? `${directUrl}/api/v1/services/${id}/therapists/${qs ? `?${qs}` : ''}`
    : `${baseUrl}${uauthPath}/api/v1/services/${id}/therapists/${qs ? `?${qs}` : ''}`;

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
