'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift, Loader2, AlertCircle, RefreshCw, ExternalLink, Eye,
  X, CheckCircle2, Clock, XCircle, ChevronDown,
  User, Scissors, MapPin, Timer, Package, CreditCard,
  MessageSquare, Hash, Building2, Phone, Mail, Calendar,
  Lock, Sparkles, Star,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { CreateVoucherModal } from '@/components/bookings/CreateVoucherModal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ServiceType {
  id: string;
  name: string;
}

interface ServiceData {
  name: string;
  image: string | null;
  currency: string;
  base_price: string;
  service_types: ServiceType[];
  duration_minutes: number;
}

interface BranchData {
  name: string;
  branch_id: string;
}

interface ArrangementData {
  image: string | null;
  price: string | null;
  currency: string;
  arrangement_name: string;
  arrangement_type: string;
}

interface Addon {
  id: string;
  name: string;
  price: string;
  currency: string;
  description: string;
  duration_minutes: number;
}

interface PersonDetails {
  name: string;
  email?: string;
  phone_number?: string;
}

interface PaymentTransaction {
  PaymentGateway: string;
  TransactionStatus: string;
  TrackId: string;
  TransactionDate: string;
  TransationValue: string;
  Currency: string;
  AuthorizationId: string;
}

interface PaymentData {
  data?: {
    InvoiceId?: number;
    InvoiceStatus?: string;
    InvoiceValue?: number;
    CustomerName?: string;
    InvoiceTransactions?: PaymentTransaction[];
    ExpiryDate?: string;
  };
  isPaid?: boolean;
  status?: string;
  invoiceId?: string;
  paymentUrl?: string;
}

