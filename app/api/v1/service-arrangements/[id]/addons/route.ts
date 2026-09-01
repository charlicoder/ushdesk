import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const UAUTH     = process.env.API_UAUTH     ?? '/uauth';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

/**
 * GET /api/v1/service-arrangements/[id]/addons
 *
 * Fetches the single arrangement detail and returns just the `addons` array.
 * The upstream endpoint returns the full arrangement object at top level
 * (no { data } wrapper), so we pluck the addons field.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }     = await params;
  const authHeader = req.headers.get('authorization') ?? '';
  const url        = `${BASE_URL}${UAUTH}/api/v1/service-arrangements/${id}/`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,
        'Authorization':  authHeader,
      },
    });
    const data = await upstream.json().catch(() => ({}));

    // The arrangement object has an `addons` array at the top level
    const addons = Array.isArray(data.addons)
      ? data.addons
      : Array.isArray(data.data?.addons)
        ? data.data.addons
        : [];

    return NextResponse.json(addons, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
