'use client';

/**
 * VoucherCancellationModal
 *
 * Admin-only cancellation flow for gift vouchers (mirrors BookingCancellationModal):
 *  - Active / paid vouchers (status in active, scheduled, partially_redeemed, or settled payment):
 *      1. Requires a mandatory cancellation reason.
 *      2. Calls POST /booknpay/api/v1/vouchers/{id}/cancel/ with request_refund=true.
 *      3. Backend cancels open payment links & scheduled delivery, transitions voucher → cancelled,
 *         creates an auditable Refund in `requested` status (visible in Bookings → Refunds),
 *         and issues an unpaid Credit Note in UANR (outbound payment recorded when Finance processes the refund).
 *  - Unpaid / pending vouchers (created, payment_pending):
 *      1. Cancels voucher & open payment links via POST /booknpay/api/v1/vouchers/{id}/cancel/.
 *      2. Cancels any open invoice in UANR.
 */

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  AlertCircle,
  Loader2,
  Ban,
  CheckCircle2,
  Info,
  ShieldCheck,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { usePermissions } from '@/hooks/use-permissions';

export interface VoucherCancellationModalProps {
  voucherId: string;
  voucherNumber?: string | null;
  invoiceNumber?: string | null;
  voucherStatus: string;
  isPaid: boolean;
  totalAmount: number;
  currency?: string;
  serviceName?: string | null;
  senderName?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RefundSummary {
  id: string;
  refund_number: string;
  status: string;
  requested_amount: string;
  cancellation_fee: string;
  refunded_amount: string;
  currency: string;
  credit_note_number?: string | null;
}

export function VoucherCancellationModal({
  voucherId,
  voucherNumber,
  invoiceNumber,
  voucherStatus,
  isPaid,
  totalAmount,
  currency = 'KWD',
  serviceName,
  senderName,
  onClose,
  onSuccess,
}: VoucherCancellationModalProps) {
  const token = useAppSelector((s) => s.auth.token);
  const currentUser = useAppSelector((s) => s.auth.user);
  const { roleInfo } = usePermissions();

  const authHeader = token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : undefined;
  const normStatus = String(voucherStatus || '').toLowerCase().trim();
  const isPaidVoucher =
    isPaid ||
    normStatus === 'active' ||
    normStatus === 'scheduled' ||
    normStatus === 'partially_redeemed';
  const isUnpaid = !isPaidVoucher;

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'idle' | 'voucher' | 'invoice' | 'done'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [succeeded, setSucceeded] = useState(false);
  const [refundResult, setRefundResult] = useState<RefundSummary | null>(null);

  const fmt = (n: number) =>
    Number.isFinite(n)
      ? n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      : '0.000';

  const isConfirmDisabled = submitting || reason.trim().length < 3;

  const handleSubmit = useCallback(async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErrors(['Please provide a cancellation reason (at least 3 characters).']);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    setStep('voucher');

    const actorRole =
      roleInfo?.role_name ||
      (currentUser as any)?.role_name ||
      (currentUser as any)?.role ||
      (currentUser as any)?.user_type ||
      'Admin';
    const actorName =
      currentUser?.name ||
      [(currentUser as any)?.first_name, (currentUser as any)?.last_name].filter(Boolean).join(' ') ||
      'Admin';

    try {
      const res = await authedFetch(`/booknpay/api/v1/vouchers/${voucherId}/cancel/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
          'X-User-Id': currentUser?.id ? String(currentUser.id) : '',
          'X-User-Name': encodeURIComponent(actorName),
          'X-User-Role': encodeURIComponent(actorRole),
        },
        body: JSON.stringify({
          reason: trimmed,
          request_refund: isPaidVoucher,
          changed_by: currentUser?.id ? String(currentUser.id) : undefined,
          changed_by_name: actorName,
          changed_by_role: actorRole,
          change_by_user_data: currentUser
            ? {
                id: String(currentUser.id),
                name: actorName,
                role: actorRole,
                email: currentUser.email,
                phone_number: currentUser.phone_number,
              }
            : undefined,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        const msg =
          json.detail ||
          json.message ||
          json.error?.message ||
          `Failed to cancel gift voucher (HTTP ${res.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      if (json.refund && typeof json.refund === 'object') {
        setRefundResult(json.refund as RefundSummary);
      }

      // For unpaid vouchers, also cancel any open invoice in UANR
      if (isUnpaid && invoiceNumber) {
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
              cancel_reason: trimmed,
            }),
          });
        } catch (invErr) {
          console.warn('Invoice cancellation notice for unpaid voucher:', invErr);
        }
      }

      setStep('done');
      setSucceeded(true);
      onSuccess?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
      setStep('idle');
    } finally {
      setSubmitting(false);
    }
  }, [reason, voucherId, authHeader, currentUser, roleInfo, isPaidVoucher, isUnpaid, invoiceNumber, onSuccess]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={succeeded ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 bg-rose-50 dark:bg-rose-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <Ban className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-900 dark:text-rose-100">
                Cancel Gift Voucher
              </h2>
              {voucherNumber && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                  #{voucherNumber}
                </p>
              )}
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

        {/* Success Screen */}
        {succeeded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">
                {refundResult
                  ? 'Voucher Cancelled & Refund Requested'
                  : 'Gift Voucher Cancelled'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {refundResult
                  ? `The gift voucher has been cancelled and refund request ${refundResult.refund_number} for ${fmt(Number(refundResult.refunded_amount || totalAmount))} ${refundResult.currency || currency} has been submitted for Finance approval and payment return.`
                  : 'The gift voucher has been cancelled and can no longer be redeemed.'}
              </p>
              {refundResult?.credit_note_number && (
                <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 pt-1">
                  Credit Note: {refundResult.credit_note_number}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-2">
              {refundResult && (
                <Link
                  href="/bookings/refunds"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-4 py-2.5 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View in Refunds
                </Link>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-7 py-2.5 transition cursor-pointer shadow-sm active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Voucher Summary Card */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {serviceName || 'Gift Voucher'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {senderName ? `Purchased by ${senderName}` : 'Gift Voucher'} • Status:{' '}
                    <span className="font-semibold uppercase">{normStatus.replace(/_/g, ' ')}</span>
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-extrabold font-mono text-foreground">
                  {fmt(totalAmount)} {currency}
                </p>
                <span
                  className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase mt-0.5',
                    isPaidVoucher
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  )}
                >
                  {isPaidVoucher ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            </div>

            {/* Financial Notice Banner */}
            {isPaidVoucher ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-bold">Active / Paid Gift Voucher: </span>
                  Cancelling this voucher follows standard financial practice. A{' '}
                  <span className="font-semibold">Refund Request</span> will be submitted to{' '}
                  <span className="font-semibold">Bookings → Refunds</span> for Finance review,
                  payment return (Gateway / Cash / Loyalty Points), and Credit Note settlement.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  This voucher has not been paid yet. Cancelling will deactivate the voucher, cancel
                  any open payment links, and void the open invoice (no refund required).
                </div>
              </div>
            )}

            {/* Cancellation Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-rose-500" />
                Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for cancelling this gift voucher (e.g. Customer requested refund, duplicate purchase…)"
                rows={3}
                className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none transition"
              />
            </div>

            {/* Locked Refund Request Card for Paid Vouchers */}
            {isPaidVoucher && (
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs select-none cursor-default">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    readOnly={true}
                    aria-readonly="true"
                    className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-not-allowed opacity-90"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Process Payment Return via Refund Workflow
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                        {fmt(totalAmount)} {currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Creates a tracked Refund Request &amp; accounting Credit Note. The original
                      payment record remains preserved for audit compliance.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Standard financial audit trail &amp; approval workflow enabled.</span>
                </div>
              </div>
            )}

            {/* Summary of Changes */}
            <div className="rounded-2xl border border-border/40 bg-muted/20 p-3.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Summary of changes
              </p>
              <ul className="space-y-1">
                {[
                  'Gift voucher status → Cancelled (redemption blocked)',
                  'Open payment links & scheduled delivery (if any) → Cancelled',
                  isPaidVoucher
                    ? `Refund request → Created (Status: Requested for ${fmt(totalAmount)} ${currency})`
                    : 'Pending payment records → Cancelled',
                  isPaidVoucher
                    ? 'Accounting Credit Note → Issued (settled upon refund processing)'
                    : invoiceNumber
                      ? `Open Invoice #${invoiceNumber} → Cancelled`
                      : null,
                ]
                  .filter(Boolean)
                  .map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                    >
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
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400"
                  >
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
                  {step === 'voucher' && 'Cancelling voucher & submitting return…'}
                  {step === 'invoice' && 'Cancelling open invoice…'}
                  {step === 'done' && 'Finalizing…'}
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
                Keep Voucher
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isConfirmDisabled}
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
                  {isPaidVoucher ? 'Cancel & Request Refund' : 'Confirm Cancellation'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
