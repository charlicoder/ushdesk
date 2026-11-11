'use client';

/**
 * Gift voucher list API (ushdesk).
 *
 * - Server-driven paging / filtering / stats (see ushbooknpay `view=list`): one page at a time,
 *   slim rows only; full voucher details are fetched on demand.
 * - In-memory client cache (short TTL) so going back to a page, or opening a voucher twice, is instant.
 *   `prefetchVoucherPages` warms the next page(s) in the background.
 * - Server side, the same requests go through the Next.js data cache (see `lib/voucherProxy.ts`).
 */
import { authedFetch } from '@/lib/authedFetch';

const BASE = '/booknpay/api/v1/vouchers';
const TTL_MS = 60_000;
const MAX_ENTRIES = 80;
export const VOUCHER_PAGE_SIZE_CAP = 100;

export interface VoucherListFilters {
  statuses: string[];
  channel: string;
  createdBy: string;
  q: string;
  createdFrom?: string;
  createdTo?: string;
  redeemedFrom?: string;
  redeemedTo?: string;
  activatedFrom?: string;
  activatedTo?: string;
}

export interface VoucherPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VoucherStats {
  total: number;
  active: number;
  redeemed: number;
  expired: number;
  revenue: number;
  pending_revenue: number;
  amount_total: number;
  currency: string;
}

export interface VoucherCreator {
  id: string;
  name: string | null;
  role: string | null;
}

// ── tiny TTL cache ───────────────────────────────────────────────────────────

interface Entry {
  at: number;
  value: unknown;
}
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0; // bumped on invalidation so late responses of an older generation are not stored

function cacheGet<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return e.value as T;
}

function cacheSet(key: string, value: unknown, gen: number) {
  if (gen !== generation) return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

async function cached<T>(key: string, load: () => Promise<T>, refresh = false): Promise<T> {
  if (!refresh) {
    const hit = cacheGet<T>(key);
    if (hit !== undefined) return hit;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }
  const gen = generation;
  const p = load()
    .then((v) => {
      cacheSet(key, v, gen);
      return v;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Call after any voucher change (create / redeem / status / delete …). */
export function invalidateVoucherCaches(): void {
  generation += 1;
  cache.clear();
  inflight.clear();
  // Drop the Next.js server cache too (fire and forget)
  void authedFetch(`${BASE}/cache/revalidate`, { method: 'POST' }).catch(() => undefined);
}

// ── requests ─────────────────────────────────────────────────────────────────

function filterParams(f: VoucherListFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.statuses.length > 0 && f.statuses.length < 6) p.set('statuses', f.statuses.join(','));
  if (f.channel && f.channel !== 'all') p.set('channel', f.channel);
  if (f.createdBy && f.createdBy !== 'all') p.set('created_by', f.createdBy);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.createdFrom) p.set('created_from', f.createdFrom);
  if (f.createdTo) p.set('created_to', f.createdTo);
  if (f.redeemedFrom) p.set('redeemed_from', f.redeemedFrom);
  if (f.redeemedTo) p.set('redeemed_to', f.redeemedTo);
  if (f.activatedFrom) p.set('activated_from', f.activatedFrom);
  if (f.activatedTo) p.set('activated_to', f.activatedTo);
  return p;
}

async function getJson(url: string): Promise<any> {
  const res = await authedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).detail ?? (body as any)?.error?.message ?? `Error ${res.status}`);
  }
  return res.json();
}

function toPage<T>(json: any, page: number, pageSize: number): VoucherPage<T> {
  const pg = json?.meta?.pagination ?? {};
  const items: T[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : (json?.results ?? []);
  return {
    items,
    total: Number(pg.count ?? items.length),
    page: Number(pg.current_page ?? page),
    pageSize: Number(pg.page_size ?? pageSize),
    totalPages: Math.max(1, Number(pg.total_pages ?? 1)),
  };
}

export function fetchVoucherPage<T>(
  filters: VoucherListFilters,
  page: number,
  pageSize: number,
  opts: { view?: 'list' | 'report'; refresh?: boolean; extra?: Record<string, string> } = {},
): Promise<VoucherPage<T>> {
  const size = Math.min(pageSize, VOUCHER_PAGE_SIZE_CAP);
  const p = filterParams(filters);
  p.set('view', opts.view ?? 'list');
  p.set('page', String(page));
  p.set('page_size', String(size));
  Object.entries(opts.extra ?? {}).forEach(([k, v]) => p.set(k, v));
  const qs = p.toString();
  // `refresh=1` also bypasses the Next.js server cache
  const url = `${BASE}/?${qs}${opts.refresh ? '&refresh=1' : ''}`;
  return cached(`page:${qs}`, async () => toPage<T>(await getJson(url), page, size), opts.refresh);
}

/** Warm the cache for the given pages (errors are ignored). */
export function prefetchVoucherPages(
  filters: VoucherListFilters,
  pages: number[],
  pageSize: number,
  totalPages: number,
): void {
  pages
    .filter((n) => n >= 1 && n <= totalPages)
    .forEach((n) => {
      void fetchVoucherPage(filters, n, pageSize).catch(() => undefined);
    });
}

export function fetchVoucherStats(filters: VoucherListFilters, refresh = false): Promise<VoucherStats> {
  const qs = filterParams(filters).toString();
  return cached(
    `stats:${qs}`,
    async () =>
      ((await getJson(`${BASE}/stats/?${qs}${refresh ? `${qs ? '&' : ''}refresh=1` : ''}`)).data ?? {}) as VoucherStats,
    refresh,
  );
}

export function fetchVoucherCreators(): Promise<VoucherCreator[]> {
  return cached('creators', async () => ((await getJson(`${BASE}/creators/`)).data ?? []) as VoucherCreator[]);
}

/** Full voucher (all JSON fields) — loaded when a voucher is opened, then cached. */
export function fetchVoucherFull<T>(id: string, refresh = false): Promise<T> {
  return cached(
    `full:${id}`,
    async () => {
      const json = await getJson(`${BASE}/${encodeURIComponent(id)}/full/${refresh ? '?refresh=1' : ''}`);
      return (json?.data ?? json) as T;
    },
    refresh,
  );
}

export function peekVoucherFull<T>(id: string): T | undefined {
  return cacheGet<T>(`full:${id}`);
}

/**
 * Every row matching the filters, fetched page by page (100 per request, never one giant call).
 * Used only for explicit "select all" / export / sales-report actions.
 */
export async function fetchAllVoucherRows<T>(
  filters: VoucherListFilters,
  opts: { view?: 'list' | 'report'; extra?: Record<string, string>; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchVoucherPage<T>(filters, page, VOUCHER_PAGE_SIZE_CAP, { view: opts.view, extra: opts.extra });
    out.push(...res.items);
    totalPages = res.totalPages;
    opts.onProgress?.(out.length, res.total);
    page += 1;
  } while (page <= totalPages);
  return out;
}
