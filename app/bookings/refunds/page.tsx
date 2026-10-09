'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Receipt,
  Wallet,
  Calendar,
  Building2,
  User,
  CreditCard,
  Banknote,
  Hash,
  Shield,
  Percent,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';

// ── Types & Interfaces ─────────────────────────────────────────────────────────

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

interface BookingData {
  booking_number?: string;
  booking_no?: string;
  branch_name?: string;
  branch_id?: string;
  service_name?: string;
  service_title?: string;
  appointment_start?: string;
  total_amount?: number | string;
  [key: string]: unknown;
}

interface BranchData {
  name?: string;
  branch_name?: string;
  code?: string;
  [key: string]: unknown;
}

export interface RefundItem {
  id: string;
  refund_number: string;
  booking_id?: string | null;
  booking_data?: BookingData | null;
  payment_id?: string | null;
  invoice_number?: string | null;
  credit_note_number?: string | null;
  customer_id?: string | null;
  customer_data?: CustomerData | null;
  branch_id?: string | null;
  branch_data?: BranchData | null;
  refund_type: string; // 'manual' | 'gateway'
  refund_method: string; // 'cash' | 'knet' | 'card' | 'bank_transfer' | 'tap' | 'myfatoorah'
  status: string; // 'completed' | 'pending' | 'failed'
  requested_amount: number | string;
  cancellation_fee: number | string;
  refunded_amount: number | string;
  currency: string;
  payment_gateway?: string | null;
  gateway_refund_id?: string | null;
  gateway_transaction_id?: string | null;
  reason?: string | null;
  notes?: string | null;
  customer_confirmation?: string | null;
  reference_number?: string | null;
  processed_by?: string | null;
  processed_by_data?: Record<string, unknown> | null;
  processed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface RefundAnalytics {
  total_refunded_amount: string | number;
  total_cancellation_fee: string | number;
  total_requested_amount: string | number;
  total_count: number;
}

interface PaginationMeta {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(val: number | string | null | undefined, currency = 'KWD', decimals = 3): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val ?? '0'));
  if (Number.isNaN(n)) return `0.000 ${currency}`;
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  let dateStr = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  let dateStr = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCustomerName(r: RefundItem): string {
  const cd = r.customer_data;
  if (cd) {
    const full = [cd.first_name, cd.last_name].filter(Boolean).join(' ');
    if (full) return full;
    if (cd.name) return String(cd.name);
    if (cd.customer_name) return String(cd.customer_name);
  }
  return 'Customer';
}

function getCustomerPhone(r: RefundItem): string {
  const cd = r.customer_data;
  if (cd) {
    return String(cd.phone_number || cd.phone || cd.mobile || '');
  }
  return '';
}

function getCustomerEmail(r: RefundItem): string {
  return String(r.customer_data?.email || '');
}

function getBookingNumber(r: RefundItem): string {
  return String(r.booking_data?.booking_number || r.booking_data?.booking_no || '');
}

function getBranchName(r: RefundItem): string {
  return String(
    r.branch_data?.name ||
    r.branch_data?.branch_name ||
    r.booking_data?.branch_name ||
    ''
  );
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      title={label}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? <span className="text-[10px] text-emerald-600">Copied</span> : null}
    </button>
  );
}

// ── Status & Method Badges ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status || 'pending').toLowerCase();
  switch (s) {
    case 'completed':
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground capitalize">
          {status}
        </span>
      );
  }
}

