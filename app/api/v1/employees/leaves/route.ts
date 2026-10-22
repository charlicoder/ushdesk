import { NextRequest, NextResponse } from 'next/server';

import { getProxyHeaders } from '@/lib/proxy';
import { getCurrentKuwaitDateTime, parseClockToMinutes } from '@/lib/datetime';


export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';
const UAUTH    = process.env['API_UAUTH']    ?? '/uauth';

const UPSTREAM_URL = `${BASE_URL}${UAUTH}/api/v1/employees/leaves/`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const queryString = searchParams.toString();
  const url = queryString ? `${UPSTREAM_URL}?${queryString}` : UPSTREAM_URL;

  try {
    const upstream = await fetch(url, {
      headers: getProxyHeaders(req),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const leaveDate = body?.leave_date ? String(body.leave_date).split('T')[0] : '';
    const startTime = body?.start_time ? String(body.start_time) : '';
    const { dateStr, timeStr, minutes } = getCurrentKuwaitDateTime();

    if (leaveDate && leaveDate < dateStr) {
      return NextResponse.json(
        { detail: 'Cannot add leave for a past date.' },
        { status: 400 },
      );
    }
    if (leaveDate && leaveDate === dateStr && startTime) {
      const startMin = parseClockToMinutes(startTime);
      if (startMin <= minutes) {
        return NextResponse.json(
          { detail: `Cannot add leave for past date and time. Start time must be after ${timeStr}.` },
          { status: 400 },
        );
      }
    }

    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: getProxyHeaders(req),
      body: JSON.stringify(body),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

