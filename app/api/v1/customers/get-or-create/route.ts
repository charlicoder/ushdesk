import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const UAUTH    = process.env['API_UAUTH']    ?? '/uauth';

const GET_OR_CREATE_URL = `${BASE_URL}${UAUTH}/api/v1/customers/get-or-create/`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let upstream = await fetch(GET_OR_CREATE_URL, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
    });

    // If upstream rejects and full_name has no last name, retry by adding a '.' in last_name
    if (!upstream.ok && body?.full_name && typeof body.full_name === 'string' && !body.full_name.trim().includes(' ')) {
      const retryBody = {
        ...body,
        full_name: `${body.full_name.trim()} .`,
      };
      const retryUpstream = await fetch(GET_OR_CREATE_URL, {
        method: 'POST',
        headers: getProxyHeaders(req),
        body: JSON.stringify(retryBody),
      });
      if (retryUpstream.ok) {
        upstream = retryUpstream;
      }
    }

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
