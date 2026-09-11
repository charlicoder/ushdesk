'use client';

/**
 * BookingDetailModal
 * Fetches a booking by ID from /booknpay/api/v1/bookings/<id>/
 * and renders a rich detail popup. Used on both Therapist Schedule
 * and Branch Appointments pages.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  X, Loader2, AlertCircle, CheckCircle2, User, Scissors, MapPin,
  CalendarDays, Clock, Timer, Package, DollarSign, StickyNote,
  Hash, RefreshCw, CreditCard, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt(val: unknown): string {
  const n = parseFloat(String(val ?? '0'));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

function fmtDate(raw: string | undefined | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { bar: string; pill: string; dot: string }> = {
  scheduled:   { bar: 'from-violet-500 to-indigo-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500' },
  booking:     { bar: 'from-blue-500 to-sky-500',      pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',         dot: 'bg-blue-500' },
  pending:     { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500' },
  confirmed:   { bar: 'from-emerald-500 to-teal-400',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500' },
  in_progress: { bar: 'from-emerald-400 to-green-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  completed:   { bar: 'from-slate-400 to-slate-500',   pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',    dot: 'bg-slate-400' },
  cancelled:   { bar: 'from-rose-500 to-red-500',      pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',       dot: 'bg-rose-500' },
  no_show:     { bar: 'from-orange-500 to-amber-500',  pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-500' },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES['scheduled'];
}

// ── types ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface BookingDetailModalProps {
  /** The booking_id / id to fetch */
  bookingId: string;
  /** Bearer token for Authorization header */
  token: string;
  onClose: () => void;
}

// ── component ──────────────────────────────────────────────────────────────────

