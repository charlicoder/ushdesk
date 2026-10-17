'use client';

/**
 * BookingCancellationModal
 *
 * Cancellation flow for bookings:
 *  1. For a paid booking (payment_status=success), employees can cancel if at least 3 hours before appointment_start.
 *     - First asks for cancellation reason (required).
 *     - A checkbox asking for refund (unchecked by default).
 *     - When refund is checked, shows refund payment methods.
 *     - MyFatoorah is active and selectable (all other methods kept inactive for now).
 *     - Upon confirming cancellation with MyFatoorah refund:
 *         a. Cancels open payment links for the booking.
 *         b. Sends refund request to MyFatoorah gateway: POST /booknpay/api/v1/bookings/{id}/refunds/gateway/
 *         c. Updates booking status to cancelled with payment_status=refunded: PATCH /booknpay/api/v1/bookings/{id}/status/
 *         d. Updates/cancels invoice in UANR.
 *  2. For unpaid bookings (or cancellation without refund):
 *     - Asks for cancellation reason.
 *     - Cancels open payment links.
 *     - Updates booking status to cancelled (payment_status=cancelled).
 *     - Cancels invoice in UANR.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AlertCircle, Loader2, Ban, CreditCard, Banknote,
  DollarSign, CheckCircle2, Info, Wallet, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { nowWithTimezone } from '@/lib/datetime';
import { useAppSelector } from '@/store/hooks';
import { paymentLinksApi, type PaymentLink } from '@/lib/paymentLinks';

// ── Refund Provider Configurations ─────────────────────────────────────────────

export type RefundProviderOption = 'MyFatoorah' | 'KNET Card' | 'Deema' | 'Other' | 'no_refund';

export interface RefundProviderConfig {
  id: RefundProviderOption;
  label: string;
  badge: string;
  desc: string;
  isActive: boolean;
  booknpayMethod: string;
  booknpayGateway: string | null;
  booknpayProvider: string | null;
}

export const CANCELLATION_PROVIDERS: RefundProviderConfig[] = [
  {
    id: 'MyFatoorah',
    label: 'MyFatoorah',
    badge: 'Active',
    desc: 'Automated refund request to MyFatoorah gateway',
    isActive: true,
    booknpayMethod: 'card',
    booknpayGateway: 'myfatoorah',
    booknpayProvider: 'MyFatoorah',
  },
  {
    id: 'KNET Card',
    label: 'KNET Card',
    badge: 'Inactive',
    desc: 'In-branch card reversal (Currently inactive)',
    isActive: false,
    booknpayMethod: 'knet',
    booknpayGateway: 'KNET',
    booknpayProvider: 'KNET Card',
  },
  {
    id: 'Deema',
    label: 'Deema',
    badge: 'Inactive',
    desc: 'Installments reversal (Currently inactive)',
    isActive: false,
    booknpayMethod: 'card',
    booknpayGateway: 'Other',
    booknpayProvider: 'Deema',
  },
  {
    id: 'Other',
    label: 'Cash / Other',
    badge: 'Inactive',
    desc: 'Cash or manual transfer (Currently inactive)',
    isActive: false,
    booknpayMethod: 'cash',
    booknpayGateway: null,
    booknpayProvider: 'Other',
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BookingCancellationModalProps {
  bookingId: string;
  bookingNumber?: string | null;
  invoiceNumber?: string | null;
  isPaid: boolean;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  totalAmount: number;
  totalDuration?: number;
  currency?: string;
  customerId?: string | null;
  customerData?: Record<string, unknown> | null;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  bookingType?: string | null;
  paymentUrl?: string | null;
  token?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BookingCancellationModal({
  bookingId,
  bookingNumber,
  invoiceNumber,
  isPaid,
  bookingStatus,
  paymentStatus,
  totalAmount,
  totalDuration = 0,
  currency = 'KWD',
  customerId,
  customerData,
  customerName,
  customerPhone,
  paymentMethod,
  bookingType,
  paymentUrl,
  token,
  onClose,
  onSuccess,
}: BookingCancellationModalProps) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  // Normalized payment status
  const rawPaymentStatus = String(paymentStatus ?? '').toLowerCase().trim();
  const isPaymentSuccess =
    isPaid ||
    rawPaymentStatus === 'success' ||
    rawPaymentStatus === 'paid' ||
    rawPaymentStatus === 'completed';

  // Whether booking is unpaid / payment_pending
  const isUnpaid =
    !isPaymentSuccess ||
    bookingStatus === 'payment_pending' ||
    rawPaymentStatus === 'payment_pending' ||
    rawPaymentStatus === 'pending' ||
    rawPaymentStatus === 'unpaid';

  // Form states
  const [reason, setReason] = useState('');
  const [requestRefund, setRequestRefund] = useState(false); // Unchecked by default
  const [selectedProvider, setSelectedProvider] = useState<RefundProviderOption | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(totalAmount);
  const [customAmountEnabled, setCustomAmountEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'idle' | 'links' | 'gateway' | 'booking' | 'invoice' | 'done'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const fmt = (n: number) => n.toFixed(3);
  const isPartialRefund = customAmountEnabled && refundAmount < totalAmount;

  // Validation rules: cancellation reason is required
  const isFormValid = Boolean(reason.trim());

  const isConfirmDisabled = submitting || !isFormValid;

  // Cancel any open payment links for this booking
  const cancelOpenPaymentLinks = useCallback(async () => {
    try {
      const links = await paymentLinksApi.list('booking', bookingId).catch(() => []);
      const linkList: PaymentLink[] = Array.isArray(links) ? links : [];
      const openLinks = linkList.filter(
        (l) => (l.status === 'pending' || l.status === 'created' || l.status === 'unpaid') && !l.paid_at
      );
      for (const openLink of openLinks) {
        if (openLink?.id) {
          await paymentLinksApi.cancel(openLink.id).catch((e) => {
            console.warn('Could not cancel open payment link:', e);
          });
        }
      }
    } catch (e) {
      console.warn('Error checking/cancelling payment links:', e);
    }
  }, [bookingId]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!reason.trim()) {
      errs.push('Please enter a cancellation reason.');
    }
    return errs;
  };


  // Main Submit Handler
  const handleSubmit = useCallback(async () => {
    const validationErrors = validate();
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    const runErrors: string[] = [];

    // ── Step 1: Update booking status in booknpay (ushnotice will cancel open payment links) ──
    setStep('booking');
    try {
      const cancelBody: Record<string, unknown> = {
        status: 'cancelled',
        reason: reason.trim(),
        source: 'ushdesk',
        changed_by: currentUser?.name || currentUser?.id || 'Staff',
        change_by_user: currentUser?.id || currentUser?.name || 'Staff',
        change_by_user_data: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              full_name: currentUser.name,
              first_name: currentUser.name.split(' ')[0] || currentUser.name,
              last_name: currentUser.name.split(' ').slice(1).join(' ') || '',
              email: currentUser.email,
              phone_number: currentUser.phone_number,
              role: currentUser.user_type,
            }
          : undefined,
      };

      if (paymentUrl) {
        cancelBody.payment_url = paymentUrl;
      }

      if (invoiceNumber) {
        cancelBody.invoice_number = invoiceNumber;
      }

      if (isPaymentSuccess) {
        cancelBody.payment_status = requestRefund ? 'refund_requested' : 'success';
      } else if (isUnpaid) {
        cancelBody.payment_status = 'cancelled';
      }

      const r = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(cancelBody),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({})) as Record<string, unknown>;
        const errObj = (j.error ?? j) as Record<string, unknown>;
        const msg = j.detail ?? j.message ?? errObj.message ?? errObj.detail ?? `Booking status update failed (${r.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } catch (err) {
      runErrors.push(`Booking status update: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (runErrors.length) {
      setErrors(runErrors);
      setSubmitting(false);
      setStep('idle');
      return;
    }

    // ── Step 3: For unpaid bookings, cancel the open invoice in UANR ─────────
    if (invoiceNumber && isUnpaid) {
      setStep('invoice');
      try {
        await authedFetch(`/uanr/api/v1/invoices/${encodeURIComponent(invoiceNumber)}/cancel/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            state: 'cancelled',
            cancel_reason: reason.trim(),
          }),
        });
      } catch (err) {
        console.warn('Invoice cancellation notice for unpaid booking:', err);
      }
    }

    setStep('done');
    setSubmitting(false);
    setSucceeded(true);
    onSuccess?.();
  }, [
    validate, isPaymentSuccess, requestRefund, paymentUrl,
    reason, currentUser, bookingId, authHeader, invoiceNumber,
    isUnpaid, onSuccess,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={succeeded ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-rose-50 dark:bg-rose-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <Ban className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-900 dark:text-rose-100">Cancel Booking</h2>
              {bookingNumber && <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-0.5">#{bookingNumber}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/60 transition cursor-pointer"
          >
            <X className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* SUCCESS SCREEN                                                            */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {succeeded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                {isPaymentSuccess && requestRefund ? 'Booking Cancelled & Refund Requested' : 'Booking Cancelled'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isPaymentSuccess && requestRefund
                  ? `The booking has been cancelled and a refund request for ${fmt(totalAmount)} ${currency} has been submitted for management review (Money or Loyalty Points) under Booking → Refunds.`
                  : (isPaymentSuccess
                      ? 'The booking status has been updated to Cancelled. Payment and invoice records remain unchanged.'
                      : 'The booking status has been updated to Cancelled.')}
              </p>
            </div>
            {errors.length > 0 && (
              <div className="w-full rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Notice:
                </p>
                {errors.map((e, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400 leading-snug">{e}</p>)}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-7 py-2.5 transition cursor-pointer shadow-sm active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        ) : (
          /* ═════════════════════════════════════════════════════════════════════════ */
          /* FORM CONTENT                                                              */
          /* ═════════════════════════════════════════════════════════════════════════ */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Paid Booking Banner */}
            {isPaymentSuccess && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-bold">Paid Booking: </span>
                  Payment of <strong>{fmt(totalAmount)} {currency}</strong> was collected for this booking.
                </div>
              </div>
            )}

            {/* Unpaid Booking Banner */}
            {isUnpaid && (
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  This booking has not been paid or payment is pending. No refund will be issued.
                </div>
              </div>
            )}

            {/* 1. Cancellation Reason (Required) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-rose-500" />
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please enter reason for cancellation (e.g. Customer requested cancellation, therapist unavailable…)"
                rows={2}
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none transition"
              />
            </div>

            {/* 2. Checkbox: Ask for Refund (Unchecked by default) */}
            {isPaymentSuccess && (
              <div className="space-y-3">
                <label
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none',
                    requestRefund
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                      : 'border-border/70 bg-card hover:bg-muted/30'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={requestRefund}
                    onChange={(e) => setRequestRefund(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Request Refund to Customer
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {fmt(totalAmount)} {currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Check this box to submit a refund request for management review (Money or Loyalty Points).
                    </p>
                  </div>
                </label>

                {requestRefund && (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200 animate-in fade-in duration-150">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Send refund request for approval.</span>
                  </div>
                )}
              </div>
            )}

            {/* Checklist: What will be updated */}
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Summary of changes
              </p>
              <ul className="space-y-1">
                {[
                  'Booking status → Cancelled',
                  'Open payment links (if any) → Cancelled',
                  isPaymentSuccess && requestRefund
                    ? 'Payment status → Refund Requested'
                    : (isPaymentSuccess ? 'Payment status → Success (Kept unchanged)' : 'Payment status → Cancelled'),
                  isPaymentSuccess && requestRefund
                    ? `Refund request record → Created (Status: Requested for ${fmt(totalAmount)} ${currency})`
                    : (isPaymentSuccess ? 'Invoice & payment records → Kept unchanged' : null),
                  isUnpaid && invoiceNumber ? `Invoice #${invoiceNumber} → Cancelled` : null,
                  'Appointment slot released for re-booking',
                ].filter(Boolean).map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <span className="text-emerald-500 shrink-0 mt-px">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 space-y-1">
                {errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Footer Actions */}
        {!succeeded && (
          <div className="shrink-0 border-t border-border/40 px-6 py-4 flex items-center justify-between bg-muted/10">
            <div className="flex-1 mr-3">
              {submitting && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                  {step === 'links'   && 'Cancelling open payment links…'}
                  {step === 'gateway' && 'Sending refund request to MyFatoorah…'}
                  {step === 'booking' && 'Updating booking status…'}
                  {step === 'invoice' && 'Updating invoice in UANR…'}
                  {step === 'done'    && 'Finalizing…'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-border/60 bg-muted/40 hover:bg-muted px-4 py-2.5 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
              >
                Keep Booking
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isConfirmDisabled}
                title={
                  !reason.trim()
                    ? 'Please enter a cancellation reason'
                    : undefined
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs transition',
                  isConfirmDisabled
                    ? 'bg-muted text-muted-foreground/60 border border-border/60 cursor-not-allowed shadow-none'
                    : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-[0.98]'
                )}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                <span>
                  {submitting
                    ? 'Processing…'
                    : (isPaymentSuccess && requestRefund
                        ? 'Confirm Cancellation & Refund'
                        : 'Confirm Cancellation')}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
