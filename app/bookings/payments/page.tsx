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
interface CustomerData {
  first_name?: string;
  last_name?: string;
  name?: string;
  customer_name?: string;
  phone_number?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  [key: string]: unknown;
}

interface RawPayment {
  id?: unknown;
  payment_number?: unknown;
  payment_no?: unknown;
  booking_id?: unknown;
  customer_id?: unknown;
  amount?: unknown;
  total_amount?: unknown;
  currency?: unknown;
  provider?: unknown;
  payment_provider?: unknown;
  payment_through?: unknown;
  payment_method?: unknown;
  payment_gateway?: unknown;
  gateway_name?: unknown;
  payment_url?: unknown;
  payment_link?: unknown;
  payments_meta?: Record<string, unknown>;
  payment_data?: Record<string, unknown>;
  status?: unknown;
  transaction_status?: unknown;
  is_paid?: unknown;
  payment_id?: unknown;
  transaction_id?: unknown;
  booking_number?: unknown;
  booking_no?: unknown;
  invoice_number?: unknown;
  invoice_no?: unknown;
  invoice_id?: unknown;
  invoice_value?: unknown;
  invoice_reference?: unknown;
  customer_reference?: unknown;
  customer_name?: unknown;
  customer_mobile?: unknown;
  customer_email?: unknown;
  created_date?: unknown;
  transaction_date?: unknown;
  reference_id?: unknown;
  track_id?: unknown;
  service_charge?: unknown;
  vat_amount?: unknown;
  due_deposit?: unknown;
  deposit_status?: unknown;
  customer_data?: CustomerData | Record<string, unknown>;
  booking_data?: Record<string, unknown>;
  paid_at?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
}

interface Payment {
  id: string;
  payment_number: string | null;
  payment_url: string | null;
  booking_number: string | null;
  booking_id: string;
  customer_id: string;
  amount: string;
  total_amount: string;
  currency: string;
  provider: string;
  payment_provider: string;
  payment_through: string;
  payment_method: string;
  payment_gateway: string;
  gateway_name: string | null;
  status: string;
  is_paid: boolean;
  payment_id: string;
  transaction_id: string;
  invoice_number: string | null;
  invoice_id: string;
  invoice_value: string;
  invoice_reference: string;
  customer_reference: string;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  created_date: string;
  transaction_date: string;
  reference_id: string | null;
  track_id: string | null;
  service_charge: string;
  vat_amount: string;
  due_deposit: string | null;
  deposit_status: string;
  customer_data: CustomerData;
  booking_data: Record<string, unknown>;
  paid_at: string | null;
  created_at: string;
}

