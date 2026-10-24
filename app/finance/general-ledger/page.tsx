'use client';

import { kuwaitDateString } from '@/lib/datetime';
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
import {
  DateRangeFilter,
  DateFilterActiveBadge,
  type DateFilterType,
  type DateRange,
} from '@/components/dashboard/date-range-filter';
import { cn } from '@/lib/utils';

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
  total_debit?: number;
  total_credit?: number;
  page: number;
  page_size: number;
}

export default function GeneralLedgerPage() {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [dateRange,  setDateRange]  = useState<DateRange>({});
  const [accountId,  setAccountId]  = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(20);

  const { items: accounts } = useAnrList<Account>('accounts', { pageSize: 200 });

  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (dateRange.from) params.date_from = dateRange.from;
  if (dateRange.to)   params.date_to   = dateRange.to;
  if (accountId)      params.account_id = accountId;

  const { data, loading, error, refetch } = useAnrReport<LedgerReport>('general-ledger', params);

  const lines = data?.lines ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pageTotals = useMemo(
    () =>
      lines.reduce(
        (acc, l) => ({ debit: acc.debit + Number(l.debit || 0), credit: acc.credit + Number(l.credit || 0) }),
        { debit: 0, credit: 0 },
      ),
    [lines],
  );

  const effectiveDebit = data?.total_debit !== undefined ? data.total_debit : pageTotals.debit;
  const effectiveCredit = data?.total_credit !== undefined ? data.total_credit : pageTotals.credit;
  const effectiveNet = effectiveDebit - effectiveCredit;

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
    const fromLabel = dateRange.from || 'all';
    const toLabel = dateRange.to || 'all';
    a.download = `general-ledger_${fromLabel}_${toLabel}.csv`;
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
            sub: total > pageSize ? `Showing ${lines.length} of ${total} lines (Page ${page}/${pages})` : `Page ${page} of ${pages}`,
            icon: Rows3,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Total Debit',
            value: money(effectiveDebit),
            sub: total > pageSize ? `Full filtered sum (${total} lines)` : 'Sum of shown lines',
            icon: ArrowDownCircle,
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Total Credit',
            value: money(effectiveCredit),
            sub: total > pageSize ? `Full filtered sum (${total} lines)` : 'Sum of shown lines',
            icon: ArrowUpCircle,
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net Balance',
            value: money(effectiveNet),
            sub: 'Total Debit − Total Credit',
            icon: ScrollText,
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
          },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
        {/* All accounts filter (reduced width, placed first) */}
        <div className="w-56 sm:w-64">
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

        {/* Date Filter Button & Dropdown (right to All accounts) */}
        <DateRangeFilter
          buttonLabelPrefix="Date Filters"
          dateFilter={dateFilter}
          dateRange={dateRange}
          onChange={(type, range) => {
            setDateFilter(type);
            setDateRange(range);
            setPage(1);
          }}
        />

        <RefreshButton onClick={refetch} loading={loading} />
      </div>

      {/* ── Active Date Filter Badge ── */}
      <DateFilterActiveBadge
        dateFilter={dateFilter}
        dateRange={dateRange}
        onClear={() => {
          setDateFilter('all');
          setDateRange({});
          setPage(1);
        }}
      />

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

        {/* ── Pagination ── */}
        {total > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/60 pt-4">
            <div className="flex items-center gap-2">
              <span>
                Showing <span className="font-semibold text-foreground">{lines.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                <span className="font-semibold text-foreground">{Math.min(page * pageSize, total)}</span> of{' '}
                <span className="font-semibold text-foreground">{total.toLocaleString()}</span> total lines
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-border/60 bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>

              {pages > 1 &&
                Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (pages > 5 && page > 3) {
                    pageNum = Math.min(pages - 4 + i, page - 2 + i);
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold transition cursor-pointer',
                        page === pageNum
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'border border-border/60 bg-card hover:bg-muted/60 text-muted-foreground'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}

              <button
                onClick={() => setPage((p) => Math.min(pages, page + 1))}
                disabled={page >= pages}
                className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
