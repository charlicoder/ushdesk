import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const phone = req.nextUrl.searchParams.get('phone') || '';
  const queryStr = phone ? `?phone=${encodeURIComponent(phone)}` : '';
  const headers = getProxyHeaders(req);

  // 1. Try unified upstream endpoint from ushbooknpay
  try {
    const upstreamUrl = `${BASE_URL}/booknpay/api/v1/customers/${id}/analytics${queryStr}`;
    const upstream = await fetch(upstreamUrl, { headers, cache: 'no-store' });
    if (upstream.ok) {
      const data = await upstream.json().catch(() => null);
      if (data && data.success) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // If upstream direct call fails, fall back to aggregating individual endpoints
  }

  // 2. Fallback aggregation: fetch bookings, vouchers, and loyalty in parallel
  try {
    const [bookingsRes, vouchersRes, loyaltyRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/booknpay/api/v1/bookings/?customer_id=${id}&limit=100`, { headers, cache: 'no-store' }).then((r) => r.json()),
      fetch(`${BASE_URL}/booknpay/api/v1/vouchers/?limit=100`, { headers, cache: 'no-store' }).then((r) => r.json()),
      fetch(`${BASE_URL}/booknpay/api/v1/loyalty/admin/accounts/${id}/`, { headers, cache: 'no-store' }).then((r) => r.json()),
    ]);

    // Parse bookings
    let bookingsList: any[] = [];
    if (bookingsRes.status === 'fulfilled' && bookingsRes.value) {
      const val = bookingsRes.value;
      if (Array.isArray(val)) bookingsList = val;
      else if (Array.isArray(val?.results)) bookingsList = val.results;
      else if (Array.isArray(val?.data)) bookingsList = val.data;
    }

    // Filter to this customer (or phone)
    const custBookings = bookingsList.filter((b) => {
      const bCustId = String(b?.customer_id ?? (b?.customer_data?.id ?? ''));
      if (bCustId && bCustId.toLowerCase() === id.toLowerCase()) return true;
      if (phone) {
        const bPhone = String(b?.customer_data?.phone ?? b?.customer_data?.phone_number ?? b?.phone ?? '');
        if (bPhone && (bPhone.includes(phone) || phone.includes(bPhone))) return true;
      }
      return false;
    });

    const completedBookings = custBookings.filter((b) => String(b?.status).toLowerCase() === 'completed');
    const cancelledBookings = custBookings.filter((b) => String(b?.status).toLowerCase() === 'cancelled');
    const now = new Date();
    const upcomingBookings = custBookings.filter((b) => {
      const st = String(b?.status).toLowerCase();
      const apptDate = new Date(b?.appointment_start || b?.appointment_date || 0);
      return (st === 'confirmed' || st === 'requested' || st === 'in_progress') && apptDate >= now;
    });

    // Parse vouchers
    let vouchersList: any[] = [];
    if (vouchersRes.status === 'fulfilled' && vouchersRes.value) {
      const val = vouchersRes.value;
      if (Array.isArray(val)) vouchersList = val;
      else if (Array.isArray(val?.results)) vouchersList = val.results;
      else if (Array.isArray(val?.data)) vouchersList = val.data;
    }

    const sentVouchers = vouchersList.filter((v) => {
      const sId = String(v?.sender_id ?? (v?.sender_data?.id ?? ''));
      return sId && sId.toLowerCase() === id.toLowerCase();
    });

    const receivedVouchers = vouchersList.filter((v) => {
      const rId = String(v?.recipient_id ?? (v?.recipient_data?.id ?? ''));
      if (rId && rId.toLowerCase() === id.toLowerCase()) return true;
      if (phone) {
        const rPhone = String(v?.recipient_phone ?? v?.recipient_data?.phone_number ?? '');
        if (rPhone && (rPhone.includes(phone) || phone.includes(rPhone))) return true;
      }
      return false;
    });

    // Unique received excluding self-sent
    const sentIds = new Set(sentVouchers.map((v) => String(v.id)));
    const uniqueReceived = receivedVouchers.filter((v) => !sentIds.has(String(v.id)));

    const sentSpent = sentVouchers
      .filter((v) => !['cancelled', 'expired'].includes(String(v?.status).toLowerCase()))
      .reduce((acc, v) => acc + (parseFloat(v?.total_amount) || 0), 0);

    const bookingSpent = custBookings
      .filter((b) => String(b?.status).toLowerCase() === 'completed' || ['paid', 'success'].includes(String(b?.payment_status).toLowerCase()))
      .reduce((acc, b) => acc + (parseFloat(b?.total_amount) || 0), 0);

    const totalSpent = Number((bookingSpent + sentSpent).toFixed(3));
    const totalOrders = completedBookings.length + sentVouchers.length;
    const avgOrderValue = totalOrders > 0 ? Number((totalSpent / totalOrders).toFixed(3)) : 0;

    // Parse loyalty
    let loyaltyData = {
      is_enrolled: false,
      balance_points: 0,
      total_earned: 0,
      total_redeemed: 0,
      points_expire_at: null as string | null,
      is_expired: false,
      points_value_kwd: 0,
      recent_transactions: [] as any[],
    };

    if (loyaltyRes.status === 'fulfilled' && loyaltyRes.value && !loyaltyRes.value.detail) {
      const l = loyaltyRes.value;
      const balance = Number(l?.balance_points ?? 0);
      loyaltyData = {
        is_enrolled: true,
        balance_points: balance,
        total_earned: Number(l?.total_earned ?? 0),
        total_redeemed: Number(l?.total_redeemed ?? 0),
        points_expire_at: l?.points_expire_at || null,
        is_expired: Boolean(l?.is_expired),
        points_value_kwd: Number((balance / 10).toFixed(3)),
        recent_transactions: Array.isArray(l?.recent_transactions) ? l.recent_transactions : [],
      };
    }

    // Dates & visit calculation
    let firstBookingDate: string | null = null;
    let lastVisitDate: string | null = null;
    let daysSinceLastVisit: number | null = null;

    if (custBookings.length > 0) {
      const sorted = [...custBookings].sort((a, b) => new Date(a.appointment_start || a.appointment_date || 0).getTime() - new Date(b.appointment_start || b.appointment_date || 0).getTime());
      firstBookingDate = sorted[0]?.appointment_start || sorted[0]?.appointment_date || sorted[0]?.created_at || null;
      if (completedBookings.length > 0) {
        const sortedCompleted = [...completedBookings].sort((a, b) => new Date(b.appointment_start || b.appointment_date || 0).getTime() - new Date(a.appointment_start || a.appointment_date || 0).getTime());
        lastVisitDate = sortedCompleted[0]?.appointment_start || sortedCompleted[0]?.appointment_date || null;
        if (lastVisitDate) {
          const diffMs = now.getTime() - new Date(lastVisitDate).getTime();
          daysSinceLastVisit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }
    }

    // Marketing counters
    const serviceCounts: Record<string, number> = {};
    const branchCounts: Record<string, number> = {};
    const therapistCounts: Record<string, number> = {};
    const dayCounts: Record<string, number> = {};
    let totalMinutes = 0;

    for (const b of custBookings) {
      if (String(b?.status).toLowerCase() !== 'cancelled') {
        const sName = b?.service_data?.name || b?.service_name;
        if (sName) serviceCounts[sName] = (serviceCounts[sName] || 0) + 1;

        const brName = b?.branch_data?.name || b?.branch_name;
        if (brName) branchCounts[brName] = (branchCounts[brName] || 0) + 1;

        const thName = b?.therapist_data?.name || b?.therapist_data?.full_name || b?.therapist_name;
        if (thName) therapistCounts[thName] = (therapistCounts[thName] || 0) + 1;

        const d = new Date(b?.appointment_start || b?.appointment_date || 0);
        if (!isNaN(d.getTime())) {
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        }

        totalMinutes += (Number(b?.duration_minutes) || 0) + (Number(b?.extra_minutes) || 0);
      }
    }

    const topItem = (counts: Record<string, number>) => {
      const entries = Object.entries(counts);
      if (!entries.length) return { name: null, count: 0 };
      entries.sort((a, b) => b[1] - a[1]);
      return { name: entries[0][0], count: entries[0][1] };
    };

    const favService = topItem(serviceCounts);
    const prefBranch = topItem(branchCounts).name;
    const prefTherapist = topItem(therapistCounts).name;
    const prefDay = topItem(dayCounts).name;

    // Customer tier
    let tier = 'New Customer';
    if (totalSpent >= 250 || completedBookings.length >= 6) {
      tier = 'VIP Elite';
    } else if (totalSpent >= 120 || completedBookings.length >= 3) {
      tier = 'Regular Loyal';
    } else if (completedBookings.length >= 1 || sentVouchers.length >= 1) {
      tier = 'Occasional';
    } else if (custBookings.length > 0) {
      tier = 'New Lead';
    }

    const cancellationRate = custBookings.length > 0 ? Number(((cancelledBookings.length / custBookings.length) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      customer_id: id,
      phone,
      loyalty: loyaltyData,
      gift_vouchers: {
        total_count: sentVouchers.length + uniqueReceived.length,
        sent_count: sentVouchers.length,
        received_count: uniqueReceived.length,
        active_count: sentVouchers.concat(uniqueReceived).filter((v) => String(v?.status).toLowerCase() === 'active').length,
        redeemed_count: sentVouchers.concat(uniqueReceived).filter((v) => String(v?.status).toLowerCase() === 'redeemed').length,
        total_spent_on_vouchers: Number(sentSpent.toFixed(3)),
        currency: 'KWD',
        sent_vouchers: sentVouchers.slice(0, 10).map((v) => ({
          id: String(v.id),
          voucher_number: v.voucher_number || null,
          recipient_name: v.recipient_data?.name || null,
          recipient_phone: v.recipient_phone || null,
          sender_name: v.sender_data?.name || null,
          total_amount: parseFloat(v.total_amount) || 0,
          status: String(v.status || 'created'),
          created_at: v.created_at || null,
          redeemed_at: v.redeemed_at || null,
        })),
        received_vouchers: uniqueReceived.slice(0, 10).map((v) => ({
          id: String(v.id),
          voucher_number: v.voucher_number || null,
          recipient_name: v.recipient_data?.name || null,
          recipient_phone: v.recipient_phone || null,
          sender_name: v.sender_data?.name || null,
          total_amount: parseFloat(v.total_amount) || 0,
          status: String(v.status || 'created'),
          created_at: v.created_at || null,
          redeemed_at: v.redeemed_at || null,
        })),
      },
      financials: {
        total_spent: totalSpent,
        total_spent_bookings: Number(bookingSpent.toFixed(3)),
        total_spent_vouchers: Number(sentSpent.toFixed(3)),
        total_refunded: 0,
        net_revenue: totalSpent,
        average_order_value: avgOrderValue,
        currency: 'KWD',
        total_transactions: totalOrders,
      },
      sales_and_bookings: {
        total_bookings: custBookings.length,
        completed_bookings: completedBookings.length,
        upcoming_bookings: upcomingBookings.length,
        cancelled_bookings: cancelledBookings.length,
        cancellation_rate_pct: cancellationRate,
        first_booking_date: firstBookingDate,
        last_visit_date: lastVisitDate,
        days_since_last_visit: daysSinceLastVisit,
        recent_bookings: custBookings.slice(0, 10).map((b) => ({
          id: String(b.id),
          booking_number: b.booking_number || null,
          invoice_number: b.invoice_number || null,
          service_name: b.service_data?.name || b.service_name || null,
          branch_name: b.branch_data?.name || b.branch_name || null,
          therapist_name: b.therapist_data?.name || b.therapist_data?.full_name || b.therapist_name || null,
          appointment_date: b.appointment_start || b.appointment_date || null,
          total_amount: parseFloat(b.total_amount) || 0,
          status: String(b.status || 'requested'),
          payment_status: String(b.payment_status || 'pending'),
        })),
      },
      marketing_analytics: {
        customer_tier: tier,
        favorite_service: favService.name,
        favorite_service_count: favService.count,
        preferred_branch: prefBranch,
        preferred_therapist: prefTherapist,
        preferred_day_of_week: prefDay,
        preferred_time_slot: 'Afternoon (12:00 - 17:00)',
        total_treatment_hours: Number((totalMinutes / 60).toFixed(1)),
        lifecycle_status: daysSinceLastVisit !== null && daysSinceLastVisit > 90 ? 'At Risk / Inactive' : 'Active',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analytics aggregation failed';
    return NextResponse.json({ success: false, detail: msg }, { status: 500 });
  }
}
