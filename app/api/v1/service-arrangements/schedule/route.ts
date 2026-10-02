import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const UAUTH    = process.env['API_UAUTH']    ?? '/uauth';

const UPSTREAM_URL = `${BASE_URL}${UAUTH}/api/v1/service-arrangements/schedule/`;

export async function GET(req: NextRequest) {
  // Forward all query params (branch_id, date, etc.)
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const url    = `${UPSTREAM_URL}?${params.toString()}`;

  try {
    const headers = getProxyHeaders(req);
    const upstream = await fetch(url, {
      headers,
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));

    // If response contains bookings, enrich them with status and payment_status from booknpay
    if (upstream.ok && Array.isArray(data) && data.length > 0) {
      const hasBookings = data.some((rec: any) => Array.isArray(rec?.bookings) && rec.bookings.length > 0);
      if (hasBookings) {
        const branchId = req.nextUrl.searchParams.get('branch_id') ?? '';
        const date = req.nextUrl.searchParams.get('date') ?? '';
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
        const branchParam = isUuid ? `&branch_id=${branchId}` : '';

        const payMap = new Map<string, string>();
        const statusMap = new Map<string, string>();

        try {
          const bpUrl = date
            ? `${BASE_URL}/booknpay/api/v1/bookings/?date=${date}${branchParam}&page_size=100`
            : `${BASE_URL}/booknpay/api/v1/bookings/?page_size=100`;

          const res = await fetch(bpUrl, { headers, cache: 'no-store' }).catch(() => null);
          if (res && res.ok) {
            const json = await res.json().catch(() => null);
            if (json) {
              const list = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
              for (const item of list) {
                const ps = String(item?.payment_status ?? item?.payment_data?.status ?? '').toLowerCase().trim();
                const st = String(item?.status ?? item?.booking_status ?? '').toLowerCase().trim();
                const ids = [item.id, item.booking_id, item.bookings_id].filter(Boolean).map(String);
                for (const id of ids) {
                  if (ps) payMap.set(id, ps);
                  if (st) statusMap.set(id, st);
                }
              }
            }
          }

          if (payMap.size > 0 || statusMap.size > 0) {
            for (const record of data) {
              if (!Array.isArray(record?.bookings)) continue;
              for (const bk of record.bookings) {
                const matchId = [
                  String(bk.booking_id ?? ''),
                  String(bk.bookings_id ?? ''),
                  String(bk.id ?? ''),
                ].find(id => id && (payMap.has(id) || statusMap.has(id)));

                if (matchId) {
                  if (payMap.has(matchId)) {
                    bk.payment_status = payMap.get(matchId);
                  }
                  if (statusMap.has(matchId)) {
                    bk.status = statusMap.get(matchId);
                  }
                }
              }
            }
          }
        } catch {
          // Enrichment failure is non-fatal
        }
      }
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
