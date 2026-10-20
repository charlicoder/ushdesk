import { NextRequest, NextResponse } from 'next/server';
import { getProxyHeaders } from '@/lib/proxy';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env['API_BASE_URL'] ?? 'https://apidev.ushspa.co';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = getProxyHeaders(req);

  // 1. Fetch employee details from uauth
  let employeeDetails: any = null;
  try {
    const empRes = await fetch(`${BASE_URL}/uauth/api/v1/employees/${id}/`, {
      headers,
      cache: 'no-store',
    });
    if (empRes.ok) {
      const empJson = await empRes.json().catch(() => null);
      employeeDetails = empJson?.data ?? empJson?.employee ?? empJson;
    }
  } catch {
    // Ignore employee fetch failure, will proceed to analytics
  }

  // 2. Try unified upstream endpoint from ushbooknpay
  try {
    const upstreamUrl = `${BASE_URL}/booknpay/api/v1/therapists/${id}/analytics`;
    const upstream = await fetch(upstreamUrl, { headers, cache: 'no-store' });
    if (upstream.ok) {
      const data = await upstream.json().catch(() => null);
      if (data && data.success) {
        return NextResponse.json({
          ...data,
          employee: employeeDetails,
        });
      }
    }
  } catch {
    // Upstream call failed or not yet deployed, fallback to local aggregation
  }

  // 3. Fallback aggregation: fetch bookings for this therapist
  try {
    const bookingsRes = await fetch(
      `${BASE_URL}/booknpay/api/v1/bookings/?therapist_id=${id}&limit=200`,
      { headers, cache: 'no-store' }
    ).then((r) => r.json()).catch(() => null);

    let bookingsList: any[] = [];
    if (bookingsRes) {
      if (Array.isArray(bookingsRes)) bookingsList = bookingsRes;
      else if (Array.isArray(bookingsRes?.results)) bookingsList = bookingsRes.results;
      else if (Array.isArray(bookingsRes?.data)) bookingsList = bookingsRes.data;
    }

    // Filter to this therapist
    const therapistBookings = bookingsList.filter((b) => {
      const bThId = String(b?.therapist_id ?? b?.therapist_data?.id ?? '');
      return !bThId || bThId.toLowerCase() === id.toLowerCase();
    });

    const now = new Date();
    const completedB = therapistBookings.filter((b) => String(b?.status).toLowerCase() === 'completed');
    const cancelledB = therapistBookings.filter((b) => String(b?.status).toLowerCase() === 'cancelled');
    const noShowB = therapistBookings.filter((b) => ['no_show', 'noshow'].includes(String(b?.status).toLowerCase()));
    const inProgressB = therapistBookings.filter((b) => String(b?.status).toLowerCase() === 'in_progress');
    const upcomingB = therapistBookings.filter((b) => {
      const st = String(b?.status).toLowerCase();
      const apptDate = new Date(b?.appointment_start || b?.appointment_date || 0);
      return ['confirmed', 'requested'].includes(st) && apptDate >= now;
    });

    const totalBookings = therapistBookings.length;
    const completedCount = completedB.length;
    const cancelledCount = cancelledB.length;
    const noShowCount = noShowB.length;

    const completionRate = totalBookings > 0 ? Number(((completedCount / totalBookings) * 100).toFixed(1)) : 0;
    const cancellationRate = totalBookings > 0 ? Number(((cancelledCount / totalBookings) * 100).toFixed(1)) : 0;
    const noShowRate = totalBookings > 0 ? Number(((noShowCount / totalBookings) * 100).toFixed(1)) : 0;
    const reliabilityScore = Math.max(0, Number((100 - (cancellationRate + noShowRate)).toFixed(1)));

    // Financial sums
    const grossSales = therapistBookings
      .filter((b) => String(b?.status).toLowerCase() !== 'cancelled')
      .reduce((sum, b) => sum + (parseFloat(b?.total_amount) || 0), 0);

    const completedSales = completedB
      .reduce((sum, b) => sum + (parseFloat(b?.total_amount) || 0), 0);

    const discountTotal = therapistBookings
      .filter((b) => String(b?.status).toLowerCase() !== 'cancelled')
      .reduce((sum, b) => sum + (parseFloat(b?.discount) || 0), 0);

    const addonRev = therapistBookings
      .filter((b) => String(b?.status).toLowerCase() !== 'cancelled')
      .reduce((sum, b) => sum + (parseFloat(b?.addon_price) || 0), 0);

    const extraTimeRev = therapistBookings
      .filter((b) => String(b?.status).toLowerCase() !== 'cancelled')
      .reduce((sum, b) => sum + (parseFloat(b?.price_for_extra_minutes) || 0), 0);

    const pendingRev = therapistBookings
      .filter((b) => String(b?.status).toLowerCase() !== 'cancelled' && ['pending', 'not_initiated', 'partial'].includes(String(b?.payment_status).toLowerCase()))
      .reduce((sum, b) => sum + (parseFloat(b?.total_amount) || 0), 0);

    const avgBookingVal = completedCount > 0
      ? Number((completedSales / completedCount).toFixed(3))
      : (totalBookings > 0 ? Number((grossSales / totalBookings).toFixed(3)) : 0);

    // Monthly trends
    const monthMap: Record<string, { count: number; completed: number; revenue: number }> = {};
    for (const b of therapistBookings) {
      const dt = new Date(b?.appointment_start || b?.appointment_date || b?.created_at || 0);
      if (!isNaN(dt.getTime())) {
        const mKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[mKey]) monthMap[mKey] = { count: 0, completed: 0, revenue: 0 };
        monthMap[mKey].count += 1;
        if (String(b?.status).toLowerCase() === 'completed') {
          monthMap[mKey].completed += 1;
          monthMap[mKey].revenue += parseFloat(b?.total_amount) || 0;
        }
      }
    }

    const monthlyTrends = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, data]) => ({
        month,
        booking_count: data.count,
        completed_count: data.completed,
        revenue: Number(data.revenue.toFixed(3)),
      }));

    // Clients & services tracking
    const clientsMap: Record<string, { name: string; phone: string | null; count: number; spent: number; last_visit: string | null }> = {};
    const servicesMap: Record<string, { name: string; service_id?: string; count: number; minutes: number; revenue: number }> = {};
    const branchesMap: Record<string, { name: string; branch_id?: string; count: number; revenue: number }> = {};
    const timeSlotsMap: Record<string, number> = {
      'Morning (Before 12:00)': 0,
      'Afternoon (12:00 - 17:00)': 0,
      'Evening (After 17:00)': 0,
    };
    const daysMap: Record<string, { count: number; revenue: number }> = {};

    let totalDurationMinutes = 0;
    let extraDurationMinutes = 0;
    let addonsDurationMinutes = 0;
    let homeServiceCount = 0;
    let spaBranchCount = 0;

    for (const b of therapistBookings) {
      const isNotCancelled = String(b?.status).toLowerCase() !== 'cancelled';
      const bType = String(b?.booking_type || '').toLowerCase();
      if (bType.includes('home')) homeServiceCount += 1;
      else spaBranchCount += 1;

      // Customer
      const cId = String(b?.customer_id ?? (b?.customer_data?.id ?? ''));
      const cName = b?.customer_data?.name || b?.customer_data?.full_name || 'Customer';
      const cPhone = b?.customer_data?.phone || b?.customer_data?.phone_number || null;
      const cKey = cId || cPhone || cName;

      if (!clientsMap[cKey]) {
        clientsMap[cKey] = { name: cName, phone: cPhone, count: 0, spent: 0, last_visit: null };
      }
      if (isNotCancelled) {
        clientsMap[cKey].count += 1;
        clientsMap[cKey].spent += parseFloat(b?.total_amount) || 0;
        const apptDateStr = b?.appointment_start || b?.appointment_date;
        if (apptDateStr) {
          if (!clientsMap[cKey].last_visit || apptDateStr > clientsMap[cKey].last_visit!) {
            clientsMap[cKey].last_visit = apptDateStr;
          }
        }
      }

      // Service
      const sName = b?.service_data?.name || b?.service_name || 'Service';
      const sId = b?.service_id || b?.service_data?.id || undefined;
      const sKey = sId || sName;
      if (!servicesMap[sKey]) {
        servicesMap[sKey] = { name: sName, service_id: sId, count: 0, minutes: 0, revenue: 0 };
      }
      if (isNotCancelled) {
        servicesMap[sKey].count += 1;
        servicesMap[sKey].minutes += (Number(b?.duration_minutes) || 0) + (Number(b?.extra_minutes) || 0);
        servicesMap[sKey].revenue += parseFloat(b?.total_amount) || 0;
      }

      // Branch
      const brName = b?.branch_data?.name || b?.branch_name || 'Branch';
      const brId = b?.branch_id || b?.branch_data?.id || undefined;
      const brKey = brId || brName;
      if (!branchesMap[brKey]) {
        branchesMap[brKey] = { name: brName, branch_id: brId, count: 0, revenue: 0 };
      }
      if (isNotCancelled) {
        branchesMap[brKey].count += 1;
        branchesMap[brKey].revenue += parseFloat(b?.total_amount) || 0;
      }

      // Time & Day
      const apptDt = new Date(b?.appointment_start || b?.appointment_date || 0);
      if (!isNaN(apptDt.getTime()) && isNotCancelled) {
        const dayName = apptDt.toLocaleDateString('en-US', { weekday: 'long' });
        if (!daysMap[dayName]) daysMap[dayName] = { count: 0, revenue: 0 };
        daysMap[dayName].count += 1;
        daysMap[dayName].revenue += parseFloat(b?.total_amount) || 0;

        const hr = apptDt.getHours();
        if (hr < 12) timeSlotsMap['Morning (Before 12:00)'] += 1;
        else if (hr < 17) timeSlotsMap['Afternoon (12:00 - 17:00)'] += 1;
        else timeSlotsMap['Evening (After 17:00)'] += 1;
      }

      if (isNotCancelled) {
        totalDurationMinutes += (Number(b?.duration_minutes) || 0) + (Number(b?.extra_minutes) || 0);
        extraDurationMinutes += Number(b?.extra_minutes) || 0;
        addonsDurationMinutes += Number(b?.addons_duration) || 0;
      }
    }

    const uniqueClientsCount = Object.keys(clientsMap).length;
    const repeatClientsCount = Object.values(clientsMap).filter((c) => c.count > 1).length;
    const repeatRate = uniqueClientsCount > 0 ? Number(((repeatClientsCount / uniqueClientsCount) * 100).toFixed(1)) : 0;

    const totSvcCounts = Object.values(servicesMap).reduce((acc, s) => acc + s.count, 0);
    const topServices = Object.values(servicesMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((s) => ({
        service_id: s.service_id,
        service_name: s.name,
        booking_count: s.count,
        total_hours: Number((s.minutes / 60).toFixed(1)),
        total_revenue: Number(s.revenue.toFixed(3)),
        share_pct: totSvcCounts > 0 ? Number(((s.count / totSvcCounts) * 100).toFixed(1)) : 0,
      }));

    const topBranches = Object.values(branchesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map((br) => ({
        branch_id: br.branch_id,
        branch_name: br.name,
        booking_count: br.count,
        total_revenue: Number(br.revenue.toFixed(3)),
      }));

    const totSlots = Object.values(timeSlotsMap).reduce((a, b) => a + b, 0);
    const clientTimePreferences = Object.entries(timeSlotsMap)
      .sort((a, b) => b[1] - a[1])
      .map(([slot, cnt]) => ({
        slot,
        booking_count: cnt,
        percentage: totSlots > 0 ? Number(((cnt / totSlots) * 100).toFixed(1)) : 0,
      }));

    const topClients = Object.values(clientsMap)
      .sort((a, b) => b.count - a.count || b.spent - a.spent)
      .slice(0, 10)
      .map((c) => ({
        customer_name: c.name,
        customer_phone: c.phone,
        visit_count: c.count,
        total_spent: Number(c.spent.toFixed(3)),
        last_visit: c.last_visit,
      }));

    const totalTreatmentHours = Number((totalDurationMinutes / 60).toFixed(1));
    const avgRevPerHour = totalTreatmentHours > 0 ? Number((completedSales / totalTreatmentHours).toFixed(3)) : 0;
    const estimatedCommission = Number((completedSales * 0.10).toFixed(3));

    const dayDistribution = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .filter((d) => daysMap[d])
      .map((d) => ({
        day: d,
        booking_count: daysMap[d].count,
        revenue: Number(daysMap[d].revenue.toFixed(3)),
      }));

    const busiestDay = Object.entries(daysMap).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || null;
    const busiestSlot = clientTimePreferences[0]?.slot || null;

    const recentBookings = therapistBookings.slice(0, 20).map((b) => ({
      id: String(b.id),
      booking_number: b.booking_number || null,
      invoice_number: b.invoice_number || null,
      customer_name: b.customer_data?.name || b.customer_data?.full_name || 'Customer',
      customer_phone: b.customer_data?.phone || b.customer_data?.phone_number || null,
      service_name: b.service_data?.name || b.service_name || 'Service',
      branch_name: b.branch_data?.name || b.branch_name || 'Branch',
      appointment_date: b.appointment_date || null,
      appointment_start: b.appointment_start || null,
      duration_minutes: Number(b.duration_minutes) || 0,
      extra_minutes: Number(b.extra_minutes) || 0,
      total_amount: parseFloat(b.total_amount) || 0,
      status: String(b.status || 'requested'),
      payment_status: String(b.payment_status || 'pending'),
      booking_type: b.booking_type || null,
    }));

    return NextResponse.json({
      success: true,
      therapist_id: id,
      therapist_name: employeeDetails ? `${employeeDetails.first_name || ''} ${employeeDetails.last_name || ''}`.trim() || employeeDetails.name : null,
      employee: employeeDetails,
      sales: {
        total_bookings: totalBookings,
        completed_bookings: completedCount,
        upcoming_bookings: upcomingB.length,
        in_progress_bookings: inProgressB.length,
        cancelled_bookings: cancelledCount,
        no_show_bookings: noShowCount,
        completion_rate_pct: completionRate,
        cancellation_rate_pct: cancellationRate,
        no_show_rate_pct: noShowRate,
        gross_sales: Number(grossSales.toFixed(3)),
        completed_sales: Number(completedSales.toFixed(3)),
        discount_total: Number(discountTotal.toFixed(3)),
        net_sales: Number(completedSales.toFixed(3)),
        average_booking_value: avgBookingVal,
        currency: 'KWD',
        monthly_trends: monthlyTrends,
      },
      marketing: {
        total_unique_clients: uniqueClientsCount,
        repeat_clients_count: repeatClientsCount,
        repeat_client_rate_pct: repeatRate,
        single_visit_clients: uniqueClientsCount - repeatClientsCount,
        top_services: topServices,
        top_branches: topBranches,
        client_time_preferences: clientTimePreferences,
        home_service_count: homeServiceCount,
        spa_branch_count: spaBranchCount,
        top_clients: topClients,
      },
      financials: {
        total_gross_revenue: Number(grossSales.toFixed(3)),
        completed_revenue: Number(completedSales.toFixed(3)),
        pending_revenue: Number(pendingRev.toFixed(3)),
        addon_revenue: Number(addonRev.toFixed(3)),
        extra_minutes_revenue: Number(extraTimeRev.toFixed(3)),
        refunded_amount: 0,
        net_revenue: Number(completedSales.toFixed(3)),
        estimated_commission: estimatedCommission,
        commission_rate_pct: 10.0,
        avg_revenue_per_hour: avgRevPerHour,
        currency: 'KWD',
        total_transactions: completedCount,
      },
      performance: {
        total_treatment_hours: totalTreatmentHours,
        total_treatment_minutes: totalDurationMinutes,
        extra_treatment_minutes: extraDurationMinutes,
        addons_treatment_minutes: addonsDurationMinutes,
        average_service_duration_minutes: completedCount > 0 ? Number((totalDurationMinutes / completedCount).toFixed(1)) : 0,
        completion_rate_pct: completionRate,
        reliability_score_pct: reliabilityScore,
        busiest_day: busiestDay,
        busiest_time_slot: busiestSlot,
        day_distribution: dayDistribution,
        first_appointment_date: therapistBookings[therapistBookings.length - 1]?.appointment_start || null,
        latest_appointment_date: therapistBookings[0]?.appointment_start || null,
      },
      recent_bookings: recentBookings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Therapist analytics aggregation failed';
    return NextResponse.json({ success: false, detail: msg }, { status: 500 });
  }
}
