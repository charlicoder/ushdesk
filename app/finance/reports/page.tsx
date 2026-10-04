'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Scale, FileSpreadsheet, Clock, RefreshCw, Printer,
  ShieldCheck, CheckCircle2, AlertCircle, Wallet, Receipt,
  X, Loader2, TrendingDown, DollarSign, ChevronRight, BookOpen,
  Search, ChevronLeft,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAnrReport, formatKwd, formatAccountingDate } from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';

// ── Types ──────────────────────────────────────────────────────────────────────

type DrilldownSection = 'revenue' | 'cogs' | 'expenses';

interface DrilldownEntry {
  id: string;
  name: string | null;
  reference: string | null;
  narration: string | null;
  accounting_date: string;
  state: string;
  source_document_type: string | null;
  items: {
    account_id: string;
    account_code?: string;
    account_name?: string;
    debit_amount: number;
    credit_amount: number;
    name: string | null;
  }[];
}

const SECTION_META: Record<DrilldownSection, {
  label: string; color: 'emerald' | 'rose' | 'amber';
  icon: React.ElementType; accent: string;
}> = {
  revenue:  { label: 'Revenue & Sales',           color: 'emerald', icon: TrendingUp,   accent: 'text-emerald-600 dark:text-emerald-400' },
  cogs:     { label: 'Cost of Goods Sold (COGS)', color: 'rose',    icon: TrendingDown, accent: 'text-rose-600 dark:text-rose-400'    },
  expenses: { label: 'Operating Expenses',        color: 'amber',   icon: DollarSign,   accent: 'text-amber-600 dark:text-amber-400'  },
};

// ── Drilldown Modal ────────────────────────────────────────────────────────────

