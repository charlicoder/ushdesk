import React from 'react';
import { DollarSign, CalendarCheck, Star, Users, XCircle } from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard';
import { t, Language } from '@/lib/translations';

interface Props {
  period: string;
  totalRevenue: number;
  totalBookings: number;
  avgValue: number;
  newCustomers: number;
  cancellationRate: number;
  revenueTrend: number;
  bookingsTrend: number;
  language: Language;
}

export default function ReportsKpiGrid({
  totalRevenue, totalBookings, avgValue, newCustomers, cancellationRate,
  revenueTrend, bookingsTrend, language,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <KpiCard
        label={t(language, 'kpi_total_revenue')}
        value={`${totalRevenue.toLocaleString()} ${t(language, 'sar')}`}
        trend={revenueTrend}
        trendLabel={t(language, 'vs_last_period')}
        icon={<DollarSign size={18} />}
        accent="primary"
        highlight
      />
      <KpiCard
        label={t(language, 'kpi_total_bookings')}
        value={totalBookings}
        trend={bookingsTrend}
        trendLabel={t(language, 'vs_last_period')}
        icon={<CalendarCheck size={18} />}
        accent="default"
      />
      <KpiCard
        label={t(language, 'kpi_avg_value')}
        value={`${avgValue} ${t(language, 'sar')}`}
        trend={3.8}
        trendLabel={t(language, 'vs_last_period')}
        icon={<Star size={18} />}
        accent="success"
      />
      <KpiCard
        label={t(language, 'kpi_new_customers')}
        value={newCustomers}
        trend={9.2}
        trendLabel={t(language, 'vs_last_period')}
        icon={<Users size={18} />}
        accent="default"
      />
      <KpiCard
        label={t(language, 'kpi_cancellation_rate')}
        value={`${cancellationRate}%`}
        trend={-1.4}
        trendLabel={t(language, 'vs_last_period')}
        icon={<XCircle size={18} />}
        accent={cancellationRate > 10 ? 'danger' : 'warning'}
      />
    </div>
  );
}
