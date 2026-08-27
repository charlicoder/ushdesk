'use client';

import { useMemo } from 'react';
import { MapPin, Phone, Store, Users } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { formatCurrency, earningsOf, startOfMonth, endOfMonth, appointmentsInRange } from '@/lib/helpers';

export default function BranchesPage() {
  const { t } = useI18n();
  const branches = useAppSelector((s) => s.data.branches);
  const appointments = useAppSelector((s) => s.data.appointments);
  const staff = useAppSelector((s) => s.data.staff);
  const status = useAppSelector((s) => s.data.status);

  const now = new Date();
  const monthAppts = useMemo(() => appointmentsInRange(appointments, startOfMonth(now), endOfMonth(now)), [appointments, now]);

  if (status === 'idle' || status === 'loading') {
    return <DashboardShell><div className="h-96 rounded-2xl shimmer" /></DashboardShell>;
  }

  return (
    <DashboardShell>
      <PageHeader title={t('navBranches')} subtitle={`${branches.length} ${t('navBranches').toLowerCase()}`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => {
          const appts = monthAppts.filter((a) => a.branch_id === b.id);
          const earnings = earningsOf(appts);
          const staffCount = staff.filter((s) => s.branch_id === b.id).length;
          return (
            <div key={b.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:shadow-lg animate-fade-in-up">
              <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}99)` }}>
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white, transparent 40%)' }} />
                <div className="absolute bottom-3 ltr:left-4 rtl:right-4 flex items-center gap-2 text-white">
                  <Store className="h-5 w-5" />
                  <p className="text-lg font-bold">{b.name}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {b.city}{b.address ? ` · ${b.address}` : ''}</p>
                  <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {b.phone ?? '—'}</p>
                  <p className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {staffCount} {t('staff').toLowerCase()}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('reportBookings')}</p>
                    <p className="text-lg font-bold">{appts.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t('reportEarnings')}</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(earnings, t('currency'))}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
