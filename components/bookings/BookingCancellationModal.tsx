'use client';

/**
 * BookingCancellationModal
 *
 * Cancellation flow with 2-step payment reference & receipt attachment:
 *
 *  Step 1 – Choose refund payment method / provider (by default none selected,
 *            Confirm Cancellation is inactive until required fields are completed).
 *  Step 2 – When a provider is clicked/selected, opens the Payment Reference & Receipt
 *            window for scanning POS slip / uploading receipt and attaching Ref ID.
 *
 * Accounting steps upon confirmation:
 *  Step 1 – PATCH /booknpay/api/v1/bookings/<id>/status/
 *             → status=cancelled, payment_status=refunded|cancelled
 *  Step 2 – POST /booknpay/api/v1/payments/
 *             → Upserts the existing payment record for the booking
 *               setting status=refunded (or partially_refunded) with receipt_image
 *  Step 3 – POST /api/v1/invoices/<inv>/cancel/ (if invoice exists)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AlertCircle, Loader2, Ban, CreditCard, Banknote,
  DollarSign, CheckCircle2, Info, Receipt, Wallet, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { PaymentReferenceModal } from './PaymentReferenceModal';
import {
  PAYMENT_PROVIDERS,
  type PaymentProviderOption,
} from './TherapistScheduleBookingModal';

// ── Refund Provider Configurations ─────────────────────────────────────────────

export interface RefundProviderConfig {
  id: PaymentProviderOption | 'no_refund';
  label: string;
  badge: string;
  desc: string;
  booknpayMethod: string;
  booknpayGateway: string | null;
  booknpayProvider: string | null;
}

export const CANCELLATION_PROVIDERS: RefundProviderConfig[] = [
  {
    id: 'PaymentLink',
    label: 'PaymentLink',
    badge: 'Direct Link',
    desc: 'SMS / WhatsApp link / online card refund',
    booknpayMethod: 'card',
    booknpayGateway: 'Other',
    booknpayProvider: 'PaymentLink',
  },
  {
    id: 'Deema',
    label: 'Deema',
    badge: 'Installments',
    desc: 'BNPL payment installment reversal',
    booknpayMethod: 'card',
    booknpayGateway: 'Other',
    booknpayProvider: 'Deema',
  },
  {
    id: 'KNET Card',
    label: 'KNET Card',
    badge: 'POS Terminal',
    desc: 'In-branch card reversal / POS slip',
    booknpayMethod: 'knet',
    booknpayGateway: 'KNET',
    booknpayProvider: 'KNET Card',
  },
  {
    id: 'Other',
    label: 'Other',
    badge: 'Alternative',
    desc: 'Cash refund or alternative method',
    booknpayMethod: 'cash',
    booknpayGateway: null,
    booknpayProvider: 'Other',
  },
  {
    id: 'no_refund',
    label: 'No Refund',
    badge: 'Non-monetary',
    desc: 'Cancellation without monetary refund',
    booknpayMethod: 'unknown',
    booknpayGateway: null,
    booknpayProvider: null,
  },
];

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
  bookingType,
  token,
  onClose,
  onSuccess,
}: BookingCancellationModalProps) {
  const currentUser = useAppSelector((s) => s.auth.user);
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  // Form states
  const [reason, setReason] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderOption | 'no_refund' | null>(null);
  const [transactionRefId, setTransactionRefId] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptNotes, setReceiptNotes] = useState('');
  const [showPaymentRefModal, setShowPaymentRefModal] = useState(false);
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

  const providerConfig = CANCELLATION_PROVIDERS.find((p) => p.id === selectedProvider) ?? null;
  const fmt = (n: number) => n.toFixed(3);
  const isPartialRefund = customAmountEnabled && refundAmount < totalAmount;

  // Validation rules for Confirm Cancellation
  const isReceiptCompleted =
    selectedProvider === 'no_refund' ||
    (Boolean(selectedProvider) && Boolean(transactionRefId.trim()));

  const isFormValid = Boolean(
    reason.trim() &&
    selectedProvider &&
    isReceiptCompleted &&
    (!isPaid || (refundAmount >= 0 && refundAmount <= totalAmount))
  );

  const isConfirmDisabled = submitting || !isFormValid;

  // Provider Selection Handler
  const handleSelectProvider = (provId: PaymentProviderOption | 'no_refund') => {
    if (provId === 'no_refund') {
      setSelectedProvider('no_refund');
      setTransactionRefId('');
      setReceiptImage(null);
      setReceiptNotes('');
      setShowPaymentRefModal(false);
      return;
    }

    if (selectedProvider !== provId) {
      setTransactionRefId('');
      setReceiptImage(null);
      setReceiptNotes('');
    }
    setSelectedProvider(provId);
    // In Next step: immediately show popup window for scan/uploading receipt
    setShowPaymentRefModal(true);
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!reason.trim()) errs.push('Please enter a cancellation reason.');
    if (!selectedProvider) errs.push('Please select a refund payment method / provider.');
    if (isPaid && selectedProvider !== 'no_refund' && !transactionRefId.trim()) {
      errs.push('A transaction / reference ID and receipt scan are required.');
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
        payment_status: selectedProvider === 'no_refund' ? 'cancelled' : (isPartialRefund ? 'partially_refunded' : 'refunded'),
        reason:         reason.trim(),
        cancel_reason:  reason.trim(),
        source:         'ushdesk',
        changed_by:     currentUser?.name || currentUser?.id || 'Staff',
        change_by_user: currentUser?.name || currentUser?.id || 'Staff',
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

      if (isPaid && selectedProvider && selectedProvider !== 'no_refund') {
        cancelBody.refund_method    = selectedProvider;
        cancelBody.refund_reference = transactionRefId.trim() || null;
        cancelBody.refund_amount    = refundAmount;
        cancelBody.refund_currency  = currency;
        cancelBody.receipt_image    = receiptImage || null;
        cancelBody.transaction_id   = transactionRefId.trim() || null;
        cancelBody.reference_id     = transactionRefId.trim() || null;
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
    if (isPaid && selectedProvider && selectedProvider !== 'no_refund') {
      setStep('payment');
      try {
        const refStatus = isPartialRefund ? 'partially_refunded' : 'refunded';
        const provConfig = CANCELLATION_PROVIDERS.find((p) => p.id === selectedProvider);

        const paymentBody: Record<string, unknown> = {
          customer_id:    customerId ?? 'unknown',
          total_amount:   refundAmount.toFixed(3),
          total_duration: totalDuration || 0,
          currency:       currency,
          booking_id:     bookingId,
          invoice_id:     invoiceNumber ?? null,
          invoice_value:  refundAmount.toFixed(3),
          status:         refStatus,
          payment_method: provConfig?.booknpayMethod ?? 'card',
          payment_through: 'ushdesk',
          payment_provider: selectedProvider,
          payment_gateway:  selectedProvider === 'KNET Card' ? 'KNET' : selectedProvider,
          payment_for: (bookingType === 'home_service' || bookingType === 'home')
            ? 'home_service'
            : 'branch_service',
          reference_id:   transactionRefId.trim() || null,
          transaction_id: transactionRefId.trim() || null,
          receipt_image:  receiptImage || null,
          customer_data:  customerData ?? null,
          payment_data: {
            refund_reason:     reason.trim(),
            refund_method:     selectedProvider,
            original_amount:   totalAmount.toFixed(3),
            refunded_amount:   refundAmount.toFixed(3),
            booking_number:    bookingNumber ?? bookingId,
            receipt_image:     receiptImage || null,
            notes:             receiptNotes || null,
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
          state:         selectedProvider === 'no_refund' ? 'cancelled' : (isPaid ? 'refunded' : 'cancelled'),
          cancel_reason: reason.trim(),
          refund_method: selectedProvider !== 'no_refund' ? selectedProvider : null,
          refund_ref:    transactionRefId.trim() || null,
          refund_amount: selectedProvider !== 'no_refund' ? refundAmount : 0,
        };

        const r = await authedFetch(`/uanr/api/v1/invoices/${encodeURIComponent(invoiceNumber)}/cancel/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(invBody),
        });

        if (!r.ok) {
          const patch = await authedFetch(`/uanr/api/v1/invoices/${encodeURIComponent(invoiceNumber)}/`, {
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
    bookingId, bookingNumber, invoiceNumber, isPaid, selectedProvider,
    transactionRefId, receiptImage, receiptNotes, refundAmount, reason,
    currency, totalDuration, customerId, customerData, bookingType,
    authHeader, onSuccess, isPartialRefund, totalAmount,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
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
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/60 transition cursor-pointer"
            >
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
                  {isPaid && selectedProvider !== 'no_refund' && providerConfig
                    ? `${isPartialRefund ? 'Partial refund' : 'Refund'} of ${fmt(refundAmount)} ${currency} via ${providerConfig.label} recorded.`
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
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Cancellation Form */}
          {!succeeded && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Paid booking info banner */}
              {isPaid && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    This booking has a recorded payment of{' '}
                    <strong>{fmt(totalAmount)} {currency}</strong>.
                    Select the refund provider and scan/attach the receipt so accounting records balance.
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
                  rows={2}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none transition"
                />
              </div>

              {/* Refund amount */}
              {isPaid && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    Refund Amount ({currency})
                  </label>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex-1 flex items-center gap-2 rounded-xl border px-3.5 py-2',
                      customAmountEnabled ? 'border-border/60 bg-background' : 'border-border/30 bg-muted/40'
                    )}>
                      <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
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
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAmountEnabled(!customAmountEnabled);
                        if (customAmountEnabled) setRefundAmount(totalAmount);
                      }}
                      className={cn(
                        'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer whitespace-nowrap',
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

              {/* ── Step 1: Choose Payment Method / Provider ── */}
              <div className="border-t border-border/40 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      Select Refund Provider <span className="text-destructive">*</span>
                    </p>
                  </div>
                  {selectedProvider ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      {providerConfig?.label ?? selectedProvider}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Required
                    </span>
                  )}
                </div>

                {/* Provider Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CANCELLATION_PROVIDERS.filter((p) => isPaid ? p.id !== 'no_refund' : true).map((p) => {
                    const isSel = selectedProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProvider(p.id)}
                        className={cn(
                          'flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer select-none',
                          isSel
                            ? 'border-emerald-500 bg-white dark:bg-card shadow-sm ring-2 ring-emerald-500/20'
                            : 'border-border/70 bg-card/60 hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={cn('text-xs font-extrabold', isSel ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
                            {p.label}
                          </span>
                          {isSel && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{p.desc}</span>
                        <span className={cn(
                          'mt-1.5 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded',
                          isSel ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                        )}>
                          {p.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Step 2: Attached Reference & Receipt Status ── */}
                {selectedProvider && selectedProvider !== 'no_refund' ? (
                  <div className="mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-foreground">
                          Refund Reference &amp; Receipt Status
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPaymentRefModal(true)}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        {transactionRefId ? 'Edit / Re-scan' : '+ Add Details / Scan'}
                      </button>
                    </div>

                    {transactionRefId ? (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Ref / Trans ID</span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 truncate block">
                              {transactionRefId}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-card border border-border/60">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Invoice ID</span>
                            <span className="font-mono font-bold text-foreground truncate block">
                              {invoiceNumber || 'Auto (INV/...)'}
                            </span>
                          </div>
                        </div>
                        {receiptImage && (
                          <div className="flex items-center gap-2.5 pt-1">
                            <img
                              src={receiptImage}
                              alt="Scanned receipt"
                              className="h-9 w-9 rounded-lg object-cover border border-emerald-500/30 shadow-xs"
                            />
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              ✓ Receipt slip image attached to refund &amp; invoice
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                        <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                          Please input transaction ID or scan receipt to attach to cancellation record.
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPaymentRefModal(true)}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition"
                        >
                          Input / Scan Now
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 p-3 rounded-xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground text-center">
                    Please select a refund provider above to enter transaction details.
                  </div>
                )}
              </div>

              {/* What will be updated checklist */}
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">What will be updated</p>
                <ul className="space-y-1">
                  {[
                    'Booking status → Cancelled',
                    isPaid && selectedProvider && selectedProvider !== 'no_refund'
                      ? `Payment record → ${isPartialRefund ? 'partially_refunded' : 'refunded'} (${fmt(refundAmount)} ${currency} via ${providerConfig?.label ?? selectedProvider})`
                      : 'Payment record → Cancelled',
                    invoiceNumber ? `Invoice ${invoiceNumber} → ${isPaid ? 'Refunded' : 'Cancelled'}` : null,
                    isPaid && selectedProvider && selectedProvider !== 'no_refund' ? 'reference_id & receipt_image stored on payment record' : null,
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

          {/* Footer Actions */}
          {!succeeded && (
            <div className="shrink-0 border-t border-border/40 px-6 py-4 flex items-center justify-end gap-3 bg-muted/10">
              {submitting && (
                <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                  {step === 'booking' && 'Cancelling booking…'}
                  {step === 'payment' && 'Updating payment record (booknpay)…'}
                  {step === 'invoice' && 'Updating invoice (UANR)…'}
                  {step === 'done'    && 'Finishing…'}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-border/60 bg-muted/40 hover:bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
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
                    : !selectedProvider
                      ? 'Please select a refund payment provider'
                      : selectedProvider !== 'no_refund' && !transactionRefId.trim()
                        ? 'Please complete payment reference and receipt details'
                        : undefined
                }
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition',
                  isConfirmDisabled
                    ? 'bg-muted text-muted-foreground/60 border border-border/60 cursor-not-allowed shadow-none'
                    : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-[0.98]'
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Payment Reference & Receipt Scan Modal ── */}
      {selectedProvider && selectedProvider !== 'no_refund' && (
        <PaymentReferenceModal
          isOpen={showPaymentRefModal}
          onClose={() => setShowPaymentRefModal(false)}
          paymentProvider={selectedProvider}
          totalAmount={refundAmount}
          currency={currency}
          initialTransactionId={transactionRefId}
          initialReceiptImage={receiptImage}
          initialNotes={receiptNotes}
          onConfirm={(data) => {
            setTransactionRefId(data.transactionId);
            setReceiptImage(data.receiptImage);
            if (data.notes) setReceiptNotes(data.notes);
            setShowPaymentRefModal(false);
            setErrors([]);
          }}
        />
      )}
    </>
  );
}