export function BookingDetailModal({ bookingId, token, onClose }: BookingDetailModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const [booking,          setBooking]          = useState<AnyRecord | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [paymentLoading,   setPaymentLoading]   = useState(false);
  const [paymentSuccess,   setPaymentSuccess]   = useState(false);
  const [paymentError,     setPaymentError]     = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch booking detail
  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true); setError(null);
    try {
      const res  = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}`, {
        headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      console.log('[BookingDetailModal] GET', res.status, json);
      if (!res.ok) {
        const detail = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? json.error ?? JSON.stringify(json);
        throw new Error(`${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      }
      // Handle both flat and wrapped responses
      setBooking((json.data ?? json) as AnyRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId, authHeader]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  // Create payment link
  const handlePaymentLink = async () => {
    setPaymentLoading(true); setPaymentError(null);
    try {
      const res  = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/status`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body:    JSON.stringify({ status: 'confirmed', payment_status: 'pending', reason: 'Payment Link Sent to Customer' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setPaymentSuccess(true);
      fetchBooking(); // Refresh to reflect new status
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ── derived values ──────────────────────────────────────────────────────────

  const bk        = booking;

  // Debug: log the raw booking shape so we can see exactly what the API returns
  if (bk) console.log('[BookingDetailModal] raw booking:', JSON.stringify(bk, null, 2));

  const status    = String(bk?.status ?? bk?.booking_status ?? 'scheduled').toLowerCase();
  const ss        = statusStyle(status);
  const ref       = String(
    bk?.bookings_id ?? bk?.booking_id ?? bk?.reference_number ??
    bk?.booking_number ?? bk?.reference ?? bk?.id ?? bookingId
  );

  // ── nested objects ────────────────────────────────────────────────
  const customerObj  = (bk?.customer_data ?? bk?.customer) as AnyRecord | undefined;
  const therapistObj = (bk?.therapist_data ?? bk?.therapist) as AnyRecord | undefined;
  const svcObj       = (bk?.service_data ?? bk?.service) as AnyRecord | undefined;
  const arrObj       = (bk?.service_arrangement_data ?? bk?.arrangement) as AnyRecord | undefined;
  const addons       = (bk?.selected_addons ?? bk?.addons ?? []) as AnyRecord[];
  const pricing      = (bk?.pricing_details ?? bk?.pricing) as AnyRecord | undefined;

  // ── helper: pick first non-empty string value ──────────────────────
  function firstTruthy(...vals: (string | null | undefined)[]): string {
    for (const v of vals) { if (v) return v; }
    return '\u2014';
  }

  // ── customer ────────────────────────────────────────────────────────
  const customerFL    = [customerObj?.first_name, customerObj?.last_name].filter(Boolean).join(' ');
  const customerName  = firstTruthy(customerObj?.customer_name, customerObj?.name, customerFL, bk?.customer_name, bk?.client_name);
  const customerPhone = firstTruthy(customerObj?.phone_number, customerObj?.phone, bk?.phone_number);
  const customerEmail = firstTruthy(customerObj?.email, bk?.email);

  // ── therapist ───────────────────────────────────────────────────────
  const therapistFL    = [therapistObj?.first_name, therapistObj?.last_name].filter(Boolean).join(' ');
  const therapistName  = firstTruthy(therapistObj?.therapist_name, therapistObj?.name, therapistFL, bk?.therapist_name);
  const therapistPhoto = therapistObj?.photo_url ?? therapistObj?.avatar ?? therapistObj?.profile_picture ?? null;

  // ── service ─────────────────────────────────────────────────────────
  const svcName     = firstTruthy(svcObj?.service_name, svcObj?.name, bk?.service_name);
  const svcCategory = firstTruthy(svcObj?.service_category, svcObj?.category, bk?.service_category);

  // ── branch ──────────────────────────────────────────────────────────
  const branchObj  = bk?.branch_data as AnyRecord | undefined;
  const branchName = firstTruthy(branchObj?.branch_name, branchObj?.name, bk?.branch_name);

  // ── arrangement ─────────────────────────────────────────────────────
  const arrName = firstTruthy(arrObj?.arrangement_name, arrObj?.name);
  const arrType = firstTruthy(arrObj?.arrangement_type);

  // ── date & time ─────────────────────────────────────────────────────
  const isoStart   = bk?.appointment_start ?? bk?.appointment_datetime ?? '';
  const isoDate    = isoStart ? isoStart.split('T')[0] : '';
  const isoTime    = isoStart ? new Date(isoStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  const dateRaw    = firstTruthy(bk?.date, bk?.booking_date, bk?.appointment_date, isoDate);
  const rawTimeSlot = firstTruthy(bk?.time_slot, bk?.displayTime, bk?.appointment_time, bk?.time, isoTime);

  // ── rest ────────────────────────────────────────────────────────────
  const durationVal = String(bk?.total_duration ?? bk?.duration_minutes ?? bk?.duration ?? '');
  const duration    = durationVal || '';
  const totalPrice  = pricing?.total_price ?? pricing?.total ?? bk?.total_price ?? bk?.price ?? '';
  const currency    = firstTruthy(bk?.currency, 'KWD');
  const notes       = firstTruthy(bk?.customer_notes, bk?.notes, bk?.customerMessage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Status accent bar */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r shrink-0', ss.bar)} />

        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-mono font-semibold text-muted-foreground truncate">{ref}</p>
            </div>
            <h2 className="text-base font-extrabold leading-tight">Booking Details</h2>
            {!loading && bk && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold', ss.pill)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', ss.dot)} />
                  {status.replace(/_/g, ' ')}
                </span>
                {bk?.payment_status && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-muted text-muted-foreground">
                    <CreditCard className="h-2.5 w-2.5" />
                    {String(bk.payment_status).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition"
            aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading booking details…</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <button onClick={fetchBooking}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Booking content */}
          {!loading && bk && (
            <>
              {/* ── Service & Arrangement ── */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40">
                {/* Service row */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10">
                    <Scissors className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                    <p className="text-sm font-bold truncate">{svcName}</p>
                    {svcCategory && <p className="text-[11px] text-muted-foreground">{svcCategory}</p>}
                  </div>
                  {totalPrice && (
                    <p className="shrink-0 text-sm font-extrabold text-violet-600 dark:text-violet-400">
                      {fmt(totalPrice)} <span className="text-[10px] font-semibold">{currency}</span>
                    </p>
                  )}
                </div>

                {/* Arrangement row */}
                {arrName && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: '#c9a96e18' }}>
                      <Building2 className="h-4 w-4" style={{ color: '#c9a96e' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Room / Arrangement</p>
                      <p className="text-sm font-semibold truncate">{arrName}</p>
                      {arrType && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                          {arrType.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Branch row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10">
                    <MapPin className="h-4 w-4 text-sky-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</p>
                    <p className="text-sm font-semibold truncate">{branchName}</p>
                  </div>
                </div>
              </div>

              {/* ── Date / Time / Duration ── */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: CalendarDays, label: 'Date',     value: fmtDate(dateRaw), color: 'text-violet-500' },
                  { icon: Clock,        label: 'Time',     value: rawTimeSlot || '—',  color: 'text-sky-500' },
                  { icon: Timer,        label: 'Duration', value: duration ? `${duration} min` : '—', color: 'text-indigo-500' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                    </div>
                    <p className="text-xs font-bold leading-tight">{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Therapist & Customer ── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Therapist */}
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-violet-400/30 shadow-sm">
                    {therapistPhoto
                      ? <img src={therapistPhoto} alt={therapistName} className="h-full w-full object-cover" />
                      : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-bold">
                          {therapistName.slice(0, 2).toUpperCase()}
                        </div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Therapist</p>
                    <p className="text-xs font-semibold truncate">{therapistName}</p>
                  </div>
                </div>

                {/* Customer */}
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 text-white text-sm font-bold shrink-0">
                    {customerName !== '—' ? customerName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                    <p className="text-xs font-semibold truncate">{customerName}</p>
                    {customerPhone && <p className="text-[10px] text-muted-foreground">{customerPhone}</p>}
                    {customerEmail && <p className="text-[10px] text-muted-foreground truncate">{customerEmail}</p>}
                  </div>
                </div>
              </div>

              {/* ── Add-ons ── */}
              {addons.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Package className="h-3.5 w-3.5 text-violet-400" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add-ons ({addons.length})</p>
                  </div>
                  <div className="space-y-1.5">
                    {addons.map((a: AnyRecord, i: number) => (
                      <div key={a.id ?? i} className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-foreground leading-tight">{a.name ?? '—'}</p>
                        {a.price && <p className="text-[11px] font-bold text-violet-500 shrink-0">+{fmt(a.price)} {currency}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pricing breakdown ── */}
              {pricing && (
                <div className="rounded-2xl border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <DollarSign className="h-3.5 w-3.5 text-violet-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Pricing</p>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Base price',  val: pricing.base_price  ?? pricing.base },
                      { label: 'Add-ons',     val: pricing.addons_price ?? pricing.addons },
                      { label: 'Extra time',  val: pricing.extra_time_price ?? pricing.extra_time },
                    ].filter(r => r.val && parseFloat(String(r.val)) > 0).map(r => (
                      <div key={r.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-semibold">{fmt(r.val)} {currency}</span>
                      </div>
                    ))}
                    <div className="border-t border-violet-200/60 dark:border-violet-700/40 mt-2 pt-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Total</span>
                      <span className="text-sm font-extrabold text-violet-700 dark:text-violet-300">
                        {fmt(pricing.total_price ?? pricing.total ?? totalPrice)} {currency}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              {notes && (
                <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                    <p className="text-xs text-foreground leading-relaxed">{notes}</p>
                  </div>
                </div>
              )}

              {/* ── Payment feedback ── */}
              {paymentSuccess && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Payment link sent — status updated to Confirmed / Pending payment.
                  </p>
                </div>
              )}
              {paymentError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{paymentError}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && bk && (
          <div className="shrink-0 flex gap-3 border-t border-border/40 px-6 py-4">
            <button onClick={onClose}
              className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
              Close
            </button>
            <button
              onClick={handlePaymentLink}
              disabled={paymentLoading || paymentSuccess}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition',
                paymentSuccess
                  ? 'bg-emerald-500 cursor-default'
                  : paymentLoading
                  ? 'bg-violet-400 cursor-wait'
                  : 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 active:scale-[0.98]',
              )}>
              {paymentLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />&nbsp;Sending…</>
                : paymentSuccess
                ? <><CheckCircle2 className="h-3.5 w-3.5" />&nbsp;Payment Link Sent</>
                : <><CreditCard className="h-3.5 w-3.5" />&nbsp;Create Payment Link</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
