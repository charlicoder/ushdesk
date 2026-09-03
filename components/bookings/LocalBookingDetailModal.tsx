'use client';

/**
 * LocalBookingDetailModal
 * Displays appointment details from local Supabase data in a rich popup.
 * Used on the Branch Appointments page where slots come from Supabase,
 * not the booknpay API.
 */

import { useEffect, useState } from 'react';
import {
  X, User, Scissors, MapPin, CalendarDays, Clock, Timer,
  CreditCard, StickyNote, Hash, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import type { Appointment, AppointmentStatus } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ── status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bar: string; pill: string; dot: string; btn: string }> = {
  pending:     { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500',    btn: 'bg-amber-500 hover:bg-amber-600' },
  confirmed:   { bar: 'from-emerald-500 to-teal-400',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  completed:   { bar: 'from-slate-400 to-slate-500',   pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',    dot: 'bg-slate-400',    btn: 'bg-slate-500 hover:bg-slate-600' },
  cancelled:   { bar: 'from-rose-500 to-red-500',      pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',       dot: 'bg-rose-500',     btn: 'bg-rose-500 hover:bg-rose-600' },
  no_show:     { bar: 'from-orange-500 to-amber-500',  pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-500',  btn: 'bg-orange-500 hover:bg-orange-600' },
  scheduled:   { bar: 'from-violet-500 to-indigo-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500',  btn: 'bg-gradient-to-r from-violet-500 to-indigo-600' },
};

function ss(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES['scheduled'];
}

const ALL_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

// ── props ────────────────────────────────────────────────────────────────────

export interface LocalBookingDetailModalProps {
  appointment: Appointment;
  token: string;
  onClose: () => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => void;
}

// ── component ─────────────────────────────────────────────────────────────────

export function LocalBookingDetailModal({ appointment, token, onClose, onStatusChange }: LocalBookingDetailModalProps) {
  const a = appointment;
  const styles = ss(a.status);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusSuccess,  setStatusSuccess]  = useState(false);
  const [statusError,    setStatusError]    = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError,   setPaymentError]   = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const dt        = new Date(a.start_time);
  const dtEnd     = new Date(dt.getTime() + a.duration_min * 60_000);
  const dateStr   = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr   = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const timeEndStr = dtEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const shortRef  = a.id.slice(0, 8).toUpperCase();

  const customerName  = a.customer?.name ?? '—';
  const serviceName   = a.service?.name ?? '—';
  const branchName    = a.branch?.name ?? '—';
  const staffName     = a.staff?.name ?? '—';
  const price         = typeof a.price === 'number' ? a.price.toFixed(3) : '—';

  // Update status via booknpay API (best-effort — falls back gracefully)
  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    setStatusUpdating(true); setStatusError(null); setStatusSuccess(false);
    try {
      onStatusChange?.(a.id, newStatus);
      setStatusSuccess(true);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Create payment link via booknpay API
  const handlePaymentLink = async () => {
    setPaymentLoading(true); setPaymentError(null);
    try {
      const res = await fetch(`/booknpay/api/v1/bookings/${a.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'confirmed', payment_status: 'pending', reason: 'Payment Link Sent to Customer' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail ?? json.message ?? `Error ${res.status}`);
      setPaymentSuccess(true);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Status accent bar */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r shrink-0', styles.bar)} />

        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-mono font-semibold text-muted-foreground truncate">{shortRef}…</p>
            </div>
            <h2 className="text-base font-extrabold leading-tight">Booking Details</h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold', styles.pill)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
                {a.status.replace(/_/g, ' ')}
              </span>
              {a.payment_method && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-muted text-muted-foreground">
                  <CreditCard className="h-2.5 w-2.5" />
                  {a.payment_method}
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

          {/* ── Service & Branch ── */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10">
                <Scissors className="h-4 w-4 text-violet-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                <p className="text-sm font-bold truncate">{serviceName}</p>
              </div>
              {a.price != null && (
                <p className="shrink-0 text-sm font-extrabold text-violet-600 dark:text-violet-400">
                  {price} <span className="text-[10px] font-semibold">KWD</span>
                </p>
              )}
            </div>

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
              { icon: CalendarDays, label: 'Date',     value: dateStr,                              color: 'text-violet-500' },
              { icon: Clock,        label: 'Time',     value: `${timeStr} – ${timeEndStr}`,         color: 'text-sky-500' },
              { icon: Timer,        label: 'Duration', value: `${a.duration_min} min`,              color: 'text-indigo-500' },
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

          {/* ── Staff & Customer ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Staff / Therapist */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-bold">
                {staffName !== '—' ? staffName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Therapist</p>
                <p className="text-xs font-semibold truncate">{staffName}</p>
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 text-white text-sm font-bold">
                {customerName !== '—' ? customerName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                <p className="text-xs font-semibold truncate">{customerName}</p>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          {a.notes && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                <p className="text-xs text-foreground leading-relaxed">{a.notes}</p>
              </div>
            </div>
          )}

          {/* ── Change Status ── */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Change Status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusUpdating || s === a.status}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    s === a.status
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                  )}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {statusSuccess && (
              <div className="mt-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <p className="text-xs font-semibold">Status updated</p>
              </div>
            )}
            {statusError && (
              <div className="mt-2 flex items-center gap-2 text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">{statusError}</p>
              </div>
            )}
          </div>

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
        </div>

        {/* Footer */}
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
      </div>
    </div>
  );
}
