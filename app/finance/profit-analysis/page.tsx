'use client';

import { kuwaitDateString } from '@/lib/datetime';
import { useState } from 'react';
import { TrendingUp, Wallet, Receipt, Percent, Layers } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAnrReport } from '@/hooks/use-accounting';
import {
  inputCls,
  labelCls,
  money,
  StatGrid,
  EmptyState,
  TableSkeleton,
  ErrorBanner,
  RefreshButton,
} from '@/components/finance/finance-ui';

interface MonthRow {
  month: string;
  revenue: number | string;
  cogs: number | string;
  expenses: number | string;
  gross_profit: number | string;
  net_profit: number | string;
  gross_margin_pct: number | string;
  net_margin_pct: number | string;
}
interface MonthlyReport {
  months: MonthRow[];
}
interface AnalyticLine {
  account_id: string;
  code?: string | null;
  name: string;
  plan_name?: string | null;
  revenue: number | string;
  cost: number | string;
  net_contribution: number | string;
}
interface AnalyticReport {
  lines: AnalyticLine[];
  total_revenue: number | string;
  total_cost: number | string;
  total_net: number | string;
}

const isoDay = (d: Date) => kuwaitDateString(d);
const num = (v: unknown) => Number(v ?? 0) || 0;

export default function ProfitAnalysisPage() {
  const today = new Date();
  const [tab, setTab] = useState<'monthly' | 'analytic'>('monthly');
  const [dateFrom, setDateFrom] = useState(isoDay(new Date(today.getFullYear(), 0, 1)));
  const [dateTo, setDateTo] = useState(isoDay(today));

  const range = { date_from: dateFrom, date_to: dateTo };
  const monthly = useAnrReport<MonthlyReport>('monthly-profit-loss', range);
  const analytic = useAnrReport<AnalyticReport>('analytic-profit-loss', range);

  const months = monthly.data?.months ?? [];
  const totalRevenue = months.reduce((s, m) => s + num(m.revenue), 0);
  const totalExpenses = months.reduce((s, m) => s + num(m.cogs) + num(m.expenses), 0);
  const totalNet = months.reduce((s, m) => s + num(m.net_profit), 0);
  const avgMargin = totalRevenue ? (totalNet / totalRevenue) * 100 : 0;
  const maxBar = Math.max(1, ...months.map((m) => Math.max(num(m.revenue), num(m.cogs) + num(m.expenses))));

  const aLines = analytic.data?.lines ?? [];
  const active = tab === 'monthly' ? monthly : analytic;

  return (
    <DashboardShell>
      <PageHeader title="Profit Analysis" subtitle="Monthly profit trend and analytic (cost-center) contribution" />

      <StatGrid
        items={[
          {
            label: 'Revenue',
            value: money(totalRevenue),
            sub: 'Selected period',
            icon: Wallet,
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Costs & Expenses',
            value: money(totalExpenses),
            sub: 'COGS + operating',
            icon: Receipt,
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net Profit',
            value: money(totalNet),
            sub: 'Revenue − costs',
            icon: TrendingUp,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Net Margin',
            value: `${avgMargin.toFixed(1)}%`,
            sub: 'Net profit / revenue',
            icon: Percent,
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
          },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
          {(
            [
              ['monthly', 'Monthly Trend'],
              ['analytic', 'Cost Centers'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                tab === k ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-end gap-3">
          <div>
            <label className={labelCls}>From</label>
            <input type="date" className={inputCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" className={inputCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <RefreshButton onClick={active.refetch} loading={active.loading} />
        </div>
      </div>

      <div className="mt-5">
        {active.error && <ErrorBanner message={String(active.error)} className="mb-4" />}

        {tab === 'monthly' ? (
          monthly.loading && !monthly.data ? (
            <TableSkeleton rows={6} height="h-10" />
          ) : months.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No data for this period" text="No posted entries were found in the selected date range." />
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="mb-3 flex items-center gap-4 text-[11px] font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Costs & Expenses
                  </span>
                </div>
                <div className="flex h-44 items-end gap-3 overflow-x-auto">
                  {months.map((m) => (
                    <div key={m.month} className="flex min-w-[48px] flex-1 flex-col items-center gap-1">
                      <div className="flex h-36 w-full items-end justify-center gap-1">
                        <div
                          className="w-3 rounded-t bg-emerald-500 transition-all"
                          style={{ height: `${(num(m.revenue) / maxBar) * 100}%` }}
                          title={`Revenue ${money(m.revenue)}`}
                        />
                        <div
                          className="w-3 rounded-t bg-rose-500 transition-all"
                          style={{ height: `${((num(m.cogs) + num(m.expenses)) / maxBar) * 100}%` }}
                          title={`Costs ${money(num(m.cogs) + num(m.expenses))}`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">COGS</th>
                      <th className="px-4 py-3 text-right">Gross Profit</th>
                      <th className="px-4 py-3 text-right">Expenses</th>
                      <th className="px-4 py-3 text-right">Net Profit</th>
                      <th className="px-4 py-3 text-right">Net Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.month} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-semibold">{m.month}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(m.revenue)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(m.cogs)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(m.gross_profit)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{money(m.expenses)}</td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-bold tabular-nums',
                            num(m.net_profit) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                          )}
                        >
                          {money(m.net_profit)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{num(m.net_margin_pct).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : analytic.loading && !analytic.data ? (
          <TableSkeleton rows={6} height="h-10" />
        ) : aLines.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No cost-center activity"
            text="No journal items are tagged with analytic accounts in the selected period."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Analytic Account</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Net Contribution</th>
                </tr>
              </thead>
              <tbody>
                {aLines.map((l) => (
                  <tr key={l.account_id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{l.code}</span>{' '}
                      <span className="font-semibold">{l.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.plan_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(l.revenue)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(l.cost)}</td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right font-bold tabular-nums',
                        num(l.net_contribution) >= 0 ? 'text-emerald-600' : 'text-rose-600',
                      )}
                    >
                      {money(l.net_contribution)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-bold">
                  <td className="px-4 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(analytic.data?.total_revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(analytic.data?.total_cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(analytic.data?.total_net)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
