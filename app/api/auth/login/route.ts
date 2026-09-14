import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE_URL  = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const LOGIN_URL = `${BASE_URL}/api/v1/auth/login`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      // Forward the upstream error body so the client can show the real message
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
