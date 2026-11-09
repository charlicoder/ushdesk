import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, unstable_cache } from 'next/cache';
import { createHash } from 'crypto';

import { getApiBaseUrl, getBooknpayPath, getDirectBooknpayUrl, getProxyHeaders } from '@/lib/proxy';

/**
 * Server-side (Next.js data cache) layer for the gift voucher list.
 *
 * - Entries are keyed by the signed-in user (hash of the bearer token) + the full query string, so
 *   one user's data is never served to another.
 * - They live for a short time (`revalidate`) and are tagged so a mutation can drop them at once
 *   (`invalidateVoucherCache`, called through POST /booknpay/api/v1/vouchers/cache/revalidate).
 * - Failed upstream calls are never cached.
 */
export const VOUCHER_CACHE_TAG = 'gift-vouchers';

class UpstreamError extends Error {
  constructor(public status: number, public body: string) {
    super(body);
  }
}

async function fetchUpstreamJson(path: string, qs: string, headers: Record<string, string>) {
  const gateway = `${getApiBaseUrl()}${getBooknpayPath()}${path}${qs ? `?${qs}` : ''}`;
  const directBase = getDirectBooknpayUrl();
  const direct = `${directBase ?? 'http://127.0.0.1:8003'}${path}${qs ? `?${qs}` : ''}`;

  let res: Response | null = null;
  try {
    res = await fetch(gateway, { headers, cache: 'no-store' });
    if (res.status === 502 || res.status === 504) res = null;
  } catch {
    res = null;
  }
  if (!res) res = await fetch(direct, { headers, cache: 'no-store' });

  const text = await res.text();
  if (!res.ok) throw new UpstreamError(res.status, text || res.statusText);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UpstreamError(502, 'Invalid upstream response');
  }
}

/** GET proxy with a short server-side cache. `?refresh=1` bypasses the cache (the result is not stored). */
export async function cachedVoucherGet(req: NextRequest, path: string, revalidateSeconds: number) {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const refresh = params.get('refresh') === '1';
  params.delete('refresh');
  const qs = params.toString();
  const headers = getProxyHeaders(req);

  const auth = req.headers.get('authorization') ?? req.cookies.get('ush_access_token')?.value ?? '';
  const userKey = createHash('sha256').update(auth).digest('hex').slice(0, 24);

  try {
    const data = refresh
      ? await fetchUpstreamJson(path, qs, headers)
      : await unstable_cache(() => fetchUpstreamJson(path, qs, headers), ['gift-vouchers', path, userKey, qs], {
          revalidate: revalidateSeconds,
          tags: [VOUCHER_CACHE_TAG],
        })();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof UpstreamError) {
      let body: unknown;
      try {
        body = JSON.parse(err.body);
      } catch {
        body = { detail: err.body };
      }
      return NextResponse.json(body, { status: err.status });
    }
    return NextResponse.json({ detail: err instanceof Error ? err.message : 'Proxy error' }, { status: 502 });
  }
}

export function invalidateVoucherCache() {
  revalidateTag(VOUCHER_CACHE_TAG, { expire: 0 });
}
