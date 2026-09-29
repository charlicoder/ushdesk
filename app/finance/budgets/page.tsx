'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  PiggyBank,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Target,
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowUpRight,
  Clock,
  Sparkles,
  Percent,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatKwd,
  formatAccountingDate,
  getStateBadge,
  Budget,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

export default function BudgetsPage() {
  const [activeTab, setActiveTab] = useState<'budgets' | 'analytics'>('budgets');
  const [search, setSearch]       = useState<string>('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  const {
    items: budgets,
    total: budgetsTotal,
    page,
    pages,
    loading: budgetsLoading,
    error: budgetsError,
    refetch: refetchBudgets,
    setPage,
  } = useAnrList<Budget>('budgets', { pageSize: 30 });

  // Analytic Plans & Accounts
  const { items: plans, loading: plansLoading, refetch: refetchPlans } = useAnrList<any>('analytic/plans', { pageSize: 50 });
  const { items: analyticAccounts, loading: accountsLoading, refetch: refetchAccounts } = useAnrList<any>('analytic/accounts', { pageSize: 50 });

  const loading = activeTab === 'budgets' ? budgetsLoading : plansLoading || accountsLoading;

  const handleRefresh = () => {
    refetchBudgets();
    refetchPlans();
    refetchAccounts();
  };

  const stats = useMemo(() => {
    const planned = budgets.reduce((acc, curr) => acc + (curr.total_planned || 0), 0);
    const actual = budgets.reduce((acc, curr) => acc + (curr.total_actual || 0), 0);
    const variance = planned - actual;
    return { planned, actual, variance, count: budgets.length };
  }, [budgets]);

  return (
    <DashboardShell>
      <PageHeader
        title="Budgets & Cost Center Analytics"
        subtitle="Manage fiscal budgets, monitor expenditure variances, and track branch cost centers"
      />

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Planned Budget',
            val: formatKwd(stats.planned),
            sub: 'Approved allocation',
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
            icon: Target,
          },
          {
            label: 'Actual Spend',
            val: formatKwd(stats.actual),
            sub: 'Cumulative expenditures',
            color: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
            icon: TrendingUp,
          },
          {
            label: 'Remaining Budget',
            val: formatKwd(stats.variance),
            sub: stats.variance >= 0 ? 'Within budget' : 'Over budget',
            color: stats.variance >= 0
              ? 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400'
              : 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
            icon: PiggyBank,
          },
          {
            label: 'Analytic Cost Centers',
            val: (analyticAccounts?.length ?? 2).toString(),
            sub: 'Branch allocations',
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
            icon: Building2,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={cn(
                'group rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5',
                c.color,
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 dark:bg-black/30">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl font-extrabold text-foreground truncate">{c.val}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar & Tabs ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          <button
            onClick={() => setActiveTab('budgets')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              activeTab === 'budgets' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <PiggyBank className="h-3.5 w-3.5" />
            <span>Budgets & Variances</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              activeTab === 'analytics' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Analytic Cost Centers</span>
          </button>
        </div>

        <button
          onClick={handleRefresh}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
        </button>
      </div>

      {/* ── Tab Content: Budgets ── */}
      {activeTab === 'budgets' && (
        <div className="mt-5">
          {budgetsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl shimmer" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <PiggyBank className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No active budgets found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Create fiscal budgets to monitor expense limits and track line-item variances.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => {
                const badge = getStateBadge(b.state);
                const percent = b.total_planned > 0 ? Math.min(100, Math.round(((b.total_actual || 0) / b.total_planned) * 100)) : 0;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBudget(b)}
                    className="group rounded-2xl border border-border/60 bg-card p-5 cursor-pointer shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-extrabold text-base text-foreground group-hover:text-primary transition">{b.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatAccountingDate(b.date_from)} - {formatAccountingDate(b.date_to)}
                        </p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', badge.bg)}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Planned Budget</span>
                        <span className="font-bold text-foreground">{formatKwd(b.total_planned)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Actual Utilized</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{formatKwd(b.total_actual)}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{percent}% consumed</span>
                        <span className="text-primary font-bold">Inspect Variance →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Analytic Cost Centers ── */}
      {activeTab === 'analytics' && (
        <div className="mt-5 space-y-6">
          {/* Plans */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Analytic Plans & Dimension Structures
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{p.code}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                      ACTIVE
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-foreground mt-2">{p.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description || 'Dimension model'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Accounts */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Branch Cost Centers ({analyticAccounts.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyticAccounts.map((acc) => (
                <div key={acc.id} className="rounded-2xl border border-border/60 bg-card p-4.5 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-foreground">{acc.name}</h4>
                      <p className="text-xs font-mono text-muted-foreground">Code: {acc.code}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Budget Variance Modal ── */}
      {selectedBudget && (
        <BudgetVarianceModal budget={selectedBudget} onClose={() => setSelectedBudget(null)} />
      )}
    </DashboardShell>
  );
}

// ── Budget Variance Detail Modal ────────────────────────────────────────────────
function BudgetVarianceModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    authedFetch(`/api/v1/uanr/budgets/${budget.id}/variance`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.detail ?? 'Failed to load variance details');
        setData(json?.data ?? json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [budget.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const lines: any[] = data?.lines ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">{budget.name}</h3>
              <p className="text-xs text-muted-foreground">Variance Breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Planned</span>
              <p className="font-extrabold text-sm text-foreground mt-0.5">{formatKwd(budget.total_planned)}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Actual</span>
              <p className="font-extrabold text-sm text-amber-600 dark:text-amber-400 mt-0.5">{formatKwd(budget.total_actual)}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Variance</span>
              <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatKwd((budget.total_planned || 0) - (budget.total_actual || 0))}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Budget Lines ({lines.length})
            </h4>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-xl">
                No specific line items assigned to this budget.
              </p>
            ) : (
              <div className="divide-y divide-border/30 rounded-xl border border-border/40 overflow-hidden">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{l.account_name || 'Account'}</p>
                      <p className="text-[10px] text-muted-foreground">Planned: {formatKwd(l.planned_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">Actual: {formatKwd(l.actual_amount)}</p>
                      <p className={cn('text-[10px] font-bold', l.variance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                        Variance: {formatKwd(l.variance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
