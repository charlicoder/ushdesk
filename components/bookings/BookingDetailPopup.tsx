"use client";

import Link from 'next/link';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, Calendar, Clock, MapPin, User, Scissors,
  CreditCard, CheckCircle2, XCircle, BookOpen,
  ChevronLeft, ChevronRight, X, ExternalLink, Hash, Home,
  History, Info, UserCheck, Copy, Check, Plus, Banknote, Printer, Loader2,
  FileText, Receipt, Eye, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { checkBookingCancellationEligibility, getBookingAppointmentDateTime } from '@/lib/cancellation-policy';
import { RescheduleBookingModal } from '@/components/bookings/RescheduleBookingModal';
import { BookingReceiptModal } from '@/components/bookings/BookingReceiptModal';
import { InvoiceDetailModal } from '@/components/bookings/InvoiceDetailModal';
import { BookingCancellationModal } from '@/components/bookings/BookingCancellationModal';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Booking {
  id: string;
  booking_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  branch_name: string;
  service_name: string;
  service_category: string;
  service_price: string;
  arrangement_name: string | null;
  therapist_name: string;
  appointment_start: string;
  appointment_end: string;
  duration_minutes: number;
  addons_duration: number;
  extra_minutes: number;
  total_duration: number;
  price_for_extra_minutes: string;
  booking_type: string;
  status: string;
  payment_status: string;
  payment_gateway: string | null;
  payment_provider: string | null;
  payment_method: string | null;
  payment_url: string | null;
  payment_data: Record<string, unknown> | null;
  is_paid: boolean;
  total_amount: string;
  currency: string;
  created_at: string;
  created_by_user: string | null;
  created_by_user_data: Record<string, unknown> | null;
  addons: Array<Record<string, unknown>>;
  pricing: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

// ── Normalise ──────────────────────────────────────────────────────────────────
export function normalise(raw: Record<string, unknown>): Booking {
  const cd  = (raw.customer_data            ?? {}) as Record<string, unknown>;
  const bd  = (raw.branch_data              ?? {}) as Record<string, unknown>;
  const sd  = (raw.service_data             ?? {}) as Record<string, unknown>;
  const sad = (raw.service_arrangement_data ?? {}) as Record<string, unknown>;
  const td  = (raw.therapist_data           ?? {}) as Record<string, unknown>;
  const pm  = (raw.payments_meta            ?? {}) as Record<string, unknown>;
  const pd  = (raw.payment_data             ?? {}) as Record<string, unknown>;
  const firstName = String(cd.first_name ?? '');
  const lastName  = String(cd.last_name  ?? '');

  const durSvc    = Number(raw.duration_minutes ?? sd.duration_minutes ?? sd.base_duration ?? 0);
  const durAddons = Number(raw.addons_duration ?? 0);
  const durExtra  = Number(raw.extra_minutes ?? 0);
  const totalDur  = Number(raw.total_duration ?? (durSvc + durAddons + durExtra)) || (durSvc + durAddons + durExtra);

  const rawAddons = (Array.isArray(raw.addons) ? raw.addons : Array.isArray(raw.selected_addons) ? raw.selected_addons : []) as Array<Record<string, unknown>>;

  return {
    id:                String(raw.id ?? ''),
    booking_number:    raw.booking_number ? String(raw.booking_number) : null,
    customer_name:     [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Customer',
    customer_phone:    (cd.phone_number ?? null) as string | null,
    customer_email:    (cd.email        ?? null) as string | null,
    branch_name:       String(bd.branch_name ?? bd.name ?? raw.branch_id ?? ''),
    service_name:      String(sd.name ?? sd.service_name ?? ''),
    service_category:  String(sd.category ?? sd.service_category ?? ''),
    service_price:     String(sd.base_price ?? sd.arrangement_price ?? raw.base_price ?? '0'),
    arrangement_name:  (sad.arrangement_name ?? sad.room_name ?? null) as string | null,
    therapist_name:    String(td.therapist_name ?? td.name ?? '—'),
    appointment_start: String(raw.appointment_start ?? ''),
    appointment_end:   String(raw.appointment_end   ?? ''),
    duration_minutes:  durSvc,
    addons_duration:   durAddons,
    extra_minutes:     durExtra,
    total_duration:    totalDur,
    price_for_extra_minutes: String(raw.price_for_extra_minutes ?? raw.extra_price ?? '0'),
    booking_type:      String(raw.booking_type      ?? 'branch'),
    status:            String(raw.status            ?? 'pending').toLowerCase(),
    payment_status:    String(raw.payment_status    ?? '').toLowerCase(),
    payment_gateway:   (pm.payment_gateway ?? pd.payment_gateway ?? raw.payment_gateway ?? null) as string | null,
    payment_provider:  (raw.payment_provider ?? pd.payment_provider ?? null) as string | null,
    payment_method:    (raw.payment_method ?? null) as string | null,
    payment_url:       (pd.payment_url     ?? pm.payment_url     ?? raw.payment_url ?? null) as string | null,
    payment_data:      (raw.payment_data ?? null) as Record<string, unknown> | null,
    is_paid:           pm.is_paid === true || pd.is_paid === true || pd.status === 'success' || raw.payment_status === 'success',
    total_amount:      String(raw.total_amount ?? '0'),
    currency:          String(raw.currency     ?? 'KWD'),
    created_at:        String(raw.created_at   ?? ''),
    created_by_user:   raw.created_by_user ? String(raw.created_by_user) : (raw.created_by ? String(raw.created_by) : null),
    created_by_user_data: (raw.created_by_user_data ?? null) as Record<string, unknown> | null,
    addons:            rawAddons,
    pricing:           (raw.pricing ?? raw.pricing_details ?? null) as Record<string, unknown> | null,
    raw,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// Backend stores local Kuwait time labelled as UTC (timezone-naive by design).
// Format functions must use timeZone: 'UTC' to display exact database values
// without browser local-timezone offset (which shifts +3h in Kuwait).
export function formatDateTime(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
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

export function formatPaidTimestamp(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  // Format in user local timezone (e.g. Kuwait UTC+3) so 02:28 UTC shows as 05:28 AM
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
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
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatTime(iso: string) {
  if (!iso) return '';
  const s = iso.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}
export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ── Style maps ─────────────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  no_show:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
export const PAYMENT_STYLES: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  failed:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
export const STATUS_BAR: Record<string, string> = {
  confirmed: 'bg-blue-400', completed: 'bg-emerald-400',
  cancelled: 'bg-red-400',  pending:   'bg-amber-400', no_show: 'bg-slate-400',
};
export const statusStyle  = (s: string) => STATUS_STYLES[s]  ?? 'bg-muted text-muted-foreground';
export const paymentStyle = (s: string) => PAYMENT_STYLES[s] ?? 'bg-muted text-muted-foreground';

// ── Sub-components ─────────────────────────────────────────────────────────────
export function CustomerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['from-sky-400 to-blue-500','from-violet-400 to-purple-500','from-rose-400 to-pink-500','from-emerald-400 to-teal-500','from-amber-400 to-orange-500'];
  const idx = name.charCodeAt(0) % colors.length;
  const sz = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={cn('shrink-0 rounded-xl bg-gradient-to-br font-bold text-white grid place-items-center', sz, colors[idx])}>
      {initials(name)}
    </div>
  );
}

export function DRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-bold text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

// ── Payment Provider Selector ─────────────────────────────────────────────────
const PAYMENT_PROVIDERS = [
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    description: 'KNET / Visa / Master',
    tag: 'Gateway',
    tagColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    borderColor: 'border-emerald-400',
    checkColor: 'text-emerald-500',
  },
  {
    id: 'paymentlink',
    name: 'PaymentLink',
    description: 'SMS / WhatsApp link',
    tag: 'Direct Link',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
  {
    id: 'deema',
    name: 'Deema',
    description: 'BNPL payment split',
    tag: 'Installments',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
  {
    id: 'knet',
    name: 'KNET Card',
    description: 'In-branch card machine',
    tag: 'POS Terminal',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Cash or other method',
    tag: 'Alternative',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
] as const;

type ProviderId = typeof PAYMENT_PROVIDERS[number]['id'];

function PaymentProviderModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const user = useAppSelector((s) => s.auth.user);
  const [selected, setSelected] = React.useState<ProviderId>('myfatoorah');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedProvider = PAYMENT_PROVIDERS.find((p) => p.id === selected)!;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          status: 'confirmed',
          payment_status: 'success',
          payment_provider: selected,
          payment_method: selected,
          reason: 'Paid on desk',
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to mark as paid (${res.status})`);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CreditCard className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select Payment Provider</p>
              <p className="text-sm font-bold text-foreground">{booking.customer_name} — {booking.currency} {parseFloat(booking.total_amount).toFixed(3)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {selectedProvider.name}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Provider Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PAYMENT_PROVIDERS.map((provider) => {
              const isSelected = selected === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelected(provider.id)}
                  className={cn(
                    'relative rounded-2xl border-2 bg-card p-4 text-left transition hover:shadow-md cursor-pointer',
                    isSelected ? `${provider.borderColor} shadow-sm` : 'border-border/50 hover:border-border',
                  )}
                >
                  {isSelected && (
                    <span className={cn('absolute top-3 right-3', provider.checkColor)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
                  <p className="font-bold text-sm text-foreground pr-5 leading-tight">{provider.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{provider.description}</p>
                  <span className={cn('mt-2.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold', provider.tagColor)}>
                    {provider.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            This will mark the booking as <span className="font-bold text-emerald-600 dark:text-emerald-400">paid</span> and status as confirmed.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" />
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Booking Detail Modal ───────────────────────────────────────────────────────
export function BookingDetailPopup({
  booking,
  onClose,
  onSuccess,
}: {
  booking: Booking | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'payment'>('details');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [receiptZoom, setReceiptZoom] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState<Record<string, unknown> | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);
  const cancellationEligibility = checkBookingCancellationEligibility(detail || booking, roleInfo, user);
  const canCancel = cancellationEligibility.canCancel;

  // ── Call Center Agent 6-hour restriction ─────────────────────────────
  const isCallCenterAgent = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;
    const candidates = [
      roleInfo?.role_name,
      roleInfo?.role_description,
      u?.role,
      u?.role_name,
      u?.position,
    ]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().toLowerCase());
    return candidates.some((c) => c.includes('call center') || c.includes('call_center'));
  })();

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const apptDateTime = getBookingAppointmentDateTime(detail || booking);
  const msUntilAppt = apptDateTime ? apptDateTime.getTime() - Date.now() : null;
  const isWithin6Hours = msUntilAppt !== null && msUntilAppt < SIX_HOURS_MS;

  // For Call Center Agent: both cancel & reschedule are restricted if within 6 h
  const callCenterRescheduleBlocked = isCallCenterAgent && isWithin6Hours;
  const callCenterCancelBlocked     = isCallCenterAgent && isWithin6Hours;
  const AGENT_BLOCK_REASON = apptDateTime && isWithin6Hours
    ? `Call Center Agents can only reschedule or cancel at least 6 hours before the appointment (appointment is in ${Math.max(0, msUntilAppt! / (1000 * 60)).toFixed(0)} min).`
    : null;

  const canReschedule = !callCenterRescheduleBlocked;
  // Combine existing cancel eligibility with Call Center restriction
  const effectiveCanCancel = canCancel && !callCenterCancelBlocked;

  useEffect(() => {
    if (!booking) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [booking, onClose]);

  // Fetch full booking detail (addons, status_history, pricing breakdown) from backend
  useEffect(() => {
    if (!booking?.id) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`)
      .then((r) => r.json())
      .then((res) => {
        if (!active) return;
        if (res?.success && res?.data) {
          setDetail(res.data as Record<string, unknown>);
        } else if (res?.data) {
          setDetail(res.data as Record<string, unknown>);
        }
      })
      .catch((err) => console.warn('[BookingDetailModal] fetch error:', err))
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [booking?.id]);

  const invoiceNumber = String(
    detail?.invoice_number ??
    detail?.invoice_id ??
    (detail?.pricing as any)?.invoice_number ??
    (detail?.pricing as any)?.invoice_id ??
    (detail?.payment_data as any)?.invoice_number ??
    (detail?.payment_data as any)?.invoice_id ??
    (booking as any)?.invoice_number ??
    (booking as any)?.invoice_id ??
    (booking as any)?.payment_data?.invoice_id ??
    ''
  ).trim();

  // Load invoice detail from backend if invoice number exists
  useEffect(() => {
    if (!invoiceNumber || invoiceNumber === '—') {
      setInvoiceRecord(null);
      return;
    }
    let cancelled = false;
    authedFetch(`/uanr/api/v1/invoices?search=${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        const found = items.find((i: Record<string, unknown>) => i.name === invoiceNumber || i.id === invoiceNumber || i.reference === invoiceNumber) || items[0];
        if (found) setInvoiceRecord(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoiceNumber]);

  if (!booking) return null;
  const curStatus = String(detail?.status ?? booking.status ?? '').toLowerCase();
  const isCompleted = curStatus === 'completed';
  const accentBar = isCompleted ? 'bg-[#7D6453]' : (STATUS_BAR[booking.status] ?? 'bg-slate-400');

  // Whether payment is pending (not paid yet)
  const isPaymentPending = !booking.is_paid && booking.payment_status !== 'success' && booking.status !== 'cancelled' && booking.status !== 'completed';

  // ── Compute durations & amounts adding service + addons + extra minutes ─────
  const addons = (detail?.addons && Array.isArray(detail.addons) && detail.addons.length > 0)
    ? (detail.addons as Array<Record<string, unknown>>)
    : (booking.addons && booking.addons.length > 0)
    ? booking.addons
    : ((booking.raw?.selected_addons as Array<Record<string, unknown>>) ?? []);

  const serviceDuration = Number(detail?.duration_minutes ?? booking.duration_minutes ?? 0);
  const addonsDuration  = Number(detail?.addons_duration  ?? booking.addons_duration  ?? 0);
  const extraMinutes    = Number(detail?.extra_minutes    ?? booking.extra_minutes    ?? 0);
  const totalDuration   = (serviceDuration + addonsDuration + extraMinutes) || Number(detail?.total_duration ?? booking.total_duration ?? serviceDuration);

  const pricingObj = (detail?.pricing ?? booking.pricing ?? booking.raw?.pricing_details) as Record<string, unknown> | undefined;

  const servicePrice = parseFloat(String(pricingObj?.arrangement_price ?? pricingObj?.base_price ?? detail?.base_price ?? booking.service_price ?? '0')) || 0;

  const addonsPriceFromList = addons.reduce((sum, a) => sum + (parseFloat(String(a.price ?? a.base_price ?? '0')) || 0), 0);
  const addonsPrice = parseFloat(String(pricingObj?.addon_price ?? pricingObj?.addons_price ?? detail?.addons_price ?? (addonsPriceFromList > 0 ? addonsPriceFromList : '0'))) || 0;

  const extraPrice = parseFloat(String(pricingObj?.price_for_extra_minutes ?? pricingObj?.extra_price ?? detail?.price_for_extra_minutes ?? booking.price_for_extra_minutes ?? '0')) || 0;

  const totalCalculated = servicePrice + addonsPrice + extraPrice;
  const rawTotal = parseFloat(String(pricingObj?.total ?? detail?.total_amount ?? booking.total_amount ?? '0')) || 0;
  const computedTotal = (totalCalculated > 0) ? totalCalculated : rawTotal;
  const currency = booking.currency || 'KWD';

  // ── History & Creator & Payment references ──────────────────────────
  const historyList = (detail?.status_history && Array.isArray(detail.status_history))
    ? (detail.status_history as Array<Record<string, unknown>>)
    : [];

  const rawCreatorObj = detail?.created_by_user_data ?? booking.created_by_user_data;
  const createdByUserObj: Record<string, unknown> | null = (() => {
    if (!rawCreatorObj) return null;
    if (typeof rawCreatorObj === 'object') return rawCreatorObj as Record<string, unknown>;
    if (typeof rawCreatorObj === 'string') {
      try {
        const parsed = JSON.parse(rawCreatorObj);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch {
        return { name: rawCreatorObj };
      }
    }
    return null;
  })();

  const createdByUserName = (
    (createdByUserObj?.full_name as string) ||
    [createdByUserObj?.first_name, createdByUserObj?.last_name].filter(Boolean).join(' ') ||
    (createdByUserObj?.name as string) ||
    (createdByUserObj?.username as string) ||
    ((detail as any)?.created_by_name as string) ||
    ((booking as any)?.created_by_name as string) ||
    (typeof booking.created_by_user === 'string' && !/^[0-9a-f-]{10,}$/i.test(booking.created_by_user) ? booking.created_by_user : '') ||
    ''
  ).trim();

  const paymentDataObj   = (detail?.payment_data ?? booking.payment_data) as Record<string, unknown> | null;
  const paidTimestamp    = (paymentDataObj?.paid_at ?? paymentDataObj?.transaction_date ?? paymentDataObj?.created_date) as string | undefined;
  const effectivePaymentUrl = String(detail?.payment_url ?? booking.payment_url ?? paymentDataObj?.payment_url ?? '');

  const receiptImg = String(
    (paymentDataObj as any)?.receipt_image ??
    (detail as any)?.receipt_image ??
    (booking as any).receipt_image ??
    ''
  ).trim();

  const transactionId = String(
    (paymentDataObj as any)?.transaction_id ??
    (paymentDataObj as any)?.reference_id ??
    (detail as any)?.transaction_id ??
    (detail as any)?.reference_id ??
    (booking as any).transaction_id ??
    (booking as any).reference_id ??
    ''
  ).trim();

  const traceId = String(
    (paymentDataObj as any)?.trace_id ??
    (detail as any)?.trace_id ??
    (booking as any).trace_id ??
    ''
  ).trim();

  const paymentProvider = String(
    booking.payment_provider ||
    booking.payment_gateway ||
    (paymentDataObj as any)?.payment_provider ||
    (paymentDataObj as any)?.payment_gateway ||
    booking.payment_method ||
    'Front Desk'
  ).trim();

  // Cancel booking — opens BookingCancellationModal which handles all accounting steps
  const handleCancel = () => {
    if (!booking) return;
    if (!canCancel) {
      setCancelError(cancellationEligibility.reason || 'Cancellations within 12 hours of appointment time require Administrator, Branch Manager, Finance Manager, or Customer Support Manager privileges.');
      return;
    }
    setShowCancellationModal(true);
  };

  const handlePrintReceipt = () => {
    setShowReceiptModal(true);
  };

  const handleCompleteBooking = async () => {
    if (!booking) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          reason: 'Service Completed',
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to update status (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        setDetail(json.data);
      } else {
        setDetail((prev) => (prev ? { ...prev, status: 'completed' } : { ...booking, status: 'completed' }));
      }
      onSuccess?.();
    } catch (err: unknown) {
      console.error('[BookingDetailModal] Error completing booking:', err);
      setCompleteError(err instanceof Error ? err.message : 'Failed to update status to completed');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <>
      {/* Payment Provider Modal (nested, z-60) */}
      {showPaymentModal && (
        <PaymentProviderModal
          booking={booking}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { onSuccess?.(); onClose(); }}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        {/* Widened when payment pending to fit buttons nicely */}
        <div
          className={cn(
            'relative z-10 w-full max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200',
            'max-w-3xl sm:max-w-4xl lg:max-w-[880px]',
            isCompleted
              ? 'booking-completed-modal border-[#B8A394] text-[#2D241E]'
              : 'border-border/60 bg-card text-foreground'
          )}
          style={isCompleted ? { backgroundColor: '#D3C0B2', color: '#2D241E' } : undefined}
        >
          {isCompleted && (
            <style>{`
              .booking-completed-modal {
                background-color: #D3C0B2 !important;
                color: #2D241E !important;
              }
              .booking-completed-modal h2,
              .booking-completed-modal h3,
              .booking-completed-modal p,
              .booking-completed-modal span:not([class*="bg-"]):not([class*="text-primary"]):not([class*="text-emerald"]):not([class*="text-rose"]) {
                color: #2D241E;
              }
              .booking-completed-modal .text-foreground {
                color: #2D241E !important;
              }
              .booking-completed-modal .text-muted-foreground {
                color: #69584D !important;
              }
              .booking-completed-modal .border-border\/40,
              .booking-completed-modal .border-border\/50,
              .booking-completed-modal .border-border\/60,
              .booking-completed-modal .border-border {
                border-color: rgba(105, 88, 77, 0.25) !important;
              }
              .booking-completed-modal .bg-muted\/20,
              .booking-completed-modal .bg-muted\/30,
              .booking-completed-modal .bg-muted\/40,
              .booking-completed-modal .bg-muted\/50,
              .booking-completed-modal .bg-muted\/60,
              .booking-completed-modal .bg-muted {
                background-color: rgba(255, 255, 255, 0.45) !important;
              }
              .booking-completed-modal .bg-card {
                background-color: rgba(255, 255, 255, 0.6) !important;
              }
            `}</style>
          )}

          <div className={cn('h-1.5 w-full shrink-0', accentBar)} />

          {/* Header */}
          <div className={cn(
            'shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
          )}>
            <div className="flex items-center gap-3">
              <CustomerAvatar name={booking.customer_name} size="lg" />
              <div>
                <p className={cn('text-[11px] font-semibold uppercase tracking-wider', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>Customer</p>
                <p className={cn('text-base font-extrabold leading-tight', isCompleted ? 'text-[#2D241E]' : 'text-foreground')}>{booking.customer_name}</p>
                {booking.customer_phone && <p className={cn('text-xs mt-0.5', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>{booking.customer_phone}</p>}
                {booking.customer_email && <p className={cn('text-xs', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>{booking.customer_email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize',
                isCompleted
                  ? 'bg-[#5C7359]/20 text-[#244221] border border-[#5C7359]/40'
                  : statusStyle(curStatus || booking.status)
              )}>
                {curStatus === 'confirmed' || curStatus === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {curStatus || booking.status}
              </span>
              {/* Payment status badge */}
              {booking.payment_status && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize',
                  isCompleted
                    ? 'bg-[#3D5A6C]/15 text-[#1B3A4B] border border-[#3D5A6C]/30'
                    : paymentStyle(booking.payment_status)
                )}>
                  <CreditCard className="h-3 w-3" />
                  {booking.payment_status}
                </span>
              )}
              <button onClick={onClose}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-xl transition cursor-pointer',
                  isCompleted ? 'bg-black/10 hover:bg-black/20 text-[#2D241E]' : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
                aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className={cn(
            'shrink-0 flex items-center border-b px-6 gap-1 sm:gap-2',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/25' : 'border-border/40 bg-muted/20'
          )}>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                activeTab === 'details'
                  ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                  : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Info className="h-3.5 w-3.5" />
              Booking Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payment')}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                activeTab === 'payment'
                  ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                  : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Payment &amp; Invoices
              {booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid' ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Paid
                </span>
              ) : isPaymentPending ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Pending
                </span>
              ) : null}
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {activeTab === 'details' ? (
              <>
                {/* Row 1: Booking Number and Booked On in one row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={Hash} label="Booking Number">
                    <span className="font-mono tracking-wide font-bold text-primary text-sm">{booking.booking_number || '—'}</span>
                  </DRow>
                  <DRow icon={Calendar} label="Booked On">
                    {formatDateTime(booking.created_at)}
                  </DRow>
                </div>

                {/* Row 2: Service */}
                <DRow icon={Scissors} label="Service">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold">{booking.service_name}</span>
                      {booking.service_category && (
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">({booking.service_category})</span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground">{servicePrice.toFixed(3)} {currency}</span>
                  </div>
                </DRow>

                {/* Row 3 & 4: Addons and Extra Minutes just after the service section */}
                {addons.length > 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Plus className="h-3.5 w-3.5 text-primary" /> Addons ({addons.length})
                      </p>
                      {addonsDuration > 0 && (
                        <span className="text-[11px] font-semibold text-muted-foreground">+{addonsDuration} min duration</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {addons.map((addon, idx) => {
                        const aName = String(addon.name ?? addon.addon_name ?? `Addon #${idx + 1}`);
                        const aPrice = parseFloat(String(addon.price ?? addon.base_price ?? '0')) || 0;
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs rounded-xl bg-card border border-border/40 px-3 py-2">
                            <span className="font-medium text-foreground">{aName}</span>
                            <span className="font-mono font-bold text-primary">+{aPrice.toFixed(3)} {currency}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between pt-1 text-xs border-t border-border/40 font-semibold text-muted-foreground">
                      <span>Addons Subtotal:</span>
                      <span className="font-mono text-foreground font-bold">{addonsPrice.toFixed(3)} {currency}</span>
                    </div>
                  </div>
                ) : addonsDuration > 0 ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Addons Duration</span>
                    <span className="font-bold text-primary">+{addonsDuration} min</span>
                  </div>
                ) : null}

                {extraMinutes > 0 && (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-bold text-foreground">Extra Minutes Included</p>
                        <p className="text-[11px] text-muted-foreground">+{extraMinutes} minutes added to appointment</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                        +{extraPrice.toFixed(3)} {currency}
                      </span>
                    </div>
                  </div>
                )}

                {/* Date & Time + Duration Breakdown (Service + Addons + Extra) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={Calendar} label="Date">{formatDate(booking.appointment_start)}</DRow>
                  <DRow icon={Clock} label="Time & Duration">
                    <p>{formatTime(booking.appointment_start)} – {formatTime(booking.appointment_end)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        Total: {totalDuration} min
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({serviceDuration}m{addonsDuration > 0 ? ` + ${addonsDuration}m addons` : ''}{extraMinutes > 0 ? ` + ${extraMinutes}m extra` : ''})
                      </span>
                    </div>
                  </DRow>
                </div>

                {/* Branch and Arrangement / Room in one row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={MapPin} label="Branch">{booking.branch_name || '—'}</DRow>
                  <DRow icon={Home} label="Arrangement / Room">{booking.arrangement_name || '—'}</DRow>
                </div>

                {/* Therapist */}
                <DRow icon={User} label="Therapist">{booking.therapist_name || '—'}</DRow>

                {/* Pricing Summary (Sum of all items: Service + Addons + Extra Minutes) */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 p-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Pricing &amp; Total Amount
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Base Service:</span>
                      <span className="font-mono font-semibold text-foreground">{servicePrice.toFixed(3)} {currency}</span>
                    </div>
                    {addonsPrice > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Addons ({addons.length}):</span>
                        <span className="font-mono font-semibold text-foreground">+{addonsPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    {extraMinutes > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Extra Minutes (+{extraMinutes} min):</span>
                        <span className="font-mono font-semibold text-foreground">+{extraPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 flex justify-between items-baseline">
                      <span className="font-bold text-foreground">Total Amount:</span>
                      <span className="text-base font-extrabold text-primary font-mono">
                        {computedTotal.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── TAB 2: PAYMENT & INVOICES ── */}

                {/* 1. Official Invoice Card */}
                <div className={cn(
                  'rounded-2xl border p-5 sm:p-6 transition shadow-xs space-y-4',
                  isCompleted
                    ? 'border-[#B8A394] bg-white/40'
                    : 'border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 via-card to-card dark:from-violet-950/20'
                )}>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice number</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setShowInvoiceModal(true)}
                            className="group/inv inline-flex items-center gap-1.5 text-sm font-mono font-extrabold text-foreground hover:text-violet-600 dark:hover:text-violet-400 transition cursor-pointer text-left"
                            title="Click to view full invoice details"
                          >
                            <span className="underline underline-offset-4 decoration-violet-400/60 group-hover/inv:decoration-violet-600">
                              {invoiceNumber || 'Pending Generation'}
                            </span>
                            <Eye className="h-3.5 w-3.5 text-violet-500 opacity-75 group-hover/inv:opacity-100 shrink-0" />
                          </button>
                          {Boolean(invoiceNumber) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(invoiceNumber);
                                  setCopiedType('invoice');
                                  setTimeout(() => setCopiedType(null), 2000);
                                }}
                                className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                                title="Copy invoice number"
                              >
                                {copiedType === 'invoice' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <Link
                                href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber)}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline px-1.5 py-0.5 rounded hover:bg-violet-500/10 transition"
                                title="Open invoice link"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Link</span>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => setShowInvoiceModal(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20 transition cursor-pointer"
                        title="Open invoice details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Invoice</span>
                      </button>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                        (booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid')
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                      )}>
                        {booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {(booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid') ? 'PAID' : 'DRAFT'}
                      </span>
                      {Boolean(invoiceNumber) && (
                        <Link
                          href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber)}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline px-2 py-1 rounded-lg hover:bg-muted/40 transition"
                        >
                          <span>Accounting</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Invoice details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-border/40 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Billed To</p>
                      <p className="font-bold truncate mt-0.5">{booking.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Issue Date</p>
                      <p className="font-medium mt-0.5">{formatDate(booking.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Amount</p>
                      <p className="font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
                        {computedTotal.toFixed(3)} {currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Balance Due</p>
                      <p className="font-bold mt-0.5 text-foreground">
                        {(booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid')
                          ? `0.000 ${currency}`
                          : `${computedTotal.toFixed(3)} ${currency}`}
                      </p>
                    </div>
                  </div>

                  {/* Itemized breakdown in invoice */}
                  <div className="pt-1 space-y-2 pb-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{booking.service_name}</span>
                      <span className="font-semibold">{servicePrice.toFixed(3)} {currency}</span>
                    </div>
                    {addons.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>+ Add-on: {String(a.name ?? a.addon_name ?? `Addon #${i + 1}`)}</span>
                        <span>+{parseFloat(String(a.price ?? a.base_price ?? '0')).toFixed(3)} {currency}</span>
                      </div>
                    ))}
                    {extraPrice > 0 && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>+ Extra Minutes (+{extraMinutes}m)</span>
                        <span>+{extraPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Payment Transaction & Gateway Details */}
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" /> Transaction &amp; Gateway Details
                    </p>
                    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize', paymentStyle(booking.payment_status))}>
                      {booking.payment_status || 'unpaid'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Provider / Gateway</p>
                      <p className="font-semibold text-foreground mt-0.5">{paymentProvider}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Payment Method</p>
                      <p className="font-semibold text-foreground mt-0.5 capitalize">{booking.payment_method || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Channel / Source</p>
                      <p className="font-semibold text-foreground mt-0.5 uppercase font-mono">{String(detail?.payment_through ?? (booking.raw as any)?.payment_through ?? 'ushdesk')}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Amount</p>
                      <p className="font-bold text-primary mt-0.5 font-mono">{computedTotal.toFixed(3)} {currency}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-medium">Transaction / Ref ID</p>
                        {Boolean(transactionId) && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(transactionId);
                              setCopiedType('txn');
                              setTimeout(() => setCopiedType(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            {copiedType === 'txn' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                        {transactionId || 'Auto-generated upon settlement'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-medium">Trace / Auth Code</p>
                        {Boolean(traceId) && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(traceId);
                              setCopiedType('trace');
                              setTimeout(() => setCopiedType(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            {copiedType === 'trace' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                        {traceId || '—'}
                      </p>
                    </div>
                  </div>

                  {Boolean(paidTimestamp) && (
                    <div className="rounded-xl bg-card border border-border/40 px-3 py-2 text-xs flex items-center justify-between text-muted-foreground">
                      <span>Paid Timestamp:</span>
                      <span className="font-medium text-foreground">{formatPaidTimestamp(String(paidTimestamp))}</span>
                    </div>
                  )}
                </div>

                {/* 3 & 4. Scanned Receipt Slip & Customer Payment Link in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Scanned Receipt / Slip */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Scanned Receipt / Slip
                        </h4>
                      </div>
                      {Boolean(receiptImg) && (
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Full Slip
                        </button>
                      )}
                    </div>

                    {Boolean(receiptImg) ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/70 p-3">
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted hover:opacity-90 transition cursor-zoom-in"
                        >
                          <img src={receiptImg} alt="Receipt slip" className="h-full w-full object-cover" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">Scanned Payment Receipt Attached</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Physical POS or bank voucher slip captured during booking check-in.</p>
                          <button
                            type="button"
                            onClick={() => setReceiptZoom(true)}
                            className="mt-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            Click to expand receipt image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground flex-1">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>No physical receipt slip uploaded for this transaction. Digital ledger record attached.</span>
                      </div>
                    )}
                  </div>

                  {/* Customer Payment Link */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Customer Payment Link
                        </h4>
                      </div>
                      {Boolean(effectivePaymentUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(effectivePaymentUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          {copiedLink ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          {copiedLink ? 'Copied' : 'Copy Link'}
                        </button>
                      )}
                    </div>

                    {effectivePaymentUrl ? (
                      <div className="space-y-2 flex-1 flex flex-col justify-between">
                        <p className="font-mono text-xs text-muted-foreground break-all bg-card/70 p-2 rounded-lg border border-border/40 select-all">
                          {effectivePaymentUrl}
                        </p>
                        <a
                          href={effectivePaymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-primary py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open Payment Link
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground flex-1">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>No customer payment link generated for this booking.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5 & 6. Created By User & Status History in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Created By User Info */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 flex flex-col">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> Created By User
                    </p>
                    {createdByUserName || createdByUserObj ? (
                      <div className="rounded-xl bg-card border border-border/50 p-3 space-y-1.5 text-xs flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground text-sm">
                            {createdByUserName || (createdByUserObj?.email ? String(createdByUserObj.email).split('@')[0] : 'System')}
                          </span>
                          {Boolean(createdByUserObj?.role) && (
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold capitalize">
                              {String(createdByUserObj?.role)}
                            </span>
                          )}
                        </div>
                        {Boolean(createdByUserObj?.email) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Email:</span> {String(createdByUserObj?.email)}
                          </p>
                        )}
                        {Boolean(createdByUserObj?.phone_number) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Phone:</span> {String(createdByUserObj?.phone_number)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3 text-xs text-muted-foreground flex-1 flex items-center">
                        <p className="italic">No creator user information available.</p>
                      </div>
                    )}
                  </div>

                  {/* Status History */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-primary" /> Status History
                      </p>
                      {loadingDetail && <span className="text-[10px] text-muted-foreground animate-pulse">Updating...</span>}
                    </div>
                    {historyList.length > 0 ? (
                      <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60 flex-1">
                        {historyList.map((item, idx) => {
                          const changeByData = (item.change_by_user_data && typeof item.change_by_user_data === 'object')
                            ? (item.change_by_user_data as Record<string, unknown>)
                            : null;
                          const changerFromData = changeByData
                            ? ((changeByData.full_name as string) ||
                               [changeByData.first_name, changeByData.last_name].filter(Boolean).join(' ') ||
                               (changeByData.name as string) ||
                               (changeByData.username as string) ||
                               (changeByData.email as string) ||
                               (changeByData.phone_number as string))
                            : null;
                          const changerRaw = (
                            changerFromData ||
                            (typeof item.change_by_user === 'string' &&
                             !/^[0-9a-f-]{10,}$/i.test(item.change_by_user) &&
                             item.change_by_user !== 'undefined' &&
                             item.change_by_user !== 'null'
                              ? item.change_by_user
                              : '') ||
                            (item.source === 'ushdesk' && user?.name ? user.name : '') ||
                            (item.source === 'ushspa' && booking.customer_name ? booking.customer_name : '') ||
                            (item.source && item.source !== 'undefined' ? String(item.source) : '') ||
                            'Staff'
                          ).trim();
                          const changer = changerRaw || 'Staff';
                          return (
                            <div key={idx} className="relative text-xs space-y-1">
                              <div className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-card" />
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {item.old_status ? `${String(item.old_status)} → ` : ''}
                                  <span className="capitalize">{String(item.new_status)}</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground">· {formatDateTime(String(item.created_at))}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Changed by: <span className="font-medium text-foreground">{changer}</span>
                                {Boolean(item.source) && <span className="ml-1 text-[10px] text-muted-foreground/80">({String(item.source)})</span>}
                              </p>
                              {Boolean(item.reason) && (
                                <p className="text-[11px] text-muted-foreground bg-card p-1.5 rounded-lg border border-border/40 italic">
                                  &ldquo;{String(item.reason)}&rdquo;
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3 text-xs space-y-1 flex-1 flex flex-col justify-center">
                        <p className="font-medium text-foreground">Initial status: <span className="capitalize font-bold">{booking.status}</span></p>
                        <p className="text-[11px] text-muted-foreground">Recorded at: {formatDateTime(booking.created_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {(cancelError || completeError) && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                {cancelError || completeError}
              </div>
            )}
          </div>

          {/* Footer — up to 4 buttons when payment pending */}
          <div className={cn(
            'shrink-0 border-t px-6 py-4 flex flex-col gap-2.5',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
          )}>
            {booking.status !== 'cancelled' && !isCompleted && (callCenterCancelBlocked || callCenterRescheduleBlocked) && AGENT_BLOCK_REASON && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{AGENT_BLOCK_REASON}</span>
              </div>
            )}
            {!effectiveCanCancel && !callCenterCancelBlocked && booking.status !== 'cancelled' && !isCompleted && cancellationEligibility.reason && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{cancellationEligibility.reason}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              {/* Left side: Cancel & Reschedule */}
              <div className="flex items-center gap-2">
                {booking.status !== 'cancelled' && !isCompleted && (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={!effectiveCanCancel}
                      title={
                        callCenterCancelBlocked
                          ? (AGENT_BLOCK_REASON ?? undefined)
                          : !canCancel
                          ? (cancellationEligibility.reason ?? undefined)
                          : undefined
                      }
                      className={cn(
                        'rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap',
                        !effectiveCanCancel
                          ? 'border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                          : 'border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer'
                      )}
                    >
                      Cancel Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => canReschedule && setShowRescheduleModal(true)}
                      disabled={!canReschedule}
                      title={!canReschedule ? (AGENT_BLOCK_REASON ?? undefined) : undefined}
                      className={cn(
                        'rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap',
                        !canReschedule
                          ? 'border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                          : 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer'
                      )}
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteBooking}
                      disabled={completing}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer active:scale-[0.98] whitespace-nowrap disabled:opacity-60"
                    >
                      {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {completing ? 'Completing…' : 'Mark Completed'}
                    </button>
                  </>
                )}
              </div>

              {/* Right side: Payment Done, Open Payment, Close */}
              <div className="flex items-center gap-2">
                {/* Make Payment — shown only when payment is pending */}
                {isPaymentPending && (
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer whitespace-nowrap"
                  >
                    <CreditCard className="h-4 w-4" />
                    Make Payment
                  </button>
                )}
                {effectivePaymentUrl && (
                  <a href={effectivePaymentUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer whitespace-nowrap">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Payment
                  </a>
                )}
                {(() => {
                  const rawPaymentStatus = String(detail?.payment_status ?? (detail as any)?.paymentStatus ?? booking.payment_status ?? '').toLowerCase().trim();
                  const isConfirmedAndPaid = curStatus === 'confirmed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
                  const isCompletedAndPaid = curStatus === 'completed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
                  const showPrintReceiptBtn = isConfirmedAndPaid || isCompletedAndPaid;
                  if (!showPrintReceiptBtn) return null;
                  return (
                    <button
                      type="button"
                      onClick={handlePrintReceipt}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer whitespace-nowrap',
                        isCompleted
                          ? 'bg-[#3D2F27] hover:bg-[#281E18] text-white'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white'
                      )}
                    >
                      <Printer className="h-4 w-4" />
                      Print Receipt
                    </button>
                  );
                })()}
                <button
                  onClick={onClose}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap',
                    isCompleted
                      ? 'border border-[#B8A394] bg-white/40 hover:bg-white/60 text-[#2D241E]'
                      : 'border border-border/60 bg-muted/40 hover:bg-muted text-foreground'
                  )}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Booking Modal */}
      {showRescheduleModal && booking && (
        <RescheduleBookingModal
          bookingId={booking.id}
          initialBooking={(detail || booking) as unknown as Record<string, any>}
          onClose={() => setShowRescheduleModal(false)}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      )}

      {/* Booking Receipt Modal Preview & Print */}
      {showReceiptModal && (
        <BookingReceiptModal
          data={{
            bookingNumber: booking.booking_number,
            reference: booking.booking_number || booking.id,
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            customerEmail: booking.customer_email,
            branchName: booking.branch_name,
            arrangementName: booking.arrangement_name,
            therapistName: booking.therapist_name,
            serviceName: booking.service_name,
            serviceCategory: booking.service_category,
            servicePrice: servicePrice,
            appointmentStart: booking.appointment_start,
            appointmentEnd: booking.appointment_end,
            appointmentDate: formatDate(booking.appointment_start),
            timeSlot: `${formatTime(booking.appointment_start)} – ${formatTime(booking.appointment_end)}`,
            totalDuration: totalDuration,
            serviceDuration: serviceDuration,
            addonsDuration: addonsDuration,
            extraMinutes: extraMinutes,
            extraPrice: extraPrice,
            addons: addons.map((a, idx) => ({
              name: String(a.name ?? a.addon_name ?? `Addon #${idx + 1}`),
              price: parseFloat(String(a.price ?? a.base_price ?? '0')) || 0,
              duration: Number(a.duration_minutes ?? a.duration ?? 0),
            })),
            currency: currency,
            totalAmount: computedTotal,
            status: 'completed',
            paymentStatus: String(detail?.payment_status ?? booking.payment_status ?? 'success'),
            paymentMethod: booking.payment_method || booking.payment_provider || 'Desk Payment',
            paymentProvider: booking.payment_provider || booking.payment_gateway,
            transactionId: String(paymentDataObj?.transaction_id ?? ''),
            referenceId: String(paymentDataObj?.reference_id ?? ''),
            paidAt: String(paymentDataObj?.paid_at ?? ''),
          }}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* ── Scanned Receipt Slip Zoom Modal ── */}
      {receiptZoom && Boolean(receiptImg) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setReceiptZoom(false)} />
          <div className="relative z-10 max-w-2xl w-full max-h-[85vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Scanned Receipt Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptZoom(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 dark:bg-black/40">
              <img
                src={receiptImg}
                alt="Receipt slip full view"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-border/40"
              />
            </div>
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Invoice Reference: <strong className="font-mono text-foreground">{invoiceNumber || 'Attached'}</strong></p>
              <a
                href={receiptImg}
                download="booking-receipt-slip"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal Popup ── */}
      {showInvoiceModal && (
        <InvoiceDetailModal
          invoiceNumber={invoiceNumber || (invoiceRecord?.name as string) || ''}
          invoiceRecord={invoiceRecord}
          bookingData={{
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            customerEmail: booking.customer_email,
            serviceName: booking.service_name,
            serviceCategory: booking.service_category,
            servicePrice: servicePrice,
            addons: addons as any,
            extraMinutes: extraMinutes,
            extraPrice: extraPrice,
            totalPrice: computedTotal,
            currency: currency,
            paymentMethod: booking.payment_method,
            paymentProvider: paymentProvider,
            paymentThrough: String(detail?.payment_through ?? (booking.raw as any)?.payment_through ?? 'ushdesk'),
            paymentDate: String(paymentDataObj?.paid_at ?? booking.created_at ?? ''),
            transactionId: transactionId || undefined,
            traceId: traceId || undefined,
            bookingNumber: booking.booking_number,
            branchName: booking.branch_name,
            status: curStatus || booking.status,
            pricing: pricingObj,
          }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* ── Booking Cancellation Modal (with refund/accounting) ── */}
      {showCancellationModal && booking && (
        <BookingCancellationModal
          bookingId={booking.id}
          bookingNumber={booking.booking_number || null}
          invoiceNumber={invoiceNumber || null}
          isPaid={
            booking.is_paid ||
            booking.payment_status === 'success' ||
            booking.payment_status === 'paid' ||
            booking.payment_status === 'completed'
          }
          totalAmount={computedTotal}
          totalDuration={totalDuration}
          currency={currency}
          paymentMethod={paymentProvider !== 'Front Desk' ? paymentProvider : null}
          customerId={
            String(
              (detail as any)?.customer_id ??
              (booking.raw as any)?.customer_id ??
              (booking as any).customer_id ??
              ''
            ).trim() || undefined
          }
          customerData={
            (detail as any)?.customer_data ??
            (booking.raw as any)?.customer_data ??
            null
          }
          bookingType={
            String(
              (detail as any)?.booking_type ??
              (booking.raw as any)?.booking_type ??
              booking.booking_type ??
              ''
            ).trim() || undefined
          }
          onClose={() => setShowCancellationModal(false)}
          onSuccess={() => {
            setShowCancellationModal(false);
            onSuccess?.();
            onClose();
          }}
        />
      )}
    </>
  );
}

