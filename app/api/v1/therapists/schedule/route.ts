import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const UAUTH    = process.env['API_UAUTH']    ?? '/uauth';

const UPSTREAM_URL = `${BASE_URL}${UAUTH}/api/v1/therapists/schedule/`;

export async function GET(req: NextRequest) {
  // Forward all query params (branch_id, date, etc.)
  const params = new URLSearchParams(req.nextUrl.searchParams.toString());
  const url    = `${UPSTREAM_URL}?${params.toString()}`;
  const headers = getProxyHeaders(req);

  try {
    const upstream = await fetch(url, {
      headers,
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));

    // Enrich bookings with booknpay data and append any missing booknpay bookings
    if (upstream.ok && Array.isArray(data) && data.length > 0) {
      const branchId = req.nextUrl.searchParams.get('branch_id') ?? '';
      const date = req.nextUrl.searchParams.get('date') ?? '';
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
      const branchParam = isUuid ? `&branch_id=${branchId}` : '';

      const payMap = new Map<string, string>();
      const statusMap = new Map<string, string>();
      const sessionsMap = new Map<string, any[]>();
      const secTherapistMap = new Map<string, string>();
      const bpBookings: any[] = [];

      try {
        const fetchPromises: Promise<any>[] = [];

        // 1. Fetch booknpay bookings with page_size=100 (max allowed is 100)
        const bpUrl = date
          ? `${BASE_URL}/booknpay/api/v1/bookings/?date=${date}${branchParam}&page_size=100`
          : `${BASE_URL}/booknpay/api/v1/bookings/?page_size=100`;

        fetchPromises.push(
          fetch(bpUrl, { headers, cache: 'no-store' })
            .then(res => (res.ok ? res.json() : null))
            .then(json => {
              if (!json) return;
              const list = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
              for (const item of list) {
                bpBookings.push(item);
                const ps = String(item?.payment_status ?? item?.payment_data?.status ?? '').toLowerCase().trim();
                const st = String(item?.status ?? item?.booking_status ?? '').toLowerCase().trim();
                const secTid = item?.secondary_therapist_id || (item?.secondary_therapist_data as any)?.id;
                const ids = [item.id, item.booking_id, item.bookings_id, item.booking_number].filter(Boolean).map(String);
                for (const id of ids) {
                  if (ps) payMap.set(id, ps);
                  if (st) statusMap.set(id, st);
                  if (secTid) secTherapistMap.set(id, String(secTid).toLowerCase().trim());
                  if (Array.isArray(item.sessions) && item.sessions.length > 0) {
                    sessionsMap.set(id, item.sessions);
                  }
                }
              }
            })
            .catch(() => null)
        );

        // 2. Fetch service-arrangements schedule if branch_id is valid UUID and date is present
        if (isUuid && date) {
          const saUrl = `${BASE_URL}${UAUTH}/api/v1/service-arrangements/schedule/?branch_id=${branchId}&date=${date}`;
          fetchPromises.push(
            fetch(saUrl, { headers, cache: 'no-store' })
              .then(res => (res.ok ? res.json() : null))
              .then(json => {
                if (!json) return;
                const records = Array.isArray(json) ? json : [json];
                for (const rec of records) {
                  const bks = Array.isArray(rec?.bookings) ? rec.bookings : [];
                  for (const item of bks) {
                    const ps = String(item?.payment_status ?? '').toLowerCase().trim();
                    const st = String(item?.status ?? item?.booking_status ?? '').toLowerCase().trim();
                    const ids = [item.id, item.booking_id, item.bookings_id, item.booking_number].filter(Boolean).map(String);
                    for (const id of ids) {
                      if (ps) payMap.set(id, ps);
                      if (st) statusMap.set(id, st);
                    }
                  }
                }
              })
              .catch(() => null)
          );
        }

        await Promise.allSettled(fetchPromises);

        for (const record of data) {
          if (!record) continue;
          if (!Array.isArray(record.bookings)) {
            record.bookings = [];
          }

          const existingIds = new Set<string>();

          // Enrich existing bookings
          for (const bk of record.bookings) {
            [bk.booking_id, bk.bookings_id, bk.id, bk.reference].filter(Boolean).forEach(id => {
              existingIds.add(String(id).toLowerCase().trim());
            });

            const matchId = [
              String(bk.booking_id ?? ''),
              String(bk.bookings_id ?? ''),
              String(bk.id ?? ''),
              String(bk.reference ?? ''),
            ].find(id => id && (payMap.has(id) || statusMap.has(id) || sessionsMap.has(id) || secTherapistMap.has(id)));

            if (matchId) {
              if (payMap.has(matchId)) {
                bk.payment_status = payMap.get(matchId);
              }
              if (statusMap.has(matchId)) {
                bk.status = statusMap.get(matchId);
              }
              if (sessionsMap.has(matchId)) {
                bk.sessions = sessionsMap.get(matchId);
              }
              if (secTherapistMap.has(matchId) && !bk.secondary_therapist_id) {
                bk.secondary_therapist_id = secTherapistMap.get(matchId);
              }
            }
          }

          // Append any bookings from booknpay not yet present in record.bookings
          for (const item of bpBookings) {
            const rawStatus = String(item?.status ?? item?.booking_status ?? '').toLowerCase().trim();
            if (rawStatus === 'cancelled' || rawStatus === 'refunded' || rawStatus === 'parked') continue;

            const itemTherapistId = String(item.therapist_id || (item.therapist_data as any)?.id || '').toLowerCase().trim();
            const itemSecTherapistId = String(item.secondary_therapist_id || (item.secondary_therapist_data as any)?.id || '').toLowerCase().trim();
            const currentRecordTherapistId = String(record?.therapist?.id || record?.id || '').toLowerCase().trim();

            // A booking belongs to this therapist column if they are primary or secondary therapist
            const belongsToThisTherapist = currentRecordTherapistId && (
              currentRecordTherapistId === itemTherapistId || currentRecordTherapistId === itemSecTherapistId
            );
            if (!belongsToThisTherapist && currentRecordTherapistId) continue;

            const itemIds = [item.id, item.booking_id, item.bookings_id, item.booking_number]
              .filter(Boolean)
              .map(id => String(id).toLowerCase().trim());
            const alreadyExists = itemIds.some(id => existingIds.has(id));

            if (!alreadyExists) {
              const rawCust = item.customer || item.customer_data;
              const rawSvc = item.service || item.service_data;
              const isSecondaryForThisTherapist = currentRecordTherapistId === itemSecTherapistId && itemSecTherapistId !== itemTherapistId;
              const newBk: any = {
                id: String(item.id || item.booking_id || item.bookings_id),
                booking_id: String(item.id || item.booking_id || item.bookings_id),
                therapist_id: currentRecordTherapistId || itemTherapistId,
                secondary_therapist_id: item.secondary_therapist_id ? String(item.secondary_therapist_id) : undefined,
                is_secondary_therapist: isSecondaryForThisTherapist,
                start: item.appointment_start || item.start,
                end: item.appointment_end || item.end,
                duration_minutes: item.duration_minutes || item.total_duration,
                status: rawStatus || 'scheduled',
                payment_status: String(item.payment_status ?? item.payment_data?.status ?? '').toLowerCase().trim() || undefined,
                booking_type: item.booking_type || item.type,
                customer: rawCust ? {
                  name: rawCust.name || rawCust.full_name || `${rawCust.first_name ?? ''} ${rawCust.last_name ?? ''}`.trim(),
                  phone: rawCust.phone,
                  first_name: rawCust.first_name,
                  last_name: rawCust.last_name,
                } : null,
                service: rawSvc ? {
                  name: rawSvc.name || rawSvc.service_name,
                } : null,
                sessions: Array.isArray(item.sessions) ? item.sessions : undefined,
              };
              record.bookings.push(newBk);
              itemIds.forEach(id => existingIds.add(id));
            }
          }
        }
      } catch {
        // Enrichment failure is non-fatal
      }
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
