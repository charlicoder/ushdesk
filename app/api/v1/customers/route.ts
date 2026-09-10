import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const UAUTH     = process.env.API_UAUTH     ?? '/uauth';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const CUSTOMERS_URL = `${BASE_URL}${UAUTH}/api/v1/customers/`;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  // Forward all query params (search, page, page_size, etc.)
  const params = req.nextUrl.searchParams.toString();
  const url    = params ? `${CUSTOMERS_URL}?${params}` : CUSTOMERS_URL;

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
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  try {
    const body = await req.json();

    const upstream = await fetch(CUSTOMERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'X-USHSPA-TOKEN': APP_TOKEN,
        'Authorization':  authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
