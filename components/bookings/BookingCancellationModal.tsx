'use client';

/**
 * BookingCancellationModal
 *
 * Cancellation flow with full booknpay accounting:
 *
 *  Step 1 – PATCH /booknpay/api/v1/bookings/<id>/status/
 *             → status=cancelled, payment_status=refunded|cancelled
 *
 *  Step 2 – POST /booknpay/api/v1/payments/
 *             → Upserts the existing payment record for the booking
 *               setting status=refunded (or partially_refunded)
 *             Required: customer_id, total_amount, total_duration, currency
 *             All other fields optional.
 *             The backend deduplicates on booking_id — if a payment exists
 *             it updates status/method/reference fields in place.
 *
 *  Step 3 – POST /api/v1/invoices/<inv>/cancel/  (if invoice exists)
 *             → Marks invoice as refunded/cancelled in UANR accounting
 *
 * booknpay PaymentMethod enum: card | knet | cash | unknown
 * booknpay PaymentThrough enum: ushdesk | desk | ushspa | other
 * booknpay PaymentTransactionStatus: refunded | partially_refunded
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AlertCircle, Loader2, Ban, CreditCard, Banknote,
  Building2, RefreshCw, Hash, DollarSign, FileText,
  CheckCircle2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// ── Refund method definitions ──────────────────────────────────────────────────
// Maps UI choice → booknpay PaymentMethod enum value

interface RefundMethod {
  id: string;
  label: string;
  description: string;
  requiresRef: boolean;
  refPlaceholder: string;
  // booknpay enum values
  booknpayMethod: string;       // PaymentMethod: card | knet | cash | unknown
  booknpayGateway: string | null; // PaymentGateway: KNET | TAP | Other | null
  booknpayProvider: string | null; // PaymentProvider: KNET Card | DirectLink | Other | null
}

const REFUND_METHODS: RefundMethod[] = [
  {
    id: 'knet',
    label: 'KNET Reversal',
    description: 'Reverse charge via KNET network',
    requiresRef: true,
    refPlaceholder: 'KNET reversal ref. / trace ID',
    booknpayMethod: 'knet',
    booknpayGateway: 'KNET',
    booknpayProvider: 'KNET Card',
  },
  {
    id: 'credit_card',
    label: 'Credit Card Reversal',
    description: 'Reverse via Visa / Mastercard',
    requiresRef: true,
    refPlaceholder: 'Card reversal / auth code',
    booknpayMethod: 'card',
    booknpayGateway: 'Other',
    booknpayProvider: 'DirectLink',
  },
  {
    id: 'cash',
    label: 'Cash Refund',
    description: 'Return cash to customer at desk',
    requiresRef: false,
    refPlaceholder: 'Optional receipt / voucher number',
    booknpayMethod: 'cash',
    booknpayGateway: null,
    booknpayProvider: null,
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Wire refund to customer account',
    requiresRef: true,
    refPlaceholder: 'Bank transfer reference / IBAN confirmation',
    booknpayMethod: 'unknown',
    booknpayGateway: 'Other',
    booknpayProvider: 'Other',
  },
  {
    id: 'store_credit',
    label: 'Store Credit / Voucher',
    description: 'Issue credit voucher for future use',
    requiresRef: false,
    refPlaceholder: 'Voucher / credit note number',
    booknpayMethod: 'unknown',
    booknpayGateway: null,
    booknpayProvider: null,
  },
  {
    id: 'gateway',
    label: 'Payment Gateway',
    description: 'MyFatoorah / online gateway reversal',
    requiresRef: true,
    refPlaceholder: 'Gateway reversal / transaction ID',
    booknpayMethod: 'card',
    booknpayGateway: 'Other',
    booknpayProvider: 'MyFatoorah',
  },
  {
    id: 'no_refund',
    label: 'No Refund',
    description: 'Cancellation without monetary refund',
    requiresRef: false,
    refPlaceholder: '',
    booknpayMethod: 'unknown',
    booknpayGateway: null,
    booknpayProvider: null,
  },
];

// ── Icons per method id ────────────────────────────────────────────────────────
const METHOD_ICONS: Record<string, React.ReactNode> = {
  knet:          <CreditCard className="h-4 w-4" />,
  credit_card:   <CreditCard className="h-4 w-4" />,
  cash:          <Banknote className="h-4 w-4" />,
  bank_transfer: <Building2 className="h-4 w-4" />,
  store_credit:  <FileText className="h-4 w-4" />,
  gateway:       <RefreshCw className="h-4 w-4" />,
  no_refund:     <Ban className="h-4 w-4" />,
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BookingCancellationModalProps {
  bookingId: string;
  bookingNumber?: string | null;
  invoiceNumber?: string | null;
  isPaid: boolean;
  totalAmount: number;
  totalDuration?: number;       // minutes — required by booknpay (defaults to 0)
  currency?: string;
  customerId?: string | null;   // required by booknpay POST /payments/
  customerData?: Record<string, unknown> | null;
  paymentMethod?: string | null; // original payment method (hint for refund method)
  bookingType?: string | null;   // branch_service | home_service
  token?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function suggestRefundMethod(pm: string): string {
  const p = pm.toLowerCase();
  if (p.includes('knet'))                                                    return 'knet';
  if (p.includes('visa') || p.includes('master') || p.includes('credit'))   return 'credit_card';
  if (p.includes('cash'))                                                    return 'cash';
  if (p.includes('bank') || p.includes('wire') || p.includes('transfer'))   return 'bank_transfer';
  if (p.includes('gateway') || p.includes('myfatoorah') || p.includes('online')) return 'gateway';
  if (p.includes('voucher') || p.includes('credit note'))                   return 'store_credit';
  return 'cash';
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BookingCancellationModal({
  bookingId,
  bookingNumber,
  invoiceNumber,
  isPaid,
  totalAmount,
  totalDuration = 0,
  currency = 'KWD',
  customerId,
  customerData,
  paymentMethod,
  bookingType,
  token,
  onClose,
  onSuccess,
}: BookingCancellationModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const [reason, setReason] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>(
    !isPaid ? 'no_refund' : suggestRefundMethod(paymentMethod ?? '')
  );
  const [refundRef, setRefundRef] = useState('');
  const [refundAmount, setRefundAmount] = useState<number>(totalAmount);
  const [customAmountEnabled, setCustomAmountEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'idle' | 'booking' | 'payment' | 'invoice' | 'done'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const method = REFUND_METHODS.find((m) => m.id === selectedMethod) ?? REFUND_METHODS[0];
  const fmt = (n: number) => n.toFixed(3);
  const isPartialRefund = customAmountEnabled && refundAmount < totalAmount;

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!reason.trim()) errs.push('Please enter a cancellation reason.');
    if (isPaid && method.requiresRef && !refundRef.trim()) {
      errs.push(`A ${method.label} reference number is required.`);
    }
    if (isPaid && refundAmount < 0) errs.push('Refund amount cannot be negative.');
    if (isPaid && refundAmount > totalAmount) {
      errs.push(`Refund amount cannot exceed the paid amount (${fmt(totalAmount)} ${currency}).`);
    }
    return errs;
  };

  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    const runErrors: string[] = [];

    // ── Step 1: Cancel booking ─────────────────────────────────────────────
    setStep('booking');
    try {
      const cancelBody: Record<string, unknown> = {
        status:         'cancelled',
        payment_status: isPaid ? 'refunded' : 'cancelled',
        reason:         reason.trim(),
        cancel_reason:  reason.trim(),
        source:         'ushdesk',
      };
      if (isPaid && selectedMethod !== 'no_refund') {
        cancelBody.refund_method    = selectedMethod;
        cancelBody.refund_reference = refundRef.trim() || null;
        cancelBody.refund_amount    = refundAmount;
        cancelBody.refund_currency  = currency;
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
        const msg = j.detail ?? j.message ?? j.error ?? `Booking cancel failed (${r.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } catch (err) {
      runErrors.push(`Booking cancellation: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Stop if booking cancel failed — no orphaned finance records
    if (runErrors.length) {
      setErrors(runErrors);
      setSubmitting(false);
      setStep('idle');
      return;
    }

    // ── Step 2: Upsert refund payment in booknpay ──────────────────────────
    if (isPaid && selectedMethod !== 'no_refund') {
      setStep('payment');
      try {
        /**
         * POST /booknpay/api/v1/payments/
         * Required: customer_id, total_amount, total_duration, currency
         * The backend deduplicates on booking_id — if a payment already
         * exists it updates status, payment_method, reference_id fields.
         * We pass status=refunded (or partially_refunded) so the record
         * reflects the cancellation.
         *
         * payment_through=ushdesk  → this refund was processed at the desk
         * reference_id             → KNET/bank ref or slip number
         * transaction_id           → gateway transaction ID
         */
        const refStatus = isPartialRefund ? 'partially_refunded' : 'refunded';

        const paymentBody: Record<string, unknown> = {
          // ── Required fields ──
          customer_id:    customerId ?? 'unknown',
          total_amount:   refundAmount.toFixed(3),
          total_duration: totalDuration || 0,
          currency:       currency,

          // ── Association ──
          booking_id:     bookingId,
          invoice_id:     invoiceNumber ?? null,
          invoice_value:  refundAmount.toFixed(3),

          // ── Payment classification (booknpay enums) ──
          status:          refStatus,
          payment_method:  method.booknpayMethod,
          payment_through: 'ushdesk',
          ...(method.booknpayProvider && { payment_provider: method.booknpayProvider }),
          ...(method.booknpayGateway  && { payment_gateway:  method.booknpayGateway  }),

          // Purpose
          payment_for: (bookingType === 'home_service' || bookingType === 'home')
            ? 'home_service'
            : 'branch_service',

          // ── Reference identifiers ──
          // reference_id → KNET/bank slip; transaction_id → gateway tx
          ...(refundRef.trim() && {
            reference_id:   refundRef.trim(),
            transaction_id: refundRef.trim(),
          }),

          // ── Extra context ──
          customer_data: customerData ?? null,
          payment_data: {
            refund_reason:     reason.trim(),
            refund_method:     method.label,
            original_amount:   totalAmount.toFixed(3),
            refunded_amount:   refundAmount.toFixed(3),
            booking_number:    bookingNumber ?? bookingId,
            cancelled_via:     'ushdesk',
          },
        };

        const r = await authedFetch('/booknpay/api/v1/payments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(paymentBody),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({})) as Record<string, unknown>;
          const errObj = (j.error ?? j) as Record<string, unknown>;
          const msg = errObj.message ?? errObj.detail ?? `Payment refund record failed (${r.status})`;
          runErrors.push(`Refund payment record: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        }
      } catch (err) {
        runErrors.push(`Refund payment record: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Step 3: Update UANR invoice ────────────────────────────────────────
    if (invoiceNumber) {
      setStep('invoice');
      try {
        const invBody: Record<string, unknown> = {
          state:         isPaid ? 'refunded' : 'cancelled',
          cancel_reason: reason.trim(),
          refund_method: isPaid ? selectedMethod : null,
          refund_ref:    isPaid ? (refundRef.trim() || null) : null,
          refund_amount: isPaid ? refundAmount : 0,
        };
        // Try dedicated cancel endpoint; fall back to PATCH state
        const r = await authedFetch(`/api/v1/invoices/${encodeURIComponent(invoiceNumber)}/cancel/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(invBody),
        });
        if (!r.ok) {
          const patch = await authedFetch(`/api/v1/invoices/${encodeURIComponent(invoiceNumber)}/`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({ state: isPaid ? 'refunded' : 'cancel', cancel_reason: reason.trim() }),
          });
          if (!patch.ok) {
            const j = await patch.json().catch(() => ({})) as Record<string, unknown>;
            const msg = j.detail ?? j.message ?? `Invoice update failed (${patch.status})`;
            runErrors.push(`Invoice update: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
          }
        }
      } catch (err) {
        runErrors.push(`Invoice update: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    setStep('done');
    setSubmitting(false);
    if (runErrors.length) {
      setErrors(runErrors.map((e) => `⚠ ${e}`));
    }
    setSucceeded(true);
    onSuccess?.();
  }, [
    bookingId, bookingNumber, invoiceNumber, isPaid, selectedMethod,
    refundRef, refundAmount, reason, currency, totalDuration,
    customerId, customerData, bookingType, authHeader, onSuccess, isPartialRefund,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={succeeded ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
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
          <button type="button" onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/60 transition cursor-pointer">
            <X className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </button>
        </div>

        {/* Success screen */}
        {succeeded && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">Booking Cancelled</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isPaid && selectedMethod !== 'no_refund'
                  ? `${isPartialRefund ? 'Partial refund' : 'Refund'} of ${fmt(refundAmount)} ${currency} via ${method.label} recorded.`
                  : 'The booking has been cancelled successfully.'}
              </p>
            </div>
            {errors.length > 0 && (
              <div className="w-full rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Secondary records had warnings (booking was cancelled):
                </p>
                {errors.map((e, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400 leading-snug">{e}</p>)}
              </div>
            )}
            <button type="button" onClick={onClose}
              className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 transition cursor-pointer">
              Done
            </button>
          </div>
        )}

        {/* Form */}
        {!succeeded && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Paid booking info banner */}
            {isPaid && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  This booking has a recorded payment of{' '}
                  <strong>{fmt(totalAmount)} {currency}</strong>.
                  Select the refund method and enter a reference so accounting records stay balanced.
                </p>
              </div>
            )}

            {/* Cancellation reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-rose-500" />
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation, therapist unavailable…"
                rows={3}
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none transition"
              />
            </div>

            {/* Refund section — paid bookings only */}
            {isPaid && (
              <>
                <div className="border-t border-border/40 pt-5">
                  <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    Refund Method
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {REFUND_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border p-3 text-left transition cursor-pointer active:scale-[0.98]',
                          selectedMethod === m.id
                            ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-400/40'
                            : 'border-border/50 bg-muted/30 hover:bg-muted/60'
                        )}
                      >
                        <div className={cn(
                          'h-7 w-7 shrink-0 rounded-lg flex items-center justify-center mt-0.5',
                          selectedMethod === m.id
                            ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {METHOD_ICONS[m.id]}
                        </div>
                        <div className="min-w-0">
                          <p className={cn('text-xs font-semibold truncate',
                            selectedMethod === m.id ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
                          )}>{m.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{m.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference / Transaction ID */}
                {selectedMethod !== 'no_refund' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-indigo-500" />
                      Refund Reference / Transaction ID
                      {method.requiresRef && <span className="text-rose-500"> *</span>}
                    </label>
                    <input
                      type="text"
                      value={refundRef}
                      onChange={(e) => setRefundRef(e.target.value)}
                      placeholder={method.refPlaceholder || 'Optional reference number'}
                      className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Saved as <code className="font-mono">reference_id</code> and <code className="font-mono">transaction_id</code> on the payment record.
                    </p>
                  </div>
                )}

                {/* Refund amount */}
                {selectedMethod !== 'no_refund' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      Refund Amount ({currency})
                    </label>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'flex-1 flex items-center gap-2 rounded-xl border px-3.5 py-2.5',
                        customAmountEnabled ? 'border-border/60 bg-background' : 'border-border/30 bg-muted/40'
                      )}>
                        <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          disabled={!customAmountEnabled}
                          step="0.001" min={0} max={totalAmount}
                          className="flex-1 bg-transparent text-sm font-mono text-right focus:outline-none disabled:text-muted-foreground"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomAmountEnabled(!customAmountEnabled);
                          if (customAmountEnabled) setRefundAmount(totalAmount);
                        }}
                        className={cn(
                          'shrink-0 rounded-xl border px-3 py-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap',
                          customAmountEnabled
                            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                            : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {customAmountEnabled ? 'Reset Full' : 'Partial'}
                      </button>
                    </div>
                    {isPartialRefund && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Partial refund — status will be <code className="font-mono">partially_refunded</code>.
                        {fmt(totalAmount - refundAmount)} {currency} retained.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* What will be updated */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">What will be updated</p>
              <ul className="space-y-1">
                {[
                  'Booking status → Cancelled',
                  isPaid && selectedMethod !== 'no_refund'
                    ? `Payment record → ${isPartialRefund ? 'partially_refunded' : 'refunded'} (${fmt(refundAmount)} ${currency} via ${method.label})`
                    : 'Payment record → Cancelled',
                  invoiceNumber ? `Invoice ${invoiceNumber} → ${isPaid ? 'Refunded' : 'Cancelled'}` : null,
                  isPaid && selectedMethod !== 'no_refund' ? 'reference_id / transaction_id stored on payment record' : null,
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
              <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 space-y-1">
                {errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{e}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!succeeded && (
          <div className="shrink-0 border-t border-border/40 px-6 py-4 flex items-center justify-end gap-3">
            {submitting && (
              <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                {step === 'booking' && 'Cancelling booking…'}
                {step === 'payment' && 'Updating payment record (booknpay)…'}
                {step === 'invoice' && 'Updating invoice (UANR)…'}
                {step === 'done'    && 'Finishing…'}
              </div>
            )}
            <button type="button" onClick={onClose} disabled={submitting}
              className="rounded-xl border border-border/60 bg-muted/40 hover:bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition cursor-pointer disabled:opacity-50">
              Keep Booking
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer active:scale-[0.98]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
