'use client';

/**
 * PaymentLinkPanel — create / share / track a gateway payment link for a
 * booking or gift voucher. Gateway-agnostic (talks to /payment-links).
 *
 * - Creates the link on demand (or automatically with `autoCreate`).
 * - Share via copy, WhatsApp or SMS (staff-initiated; our system sends nothing).
 * - "Check status" re-verifies with the gateway; the webhook updates data
 *   automatically, this is only a manual fallback.
 * - Cancel / refund actions are shown only with the right permission.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink, Link2, Loader2,
  MessageCircle, MessageSquare, RefreshCw, Undo2, XCircle,
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import {
  PAYMENT_PERMISSIONS, paymentLinksApi, smsShareUrl, whatsappShareUrl,
  type PaymentLink, type PaymentLinkTarget,
} from '@/lib/paymentLinks';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

interface Props {
  targetType: PaymentLinkTarget;
  targetId: string;
  customerPhone?: string | null;
  customerName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  gateway?: string | null;
  autoCreate?: boolean;
  /** Called when the gateway reports the payment as paid. */
  onPaid?: (link: PaymentLink) => void;
  className?: string;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  initiated: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  created: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
  refunded: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  partially_refunded: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
};

const OPEN_STATUSES = ['created', 'initiated', 'pending', 'failed'];
const POLL_MS = 8000;

