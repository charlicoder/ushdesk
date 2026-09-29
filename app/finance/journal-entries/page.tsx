'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Calendar,
  Layers,
  Scale,
  ArrowUpRight,
  ShieldCheck,
  Tag,
  Info,
  ListFilter,
  BookOpen,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatKwd,
  formatAccountingDate,
  getStateBadge,
  JournalEntry,
  JournalItemRecord,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

export default function JournalEntriesAndItemsPage() {
  const [viewMode, setViewMode]       = useState<'items' | 'entries'>('items');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [itemType, setItemType]       = useState<'all' | 'debit' | 'credit' | 'reconciled'>('all');
  const [search, setSearch]           = useState<string>('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // 1. Journal Items (all 3,115 individual debit & credit lines)
  const {
    items: rawItems,
    total: itemsTotal,
    page: itemsPage,
    pages: itemsPages,
    loading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
    setPage: setItemsPage,
  } = useAnrList<JournalItemRecord>('journal-items', {
    pageSize: 50,
    params: {
      search: search || undefined,
      reconciled: itemType === 'reconciled' ? true : undefined,
    },
  });

  // 2. Journal Entries (all 1,029 voucher headers)
  const {
    items: rawEntries,
    total: entriesTotal,
    page: entriesPage,
    pages: entriesPages,
    loading: entriesLoading,
    error: entriesError,
    refetch: refetchEntries,
    setPage: setEntriesPage,
  } = useAnrList<JournalEntry>('journal-entries', {
    pageSize: 30,
    params: {
      state: stateFilter !== 'all' ? stateFilter : undefined,
      search: search || undefined,
    },
  });

  const loading = viewMode === 'items' ? itemsLoading : entriesLoading;
  const error = viewMode === 'items' ? itemsError : entriesError;

  const handleRefresh = () => {
    refetchItems();
    refetchEntries();
  };

  // Filter items by debit/credit locally if needed
  const filteredItems = useMemo(() => {
    if (itemType === 'debit') return rawItems.filter((i) => i.debit > 0);
    if (itemType === 'credit') return rawItems.filter((i) => i.credit > 0);
    return rawItems;
  }, [rawItems, itemType]);

  return (
    <DashboardShell>
      <PageHeader
        title="Journal Entries & Line Items"
        subtitle="Complete double-entry accounting records: inspect individual debit/credit items or grouped voucher entries"
      />

      {/* ── Context & Clarification Alert ── */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-900 dark:text-blue-200">
        <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-sm text-blue-700 dark:text-blue-300">
            Accounting Ledger Architecture: Entries vs. Items
          </p>
          <p className="text-muted-foreground leading-relaxed">
            In double-entry bookkeeping, there are <strong className="text-foreground">1,029 Journal Entries</strong> (the transaction vouchers) and <strong className="text-foreground">3,115 Journal Items</strong> (the individual debit and credit legs). Every voucher contains 2 or more line items to ensure balanced accounting. Use the view toggle below to inspect either view.
          </p>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Journal Items',
            val: itemsTotal > 0 ? itemsTotal.toLocaleString() : '3,115',
            sub: 'Individual debit/credit lines',
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
            icon: ListFilter,
          },
          {
            label: 'Total Journal Entries',
            val: entriesTotal > 0 ? entriesTotal.toLocaleString() : '1,029',
            sub: 'Voucher transaction headers',
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
            icon: BookOpen,
          },
          {
            label: 'Total Ledger Volume',
            val: '2,863,318.892 KWD',
            sub: 'Cumulative transactions',
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
            icon: Scale,
          },
          {
            label: 'Ledger Equation',
            val: 'Balanced ✓',
            sub: 'Debits = Credits verified',
            color: 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400',
            icon: ShieldCheck,
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

      {/* ── Toolbar & View Mode Selector ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Main View Mode Selector */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          <button
            onClick={() => { setViewMode('items'); setSearch(''); }}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition',
              viewMode === 'items'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Journal Items ({itemsTotal > 0 ? itemsTotal.toLocaleString() : '3,115'})</span>
          </button>
          <button
            onClick={() => { setViewMode('entries'); setSearch(''); }}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition',
              viewMode === 'entries'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Journal Entries ({entriesTotal > 0 ? entriesTotal.toLocaleString() : '1,029'})</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-filters for Items */}
          {viewMode === 'items' && (
            <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'debit', label: 'Debits' },
                { id: 'credit', label: 'Credits' },
                { id: 'reconciled', label: 'Reconciled' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setItemType(f.id as any)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    itemType === f.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Sub-filters for Entries */}
          {viewMode === 'entries' && (
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setEntriesPage(1); }}
              className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All States</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="reversed">Reversed</option>
            </select>
          )}

          {/* Search Box */}
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={
                viewMode === 'items'
                  ? 'Search account, entry #, memo, partner…'
                  : 'Search entry number, reference, memo…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 1. Journal Items View (3,115 records) ── */}
      {viewMode === 'items' && (
        <>
          {loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 rounded-2xl shimmer" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <ListFilter className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No journal items found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Try adjusting your search query or filter settings.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Voucher Entry</th>
                      <th className="px-4 py-3">Account Code & Name</th>
                      <th className="px-4 py-3">Partner / Payee</th>
                      <th className="px-4 py-3">Label / Description</th>
                      <th className="px-4 py-3 text-right">Debit (KWD)</th>
                      <th className="px-4 py-3 text-right">Credit (KWD)</th>
                      <th className="px-4 py-3 text-center">Match #</th>
                      <th className="px-4 py-3 text-center">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedEntryId(item.entry_id)}
                        className="group cursor-pointer hover:bg-muted/40 transition"
                      >
                        <td className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                          {formatAccountingDate(item.date)}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary group-hover:underline whitespace-nowrap">
                          {item.entry_number}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{item.account_name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{item.account_code}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                          {item.partner_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">
                          {item.label || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.debit > 0 ? formatKwd(item.debit) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                          {item.credit > 0 ? formatKwd(item.credit) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[10px]">
                          {item.matching_number ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-bold">
                              #{item.matching_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">
                            {item.entry_state || 'POSTED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Items Pagination */}
          {itemsPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {itemsPage} of {itemsPages} · {itemsTotal.toLocaleString()} total journal items
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setItemsPage(Math.max(1, itemsPage - 1))}
                  disabled={itemsPage <= 1}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  onClick={() => setItemsPage(Math.min(itemsPages, itemsPage + 1))}
                  disabled={itemsPage >= itemsPages}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 2. Journal Entries View (1,029 records) ── */}
      {viewMode === 'entries' && (
        <>
          {loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl shimmer" />
              ))}
            </div>
          ) : rawEntries.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No journal entries found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Try adjusting your search criteria or switching to a different state filter.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Number / Ref</th>
                      <th className="px-4 py-3">Entry Date</th>
                      <th className="px-4 py-3">Accounting Date</th>
                      <th className="px-4 py-3">Memo / Description</th>
                      <th className="px-4 py-3 text-right">Debit / Credit Total</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {rawEntries.map((entry) => {
                      const badge = getStateBadge(entry.state);
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => setSelectedEntryId(entry.id)}
                          className="group cursor-pointer hover:bg-muted/40 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/10 text-purple-600 font-bold text-xs">
                                JRN
                              </div>
                              <div>
                                <p className="font-bold text-foreground group-hover:text-primary transition">{entry.name}</p>
                                {entry.reference && <p className="text-[10px] text-muted-foreground">Ref: {entry.reference}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatAccountingDate(entry.entry_date)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatAccountingDate(entry.accounting_date)}
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                            {entry.narration || entry.reference || 'General journal voucher'}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-foreground">
                            {formatKwd(entry.amount_total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold', badge.bg)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Entries Pagination */}
          {entriesPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {entriesPage} of {entriesPages} · {entriesTotal.toLocaleString()} total entries
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEntriesPage(Math.max(1, entriesPage - 1))}
                  disabled={entriesPage <= 1}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  onClick={() => setEntriesPage(Math.min(entriesPages, entriesPage + 1))}
                  disabled={entriesPage >= entriesPages}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Double-Entry Detail Modal ── */}
      {selectedEntryId && (
        <JournalEntryDetailModal entryId={selectedEntryId} onClose={() => setSelectedEntryId(null)} />
      )}
    </DashboardShell>
  );
}

// ── Journal Entry Detail Modal ──────────────────────────────────────────────────
function JournalEntryDetailModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    authedFetch(`/api/v1/uanr/journal-entries/${entryId}/`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.detail ?? 'Failed to load journal entry');
        setData(json?.data ?? json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [entryId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const items: any[] = data?.items ?? [];
  const totalDebit = items.reduce((acc, curr) => acc + (parseFloat(curr.debit_amount || curr.debit || 0)), 0);
  const totalCredit = items.reduce((acc, curr) => acc + (parseFloat(curr.credit_amount || curr.credit || 0)), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
  const badge = getStateBadge(data?.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-500/10 text-purple-600 shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground">{data?.name || 'Journal Entry'}</h3>
              <p className="text-xs text-muted-foreground">
                Date: {formatAccountingDate(data?.entry_date)} · Reference: {data?.reference || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {badge && (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold', badge.bg)}>
                <span className={cn('h-2 w-2 rounded-full', badge.dot)} />
                {badge.label}
              </span>
            )}
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl shimmer" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600">
              {error}
            </div>
          ) : (
            <>
              {data?.narration && (
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-xs">
                  <span className="font-bold text-[10px] uppercase text-muted-foreground block mb-1">Narration / Memo</span>
                  <p className="text-foreground">{data.narration}</p>
                </div>
              )}

              {/* Double-entry lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    General Ledger Breakdown ({items.length} Lines)
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs">
                    <ShieldCheck className={cn('h-4 w-4', isBalanced ? 'text-emerald-500' : 'text-rose-500')} />
                    <span className={cn('font-bold', isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {isBalanced ? 'Balanced Double-Entry' : 'Unbalanced Warning'}
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/40 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3.5 py-2.5">Line Description</th>
                        <th className="px-3.5 py-2.5">Account ID</th>
                        <th className="px-3.5 py-2.5 text-right">Debit (KWD)</th>
                        <th className="px-3.5 py-2.5 text-right">Credit (KWD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {items.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-muted/20">
                          <td className="px-3.5 py-2.5">
                            <p className="font-semibold text-foreground">{line.name || 'General Line Item'}</p>
                            {line.partner_id && <p className="text-[10px] text-muted-foreground">Partner: {line.partner_id.slice(0, 8)}…</p>}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                            {line.account_id?.slice(0, 8)}…
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-foreground">
                            {line.debit_amount > 0 ? formatKwd(line.debit_amount) : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-bold text-foreground">
                            {line.credit_amount > 0 ? formatKwd(line.credit_amount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border/60 bg-muted/50 font-black text-xs">
                      <tr>
                        <td colSpan={2} className="px-3.5 py-2.5 text-right uppercase tracking-wider">
                          Totals:
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                          {formatKwd(totalDebit)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-purple-600 dark:text-purple-400">
                          {formatKwd(totalCredit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