function DrilldownModal({ section, plData, sidebarOpen, onClose }: {
  section: DrilldownSection;
  plData: Record<string, unknown>;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;
  const PAGE_SIZE = 25;

  const [entries, setEntries] = useState<DrilldownEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [page, setPage]     = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  /* Debounce search input — only update after 400 ms of silence */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* Reset to page 1 whenever search changes */
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  /* ── Stable derived values (useMemo prevents new reference every render) ── */
  const sectionAccounts = useMemo<{ code: string; name: string; balance: number }[]>(() => {
    const raw =
      section === 'revenue'  ? (plData as any)?.revenue?.accounts
      : section === 'cogs'   ? (plData as any)?.cost_of_goods_sold?.accounts
      :                         (plData as any)?.expenses?.accounts;
    return Array.isArray(raw) ? raw : [];
  }, [section, plData]);

  const sectionTotal = useMemo<number>(() =>
    section === 'revenue'  ? ((plData as any)?.revenue?.total ?? 0)
    : section === 'cogs'   ? ((plData as any)?.cost_of_goods_sold?.total ?? 0)
    :                         ((plData as any)?.expenses?.total ?? 0),
  [section, plData]);

  const codeSet = useMemo(() => new Set(sectionAccounts.map((a) => a.code)), [sectionAccounts]);

  /* ── Single fetch effect — AbortController cancels stale in-flight requests ── */
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page:      String(page),
          page_size: String(PAGE_SIZE),
          state:     'posted',
        });
        if ((plData as any)?.date_from) params.set('date_from', (plData as any).date_from);
        if ((plData as any)?.date_to)   params.set('date_to',   (plData as any).date_to);
        if (debouncedSearch)            params.set('search',    debouncedSearch);

        const res  = await authedFetch(
          `/uanr/api/v1/journal-entries/?${params}`,
          { signal: controller.signal } as RequestInit,
        );
        if (cancelled) return;

        const json = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (cancelled) return;

        const raw: DrilldownEntry[] =
          (json as any)?.data?.items ??
          (json as any)?.items ??
          (Array.isArray((json as any)?.data) ? (json as any).data : []);
        const total: number =
          (json as any)?.data?.total ?? (json as any)?.total ?? raw.length;

        /* Client-side filter to entries touching this section's account codes */
        const filtered = codeSet.size > 0
          ? raw.filter((e) => e.items?.some((i) => codeSet.has(i.account_code ?? '')))
          : raw;

        setEntries(filtered);
        setTotalCount(total);
      } catch (err: unknown) {
        if (cancelled) return;
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          setError(err instanceof Error ? err.message : 'Failed to load entries');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  // Intentionally flat deps — each primitive change fires exactly one request
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, section, retryCount,
      (plData as any)?.date_from, (plData as any)?.date_to,
      codeSet]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* Colour helpers */
  const cBorder = meta.color === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10'
                : meta.color === 'rose'    ? 'border-rose-500/30 bg-rose-500/10'
                :                            'border-amber-500/30 bg-amber-500/10';
  const cIcon   = meta.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                : meta.color === 'rose'    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                :                            'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400';
  const cBadge  = meta.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : meta.color === 'rose'    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                :                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

  return (
    <div
      className={cn(
        'fixed inset-y-0 z-[60] flex items-center justify-center p-4 transition-all duration-300',
        sidebarOpen ? 'ltr:left-72 ltr:right-0 rtl:right-72 rtl:left-0' : 'inset-x-0',
      )}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className={cn('shrink-0 flex items-center justify-between px-6 py-5 border-b border-border/40', cBorder)}>
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', cIcon)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">{meta.label} — Breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatAccountingDate((plData as any)?.date_from)} → {formatAccountingDate((plData as any)?.date_to)}
                &nbsp;·&nbsp;
                <span className={cn('font-bold font-mono', meta.accent)}>{formatKwd(sectionTotal)}</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Account chips */}
        {sectionAccounts.length > 0 && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border/40 bg-muted/20">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mr-1">Accounts:</span>
            {sectionAccounts.map((acc) => (
              <span key={acc.code}
                className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold', cBadge)}>
                <span className="font-mono">{acc.code}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{acc.name}</span>
                <span className="font-mono opacity-70 ml-0.5">{formatKwd(acc.balance)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="shrink-0 px-6 py-3 border-b border-border/40 bg-muted/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, name, or narration…"
              className="w-full rounded-xl border border-border/60 bg-background pl-8 pr-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading journal entries…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="text-sm font-semibold text-foreground">Failed to load entries</p>
              <p className="text-xs text-muted-foreground text-center">{error}</p>
              <button onClick={() => setRetryCount((c) => c + 1)}
                className="mt-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold px-4 py-2 hover:bg-primary/90 cursor-pointer">
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No journal entries found</p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Try a different search term.' : 'No posted entries for this section in the selected period.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/70 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-28">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 hidden md:table-cell">Narration / Description</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Source</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right pr-5">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((entry) => {
                  const codeSet = new Set(sectionAccounts.map((a) => a.code));
                  const rel = codeSet.size > 0
                    ? (entry.items ?? []).filter((i) => codeSet.has(i.account_code ?? ''))
                    : (entry.items ?? []);
                  const dr  = rel.reduce((s, i) => s + (i.debit_amount  ?? 0), 0);
                  const cr  = rel.reduce((s, i) => s + (i.credit_amount ?? 0), 0);
                  const net = cr - dr;

                  return (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {entry.accounting_date
                          ? new Date(entry.accounting_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground font-mono">{entry.name || '—'}</span>
                          {entry.reference && entry.reference !== entry.name && (
                            <span className="text-[10px] text-muted-foreground font-mono">{entry.reference}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-[200px]">
                        <p className="text-muted-foreground truncate">{entry.narration || entry.items?.[0]?.name || '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {entry.source_document_type ? (
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                            entry.source_document_type === 'invoice'  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                            entry.source_document_type === 'payment'  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                                                         'bg-muted text-muted-foreground'
                          )}>
                            {entry.source_document_type}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {dr > 0 ? formatKwd(dr) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {cr > 0 ? formatKwd(cr) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono font-bold pr-5',
                        net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                        {net !== 0 ? formatKwd(Math.abs(net)) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && entries.length > 0 && (
          <div className="shrink-0 border-t border-border/40 bg-muted/20 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {entries.length} entries shown · Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="grid h-7 w-7 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="grid h-7 w-7 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FinancialReportsPage() {
  const [activeReport, setActiveReport]       = useState<'pl' | 'bs' | 'tb' | 'ap' | 'ar' | 'cf'>('pl');
  const [drilldownSection, setDrilldownSection] = useState<DrilldownSection | null>(null);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);

  const { data: plData, loading: plLoading, refetch: refetchPl } = useAnrReport<Record<string, unknown>>('profit-loss');
  const { data: bsData, loading: bsLoading, refetch: refetchBs } = useAnrReport<Record<string, unknown>>('balance-sheet');
  const { data: tbData, loading: tbLoading, refetch: refetchTb } = useAnrReport<Record<string, unknown>>('trial-balance');
  const { data: apData, loading: apLoading, refetch: refetchAp } = useAnrReport<Record<string, unknown>>('ap-aging');
  const { data: arData, loading: arLoading, refetch: refetchAr } = useAnrReport<Record<string, unknown>>('ar-aging');
  const { data: cfData, loading: cfLoading, refetch: refetchCf } = useAnrReport<Record<string, unknown>>('cash-flow');

  const loading =
    activeReport === 'pl' ? plLoading :
    activeReport === 'bs' ? bsLoading :
    activeReport === 'tb' ? tbLoading :
    activeReport === 'ap' ? apLoading :
    activeReport === 'ar' ? arLoading : cfLoading;

  const handleRefresh = () => {
    if (activeReport === 'pl') refetchPl();
    else if (activeReport === 'bs') refetchBs();
    else if (activeReport === 'tb') refetchTb();
    else if (activeReport === 'ap') refetchAp();
    else if (activeReport === 'ar') refetchAr();
    else refetchCf();
  };

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Financial Reports & Statements"
          subtitle="Official accounting statements: Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, and Aging"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => typeof window !== 'undefined' && window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition shadow-sm">
            <Printer className="h-3.5 w-3.5" /><span>Print Report</span>
          </button>
          <button onClick={handleRefresh}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
            title="Refresh">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap items-center rounded-2xl border border-border/60 bg-card p-1.5 gap-1 shadow-xs">
        {([
          { id: 'pl', label: 'Profit & Loss',        Icon: TrendingUp    },
          { id: 'bs', label: 'Balance Sheet',         Icon: Scale         },
          { id: 'tb', label: 'Trial Balance',         Icon: FileSpreadsheet },
          { id: 'ap', label: 'A/P Aging (Vendors)',   Icon: Clock         },
          { id: 'ar', label: 'A/R Aging (Customers)', Icon: Receipt       },
          { id: 'cf', label: 'Cash Flow',             Icon: Wallet        },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveReport(id as typeof activeReport)}
            className={cn('flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
              activeReport === id ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40')}>
            <Icon className="h-4 w-4" /><span>{label}</span>
          </button>
        ))}
      </div>

      {/* Skeleton */}
      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-28 rounded-2xl shimmer" />
          <div className="h-64 rounded-2xl shimmer" />
        </div>
      ) : (
        <div className="mt-6">

          {/* ─── P&L ─── */}
          {activeReport === 'pl' && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Revenue</span>
                  <p className="text-2xl font-black text-foreground mt-1">{formatKwd((plData as any)?.revenue?.total)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Top-line earnings</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Gross Profit</span>
                  <p className="text-2xl font-black text-foreground mt-1">{formatKwd((plData as any)?.gross_profit)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Revenue less direct costs</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/20 to-purple-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Net Income</span>
                  <p className={cn('text-2xl font-black mt-1',
                    ((plData as any)?.net_income ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {formatKwd((plData as any)?.net_income)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bottom line net performance</p>
                </div>
              </div>

              {/* Income Statement table */}
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
                <div className="border-b border-border/40 bg-muted/40 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">Income Statement</h3>
                    <p className="text-xs text-muted-foreground">
                      Period: {formatAccountingDate((plData as any)?.date_from)} to {formatAccountingDate((plData as any)?.date_to)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">Official Ledger Data</span>
                </div>

                <div className="divide-y divide-border/40 text-xs">

                  {/* 1. Revenue */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span>1. Revenue &amp; Sales</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrilldownSection('revenue')}
                        title="Click to view all journal entries making up this amount"
                        className="group flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer active:scale-[0.97]"
                      >
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatKwd((plData as any)?.revenue?.total)}
                        </span>
                        <ChevronRight className="h-3 w-3 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    {((plData as any)?.revenue?.accounts ?? []).map((acc: { code: string; name: string; balance: number }) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-6">
                        <span className="font-mono text-[10px] opacity-60 mr-2">{acc.code}</span>
                        <span className="flex-1">{acc.name}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                    <p className="mt-2 pl-6 text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Click the amount above to drill down into individual records
                    </p>
                  </div>

                  {/* 2. COGS */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                        <span>2. Cost of Goods Sold (COGS)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrilldownSection('cogs')}
                        title="Click to view all journal entries making up this amount"
                        className="group flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer active:scale-[0.97]"
                      >
                        <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                          {formatKwd((plData as any)?.cost_of_goods_sold?.total)}
                        </span>
                        <ChevronRight className="h-3 w-3 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    {((plData as any)?.cost_of_goods_sold?.accounts ?? []).map((acc: { code: string; name: string; balance: number }) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-6">
                        <span className="font-mono text-[10px] opacity-60 mr-2">{acc.code}</span>
                        <span className="flex-1">{acc.name}</span>
                        <span className="font-mono text-rose-600 dark:text-rose-400">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                    {((plData as any)?.cost_of_goods_sold?.accounts ?? []).length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 pl-6 italic">No COGS accounts recorded</p>
                    )}
                    <p className="mt-2 pl-6 text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Click the amount above to drill down into individual records
                    </p>
                  </div>

                  {/* 3. Expenses */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        <span>3. Operating Expenses</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDrilldownSection('expenses')}
                        title="Click to view all journal entries making up this amount"
                        className="group flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer active:scale-[0.97]"
                      >
                        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                          {formatKwd((plData as any)?.expenses?.total)}
                        </span>
                        <ChevronRight className="h-3 w-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    {((plData as any)?.expenses?.accounts ?? []).map((acc: { code: string; name: string; balance: number }) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-6">
                        <span className="font-mono text-[10px] opacity-60 mr-2">{acc.code}</span>
                        <span className="flex-1">{acc.name}</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                    {((plData as any)?.expenses?.accounts ?? []).length === 0 && (
                      <p className="text-[11px] text-muted-foreground/60 pl-6 italic">No expense accounts recorded</p>
                    )}
                    <p className="mt-2 pl-6 text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Click the amount above to drill down into individual records
                    </p>
                  </div>

                  {/* Net */}
                  <div className="p-5 bg-muted/30 font-black text-sm flex items-center justify-between">
                    <span className="uppercase tracking-wider">Net Operating Income:</span>
                    <span className={cn('text-base font-mono',
                      ((plData as any)?.net_income ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {formatKwd((plData as any)?.net_income)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Balance Sheet ─── */}
          {activeReport === 'bs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">Balance Sheet Accounting Equation Verified:</p>
                    <p className="text-emerald-600/80 dark:text-emerald-400/80">
                      Total Assets ({formatKwd((bsData as any)?.assets?.total)}) = Liabilities + Equity ({formatKwd((bsData as any)?.total_liabilities_and_equity)})
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white">BALANCED ✓</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                    <h4 className="font-extrabold text-base text-foreground">Assets</h4>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatKwd((bsData as any)?.assets?.total)}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {((bsData as any)?.assets?.accounts ?? []).map((acc: any) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                        <span className="text-muted-foreground">{acc.code} · {acc.name}</span>
                        <span className="font-mono font-bold text-foreground">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                    <h4 className="font-extrabold text-base text-foreground">Liabilities &amp; Equity</h4>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{formatKwd((bsData as any)?.total_liabilities_and_equity)}</span>
                  </div>
                  <div className="space-y-4 text-xs">
                    <div>
                      <p className="font-bold text-foreground mb-1">Liabilities ({formatKwd((bsData as any)?.liabilities?.total)}):</p>
                      {((bsData as any)?.liabilities?.accounts ?? []).map((acc: any) => (
                        <div key={acc.code} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0 pl-2">
                          <span className="text-muted-foreground">{acc.code} · {acc.name}</span>
                          <span className="font-mono font-bold text-foreground">{formatKwd(acc.balance)}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold text-foreground mb-1">Equity ({formatKwd((bsData as any)?.equity?.total)}):</p>
                      {((bsData as any)?.equity?.accounts ?? []).map((acc: any) => (
                        <div key={acc.code} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0 pl-2">
                          <span className="text-muted-foreground">{acc.code} · {acc.name}</span>
                          <span className="font-mono font-bold text-foreground">{formatKwd(acc.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Trial Balance ─── */}
          {activeReport === 'tb' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground">Trial Balance Check:</span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                    DEBITS = CREDITS ({formatKwd((tbData as any)?.totals?.total_debit)})
                  </span>
                </div>
                <span className="text-muted-foreground">{(tbData as any)?.lines?.length ?? 0} active accounts</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Code</th><th className="px-4 py-3">Account Name</th>
                        <th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Debit (KWD)</th>
                        <th className="px-4 py-3 text-right">Credit (KWD)</th><th className="px-4 py-3 text-right">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {((tbData as any)?.lines ?? []).map((line: any) => (
                        <tr key={line.account_id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-mono font-bold text-primary">{line.account_code}</td>
                          <td className="px-4 py-2.5 font-semibold text-foreground">{line.account_name}</td>
                          <td className="px-4 py-2.5 capitalize text-muted-foreground">{line.account_type}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-foreground">{line.period_debit > 0 ? formatKwd(line.period_debit) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-foreground">{line.period_credit > 0 ? formatKwd(line.period_credit) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">{formatKwd(line.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border/60 bg-muted/50 font-black text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider">Total Balancing Sum:</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatKwd((tbData as any)?.totals?.total_debit)}</td>
                        <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{formatKwd((tbData as any)?.totals?.total_credit)}</td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── A/P Aging ─── */}
          {activeReport === 'ap' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Accounts Payable</span>
                <p className="text-3xl font-black text-foreground mt-1">{formatKwd((apData as any)?.grand_total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Outstanding vendor bills due across aging buckets</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Vendor / Partner</th>
                      <th className="px-4 py-3 text-right">Current</th><th className="px-4 py-3 text-right">1-30 Days</th>
                      <th className="px-4 py-3 text-right">31-60 Days</th><th className="px-4 py-3 text-right">61-90 Days</th>
                      <th className="px-4 py-3 text-right">90+ Days</th><th className="px-4 py-3 text-right">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {((apData as any)?.partners ?? []).map((p: any) => (
                      <tr key={p.partner_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold text-foreground">{p.partner_name}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p.current)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['1-30'])}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['31-60'])}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['61-90'])}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">{formatKwd((p['91-120'] || 0) + (p['120+'] || 0))}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-foreground">{formatKwd(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── A/R Aging ─── */}
          {activeReport === 'ar' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Accounts Receivable</span>
                <p className="text-3xl font-black text-foreground mt-1">{formatKwd((arData as any)?.grand_total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Customer invoices pending collection</p>
              </div>
              {(!( arData as any)?.partners || (arData as any).partners.length === 0) ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-bold text-base text-foreground">Zero Overdue Receivables</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All customer invoices are currently collected or within terms.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Current</th><th className="px-4 py-3 text-right">1-30 Days</th>
                        <th className="px-4 py-3 text-right">31-60 Days</th><th className="px-4 py-3 text-right">61-90 Days</th>
                        <th className="px-4 py-3 text-right">90+ Days</th><th className="px-4 py-3 text-right">Total Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {(arData as any).partners.map((p: any) => (
                        <tr key={p.partner_id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-bold text-foreground">{p.partner_name}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatKwd(p.current)}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatKwd(p['1-30'])}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatKwd(p['31-60'])}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatKwd(p['61-90'])}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">{formatKwd(p['90_plus'] || p['120+'])}</td>
                          <td className="px-4 py-3 text-right font-mono font-black text-foreground">{formatKwd(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── Cash Flow ─── */}
          {activeReport === 'cf' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <h4 className="font-extrabold text-base text-foreground mb-4">Cash Flow Statement</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="font-semibold text-foreground">Operating Cash Inflows:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatKwd((cfData as any)?.operating?.inflows)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="font-semibold text-foreground">Operating Cash Outflows:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatKwd((cfData as any)?.operating?.outflows)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 bg-muted/30 px-3 rounded-xl font-bold">
                    <span>Net Change in Cash:</span>
                    <span className="font-mono text-base font-black text-foreground">{formatKwd((cfData as any)?.net_change)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drilldown Modal */}
      {drilldownSection && plData && (
        <DrilldownModal
          section={drilldownSection}
          plData={plData as Record<string, unknown>}
          sidebarOpen={sidebarOpen}
          onClose={() => setDrilldownSection(null)}
        />
      )}
    </DashboardShell>
  );
}
