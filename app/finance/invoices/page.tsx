'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  Building2,
  Calendar,
  Copy,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Shield,
  Tag,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  FileText,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatKwd,
  formatAccountingDate,
  getStateBadge,
  Invoice,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

export default function InvoicesPage() {
  const [typeFilter, setTypeFilter]   = useState<'all' | 'invoice' | 'bill'>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [search, setSearch]           = useState<string>('');
  const [view, setView]               = useState<'list' | 'grid'>('list');
  const [selected, setSelected]       = useState<Invoice | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const {
    items: rawInvoices,
    total,
    page,
    pages,
    loading,
    error,
    refetch,
    setPage,
  } = useAnrList<Invoice>('invoices', {
    pageSize: 30,
    params: {
      invoice_type: typeFilter !== 'all' ? typeFilter : undefined,
      state: stateFilter !== 'all' ? stateFilter : undefined,
    },
  });

  // Client-side search filtering
  const filtered = useMemo(() => {
    if (!search.trim()) return rawInvoices;
    const q = search.toLowerCase();
    return rawInvoices.filter((inv) =>
      inv.name?.toLowerCase().includes(q) ||
      inv.reference?.toLowerCase().includes(q) ||
      inv.partner_name?.toLowerCase().includes(q) ||
      inv.notes?.toLowerCase().includes(q)
    );
  }, [rawInvoices, search]);

  // Summary stats computed from current filtered items
  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((acc, curr) => acc + (curr.amount_total || 0), 0);
    const paidAmount  = filtered.reduce((acc, curr) => acc + (curr.amount_paid || 0), 0);
    const residual    = filtered.reduce((acc, curr) => acc + (curr.amount_residual || 0), 0);
    return { totalAmount, paidAmount, residual, count: filtered.length };
  }, [filtered]);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Invoices & Vendor Bills"
          subtitle="Manage customer invoices, vendor bills, tax calculations, and payments tracking"
        />
        <button
          onClick={() => setShowNewForm(true)}
          className="mt-1 flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          New Invoice / Bill
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Value',
            val: formatKwd(stats.totalAmount),
            sub: `${stats.count} items loaded`,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
            icon: Receipt,
          },
          {
            label: 'Collected / Paid',
            val: formatKwd(stats.paidAmount),
            sub: stats.totalAmount > 0 ? `${((stats.paidAmount / stats.totalAmount) * 100).toFixed(1)}% settled` : 'Settled',
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
            icon: CheckCircle2,
          },
          {
            label: 'Outstanding Residual',
            val: formatKwd(stats.residual),
            sub: 'Pending balance',
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
            icon: Clock,
          },
          {
            label: 'Total Registered',
            val: total.toLocaleString(),
            sub: 'In database',
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

      {/* ── Toolbar & Filters ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Type selector tabs */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'invoice', label: 'Customer Invoices' },
            { id: 'bill', label: 'Vendor Bills' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTypeFilter(t.id as any); setPage(1); }}
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

        {/* State filters & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status filter */}
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-xl border border-border/60 bg-card px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All States</option>
            <option value="posted">Posted</option>
            <option value="paid">Paid</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Search box */}
          <div className="relative w-56 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reference, number…"
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

          {/* List/Grid View */}
          <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
            <button
              onClick={() => setView('list')}
              className={cn('p-1.5 rounded-lg transition', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn('p-1.5 rounded-lg transition', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Refresh */}
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

      {/* ── Content View ── */}
      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-bold text-base text-foreground">No invoices found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Try adjusting your search query, state filters, or selecting a different invoice category.
          </p>
        </div>
      ) : view === 'list' ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Number / Ref</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Residual</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((inv) => {
                  const badge = getStateBadge(inv.state);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelected(inv)}
                      className="group cursor-pointer hover:bg-muted/40 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'grid h-7 w-7 place-items-center rounded-lg text-xs font-bold',
                            inv.invoice_type === 'invoice' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600',
                          )}>
                            {inv.invoice_type === 'invoice' ? 'INV' : 'BIL'}
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition">{inv.name}</p>
                            {inv.reference && <p className="text-[10px] text-muted-foreground">Ref: {inv.reference}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-muted-foreground">
                          {inv.invoice_type === 'invoice' ? 'Customer Invoice' : 'Vendor Bill'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatAccountingDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatAccountingDate(inv.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {formatKwd(inv.amount_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {formatKwd(inv.amount_paid)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600 dark:text-rose-400">
                        {formatKwd(inv.amount_residual)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', badge.bg)}>
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
      ) : (
        /* Grid View */
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inv) => {
            const badge = getStateBadge(inv.state);
            return (
              <div
                key={inv.id}
                onClick={() => setSelected(inv)}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-4.5 cursor-pointer shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'grid h-8 w-8 place-items-center rounded-xl text-xs font-bold',
                        inv.invoice_type === 'invoice' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600',
                      )}>
                        {inv.invoice_type === 'invoice' ? 'INV' : 'BIL'}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-foreground group-hover:text-primary transition">{inv.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatAccountingDate(inv.invoice_date)}</p>
                      </div>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', badge.bg)}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-3.5 space-y-1 border-t border-border/40 pt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-black text-foreground">{formatKwd(inv.amount_total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatKwd(inv.amount_paid)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Due:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{formatKwd(inv.amount_residual)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                  <span>Due: {formatAccountingDate(inv.due_date)}</span>
                  <span className="flex items-center gap-0.5 text-primary font-bold group-hover:underline">
                    View Lines <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total.toLocaleString()} total invoices
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

      {/* ── Invoice Detail Modal ── */}
      {selected && <InvoiceModal invoice={selected} onClose={() => setSelected(null)} onRefresh={refetch} />}

      {/* ── New Invoice Form Modal ── */}
      {showNewForm && (
        <InvoiceFormModal
          onClose={() => setShowNewForm(false)}
          onCreated={() => { setShowNewForm(false); refetch(); }}
        />
      )}
    </DashboardShell>
  );
}

// ── Invoice Detail Modal ────────────────────────────────────────────────────────
function InvoiceModal({ invoice, onClose, onRefresh }: { invoice: Invoice; onClose: () => void; onRefresh?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handlePost = async () => {
    setPosting(true); setActionError(null);
    try {
      const res = await authedFetch(`/uanr/api/v1/invoices/${invoice.id}/post/`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.detail ?? `HTTP ${res.status}`); }
      onRefresh?.(); onClose();
    } catch (e: any) { setActionError(e.message); } finally { setPosting(false); }
  };

  const handleCancel = async () => {
    setCancelling(true); setActionError(null);
    try {
      const res = await authedFetch(`/uanr/api/v1/invoices/${invoice.id}/cancel/`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.detail ?? `HTTP ${res.status}`); }
      onRefresh?.(); onClose();
    } catch (e: any) { setActionError(e.message); } finally { setCancelling(false); }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyId = () => {
    navigator.clipboard?.writeText(invoice.name || invoice.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const badge = getStateBadge(invoice.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className={cn(
              'grid h-11 w-11 place-items-center rounded-2xl text-sm font-black shadow-xs',
              invoice.invoice_type === 'invoice' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600',
            )}>
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-foreground">{invoice.name}</h3>
                <button
                  onClick={copyId}
                  className="text-muted-foreground hover:text-foreground transition"
                  title="Copy Number"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {invoice.invoice_type === 'invoice' ? 'Customer Invoice' : 'Vendor Bill'} · ID: {invoice.id.slice(0, 8)}…
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold', badge.bg)}>
              <span className={cn('h-2 w-2 rounded-full', badge.dot)} />
              {badge.label}
            </span>
            {invoice.state === 'draft' && (
              <>
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60 transition"
                >
                  {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 disabled:opacity-60 transition"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {actionError && (
          <div className="px-6 pb-2 flex items-center gap-2 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" /> {actionError}
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Financial Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Untaxed Subtotal', val: formatKwd(invoice.amount_untaxed), icon: Tag },
              { label: 'Tax Amount', val: formatKwd(invoice.amount_tax), icon: Shield },
              { label: 'Total Amount', val: formatKwd(invoice.amount_total), icon: Receipt, bold: true },
              { label: 'Amount Paid', val: formatKwd(invoice.amount_paid), icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-2xl border border-border/40 bg-muted/20 p-3.5 text-center">
                  <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className={cn('text-sm font-extrabold', s.text || 'text-foreground')}>{s.val}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Details Metadata */}
          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Invoice Date</span>
              <p className="font-semibold text-foreground mt-0.5">{formatAccountingDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Due Date</span>
              <p className="font-semibold text-foreground mt-0.5">{formatAccountingDate(invoice.due_date)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Payment Terms</span>
              <p className="font-semibold text-foreground mt-0.5 capitalize">{invoice.payment_terms || 'Immediate'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Currency</span>
              <p className="font-semibold text-foreground mt-0.5">{invoice.currency_code || 'KWD'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Reference</span>
              <p className="font-semibold text-foreground mt-0.5">{invoice.reference || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Outstanding Residual</span>
              <p className="font-semibold text-rose-600 dark:text-rose-400 mt-0.5">{formatKwd(invoice.amount_residual)}</p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Invoice Line Items ({invoice.lines?.length ?? 0})
              </h4>
            </div>

            {(!invoice.lines || invoice.lines.length === 0) ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed rounded-xl">
                No individual line items detailed for this invoice.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/40 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3.5 py-2.5">Item / Description</th>
                      <th className="px-3.5 py-2.5 text-center">Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Unit Price</th>
                      <th className="px-3.5 py-2.5 text-right">Tax</th>
                      <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {invoice.lines.map((ln) => (
                      <tr key={ln.id} className="hover:bg-muted/20">
                        <td className="px-3.5 py-2.5">
                          <p className="font-semibold text-foreground">{ln.name}</p>
                          {ln.description && <p className="text-[10px] text-muted-foreground">{ln.description}</p>}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-medium">{ln.quantity}</td>
                        <td className="px-3.5 py-2.5 text-right font-medium">{formatKwd(ln.unit_price)}</td>
                        <td className="px-3.5 py-2.5 text-right text-muted-foreground">{ln.tax_rate}%</td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-foreground">{formatKwd(ln.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {invoice.notes && (
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-xs">
              <span className="font-bold text-[10px] uppercase text-muted-foreground block mb-0.5">Notes</span>
              <p className="text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Invoice / Bill Creation Form Modal ──────────────────────────────────────────
interface LineItem {
  account_id: string;
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_rate: string;
}

const emptyLine = (): LineItem => ({
  account_id: '',
  name: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  discount: '0',
  tax_rate: '0',
});

function calcLine(l: LineItem) {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unit_price) || 0;
  const discount = parseFloat(l.discount) || 0;
  const taxRate = parseFloat(l.tax_rate) || 0;
  const subtotal = qty * price * (1 - discount / 100);
  const taxAmount = subtotal * (taxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

function InvoiceFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [invoiceType, setInvoiceType] = useState<'invoice' | 'bill'>('invoice');
  const [partnerId, setPartnerId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const [currency, setCurrency] = useState('KWD');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [pRes, jRes, aRes] = await Promise.all([
        authedFetch('/uanr/api/v1/partners/?page_size=200'),
        authedFetch('/uanr/api/v1/journals/?page_size=50'),
        authedFetch('/uanr/api/v1/accounts/?page_size=200'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPartners(d?.data?.items ?? d?.items ?? []); }
      if (jRes.ok) { const d = await jRes.json(); setJournals(d?.data?.items ?? d?.items ?? []); }
      if (aRes.ok) { const d = await aRes.json(); setAccounts(d?.data?.items ?? d?.items ?? []); }
    };
    load();
  }, []);

  useEffect(() => {
    const typeMap = invoiceType === 'invoice' ? 'sale' : 'purchase';
    const j = journals.find((j: any) => j.journal_type === typeMap);
    if (j) setJournalId(j.id);
  }, [invoiceType, journals]);

  const updateLine = (idx: number, field: keyof LineItem, val: string) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => lines.reduce(
    (acc, l) => { const { subtotal, taxAmount, total } = calcLine(l); return { subtotal: acc.subtotal + subtotal, tax: acc.tax + taxAmount, total: acc.total + total }; },
    { subtotal: 0, tax: 0, total: 0 },
  ), [lines]);

  const handleSubmit = async (andPost = false) => {
    setFormError(null);
    if (!partnerId) { setFormError('Please select a partner.'); return; }
    if (!journalId) { setFormError('Please select a journal.'); return; }
    if (lines.some((l) => !l.account_id || !l.name)) { setFormError('All lines must have an account and description.'); return; }
    setSubmitting(true);
    try {
      const cRes = await authedFetch('/uanr/api/v1/companies/');
      const cj = await cRes.json().catch(() => ({}));
      const companyId = cj?.data?.items?.[0]?.id ?? cj?.items?.[0]?.id;
      const payload = {
        company_id: companyId,
        invoice_type: invoiceType,
        partner_id: partnerId,
        journal_id: journalId,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        payment_terms: paymentTerms,
        currency_code: currency,
        reference: reference || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          account_id: l.account_id,
          name: l.name,
          description: l.description || undefined,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
          discount: parseFloat(l.discount) || 0,
          tax_rate: parseFloat(l.tax_rate) || 0,
        })),
      };
      const res = await authedFetch('/uanr/api/v1/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.detail ?? `HTTP ${res.status}`);
      const invoiceId = json?.data?.id;
      if (andPost && invoiceId) {
        const postRes = await authedFetch(`/uanr/api/v1/invoices/${invoiceId}/post/`, { method: 'POST' });
        if (!postRes.ok) { const pj = await postRes.json().catch(() => ({})); throw new Error(pj?.detail ?? 'Post failed'); }
      }
      onCreated();
    } catch (e: any) { setFormError(e.message); } finally { setSubmitting(false); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const inputCls = 'h-8 w-full rounded-lg border border-border/60 bg-background px-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">
                New {invoiceType === 'invoice' ? 'Customer Invoice' : 'Vendor Bill'}
              </h3>
              <p className="text-[11px] text-muted-foreground">Fill in the details and add line items</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type Toggle */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-1 w-fit">
            {(['invoice', 'bill'] as const).map((t) => (
              <button key={t} onClick={() => setInvoiceType(t)}
                className={cn('rounded-lg px-4 py-1.5 text-xs font-bold transition', invoiceType === t ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
              >
                {t === 'invoice' ? '🧾 Customer Invoice' : '📄 Vendor Bill'}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Partner *</label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={cn(inputCls, 'h-8')}>
                <option value="">— Select partner —</option>
                {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Journal *</label>
              <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className={cn(inputCls, 'h-8')}>
                <option value="">— Select journal —</option>
                {journals.map((j: any) => <option key={j.id} value={j.id}>{j.name} ({j.code})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={cn(inputCls, 'h-8')}>
                {['KWD','USD','EUR','GBP','AED','SAR'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={cn(inputCls, 'h-8')}>
                <option value="immediate">Immediate</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Reference / PO</label>
              <input type="text" placeholder="External reference" value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Line Items</h4>
              <button onClick={addLine} className="flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 transition">
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b border-border/60 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 min-w-[160px]">Account *</th>
                      <th className="px-3 py-2 min-w-[160px]">Description *</th>
                      <th className="px-3 py-2 w-18 text-center">Qty</th>
                      <th className="px-3 py-2 w-24 text-right">Unit Price</th>
                      <th className="px-3 py-2 w-18 text-center">Disc %</th>
                      <th className="px-3 py-2 w-18 text-center">Tax %</th>
                      <th className="px-3 py-2 w-28 text-right">Line Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lines.map((line, idx) => {
                      const { total } = calcLine(line);
                      return (
                        <tr key={idx} className="group">
                          <td className="px-2 py-1.5">
                            <select value={line.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40">
                              <option value="">— Account —</option>
                              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="text" placeholder="Description" value={line.name} onChange={(e) => updateLine(idx, 'name', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="any" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="any" value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] text-right focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" max="100" step="any" value={line.discount} onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="any" value={line.tax_rate} onChange={(e) => updateLine(idx, 'tax_rate', e.target.value)}
                              className="h-7 w-full rounded-lg border border-border/60 bg-background px-2 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold text-foreground tabular-nums">
                            {total.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {lines.length > 1 && (
                              <button onClick={() => removeLine(idx)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border/60 bg-muted/20 text-xs font-bold">
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">Subtotal:</td>
                      <td className="px-3 py-2 text-right tabular-nums">{totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 3 })} {currency}</td>
                      <td />
                    </tr>
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">Tax:</td>
                      <td className="px-3 py-2 text-right text-amber-600 tabular-nums">{totals.tax.toLocaleString('en-US', { minimumFractionDigits: 3 })} {currency}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border/60">
                      <td colSpan={6} className="px-3 py-2 text-right font-black text-foreground">Total:</td>
                      <td className="px-3 py-2 text-right font-black text-primary tabular-nums">{totals.total.toLocaleString('en-US', { minimumFractionDigits: 3 })} {currency}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
            <button onClick={onClose} className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition">Discard</button>
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-xs font-bold hover:bg-muted/60 disabled:opacity-60 transition">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save as Draft
            </button>
            <button onClick={() => handleSubmit(true)} disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60 transition">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Save & Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
