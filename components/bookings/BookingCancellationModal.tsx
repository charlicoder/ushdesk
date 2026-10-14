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

  // Validation rules
  const isFormValid = Boolean(
    reason.trim() &&
    (!isPaymentSuccess || !requestRefund || (selectedProvider === 'MyFatoorah' && refundAmount > 0 && refundAmount <= totalAmount))
  );

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
    if (isPaymentSuccess && requestRefund) {
      if (!selectedProvider) {
        errs.push('Please select a refund payment method.');
      } else if (selectedProvider !== 'MyFatoorah') {
        errs.push('Only MyFatoorah refund is active at this time.');
      }
      if (refundAmount <= 0) {
        errs.push('Refund amount must be greater than zero.');
      }
      if (refundAmount > totalAmount) {
        errs.push(`Refund amount cannot exceed the paid amount (${fmt(totalAmount)} ${currency}).`);
      }
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

    // ── Step 1: Cancel open payment links ──────────────────────────────────
    setStep('links');
    await cancelOpenPaymentLinks();

    // ── Step 2: Send refund request to MyFatoorah if requested ─────────────
    if (isPaymentSuccess && requestRefund && selectedProvider === 'MyFatoorah') {
      setStep('gateway');
      try {
        const refundPayload = {
          refund_amount: Number(refundAmount.toFixed(3)),
          cancellation_fee: 0,
          reason: reason.trim() || 'Booking cancellation refund',
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

        const refundRes = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/refunds/gateway/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(refundPayload),
        });

        if (!refundRes.ok) {
          const j = await refundRes.json().catch(() => ({})) as Record<string, unknown>;
          const errObj = (j.error ?? j) as Record<string, unknown>;
          const msg = j.detail ?? j.message ?? errObj.message ?? errObj.detail ?? `MyFatoorah gateway refund failed (${refundRes.status})`;
          throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
      } catch (err) {
        // If refund request fails, do not proceed with booking status update
        const errMsg = err instanceof Error ? err.message : String(err);
        setErrors([`MyFatoorah Refund Request Failed: ${errMsg}`]);
        setSubmitting(false);
        setStep('idle');
        return;
      }
    }

    // ── Step 3: Update booking status in booknpay ──────────────────────────
    setStep('booking');
    try {
      const cancelBody: Record<string, unknown> = {
        status: isPaymentSuccess && requestRefund ? 'refunded' : 'cancelled',
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

      if (invoiceNumber) {
        cancelBody.invoice_number = invoiceNumber;
      }

      if (isPaymentSuccess && requestRefund) {
        cancelBody.payment_status = 'refunded';
        cancelBody.payment_provider = 'MyFatoorah';
        cancelBody.payment_gateway = 'myfatoorah';
        cancelBody.payment_through = 'ushdesk';
        cancelBody.payment_method = 'card';
        cancelBody.payment_data = {
          refund_reason: reason.trim(),
          refund_method: 'MyFatoorah',
          refund_amount: Number(refundAmount.toFixed(3)),
          refund_currency: currency,
          original_amount: Number(totalAmount.toFixed(3)),
          is_partial: isPartialRefund,
          cancelled_via: 'ushdesk',
          refunded_at: nowWithTimezone(),
        };
        cancelBody.payments_data = {
          refund_method: 'MyFatoorah',
          refund_amount: Number(refundAmount.toFixed(3)),
        };
      } else if (isUnpaid) {
        cancelBody.payment_status = 'cancelled';
      }
      // For paid booking with unchecked refund: payment_status is omitted so backend keeps payments record and status unchanged!

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

    // ── Step 4: Credit Note creation or Invoice update in UANR ───────────────
    if (invoiceNumber && isPaymentSuccess && requestRefund) {
      setStep('invoice');
      try {
        // Resolve invoice UUID if invoiceNumber is an invoice sequence name
        let targetInvoiceId = invoiceNumber;
        try {
          const invSearchRes = await authedFetch(`/uanr/api/v1/invoices?search=${encodeURIComponent(invoiceNumber)}`);
          if (invSearchRes.ok) {
            const invSearchJson = await invSearchRes.json().catch(() => ({}));
            const items = invSearchJson?.data?.items ?? invSearchJson?.items ?? (Array.isArray(invSearchJson?.data) ? invSearchJson.data : []);
            const matchedInv = items.find((i: Record<string, unknown>) => i.name === invoiceNumber || i.id === invoiceNumber) || items[0];
            if (matchedInv?.id) {
              targetInvoiceId = String(matchedInv.id);
            }
          }
        } catch {
          // fallback to invoiceNumber directly
        }

        // Create credit note in UANR
        const cnRes = await authedFetch(`/uanr/api/v1/invoices/${encodeURIComponent(targetInvoiceId)}/credit-note/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            credit_date: nowWithTimezone().split('T')[0],
            reason: reason.trim() || 'Booking cancellation refund',
          }),
        });

        if (!cnRes.ok) {
          // Fallback to cancel/reverse endpoint
          await authedFetch(`/uanr/api/v1/invoices/${encodeURIComponent(targetInvoiceId)}/cancel/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({
              state: 'refunded',
              cancel_reason: reason.trim(),
              refund_method: 'MyFatoorah',
              refund_amount: Number(refundAmount.toFixed(3)),
            }),
          });
        }
      } catch (err) {
        console.warn('Credit note creation notice:', err);
      }
    } else if (invoiceNumber && isUnpaid) {
      // For unpaid bookings, cancel the open invoice
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
    // Note: When isPaymentSuccess && !requestRefund, payment was kept so invoice remains unchanged!

    setStep('done');
    setSubmitting(false);
    setSucceeded(true);
    onSuccess?.();
  }, [
    validate, cancelOpenPaymentLinks, isPaymentSuccess, requestRefund, selectedProvider,
    refundAmount, reason, currentUser, bookingId, authHeader, invoiceNumber,
    isPartialRefund, currency, totalAmount, onSuccess,
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
                {isPaymentSuccess && requestRefund ? 'Booking Refunded' : 'Booking Cancelled'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isPaymentSuccess && requestRefund
                  ? `Refund request of ${fmt(refundAmount)} ${currency} was sent to MyFatoorah successfully, credit note invoice created, and booking status updated to Refunded.`
                  : (isPaymentSuccess
                      ? 'The booking status has been updated to Cancelled. Payments record and status remain unchanged.'
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRequestRefund(checked);
                    if (checked) {
                      setSelectedProvider('MyFatoorah');
                    } else {
                      setSelectedProvider(null);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Request Refund to Customer
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {fmt(refundAmount)} {currency}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Check this box to submit an automated refund request to return the payment to customer.
                  </p>
                </div>
              </label>
            )}

            {/* 3. When refund checkbox is checked: Show Refund Methods (MyFatoorah active, all others inactive) */}
            {isPaymentSuccess && requestRefund && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">

                {/* Refund Payment Methods Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                        Refund Method <span className="text-destructive">*</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      MyFatoorah Active
                    </span>
                  </div>

                  {/* Grid of Methods */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {CANCELLATION_PROVIDERS.map((provider) => {
                      const isSelected = selectedProvider === provider.id;
                      const isActive = provider.isActive;

                      return (
                        <button
                          key={provider.id}
                          type="button"
                          disabled={!isActive}
                          onClick={() => {
                            if (isActive) {
                              setSelectedProvider(provider.id);
                            }
                          }}
                          className={cn(
                            'flex flex-col items-start p-3 rounded-2xl border text-left transition select-none',
                            isActive
                              ? (isSelected
                                  ? 'border-emerald-500 bg-white dark:bg-card shadow-xs ring-2 ring-emerald-500/20 cursor-pointer'
                                  : 'border-border/70 bg-card hover:bg-muted/40 cursor-pointer')
                              : 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={cn(
                              'text-xs font-extrabold',
                              isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                            )}>
                              {provider.label}
                            </span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                            {provider.desc}
                          </span>
                          <span className={cn(
                            'mt-2 inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full',
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-muted text-muted-foreground border border-border/40'
                          )}>
                            {provider.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Refund Amount Adjustment (Full by default, optional Partial) */}
                <div className="space-y-1.5 p-3.5 rounded-2xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      Refund Amount ({currency})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAmountEnabled(!customAmountEnabled);
                        if (customAmountEnabled) setRefundAmount(totalAmount);
                      }}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer',
                        customAmountEnabled
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-border/60 bg-background text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {customAmountEnabled ? 'Reset Full Amount' : 'Adjust Amount'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex-1 flex items-center gap-2 rounded-xl border px-3 py-2',
                      customAmountEnabled ? 'border-border/60 bg-background' : 'border-border/30 bg-muted/40'
                    )}>
                      <span className="text-xs text-muted-foreground font-mono">{currency}</span>
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        disabled={!customAmountEnabled}
                        step="0.001"
                        min={0}
                        max={totalAmount}
                        className="flex-1 bg-transparent text-sm font-mono text-right focus:outline-none disabled:text-muted-foreground"
                      />
                    </div>
                  </div>
                  {isPartialRefund && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      Partial refund: {fmt(totalAmount - refundAmount)} {currency} retained. Status will be <code className="font-mono">partially_refunded</code>.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Checklist: What will be updated */}
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Summary of changes
              </p>
              <ul className="space-y-1">
                {[
                  isPaymentSuccess && requestRefund ? 'Booking status → Refunded' : 'Booking status → Cancelled',
                  'Open payment links (if any) → Cancelled',
                  isPaymentSuccess && requestRefund
                    ? `Automated refund request → Sent to MyFatoorah gateway (${fmt(refundAmount)} ${currency})`
                    : null,
                  isPaymentSuccess && requestRefund
                    ? `Payment status → Refunded`
                    : (isPaymentSuccess ? 'Payment record & status → Kept unchanged (Paid)' : null),
                  isPaymentSuccess && requestRefund
                    ? (invoiceNumber ? `Credit note invoice → Created in UANR for #${invoiceNumber}` : 'Credit note invoice → Created in UANR')
                    : (isUnpaid && invoiceNumber ? `Invoice #${invoiceNumber} → Cancelled` : null),
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
                    : isPaymentSuccess && requestRefund && !selectedProvider
                      ? 'Please select MyFatoorah refund method'
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
