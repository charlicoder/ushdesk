'use client';

import { useMemo } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  Massage: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  Facial: 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400',
  Body: 'from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400',
  Nails: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
  Hair: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
  Wellness: 'from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-400',
  Package: 'from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400',
};

export default function ServicesPage() {
  const { t } = useI18n();
  const services = useAppSelector((s) => s.data.services);
  const appointments = useAppSelector((s) => s.data.appointments);
  const status = useAppSelector((s) => s.data.status);

  const rows = useMemo(() => {
    return services.map((s) => {
      const appts = appointments.filter((a) => a.service_id === s.id);
      return { ...s, bookings: appts.length };
    }).sort((a, b) => b.bookings - a.bookings);
  }, [services, appointments]);

  if (status === 'idle' || status === 'loading') {
    return <DashboardShell><div className="h-96 rounded-2xl shimmer" /></DashboardShell>;
  }

  return (
    <DashboardShell>
      <PageHeader title={t('navServices')} subtitle={`${services.length} ${t('navServices').toLowerCase()}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <div key={s.id} className="group rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up">
            <div className="flex items-start justify-between">
              <div className={cn('grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br', CATEGORY_COLORS[s.category] ?? 'from-muted to-muted/50 text-muted-foreground')}>
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">{s.category}</span>
            </div>
            <p className="mt-3 text-base font-bold">{s.name}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_min} {t('min')}</span>
              <span>{s.bookings} {t('reportBookings').toLowerCase()}</span>
            </div>
            <div className="mt-3 border-t border-border/50 pt-3">
              <p className="text-lg font-bold text-primary">{formatCurrency(Number(s.price), t('currency'))}</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
