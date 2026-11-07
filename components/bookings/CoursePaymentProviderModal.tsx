'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Link2,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import {
  whatsappShareUrl,
  smsShareUrl,
  sendPaymentLinkSms,
} from '@/lib/paymentLinks';

export interface CoursePaymentProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subscription: Record<string, any>) => void;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  course: Record<string, any>;
  notes?: string;
  discount: number;
  packagePrice: number;
  finalPrice: number;
  currency?: string;
}

interface ProviderOption {
  id: 'myfatoorah' | 'deema' | 'boubyan_link';
  name: string;
  description: string;
  tag: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'myfatoorah',
    name: 'MyFatoorah',
    description: 'Create & share payment link via SMS or WhatsApp',
    tag: 'Direct Link',
  },
  {
    id: 'deema',
    name: 'Deema',
    description: 'Buy now, pay later - Deema installment link',
    tag: 'BNPL',
  },
  {
    id: 'boubyan_link',
    name: 'Boubyan Link',
    description: 'Pay via Boubyan Link & enter reference number',
    tag: 'Boubyan Link',
  },
];

const B = {
  espresso: '#543C30',
  espressoHover: '#6b4f41',
  linen: '#dbcdc2',
  blush: '#daccc1',
  lineMuted: '#e8ddd7',
  bg: '#faf7f5',
  cardBg: '#ffffff',
  textMain: '#2c1a12',
  textMuted: '#8a6f63',
  pillBg: '#f2ede9',
} as const;

