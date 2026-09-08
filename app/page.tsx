'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  CalendarCheck,
  Wallet,
  Users,
  Clock,
  Store,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import {
  earningsOf, uniqueCustomers, completionRate, avgBookingValue, pctChange,
  appointmentsOnDay, appointmentsInRange, startOfMonth, endOfMonth,
  addMonths, formatCurrency, toISODate, addDays,
} from '@/lib/helpers';
import type { Appointment } from '@/types/appointment';
import {
  generateDemoEarningsTrend,
  generateDemoWeeklyOverview,
  SERVICE_CATEGORY_DATA,
} from '@/data/mockData';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function OverviewPage() {
  const { t, locale } = useI18n();
  const appointments = useAppSelector((s) => s.data.appointments);
  const branches = useAppSelector((s) => s.data.branches);
  const status = useAppSelector((s) => s.data.status);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = useMemo(() => new Date(), []);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayAppts = useMemo(() => appointmentsInRange(appointments, todayStart, todayEnd), [appointments]);
  const thisMonth = useMemo(() => appointmentsInRange(appointments, startOfMonth(now), endOfMonth(now)), [appointments]);
  const lastMonth = useMemo(() => appointmentsInRange(appointments, startOfMonth(addMonths(now, -1)), endOfMonth(addMonths(now, -1))), [appointments]);

  const earningsThisMonth = earningsOf(thisMonth) || 128450;
  const earningsLastMonth = earningsOf(lastMonth) || 112300;
  const bookingsThisMonth = thisMonth.length || 382;
  const bookingsLastMonth = lastMonth.length || 340;
  const customersThisMonth = uniqueCustomers(thisMonth) || 148;
  const customersLastMonth = uniqueCustomers(lastMonth) || 135;

  const pendingToday = todayAppts.filter((a) => a.status === 'pending').length;
  const confirmedToday = todayAppts.filter((a) => a.status === 'confirmed').length;
  const completedToday = todayAppts.filter((a) => a.status === 'completed').length;
  const cancelledToday = todayAppts.filter((a) => a.status === 'cancelled').length;

  // earnings trend (last 14 days)
  const trendData = useMemo(() => {
    const days: { date: string; earnings: number; bookings: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(now, -i);
      const dayAppts = appointmentsOnDay(appointments, d);
      days.push({
        date: toISODate(d).slice(5),
        earnings: earningsOf(dayAppts),
        bookings: dayAppts.length,
      });
    }
    const hasData = days.some((d) => d.earnings > 0 || d.bookings > 0);
    return hasData ? days : generateDemoEarningsTrend(now);
  }, [appointments, now]);

  // bookings by branch
  const branchData = useMemo(() => {
    return branches.map((b) => ({
      name: b.name.replace('Serenity ', ''),
      value: thisMonth.filter((a) => a.branch_id === b.id).length,
      color: b.color,
    }));
  }, [branches, thisMonth]);

  // service category mix
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    thisMonth.forEach((a) => {
      const cat = a.service?.category ?? 'Other';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    });
    const palette = ['hsl(168 58% 40%)', 'hsl(35 80% 55%)', 'hsl(190 60% 45%)', 'hsl(280 50% 60%)', 'hsl(340 70% 60%)', 'hsl(120 50% 45%)'];
    const entries = Array.from(map.entries()).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
    if (entries.length > 0) return entries;
    return SERVICE_CATEGORY_DATA.map((sc, i) => ({ name: sc.name, value: sc.value, color: palette[i % palette.length] }));
  }, [thisMonth]);

  // weekly overview
  const weeklyData = useMemo(() => {
    const calculated = WEEKDAYS.map((d) => {
      const dayAppts = appointments.filter((a) => {
        const dt = new Date(a.start_time);
        return dt.getDay() === WEEKDAYS.indexOf(d) && dt >= startOfMonth(now) && dt <= endOfMonth(now);
      });
      return {
        day: t(d),
        bookings: dayAppts.length,
        earnings: earningsOf(dayAppts),
      };
    });
    const hasData = calculated.some((item) => item.bookings > 0 || item.earnings > 0);
    return hasData ? calculated : generateDemoWeeklyOverview((k) => t(k as any));
  }, [appointments, now, locale]);

  // upcoming
  const upcoming = useMemo(
    () => appointments.filter((a) => new Date(a.start_time) >= now && a.status !== 'cancelled').slice(0, 5),
    [appointments, now],
  );

  const isLoading = status === 'idle' || status === 'loading';

  if (isLoading) return <DashboardShell><OverviewSkeleton /></DashboardShell>;

  return (
    <DashboardShell>
      <PageHeader title={`${t('welcome')} 👋`} subtitle={t('welcomeSub')} />

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 stagger sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTotalAppointments')} value={bookingsThisMonth.toLocaleString()} icon={CalendarCheck} trend={pctChange(bookingsThisMonth, bookingsLastMonth)} gradient="from-sky-500/30 to-sky-500/5" />
        <StatCard label={t('statTotalEarnings')} value={formatCurrency(earningsThisMonth, t('currency'))} icon={Wallet} trend={pctChange(earningsThisMonth, earningsLastMonth)} gradient="from-emerald-500/30 to-emerald-500/5" />
        <StatCard label={t('statTotalCustomers')} value={customersThisMonth.toLocaleString()} icon={Users} trend={pctChange(customersThisMonth, customersLastMonth)} gradient="from-violet-500/30 to-violet-500/5" />
        <StatCard label={t('statAvgBookingValue')} value={formatCurrency(avgBookingValue(thisMonth), t('currency'))} icon={TrendingUp} trend={pctChange(avgBookingValue(thisMonth), avgBookingValue(lastMonth))} gradient="from-amber-500/30 to-amber-500/5" />
      </div>

      {/* today quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 stagger lg:grid-cols-4">
        <MiniStat icon={Hourglass} label={t('pendingReview')} value={pendingToday} color="amber" />
        <MiniStat icon={Clock} label={t('confirmedToday')} value={confirmedToday} color="sky" />
        <MiniStat icon={CheckCircle2} label={t('completedToday')} value={completedToday} color="emerald" />
        <MiniStat icon={XCircle} label={t('cancelledToday')} value={cancelledToday} color="rose" />
      </div>

      {/* charts row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title={t('earningsTrend')} subtitle={t('earningsTrendSub')} className="lg:col-span-2">
          {mounted ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(168 58% 40%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(168 58% 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
                  formatter={(v: number) => [formatCurrency(v, t('currency')), t('reportEarnings')]}
                />
                <Area type="monotone" dataKey="earnings" stroke="hsl(168 58% 40%)" strokeWidth={2.5} fill="url(#earningsGrad)" animationBegin={200} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] rounded-xl shimmer" />
          )}
        </SectionCard>

        <SectionCard title={t('serviceMix')} subtitle={t('serviceMixSub')}>
          {mounted ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} animationBegin={200} animationDuration={800}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] rounded-xl shimmer" />
          )}
        </SectionCard>
      </div>

      {/* bottom row */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title={t('weeklyOverview')} subtitle={t('weeklyOverviewSub')} className="lg:col-span-2">
          {mounted ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                <Bar dataKey="bookings" radius={[8, 8, 0, 0]} fill="hsl(168 58% 40%)" animationBegin={200} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] rounded-xl shimmer" />
          )}
        </SectionCard>

        <SectionCard title={t('upcomingAppointments')} subtitle={t('liveActivity')}>
          <div className="space-y-3">
            {upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t('noUpcoming')}</p>}
            {upcoming.map((a) => (
              <UpcomingItem key={a.id} appointment={a} />
            ))}
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function UpcomingItem({ appointment: a }: { appointment: Appointment }) {
  const dt = new Date(a.start_time);
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 p-3 transition hover:bg-muted/60">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{a.customer?.name ?? '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{a.service?.name ?? '—'} · {a.branch?.name ?? ''}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold">{time}</p>
        <StatusBadge status={a.status} className="mt-1" />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 rounded-xl shimmer" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-2xl shimmer lg:col-span-2" />
        <div className="h-80 rounded-2xl shimmer" />
      </div>
    </div>
  );
}
