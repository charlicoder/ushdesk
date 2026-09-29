import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl, getProxyHeaders, getUanrPath, getDefaultCompanyId } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const LOCAL_DIRECT_URL = 'http://127.0.0.1:8007/api/v1';

let cachedCompanyId: string | null = null;

async function resolveCompanyId(
  req: NextRequest,
  baseUrl: string,
  uanr: string,
  headers: Record<string, string>,
): Promise<string> {
  // 1. Explicit query param, header, or cookie
  const queryId = req.nextUrl.searchParams.get('company_id');
  if (queryId && queryId.trim()) return queryId.trim();

  const headerId = req.headers.get('x-company-id');
  if (headerId && headerId.trim()) return headerId.trim();

  const cookieId = req.cookies.get('company_id')?.value;
  if (cookieId && cookieId.trim()) return cookieId.trim();

  // 2. In-memory cached company ID
  if (cachedCompanyId) return cachedCompanyId;

  // 3. Fallback configured in environment variables / helper
  const defaultEnvId = getDefaultCompanyId();
  if (defaultEnvId && defaultEnvId !== 'f70caa2a-a435-4928-b7b1-7cb016619848') {
    cachedCompanyId = defaultEnvId;
    return cachedCompanyId;
  }

  // 4. Dynamic discovery from backend /companies/
  const candidateUrls = [
    `${baseUrl}${uanr}/api/v1/companies/`,
    `${LOCAL_DIRECT_URL}/companies/`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const items = json?.data?.items ?? json?.items ?? (Array.isArray(json?.data) ? json.data : []);
        const active = items.find((c: any) => c.is_active) || items[0];
        if (active?.id) {
          cachedCompanyId = active.id;
          return active.id;
        }
      }
    } catch {
      // Ignore and try next
    }
  }

  cachedCompanyId = defaultEnvId || 'f70caa2a-a435-4928-b7b1-7cb016619848';
  return cachedCompanyId;
}

async function proxyRequest(req: NextRequest, slug: string[], method: string) {
  const path = slug.join('/') + (slug[slug.length - 1]?.includes('.') ? '' : '/');
  const baseUrl = getApiBaseUrl();
  const uanr = getUanrPath();
  const headers = getProxyHeaders(req);

  const searchParams = new URLSearchParams(req.nextUrl.searchParams.toString());
  const isCompaniesEndpoint = slug.length > 0 && slug[0] === 'companies';

  if (!isCompaniesEndpoint) {
    const companyId = await resolveCompanyId(req, baseUrl, uanr, headers);
    if (companyId && !searchParams.has('company_id')) {
      searchParams.set('company_id', companyId);
    }
  }

  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const gatewayUrl = `${baseUrl}${uanr}/api/v1/${path}${search}`;
  const directUrl = `${LOCAL_DIRECT_URL}/${path}${search}`;

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
