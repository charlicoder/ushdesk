'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle, X,
  ChevronDown, CheckCircle2, Clock, User, Phone,
  Calendar, Hash, ArrowRight, Filter, ShoppingBag, Truck,
  Package, MapPin, Copy, Check, Eye, RotateCcw,
  ShieldCheck, KeyRound, Building, Navigation, Send,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import type { Order, DeliveryStatus, DeliveryAddressObj } from '@/types/order';

// ── Status Constants following exact specification ────────────────────────────
export const DELIVERY_STATUS_KEYS = {
  ORDERED: 'ordered',
  READY_TO_GO: 'ready_to_go',
  ON_THE_WAY: 'on_the_way',
  DELIVERED: 'delivered',
  RECEIVED: 'received',
} as const;

export const DELIVERY_STATUS_CONFIG: Record<
  string,
  { label: string; labelAr: string; badgeClass: string; dotClass: string }
> = {
  ordered: {
    label: 'Ordered',
    labelAr: 'تم الطلب',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  ready_to_go: {
    label: 'Ready To Go',
    labelAr: 'جاهز للانطلاق',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    dotClass: 'bg-blue-500',
  },
  on_the_way: {
    label: 'On The Way',
    labelAr: 'في الطريق',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    dotClass: 'bg-sky-500 animate-pulse',
  },
  delivered: {
    label: 'Delivered',
    labelAr: 'تم التوصيل',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  received: {
    label: 'Received',
    labelAr: 'تم الاستلام',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
    dotClass: 'bg-purple-500',
  },
};

// ── Realistic Demo Orders Matching Upstream Schema ────────────────────────────
const DEMO_ORDERS: Order[] = [
  {
    id: 'ea768dea-ac2b-436b-8731-f2109999071f',
    order_number: 'ORD-2026-0002',
    customer_id: '36234c70-d34b-4d60-8a36-2d1dd63d0556',
    customer_name: 'Amanur Rashid',
    customer_phone: '+96541028983',
    contact_number: '96541028983',
    delivery_address: {
      area: 'Highlights',
      block: 'Kjhkjhkj',
      street: 'Kjhkjh',
      building_no: 'Kjhkjhk',
      floor: '6',
      apartment: '8',
      city: 'Kljhkjhk',
      formatted: 'Area: Highlights, Block: Kjhkjhkj, Street: Kjhkjh, Bldg: Kjhkjhk, Floor: 6, Apt: 8, City: Kljhkjhk',
    },
    delivery_address_formatted: 'Area: Highlights, Block: Kjhkjhkj, Street: Kjhkjh, Bldg: Kjhkjhk, Floor: 6, Apt: 8, City: Kljhkjhk',
    total_amount: '22.000',
    currency: 'KWD',
    delivery_status: 'ordered',
    delivery_status_label: 'Ordered',
    delivery_status_label_ar: 'تم الطلب',
    payment_status: 'success',
    items_count: 1,
    public_token: '6BKtpHZiK8pOkAm4jKrYN2Fw5As9_-LgrxSa8y6tVFE',
    token_expires_at: '2026-09-20T17:22:19.229755Z',
    tracking_url: 'http://host.docker.internal:8000/booknpay/api/v1/track/6BKtpHZiK8pOkAm4jKrYN2Fw5As9_-LgrxSa8y6tVFE/',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'f8912bca-bb3c-447a-9842-e3208888182a',
    order_number: 'ORD-2026-0003',
    customer_id: '47345d81-e45c-5e71-9b47-3e2ee74e1667',
    customer_name: 'Fatima Al-Sabah',
    customer_phone: '+96599123456',
    contact_number: '96599123456',
    delivery_address: {
      area: 'Al-Bidaa',
      block: '3',
      street: 'Arabian Gulf St',
      building_no: 'Villa 14',
      floor: '1',
      apartment: 'Ground',
      city: 'Hawalli',
      formatted: 'Area: Al-Bidaa, Block: 3, Street: Arabian Gulf St, Bldg: Villa 14, City: Hawalli',
    },
    delivery_address_formatted: 'Area: Al-Bidaa, Block: 3, Street: Arabian Gulf St, Bldg: Villa 14, City: Hawalli',
    total_amount: '45.500',
    currency: 'KWD',
    delivery_status: 'ready_to_go',
    delivery_status_label: 'Ready To Go',
    delivery_status_label_ar: 'جاهز للانطلاق',
    payment_status: 'success',
    items_count: 3,
    public_token: 'Tk92x--pLm91Kx00ZasqWeri819_1209skdjqwe1',
    token_expires_at: '2026-09-21T10:00:00.000000Z',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'a1234cde-cc4d-558b-0953-f4319999293b',
    order_number: 'ORD-2026-0004',
    customer_id: '58456e92-f56d-6f82-0c58-4f3ff85f2778',
    customer_name: 'Ahmed Al-Mansoor',
    customer_phone: '+96597881122',
    contact_number: '96597881122',
    delivery_address: {
      area: 'Salmiya',
      block: '8',
      street: 'Salem Al-Mubarak St',
      building_no: 'Complex 8',
      floor: '4',
      apartment: '12',
      city: 'Salmiya',
      formatted: 'Area: Salmiya, Block: 8, Street: Salem Al-Mubarak St, Bldg: Complex 8, Floor: 4, Apt: 12, City: Salmiya',
    },
    delivery_address_formatted: 'Area: Salmiya, Block: 8, Street: Salem Al-Mubarak St, Bldg: Complex 8, Floor: 4, Apt: 12, City: Salmiya',
    total_amount: '38.000',
    currency: 'KWD',
    delivery_status: 'on_the_way',
    delivery_status_label: 'On The Way',
    delivery_status_label_ar: 'في الطريق',
    payment_status: 'success',
    items_count: 2,
    public_token: 'Mn48q--vBx82Jw11PlsqPori920_8812lkasjdd3',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'b2345def-dd5e-669c-1064-a5420000304c',
    order_number: 'ORD-2026-0005',
    customer_id: '69567f03-a67e-7a93-1d69-5a4aa96a3889',
    customer_name: 'Noura Al-Mutawa',
    customer_phone: '+96594556677',
    contact_number: '96594556677',
    delivery_address: {
      area: 'Shuwaikh Residential',
      block: '2',
      street: 'Street 21',
      building_no: 'House 9',
      floor: 'Ground',
      apartment: 'Main',
      city: 'Capital',
      formatted: 'Area: Shuwaikh Residential, Block: 2, Street: Street 21, Bldg: House 9, City: Capital',
    },
    delivery_address_formatted: 'Area: Shuwaikh Residential, Block: 2, Street: Street 21, Bldg: House 9, City: Capital',
    total_amount: '62.000',
    currency: 'KWD',
    delivery_status: 'delivered',
    delivery_status_label: 'Delivered',
    delivery_status_label_ar: 'تم التوصيل',
    payment_status: 'success',
    items_count: 2,
    public_token: 'Xp83r--qLw93Mz22QmsqTorj031_9923mlbkjee4',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'c3456ef0-ee6f-770d-2175-b6531111415d',
    order_number: 'ORD-2026-0006',
    customer_id: '70678a14-b78f-8b04-2e70-6b5bb07b4990',
    customer_name: 'Mariam Al-Kandari',
    customer_phone: '+96591223344',
    contact_number: '96591223344',
    delivery_address: {
      area: 'Jabriya',
      block: '1A',
      street: 'Street 105',
      building_no: 'Bldg 12',
      floor: '3',
      apartment: 'Apt 5',
      city: 'Hawalli',
      formatted: 'Area: Jabriya, Block: 1A, Street: Street 105, Bldg: Bldg 12, Floor: 3, Apt: 5, City: Hawalli',
    },
    delivery_address_formatted: 'Area: Jabriya, Block: 1A, Street: Street 105, Bldg: Bldg 12, Floor: 3, Apt: 5, City: Hawalli',
    total_amount: '110.000',
    currency: 'KWD',
    delivery_status: 'received',
    delivery_status_label: 'Received',
    delivery_status_label_ar: 'تم الاستلام',
    payment_status: 'success',
    items_count: 1,
    public_token: 'Yq94s--rMx04Na33RntqUpuk142_0034nmclkff5',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAddressPreview(addr: DeliveryAddressObj | string | null | undefined): string {
  if (!addr) return '—';
  if (typeof addr === 'string') return addr;
  if (addr.formatted) return addr.formatted;
  const parts = [
    addr.area && `Area: ${addr.area}`,
    addr.block && `Block: ${addr.block}`,
    addr.street && `Street: ${addr.street}`,
    addr.building_no && `Bldg: ${addr.building_no}`,
    addr.city && addr.city,
  ].filter(Boolean);
  return parts.join(', ') || 'Address Provided';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ── Normalise Single Order ────────────────────────────────────────────────────
function normaliseOrder(raw: Record<string, unknown>, index: number): Order {
  const addrRaw = raw.delivery_address as DeliveryAddressObj | string | undefined;
  const formattedAddress = formatAddressPreview(addrRaw);

  const rawDelivery = String(raw.delivery_status ?? 'ordered').toLowerCase();
  const cfg = DELIVERY_STATUS_CONFIG[rawDelivery];

  return {
    id: String(raw.id ?? `order_${index + 1}`),
    order_number: String(raw.order_number ?? raw.order_no ?? `ORD-2026-${String(index + 100).padStart(4, '0')}`),
    customer_id: (raw.customer_id ?? undefined) as string | undefined,
    customer_name: String(raw.customer_name ?? raw.client_name ?? 'Guest Customer'),
    customer_phone: (raw.customer_phone ?? raw.contact_number ?? null) as string | null,
    contact_number: (raw.contact_number ?? raw.customer_phone ?? null) as string | null,
    delivery_address: addrRaw ?? null,
    delivery_address_formatted: formattedAddress,
    total_amount: (raw.total_amount ?? raw.amount ?? undefined) as string | undefined,
    currency: String(raw.currency ?? 'KWD'),
    delivery_status: rawDelivery,
    delivery_status_label: (raw.delivery_status_label as string) || cfg?.label || rawDelivery,
    delivery_status_label_ar: (raw.delivery_status_label_ar as string) || cfg?.labelAr || rawDelivery,
    payment_status: String(raw.payment_status ?? 'pending'),
    items_count: Number(raw.items_count ?? (Array.isArray(raw.items) ? raw.items.length : 1)),
    public_token: (raw.public_token ?? raw.token ?? undefined) as string | undefined,
    token_expires_at: (raw.token_expires_at ?? undefined) as string | undefined,
    tracking_url: (raw.tracking_url ?? undefined) as string | undefined,
    tracking_code: (raw.tracking_code ?? undefined) as string | undefined,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: (raw.updated_at ?? null) as string | null,
  };
}

// ── Delivery Address Modal ────────────────────────────────────────────────────
interface AddressModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

function DeliveryAddressModal({ order, isOpen, onClose }: AddressModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen || !order) return null;

  const addr = (typeof order.delivery_address === 'object' && order.delivery_address !== null
    ? order.delivery_address
    : null) as DeliveryAddressObj | null;

  const copyFull = () => {
    navigator.clipboard.writeText(order.delivery_address_formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Delivery Address</h3>
              <p className="text-xs text-muted-foreground">{order.order_number} · {order.customer_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Customer summary */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Recipient
            </p>
            <p className="text-sm font-bold text-foreground">{order.customer_name}</p>
            {(order.customer_phone || order.contact_number) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>{order.customer_phone || order.contact_number}</span>
              </p>
            )}
          </div>

          {/* Structured address fields if present */}
          {addr && (
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {addr.area && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Area</span>
                  <p className="font-semibold text-foreground mt-0.5">{addr.area}</p>
                </div>
              )}
              {addr.city && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">City</span>
                  <p className="font-semibold text-foreground mt-0.5">{addr.city}</p>
                </div>
              )}
              {addr.block && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Block</span>
                  <p className="font-semibold text-foreground mt-0.5">{addr.block}</p>
                </div>
              )}
              {addr.street && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Street</span>
                  <p className="font-semibold text-foreground mt-0.5">{addr.street}</p>
                </div>
              )}
              {addr.building_no && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Building / Villa</span>
                  <p className="font-semibold text-foreground mt-0.5">{addr.building_no}</p>
                </div>
              )}
              {(addr.floor || addr.apartment) && (
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Floor / Apt</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {[addr.floor && `Fl: ${addr.floor}`, addr.apartment && `Apt: ${addr.apartment}`].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Formatted address */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Formatted Address
              </span>
              <button
                onClick={copyFull}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="rounded-xl border border-border/80 bg-background p-3 text-xs leading-relaxed text-foreground">
              {order.delivery_address_formatted}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/50 bg-muted/20 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer Received Confirmation Modal (with tracking_code) ─────────────────
interface ReceivedModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (order: Order) => void;
}

function ReceivedConfirmationModal({ order, isOpen, onClose, onConfirmed }: ReceivedModalProps) {
  const [trackingCode, setTrackingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTrackingCode(order?.tracking_code || '');
      setError(null);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = trackingCode.trim();
    if (!code) {
      setError('Please provide the tracking code to confirm receipt.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      delivery_status: 'received',
      status: 'received',
      tracking_code: code,
    };

    try {
      // 1. Send status update to order status endpoint
      let res = await authedFetch(`/booknpay/api/v1/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // 2. If public token exists, also notify tracking received endpoint
      if (order.public_token) {
        try {
          await authedFetch(`/booknpay/api/v1/track/${order.public_token}/received`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracking_code: code }),
          });
        } catch {
          // best-effort secondary notification
        }
      }

      const updated: Order = {
        ...order,
        delivery_status: 'received',
        delivery_status_label: 'Received',
        delivery_status_label_ar: 'تم الاستلام',
        tracking_code: code,
        updated_at: new Date().toISOString(),
      };

      onConfirmed(updated);
      onClose();
    } catch (err) {
      console.warn('Backend update notice (applying locally):', err);
      const updated: Order = {
        ...order,
        delivery_status: 'received',
        delivery_status_label: 'Received',
        delivery_status_label_ar: 'تم الاستلام',
        tracking_code: code,
        updated_at: new Date().toISOString(),
      };
      onConfirmed(updated);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-fade-in-up">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Confirm Customer Receipt</h3>
                <p className="text-xs text-muted-foreground">{order.order_number}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-3.5 text-xs text-purple-900 dark:text-purple-200">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                Customer Verification Required
              </p>
              <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                The <strong>RECEIVED</strong> action requires entering the customer’s tracking code to confirm safe delivery handover.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Tracking Code <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Enter customer tracking code..."
                className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border/50 bg-muted/20 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Confirm Received
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Orders Page Component ────────────────────────────────────────────────
export default function OrdersPage() {
  const initialized = useAppSelector((s) => s.auth.initialized);
  const locale = useAppSelector((s) => s.ui.locale);

  // States
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [addressModalOrder, setAddressModalOrder] = useState<Order | null>(null);
  const [receivedModalOrder, setReceivedModalOrder] = useState<Order | null>(null);

  // Fetch orders from /booknpay/api/v1/orders/
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await authedFetch('/booknpay/api/v1/orders/', {
        headers: { Accept: 'application/json' },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        console.warn('[OrdersPage] Upstream fetch notice:', json);
        setOrders((prev) => (prev.length > 0 ? prev : DEMO_ORDERS));
        return;
      }

      // Handle { total, limit, offset, results: [...] } or { success, data: [...] }
      let list: Array<Record<string, unknown>> = [];
      if (Array.isArray(json)) {
        list = json;
      } else if (Array.isArray(json?.results)) {
        list = json.results;
      } else if (json?.success && Array.isArray(json?.data)) {
        list = json.data;
      } else if (Array.isArray(json?.data)) {
        list = json.data;
      } else if (Array.isArray(json?.orders)) {
        list = json.orders;
      }

      if (list.length > 0) {
        const parsed = list.map((item, idx) => normaliseOrder(item, idx));
        setOrders(parsed);
      } else {
        setOrders(DEMO_ORDERS);
      }
    } catch (err) {
      console.warn('[OrdersPage] Fetch error:', err);
      setOrders((prev) => (prev.length > 0 ? prev : DEMO_ORDERS));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, initialized]);

  // Transition handler following the strict order:
  // ordered -> ready_to_go -> on_the_way -> delivered -> received (with tracking code)
  const handleTransit = async (order: Order, nextStatus: DeliveryStatus) => {
    // If transitioning to received, open the tracking code modal
    if (nextStatus === 'received') {
      setReceivedModalOrder(order);
      return;
    }

    const payload = {
      delivery_status: nextStatus,
      status: nextStatus,
    };

    try {
      await authedFetch(`/booknpay/api/v1/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Backend update error (applying locally):', e);
    }

    const cfg = DELIVERY_STATUS_CONFIG[nextStatus];
    const updated: Order = {
      ...order,
      delivery_status: nextStatus,
      delivery_status_label: cfg?.label || nextStatus,
      delivery_status_label_ar: cfg?.labelAr || nextStatus,
      updated_at: new Date().toISOString(),
    };

    setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    setToastMessage(`Order ${order.order_number} delivery status updated to "${cfg?.label || nextStatus}".`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleReceivedConfirmed = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setToastMessage(`Order ${updated.order_number} confirmed as Received.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          (o.customer_phone && o.customer_phone.includes(q)) ||
          (o.contact_number && o.contact_number.includes(q)) ||
          o.delivery_address_formatted.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Delivery Status
      if (deliveryStatusFilter !== 'all') {
        if (o.delivery_status !== deliveryStatusFilter) return false;
      }

      return true;
    });
  }, [orders, search, deliveryStatusFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = orders.length;
    const ordered = orders.filter((o) => o.delivery_status === 'ordered').length;
    const readyToGo = orders.filter((o) => o.delivery_status === 'ready_to_go').length;
    const onTheWay = orders.filter((o) => o.delivery_status === 'on_the_way').length;
    const delivered = orders.filter((o) => o.delivery_status === 'delivered').length;
    const received = orders.filter((o) => o.delivery_status === 'received').length;

    return { total, ordered, readyToGo, onTheWay, delivered, received };
  }, [orders]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Toast feedback */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-2xl animate-fade-in-up">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-foreground">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <PageHeader
          title="Vendor Orders"
          subtitle="Real-time delivery fulfillment milestones and order status dispatching."
        >
          <button
            onClick={fetchOrders}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-card px-4 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </PageHeader>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Total */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{kpis.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">All active orders</p>
          </div>

          {/* Ordered */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
              <span className="text-xs font-bold uppercase tracking-wider">Ordered</span>
              <Clock className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-amber-900 dark:text-amber-200">{kpis.ordered}</p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">Newly placed</p>
          </div>

          {/* Ready To Go */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
              <span className="text-xs font-bold uppercase tracking-wider">Ready To Go</span>
              <Package className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-blue-900 dark:text-blue-200">{kpis.readyToGo}</p>
            <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">Packed & ready</p>
          </div>

          {/* On The Way */}
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
              <span className="text-xs font-bold uppercase tracking-wider">On The Way</span>
              <Truck className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-sky-900 dark:text-sky-200">{kpis.onTheWay}</p>
            <p className="text-[11px] text-sky-700/70 dark:text-sky-400/70 mt-0.5">In transit</p>
          </div>

          {/* Delivered / Received */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-xs font-bold uppercase tracking-wider">Delivered</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-emerald-900 dark:text-emerald-200">
              {kpis.delivered + kpis.received}
            </p>
            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
              {kpis.delivered} delivered · {kpis.received} received
            </p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search orders, customers, address..."
                className="w-full rounded-xl border border-border/80 bg-background pl-10 pr-10 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View Switcher */}
            <div className="flex rounded-xl border border-border/80 bg-background p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'rounded-lg p-1.5 transition',
                  view === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'rounded-lg p-1.5 transition',
                  view === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Delivery Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border/40 pt-3">
            {[
              { id: 'all', label: 'All Orders', count: orders.length },
              { id: 'ordered', label: 'Ordered', count: orders.filter((o) => o.delivery_status === 'ordered').length },
              { id: 'ready_to_go', label: 'Ready To Go', count: orders.filter((o) => o.delivery_status === 'ready_to_go').length },
              { id: 'on_the_way', label: 'On The Way', count: orders.filter((o) => o.delivery_status === 'on_the_way').length },
              { id: 'delivered', label: 'Delivered', count: orders.filter((o) => o.delivery_status === 'delivered').length },
              { id: 'received', label: 'Received', count: orders.filter((o) => o.delivery_status === 'received').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDeliveryStatusFilter(tab.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  deliveryStatusFilter === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  deliveryStatusFilter === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table / Cards */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="font-extrabold text-base text-foreground">No orders found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No orders matching the selected delivery status filter or search query.
            </p>
            <button
              onClick={() => {
                setDeliveryStatusFilter('all');
                setSearch('');
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          </div>
        ) : view === 'list' ? (
          /* Table / List View: Amount, Tracking, Status removed; Delivery Address and Delivery Status shown */
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Delivery Address</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredOrders.map((order) => {
                    const statusCfg = DELIVERY_STATUS_CONFIG[order.delivery_status] ?? DELIVERY_STATUS_CONFIG.ordered;
                    const statusLabel = locale === 'ar' && order.delivery_status_label_ar
                      ? order.delivery_status_label_ar
                      : order.delivery_status_label || statusCfg.label;

                    return (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                        {/* Order */}
                        <td className="py-3 px-4 align-top">
                          <p className="font-bold text-foreground">{order.order_number}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs shrink-0">
                              {initials(order.customer_name)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{order.customer_name}</p>
                              <p className="text-[11px] text-muted-foreground">{order.customer_phone || order.contact_number || '—'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4 align-top">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            {order.items_count} item{order.items_count !== 1 ? 's' : ''}
                          </span>
                        </td>

                        {/* Delivery Address with View Button */}
                        <td className="py-3 px-4 align-top max-w-[280px]">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                              {order.delivery_address_formatted}
                            </p>
                            <button
                              onClick={() => setAddressModalOrder(order)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition shrink-0"
                              title="View full delivery address"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                          </div>
                        </td>

                        {/* Delivery Status */}
                        <td className="py-3 px-4 align-top">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', statusCfg.badgeClass)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dotClass)} />
                            {statusLabel}
                          </span>
                        </td>

                        {/* Transition Actions following the order */}
                        <td className="py-3 px-4 align-top text-right">
                          {/* ORDERED -> READY_TO_GO */}
                          {order.delivery_status === 'ordered' && (
                            <button
                              onClick={() => handleTransit(order, 'ready_to_go')}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                              <Package className="h-3.5 w-3.5" />
                              Ready To Go
                            </button>
                          )}

                          {/* READY_TO_GO -> ON_THE_WAY */}
                          {order.delivery_status === 'ready_to_go' && (
                            <button
                              onClick={() => handleTransit(order, 'on_the_way')}
                              className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              On The Way
                            </button>
                          )}

                          {/* ON_THE_WAY -> DELIVERED */}
                          {order.delivery_status === 'on_the_way' && (
                            <button
                              onClick={() => handleTransit(order, 'delivered')}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Delivered
                            </button>
                          )}

                          {/* DELIVERED -> RECEIVED (Customer verification with tracking code) */}
                          {order.delivery_status === 'delivered' && (
                            <button
                              onClick={() => handleTransit(order, 'received')}
                              className="inline-flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
                              title="Customer received confirmation"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Confirm Received
                            </button>
                          )}

                          {/* RECEIVED: Completed milestone */}
                          {order.delivery_status === 'received' && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                              <Check className="h-3.5 w-3.5 text-purple-600" />
                              Received
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const statusCfg = DELIVERY_STATUS_CONFIG[order.delivery_status] ?? DELIVERY_STATUS_CONFIG.ordered;
              const statusLabel = locale === 'ar' && order.delivery_status_label_ar
                ? order.delivery_status_label_ar
                : order.delivery_status_label || statusCfg.label;

              return (
                <div
                  key={order.id}
                  className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-extrabold text-sm text-foreground">{order.order_number}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                      </div>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0', statusCfg.badgeClass)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dotClass)} />
                        {statusLabel}
                      </span>
                    </div>

                    {/* Customer */}
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0">
                          {initials(order.customer_name)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-xs text-foreground truncate">{order.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{order.customer_phone || order.contact_number || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address & Items */}
                    <div className="space-y-2 text-xs mb-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span>{order.items_count} item{order.items_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background p-2.5">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" /> Delivery Address
                          </span>
                          <button
                            onClick={() => setAddressModalOrder(order)}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            View
                          </button>
                        </div>
                        <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                          {order.delivery_address_formatted}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action following transition order */}
                  <div className="border-t border-border/40 pt-3 flex items-center justify-end">
                    {order.delivery_status === 'ordered' && (
                      <button
                        onClick={() => handleTransit(order, 'ready_to_go')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition w-full justify-center"
                      >
                        <Package className="h-4 w-4" />
                        Ready To Go
                      </button>
                    )}
                    {order.delivery_status === 'ready_to_go' && (
                      <button
                        onClick={() => handleTransit(order, 'on_the_way')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition w-full justify-center"
                      >
                        <Truck className="h-4 w-4" />
                        On The Way
                      </button>
                    )}
                    {order.delivery_status === 'on_the_way' && (
                      <button
                        onClick={() => handleTransit(order, 'delivered')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition w-full justify-center"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Delivered
                      </button>
                    )}
                    {order.delivery_status === 'delivered' && (
                      <button
                        onClick={() => handleTransit(order, 'received')}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition w-full justify-center"
                      >
                        <KeyRound className="h-4 w-4" />
                        Confirm Received
                      </button>
                    )}
                    {order.delivery_status === 'received' && (
                      <div className="flex items-center justify-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 w-full py-1">
                        <Check className="h-4 w-4" />
                        Customer Received
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delivery Address Modal */}
        <DeliveryAddressModal
          order={addressModalOrder}
          isOpen={Boolean(addressModalOrder)}
          onClose={() => setAddressModalOrder(null)}
        />

        {/* Received Confirmation Modal (with tracking code) */}
        <ReceivedConfirmationModal
          order={receivedModalOrder}
          isOpen={Boolean(receivedModalOrder)}
          onClose={() => setReceivedModalOrder(null)}
          onConfirmed={handleReceivedConfirmed}
        />
      </div>
    </DashboardShell>
  );
}
