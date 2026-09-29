import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getProxyHeaders, getUanrPath } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const DEFAULT_COMPANY_ID = '20bf55dd-7db8-40d1-a2f8-f9da6bb61b68';
const LOCAL_DIRECT_URL = 'http://127.0.0.1:8007/api/v1';

async function proxyRequest(req: NextRequest, slug: string[], method: string) {
  const path = slug.join('/') + (slug[slug.length - 1]?.includes('.') ? '' : '/');
  
  const searchParams = new URLSearchParams(req.nextUrl.searchParams.toString());
  if (!searchParams.has('company_id')) {
    searchParams.set('company_id', DEFAULT_COMPANY_ID);
  }
  const search = `?${searchParams.toString()}`;

  const baseUrl = getApiBaseUrl();
  const uanr = getUanrPath();
  const gatewayUrl = `${baseUrl}${uanr}/api/v1/${path}${search}`;
  const directUrl = `${LOCAL_DIRECT_URL}/${path}${search}`;

  const headers = getProxyHeaders(req);
  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  // Attempt 1: Gateway proxy
  try {
    const res = await fetch(gatewayUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    if (res.status !== 502 && res.status !== 504) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }
  } catch {
    // Gateway down or not responding, fallback to direct local instance
  }

  // Attempt 2: Direct local fallback
  try {
    const res = await fetch(directUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Accounting proxy error';
    console.error('[UANR Proxy Error]', err);
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, slug, 'GET');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, slug, 'POST');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, slug, 'PUT');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, slug, 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, slug, 'DELETE');
}
