'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard, Banknote, X, ChevronRight, ChevronLeft, Link2,
  CheckCircle2, AlertCircle, Copy, ExternalLink,
  MessageCircle, MessageSquare, RefreshCw, Loader2,
  Sparkles, ShieldCheck, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { nowWithTimezone } from '@/lib/datetime';
import {
  paymentLinksApi,
  whatsappShareUrl,
  smsShareUrl,
  sendPaymentLinkSms,
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
  initialProviderId?: string;
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
    id: 'knet_card',
    name: 'KNET Card',
    gatewayKey: 'knet',
    badge: 'Active · KNET',
    description: 'In-branch KNET card terminal (POS)',
    isDefault: true,
    inactive: false,
  },
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    gatewayKey: 'myfatoorah',
    badge: 'Active',
    description: 'Create & share payment link via SMS or WhatsApp',
    isDefault: false,
    inactive: false,
  },
  {
    id: 'deema',
    name: 'Deema',
    gatewayKey: 'deema',
    badge: 'Active · BNPL',
    description: 'Buy now, pay later - Deema installment payment link',
    inactive: false,
  },
  {
    id: 'boubyan_link',
    name: 'Boubyan Link',
    gatewayKey: 'boubyan_link',
    badge: 'Active · Link',
    description: 'Pay via Boubyan Link and enter reference number',
    inactive: false,
  },
];

const OPEN_LINK_STATUSES = ['created', 'pending', 'active'];

function providerForGateway(gateway?: string | null): PaymentProvider | null {
  const g = (gateway || '').toLowerCase();
  if (!g) return null;
  if (g === 'tap' || g === 'tap_deema' || g === 'deema') {
    return PROVIDERS.find((p) => p.id === 'deema') || null;
  }
  if (g === 'cash' || g === 'boubyan' || g === 'boubyan_link') {
    return PROVIDERS.find((p) => p.id === 'boubyan_link') || null;
  }
  return PROVIDERS.find((p) => p.gatewayKey === g) || null;
}

export function generateKnetAuthCode(): string {
  // Generate random 5 to 6 digits (e.g. KENT-84920 or KENT-984210)
  const isSixDigit = Math.random() > 0.5;
  const num = isSixDigit
    ? Math.floor(100000 + Math.random() * 900000)
    : Math.floor(10000 + Math.random() * 90000);
  return `KENT-${num}`;
}