export function CoursePaymentProviderModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  customerName,
  customerPhone,
  course,
  notes,
  discount,
  packagePrice,
  finalPrice,
  currency = 'KWD',
}: CoursePaymentProviderModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedProviderId, setSelectedProviderId] = useState<'myfatoorah' | 'deema' | 'boubyan_link'>('myfatoorah');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boubyan Link states
  const [boubyanRef, setBoubyanRef] = useState('');
  const [boubyanNotes, setBoubyanNotes] = useState('');
  const [confirmingBoubyan, setConfirmingBoubyan] = useState(false);
  const [boubyanConfirmed, setBoubyanConfirmed] = useState(false);

  // Payment Link states (MyFatoorah / Deema)
  const [createdSubscription, setCreatedSubscription] = useState<Record<string, any> | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const selectedProvider = PROVIDERS.find((p) => p.id === selectedProviderId) || PROVIDERS[0];

  const handleContinueToStep2 = () => {
    setError(null);
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setError(null);
    setStep(1);
  };

  // 1. Confirm Boubyan Link payment
  const handleConfirmBoubyanPayment = async () => {
    const ref = boubyanRef.trim();
    if (!ref) {
      setError('Please enter a Boubyan Link reference number.');
      return;
    }
    setConfirmingBoubyan(true);
    setError(null);
    try {
      // Step A: Create subscription
      let sub = createdSubscription;
      if (!sub) {
        const createPayload: Record<string, any> = {
          customer_id: customerId,
          course_id: course.id,
          payment_option: 'pay_at_desk',
          notes: notes ? notes.trim() : undefined,
        };
        if (discount > 0) {
          createPayload.discount = discount;
        }

        const createRes = await authedFetch('/booknpay/api/v1/course-subscriptions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        });
        const createJson = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          throw new Error(
            createJson?.error?.message ||
            createJson?.detail ||
            createJson?.message ||
            'Failed to create subscription.'
          );
        }
        sub = createJson?.data || createJson;
        setCreatedSubscription(sub);
      }

      // Step B: Confirm payment
      const confirmPayload: Record<string, any> = {
        payment_provider: 'Boubyan Link',
        payment_method: 'Boubyan Link',
        payment_gateway: 'Other',
        transaction_reference: ref,
        payment_through: 'ushdesk',
      };

      const confirmRes = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${sub?.id}/confirm-payment/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(confirmPayload),
        }
      );
      const confirmJson = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        throw new Error(
          confirmJson?.error?.message ||
          confirmJson?.detail ||
          confirmJson?.message ||
          'Failed to confirm Boubyan Link payment.'
        );
      }

      const finalized = confirmJson?.data || confirmJson;
      setBoubyanConfirmed(true);
      onSuccess(finalized);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error confirming Boubyan Link payment');
    } finally {
      setConfirmingBoubyan(false);
    }
  };

  // 2. Create online payment link (MyFatoorah / Deema)
  const handleCreatePaymentLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const createPayload: Record<string, any> = {
        customer_id: customerId,
        course_id: course.id,
        payment_option: 'payment_link',
        payment_gateway: selectedProviderId,
        notes: notes ? notes.trim() : undefined,
      };
      if (discount > 0) {
        createPayload.discount = discount;
      }

      const res = await authedFetch('/booknpay/api/v1/course-subscriptions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message ||
          json?.detail ||
          json?.message ||
          'Failed to create course subscription payment link.'
        );
      }

      const sub = json?.data || json;
      setCreatedSubscription(sub);

      let url = sub?.payment_url;
      if (!url && sub?.id) {
        // Fallback: request payment link directly
        const linkRes = await authedFetch(
          `/booknpay/api/v1/course-subscriptions/${sub.id}/payment-link/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_gateway: selectedProviderId }),
          }
        );
        const linkJson = await linkRes.json().catch(() => ({}));
        if (linkRes.ok) {
          const updatedSub = linkJson?.data || linkJson;
          url = updatedSub?.payment_url;
          setCreatedSubscription(updatedSub);
        }
      }

      setPaymentUrl(url || null);
      onSuccess(sub);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSms = async () => {
    if (!paymentUrl || !customerPhone) {
      setSmsFeedback({
        type: 'error',
        message: 'No phone number available for this customer.',
      });
      return;
    }
    setSendingSms(true);
    setSmsFeedback(null);
    try {
      const msg = `Dear ${customerName}, here is your payment link for course subscription: ${paymentUrl}`;
      const res = await sendPaymentLinkSms({
        phone_number: customerPhone,
        content: msg,
      });
      if (res.success) {
        setSmsFeedback({ type: 'success', message: 'SMS sent successfully!' });
      } else {
        setSmsFeedback({ type: 'error', message: res.message || 'Failed to send SMS.' });
      }
    } catch (err: unknown) {
      setSmsFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send SMS',
      });
    } finally {
      setSendingSms(false);
    }
  };

  const handleDone = () => {
    onClose();
  };

  const shareText = `Dear ${customerName}, please complete your payment of ${finalPrice.toFixed(3)} ${currency} for course package ${course.code || ''}: ${paymentUrl || ''}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-[#543C30] shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: 'rgba(84,60,48,0.1)' }}
            >
              <CreditCard className="h-4.5 w-4.5" style={{ color: B.espresso }} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {step === 1 ? 'Step 1 of 2: Select Payment Method' : 'Step 2 of 2: Payment Execution'}
              </p>
              <p className="text-sm font-bold text-foreground">
                {customerName} — {currency} {finalPrice.toFixed(3)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: 'rgba(84,60,48,0.1)', color: B.espresso }}
            >
              {selectedProvider.name}
            </span>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Error notification if any */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Provider Selection */}
        {step === 1 && (
          <div>
            <div className="p-6">
              <p className="text-xs text-muted-foreground mb-3.5 font-medium">
                Choose a payment provider/method below. You will then proceed to complete or share the payment link.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PROVIDERS.map((provider) => {
                  const isSelected = selectedProviderId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProviderId(provider.id)}
                      onDoubleClick={handleContinueToStep2}
                      className={cn(
                        'relative rounded-2xl border-2 bg-card p-4 text-left transition hover:shadow-md cursor-pointer flex flex-col justify-between',
                        isSelected
                          ? 'border-[#543C30] shadow-sm bg-[#543C30]/5 ring-1 ring-[#543C30]/20'
                          : 'border-border/50 hover:border-border'
                      )}
                    >
                      {isSelected && (
                        <span className="absolute top-3 right-3 text-[#543C30]">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-sm text-foreground pr-5 leading-tight">
                          {provider.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {provider.description}
                        </p>
                      </div>
                      <span
                        className="mt-3 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold self-start"
                        style={{
                          background: isSelected ? 'rgba(84,60,48,0.12)' : undefined,
                          color: isSelected ? B.espresso : undefined,
                        }}
                      >
                        {provider.tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Price Breakdown Preview */}
              <div
                className="mt-4 rounded-xl p-3 border text-xs space-y-1"
                style={{ background: B.bg, borderColor: B.linen }}
              >
                <div className="flex justify-between text-muted-foreground">
                  <span>Package: {course.name_en || course.name}</span>
                  <span>{course.total_sessions} sessions</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Course Price</span>
                  <span>{packagePrice.toFixed(3)} {currency}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-700">
                    <span>Discount</span>
                    <span>- {discount.toFixed(3)} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border/40 text-sm">
                  <span>Final Total to Pay</span>
                  <span style={{ color: B.espresso }}>{finalPrice.toFixed(3)} {currency}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4 bg-muted/20">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinueToStep2}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer hover:opacity-95 active:scale-95"
                style={{ background: B.espresso }}
              >
                <span>
                  {selectedProviderId === 'boubyan_link'
                    ? 'Continue to Reference & Confirm'
                    : 'Continue to Create Payment Link'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Provider Execution */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            {/* Provider indicator */}
            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3.5 py-2 border border-border/50 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: B.espresso }} />
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-bold text-foreground">{selectedProvider.name}</span>
              </div>
              {!boubyanConfirmed && !paymentUrl && (
                <button
                  type="button"
                  onClick={handleBackToStep1}
                  className="text-[11px] font-bold hover:underline cursor-pointer"
                  style={{ color: B.espresso }}
                >
                  Change Provider
                </button>
              )}
            </div>

            {/* CASE 1: Boubyan Link confirmed */}
            {boubyanConfirmed && (
              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 text-center space-y-3">
                <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                    Payment Confirmed via Boubyan Link!
                  </h3>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    Boubyan Link payment of {finalPrice.toFixed(3)} {currency} has been recorded and course subscription is confirmed & active.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDone}
                    className="rounded-xl px-5 py-2.5 text-xs font-bold text-white transition cursor-pointer hover:opacity-95"
                    style={{ background: B.espresso }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* CASE 2: Boubyan Link - Enter reference number */}
            {!boubyanConfirmed && selectedProviderId === 'boubyan_link' && (
              <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-2xl"
                    style={{ background: 'rgba(84,60,48,0.1)' }}
                  >
                    <Link2 className="h-5 w-5" style={{ color: B.espresso }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-foreground">Boubyan Link Payment</h3>
                    <p className="text-xs text-muted-foreground">
                      Enter the Boubyan Link payment reference number to record payment.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={boubyanRef}
                    onChange={(e) => setBoubyanRef(e.target.value)}
                    placeholder="Enter Boubyan Link reference number"
                    className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-mono font-bold outline-none focus:border-[#543C30] focus:ring-1 focus:ring-[#543C30]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Notes <span className="text-muted-foreground font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={boubyanNotes}
                    onChange={(e) => setBoubyanNotes(e.target.value)}
                    placeholder="e.g. Paid via Boubyan Link"
                    className="w-full h-10 rounded-xl border border-border bg-muted/20 px-3 text-xs font-medium outline-none focus:border-[#543C30] focus:ring-1 focus:ring-[#543C30]/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBoubyanPayment}
                  disabled={confirmingBoubyan || !boubyanRef.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-extrabold text-white shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer hover:opacity-95"
                  style={{ background: B.espresso }}
                >
                  {confirmingBoubyan ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Confirming Boubyan Link Payment…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirm Boubyan Link Payment ({finalPrice.toFixed(3)} {currency})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CASE 3: MyFatoorah / Deema - Payment link not generated yet */}
            {!paymentUrl && (selectedProviderId === 'myfatoorah' || selectedProviderId === 'deema') && (
              <div className="rounded-2xl border-2 border-dashed border-border/80 p-6 text-center space-y-4 bg-muted/10">
                <div
                  className="grid h-12 w-12 mx-auto place-items-center rounded-2xl"
                  style={{ background: 'rgba(84,60,48,0.1)' }}
                >
                  <Link2 className="h-6 w-6" style={{ color: B.espresso }} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Ready to Create Payment Link</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Click below to generate a hosted {selectedProvider.name} payment link for this course subscription.
                  </p>
                </div>

                <div
                  className="p-3 rounded-xl border text-xs text-left space-y-1"
                  style={{ background: B.cardBg, borderColor: B.linen }}
                >
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Course</span>
                    <span className="font-semibold">{course.name_en || course.name}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total Amount</span>
                    <span style={{ color: B.espresso }}>{finalPrice.toFixed(3)} {currency}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePaymentLink}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-extrabold text-white transition disabled:opacity-60 shadow-sm cursor-pointer hover:opacity-95"
                  style={{ background: B.espresso }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Creating Payment Link…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Create and Share Payment Link</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CASE 4: Payment Link is created and ready */}
            {paymentUrl && (
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Status</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Payment Link Active
                  </span>
                </div>

                {/* Link display & copy */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Payment URL</label>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-2">
                    <input
                      type="text"
                      readOnly
                      value={paymentUrl}
                      className="flex-1 bg-transparent text-xs font-mono font-medium outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90"
                      style={{ background: B.espresso }}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Share buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={whatsappShareUrl(customerPhone, shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 transition cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleSendSms}
                    disabled={sendingSms}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2 px-3 transition cursor-pointer disabled:opacity-50"
                  >
                    {sendingSms ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                    <span>Send SMS</span>
                  </button>
                </div>

                {smsFeedback && (
                  <p
                    className={cn(
                      'text-xs font-medium text-center',
                      smsFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                    )}
                  >
                    {smsFeedback.message}
                  </p>
                )}

                {/* QR Code */}
                <div className="pt-2 flex flex-col items-center justify-center border-t border-border/40">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Scan to Pay</p>
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
                    <QRCodeSVG value={paymentUrl} size={130} />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDone}
                    className="rounded-xl px-5 py-2 text-xs font-bold text-white transition cursor-pointer hover:opacity-95"
                    style={{ background: B.espresso }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

