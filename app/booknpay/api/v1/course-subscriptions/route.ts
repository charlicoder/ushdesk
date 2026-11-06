import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getBooknpayPath, getDirectBooknpayUrl, getProxyHeaders } from '@/lib/proxy';

async function proxyToBooknpay(url: string, init: RequestInit, fallbackUrl: string): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return await fetch(fallbackUrl, init);
    }
    return res;
  } catch {
    return await fetch(fallbackUrl, init);
  }
}

export async function GET(req: NextRequest) {
  try {
    const qs = new URL(req.url).searchParams.toString();
    const suffix = `/api/v1/course-subscriptions/${qs ? `?${qs}` : ''}`;
    const targetUrl = `${getApiBaseUrl()}${getBooknpayPath()}${suffix}`;
    const fallbackUrl = `${getDirectBooknpayUrl()}${suffix}`;

    const res = await proxyToBooknpay(
      targetUrl,
      { method: 'GET', headers: getProxyHeaders(req) },
      fallbackUrl
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const suffix = '/api/v1/course-subscriptions/';
    const targetUrl = `${getApiBaseUrl()}${getBooknpayPath()}${suffix}`;
    const fallbackUrl = `${getDirectBooknpayUrl()}${suffix}`;

    const res = await proxyToBooknpay(
      targetUrl,
      { method: 'POST', headers: getProxyHeaders(req), body: JSON.stringify(body) },
      fallbackUrl
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
