'use client';

/**
 * MyReferralLinkButton
 *
 * Shows the logged-in employee's personal gift-voucher affiliate link
 * (<ushweb>/gift-voucher?ref=<referral_number>) with Copy / WhatsApp / SMS actions.
 * Sales made through the link are stored on the voucher as `referenced_by`.
 *
 * The ushweb base URL comes from NEXT_PUBLIC_USHWEB. Renders nothing when the
 * Always rendered for staff; when the account has no referral number (e.g. an admin
 * without an employee profile) the popup explains how to get one.
 */

import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, MessageCircle, MessageSquare, X } from 'lucide-react';
import { smsShareUrl, whatsappShareUrl } from '@/lib/paymentLinks';

function getReferralBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_USHWEB || process.env.USHWEB || 'http://127.0.0.1:3001').trim();
  return env.endsWith('/') ? env.slice(0, -1) : env;
}

export function MyReferralLinkButton() {
  const [referral, setReferral] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') : null;
    if (!token) {
      setLoaded(true);
      return;
    }
    fetch('/api/v1/employees/me', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        const emp = (json?.data ?? json?.employee ?? json) as Record<string, unknown>;
        const ref = emp?.referral_number;
        if (typeof ref === 'string' && /^\d{4}$/.test(ref)) setReferral(ref);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const link = referral ? `${getReferralBaseUrl()}/gift-voucher?ref=${referral}` : '';
  const message = `Send the perfect gift with USH Wellness: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy your referral link:', link);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-muted/60 active:scale-[0.98] shrink-0"
        title="Share your personal gift voucher referral link"
      >
        <Link2 className="h-4 w-4 text-primary" />
        My Referral Link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-foreground">My Referral Link</h3>
                <p className="text-xs text-muted-foreground">
                  {referral
                    ? `Gift vouchers bought through this link are credited to you (code ${referral}).`
                    : 'Personal link for crediting gift voucher sales to you.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!referral ? (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {loaded
                  ? 'No referral number is assigned to your account (admin accounts without an employee profile have none). Ask an administrator to assign one on your employee record.'
                  : 'Loading your referral number…'}
              </div>
            ) : (
              <>
                <div className="break-all rounded-xl border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs text-foreground">
                  {link}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-sm font-bold hover:bg-muted/60"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(whatsappShareUrl('', message), '_blank', 'noopener,noreferrer')}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = smsShareUrl('', message);
                    }}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary/90"
                  >
                    <MessageSquare className="h-4 w-4" /> SMS
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

