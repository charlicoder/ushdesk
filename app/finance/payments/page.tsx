'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle, X,
  ChevronDown, CreditCard, CheckCircle2, XCircle, Clock,
  DollarSign, User, Phone, Mail, Calendar, Building2,
  Hash, Tag, Banknote, Shield, ArrowUpRight, Filter,
  Receipt, Wallet, TrendingUp, ChevronLeft, ChevronRight,
  Copy, ExternalLink,
} from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Payment {
  id: string;
  booking_id: string;
  customer_id: string;
  amount: string;
  currency: string;
  provider: string;
  payment_method: string;
  status: string;
  is_paid: boolean;
  payment_id: string;
  transaction_id: string;
  invoice_id: string;
  invoice_value: string;
  invoice_reference: string;
  customer_reference: string;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  created_date: string;
  transaction_date: string;
  payment_gateway: string;
  gateway_name: string | null;
  reference_id: string | null;
  track_id: string | null;
  service_charge: string;
  vat_amount: string;
  due_deposit: string | null;
  deposit_status: string;
  customer_data: Record<string, unknown>;
  booking_data: Record<string, unknown>;
  paid_at: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCurrency(amount: string, currency: string = 'KWD') {
  const num = parseFloat(amount ?? '0');
  if (isNaN(num)) return '—';
  return `${num.toFixed(3)} ${currency}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…` : '—';
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  success:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400',
  refunded:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const DEPOSIT_STATUS_STYLES: Record<string, string> = {
  'deposited':     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'not deposited': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function StatusBadge({ status }: { status: string }) {
  const lower = status?.toLowerCase() ?? '';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
      STATUS_STYLES[lower] ?? 'bg-muted text-muted-foreground',
    )}>
      {lower === 'success' && <CheckCircle2 className="h-3 w-3" />}
      {lower === 'failed' && <XCircle className="h-3 w-3" />}
      {lower === 'pending' && <Clock className="h-3 w-3" />}
      {status || '—'}
    </span>
  );
}

function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
      isPaid
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    )}>
      {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {isPaid ? 'Paid' : 'Unpaid'}
    </span>
  );
}

// ── Gateway avatar color ───────────────────────────────────────────────────────
function gatewayColor(gateway: string) {
  const colors: Record<string, string> = {
    knet:        'from-blue-500 to-blue-700',
    myfatoorah:  'from-purple-500 to-purple-700',
    visa:        'from-indigo-500 to-indigo-700',
    mastercard:  'from-red-500 to-orange-500',
    cash:        'from-emerald-500 to-emerald-700',
    default:     'from-slate-500 to-slate-700',
  };
  return colors[gateway?.toLowerCase()] ?? colors.default;
}

// ── Copy helper ────────────────────────────────────────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 text-muted-foreground hover:text-foreground transition"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Detail Row ─────────────────────────────────────────────────────────────────
function DetailRow({ label, value, mono = false, copyable = false }: {
  label: string; value: React.ReactNode; mono?: boolean; copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0 w-36">{label}</span>
      <span className={cn('text-xs text-right flex items-center gap-1 flex-wrap justify-end', mono && 'font-mono')}>
        {value}
        {copyable && typeof value === 'string' && <CopyButton value={value} />}
      </span>
    </div>
  );
}

