'use client';

import { useState, useMemo, useEffect } from 'react';
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

export default function InvoicesPage() {
  const [typeFilter, setTypeFilter]   = useState<'all' | 'invoice' | 'bill'>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [search, setSearch]           = useState<string>('');
  const [view, setView]               = useState<'list' | 'grid'>('list');
  const [selected, setSelected]       = useState<Invoice | null>(null);

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
      <PageHeader
        title="Invoices & Vendor Bills"
        subtitle="Manage customer invoices, vendor bills, tax calculations, and payments tracking"
      />

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
      {selected && <InvoiceModal invoice={selected} onClose={() => setSelected(null)} />}
    </DashboardShell>
  );
}

// ── Invoice Detail Modal ────────────────────────────────────────────────────────
function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

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

          <div className="flex items-center gap-2.5">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold', badge.bg)}>
              <span className={cn('h-2 w-2 rounded-full', badge.dot)} />
              {badge.label}
            </span>
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
