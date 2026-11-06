import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getUauthPath, getDirectUauthUrl, getProxyHeaders } from '@/lib/proxy';

async function proxyToUauth(url: string, init: RequestInit, fallbackUrl: string): Promise<Response> {
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
    const sp = new URL(req.url).searchParams;
    if (!sp.has('all')) {
      sp.set('all', 'true');
    }
    const qs = sp.toString();
    const suffix = `/api/v1/courses/${qs ? `?${qs}` : ''}`;
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl()}${suffix}`;

    const res = await proxyToUauth(
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
    const body = await req.json();
    const suffix = '/api/v1/courses/';
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl()}${suffix}`;

    const res = await proxyToUauth(
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
