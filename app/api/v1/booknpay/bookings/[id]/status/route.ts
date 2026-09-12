import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

/**
 * PATCH /api/v1/booknpay/bookings/[id]/status
 *
 * Forwards a status update to the upstream booknpay service.
 * Example body: { status: "confirmed", payment_status: "pending", reason: "..." }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }     = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const body       = await req.json().catch(() => ({}));
  const url        = `${BASE_URL}/booknpay/api/v1/bookings/${id}/status/`;

  // Only forward Authorization header when a real token is present
  const upstreamHeaders: Record<string, string> = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'X-USHSPA-TOKEN': APP_TOKEN,
  };
  if (authHeader && authHeader.replace('Bearer ', '').trim()) {
    upstreamHeaders['Authorization'] = authHeader;
  }

  const payload = {
    status: body.status ?? 'confirmed',
    ...body,
  };

  try {
    const upstream = await fetch(url, {
      method: 'PATCH',
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export const POST = PATCH;

