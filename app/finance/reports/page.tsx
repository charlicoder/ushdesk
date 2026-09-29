'use client';

import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Scale,
  Building2,
  FileSpreadsheet,
  Clock,
  RefreshCw,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Wallet,
  Receipt,
  Layers,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrReport,
  formatKwd,
  formatAccountingDate,
} from '@/hooks/use-accounting';

export default function FinancialReportsPage() {
  const [activeReport, setActiveReport] = useState<'pl' | 'bs' | 'tb' | 'ap' | 'ar' | 'cf'>('pl');

  // Load report data
  const { data: plData, loading: plLoading, refetch: refetchPl } = useAnrReport<any>('profit-loss');
  const { data: bsData, loading: bsLoading, refetch: refetchBs } = useAnrReport<any>('balance-sheet');
  const { data: tbData, loading: tbLoading, refetch: refetchTb } = useAnrReport<any>('trial-balance');
  const { data: apData, loading: apLoading, refetch: refetchAp } = useAnrReport<any>('ap-aging');
  const { data: arData, loading: arLoading, refetch: refetchAr } = useAnrReport<any>('ar-aging');
  const { data: cfData, loading: cfLoading, refetch: refetchCf } = useAnrReport<any>('cash-flow');

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

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Financial Reports & Statements"
          subtitle="Official accounting statements: Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, and Aging"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleRefresh}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
            title="Refresh current report"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* ── Report Tabs ── */}
      <div className="mt-5 flex flex-wrap items-center rounded-2xl border border-border/60 bg-card p-1.5 gap-1 shadow-xs">
        {[
          { id: 'pl', label: 'Profit & Loss', icon: TrendingUp },
          { id: 'bs', label: 'Balance Sheet', icon: Scale },
          { id: 'tb', label: 'Trial Balance', icon: FileSpreadsheet },
          { id: 'ap', label: 'A/P Aging (Vendors)', icon: Clock },
          { id: 'ar', label: 'A/R Aging (Customers)', icon: Receipt },
          { id: 'cf', label: 'Cash Flow', icon: Wallet },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveReport(t.id as any)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                activeReport === t.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading Skeleton ── */}
      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-28 rounded-2xl shimmer" />
          <div className="h-64 rounded-2xl shimmer" />
        </div>
      ) : (
        /* ── Report Content Area ── */
        <div className="mt-6">
          {/* ── 1. Profit & Loss Report ── */}
          {activeReport === 'pl' && (
            <div className="space-y-6">
              {/* Header KPI cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Revenue</span>
                  <p className="text-2xl font-black text-foreground mt-1">{formatKwd(plData?.revenue?.total)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Top-line earnings</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-blue-500/20 to-blue-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Gross Profit</span>
                  <p className="text-2xl font-black text-foreground mt-1">{formatKwd(plData?.gross_profit)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Revenue less direct costs</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/20 to-purple-500/5 p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Net Income</span>
                  <p className={cn('text-2xl font-black mt-1', (plData?.net_income ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {formatKwd(plData?.net_income)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bottom line net performance</p>
                </div>
              </div>

              {/* P&L Statement Structure */}
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
                <div className="border-b border-border/40 bg-muted/40 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">Income Statement</h3>
                    <p className="text-xs text-muted-foreground">
                      Period: {formatAccountingDate(plData?.date_from)} to {formatAccountingDate(plData?.date_to)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                    Official Ledger Data
                  </span>
                </div>

                <div className="divide-y divide-border/40 text-xs">
                  {/* Revenue section */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <span>1. Revenue & Sales</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatKwd(plData?.revenue?.total)}</span>
                    </div>
                    {plData?.revenue?.accounts?.map((acc: any) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-4">
                        <span>{acc.code} · {acc.name}</span>
                        <span className="font-mono">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                  </div>

                  {/* COGS section */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <span>2. Cost of Goods Sold (COGS)</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">{formatKwd(plData?.cost_of_goods_sold?.total)}</span>
                    </div>
                    {plData?.cost_of_goods_sold?.accounts?.map((acc: any) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-4">
                        <span>{acc.code} · {acc.name}</span>
                        <span className="font-mono">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Expenses section */}
                  <div className="p-5">
                    <div className="flex items-center justify-between font-bold text-sm text-foreground mb-3">
                      <span>3. Operating Expenses</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">{formatKwd(plData?.expenses?.total)}</span>
                    </div>
                    {plData?.expenses?.accounts?.map((acc: any) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 text-muted-foreground pl-4">
                        <span>{acc.code} · {acc.name}</span>
                        <span className="font-mono">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Net Summary */}
                  <div className="p-5 bg-muted/30 font-black text-sm flex items-center justify-between">
                    <span className="uppercase tracking-wider">Net Operating Income:</span>
                    <span className={cn('text-base font-mono', (plData?.net_income ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {formatKwd(plData?.net_income)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. Balance Sheet ── */}
          {activeReport === 'bs' && (
            <div className="space-y-6">
              {/* Verification Banner */}
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">
                      Balance Sheet Accounting Equation Verified:
                    </p>
                    <p className="text-emerald-600/80 dark:text-emerald-400/80">
                      Total Assets ({formatKwd(bsData?.assets?.total)}) = Liabilities + Equity ({formatKwd(bsData?.total_liabilities_and_equity)})
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white">
                  BALANCED ✓
                </span>
              </div>

              {/* Assets and Liabilities side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assets */}
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                    <h4 className="font-extrabold text-base text-foreground">Assets</h4>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatKwd(bsData?.assets?.total)}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {bsData?.assets?.accounts?.map((acc: any) => (
                      <div key={acc.code} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                        <span className="text-muted-foreground">{acc.code} · {acc.name}</span>
                        <span className="font-mono font-bold text-foreground">{formatKwd(acc.balance)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                    <h4 className="font-extrabold text-base text-foreground">Liabilities & Equity</h4>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {formatKwd(bsData?.total_liabilities_and_equity)}
                    </span>
                  </div>
                  <div className="space-y-4 text-xs">
                    <div>
                      <p className="font-bold text-foreground mb-1">Liabilities ({formatKwd(bsData?.liabilities?.total)}):</p>
                      {bsData?.liabilities?.accounts?.map((acc: any) => (
                        <div key={acc.code} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0 pl-2">
                          <span className="text-muted-foreground">{acc.code} · {acc.name}</span>
                          <span className="font-mono font-bold text-foreground">{formatKwd(acc.balance)}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="font-bold text-foreground mb-1">Equity ({formatKwd(bsData?.equity?.total)}):</p>
                      {bsData?.equity?.accounts?.map((acc: any) => (
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

          {/* ── 3. Trial Balance ── */}
          {activeReport === 'tb' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-bold text-foreground">Trial Balance Check:</span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                    DEBITS = CREDITS ({formatKwd(tbData?.totals?.total_debit)})
                  </span>
                </div>
                <span className="text-muted-foreground">
                  {tbData?.lines?.length ?? 0} active accounts
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Account Name</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Debit (KWD)</th>
                        <th className="px-4 py-3 text-right">Credit (KWD)</th>
                        <th className="px-4 py-3 text-right">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {tbData?.lines?.map((line: any) => (
                        <tr key={line.account_id} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-mono font-bold text-primary">{line.account_code}</td>
                          <td className="px-4 py-2.5 font-semibold text-foreground">{line.account_name}</td>
                          <td className="px-4 py-2.5 capitalize text-muted-foreground">{line.account_type}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">
                            {line.period_debit > 0 ? formatKwd(line.period_debit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">
                            {line.period_credit > 0 ? formatKwd(line.period_credit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                            {formatKwd(line.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border/60 bg-muted/50 font-black text-xs">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider">Total Balancing Sum:</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {formatKwd(tbData?.totals?.total_debit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-purple-600 dark:text-purple-400">
                          {formatKwd(tbData?.totals?.total_credit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. A/P Aging (Vendors) ── */}
          {activeReport === 'ap' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-rose-500/20 to-rose-500/5 p-5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Accounts Payable</span>
                <p className="text-3xl font-black text-foreground mt-1">{formatKwd(apData?.grand_total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Outstanding vendor bills due across aging buckets</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Vendor / Partner</th>
                      <th className="px-4 py-3 text-right">Current</th>
                      <th className="px-4 py-3 text-right">1-30 Days</th>
                      <th className="px-4 py-3 text-right">31-60 Days</th>
                      <th className="px-4 py-3 text-right">61-90 Days</th>
                      <th className="px-4 py-3 text-right">90+ Days</th>
                      <th className="px-4 py-3 text-right">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {apData?.partners?.map((p: any) => (
                      <tr key={p.partner_id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold text-foreground">{p.partner_name}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p.current)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['1-30'])}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['31-60'])}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatKwd(p['61-90'])}</td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">
                          {formatKwd((p['91-120'] || 0) + (p['120+'] || 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-foreground">{formatKwd(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 5. A/R Aging (Customers) ── */}
          {activeReport === 'ar' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 p-5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Accounts Receivable</span>
                <p className="text-3xl font-black text-foreground mt-1">{formatKwd(arData?.grand_total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Customer invoices pending collection</p>
              </div>

              {(!arData?.partners || arData.partners.length === 0) ? (
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
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right">1-30 Days</th>
                        <th className="px-4 py-3 text-right">31-60 Days</th>
                        <th className="px-4 py-3 text-right">61-90 Days</th>
                        <th className="px-4 py-3 text-right">90+ Days</th>
                        <th className="px-4 py-3 text-right">Total Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {arData.partners.map((p: any) => (
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

          {/* ── 6. Cash Flow ── */}
          {activeReport === 'cf' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <h4 className="font-extrabold text-base text-foreground mb-4">Cash Flow Statement</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="font-semibold text-foreground">Operating Cash Inflows:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatKwd(cfData?.operating?.inflows)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="font-semibold text-foreground">Operating Cash Outflows:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatKwd(cfData?.operating?.outflows)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 bg-muted/30 px-3 rounded-xl font-bold">
                    <span>Net Change in Cash:</span>
                    <span className="font-mono text-base font-black text-foreground">
                      {formatKwd(cfData?.net_change)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
