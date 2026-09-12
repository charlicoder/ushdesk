import { NextRequest, NextResponse } from 'next/server';

const BASE_URL  = process.env.API_BASE_URL  ?? 'http://127.0.0.1:8000';
const UAUTH     = process.env.API_UAUTH     ?? '/uauth';
const APP_TOKEN = process.env.API_APP_TOKEN ?? '';

const UPSTREAM_URL = `${BASE_URL}${UAUTH}/api/v1/therapists/schedule/`;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';

  // Forward all query params (branch_id, date, etc.)
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const url    = `${UPSTREAM_URL}?${params.toString()}`;

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

    // If response contains bookings, enrich them with payment_status
    if (upstream.ok && Array.isArray(data) && data.length > 0) {
      const hasBookings = data.some((rec: any) => Array.isArray(rec?.bookings) && rec.bookings.length > 0);
      if (hasBookings) {
        const branchId = req.nextUrl.searchParams.get('branch_id') ?? '';
        const date = req.nextUrl.searchParams.get('date') ?? '';
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
        const branchParam = isUuid ? `&branch_id=${branchId}` : '';

        const headers: Record<string, string> = {
          'Content-Type':   'application/json',
          'Accept':         'application/json',
          'X-USHSPA-TOKEN': APP_TOKEN,
          ...(authHeader ? { 'Authorization': authHeader } : {}),
        };

        const payMap = new Map<string, string>();

        try {
          const fetchPromises: Promise<any>[] = [];

          // 1. Fetch booknpay bookings with page_size=100 (max allowed is 100)
          const bpUrl = date
            ? `${BASE_URL}/booknpay/api/v1/bookings/?date=${date}${branchParam}&page_size=100`
            : `${BASE_URL}/booknpay/api/v1/bookings/?page_size=100`;

          fetchPromises.push(
            fetch(bpUrl, { headers })
              .then(res => (res.ok ? res.json() : null))
              .then(json => {
                if (!json) return;
                const list = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
                for (const item of list) {
                  const ps = String(item?.payment_status ?? item?.payment_data?.status ?? '').toLowerCase().trim();
                  if (ps) {
                    if (item.id) payMap.set(String(item.id), ps);
                    if (item.booking_id) payMap.set(String(item.booking_id), ps);
                    if (item.bookings_id) payMap.set(String(item.bookings_id), ps);
                  }
                }
              })
              .catch(() => null)
          );

          // 2. Fetch service-arrangements schedule if branch_id is valid UUID and date is present
          if (isUuid && date) {
            const saUrl = `${BASE_URL}${UAUTH}/api/v1/service-arrangements/schedule/?branch_id=${branchId}&date=${date}`;
            fetchPromises.push(
              fetch(saUrl, { headers })
                .then(res => (res.ok ? res.json() : null))
                .then(json => {
                  if (!json) return;
                  const records = Array.isArray(json) ? json : [json];
                  for (const rec of records) {
                    const bks = Array.isArray(rec?.bookings) ? rec.bookings : [];
                    for (const item of bks) {
                      const ps = String(item?.payment_status ?? '').toLowerCase().trim();
                      if (ps) {
                        if (item.id) payMap.set(String(item.id), ps);
                        if (item.booking_id) payMap.set(String(item.booking_id), ps);
                        if (item.bookings_id) payMap.set(String(item.bookings_id), ps);
                      }
                    }
                  }
                })
                .catch(() => null)
            );
          }

          await Promise.allSettled(fetchPromises);

          if (payMap.size > 0) {
            for (const record of data) {
              if (!Array.isArray(record?.bookings)) continue;
              for (const bk of record.bookings) {
                if (!bk.payment_status) {
                  const matchedStatus =
                    payMap.get(String(bk.booking_id ?? '')) ||
                    payMap.get(String(bk.bookings_id ?? '')) ||
                    payMap.get(String(bk.id ?? ''));
                  if (matchedStatus) {
                    bk.payment_status = matchedStatus;
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
