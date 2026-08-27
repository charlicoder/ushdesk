'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  DollarSign, CalendarCheck, Star, Users, XCircle, TrendingUp, TrendingDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { cn } from '@/lib/utils';

// --- Mock Datasets matching requested code ---
const REVENUE_TREND = [
  { date: '06/27', revenue: 4200, bookings: 14 },
  { date: '06/29', revenue: 3800, bookings: 12 },
  { date: '07/01', revenue: 6100, bookings: 19 },
  { date: '07/03', revenue: 4100, bookings: 13 },
  { date: '07/05', revenue: 5800, bookings: 18 },
  { date: '07/07', revenue: 7200, bookings: 22 },
  { date: '07/09', revenue: 4500, bookings: 15 },
  { date: '07/11', revenue: 6900, bookings: 21 },
  { date: '07/13', revenue: 7800, bookings: 24 },
  { date: '07/15', revenue: 5400, bookings: 17 },
  { date: '07/17', revenue: 6300, bookings: 20 },
  { date: '07/19', revenue: 7400, bookings: 23 },
  { date: '07/21', revenue: 8100, bookings: 25 },
  { date: '07/23', revenue: 6500, bookings: 20 },
  { date: '07/25', revenue: 5200, bookings: 16 },
];



const HOURLY_BOOKINGS = [
  { hour: '08:00', bookings: 3 },
  { hour: '09:00', bookings: 7 },
  { hour: '10:00', bookings: 13 },
  { hour: '11:00', bookings: 17 },
  { hour: '12:00', bookings: 15 },
  { hour: '13:00', bookings: 11 },
  { hour: '14:00', bookings: 18 },
  { hour: '15:00', bookings: 22 },
  { hour: '16:00', bookings: 16 },
  { hour: '17:00', bookings: 12 },
  { hour: '18:00', bookings: 8 },
  { hour: '19:00', bookings: 5 },
  { hour: '20:00', bookings: 3 },
];

const TOP_SERVICES = [
  { id: '1', name: 'Swedish Massage', category: 'Massage', bookings: 142, revenue: 39760, growth: 12.4 },
  { id: '2', name: 'Hot Stone Therapy', category: 'Massage', bookings: 98, revenue: 41160, growth: 8.7 },
  { id: '3', name: 'Hydrating Facial', category: 'Facial', bookings: 124, revenue: 27280, growth: -3.2 },
  { id: '4', name: 'Anti-Aging Facial', category: 'Facial', bookings: 87, revenue: 30450, growth: 15.1 },
  { id: '5', name: 'Body Scrub & Wrap', category: 'Body', bookings: 76, revenue: 24320, growth: 5.9 },
  { id: '6', name: 'Moroccan Bath', category: 'Body', bookings: 93, revenue: 23250, growth: 2.1 },
  { id: '7', name: 'Manicure & Pedicure', category: 'Nails', bookings: 118, revenue: 21240, growth: -1.8 },
];

const TOP_CUSTOMERS = [
  { id: '1', name: 'Dalal Al-Rasheed', branch: 'Al Nakheel — Jeddah', visits: 24, totalSpend: 9840, lastVisit: '2026-07-27' },
  { id: '2', name: 'Layla Al-Saud', branch: 'Al Olaya — Riyadh', visits: 19, totalSpend: 7420, lastVisit: '2026-07-27' },
  { id: '3', name: 'Mariam Al-Dosari', branch: 'Al Olaya — Riyadh', visits: 17, totalSpend: 6380, lastVisit: '2026-07-27' },
  { id: '4', name: 'Noura Al-Qahtani', branch: 'Al Olaya — Riyadh', visits: 15, totalSpend: 5700, lastVisit: '2026-07-25' },
  { id: '5', name: 'Shahad Al-Otaibi', branch: 'Corniche — Jeddah', visits: 14, totalSpend: 5180, lastVisit: '2026-07-20' },
  { id: '6', name: 'Hessa Al-Shehri', branch: 'King Fahd Road — Riyadh', visits: 12, totalSpend: 4320, lastVisit: '2026-07-27' },
  { id: '7', name: 'Wafa Al-Harbi', branch: 'King Fahd Road — Riyadh', visits: 11, totalSpend: 3960, lastVisit: '2026-07-24' },
];

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_CONFIGS: Record<Period, {
  revenueMultiplier: number;
  bookingsMultiplier: number;
  avgValue: number;
  newCustomers: number;
  cancellationRate: number;
  revenueTrend: number;
  bookingsTrend: number;
}> = {
  daily: { revenueMultiplier: 1, bookingsMultiplier: 1, avgValue: 287, newCustomers: 4, cancellationRate: 8.3, revenueTrend: 12.4, bookingsTrend: 6.7 },
  weekly: { revenueMultiplier: 7, bookingsMultiplier: 7, avgValue: 294, newCustomers: 28, cancellationRate: 7.1, revenueTrend: -3.2, bookingsTrend: 4.1 },
  monthly: { revenueMultiplier: 30, bookingsMultiplier: 30, avgValue: 301, newCustomers: 112, cancellationRate: 6.8, revenueTrend: 18.9, bookingsTrend: 14.3 },
};

