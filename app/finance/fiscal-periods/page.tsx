'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Plus, Lock, LockOpen, Check, Loader2, CalendarClock, Layers } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAnrList } from '@/hooks/use-accounting';
import {
  anrRequest,
  getCompanyId,
  inputCls,
  labelCls,
  StatusPill,
  EmptyState,
  TableSkeleton,
  ErrorBanner,
  FormModal,
  FormFooter,
  PrimaryButton,
  RefreshButton,
  Tone,
} from '@/components/finance/finance-ui';

interface FiscalYear {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  state: string;
}
interface FiscalPeriod {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  state: string;
  fiscal_year_id: string;
}

const STATE_TONE: Record<string, Tone> = { open: 'emerald', closed: 'amber', locked: 'rose' };

export default function FiscalPeriodsPage() {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [modal, setModal] = useState<'year' | 'period' | null>(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const years = useAnrList<FiscalYear>('fiscal/years', { pageSize: 100 });
  const periods = useAnrList<FiscalPeriod>('fiscal/periods', {
    pageSize: 100,
    params: { fiscal_year_id: selectedYear || undefined },
  });

  // Default to the first year once loaded
  useEffect(() => {
    if (!selectedYear && years.items.length > 0) setSelectedYear(years.items[0].id);
  }, [years.items, selectedYear]);

  const year = years.items.find((y) => y.id === selectedYear);
  const periodItems = selectedYear ? periods.items : [];

  const closeYear = async (y: FiscalYear) => {
    if (!window.confirm(`Close fiscal year "${y.name}"? This cannot be easily undone.`)) return;
    setBusy(y.id);
    setActionError('');
    try {
      await anrRequest(`fiscal/years/${y.id}/close/`, 'POST');
      years.refetch();
      periods.refetch();
    } catch (e: any) {
      setActionError(e.message || 'Failed to close fiscal year');
    } finally {
      setBusy(null);
    }
  };

  const setPeriodState = async (p: FiscalPeriod, state: 'open' | 'closed' | 'locked') => {
    setBusy(p.id);
    setActionError('');
    try {
      await anrRequest(`fiscal/periods/${p.id}/state/`, 'PATCH', { state });
      periods.refetch();
    } catch (e: any) {
      setActionError(e.message || 'Failed to update period');
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => {
    years.refetch();
    periods.refetch();
  };

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Fiscal Periods" subtitle="Manage fiscal years and accounting periods, and control posting by opening, closing or locking them" />
        <div className="flex items-center gap-2">
          <RefreshButton onClick={refresh} loading={years.loading || periods.loading} />
          <PrimaryButton onClick={() => setModal('year')}>
            <Plus className="h-3.5 w-3.5" />
            New Fiscal Year
          </PrimaryButton>
        </div>
      </div>

      {(years.error || actionError) && <ErrorBanner message={String(actionError || years.error)} className="mt-4" />}

      <div className="mt-5">
        {years.loading && years.items.length === 0 ? (
          <TableSkeleton rows={2} height="h-20" />
        ) : years.items.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No fiscal years yet" text="Create a fiscal year, then add its accounting periods." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {years.items.map((y) => (
              <button
                key={y.id}
                onClick={() => setSelectedYear(y.id)}
                className={cn(
                  'rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5',
                  y.id === selectedYear ? 'border-primary ring-2 ring-primary/20' : 'border-border/60',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black">{y.name}</span>
                  <StatusPill label={y.state} tone={STATE_TONE[y.state] ?? 'zinc'} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {y.date_from} → {y.date_to}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {year && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black">Periods · {year.name}</h2>
            <div className="flex items-center gap-2">
              {year.state === 'open' && (
                <button
                  onClick={() => closeYear(year)}
                  disabled={busy === year.id}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20 disabled:opacity-60"
                >
                  {busy === year.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Close Year
                </button>
              )}
              <button
                onClick={() => setModal('period')}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-bold transition hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                New Period
              </button>
            </div>
          </div>

          {periods.loading && periodItems.length === 0 ? (
            <TableSkeleton rows={4} height="h-10" />
          ) : periodItems.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No periods" text="Add accounting periods (e.g. monthly) to this fiscal year." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periodItems.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                      <td className="px-4 py-2.5">{p.date_from}</td>
                      <td className="px-4 py-2.5">{p.date_to}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill label={p.state} tone={STATE_TONE[p.state] ?? 'zinc'} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {busy === p.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {p.state === 'open' && (
                            <>
                              <button disabled={busy === p.id} onClick={() => setPeriodState(p, 'closed')} className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-60">
                                <Check className="h-3 w-3" /> Close
                              </button>
                              <button disabled={busy === p.id} onClick={() => setPeriodState(p, 'locked')} className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-60">
                                <Lock className="h-3 w-3" /> Lock
                              </button>
                            </>
                          )}
                          {p.state === 'closed' && (
                            <>
                              <button disabled={busy === p.id} onClick={() => setPeriodState(p, 'open')} className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-60">
                                <LockOpen className="h-3 w-3" /> Reopen
                              </button>
                              <button disabled={busy === p.id} onClick={() => setPeriodState(p, 'locked')} className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-60">
                                <Lock className="h-3 w-3" /> Lock
                              </button>
                            </>
                          )}
                          {p.state === 'locked' && (
                            <button disabled={busy === p.id} onClick={() => setPeriodState(p, 'open')} className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 font-semibold hover:bg-muted disabled:opacity-60">
                              <LockOpen className="h-3 w-3" /> Unlock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal === 'year' && (
        <NewRangeModal
          kind="year"
          onClose={() => setModal(null)}
          onSaved={(id) => {
            setModal(null);
            years.refetch();
            if (id) setSelectedYear(id);
          }}
        />
      )}
      {modal === 'period' && year && (
        <NewRangeModal
          kind="period"
          yearId={year.id}
          yearName={year.name}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            periods.refetch();
          }}
        />
      )}
    </DashboardShell>
  );
}

function NewRangeModal({
  kind,
  yearId,
  yearName,
  onClose,
  onSaved,
}: {
  kind: 'year' | 'period';
  yearId?: string;
  yearName?: string;
  onClose: () => void;
  onSaved: (createdId?: string) => void;
}) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const valid = name.trim() && from && to && from <= to;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError('');
    try {
      const company_id = await getCompanyId();
      const body: Record<string, unknown> = { company_id, name: name.trim(), date_from: from, date_to: to };
      if (kind === 'period') body.fiscal_year_id = yearId;
      const created = await anrRequest<any>(kind === 'year' ? 'fiscal/years/' : 'fiscal/periods/', 'POST', body);
      onSaved(created?.id);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      title={kind === 'year' ? 'New Fiscal Year' : 'New Period'}
      subtitle={kind === 'period' ? `In ${yearName}` : undefined}
      icon={kind === 'year' ? CalendarRange : Layers}
      onClose={onClose}
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'year' ? 'FY 2026' : 'January 2026'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>From *</label>
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>To *</label>
            <input type="date" className={inputCls} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <FormFooter onCancel={onClose} onSubmit={submit} submitting={saving} submitLabel="Create" submitIcon={saving ? Loader2 : Check} disabled={!valid} />
      </div>
    </FormModal>
  );
}
