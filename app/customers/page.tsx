'use client';

import { useMemo } from 'react';
import { Phone, Mail, User, Calendar } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { formatCurrency } from '@/lib/helpers';

export default function CustomersPage() {
  const { t } = useI18n();
  const customers = useAppSelector((s) => s.data.customers);
  const appointments = useAppSelector((s) => s.data.appointments);
  const status = useAppSelector((s) => s.data.status);

  const rows = useMemo(() => {
    return customers.map((c) => {
      const appts = appointments.filter((a) => a.customer_id === c.id);
      const spend = appts
        .filter((a) => a.status === 'completed' || a.status === 'confirmed')
        .reduce((s, a) => s + Number(a.price), 0);
      const lastVisit = appts
        .map((a) => new Date(a.start_time))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return { ...c, bookings: appts.length, spend, lastVisit };
    }).sort((a, b) => b.spend - a.spend);
  }, [customers, appointments]);

  if (status === 'idle' || status === 'loading') {
    return <DashboardShell><div className="h-96 rounded-2xl shimmer" /></DashboardShell>;
  }

  return (
    <DashboardShell>
      <PageHeader title={t('navCustomers')} subtitle={`${customers.length} ${t('navCustomers').toLowerCase()}`} />
      <SectionCard title={t('navCustomers')} subtitle={`${t('showing')} ${rows.length} ${t('results')}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="group rounded-2xl border border-border/50 bg-muted/30 p-4 transition hover:border-primary/40 hover:bg-muted/60 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.gender ?? '—'}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>}
                {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email}</p>}
                {c.lastVisit && <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {c.lastVisit.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('reportBookings')}</p>
                  <p className="text-sm font-bold">{c.bookings}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('reportEarnings')}</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(c.spend, t('currency'))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </DashboardShell>
  );
}
