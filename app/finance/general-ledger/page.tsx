'use client';

import { useMemo, useState } from 'react';
import { ScrollText, Download, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, Rows3 } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { useAnrList, useAnrReport, Account } from '@/hooks/use-accounting';
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

interface LedgerLine {
  date: string;
  entry_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  account_type?: string | null;
  description?: string | null;
  debit: number | string;
  credit: number | string;
  balance: number | string;
}

interface LedgerReport {
  lines: LedgerLine[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 100;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function GeneralLedgerPage() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(isoDay(new Date(today.getFullYear(), 0, 1)));
  const [dateTo, setDateTo] = useState(isoDay(today));
  const [accountId, setAccountId] = useState('');
  const [page, setPage] = useState(1);

  const { items: accounts } = useAnrList<Account>('accounts', { pageSize: 200 });

  const params: Record<string, string | number> = { date_from: dateFrom, date_to: dateTo, page, page_size: PAGE_SIZE };
  if (accountId) params.account_id = accountId;

  const { data, loading, error, refetch } = useAnrReport<LedgerReport>('general-ledger', params);

  const lines = data?.lines ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, l) => ({ debit: acc.debit + Number(l.debit || 0), credit: acc.credit + Number(l.credit || 0) }),
        { debit: 0, credit: 0 },
      ),
    [lines],
  );

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Entry', 'Account Code', 'Account', 'Description', 'Debit', 'Credit', 'Balance'],
      ...lines.map((l) => [l.date, l.entry_name, l.account_code, l.account_name, l.description, l.debit, l.credit, l.balance]),
    ];
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="General Ledger" subtitle="Detailed posted journal lines with running balances per account" />
        <button
          onClick={exportCsv}
          disabled={lines.length === 0}
          className="mt-1 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-xs font-bold transition hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <StatGrid
        items={[
          {
            label: 'Lines',
            value: total.toString(),
            sub: `Page ${page} of ${pages}`,
            icon: Rows3,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Debit (page)',
            value: money(totals.debit),
            sub: 'Sum of shown lines',
            icon: ArrowDownCircle,
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Credit (page)',
            value: money(totals.credit),
            sub: 'Sum of shown lines',
            icon: ArrowUpCircle,
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net (page)',
            value: money(totals.debit - totals.credit),
            sub: 'Debit − Credit',
            icon: ScrollText,
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
          },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div>
          <label className={labelCls}>From</label>
          <input
            type="date"
            className={inputCls}
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className={labelCls}>To</label>
          <input
            type="date"
            className={inputCls}
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className={labelCls}>Account</label>
          <select
            className={inputCls}
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        <RefreshButton onClick={refetch} loading={loading} />
      </div>

      <div className="mt-5">
        {error && <ErrorBanner message={String(error)} className="mb-4" />}
        {loading && !data ? (
          <TableSkeleton rows={8} height="h-10" />
        ) : lines.length === 0 ? (
          <EmptyState icon={ScrollText} title="No ledger lines" text="No posted journal lines match the selected period and account." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2.5">{l.date}</td>
                    <td className="px-4 py-2.5 font-semibold">{l.entry_name || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-muted-foreground">{l.account_code}</span> {l.account_name}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 text-muted-foreground">{l.description || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(l.debit) ? money(l.debit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(l.credit) ? money(l.credit) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground">
              Page {page} / {pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
