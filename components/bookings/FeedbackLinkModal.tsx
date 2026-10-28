'use client';

import React, { useState } from 'react';
import {
  Star, X, Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink,
  MessageCircle, MessageSquare, QrCode, Link2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { whatsappShareUrl, sendPaymentLinkSms } from '@/lib/paymentLinks';
import {
  feedbackApi,
  feedbackShareText,
  type CreateFeedbackLinkPayload,
  type FeedbackLink,
} from '@/lib/feedback';

interface FeedbackLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Booking snapshot sent to ushanr when the link is generated. */
  payload: CreateFeedbackLinkPayload;
}

/**
 * Shown after a booking moves InProgress → Completed.
 *   1. Prompt: "Generate feedback link?"  (Yes / No)
 *   2. Result: unique link + QR code + Copy / WhatsApp / SMS.
 */
export function FeedbackLinkModal({ isOpen, onClose, payload }: FeedbackLinkModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<FeedbackLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const lang = payload.language === 'en' ? 'en' : 'ar';
  const phone = payload.customer_phone?.trim() || null;
  const shareText = link ? feedbackShareText(link.feedback_url, payload.customer_name, lang) : '';
  const submitted = link?.status === 'submitted';

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      setLink(await feedbackApi.createLink(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create feedback link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.feedback_url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendSms = async () => {
    if (!link) return;
    if (!phone) {
      setSmsFeedback({ type: 'error', message: 'Customer phone number is required to send SMS.' });
      return;
    }
    setSendingSms(true);
    setSmsFeedback(null);
    try {
      await sendPaymentLinkSms({ phone_number: phone, content: shareText, language: lang });
      setSmsFeedback({ type: 'success', message: 'Feedback link SMS sent to customer.' });
    } catch (err) {
      setSmsFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send SMS.' });
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-primary to-amber-400" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
              <Star className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-foreground">Customer Feedback</h2>
              <p className="text-[11px] font-medium text-muted-foreground">
                {payload.booking_number ? `Booking ${payload.booking_number}` : 'Booking completed'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          {/* Step 1 — prompt */}
          {!link && (
            <>
              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50/60 p-4 text-center dark:bg-emerald-950/30">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-2 text-sm font-extrabold text-emerald-800 dark:text-emerald-200">
                  Booking completed
                </p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Do you want to generate a feedback link
                  {payload.customer_name ? ` for ${payload.customer_name}` : ''}?
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="cursor-pointer rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
                >
                  No, skip
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  {loading ? 'Generating…' : error ? 'Retry' : 'Yes, generate link'}
                </button>
              </div>
            </>
          )}

          {/* Step 2 — result */}
          {link && (
            <>
              {submitted ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 p-3 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Feedback already submitted</p>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      The customer has already rated this booking. View it in UshSpa → Feedback.
                    </p>
                  </div>
                </div>
              ) : (
                !link.created && (
                  <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    A feedback link already exists for this booking — showing the same link.
                  </div>
                )
              )}

              {!submitted && (
                <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-muted/20 p-4 text-center">
                  <div className="inline-block rounded-2xl border border-border/60 bg-white p-3 shadow-xs">
                    <QRCodeSVG value={link.feedback_url} size={160} level="M" includeMargin={false} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-muted-foreground">
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-foreground/80">Scan QR code to give feedback</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Feedback link
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2 text-xs">
                  <span className="flex-1 select-all truncate font-mono text-[11px] text-foreground">{link.feedback_url}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy link"
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={link.feedback_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link"
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {!submitted && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-muted/40 py-2.5 text-xs font-bold transition hover:bg-muted"
                  >
                    <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={whatsappShareUrl(phone, shareText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={handleSendSms}
                    disabled={sendingSms}
                    className={cn(
                      'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-muted/40 py-2.5 text-xs font-bold transition hover:bg-muted disabled:opacity-60',
                    )}
                  >
                    {sendingSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} SMS
                  </button>
                </div>
              )}

              {smsFeedback && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
                    smsFeedback.type === 'success'
                      ? 'border border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border border-destructive/30 bg-destructive/10 text-destructive',
                  )}
                >
                  {smsFeedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{smsFeedback.message}</span>
                </div>
              )}

              <div className="flex justify-end border-t border-border/40 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

