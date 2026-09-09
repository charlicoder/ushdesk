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
  daily:   { revenueMultiplier: 1,  bookingsMultiplier: 1,  avgValue: 0, newCustomers: 0, cancellationRate: 0, revenueTrend: 0, bookingsTrend: 0 },
  weekly:  { revenueMultiplier: 7,  bookingsMultiplier: 7,  avgValue: 0, newCustomers: 0, cancellationRate: 0, revenueTrend: 0, bookingsTrend: 0 },
  monthly: { revenueMultiplier: 30, bookingsMultiplier: 30, avgValue: 0, newCustomers: 0, cancellationRate: 0, revenueTrend: 0, bookingsTrend: 0 },
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
  const baseRevenue = 0;
  const baseBookings = 0;

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
      <RevenueAreaChartInner data={[]} />
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

function RevenueAreaChartInner({ data }: { data: { date: string; revenue: number; bookings: number }[] }) {
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
      <div className="flex-1 flex items-center justify-center py-8 text-muted-foreground text-sm">
        {locale === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
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
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {locale === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
      </div>
    </div>
  );
}

function HourlyBookingsChartInner({ data }: { data: { hour: string; bookings: number }[] }) {
  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.bookings)) : 0;
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
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {locale === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
      </div>
    </div>
  );
}

// --- Top Customers Table ---
function TopCustomersTable({ locale }: { locale: string }) {
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
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {locale === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
      </div>
    </div>
  );
}
