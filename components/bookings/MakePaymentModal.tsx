'use client';

import React, { useState } from 'react';
import {
  CreditCard, X, ChevronRight, ChevronLeft, Link2,
  CheckCircle2, AlertCircle, Copy, ExternalLink,
  MessageCircle, MessageSquare, RefreshCw, Loader2,
  Sparkles, ShieldCheck, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import {
  paymentLinksApi,
  whatsappShareUrl,
  smsShareUrl,
  type PaymentLink,
  type PaymentLinkTarget,
} from '@/lib/paymentLinks';

export interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  bookingNumber?: string | null;
  voucherId?: string;
  voucherNumber?: string | null;
  targetType?: 'booking' | 'voucher' | 'gift_voucher';
  targetId?: string;
  targetNumber?: string | null;
  targetLabel?: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  amount: string | number;
  currency?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  initialStep?: 1 | 2;
  onBeforeNext?: () => Promise<{ targetId: string; targetNumber?: string | null } | boolean>;
  onPaymentSuccess?: (link: PaymentLink) => void;
  onSuccess?: () => void;
}

interface PaymentProvider {
  id: string;
  name: string;
  gatewayKey: string;
  badge: string;
  description: string;
  isDefault?: boolean;
  inactive?: boolean;
}

const PROVIDERS: PaymentProvider[] = [
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    gatewayKey: 'myfatoorah',
    badge: 'Default · Active',
    description: 'Create & share payment link via SMS or WhatsApp',
    isDefault: true,
    inactive: false,
  },
  {
    id: 'deema',
    name: 'Deema',
    gatewayKey: 'deema',
    badge: 'Inactive',
    description: 'BNPL payment split',
    inactive: true,
  },
  {
    id: 'knet_card',
    name: 'KNET Card',
    gatewayKey: 'knet',
    badge: 'Inactive',
    description: 'In-branch KNET card terminal or payment link',
    inactive: true,
  },
  {
    id: 'other',
    name: 'Other',
    gatewayKey: 'other',
    badge: 'Inactive',
    description: 'Cash or alternative method',
    inactive: true,
  },
];