export function generateCashReceiptCode(): string {
  const isSixDigit = Math.random() > 0.5;
  const num = isSixDigit
    ? Math.floor(100000 + Math.random() * 900000)
    : Math.floor(10000 + Math.random() * 90000);
  return `CASH-${num}`;
}

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
  initialProviderId,
  onBeforeNext,
  onPaymentSuccess,
  onSuccess,
}: MakePaymentModalProps) {
  const isVoucher = targetType === 'voucher' || targetType === 'gift_voucher';
  const resolvedTargetType: PaymentLinkTarget = isVoucher ? 'gift_voucher' : 'booking';

  const [step, setStep] = useState<1 | 2>(initialStep);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>(() => {
    if (initialProviderId) {
      const normalizedInit = initialProviderId.toLowerCase();
      if (normalizedInit === 'tap' || normalizedInit === 'tap_deema' || normalizedInit === 'deema') {
        const deemaProv = PROVIDERS.find((p) => p.id === 'deema' && !p.inactive);
        if (deemaProv) return deemaProv;
      }
      if (normalizedInit === 'cash' || normalizedInit === 'boubyan' || normalizedInit === 'boubyan_link' || normalizedInit === 'boubyan link') {
        const boubyanProv = PROVIDERS.find((p) => p.id === 'boubyan_link' && !p.inactive);
        if (boubyanProv) return boubyanProv;
      }
      const match = PROVIDERS.find(
        (p) =>
          !p.inactive &&
          (p.id.toLowerCase() === normalizedInit ||
            p.gatewayKey.toLowerCase() === normalizedInit ||
            p.name.toLowerCase() === normalizedInit)
      );
      if (match) return match;
    }
    return PROVIDERS.find((p) => p.id === 'knet_card' && !p.inactive) || PROVIDERS[0];
  });
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
  const [sendingSms, setSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // KNET POS terminal states - auto generates KENT-[random 5-6 digit]
  const [knetMode, setKnetMode] = useState<'pos' | 'link'>('pos');
  const [knetRefCode, setKnetRefCode] = useState(() =>
    selectedProvider.id === 'knet_card' ? generateKnetAuthCode() : ''
  );
  const [knetNotes, setKnetNotes] = useState('');
  const [confirmingKnet, setConfirmingKnet] = useState(false);
  const [knetConfirmed, setKnetConfirmed] = useState(false);

  // Boubyan Link reference states
  const [cashRefCode, setCashRefCode] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [cashConfirmed, setCashConfirmed] = useState(false);

  // Currently open (unexpired) payment link for this booking/voucher, if any.
  const [activeLink, setActiveLink] = useState<PaymentLink | null>(null);
  const [cancellingLink, setCancellingLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !effectiveTargetId) return;
    let cancelled = false;
    paymentLinksApi
      .list(resolvedTargetType, effectiveTargetId)
      .then((links) => {
        if (cancelled) return;
        const open = (links || []).find(
          (l) =>
            OPEN_LINK_STATUSES.includes(String(l.status).toLowerCase()) &&
            !l.is_expired &&
            Boolean(l.payment_url)
        );
        setActiveLink(open || null);
      })
      .catch(() => {
        /* non-blocking: backend still enforces the single active link rule */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, effectiveTargetId, resolvedTargetType]);

  if (!isOpen) return null;

  const handleContinueExistingLink = () => {
    if (!activeLink) return;
    const prov = providerForGateway(activeLink.gateway);
    if (prov) setSelectedProvider(prov);
    setPaymentLink(activeLink);
    setStep(2);
  };

  const handleCancelActiveLink = async () => {
    if (!activeLink) return;
    setCancellingLink(true);
    setError(null);
    try {
      await paymentLinksApi.cancel(activeLink.id);
      setActiveLink(null);
      setPaymentLink(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel payment link');
    } finally {
      setCancellingLink(false);
    }
  };

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
      const gw = selectedProvider.gatewayKey === 'knet' ? 'myfatoorah' : selectedProvider.gatewayKey;
      const link = await paymentLinksApi.create(type, id, {
        gateway: gw,
        amount: amount !== undefined && amount !== null && amount !== '' ? amount : undefined,
        invoice_id: invoiceId || undefined,
        invoice_number: invoiceNumber || undefined,
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

  const handleConfirmKnetPosPayment = async () => {
    const id = effectiveTargetId || targetId || (isVoucher ? voucherId : bookingId);
    if (!id) {
      setError(`${isVoucher ? 'Voucher' : 'Booking'} ID is missing.`);
      return;
    }
    setConfirmingKnet(true);
    setError(null);
    try {
      const paidAtNow = nowWithTimezone();
      const ref = knetRefCode.trim() || `KNET-${Date.now().toString().slice(-6)}`;

      if (!isVoucher) {
        // 1. Update booking status
        const patchPayload = {
          status: 'confirmed',
          payment_status: 'success',
          payment_provider: 'KNET Card',
          payment_method: 'card',
          payment_gateway: 'KNET',
          transaction_id: ref,
          reference_id: ref,
          notes: knetNotes.trim() || 'Paid via KNET Card at branch',
          reason: 'Paid via KNET Card at branch',
          source: 'ushdesk',
          payment_data: {
            transaction_id: ref,
            reference_id: ref,
            payment_provider: 'KNET Card',
            payment_method: 'card',
            payment_gateway: 'KNET',
            total_amount: amount,
            currency: currency,
            paid_at: paidAtNow,
          },
          payments_data: {
            is_paid: true,
            status: 'Paid',
            transaction_id: ref,
            reference_id: ref,
            payment_provider: 'KNET Card',
            payment_method: 'card',
            payment_gateway: 'KNET',
            paid_at: paidAtNow,
          },
        };

        const res = await authedFetch(`/booknpay/api/v1/bookings/${id}/status/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(patchPayload),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.detail || errJson.message || `Failed to update booking status (${res.status})`);
        }

        // 2. Record in payments service
        try {
          await authedFetch('/booknpay/api/v1/payments/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              booking_id: id,
              amount: parseFloat(String(amount)) || 0,
              currency: currency || 'KWD',
              status: 'success',
              payment_method: 'card',
              payment_provider: 'KNET Card',
              payment_gateway: 'KNET',
              payment_through: 'ushdesk',
              payment_for: 'branch_service',
              reference_id: ref,
              transaction_id: ref,
              invoice_number: invoiceNumber || null,
              invoice_id: invoiceId || null,
              notes: knetNotes.trim() || null,
              paid_at: paidAtNow,
            }),
          });
        } catch (payErr) {
          console.warn('Payment record warning:', payErr);
        }
      } else {
        // Voucher status update
        try {
          await authedFetch(`/booknpay/api/v1/vouchers/${id}/status/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              status: 'active',
              payment_status: 'paid',
              payment_method: 'KNET Card',
              payment_gateway: 'KNET',
              reference_id: ref,
            }),
          });
        } catch (vErr) {
          console.warn('Voucher status warning:', vErr);
        }
      }

      setKnetConfirmed(true);
      onPaymentSuccess?.({
        id: ref,
        status: 'paid',
        amount: String(amount),
        currency: currency || 'KWD',
        provider: 'KNET Card',
        payment_url: null,
        invoice_id: invoiceId || null,
        invoice_number: invoiceNumber || null,
        amount_refunded: '0',
        target_type: resolvedTargetType,
        target_id: id,
        is_expired: false,
        paid_at: paidAtNow,
        expires_at: null,
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm KNET payment');
    } finally {
      setConfirmingKnet(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    const id = effectiveTargetId || targetId || (isVoucher ? voucherId : bookingId);
    if (!id) {
      setError(`${isVoucher ? 'Voucher' : 'Booking'} ID is missing.`);
      return;
    }
    const ref = cashRefCode.trim();
    if (!ref) {
      setError('Please enter a reference number.');
      return;
    }
    setConfirmingCash(true);
    setError(null);
    try {
      const paidAtNow = nowWithTimezone();

      if (!isVoucher) {
        // 1. Update booking status
        const patchPayload = {
          status: 'confirmed',
          payment_status: 'success',
          payment_provider: 'Boubyan Link',
          payment_method: 'Boubyan Link',
          payment_gateway: 'Other',
          transaction_id: ref,
          reference_id: ref,
          notes: cashNotes.trim() || 'Paid via Boubyan Link',
          reason: 'Paid via Boubyan Link',
          source: 'ushdesk',
          payment_data: {
            transaction_id: ref,
            reference_id: ref,
            payment_provider: 'Boubyan Link',
            payment_method: 'Boubyan Link',
            payment_gateway: 'Other',
            total_amount: amount,
            currency: currency,
            paid_at: paidAtNow,
          },
          payments_data: {
            is_paid: true,
            status: 'Paid',
            transaction_id: ref,
            reference_id: ref,
            payment_provider: 'Boubyan Link',
            payment_method: 'Boubyan Link',
            payment_gateway: 'Other',
            paid_at: paidAtNow,
          },
        };

        const res = await authedFetch(`/booknpay/api/v1/bookings/${id}/status/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(patchPayload),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.detail || errJson.message || `Failed to update booking status (${res.status})`);
        }

        // 2. Record in payments service
        try {
          await authedFetch('/booknpay/api/v1/payments/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              booking_id: id,
              amount: parseFloat(String(amount)) || 0,
              currency: currency || 'KWD',
              status: 'success',
              payment_method: 'payment_link',
              payment_provider: 'Boubyan Link',
              payment_gateway: 'Other',
              payment_through: 'ushdesk',
              payment_for: 'branch_service',
              reference_id: ref,
              transaction_id: ref,
              invoice_number: invoiceNumber || null,
              invoice_id: invoiceId || null,
              notes: cashNotes.trim() || null,
              paid_at: paidAtNow,
            }),
          });
        } catch (payErr) {
          console.warn('Payment record warning:', payErr);
        }
      } else {
        // Voucher status update
        try {
          await authedFetch(`/booknpay/api/v1/vouchers/${id}/status/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              status: 'active',
              payment_status: 'paid',
              payment_method: 'Boubyan Link',
              payment_gateway: 'Other',
              reference_id: ref,
            }),
          });
        } catch (vErr) {
          console.warn('Voucher status warning:', vErr);
        }
      }

      setCashConfirmed(true);
      onPaymentSuccess?.({
        id: ref,
        status: 'paid',
        amount: String(amount),
        currency: currency || 'KWD',
        provider: 'Boubyan Link',
        payment_url: null,
        invoice_id: invoiceId || null,
        invoice_number: invoiceNumber || null,
        amount_refunded: '0',
        target_type: resolvedTargetType,
        target_id: id,
        is_expired: false,
        paid_at: paidAtNow,
        expires_at: null,
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm Boubyan Link payment');
    } finally {
      setConfirmingCash(false);
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

  const handleSendSms = async () => {
    if (!paymentLink?.payment_url) {
      setSmsFeedback({ type: 'error', message: 'Payment link is not generated yet.' });
      return;
    }
    const phone = customerPhone?.trim();
    if (!phone) {
      setSmsFeedback({ type: 'error', message: 'Customer phone number is required to send SMS.' });
      return;
    }

    setSendingSms(true);
    setSmsFeedback(null);
    try {
      const smsBody = isVoucher
        ? `USHSPA: مرحباً${customerName ? ` ${customerName}` : ''}، يرجى استكمال دفع قسيمة الهدايا بمبلغ ${amount} ${currency} عبر هذا الرابط: ${paymentLink.payment_url}`
        : `USHSPA: مرحباً${customerName ? ` ${customerName}` : ''}، يرجى استكمال دفع حجزك بمبلغ ${amount} ${currency} عبر هذا الرابط: ${paymentLink.payment_url}`;

      await sendPaymentLinkSms({
        phone_number: phone,
        content: smsBody,
        language: 'ar',
      });
      setSmsSent(true);
      setSmsFeedback({ type: 'success', message: 'Payment link SMS sent successfully to customer.' });
      setTimeout(() => {
        setSmsSent(false);
      }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send SMS.';
      setSmsFeedback({ type: 'error', message: msg });
    } finally {
      setSendingSms(false);
    }
  };

  const isPaid = knetConfirmed || cashConfirmed || paymentLink?.status === 'paid' || paymentLink?.status === 'success';

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
                {step === 1
                  ? 'Step 1: Select Payment Provider'
                  : selectedProvider.id === 'boubyan_link'
                  ? initialStep === 2
                    ? 'Enter Reference Number'
                    : 'Step 2: Enter Reference Number'
                  : initialStep === 2
                  ? 'Create & Share Payment Link'
                  : 'Step 2: Create & Share Payment Link'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
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
                {activeLink && (
                  <div className="mb-3 rounded-2xl border border-amber-300/50 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs space-y-2">
                    <p className="font-bold text-amber-800 dark:text-amber-200">
                      An active {activeLink.provider || activeLink.gateway} payment link already exists.
                    </p>
                    <p className="text-amber-700/90 dark:text-amber-300/80">
                      Other payment options are blocked until this link expires or is cancelled.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleContinueExistingLink}
                        className="rounded-lg bg-primary px-3 py-1.5 font-bold text-white cursor-pointer"
                      >
                        View Active Link
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelActiveLink}
                        disabled={cancellingLink}
                        className="rounded-lg border border-destructive/40 px-3 py-1.5 font-bold text-destructive cursor-pointer disabled:opacity-60"
                      >
                        {cancellingLink ? 'Cancelling...' : 'Cancel Link'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-2.5">
                  {PROVIDERS.map((provider) => {
                    const isSelected = selectedProvider.id === provider.id;
                    const isInactive = Boolean(provider.inactive) || Boolean(activeLink);
                    return (
                      <div
                        key={provider.id}
                        onClick={() => {
                          if (isInactive) return;
                          setSelectedProvider(provider);
                          if (provider.id === 'knet_card' && !knetRefCode) {
                            setKnetRefCode(generateKnetAuthCode());
                          }
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
                            {activeLink ? 'Blocked' : 'Inactive'}
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
                  disabled={loading || Boolean(activeLink)}
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

          {/* STEP 2: Make Payment Now */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2 border border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-bold text-foreground">{selectedProvider.name}</span>
                </div>
                {initialStep !== 2 && !paymentLink && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Change Provider
                  </button>
                )}
              </div>

              {/* If knetConfirmed, show success banner directly */}
              {knetConfirmed && (
                <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 text-center space-y-3">
                  <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                      Payment Confirmed via KNET Card!
                    </h3>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                      KNET payment of {amount} {currency} has been recorded and booking is confirmed.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDone}
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* If cashConfirmed (Boubyan Link), show success banner directly */}
              {cashConfirmed && (
                <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 text-center space-y-3">
                  <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                      Payment Confirmed via Boubyan Link!
                    </h3>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                      Boubyan Link payment of {amount} {currency} has been recorded and {targetType === 'voucher' ? 'voucher' : 'booking'} is confirmed.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDone}
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* If KNET Card selected and not yet paid or payment link created */}
              {!knetConfirmed && !paymentLink && selectedProvider.id === 'knet_card' && (
                <div className="space-y-4">
                  {/* Mode toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/40 border border-border/60">
                    <button
                      type="button"
                      onClick={() => setKnetMode('pos')}
                      className={cn(
                        'flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer',
                        knetMode === 'pos'
                          ? 'bg-card text-foreground shadow-sm border border-border'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      In-Branch POS Terminal
                    </button>
                    <button
                      type="button"
                      disabled
                      title="KNET Payment Link is currently inactive"
                      className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition opacity-40 cursor-not-allowed text-muted-foreground select-none"
                    >
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>KNET Payment Link</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">Inactive</span>
                    </button>
                  </div>

                  {knetMode === 'pos' ? (
                    <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-foreground">In-Branch KNET POS Terminal</h3>
                          <p className="text-xs text-muted-foreground">Swipe, insert, or tap card on the branch KNET machine.</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-foreground">
                            Transaction / Auth Code <span className="text-muted-foreground font-normal">(Auto-generated)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setKnetRefCode(generateKnetAuthCode())}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={knetRefCode}
                            onChange={(e) => setKnetRefCode(e.target.value)}
                            placeholder="e.g. KENT-984210"
                            className="w-full h-10 rounded-xl border border-border bg-muted/20 pl-3 pr-10 text-xs font-mono font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setKnetRefCode(generateKnetAuthCode())}
                            title="Generate new code"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary transition rounded-lg cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">
                          Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={knetNotes}
                          onChange={(e) => setKnetNotes(e.target.value)}
                          placeholder="e.g. Paid at reception counter via KNET"
                          className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmKnetPosPayment}
                        disabled={confirmingKnet}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 py-3 text-xs font-extrabold text-white shadow-md transition disabled:opacity-60 cursor-pointer"
                      >
                        {confirmingKnet ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Confirming Payment…</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Confirm KNET Payment ({amount} {currency})</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-border/80 p-6 text-center space-y-4 bg-muted/10">
                      <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-primary/10 text-primary">
                        <Link2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-foreground">Create KNET Payment Link</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          Generate a secure KNET payment link to share with customer via SMS, WhatsApp, or QR code.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreatePaymentLink}
                        disabled={loading}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm cursor-pointer"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {loading ? 'Creating KNET Link…' : 'Create and Share KNET Link'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* If Boubyan Link selected and not yet paid */}
              {!cashConfirmed && !paymentLink && selectedProvider.id === 'boubyan_link' && (
                <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <Link2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground">Boubyan Link Payment</h3>
                      <p className="text-xs text-muted-foreground">Enter the Boubyan Link payment reference number to record payment.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Reference Number <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={cashRefCode}
                      onChange={(e) => setCashRefCode(e.target.value)}
                      placeholder="Enter Boubyan Link reference number"
                      className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-mono font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">
                      Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={cashNotes}
                      onChange={(e) => setCashNotes(e.target.value)}
                      placeholder="e.g. Paid via Boubyan Link"
                      className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmCashPayment}
                    disabled={confirmingCash || !cashRefCode.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 py-3 text-xs font-extrabold text-white shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {confirmingCash ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Confirming Boubyan Link Payment…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirm Boubyan Link Payment ({amount} {currency})</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Standard Payment Link generation for other providers */}
              {!knetConfirmed && !cashConfirmed && !paymentLink && selectedProvider.id !== 'knet_card' && selectedProvider.id !== 'boubyan_link' && (
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
                        <button
                          type="button"
                          onClick={handleSendSms}
                          disabled={sendingSms}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60',
                            smsSent
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-border/80 bg-muted/40 text-foreground hover:bg-muted'
                          )}
                        >
                          {sendingSms ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Sending SMS…</span>
                            </>
                          ) : smsSent ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span>SMS Sent!</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4" />
                              <span>Share SMS</span>
                            </>
                          )}
                        </button>
                      </div>

                      {smsFeedback && (
                        <div
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition',
                            smsFeedback.type === 'success'
                              ? 'border border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                              : 'border border-destructive/30 bg-destructive/10 text-destructive'
                          )}
                        >
                          {smsFeedback.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                          )}
                          <span className="flex-1">{smsFeedback.message}</span>
                          <button
                            type="button"
                            onClick={() => setSmsFeedback(null)}
                            className="text-[10px] underline ml-auto cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
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