interface Voucher {
  id: string;
  service_id: string;
  service_data: ServiceData;
  branch_id: string;
  branch_data: BranchData;
  service_arrangement_id: string;
  service_arrangement_data: ArrangementData;
  addons: Addon[];
  extra_time: number;
  expire_date: string;
  status: string;
  sender_id: string;
  sender_details: PersonDetails;
  sender_data?: PersonDetails;
  recipient_phone: string;
  recipient_details: PersonDetails;
  recipient_data?: PersonDetails;
  created_by: string;
  total_duration: number;
  total_amount: string;
  currency: string;
  gift_message: string;
  gift_template: string;
  secret_code: string;
  public_token: string;
  redeemed_booking_id: string | null;
  redeemed_at: string | null;
  booking_id: string | null;
  payment_id: string | null;
  payment_data: PaymentData | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(amount: string, currency: string): string {
  const n = parseFloat(amount ?? '0');
  return `${isNaN(n) ? '0.000' : n.toFixed(3)} ${currency}`;
}

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string; icon: React.ElementType }> = {
  active:   { label: 'Active',   pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500',            icon: CheckCircle2 },
  redeemed: { label: 'Redeemed', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',     dot: 'bg-violet-500',             icon: Star },
  expired:  { label: 'Expired',  pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             dot: 'bg-rose-500',               icon: XCircle },
  pending:  { label: 'Pending',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         dot: 'bg-amber-500 animate-pulse', icon: Clock },
};

function statusCfg(s: string) {
  return STATUS_CFG[s?.toLowerCase()] ?? STATUS_CFG['pending'];
}

// ── Voucher Detail Modal ───────────────────────────────────────────────────────

function VoucherDetailModal({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const cfg = statusCfg(voucher.status);
  const StatusIcon = cfg.icon;
  const isExpired = voucher.expire_date && new Date(voucher.expire_date) < new Date();

  const barColor: Record<string, string> = {
    active:   'from-emerald-500 to-teal-400',
    redeemed: 'from-violet-500 to-indigo-500',
    expired:  'from-rose-500 to-red-400',
    pending:  'from-amber-400 to-orange-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Status gradient bar */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r shrink-0', barColor[voucher.status?.toLowerCase()] ?? 'from-violet-500 to-indigo-500')} />

        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gift Voucher</p>
            </div>
            <h2 className="text-base font-extrabold leading-tight">{voucher.service_data?.name ?? 'Voucher Details'}</h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold', cfg.pill)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
              </span>
              {voucher.payment_data?.isPaid && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <CreditCard className="h-2.5 w-2.5" /> Paid
                </span>
              )}
              {isExpired && voucher.status === 'active' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  <XCircle className="h-2.5 w-2.5" /> Expired
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition"
            aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Secret Code + Template */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Secret Code</p>
              </div>
              <p className="text-lg font-black tracking-[0.3em] text-primary font-mono">{voucher.secret_code ?? '—'}</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Template</p>
              </div>
              <p className="text-sm font-bold text-foreground">{voucher.gift_template ?? '—'}</p>
            </div>
          </div>

          {/* Service + Branch + Arrangement */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40">
            {/* Service */}
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Scissors className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                <p className="text-sm font-bold">{voucher.service_data?.name ?? '—'}</p>
                {voucher.service_data?.service_types?.[0]?.name && (
                  <p className="text-[11px] text-muted-foreground">{voucher.service_data.service_types[0].name}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold text-primary">
                  {fmtMoney(voucher.total_amount, voucher.currency)}
                </p>
                <p className="text-[10px] text-muted-foreground">{voucher.total_duration} min</p>
              </div>
            </div>

            {/* Arrangement */}
            {voucher.service_arrangement_data?.arrangement_name && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10">
                  <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Room / Arrangement</p>
                  <p className="text-sm font-semibold">{voucher.service_arrangement_data.arrangement_name}</p>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                    {voucher.service_arrangement_data.arrangement_type?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            {/* Branch */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10">
                <MapPin className="h-4 w-4 text-sky-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</p>
                <p className="text-sm font-semibold">{voucher.branch_data?.name ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Sender & Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sender</p>
              </div>
              <div>
                <p className="text-xs font-bold">{voucher.sender_data?.name || voucher.sender_details?.name || '—'}</p>
                {(voucher.sender_data?.phone_number || voucher.sender_details?.phone_number) && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-2.5 w-2.5" />{voucher.sender_data?.phone_number ?? voucher.sender_details?.phone_number}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-rose-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recipient</p>
              </div>
              <div>
                <p className="text-xs font-bold">{voucher.recipient_data?.name || voucher.recipient_details?.name || '—'}</p>
                {(voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number) && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-2.5 w-2.5" />{voucher.recipient_data?.phone_number ?? voucher.recipient_details?.phone_number}
                  </p>
                )}
                {(voucher.recipient_data?.email || voucher.recipient_details?.email) && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5" />{voucher.recipient_data?.email ?? voucher.recipient_details?.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Add-ons */}
          {voucher.addons?.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Package className="h-3.5 w-3.5 text-violet-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add-ons ({voucher.addons.length})</p>
              </div>
              <div className="space-y-2">
                {voucher.addons.map((addon, index) => (
                  <div key={addon.id ?? index} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold">{addon.name}</p>
                      {addon.duration_minutes > 0 && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Timer className="h-2.5 w-2.5" />{addon.duration_minutes} min
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-violet-600 dark:text-violet-400 shrink-0">
                      +{fmtMoney(addon.price, addon.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra time */}
          {voucher.extra_time > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10">
                <Timer className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Extra Time</p>
                <p className="text-sm font-bold">{voucher.extra_time} min</p>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-sky-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created</p>
              </div>
              <p className="text-xs font-bold">{fmtDate(voucher.created_at)}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-rose-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expires</p>
              </div>
              <p className={cn('text-xs font-bold', isExpired ? 'text-rose-600 dark:text-rose-400' : '')}>
                {fmtDate(voucher.expire_date)}
              </p>
            </div>
          </div>

          {/* Redeemed info */}
          {voucher.redeemed_at && (
            <div className="flex items-center gap-3 rounded-2xl border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15">
                <CheckCircle2 className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Redeemed</p>
                <p className="text-xs font-bold">{fmtDate(voucher.redeemed_at)}</p>
              </div>
            </div>
          )}

          {/* Gift message */}
          {voucher.gift_message && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-rose-50/60 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/10 px-4 py-3">
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Gift Message</p>
                <p className="text-xs text-foreground leading-relaxed italic">"{voucher.gift_message}"</p>
              </div>
            </div>
          )}

          {/* Payment info */}
          {voucher.payment_data?.data && (
            <div className="rounded-2xl border border-emerald-200/40 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Payment</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Status',   val: voucher.payment_data.data.InvoiceStatus },
                  { label: 'Invoice',  val: voucher.payment_data.data.InvoiceId?.toString() },
                  { label: 'Amount',   val: voucher.payment_data.data.InvoiceValue ? `${voucher.payment_data.data.InvoiceValue} ${voucher.payment_data.data?.InvoiceTransactions?.[0]?.Currency ?? ''}` : null },
                  { label: 'Gateway',  val: voucher.payment_data.data?.InvoiceTransactions?.[0]?.PaymentGateway },
                ].filter(r => r.val).map(r => (
                  <div key={r.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 border-t border-border/40 px-6 py-4">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          {voucher.payment_url && (
            <a
              href={voucher.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-sm transition active:scale-[0.98]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Payment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status Filter Dropdown ─────────────────────────────────────────────────────

function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { val: 'all',      label: 'All Statuses' },
    { val: 'active',   label: 'Active' },
    { val: 'redeemed', label: 'Redeemed' },
    { val: 'expired',  label: 'Expired' },
    { val: 'pending',  label: 'Pending' },
  ];
  const current = options.find(o => o.val === value) ?? options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition"
      >
        <span>{current.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 w-44 rounded-2xl border border-border bg-card shadow-2xl py-2 overflow-hidden">
            {options.map(o => (
              <button
                key={o.val}
                onClick={() => { onChange(o.val); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-muted/60',
                  o.val === value ? 'text-primary font-bold bg-primary/5' : 'text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GiftVouchersPage() {
  const token = useAppSelector((s) => s.auth.token);

  const [vouchers,        setVouchers]        = useState<Voucher[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [statusFilter,    setStatusFilter]    = useState<string>('all');
  const [showCreate,      setShowCreate]      = useState(false);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/booknpay/api/v1/vouchers/', {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).detail ?? `Error ${res.status}`);
      }
      const data = await res.json();
      // Handle both array and paginated { results: [] } responses
      const list: Voucher[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
      setVouchers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // ── Derived / filtered ──────────────────────────────────────────────────────
  const filtered = statusFilter === 'all'
    ? vouchers
    : vouchers.filter(v => v.status?.toLowerCase() === statusFilter);

  const stats = {
    total:    vouchers.length,
    active:   vouchers.filter(v => v.status === 'active').length,
    redeemed: vouchers.filter(v => v.status === 'redeemed').length,
    expired:  vouchers.filter(v => v.status === 'expired').length,
    revenue:  vouchers.reduce((sum, v) => sum + (parseFloat(v.total_amount) || 0), 0),
    currency: vouchers[0]?.currency ?? 'KWD',
  };

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gift Vouchers</h1>
            <p className="text-sm text-muted-foreground">Manage and track all issued gift vouchers</p>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Vouchers', value: stats.total,                          sub: 'all time',        grad: 'from-primary to-accent', bg: 'bg-primary/5 dark:bg-primary/10', border: 'border-primary/20' },
          { label: 'Active',         value: stats.active,                         sub: 'ready to redeem', grad: 'from-emerald-500 to-teal-500',   bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200/80 dark:border-emerald-800/40' },
          { label: 'Redeemed',       value: stats.redeemed,                       sub: 'used vouchers',   grad: 'from-blue-500 to-sky-500',       bg: 'bg-blue-50 dark:bg-blue-950/30',  border: 'border-blue-200/80 dark:border-blue-800/40' },
          { label: 'Total Revenue',  value: `${stats.revenue.toFixed(3)} ${stats.currency}`, sub: 'voucher sales', grad: 'from-amber-500 to-orange-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200/80 dark:border-amber-800/40' },
        ].map(k => (
          <div key={k.label} className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5', k.bg, k.border)}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-xl font-extrabold tracking-tight">{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10', k.grad)} />
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <button
            onClick={fetchVouchers}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
        >
          <Gift className="h-4 w-4" />
          New Voucher
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading vouchers…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <button
            onClick={fetchVouchers}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card py-20 text-center">
          <Gift className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-semibold text-muted-foreground">
            {vouchers.length === 0 ? 'No vouchers found' : 'No vouchers match the selected filter'}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {[
                    'Sender', 'Recipient', 'Service', 'Branch',
                    'Duration', 'Total Price', 'Expires', 'Status',
                    'Payment', 'Actions',
                  ].map(col => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground first:rounded-tl-2xl last:rounded-tr-2xl"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map(v => {
                  const cfg = statusCfg(v.status);
                  const expired = v.expire_date && new Date(v.expire_date) < new Date();
                  return (
                    <tr
                      key={v.id}
                      className="group transition hover:bg-muted/30"
                    >
                      {/* Sender */}
                      <td className="px-4 py-3">
                        {(() => {
                          const senderName = v.sender_data?.name || v.sender_details?.name;
                          const initials = senderName?.slice(0, 2)?.toUpperCase() ?? '??';
                          return (
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-white text-[10px] font-bold">
                                {initials}
                              </div>
                              <span className="font-medium text-[13px] leading-tight line-clamp-1">{senderName ?? '—'}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-3">
                        {(() => {
                          const recipientName = v.recipient_data?.name || v.recipient_details?.name;
                          const recipientPhone = v.recipient_data?.phone_number || v.recipient_details?.phone_number;
                          const initials = recipientName?.slice(0, 2)?.toUpperCase() ?? '??';
                          return (
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[10px] font-bold">
                                {initials}
                              </div>
                              <div>
                                <p className="font-medium text-[13px] leading-tight">{recipientName ?? '—'}</p>
                                {recipientPhone && (
                                  <p className="text-[10px] text-muted-foreground">{recipientPhone}</p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="font-semibold text-[13px] line-clamp-2 leading-snug">{v.service_data?.name ?? '—'}</p>
                        {v.service_data?.service_types?.[0]?.name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{v.service_data.service_types[0].name}</p>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3 min-w-[140px]">
                        <p className="text-[13px] font-medium line-clamp-1">{v.branch_data?.name ?? '—'}</p>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-bold">
                          <Timer className="h-3 w-3 text-muted-foreground" />
                          {v.total_duration} min
                        </span>
                      </td>

                      {/* Total Price */}
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-extrabold text-primary tabular-nums">
                          {fmtMoney(v.total_amount, v.currency)}
                        </p>
                      </td>

                      {/* Expires */}
                      <td className="px-4 py-3">
                        <p className={cn('text-[12px] font-medium tabular-nums whitespace-nowrap', expired && v.status !== 'redeemed' ? 'text-rose-600 dark:text-rose-400' : '')}>
                          {fmtDate(v.expire_date)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', cfg.pill)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3">
                        {v.payment_data?.isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                          </span>
                        ) : v.payment_url ? (
                          <a
                            href={v.payment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 transition"
                          >
                            <ExternalLink className="h-2.5 w-2.5" /> Pay Now
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedVoucher(v)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/10 transition"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-5 py-3">
            <p className="text-[12px] text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> of{' '}
              <span className="font-bold text-foreground">{vouchers.length}</span> vouchers
            </p>
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                Total value:{' '}
                <span className="font-bold text-primary">
                  {filtered.reduce((s, v) => s + (parseFloat(v.total_amount) || 0), 0).toFixed(3)} {stats.currency}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedVoucher && (
        <VoucherDetailModal
          voucher={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
        />
      )}

      {/* ── Create Voucher Modal ── */}
      {showCreate && token && (
        <CreateVoucherModal
          token={token}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchVouchers(); }}
        />
      )}
    </DashboardShell>
  );
}
