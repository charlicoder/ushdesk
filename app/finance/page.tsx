'use client';

import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  FileText,
  Layers,
  Building2,
  PiggyBank,
  BarChart3,
  Percent,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Wallet,
  Scale,
  Calendar,
  AlertCircle,
  Handshake,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrReport,
  useAnrList,
  formatKwd,
  formatAccountingDate,
  getStateBadge,
  ProfitLossReport,
  BalanceSheetReport,
  AgingReport,
  Invoice,
  JournalEntry,
} from '@/hooks/use-accounting';

export default function FinanceOverviewPage() {
  const { data: plData, loading: plLoading, refetch: refetchPl } = useAnrReport<ProfitLossReport>('profit-loss');
  const { data: bsData, loading: bsLoading, refetch: refetchBs } = useAnrReport<BalanceSheetReport>('balance-sheet');
  const { data: arData, loading: arLoading, refetch: refetchAr } = useAnrReport<AgingReport>('ar-aging');
  const { data: apData, loading: apLoading, refetch: refetchAp } = useAnrReport<AgingReport>('ap-aging');

  const { items: recentInvoices, loading: invLoading, refetch: refetchInv } = useAnrList<Invoice>('invoices', { pageSize: 5 });
  const { items: recentEntries, loading: entLoading, refetch: refetchEnt } = useAnrList<JournalEntry>('journal-entries', { pageSize: 5 });

  const loading = plLoading || bsLoading || arLoading || apLoading;

  const handleRefreshAll = () => {
    refetchPl();
    refetchBs();
    refetchAr();
    refetchAp();
    refetchInv();
    refetchEnt();
  };

  const revenue = plData?.revenue?.total ?? 0;
  const grossProfit = plData?.gross_profit ?? 0;
  const netIncome = plData?.net_income ?? 0;
  const totalAssets = bsData?.assets?.total ?? 0;
  const arTotal = arData?.grand_total?.total ?? 0;
  const apTotal = apData?.grand_total?.total ?? 0;
  const isBalanced = bsData?.balanced ?? true;

  const quickNav = [
    {
      title: 'Invoices & Bills',
      desc: 'Customer invoices, vendor bills & line items',
      href: '/finance/invoices',
      icon: Receipt,
      color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: '490+ Records',
    },
    {
      title: 'Journal Entries',
      desc: 'General ledger double-entry bookkeeping',
      href: '/finance/journal-entries',
      icon: FileText,
      color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badge: 'Balanced',
    },
    {
      title: 'Chart of Accounts',
      desc: 'Assets, liabilities, equity, revenue & expenses',
      href: '/finance/accounts',
      icon: Layers,
      color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: '65 Accounts',
    },
    {
      title: 'Banking & Cash',
      desc: 'Bank accounts, statements & payments ledger',
      href: '/finance/banking',
      icon: Building2,
      color: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Reconciliation',
    },
    {
      title: 'Budgets & Planning',
      desc: 'Budget vs actual variances & analytic plans',
      href: '/finance/budgets',
      icon: PiggyBank,
      color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20',
      badge: 'Planning',
    },
    {
      title: 'Financial Reports',
      desc: 'P&L, Balance Sheet, Trial Balance, Aging & Cash Flow',
      href: '/finance/reports',
      icon: BarChart3,
      color: 'from-indigo-500/20 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      badge: '6 Reports',
    },
    {
      title: 'Business Partners',
      desc: 'Verified vendors, suppliers, customers & corporate accounts',
      href: '/finance/partners',
      icon: Handshake,
      color: 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400 border-sky-500/20',
      badge: '42 Partners',
    },
    {
      title: 'Taxes & Fiscal',
      desc: 'VAT rules, fiscal periods, years & business compliance',
      href: '/finance/taxes',
      icon: Percent,
      color: 'from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-400 border-teal-500/20',
      badge: 'Compliance',
    },
  ];

  return (
    <DashboardShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Finance & Accounting"
          subtitle="Real-time financial performance, general ledger, and accounting intelligence"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition shadow-sm"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
            <span>Refresh Data</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ushanr Online</span>
          </div>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: 'Total Revenue',
            val: formatKwd(revenue),
            sub: plData ? `${formatAccountingDate(plData.date_from)} - ${formatAccountingDate(plData.date_to)}` : 'Current period',
            icon: TrendingUp,
            bg: 'from-emerald-500/25 via-emerald-500/10 to-transparent',
            text: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Gross Profit',
            val: formatKwd(grossProfit),
            sub: revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}% margin` : 'Gross margin',
            icon: Wallet,
            bg: 'from-sky-500/25 via-sky-500/10 to-transparent',
            text: 'text-sky-600 dark:text-sky-400',
          },
          {
            label: 'Net Income',
            val: formatKwd(netIncome),
            sub: netIncome >= 0 ? 'Profitable' : 'Deficit',
            icon: Scale,
            bg: netIncome >= 0
              ? 'from-emerald-500/25 via-emerald-500/10 to-transparent'
              : 'from-rose-500/25 via-rose-500/10 to-transparent',
            text: netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Total Assets',
            val: formatKwd(totalAssets),
            sub: 'Balance sheet value',
            icon: Building2,
            bg: 'from-violet-500/25 via-violet-500/10 to-transparent',
            text: 'text-violet-600 dark:text-violet-400',
          },
          {
            label: 'Accounts Receivable',
            val: formatKwd(arTotal),
            sub: `${arData?.partners?.length ?? 0} customers due`,
            icon: Receipt,
            bg: 'from-amber-500/25 via-amber-500/10 to-transparent',
            text: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Accounts Payable',
            val: formatKwd(apTotal),
            sub: `${apData?.partners?.length ?? 0} vendors pending`,
            icon: CreditCard,
            bg: 'from-rose-500/25 via-rose-500/10 to-transparent',
            text: 'text-rose-600 dark:text-rose-400',
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md',
                c.bg,
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <div className={cn('grid h-8 w-8 place-items-center rounded-xl bg-white/70 dark:bg-black/30 shadow-xs', c.text)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-lg font-black tracking-tight text-foreground truncate">{c.val}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Balance Status Banner ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 backdrop-blur px-5 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Double-Entry Ledger Integrity:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isBalanced ? 'Balanced & Verified' : 'Attention Required'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total Assets equal Liabilities plus Equity. Operating currency is locked to Kuwaiti Dinar (KWD).
            </p>
          </div>
        </div>

        <Link
          href="/finance/reports"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-95 transition shadow-sm ml-auto"
        >
          <span>View Balance Sheet</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Submenus Quick Navigation ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Finance & Accounting Modules
          </h2>
          <span className="text-xs text-muted-foreground">Click any module to inspect detailed ledger data</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quickNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex flex-col justify-between rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/40',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn('grid h-11 w-11 place-items-center rounded-2xl border bg-gradient-to-br shadow-xs', item.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {item.badge}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-foreground group-hover:text-primary transition">
                      {item.title}
                    </h3>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Recent Activity Grids ── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Recent Invoices & Bills</h3>
            </div>
            <Link
              href="/finance/invoices"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {invLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl shimmer" />
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No invoices recorded yet</p>
          ) : (
            <div className="divide-y divide-border/40">
              {recentInvoices.map((inv) => {
                const badge = getStateBadge(inv.state);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-2.5 text-xs hover:bg-muted/30 px-2 rounded-lg transition">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{inv.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatAccountingDate(inv.invoice_date)} · {inv.invoice_type.toUpperCase()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-foreground">{formatKwd(inv.amount_total)}</p>
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold mt-0.5', badge.bg)}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Journal Entries */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Recent Journal Entries</h3>
            </div>
            <Link
              href="/finance/journal-entries"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {entLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl shimmer" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No journal entries recorded yet</p>
          ) : (
            <div className="divide-y divide-border/40">
              {recentEntries.map((entry) => {
                const badge = getStateBadge(entry.state);
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2.5 text-xs hover:bg-muted/30 px-2 rounded-lg transition">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{entry.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{entry.narration || entry.reference || 'General journal entry'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-foreground">{formatKwd(entry.amount_total)}</p>
                      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold mt-0.5', badge.bg)}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
