import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders, getApiBaseUrl, getBooknpayPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

/**
 * PATCH /booknpay/api/v1/bookings/[id]/sessions/[sessionId]/therapist
 * Proxy to upstream booknpay service — change the therapist of ONE session.
 * Example body: { therapist_id: "...", therapist_data: {...} }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { id, sessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const url = `${getApiBaseUrl()}${getBooknpayPath()}/api/v1/bookings/${id}/sessions/${sessionId}/therapist/`;

  try {
    const upstream = await fetch(url, {
      method: 'PATCH',
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
      console.error(`[PATCH session therapist ${id}/${sessionId}] upstream ${upstream.status}:`, text);
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    console.error(`[PATCH session therapist ${id}/${sessionId}] proxy error:`, err);
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

