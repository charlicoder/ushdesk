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

async function handleRequest(
  req: NextRequest,
  paramsPromise: Promise<{ slug: string[] }>,
  method: string
) {
  try {
    const { slug } = await paramsPromise;
    const slugPath = slug.join('/');
    const qs = new URL(req.url).searchParams.toString();
    const suffix = `/api/v1/course-subscriptions/${slugPath}/${qs ? `?${qs}` : ''}`;
    const targetUrl = `${getApiBaseUrl()}${getBooknpayPath()}${suffix}`;
    const fallbackUrl = `${getDirectBooknpayUrl()}${suffix}`;

    const init: RequestInit = {
      method,
      headers: getProxyHeaders(req),
    };

    if (method !== 'GET' && method !== 'DELETE') {
      const text = await req.text();
      if (text) {
        init.body = text;
      } else {
        init.body = JSON.stringify({});
      }
    }

    const res = await proxyToBooknpay(targetUrl, init, fallbackUrl);
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(req, params, 'GET');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(req, params, 'POST');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(req, params, 'PUT');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(req, params, 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(req, params, 'DELETE');
}
