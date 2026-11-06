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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const suffix = `/api/v1/courses/${id}/`;
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl() || 'http://127.0.0.1:8002'}${suffix}`;

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const suffix = `/api/v1/courses/${id}/`;
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl() || 'http://127.0.0.1:8002'}${suffix}`;

    const res = await proxyToUauth(
      targetUrl,
      { method: 'PUT', headers: getProxyHeaders(req), body: JSON.stringify(body) },
      fallbackUrl
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const suffix = `/api/v1/courses/${id}/`;
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl() || 'http://127.0.0.1:8002'}${suffix}`;

    const res = await proxyToUauth(
      targetUrl,
      { method: 'PATCH', headers: getProxyHeaders(req), body: JSON.stringify(body) },
      fallbackUrl
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const suffix = `/api/v1/courses/${id}/`;
    const targetUrl = `${getApiBaseUrl()}${getUauthPath()}${suffix}`;
    const fallbackUrl = `${getDirectUauthUrl() || 'http://127.0.0.1:8002'}${suffix}`;

    const res = await proxyToUauth(
      targetUrl,
      { method: 'DELETE', headers: getProxyHeaders(req) },
      fallbackUrl
    );
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

