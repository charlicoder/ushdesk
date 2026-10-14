/**
 * Payment links API client (ushbooknpay → /payment-links).
 *
 * Gateway-agnostic: backend supports gateways (MyFatoorah, etc.); the UI deals with the
 * generic PaymentLink shape.
 */
import { authedFetch } from '@/lib/authedFetch';

const BASE = '/booknpay/api/v1/payment-links';

export type PaymentLinkTarget = 'booking' | 'voucher' | 'gift_voucher' | 'product';

export interface PaymentLink {
  id: string;
  link_number?: string | null;
  payment_id?: string; // alias for backwards compatibility
  payment_number?: string;
  status: string;
  payment_url: string | null;
  gateway?: string;
  provider: string | null;
  gateway_invoice_id?: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  amount: string;
  amount_refunded: string;
  currency: string;
  target_type: PaymentLinkTarget | null;
  target_id: string | null;
  target_ref?: string | null;
  expires_at: string | null;
  is_expired: boolean;
  paid_at: string | null;
  created_at?: string | null;
  needs_attention?: string | null;
}

export interface PaymentLinkRefund {
  refund_id: string;
  refund_number: string;
  status: string;
  refunded_amount: string;
  currency: string;
  gateway_refund_id: string | null;
}

export const PAYMENT_PERMISSIONS = {
  LIST: 'payment_links.list',
  VIEW: 'payment_links.view',
  CREATE: 'payment_links.create',
  CANCEL: 'payment_links.cancel',
  REFUND: 'payment_links.refund',
} as const;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | string | undefined;
    const nested = err && typeof err === 'object' ? (err.message ?? err.detail) : err;
    const msg = nested ?? json.detail ?? json.message ?? `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return ((json.data as T | undefined) ?? (json as unknown as T));
}

export const paymentLinksApi = {
  create: (
    target_type: PaymentLinkTarget,
    target_id: string,
    opts: {
      amount?: number | string | null;
      force_new?: boolean;
      invoice_id?: string | null;
      invoice_number?: string | null;
      gateway?: string | null;
      expiry_minutes?: number;
    } = {}
  ) => {
    const payload: Record<string, unknown> = {
      target_type,
      target_id,
    };
    if (opts.amount !== undefined && opts.amount !== null) payload.amount = opts.amount;
    if (opts.gateway) payload.gateway = opts.gateway;
    if (opts.force_new !== undefined) payload.force_new = opts.force_new;
    if (opts.expiry_minutes !== undefined) payload.expiry_minutes = opts.expiry_minutes;
    if (opts.invoice_id) payload.invoice_id = opts.invoice_id;
    if (opts.invoice_number) payload.invoice_number = opts.invoice_number;
    return request<PaymentLink>('/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  list: (target_type: PaymentLinkTarget, target_id: string) =>
    request<PaymentLink[]>(`/?target_type=${target_type}&target_id=${encodeURIComponent(target_id)}`),

  get: (linkId: string) => request<PaymentLink>(`/${linkId}/`),

  sync: (linkId: string) => request<PaymentLink>(`/${linkId}/sync/`, { method: 'POST' }),

  cancel: (linkId: string) => request<PaymentLink>(`/${linkId}/cancel/`, { method: 'POST' }),

  refund: (linkId: string, body: { amount?: number; reason?: string } = {}) =>
    request<PaymentLinkRefund>(`/${linkId}/refund/`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  delete: (linkId: string) =>
    request<{ success: boolean; deleted_id: string }>(`/${linkId}/`, {
      method: 'DELETE',
    }),

  deleteForTarget: (target_type: PaymentLinkTarget, target_id: string) =>
    request<{ success: boolean; deleted_count: number }>(
      `/?target_type=${target_type}&target_id=${encodeURIComponent(target_id)}`,
      { method: 'DELETE' }
    ),
};

/** Builds a WhatsApp share URL (wa.me) with the link in the message. */
export function whatsappShareUrl(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Builds an sms: URI so the staff device can send the link as an SMS. */
export function smsShareUrl(phone: string | null | undefined, text: string): string {
  const p = (phone ?? '').replace(/[^\d+]/g, '');
  return `sms:${p}?body=${encodeURIComponent(text)}`;
}