export function MakePaymentModal({
  isOpen,
  onClose,
  bookingId,
  bookingNumber,
  voucherId,
  voucherNumber,
  targetType = 'booking',
  targetId,
  targetNumber,
  targetLabel,
  invoiceId,
  invoiceNumber,
  amount,
  currency = 'KWD',
  customerName,
  customerPhone,
  initialStep = 1,
  onBeforeNext,
  onPaymentSuccess,
  onSuccess,
}: MakePaymentModalProps) {
  const isVoucher = targetType === 'voucher' || targetType === 'gift_voucher';
  const resolvedTargetType: PaymentLinkTarget = isVoucher ? 'gift_voucher' : 'booking';

  const [step, setStep] = useState<1 | 2>(initialStep);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(PROVIDERS[0]);
  const [effectiveTargetId, setEffectiveTargetId] = useState<string>(
    targetId || (isVoucher ? (voucherId ?? '') : (bookingId ?? ''))
  );
  const [effectiveTargetNumber, setEffectiveTargetNumber] = useState<string | null>(
    targetNumber || (isVoucher ? (voucherNumber ?? null) : (bookingNumber ?? null))
  );
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleNext = async () => {
    setError(null);
    if (onBeforeNext) {
      setLoading(true);
      try {
        const res = await onBeforeNext();
        if (!res) {
          setLoading(false);
          return;
        }
        if (typeof res === 'object') {
          if (res.targetId) setEffectiveTargetId(res.targetId);
          if (res.targetNumber) setEffectiveTargetNumber(res.targetNumber);
        }
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to proceed');
      } finally {
        setLoading(false);
      }
    } else {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError(null);
  };

  const handleCreatePaymentLink = async () => {
    const id = effectiveTargetId || targetId || (isVoucher ? voucherId : bookingId);
    if (!id) {
      setError(`${isVoucher ? 'Voucher' : 'Booking'} ID is missing.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const type: PaymentLinkTarget = resolvedTargetType;
      const link = await paymentLinksApi.create(type, id, {
        gateway: selectedProvider.gatewayKey,
      });
      setPaymentLink(link);
      if (link.status === 'paid' || link.status === 'success') {
        onPaymentSuccess?.(link);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStatus = async () => {
    const linkId = paymentLink ? (paymentLink.id || paymentLink.payment_id) : null;
    if (!linkId) return;
    setSyncing(true);
    try {
      const updated = await paymentLinksApi.sync(linkId);
      setPaymentLink(updated);
      if (updated.status === 'paid' || updated.status === 'success') {
        onPaymentSuccess?.(updated);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync status');
    } finally {
      setSyncing(false);
    }
  };

  const handleDone = () => {
    try {
      onSuccess?.();
    } catch {
      // ignore
    }
    onClose();
  };

  const shareText = paymentLink?.payment_url
    ? isVoucher
      ? `Hello${customerName ? ` ${customerName}` : ''}, please complete your USH Spa Gift Voucher payment of ${amount} ${currency} using this secure payment link: ${paymentLink.payment_url}`
      : `Hello${customerName ? ` ${customerName}` : ''}, please complete your USH Spa payment of ${amount} ${currency} using this secure payment link: ${paymentLink.payment_url}`
    : '';

  const handleCopy = async () => {
    if (!paymentLink?.payment_url) return;
    await navigator.clipboard.writeText(paymentLink.payment_url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPaid = paymentLink?.status === 'paid' || paymentLink?.status === 'success';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top accent gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-500 to-primary" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-foreground">
                {step === 1 ? 'Select Payment Provider' : 'Make Payment Now'}
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                {step === 1 ? 'Step 1: Select Payment Provider' : 'Step 2: Create & Share Payment Link'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Summary Box */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider min-w-[110px] shrink-0">
                    {targetType === 'voucher' ? (targetLabel || 'Voucher No:') : (targetLabel || 'Booking No:')}
                  </span>
                  <span className="font-bold text-foreground font-mono text-xs sm:text-sm bg-background px-2.5 py-1 rounded-lg border border-border/60 shadow-xs inline-block truncate">
                    {effectiveTargetNumber || effectiveTargetId?.slice(0, 8) || (targetType === 'voucher' ? 'Voucher (Pending)' : '—')}
                  </span>
                </div>
              </div>

              {/* Total Amount */}
              <div className="space-y-1 text-right shrink-0 pl-4 border-l border-border/50">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Total Amount
                </span>
                <p className="text-sm sm:text-base font-black text-primary leading-tight">
                  {amount} <span className="text-[10px] font-semibold">{currency}</span>
                </p>
              </div>
            </div>
          </div>

          {/* STEP 1: Select Payment Provider */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground block mb-2">
                  Select Payment Provider <span className="text-destructive">*</span>
                </label>
                <div className="space-y-2.5">
                  {PROVIDERS.map((provider) => {
                    const isSelected = selectedProvider.id === provider.id;
                    const isInactive = Boolean(provider.inactive);
                    return (
                      <div
                        key={provider.id}
                        onClick={() => {
                          if (isInactive) return;
                          setSelectedProvider(provider);
                        }}
                        className={cn(
                          'relative flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition select-none',
                          isInactive
                            ? 'opacity-40 cursor-not-allowed border-dashed border-border/50 bg-muted/10'
                            : isSelected
                            ? 'border-primary bg-primary/5 shadow-sm cursor-pointer'
                            : 'border-border/60 bg-card hover:bg-muted/30 cursor-pointer'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'h-4 w-4 rounded-full border-2 flex items-center justify-center transition',
                              isInactive
                                ? 'border-muted-foreground/20'
                                : isSelected
                                ? 'border-primary'
                                : 'border-muted-foreground/40'
                            )}
                          >
                            {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={cn('text-sm font-bold', isInactive ? 'text-muted-foreground' : isSelected ? 'text-primary' : 'text-foreground')}>
                                {provider.name}
                              </p>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                                  isInactive ? 'bg-muted text-muted-foreground/70' : 'bg-primary/10 text-primary'
                                )}
                              >
                                {provider.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{provider.description}</p>
                          </div>
                        </div>
                        {isSelected && !isInactive && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        {isInactive && (
                          <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/90 transition cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Create & Share Payment Link */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2 border border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-bold text-foreground">{selectedProvider.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Change Provider
                </button>
              </div>

              {!paymentLink && (
                <div className="rounded-2xl border-2 border-dashed border-border/80 p-6 text-center space-y-4 bg-muted/10">
                  <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground">Ready to Create Payment Link</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Click below to generate a hosted {selectedProvider.name} payment link for this {targetType === 'voucher' ? 'gift voucher' : 'booking'}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreatePaymentLink}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm cursor-pointer"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loading ? 'Creating Payment Link…' : 'Create and Share Payment Link'}
                  </button>
                </div>
              )}

              {paymentLink && (
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Status</span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                        isPaid
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                      )}
                    >
                      {paymentLink.status}
                    </span>
                  </div>

                  {isPaid ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Payment Confirmed!</p>
                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                          Customer has completed payment successfully.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* QR Code for Payment Link */}
                      {paymentLink.payment_url && (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-muted/20 p-4 text-center">
                          <div className="rounded-2xl border border-border/60 bg-white p-3 shadow-xs inline-block">
                            <QRCodeSVG
                              value={paymentLink.payment_url}
                              size={150}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <div className="mt-2.5 flex items-center gap-1.5 text-muted-foreground">
                            <QrCode className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[11px] font-bold text-foreground/80">
                              Scan QR code to pay
                            </span>
                          </div>
                        </div>
                      )}
                      {paymentLink.payment_url && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Payment URL
                          </label>
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2 text-xs">
                            <span className="flex-1 truncate font-mono text-[11px] text-foreground select-all">
                              {paymentLink.payment_url}
                            </span>
                            <button
                              type="button"
                              onClick={handleCopy}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Copy URL"
                            >
                              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <a
                              href={paymentLink.payment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Open link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <a
                          href={whatsappShareUrl(customerPhone, shareText)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Share WhatsApp
                        </a>
                        <a
                          href={smsShareUrl(customerPhone, shareText)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-muted/40 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Share SMS
                        </a>
                      </div>
                    </>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-border/40">
                    <button
                      type="button"
                      onClick={handleSyncStatus}
                      disabled={syncing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
                      Check Status
                    </button>

                    <button
                      type="button"
                      onClick={handleDone}
                      className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