// ── Normalise raw API response → Payment ──────────────────────────────────────
function normalise(raw: RawPayment): Payment {
  const cd = (raw.customer_data ?? {}) as CustomerData;

  // Resolve customer name: prefer customer_data fields, fall back to flat fields
  const cdFL =
    [cd.first_name, cd.last_name].filter(Boolean).join(' ') ||
    String(cd.name ?? cd.customer_name ?? '');
  const customerName =
    cdFL ||
    String(raw.customer_name ?? '') ||
    'Customer';

  // Resolve mobile: customer_data.phone_number / phone / mobile → flat field
  const customerMobile =
    String(cd.phone_number ?? cd.phone ?? cd.mobile ?? raw.customer_mobile ?? '');

  // Resolve email: customer_data.email → flat field
  const customerEmail =
    String(cd.email ?? raw.customer_email ?? '');

  // Amount: prefer total_amount, then amount, then invoice_value
  const totalAmount = String(
    raw.total_amount ?? raw.amount ?? raw.invoice_value ?? '0'
  );

  // Method / Provider / Gateway / Channel
  const provider = String(raw.payment_provider ?? raw.provider ?? '').trim();
  const method = String(raw.payment_method ?? raw.payment_gateway ?? '').trim();
  const gateway = String(raw.payment_gateway ?? '').trim();
  const through = String(raw.payment_through ?? '').trim();

  // Status & Transaction Status
  const status = String(raw.status ?? raw.transaction_status ?? '').trim();
  const rawStatusLower = status.toLowerCase();
  const rawTxStatus = String(raw.transaction_status ?? '').toLowerCase();

  // Paid determination:
  // Paid if explicit boolean is_paid, or status/transaction_status is success/paid, or paid_at exists
  const rawPaymentData = (typeof raw.payment_data === 'object' && raw.payment_data !== null)
    ? (raw.payment_data as Record<string, unknown>)
    : {};
  const isPaid =
    raw.is_paid === true ||
    rawStatusLower === 'success' ||
    rawStatusLower === 'paid' ||
    rawTxStatus === 'success' ||
    rawTxStatus === 'paid' ||
    Boolean(raw.paid_at && String(raw.paid_at).trim() !== '') ||
    rawPaymentData.is_paid === true ||
    String(rawPaymentData.status ?? '').toLowerCase() === 'paid';

  const createdAt = String(raw.created_at ?? raw.created_date ?? raw.transaction_date ?? raw.paid_at ?? '');
  const paidAt = raw.paid_at ? String(raw.paid_at) : (isPaid ? createdAt : null);

  const paymentNumber = String(
    raw.payment_number ??
    raw.payment_no ??
    (rawPaymentData.payment_number as string) ??
    (rawPaymentData.payment_no as string) ??
    ''
  ).trim();

  const rawBookingData = (typeof raw.booking_data === 'object' && raw.booking_data !== null)
    ? (raw.booking_data as Record<string, unknown>)
    : {};
  const invoiceNumber = String(
    raw.invoice_number ??
    raw.invoice_no ??
    raw.invoiceNumber ??
    (rawPaymentData.invoice_number as string) ??
    (rawPaymentData.invoice_no as string) ??
    (rawPaymentData.invoiceNumber as string) ??
    (rawBookingData.invoice_number as string) ??
    (rawBookingData.invoice_no as string) ??
    (rawBookingData.invoiceNumber as string) ??
    ''
  ).trim();

  const bookingNumber = String(
    raw.booking_number ??
    raw.booking_no ??
    (rawBookingData.booking_number as string) ??
    (rawBookingData.booking_no as string) ??
    (rawPaymentData.booking_number as string) ??
    (rawPaymentData.booking_no as string) ??
    ''
  ).trim();

  const rawPaymentsMeta = (typeof raw.payments_meta === 'object' && raw.payments_meta !== null)
    ? (raw.payments_meta as Record<string, unknown>)
    : {};
  const rawBookingPaymentData = (typeof rawBookingData.payment_data === 'object' && rawBookingData.payment_data !== null)
    ? (rawBookingData.payment_data as Record<string, unknown>)
    : {};

  const paymentUrl = String(
    raw.payment_url ??
    rawPaymentData.payment_url ??
    rawPaymentsMeta.payment_url ??
    rawBookingPaymentData.payment_url ??
    rawBookingData.payment_url ??
    raw.payment_link ??
    rawPaymentData.payment_link ??
    raw.url ??
    ''
  ).trim();

  return {
    id:                 String(raw.id                 ?? ''),
    payment_number:     paymentNumber || null,
    payment_url:        paymentUrl || null,
    booking_number:     bookingNumber || null,
    booking_id:         String(raw.booking_id         ?? ''),
    customer_id:        String(raw.customer_id        ?? ''),
    amount:             totalAmount,
    total_amount:       totalAmount,
    currency:           String(raw.currency           ?? 'KWD'),
    provider:           provider || method || gateway,
    payment_provider:   provider,
    payment_through:    through,
    payment_method:     method || provider || gateway,
    status:             status || (isPaid ? 'success' : 'pending'),
    is_paid:            isPaid,
    payment_id:         String(raw.payment_id         ?? ''),
    transaction_id:     String(raw.transaction_id     ?? ''),
    invoice_number:     invoiceNumber || null,
    invoice_id:         String(raw.invoice_id         ?? ''),
    invoice_value:      String(raw.invoice_value      ?? totalAmount),
    invoice_reference:  String(raw.invoice_reference  ?? ''),
    customer_reference: String(raw.customer_reference ?? ''),
    customer_name:      customerName,
    customer_mobile:    customerMobile,
    customer_email:     customerEmail,
    created_date:       String(raw.created_date       ?? createdAt),
    transaction_date:   String(raw.transaction_date   ?? ''),
    payment_gateway:    gateway,
    gateway_name:       (raw.gateway_name             ?? null) as string | null,
    reference_id:       (raw.reference_id             ?? null) as string | null,
    track_id:           (raw.track_id                 ?? null) as string | null,
    service_charge:     String(raw.service_charge     ?? '0'),
    vat_amount:         String(raw.vat_amount         ?? '0'),
    due_deposit:        (raw.due_deposit              ?? null) as string | null,
    deposit_status:     String(raw.deposit_status     ?? ''),
    customer_data:      cd,
    booking_data:       (raw.booking_data             ?? {}) as Record<string, unknown>,
    paid_at:            paidAt,
    created_at:         createdAt,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatCurrency(amount: string, currency: string = 'KWD') {
  const num = parseFloat(amount ?? '0');
  if (isNaN(num)) return '—';
  return `${num.toFixed(3)} ${currency}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const s = String(iso).trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortId(id: string) {
  return id ? `${id.slice(0, 8)}…` : '—';
}

function initials(name?: string | null) {
  if (!name) return '?';
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
function DetailRow({ label, value, mono = false, copyable = false, copyText }: {
  label: string; value: React.ReactNode; mono?: boolean; copyable?: boolean; copyText?: string;
}) {
  const textToCopy = copyText || (typeof value === 'string' ? value : undefined);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0 w-36 sm:w-44">{label}</span>
      <span className={cn('text-xs text-right flex items-center gap-1 flex-wrap justify-end', mono && 'font-mono')}>
        {value}
        {copyable && textToCopy && <CopyButton value={textToCopy} />}
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
      <div className="relative z-10 w-full max-w-3xl sm:max-w-4xl lg:max-w-[880px] max-h-[92vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden transition-all duration-200">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 bg-card/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg', gatewayColor(payment.payment_method))}>
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-base">{payment.customer_name}</p>
                {payment.payment_number && (
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {payment.payment_number}
                  </span>
                )}
                {payment.booking_number && (
                  <a
                    href={`/bookings?search=${encodeURIComponent(payment.booking_number)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md border border-primary/20 inline-flex items-center gap-1 transition"
                    title="View Booking"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{payment.booking_number}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {payment.invoice_number && (
                  <a
                    href={`/finance/invoices?search=${encodeURIComponent(payment.invoice_number)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs font-bold text-foreground bg-muted hover:bg-muted/80 px-2 py-0.5 rounded-md border border-border/50 inline-flex items-center gap-1 transition"
                    title="View Invoice in Accounting"
                  >
                    <Receipt className="h-3 w-3 text-primary" />
                    <span>{payment.invoice_number}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                  </a>
                )}
              </div>
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
              <DetailRow label="Payment Number" value={payment.payment_number || '—'} mono copyable={!!payment.payment_number} />
              <DetailRow
                label="Booking Number"
                value={
                  payment.booking_number ? (
                    <a
                      href={`/bookings?search=${encodeURIComponent(payment.booking_number)}`}
                      className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1.5"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {payment.booking_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : payment.booking_id ? (
                    shortId(payment.booking_id)
                  ) : (
                    '—'
                  )
                }
                mono
                copyable={!!payment.booking_number || !!payment.booking_id}
                copyText={payment.booking_number || payment.booking_id || undefined}
              />
              <DetailRow
                label="Invoice Number"
                value={
                  payment.invoice_number ? (
                    <a
                      href={`/finance/invoices?search=${encodeURIComponent(payment.invoice_number)}`}
                      className="font-mono font-bold text-primary hover:underline inline-flex items-center gap-1.5"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {payment.invoice_number}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    '—'
                  )
                }
                mono
                copyable={!!payment.invoice_number}
                copyText={payment.invoice_number || undefined}
              />
              <DetailRow
                label="Payment Through"
                value={
                  payment.payment_through ? (
                    <span className={cn(
                      'text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase',
                      payment.payment_through.toLowerCase() === 'ushdesk'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    )}>
                      {payment.payment_through}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="Payment URL"
                value={
                  payment.payment_url ? (
                    <a
                      href={payment.payment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1 break-all max-w-[260px] sm:max-w-[340px] truncate"
                      title={payment.payment_url}
                    >
                      <span className="truncate">{payment.payment_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    '—'
                  )
                }
                mono
                copyable={!!payment.payment_url}
                copyText={payment.payment_url || undefined}
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

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border/40 px-6 py-3.5 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-card hover:bg-muted text-foreground px-5 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Close
          </button>
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
    raw.map((r) => normalise(r as RawPayment)),
    [raw],
  );

  // ── Derived filter options ─────────────────────────────────────────────────
  const statuses  = useMemo(() => Array.from(new Set(payments.map((p) => p.status).filter(Boolean))), [payments]);
  const providers = useMemo(() => Array.from(new Set(payments.map((p) => p.payment_provider || p.provider).filter(Boolean))), [payments]);
  const methods   = useMemo(() => Array.from(new Set(payments.map((p) => p.payment_method).filter(Boolean))), [payments]);

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = filters.search.toLowerCase();
      if (q && ![
        p.payment_number, p.booking_number, p.invoice_number,
        p.customer_name, p.customer_mobile, p.customer_email,
        p.payment_id, p.transaction_id, p.invoice_id,
        p.customer_reference, p.invoice_reference,
        p.payment_provider, p.provider, p.payment_method, p.payment_through,
      ].some((v) => v?.toLowerCase().includes(q))) return false;

      if (filters.status && p.status?.toLowerCase() !== filters.status) return false;
      if (filters.isPaid === 'paid'   && !p.is_paid)  return false;
      if (filters.isPaid === 'unpaid' &&  p.is_paid)  return false;
      if (filters.provider && !(p.payment_provider?.toLowerCase() === filters.provider || p.provider?.toLowerCase() === filters.provider)) return false;
      if (filters.method   && !(p.payment_method?.toLowerCase() === filters.method || p.payment_gateway?.toLowerCase() === filters.method)) return false;
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
      <div className="grid grid-cols-[1.5fr_2fr_1.2fr_1.4fr_1fr_1fr] gap-3 border-b border-border/40 bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Payment / Invoice #</span>
        <span>Customer</span>
        <span>Amount</span>
        <span>Method / Provider</span>
        <span>Status</span>
        <span>Date</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {payments.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="grid w-full grid-cols-[1.5fr_2fr_1.2fr_1.4fr_1fr_1fr] gap-3 px-5 py-3.5 text-left text-sm transition hover:bg-muted/40 items-center cursor-pointer"
          >
            {/* Payment & Invoice Number */}
            <div className="min-w-0 space-y-0.5">
              <span className="font-mono font-bold text-xs text-primary tracking-wide block truncate">
                {p.payment_number || '—'}
              </span>
              {p.invoice_number ? (
                <span className="font-mono text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <Receipt className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{p.invoice_number}</span>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/40 block">Inv: —</span>
              )}
            </div>

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
              <p className="font-extrabold text-foreground">{formatCurrency(p.amount, p.currency)}</p>
              <p className="text-[11px] text-muted-foreground">{p.currency}</p>
            </div>

            {/* Method / Provider */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-foreground text-sm capitalize">
                  {p.payment_provider || p.provider || p.payment_method || '—'}
                </p>
                {p.payment_through && (
                  <span className={cn(
                    'text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase',
                    p.payment_through.toLowerCase() === 'ushdesk'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  )}>
                    {p.payment_through}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground capitalize truncate">
                {[p.payment_method, p.payment_gateway].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v?.toLowerCase() !== (p.payment_provider || p.provider)?.toLowerCase()).join(' · ') || p.payment_method || p.provider || '—'}
              </p>
            </div>

            {/* Status */}
            <StatusBadge status={p.status} />

            {/* Date */}
            <p className="text-[11px] text-muted-foreground">{formatDate(p.created_at)}</p>
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
            {p.booking_number && (
              <span className="inline-flex items-center gap-1 font-mono rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                {p.booking_number}
              </span>
            )}
          </div>

          {/* Meta rows */}
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize font-bold text-foreground">{p.payment_provider || p.provider}</span>
              {p.payment_through && (
                <span className={cn(
                  'text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider',
                  p.payment_through.toLowerCase() === 'ushdesk'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                )}>
                  {p.payment_through}
                </span>
              )}
              <span className="text-muted-foreground/50">·</span>
              <span className="capitalize font-medium">{p.payment_method || p.payment_gateway}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-mono font-bold text-primary">{p.payment_number || p.payment_id || '—'}</span>
            </div>
            {p.invoice_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold text-foreground truncate">{p.invoice_number}</span>
              </div>
            )}
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