function MethodBadge({ method }: { method: string }) {
  const m = (method || 'cash').toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    tap: { label: 'Tap', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
    knet: { label: 'KNET', cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    card: { label: 'Credit Card', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    cash: { label: 'Cash', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    bank_transfer: { label: 'Bank Transfer', cls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
    myfatoorah: { label: 'MyFatoorah', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  };

  const item = map[m] || { label: method || 'Unknown', cls: 'bg-muted text-muted-foreground border-border/40' };
  return (
    <span className={cn('inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', item.cls)}>
      {item.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = (type || 'manual').toLowerCase();
  if (t === 'gateway') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400">
        <Shield className="h-2.5 w-2.5" /> Gateway
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
      <Banknote className="h-2.5 w-2.5" /> Manual Desk
    </span>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function RefundDetailModal({ refund, onClose }: { refund: RefundItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const customerName = getCustomerName(refund);
  const customerPhone = getCustomerPhone(refund);
  const customerEmail = getCustomerEmail(refund);
  const bookingNumber = getBookingNumber(refund);
  const branchName = getBranchName(refund);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-foreground">Refund Details</h3>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {refund.refund_number}
                </span>
                <CopyButton text={refund.refund_number} />
              </div>
              <p className="text-[11px] text-muted-foreground">ID: {refund.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Status & Amount Highlight Card */}
          <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Refunded</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {money(refund.refunded_amount, refund.currency)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={refund.status} />
                  <TypeBadge type={refund.refund_type} />
                  <MethodBadge method={refund.refund_method} />
                </div>
              </div>

              <div className="text-right space-y-1">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Requested:</span>
                  <span className="text-xs font-semibold">{money(refund.requested_amount, refund.currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Fee Deducted:</span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {money(refund.cancellation_fee, refund.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <User className="h-3.5 w-3.5 text-primary" /> Customer Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Name</span>
                <span className="font-semibold text-foreground">{customerName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Phone</span>
                <span className="font-semibold">{customerPhone || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email</span>
                <span className="font-semibold">{customerEmail || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Customer ID</span>
                <span className="font-mono text-[11px] text-muted-foreground">{refund.customer_id || '—'}</span>
              </div>
            </div>
          </div>

          {/* Booking & Invoicing */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Booking & Document References
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Booking Number</span>
                {bookingNumber ? (
                  <Link
                    href={`/bookings?search=${encodeURIComponent(bookingNumber)}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    {bookingNumber}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-muted-foreground font-mono">{refund.booking_id ? `${refund.booking_id.slice(0, 8)}…` : '—'}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Branch</span>
                <span className="font-semibold">{branchName || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Invoice Number</span>
                {refund.invoice_number ? (
                  <span className="font-mono font-bold text-foreground">{refund.invoice_number}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Credit Note</span>
                {refund.credit_note_number ? (
                  <span className="font-mono font-bold text-foreground">{refund.credit_note_number}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Gateway & Payment Reversal Details */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> Transaction & Gateway Settlement
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Gateway Provider</span>
                <span className="font-semibold capitalize">{refund.payment_gateway || refund.refund_method || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Reference Number</span>
                <span className="font-mono">{refund.reference_number || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Gateway Refund ID</span>
                <span className="font-mono break-all">{refund.gateway_refund_id || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Gateway Transaction ID</span>
                <span className="font-mono break-all">{refund.gateway_transaction_id || '—'}</span>
              </div>
            </div>
          </div>

          {/* Reason & Notes */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <Info className="h-3.5 w-3.5 text-primary" /> Reason & Staff Notes
            </h4>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Reason for Refund</span>
                <p className="mt-0.5 rounded-lg bg-muted/40 p-2.5 text-foreground">{refund.reason || 'No reason specified'}</p>
              </div>
              {refund.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Internal Notes</span>
                  <p className="mt-0.5 rounded-lg bg-muted/40 p-2.5 text-foreground">{refund.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline & Processing Audit */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Audit & Timestamps</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-muted-foreground block">Processed By</span>
                <span className="font-semibold">{refund.processed_by || 'Staff'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Processed At</span>
                <span>{formatDateTime(refund.processed_at)}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Created At</span>
                <span>{formatDateTime(refund.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-border/60 px-6 py-4">
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────

export default function RefundsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const initialized = useAppSelector((s) => s.auth.initialized);
  const locale = useAppSelector((s) => s.ui.locale);

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedRefund, setSelectedRefund] = useState<RefundItem | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'manual' | 'gateway'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // API response state
  const [items, setItems] = useState<RefundItem[]>([]);
  const [analytics, setAnalytics] = useState<RefundAnalytics | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch from `/booknpay/api/v1/refunds/`
  useEffect(() => {
    if (!initialized) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('refund_type', typeFilter);
    if (methodFilter !== 'all') params.set('refund_method', methodFilter);

    const endpoint = `/booknpay/api/v1/refunds/?${params.toString()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': locale || 'en',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    authedFetch(endpoint, { headers })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          const detail = json?.detail || json?.message || json?.error?.message;
          throw new Error(typeof detail === 'string' ? detail : `HTTP error ${res.status}`);
        }

        const dataItems: RefundItem[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];
        setItems(dataItems);

        if (json?.meta?.pagination) {
          setPagination(json.meta.pagination as PaginationMeta);
        } else {
          setPagination({
            count: dataItems.length,
            total_pages: Math.max(1, Math.ceil(dataItems.length / pageSize)),
            current_page: page,
            page_size: pageSize,
            next: null,
            previous: null,
          });
        }

        if (json?.analytics) {
          setAnalytics(json.analytics as RefundAnalytics);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.error('[RefundsPage] Error loading refunds:', err);
        setError(err.message || 'Failed to fetch refunds');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialized, token, locale, page, pageSize, search, statusFilter, typeFilter, methodFilter, refreshKey]);

  // Derived metrics (using server analytics if present, or client aggregation fallback)
  const stats = useMemo(() => {
    if (analytics) {
      return {
        totalRefunded: parseFloat(String(analytics.total_refunded_amount ?? 0)),
        totalFee: parseFloat(String(analytics.total_cancellation_fee ?? 0)),
        totalRequested: parseFloat(String(analytics.total_requested_amount ?? 0)),
        count: analytics.total_count ?? items.length,
      };
    }
    const refunded = items.reduce((acc, i) => acc + (parseFloat(String(i.refunded_amount)) || 0), 0);
    const fee = items.reduce((acc, i) => acc + (parseFloat(String(i.cancellation_fee)) || 0), 0);
    const req = items.reduce((acc, i) => acc + (parseFloat(String(i.requested_amount)) || 0), 0);
    return {
      totalRefunded: refunded,
      totalFee: fee,
      totalRequested: req,
      count: pagination?.count ?? items.length,
    };
  }, [analytics, items, pagination]);

  // Export to CSV
  const handleExportCsv = () => {
    if (items.length === 0) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Refund Number',
      'Created Date',
      'Status',
      'Type',
      'Method',
      'Customer Name',
      'Customer Phone',
      'Booking Number',
      'Branch',
      'Requested Amount',
      'Cancellation Fee',
      'Refunded Amount',
      'Currency',
      'Reason',
      'Gateway ID',
    ];
    const rows = items.map((r) => [
      r.refund_number,
      formatDateTime(r.created_at),
      r.status,
      r.refund_type,
      r.refund_method,
      getCustomerName(r),
      getCustomerPhone(r),
      getBookingNumber(r),
      getBranchName(r),
      r.requested_amount,
      r.cancellation_fee,
      r.refunded_amount,
      r.currency,
      r.reason || '',
      r.gateway_refund_id || r.reference_number || '',
    ]);

    const csvContent = [headers.map(esc).join(','), ...rows.map((row) => row.map(esc).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `refunds_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = pagination?.total_pages || Math.max(1, Math.ceil((pagination?.count || items.length) / pageSize));

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Refunds"
          subtitle="Track and manage customer booking refunds, cancellation settlements, and gateway reversals"
        />

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={refetch}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-sm transition hover:text-foreground hover:bg-muted disabled:opacity-60"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin text-primary')} />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          <div className="flex rounded-xl border border-border/60 bg-card p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg transition',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg transition',
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Refunded</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 truncate text-xl font-extrabold text-foreground">{money(stats.totalRefunded)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Net disbursed to customers</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cancellation Fees</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 truncate text-xl font-extrabold text-foreground">{money(stats.totalFee)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Retained fee revenue</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Requested</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 truncate text-xl font-extrabold text-foreground">{money(stats.totalRequested)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Gross booking amount</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Refund Claims</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 truncate text-xl font-extrabold text-foreground">{stats.count}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Total refund transactions</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
        {/* Top filter row: Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'All Statuses'],
                ['completed', 'Completed'],
                ['pending', 'Pending'],
                ['failed', 'Failed'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-bold transition',
                  statusFilter === val
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {(search || statusFilter !== 'all' || typeFilter !== 'all' || methodFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setTypeFilter('all');
                setMethodFilter('all');
                setPage(1);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
            >
              <X className="h-3 w-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Search and Secondary Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search refund #, booking #, customer, invoice..."
              className="h-9 w-full rounded-xl border border-border/60 bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Refund Type filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Types</option>
              <option value="manual">Manual Desk</option>
              <option value="gateway">Gateway Reversal</option>
            </select>
          </div>

          {/* Refund Method filter */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="tap">Tap</option>
              <option value="knet">KNET</option>
              <option value="card">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="myfatoorah">MyFatoorah</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={refetch} className="font-bold underline hover:opacity-80">
            Retry
          </button>
        </div>
      )}

      {/* Content Table / Cards */}
      <div className="mt-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-full rounded-2xl border border-border/40 shimmer" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-muted/50 text-muted-foreground/50 mb-3">
              <RotateCcw className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-foreground">No refunds found</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {search || statusFilter !== 'all' || typeFilter !== 'all' || methodFilter !== 'all'
                ? 'Try adjusting your search criteria or clear active filters.'
                : 'No customer refund transactions have been recorded yet.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Refund Number & Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Booking Ref</th>
                  <th className="px-4 py-3">Type & Method</th>
                  <th className="px-4 py-3 text-right">Requested</th>
                  <th className="px-4 py-3 text-right">Net Refunded</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((r) => {
                  const customerName = getCustomerName(r);
                  const customerPhone = getCustomerPhone(r);
                  const bookingNumber = getBookingNumber(r);

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRefund(r)}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                    >
                      {/* Refund Number & Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {r.refund_number}
                            </span>
                            <CopyButton text={r.refund_number} />
                          </div>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground/70" />
                            {formatDate(r.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-[10px] text-primary">
                            {getInitials(customerName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[140px]">{customerName}</p>
                            {customerPhone && (
                              <p className="text-[11px] text-muted-foreground truncate">{customerPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Booking Ref */}
                      <td className="px-4 py-3">
                        {bookingNumber ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs font-semibold text-foreground">{bookingNumber}</span>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {r.booking_id ? `${r.booking_id.slice(0, 8)}…` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Type & Method */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <MethodBadge method={r.refund_method} />
                          <TypeBadge type={r.refund_type} />
                        </div>
                      </td>

                      {/* Requested */}
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {money(r.requested_amount, r.currency)}
                      </td>

                      {/* Net Refunded */}
                      <td className="px-4 py-3 text-right tabular-nums font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {money(r.refunded_amount, r.currency)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => {
              const customerName = getCustomerName(r);
              const customerPhone = getCustomerPhone(r);
              const bookingNumber = getBookingNumber(r);

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRefund(r)}
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/40 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {r.refund_number}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-xs text-primary">
                        {getInitials(customerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{customerPhone || 'No phone'}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3 space-y-1 mb-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Booking:</span>
                        <span className="font-semibold">{bookingNumber || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method:</span>
                        <span className="font-semibold capitalize">{r.refund_method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-semibold">{formatDate(r.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Refunded</span>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {money(r.refunded_amount, r.currency)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRefund(r);
                      }}
                      className="rounded-lg bg-muted px-3 py-1 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Showing {items.length} of {pagination?.count ?? items.length} refunds</span>
              <span>·</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border/60 bg-card px-2 text-xs"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card transition hover:bg-muted disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-muted-foreground">
                Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card transition hover:bg-muted disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRefund && (
        <RefundDetailModal refund={selectedRefund} onClose={() => setSelectedRefund(null)} />
      )}
    </DashboardShell>
  );
}