// ── Payment Detail Modal ───────────────────────────────────────────────────────
function PaymentModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/40 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg', gatewayColor(payment.payment_method))}>
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-base">{payment.customer_name}</p>
              <p className="text-xs text-muted-foreground">{payment.customer_mobile}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-lg font-extrabold tracking-tight">{formatCurrency(payment.amount, payment.currency)}</p>
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <StatusBadge status={payment.status} />
                <PaidBadge isPaid={payment.is_paid} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-2 grid h-9 w-9 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Amount Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Invoice Value',   value: formatCurrency(payment.invoice_value, payment.currency),   icon: Receipt },
              { label: 'Service Charge',  value: formatCurrency(payment.service_charge, payment.currency),  icon: Tag },
              { label: 'VAT Amount',      value: formatCurrency(payment.vat_amount, payment.currency),      icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border/40 bg-muted/30 p-4 text-center">
                <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-sm font-bold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Customer Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer</p>
            <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-1">
              <DetailRow label="Name"       value={payment.customer_name} />
              <DetailRow label="Mobile"     value={payment.customer_mobile} copyable />
              <DetailRow label="Email"      value={payment.customer_email} copyable />
              <DetailRow label="Customer ID" value={shortId(payment.customer_id)} mono copyable={false} />
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment Details</p>
            <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-1">
              <DetailRow label="Payment ID"    value={payment.payment_id}    mono copyable />
              <DetailRow label="Transaction ID" value={payment.transaction_id} mono copyable />
              <DetailRow label="Invoice ID"    value={payment.invoice_id}    mono copyable />
              <DetailRow label="Invoice Ref"   value={payment.invoice_reference} mono copyable />
              <DetailRow label="Customer Ref"  value={payment.customer_reference} mono copyable />
              <DetailRow label="Provider"      value={<span className="capitalize">{payment.provider}</span>} />
              <DetailRow label="Method"        value={<span className="capitalize">{payment.payment_method}</span>} />
              <DetailRow label="Gateway"       value={payment.payment_gateway} />
              {payment.reference_id && <DetailRow label="Reference ID" value={payment.reference_id} mono copyable />}
              {payment.track_id     && <DetailRow label="Track ID"     value={payment.track_id}     mono copyable />}
            </div>
          </div>

          {/* Booking & Deposit */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Booking & Deposit</p>
            <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-1">
              <DetailRow label="Booking ID" value={shortId(payment.booking_id)} mono />
              <DetailRow label="Due Deposit" value={payment.due_deposit ?? '—'} />
              <DetailRow
                label="Deposit Status"
                value={
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                    DEPOSIT_STATUS_STYLES[payment.deposit_status?.toLowerCase()] ?? 'bg-muted text-muted-foreground',
                  )}>
                    {payment.deposit_status || '—'}
                  </span>
                }
              />
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
            <div className="rounded-2xl border border-border/40 bg-muted/20 px-4 py-1">
              <DetailRow label="Created At"       value={formatDateTime(payment.created_at)} />
              <DetailRow label="Created Date"     value={formatDateTime(payment.created_date)} />
              <DetailRow label="Transaction Date" value={formatDateTime(payment.transaction_date)} />
              <DetailRow label="Paid At"          value={formatDateTime(payment.paid_at)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────
interface Filters {
  search: string;
  status: string;
  isPaid: string;
  provider: string;
  method: string;
  depositStatus: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '', status: '', isPaid: '', provider: '', method: '', depositStatus: '', dateFrom: '', dateTo: '',
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [view,     setView]     = useState<'list' | 'grid'>('list');
  const [filters,  setFilters]  = useState<Filters>(DEFAULT_FILTERS);
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const PAGE_SIZE = 20;

  const proxyUrl = `/api/v1/payments?page=${page}&page_size=${PAGE_SIZE}`;
  const { data: raw, loading, error, refetch, pagination } = useBookings<Record<string, unknown>>(proxyUrl);

  const payments: Payment[] = useMemo(() =>
    raw.map((r) => r as unknown as Payment),
    [raw],
  );

  // ── Derived filter options ─────────────────────────────────────────────────
  const statuses  = useMemo(() => Array.from(new Set(payments.map((p) => p.status).filter(Boolean))), [payments]);
  const providers = useMemo(() => Array.from(new Set(payments.map((p) => p.provider).filter(Boolean))), [payments]);
  const methods   = useMemo(() => Array.from(new Set(payments.map((p) => p.payment_method).filter(Boolean))), [payments]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = filters.search.toLowerCase();
      if (q && ![
        p.customer_name, p.customer_mobile, p.customer_email,
        p.payment_id, p.transaction_id, p.invoice_id,
        p.customer_reference, p.invoice_reference,
      ].some((v) => v?.toLowerCase().includes(q))) return false;

      if (filters.status && p.status?.toLowerCase() !== filters.status) return false;
      if (filters.isPaid === 'paid'   && !p.is_paid)  return false;
      if (filters.isPaid === 'unpaid' &&  p.is_paid)  return false;
      if (filters.provider && p.provider?.toLowerCase() !== filters.provider) return false;
      if (filters.method   && p.payment_method?.toLowerCase() !== filters.method) return false;
      if (filters.depositStatus && p.deposit_status?.toLowerCase() !== filters.depositStatus.toLowerCase()) return false;
      if (filters.dateFrom) {
        const d = new Date(p.created_at);
        if (d < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const d = new Date(p.created_at);
        const end = new Date(filters.dateTo); end.setHours(23, 59, 59);
        if (d > end) return false;
      }
      return true;
    });
  }, [payments, filters]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = filtered.reduce((s, p) => s + parseFloat(p.amount ?? '0'), 0);
    const success = filtered.filter((p) => p.status?.toLowerCase() === 'success').length;
    const paid    = filtered.filter((p) => p.is_paid).length;
    const pending = filtered.filter((p) => p.status?.toLowerCase() === 'pending').length;
    return { total, success, paid, pending, count: filtered.length };
  }, [filtered]);

  const setFilter = useCallback((key: keyof Filters, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }, []);

  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); };
  const activeCount = Object.values(filters).filter(Boolean).length;

  // ── Currency from first record ─────────────────────────────────────────────
  const currency = payments[0]?.currency ?? 'KWD';

  return (
    <DashboardShell>
      <PageHeader
        title="Payments"
        subtitle="Track and manage all payment transactions across the platform"
      />

      {/* ── Summary Stats ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Wallet,      label: 'Total Revenue',     value: `${stats.total.toFixed(3)} ${currency}`, color: 'from-emerald-500/30 to-emerald-500/5', textColor: 'text-emerald-600 dark:text-emerald-400' },
          { icon: CheckCircle2,label: 'Successful',         value: stats.success.toLocaleString(),            color: 'from-sky-500/30 to-sky-500/5',     textColor: 'text-sky-600 dark:text-sky-400' },
          { icon: CreditCard,  label: 'Paid Transactions',  value: stats.paid.toLocaleString(),               color: 'from-violet-500/30 to-violet-500/5', textColor: 'text-violet-600 dark:text-violet-400' },
          { icon: Clock,       label: 'Pending',            value: stats.pending.toLocaleString(),             color: 'from-amber-500/30 to-amber-500/5', textColor: 'text-amber-600 dark:text-amber-400' },
        ].map(({ icon: Icon, label, value, color, textColor }) => (
          <div key={label} className={cn('flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br p-4', color)}>
            <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-black/20', textColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight truncate">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, mobile, payment ID, reference…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-card pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition',
            showFilters || activeCount > 0
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/60 bg-card hover:bg-muted/60',
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {activeCount}
            </span>
          )}
        </button>

        {/* View toggle */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {(['list', 'grid'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition',
                view === v ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v === 'list' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition"
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>

        {/* Clear */}
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card px-4 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="mt-3 rounded-2xl border border-border/50 bg-card/80 backdrop-blur p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All</option>
              {statuses.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </div>

          {/* Paid */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Paid</label>
            <select
              value={filters.isPaid}
              onChange={(e) => setFilter('isPaid', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          {/* Provider */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Provider</label>
            <select
              value={filters.provider}
              onChange={(e) => setFilter('provider', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All</option>
              {providers.map((p) => <option key={p} value={p.toLowerCase()}>{p}</option>)}
            </select>
          </div>

          {/* Method */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Method</label>
            <select
              value={filters.method}
              onChange={(e) => setFilter('method', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All</option>
              {methods.map((m) => <option key={m} value={m.toLowerCase()}>{m}</option>)}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error} — showing available data
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-base font-semibold">No payments found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : view === 'list' ? (
        <ListView payments={filtered} onSelect={setSelected} />
      ) : (
        <GridView payments={filtered} onSelect={setSelected} />
      )}

      {/* ── Pagination ── */}
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.current_page} of {pagination.total_pages} · {pagination.count.toLocaleString()} records
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.previous}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card disabled:opacity-40 hover:bg-muted/60 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.next}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card disabled:opacity-40 hover:bg-muted/60 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {selected && <PaymentModal payment={selected} onClose={() => setSelected(null)} />}
    </DashboardShell>
  );
}

// ── List View ──────────────────────────────────────────────────────────────────
function ListView({ payments, onSelect }: { payments: Payment[]; onSelect: (p: Payment) => void }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Table head */}
      <div className="grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border/40 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Customer</span>
        <span>Amount</span>
        <span>Method / Provider</span>
        <span>Status</span>
        <span>Paid</span>
        <span>Date</span>
        <span>Deposit</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {payments.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="grid w-full grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr_1fr_0.8fr] gap-3 px-5 py-3.5 text-left text-sm transition hover:bg-muted/40 items-center"
          >
            {/* Customer */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white text-xs font-bold', gatewayColor(p.payment_method))}>
                {initials(p.customer_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm">{p.customer_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{p.customer_mobile}</p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <p className="font-bold">{formatCurrency(p.amount, p.currency)}</p>
              <p className="text-[11px] text-muted-foreground">{p.currency}</p>
            </div>

            {/* Method */}
            <div>
              <p className="font-medium capitalize">{p.payment_gateway || p.payment_method}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{p.provider}</p>
            </div>

            {/* Status */}
            <StatusBadge status={p.status} />

            {/* Paid */}
            <PaidBadge isPaid={p.is_paid} />

            {/* Date */}
            <p className="text-[11px] text-muted-foreground">{formatDate(p.created_at)}</p>

            {/* Deposit */}
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
              DEPOSIT_STATUS_STYLES[p.deposit_status?.toLowerCase()] ?? 'bg-muted text-muted-foreground',
            )}>
              {p.deposit_status?.split(' ')[0] || '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Grid View ──────────────────────────────────────────────────────────────────
function GridView({ payments, onSelect }: { payments: Payment[]; onSelect: (p: Payment) => void }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {payments.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="group rounded-2xl border border-border/50 bg-card p-5 text-left transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
        >
          {/* Top row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white text-sm font-bold shadow-sm', gatewayColor(p.payment_method))}>
                {initials(p.customer_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-sm">{p.customer_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{p.customer_mobile}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-extrabold text-base">{formatCurrency(p.amount, p.currency)}</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <StatusBadge status={p.status} />
            <PaidBadge isPaid={p.is_paid} />
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
              DEPOSIT_STATUS_STYLES[p.deposit_status?.toLowerCase()] ?? 'bg-muted text-muted-foreground',
            )}>
              {p.deposit_status || '—'}
            </span>
          </div>

          {/* Meta rows */}
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize font-medium">{p.payment_gateway || p.payment_method}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="capitalize">{p.provider}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{p.payment_id || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(p.created_at)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
            <div className="flex flex-col">
              {parseFloat(p.service_charge) > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Charge: {formatCurrency(p.service_charge, p.currency)}
                </span>
              )}
              {parseFloat(p.vat_amount) > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  VAT: {formatCurrency(p.vat_amount, p.currency)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-primary font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              View Details <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