// --- Page Main Component ---
export default function ReportsPage() {
  const { locale } = useI18n();
  const [period, setPeriod] = useState<Period>('monthly');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cfg = PERIOD_CONFIGS[period];
  const baseRevenue = 3800;
  const baseBookings = 12;

  const tabs: { key: Period; label: string }[] = [
    { key: 'daily', label: locale === 'ar' ? 'يومي' : 'Daily' },
    { key: 'weekly', label: locale === 'ar' ? 'أسبوعي' : 'Weekly' },
    { key: 'monthly', label: locale === 'ar' ? 'شهري' : 'Monthly' },
  ];

  if (!mounted) {
    return (
      <DashboardShell>
        <div className="h-96 rounded-2xl shimmer" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 animate-fade-in-up">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {locale === 'ar' ? 'تقارير الأداء' : 'Performance Reports'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {locale === 'ar' ? 'التحليلات والرؤى عبر جميع الفروع' : 'Analytics and insights across all branches'}
            </p>
          </div>
          {/* Period Tabs */}
          <div className="flex items-center bg-muted/60 rounded-xl p-1 gap-1 border border-border/50">
            {tabs.map((tab) => (
              <button
                key={`period-tab-${tab.key}`}
                onClick={() => setPeriod(tab.key)}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95',
                  period === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Grid */}
        <ReportsKpiGrid
          period={period}
          totalRevenue={baseRevenue * cfg.revenueMultiplier}
          totalBookings={baseBookings * cfg.bookingsMultiplier}
          avgValue={cfg.avgValue}
          newCustomers={cfg.newCustomers}
          cancellationRate={cfg.cancellationRate}
          revenueTrend={cfg.revenueTrend}
          bookingsTrend={cfg.bookingsTrend}
          locale={locale}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <RevenueAreaChart locale={locale} period={period} />
          </div>
          <div>
            <ServicePieChart locale={locale} />
          </div>
        </div>

        {/* Hourly Bookings Chart Row */}
        <div className="grid grid-cols-1 gap-4">
          <HourlyBookingsChart locale={locale} />
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TopServicesTable locale={locale} />
          <TopCustomersTable locale={locale} />
        </div>
      </div>
    </DashboardShell>
  );
}

// --- KPI Grid ---
function ReportsKpiGrid({
  totalRevenue, totalBookings, avgValue, newCustomers, cancellationRate,
  revenueTrend, bookingsTrend, locale,
}: {
  period: string;
  totalRevenue: number;
  totalBookings: number;
  avgValue: number;
  newCustomers: number;
  cancellationRate: number;
  revenueTrend: number;
  bookingsTrend: number;
  locale: string;
}) {
  const sar = locale === 'ar' ? 'ر.س' : 'SAR';
  const vsLastPeriod = locale === 'ar' ? 'مقارنة بالفترة السابقة' : 'vs last period';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <KpiCard
        label={locale === 'ar' ? 'إجمالي الإيرادات' : 'TOTAL REVENUE'}
        value={`${totalRevenue.toLocaleString()} ${sar}`}
        trend={revenueTrend}
        trendLabel={vsLastPeriod}
        icon={<DollarSign size={18} />}
        accent="primary"
      />
      <KpiCard
        label={locale === 'ar' ? 'إجمالي الحجوزات' : 'TOTAL BOOKINGS'}
        value={totalBookings}
        trend={bookingsTrend}
        trendLabel={vsLastPeriod}
        icon={<CalendarCheck size={18} />}
        accent="default"
      />
      <KpiCard
        label={locale === 'ar' ? 'متوسط قيمة الخدمة' : 'AVG. SERVICE VALUE'}
        value={`${avgValue} ${sar}`}
        trend={3.8}
        trendLabel={vsLastPeriod}
        icon={<Star size={18} />}
        accent="success"
      />
      <KpiCard
        label={locale === 'ar' ? 'العملاء الجدد' : 'NEW CUSTOMERS'}
        value={newCustomers}
        trend={9.2}
        trendLabel={vsLastPeriod}
        icon={<Users size={18} />}
        accent="default"
      />
      <KpiCard
        label={locale === 'ar' ? 'معدل الإلغاء' : 'CANCELLATION RATE'}
        value={`${cancellationRate}%`}
        trend={-1.4}
        trendLabel={vsLastPeriod}
        icon={<XCircle size={18} />}
        accent={cancellationRate > 10 ? 'danger' : 'warning'}
      />
    </div>
  );
}

function KpiCard({
  label, value, trend, trendLabel, icon, accent,
}: {
  label: string;
  value: string | number;
  trend: number;
  trendLabel: string;
  icon: React.ReactNode;
  accent: 'primary' | 'default' | 'success' | 'warning' | 'danger';
}) {
  const isPositive = trend >= 0;
  const bgStyles = {
    primary: 'bg-card border-border/60',
    default: 'bg-card border-border/60',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className={cn('p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-md', bgStyles[accent])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
        <div className="p-2 rounded-xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{value}</p>
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        <span className={cn('flex items-center gap-0.5 font-bold', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {isPositive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="text-muted-foreground text-[10px]">{trendLabel}</span>
      </div>
    </div>
  );
}

// --- Revenue Area Chart ---
function RevenueAreaChart({ locale, period }: { locale: string; period: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {locale === 'ar' ? 'اتجاه الإيرادات' : 'Revenue Trend'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'ar' ? 'آخر 30 يوم — بالريال السعودي' : 'Last 30 days — SAR'}
          </p>
        </div>
      </div>
      <RevenueAreaChartInner data={REVENUE_TREND} />
    </div>
  );
}

// --- Service Category Data with explicit hex colors ---
const SERVICE_CATEGORY_DATA = [
  { name: 'Massage', value: 38, revenue: 42800, color: '#be123c' },
  { name: 'Facial', value: 24, revenue: 27200, color: '#e11d48' },
  { name: 'Body', value: 19, revenue: 21400, color: '#fb7185' },
  { name: 'Nails', value: 12, revenue: 13600, color: '#fca5a5' },
  { name: 'Wellness', value: 7, revenue: 7900, color: '#ffe4e6' },
];

function RevenueAreaChartInner({ data }: { data: typeof REVENUE_TREND }) {
  return (
    <div className="h-60 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#be123c" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#be123c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <RechartsTooltip content={<RevenueTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#be123c"
            strokeWidth={3}
            fill="url(#revenueGrad)"
            animationDuration={1200}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{payload[0]?.value?.toLocaleString()} SAR</p>
      <p className="text-muted-foreground text-[10px]">{payload[0]?.payload?.bookings} bookings</p>
    </div>
  );
}

// --- Service Pie Chart ---
function ServicePieChart({ locale }: { locale: string }) {
  const sar = locale === 'ar' ? 'ر.س' : 'SAR';
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 h-full flex flex-col shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">
          {locale === 'ar' ? 'توزيع الخدمات' : 'Service Category Split'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === 'ar' ? 'توزيع الإيرادات حسب الفئة' : 'Revenue by service category'}
        </p>
      </div>
      <ServicePieChartInner data={SERVICE_CATEGORY_DATA} />
      <div className="mt-4 space-y-2">
        {SERVICE_CATEGORY_DATA.map((item) => (
          <div key={`legend-svc-${item.name}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-foreground font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{item.value}%</span>
              <span className="text-xs font-semibold text-foreground">{item.revenue.toLocaleString()} {sar}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServicePieChartInner({ data }: { data: typeof SERVICE_CATEGORY_DATA }) {
  return (
    <div className="h-44 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            animationDuration={1000}
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell key={`pie-cell-${index + 1}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip content={<ServicePieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ServicePieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="font-bold text-primary">{d.value}%</p>
      <p className="text-muted-foreground text-[10px]">{d.revenue.toLocaleString()} SAR</p>
    </div>
  );
}

// --- Hourly Bookings Chart ---
function HourlyBookingsChart({ locale }: { locale: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">
          {locale === 'ar' ? 'المواعيد حسب الساعة' : 'Bookings by Hour'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === 'ar' ? 'توزيع الحجوزات حسب الساعة — متوسط شهري' : 'Booking distribution by hour — monthly average'}
        </p>
      </div>
      <HourlyBookingsChartInner data={HOURLY_BOOKINGS} />
    </div>
  );
}

function HourlyBookingsChartInner({ data }: { data: typeof HOURLY_BOOKINGS }) {
  const maxVal = Math.max(...data.map((d) => d.bookings));
  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip content={<HourlyTooltip />} />
          <Bar dataKey="bookings" radius={[6, 6, 0, 0]} animationDuration={1000} isAnimationActive={true}>
            {data.map((entry, index) => (
              <Cell
                key={`bar-cell-${index + 1}`}
                fill={entry.bookings === maxVal ? '#be123c' : '#fb7185'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlyTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-primary font-bold">{payload[0]?.value} bookings</p>
    </div>
  );
}

// --- Top Services Table ---
function TopServicesTable({ locale }: { locale: string }) {
  const sar = locale === 'ar' ? 'ر.س' : 'SAR';
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="text-base font-bold text-foreground">
          {locale === 'ar' ? 'أفضل الخدمات' : 'Top Services'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === 'ar' ? 'مرتبة حسب الإيرادات' : 'Ranked by revenue'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">{locale === 'ar' ? 'الخدمة' : 'Service'}</th>
              <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">{locale === 'ar' ? 'الفئة' : 'Category'}</th>
              <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">{locale === 'ar' ? 'الحجوزات' : 'Bookings'}</th>
              <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">{locale === 'ar' ? 'الإيرادات' : 'Revenue'}</th>
              <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">{locale === 'ar' ? 'النمو' : 'Growth'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {TOP_SERVICES.map((svc, idx) => (
              <tr key={`top-svc-${svc.id}`} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground text-xs">{svc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {svc.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-end font-semibold text-foreground">
                  {svc.bookings}
                </td>
                <td className="px-4 py-3 text-end font-bold text-foreground">
                  {svc.revenue.toLocaleString()} {sar}
                </td>
                <td className="px-4 py-3 text-end">
                  <span className={cn('inline-flex items-center gap-1 font-semibold text-xs', svc.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {svc.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(svc.growth)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Top Customers Table ---
function TopCustomersTable({ locale }: { locale: string }) {
  const sar = locale === 'ar' ? 'ر.س' : 'SAR';
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="text-base font-bold text-foreground">
          {locale === 'ar' ? 'أفضل العملاء' : 'Top Customers'}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {locale === 'ar' ? 'مرتبة حسب إجمالي الإنفاق' : 'Ranked by total spend'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">{locale === 'ar' ? 'العميل' : 'Customer'}</th>
              <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">{locale === 'ar' ? 'الزيارات' : 'Visits'}</th>
              <th className="px-4 py-2.5 text-end font-semibold text-muted-foreground">{locale === 'ar' ? 'إجمالي الإنفاق' : 'Total Spend'}</th>
              <th className="px-4 py-2.5 text-start font-semibold text-muted-foreground">{locale === 'ar' ? 'آخر زيارة' : 'Last Visit'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {TOP_CUSTOMERS.map((cust) => (
              <tr key={`top-cust-${cust.id}`} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {cust.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-xs">{cust.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-32">{cust.branch}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-end font-semibold text-foreground">
                  {cust.visits}
                </td>
                <td className="px-4 py-3 text-end font-bold text-foreground">
                  {cust.totalSpend.toLocaleString()} {sar}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {cust.lastVisit.split('-').reverse().join('/')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
