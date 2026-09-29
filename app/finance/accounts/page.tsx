'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Shield,
  Tag,
  Scale,
  Landmark,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatKwd,
  Account,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

export default function ChartOfAccountsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch]         = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const {
    items: rawAccounts,
    total,
    page,
    pages,
    loading,
    error,
    refetch,
    setPage,
  } = useAnrList<Account>('accounts', {
    pageSize: 50,
    params: {
      account_type: typeFilter !== 'all' ? typeFilter : undefined,
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rawAccounts;
    const q = search.toLowerCase();
    return rawAccounts.filter((a) =>
      a.code?.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      a.account_type?.toLowerCase().includes(q)
    );
  }, [rawAccounts, search]);

  const stats = useMemo(() => {
    const assets = rawAccounts.filter((a) => a.account_type === 'asset').length;
    const liabilities = rawAccounts.filter((a) => a.account_type === 'liability').length;
    const equity = rawAccounts.filter((a) => a.account_type === 'equity').length;
    const income = rawAccounts.filter((a) => a.account_type === 'revenue').length;
    const expenses = rawAccounts.filter((a) => a.account_type === 'expense').length;
    return { assets, liabilities, equity, income, expenses };
  }, [rawAccounts]);

  const typeColor: Record<string, { bg: string; text: string }> = {
    asset:     { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
    liability: { bg: 'bg-rose-500/10 border-rose-500/20',       text: 'text-rose-600 dark:text-rose-400' },
    equity:    { bg: 'bg-purple-500/10 border-purple-500/20',   text: 'text-purple-600 dark:text-purple-400' },
    revenue:   { bg: 'bg-sky-500/10 border-sky-500/20',         text: 'text-sky-600 dark:text-sky-400' },
    expense:   { bg: 'bg-amber-500/10 border-amber-500/20',     text: 'text-amber-600 dark:text-amber-400' },
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage accounting ledgers, assets, liabilities, equity, revenues, and operating expenses"
      />

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Asset Accounts', count: stats.assets, color: 'text-emerald-600 dark:text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5', range: '1000s' },
          { label: 'Liabilities', count: stats.liabilities, color: 'text-rose-600 dark:text-rose-400', bg: 'from-rose-500/20 to-rose-500/5', range: '2000s' },
          { label: 'Equity', count: stats.equity, color: 'text-purple-600 dark:text-purple-400', bg: 'from-purple-500/20 to-purple-500/5', range: '3000s' },
          { label: 'Revenue / Sales', count: stats.income, color: 'text-sky-600 dark:text-sky-400', bg: 'from-sky-500/20 to-sky-500/5', range: '4000s' },
          { label: 'Expenses', count: stats.expenses, color: 'text-amber-600 dark:text-amber-400', bg: 'from-amber-500/20 to-amber-500/5', range: '5000s+' },
        ].map((c) => (
          <div
            key={c.label}
            className={cn(
              'group rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5',
              c.bg,
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{c.range}</span>
            </div>
            <p className={cn('mt-2 text-2xl font-black tracking-tight', c.color)}>{c.count}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active ledger codes</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar & Filters ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center rounded-xl border border-border/60 bg-card p-1">
          {[
            { id: 'all', label: 'All Accounts' },
            { id: 'asset', label: 'Assets' },
            { id: 'liability', label: 'Liabilities' },
            { id: 'equity', label: 'Equity' },
            { id: 'revenue', label: 'Revenue' },
            { id: 'expense', label: 'Expenses' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTypeFilter(t.id); setPage(1); }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                typeFilter === t.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search code or account name…"
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
            onClick={() => refetch()}
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

      {/* ── Accounts Table ── */}
      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-bold text-base text-foreground">No accounts match criteria</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Try searching for a different code or switching account categories.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Normal Nature</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-center">Attributes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((acc) => {
                  const style = typeColor[acc.account_type] || { bg: 'bg-muted', text: 'text-muted-foreground' };
                  return (
                    <tr
                      key={acc.id}
                      onClick={() => setSelectedAccount(acc)}
                      className="group cursor-pointer hover:bg-muted/40 transition"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-primary">
                        {acc.code}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground group-hover:text-primary transition">{acc.name}</p>
                        {acc.description && <p className="text-[10px] text-muted-foreground">{acc.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize', style.bg, style.text)}>
                          {acc.account_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 uppercase font-semibold text-muted-foreground">
                        {acc.account_nature}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {acc.currency_code || 'KWD'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {acc.is_bank_account && (
                            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400" title="Bank Account">
                              BANK
                            </span>
                          )}
                          {acc.is_reconcilable && (
                            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400" title="Reconcilable">
                              REC
                            </span>
                          )}
                          {acc.deprecated && (
                            <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-600" title="Deprecated">
                              DEPRECATED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] font-bold text-primary group-hover:underline inline-flex items-center gap-0.5">
                          Inspect Balance <ArrowUpRight className="h-3 w-3" />
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

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total.toLocaleString()} total accounts
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page >= pages}
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Account Balance & Details Modal ── */}
      {selectedAccount && <AccountBalanceModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />}
    </DashboardShell>
  );
}

// ── Account Detail & Live Balance Modal ──────────────────────────────────────────
function AccountBalanceModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const [balanceData, setBalanceData] = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    authedFetch(`/api/v1/uanr/accounts/${account.id}/balance`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.detail ?? 'Failed to calculate account balance');
        setBalanceData(json?.data ?? json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [account.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary shadow-xs font-mono font-bold">
              {account.code.slice(0, 4)}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">{account.name}</h3>
              <p className="text-xs font-mono text-muted-foreground">Account #{account.code} · {account.account_type.toUpperCase()}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Live Balance Summary */}
          {loading ? (
            <div className="space-y-3">
              <div className="h-24 rounded-2xl shimmer" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600">
              {error}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Net Balance
              </span>
              <p className="text-3xl font-black text-foreground mt-1">
                {formatKwd(balanceData?.balance)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Cumulative Debits</span>
                  <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatKwd(balanceData?.debit_total)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Cumulative Credits</span>
                  <p className="font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
                    {formatKwd(balanceData?.credit_total)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Attributes */}
          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Nature</span>
              <p className="font-semibold text-foreground mt-0.5 uppercase">{account.account_nature}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Currency</span>
              <p className="font-semibold text-foreground mt-0.5">{account.currency_code || 'KWD'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Bank Account</span>
              <p className="font-semibold text-foreground mt-0.5">{account.is_bank_account ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Reconcilable</span>
              <p className="font-semibold text-foreground mt-0.5">{account.is_reconcilable ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