export function PaymentLinkPanel({
  targetType,
  targetId,
  customerPhone,
  customerName,
  invoiceId,
  invoiceNumber,
  gateway,
  autoCreate = false,
  onPaid,
  className,
}: Props) {
  const { can } = usePermissions();
  const canCreate = can(PAYMENT_PERMISSIONS.CREATE);
  const canCancel = can(PAYMENT_PERMISSIONS.CANCEL);
  const canRefund = can(PAYMENT_PERMISSIONS.REFUND);
  const canView = can(PAYMENT_PERMISSIONS.VIEW) || can(PAYMENT_PERMISSIONS.LIST);

  const [link, setLink] = useState<PaymentLink | null>(null);
  const [busy, setBusy] = useState<null | 'create' | 'sync' | 'cancel' | 'refund'>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const paidNotified = useRef(false);
  const autoCreated = useRef(false);

  const apply = useCallback((next: PaymentLink) => {
    setLink(next);
    if ((next.status === 'success' || next.status === 'paid') && !paidNotified.current) {
      paidNotified.current = true;
      onPaid?.(next);
    }
  }, [onPaid]);

  const run = useCallback(async (kind: NonNullable<typeof busy>, fn: () => Promise<PaymentLink | void>) => {
    setBusy(kind); setError(null);
    try {
      const out = await fn();
      if (out) apply(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }, [apply]);

  const create = useCallback((forceNew = false) =>
    run('create', async () => {
      let resolvedInvId = invoiceId;
      let resolvedInvNum = invoiceNumber;
      if (targetType === 'booking' && (!resolvedInvId || !resolvedInvNum)) {
        try {
          const res = await authedFetch(`/booknpay/api/v1/bookings/${targetId}/`);
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            const data = json.data ?? json;
            if (data) {
              if (!resolvedInvId && data.invoice_id) resolvedInvId = String(data.invoice_id);
              if (!resolvedInvNum && data.invoice_number) resolvedInvNum = String(data.invoice_number);
            }
          }
        } catch {
          // ignore lookup error and proceed
        }
      }
      return paymentLinksApi.create(targetType, targetId, {
        force_new: forceNew,
        invoice_id: resolvedInvId,
        invoice_number: resolvedInvNum,
        gateway: gateway,
      });
    }),
  [run, targetType, targetId, invoiceId, invoiceNumber, gateway]);

  // Load the latest link for this target (if allowed), else auto-create.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (canView) {
        try {
          const items = await paymentLinksApi.list(targetType, targetId);
          const latest = Array.isArray(items) && items.length ? items[0] : null;
          if (!cancelled && latest) { apply(latest); return; }
        } catch { /* fall through to auto-create */ }
      }
      if (!cancelled && autoCreate && canCreate && !autoCreated.current) {
        autoCreated.current = true;
        void create(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  // Light polling while the link is open so staff see the payment land.
  useEffect(() => {
    const linkId = link ? (link.id || link.payment_id) : null;
    if (!link || !linkId || !OPEN_STATUSES.includes(link.status) || link.is_expired || !canView) return;
    const t = setInterval(() => {
      paymentLinksApi.sync(linkId).then(apply).catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [link, apply, canView]);

  const message = link?.payment_url
    ? `Hello${customerName ? ` ${customerName}` : ''}, please complete your USH Spa payment of ${link.amount} ${link.currency} using this secure link: ${link.payment_url}`
    : '';

  const copy = async () => {
    if (!link?.payment_url) return;
    await navigator.clipboard.writeText(link.payment_url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (!canCreate && !link) {
    return (
      <div className={cn('rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground', className)}>
        You do not have permission to create payment links.
      </div>
    );
  }

  const isPaid = link?.status === 'success' || link?.status === 'paid';
  const isOpen = !!link && OPEN_STATUSES.includes(link.status) && !link.is_expired && !isPaid;
  const refundable = isPaid && Number(link.amount_refunded) < Number(link.amount);
  const linkId = link ? (link.id || link.payment_id) : null;

  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-extrabold">Payment Link</p>
        </div>
        {link && (
          <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            STATUS_STYLE[link.is_expired && isOpen === false && !isPaid ? 'cancelled' : link.status] ?? STATUS_STYLE.pending)}>
            {link.is_expired && !isPaid ? 'expired' : link.status.replace('_', ' ')}
          </span>
        )}
      </div>

      {!link && (
        <button type="button" onClick={() => create(false)} disabled={busy !== null || !canCreate}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60">
          {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {busy === 'create' ? 'Creating link…' : 'Create and Share Payment Link'}
        </button>
      )}

      {link && (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Amount</p>
              <p className="text-lg font-black text-primary leading-none">
                {link.amount} <span className="text-[10px] font-semibold">{link.currency}</span>
              </p>
              {link.invoice_number && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Invoice: <span className="font-mono font-medium">{link.invoice_number}</span>
                </p>
              )}
            </div>
            {link.expires_at && !isPaid && (
              <p className="text-[10px] text-muted-foreground text-right">
                {link.is_expired ? 'Expired' : 'Expires'} {new Date(link.expires_at).toLocaleString()}
              </p>
            )}
          </div>

          {isPaid && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Payment received{link.paid_at ? ` · ${new Date(link.paid_at).toLocaleString()}` : ''}
              </p>
            </div>
          )}

          {link.needs_attention && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">{link.needs_attention}</p>
            </div>
          )}

          {isOpen && link.payment_url && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                <p className="flex-1 min-w-0 truncate text-xs font-mono" title={link.payment_url}>{link.payment_url}</p>
                <button type="button" onClick={copy} aria-label="Copy payment link"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted transition">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                <a href={link.payment_url} target="_blank" rel="noopener noreferrer" aria-label="Open payment link"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted transition">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={whatsappShareUrl(customerPhone, message)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <a href={smsShareUrl(customerPhone, message)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-2 text-xs font-bold hover:bg-muted transition">
                  <MessageSquare className="h-4 w-4" /> SMS
                </a>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {canView && linkId && (
              <button type="button" onClick={() => run('sync', () => paymentLinksApi.sync(linkId))}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold hover:bg-muted transition disabled:opacity-60">
                <RefreshCw className={cn('h-3.5 w-3.5', busy === 'sync' && 'animate-spin')} /> Check status
              </button>
            )}
            {!isPaid && canCreate && (link.is_expired || ['cancelled', 'failed'].includes(link.status)) && (
              <button type="button" onClick={() => create(true)} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition disabled:opacity-60">
                <Link2 className="h-3.5 w-3.5" /> New link
              </button>
            )}
            {isOpen && canCancel && linkId && (
              <button type="button" disabled={busy !== null}
                onClick={() => run('cancel', () => paymentLinksApi.cancel(linkId))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition disabled:opacity-60">
                <XCircle className="h-3.5 w-3.5" /> Cancel link
              </button>
            )}
            {refundable && canRefund && linkId && (
              <button type="button" disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm('Refund the full remaining amount to the customer through the payment gateway?')) return;
                  void run('refund', async () => {
                    await paymentLinksApi.refund(linkId, { reason: 'Refund requested from USH Desk' });
                    return paymentLinksApi.sync(linkId);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/50 bg-sky-50/60 dark:bg-sky-950/20 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition disabled:opacity-60">
                <Undo2 className="h-3.5 w-3.5" /> {busy === 'refund' ? 'Refunding…' : 'Refund'}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
