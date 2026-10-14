'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle, X,
  ChevronDown, CheckCircle2, Clock, User, Phone,
  Calendar, Hash, ArrowRight, Filter, ShoppingBag, Truck,
  Package, MapPin, Copy, Check, Eye, RotateCcw,
  ShieldCheck, KeyRound, Building, Navigation, Send, Edit3,
  ExternalLink, QrCode, Tag, FileText
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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

export const DELIVERY_PROGRESS_STEPS = [
  { key: 'ordered',     label: 'Ordered',     icon: '📋' },
  { key: 'ready_to_go', label: 'Ready',       icon: '📦' },
  { key: 'on_the_way',  label: 'On the Way',  icon: '🚚' },
  { key: 'delivered',   label: 'Delivered',   icon: '📬' },
  { key: 'received',    label: 'Received',    icon: '✓'  },
] as const;

export function getDeliveryStepIndex(status?: string): number {
  const s = (status ?? '').toLowerCase().trim();
  if (s === 'received' || s.includes('received') || s.includes('completed')) return 4;
  if (s === 'delivered' || s.includes('delivered')) return 3;
  if (
    s === 'on_the_way' ||
    s.includes('on_the_way') ||
    s.includes('on the way') ||
    s.includes('transit') ||
    s.includes('shipped') ||
    s.includes('out_for_delivery')
  ) return 2;
  if (
    s === 'ready_to_go' ||
    s === 'ready' ||
    s.includes('ready_to_go') ||
    s.includes('ready') ||
    s.includes('confirmed') ||
    s.includes('processing') ||
    s.includes('preparing')
  ) return 1;
  return 0; // ordered
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAddressPreview(addr: any): string {
  if (!addr) return '';
  if (typeof addr === 'string') {
    const trimmed = addr.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-') return '';
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatAddressPreview(parsed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof addr === 'object' && addr !== null) {
    if (addr.formatted && typeof addr.formatted === 'string' && addr.formatted.trim()) {
      return addr.formatted.trim();
    }
    const a = addr as Record<string, any>;
    const parts = [
      (a.area || a.district) && `Area: ${a.area || a.district}`,
      a.block && `Block: ${a.block}`,
      a.street && `Street: ${a.street}`,
      a.avenue && `Avenue: ${a.avenue}`,
      (a.building_no || a.building || a.house || a.villa) && `Bldg: ${a.building_no || a.building || a.house || a.villa}`,
      a.floor && `Floor: ${a.floor}`,
      (a.apartment || a.flat) && `Apt: ${a.apartment || a.flat}`,
      a.city && `City: ${a.city}`,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  return '';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ,
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
  let addrRaw = raw.delivery_address as DeliveryAddressObj | string | undefined;
  if (!addrRaw && (raw.area || raw.block || raw.street || raw.city || raw.building_no)) {
    addrRaw = {
      area: (raw.area as string) || null,
      block: (raw.block as string) || null,
      street: (raw.street as string) || null,
      building_no: (raw.building_no as string) || null,
      floor: (raw.floor as string) || null,
      apartment: (raw.apartment as string) || null,
      city: (raw.city as string) || null,
      formatted: (raw.formatted_address as string) || null,
    };
  }

  const formattedAddress = formatAddressPreview(addrRaw) || (raw.formatted_address as string) || '—';

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
    items: (raw.items ?? undefined) as any,
    status_history: (raw.status_history ?? undefined) as any,
    payment_method: (raw.payment_method ?? undefined) as string | undefined,
    payment_through: (raw.payment_through ?? undefined) as string | undefined,
    payment_provider: (raw.payment_provider ?? undefined) as string | undefined,
    delivery_notes: (raw.delivery_notes ?? undefined) as string | undefined,
    subtotal: (raw.subtotal ?? undefined) as string | undefined,
    discount: (raw.discount ?? undefined) as string | undefined,
  };
}

// ── Full Order Details Modal ──────────────────────────────────────────────────
interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !order?.id) {
      setDetails(null);
      return;
    }
    let isMounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await authedFetch(`/booknpay/api/v1/orders/${order.id}/`);
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const data = json?.data ?? json;
        if (isMounted && data) {
          setDetails(data);
        }
      } catch {
        // non-blocking fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const current = details || order;
  const items: any[] = (details?.items ?? order?.items ?? (Array.isArray(order?.items) ? order.items : []));
  const trackingCode = details?.tracking_code || order.tracking_code || '—';
  const ushwebEnv = (
    process.env.NEXT_PUBLIC_USHWEB ||
    process.env.USHWEB ||
    'http://127.0.0.1:3001'
  ).trim();
  const ushwebBase = ushwebEnv.endsWith('/') ? ushwebEnv : `${ushwebEnv}/`;
  const publicToken = details?.public_token || order.public_token || (order as any)?.token || (details as any)?.token;
  const trackingUrl = publicToken
    ? `${ushwebBase}order-tracking/${publicToken}`
    : '';

  const deliveryCfg = DELIVERY_STATUS_CONFIG[current.delivery_status || 'ordered'] ?? DELIVERY_STATUS_CONFIG.ordered;

  // Resolve delivery address from details or order
  const rawAddr =
    details?.delivery_address ??
    order.delivery_address ??
    (details?.area || details?.block || details?.street || details?.building_no
      ? {
          area: details.area,
          block: details.block,
          street: details.street,
          building_no: details.building_no,
          floor: details.floor,
          apartment: details.apartment,
          city: details.city,
          formatted: details.formatted_address,
        }
      : null) ??
    (order as any)?.address ??
    (details as any)?.address;

  const resolvedAddressFormatted =
    formatAddressPreview(rawAddr) ||
    order.delivery_address_formatted ||
    (details as any)?.delivery_address_formatted ||
    (details as any)?.formatted_address ||
    (typeof rawAddr === 'string' ? rawAddr : '') ||
    '—';

  const addrObj =
    typeof rawAddr === 'object' && rawAddr !== null
      ? (rawAddr as DeliveryAddressObj)
      : null;

  const copyUrl = () => {
    if (!trackingUrl) return;
    navigator.clipboard.writeText(trackingUrl).catch(() => undefined);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyTracking = () => {
    if (!trackingCode || trackingCode === '—') return;
    navigator.clipboard.writeText(trackingCode).catch(() => undefined);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const copyAddress = () => {
    if (!resolvedAddressFormatted || resolvedAddressFormatted === '—') return;
    navigator.clipboard.writeText(resolvedAddressFormatted).catch(() => undefined);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl max-h-[90vh] flex flex-col animate-fade-in-up">
        {/* Top Accent Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-600 to-primary shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-foreground">Order Details</h3>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {trackingCode}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(current.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Status Badges & Quick Total */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/20 p-3.5 rounded-2xl border border-border/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', deliveryCfg.badgeClass)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', deliveryCfg.dotClass)} />
                {current.delivery_status_label || deliveryCfg.label}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
                current.payment_status === 'paid' || current.payment_status === 'success'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              )}>
                Payment: {current.payment_status}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Amount</span>
              <span className="text-base font-black text-primary font-mono">
                {current.total_amount || '—'} <span className="text-xs font-bold">{current.currency || 'KWD'}</span>
              </span>
            </div>
          </div>

          {/* Key Reference Identifier */}
          <div className="rounded-2xl border border-border/60 bg-card p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Tracking Code</span>
              <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">{trackingCode}</span>
            </div>
            <button
              type="button"
              onClick={copyTracking}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Copy tracking code"
            >
              {copiedTracking ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {/* Tracking URL & QR Code */}
          {trackingUrl && (
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-primary" />
                  Live Order Tracking URL & QR Code
                </span>
                {current.token_expires_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Link expires: {formatDate(current.token_expires_at)}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 bg-card rounded-2xl border border-border/60 p-4 shadow-xs">
                {/* QR Code Container */}
                <div className="p-2.5 bg-white rounded-xl shadow-xs border border-border/50 shrink-0">
                  <QRCodeSVG
                    value={trackingUrl}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Tracking URL & Actions */}
                <div className="space-y-2 flex-1 min-w-0 w-full text-center sm:text-left">
                  <p className="text-xs font-bold text-foreground">Customer Tracking Page</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Scan with any phone camera or share the link with the customer to track real-time delivery progress.
                  </p>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-1.5 text-xs">
                    <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground px-1 select-all">
                      {trackingUrl}
                    </span>
                    <button
                      type="button"
                      onClick={copyUrl}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Copy tracking URL"
                    >
                      {copiedUrl ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Open tracking URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customer & Address Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Recipient Details
              </p>
              <p className="font-bold text-sm text-foreground">{current.customer_name}</p>
              {(current.customer_phone || current.contact_number) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>{current.customer_phone || current.contact_number}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
                </p>
                {resolvedAddressFormatted !== '—' && (
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="grid h-6 w-6 place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Copy delivery address"
                  >
                    {copiedAddress ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground font-medium leading-relaxed">
                {resolvedAddressFormatted}
              </p>
              {addrObj && (addrObj.area || addrObj.block || addrObj.street || addrObj.building_no) && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                  {addrObj.area && <span className="bg-muted/60 px-2 py-0.5 rounded-md">Area: <b className="text-foreground">{addrObj.area}</b></span>}
                  {addrObj.block && <span className="bg-muted/60 px-2 py-0.5 rounded-md">Block: <b className="text-foreground">{addrObj.block}</b></span>}
                  {addrObj.street && <span className="bg-muted/60 px-2 py-0.5 rounded-md">Street: <b className="text-foreground">{addrObj.street}</b></span>}
                  {addrObj.building_no && <span className="bg-muted/60 px-2 py-0.5 rounded-md">Bldg: <b className="text-foreground">{addrObj.building_no}</b></span>}
                  {(addrObj.floor || addrObj.apartment) && (
                    <span className="bg-muted/60 px-2 py-0.5 rounded-md">
                      {[addrObj.floor && `Fl: ${addrObj.floor}`, addrObj.apartment && `Apt: ${addrObj.apartment}`].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {addrObj.city && <span className="bg-muted/60 px-2 py-0.5 rounded-md">City: <b className="text-foreground">{addrObj.city}</b></span>}
                </div>
              )}
              {current.delivery_notes && (
                <p className="text-[11px] text-muted-foreground mt-2 italic border-t border-border/40 pt-1.5">
                  <span className="font-semibold not-italic text-foreground">Note:</span> {current.delivery_notes}
                </p>
              )}
            </div>
          </div>

          {/* Ordered Items with Image & Price */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                Ordered Items {items.length > 0 ? `(${items.length})` : ''}
              </p>
              {loading && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Loading items…
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-5 text-center text-xs text-muted-foreground bg-muted/10">
                {loading ? 'Fetching item details…' : 'No product items registered for this order.'}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity ?? 1);
                  const price = item.unit_price ? Number(item.unit_price) : 0;
                  const lineTotal = item.line_total ? Number(item.line_total) : price * qty;
                  const cur = item.currency || current.currency || 'KWD';

                  return (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3 hover:bg-muted/30 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.product_image_url ? (
                          <img
                            src={item.product_image_url}
                            alt={item.product_name || 'Product image'}
                            className="h-12 w-12 rounded-xl object-cover border border-border/50 shrink-0 bg-background"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted/60 text-muted-foreground shrink-0 border border-border/40">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{item.product_name || `Item #${idx + 1}`}</p>
                          {item.product_name_ar && (
                            <p className="text-[11px] text-muted-foreground truncate font-arabic">{item.product_name_ar}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            Qty: <span className="font-bold text-foreground">{qty}</span>
                            {item.unit_price && ` × ${item.unit_price} ${cur}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-primary font-mono block">
                          {lineTotal > 0 ? lineTotal.toFixed(3) : (item.unit_price || '—')} {cur}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-1.5 text-xs">
            {current.subtotal && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">{current.subtotal} {current.currency || 'KWD'}</span>
              </div>
            )}
            {current.discount && Number(current.discount) > 0 && (
              <div className="flex items-center justify-between text-emerald-600 font-semibold">
                <span>Discount</span>
                <span className="font-mono">-{current.discount} {current.currency || 'KWD'}</span>
              </div>
            )}
            <div className="border-t border-border/50 pt-2 flex items-center justify-between font-bold text-foreground">
              <span>Total Amount</span>
              <span className="font-black text-primary font-mono text-sm">
                {current.total_amount || '—'} {current.currency || 'KWD'}
              </span>
            </div>
          </div>

          {/* Delivery Progress (Matching specification & attached design) */}
          {(() => {
            const activeStepIdx = getDeliveryStepIndex(current.delivery_status);
            const currentStep = DELIVERY_PROGRESS_STEPS[activeStepIdx] || DELIVERY_PROGRESS_STEPS[0];

            return (
              <div className="rounded-3xl border border-[#E7DFD5] dark:border-[#3D2C22] bg-[#FAF7F2] dark:bg-[#1E1612] p-6 shadow-xs">
                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[#362218] text-white shadow-xs shrink-0 text-xl">
                    🚚
                  </div>
                  <h4
                    className="text-lg font-bold text-[#362218] dark:text-[#F3ECE4]"
                    style={{ fontFamily: "'Lustria', 'Playfair Display', Georgia, serif" }}
                  >
                    Delivery Progress
                  </h4>
                </div>

                {/* Stepper with connecting line */}
                <div className="relative px-2">
                  {/* Background connecting bar */}
                  <div
                    aria-hidden="true"
                    className="absolute top-[22px] left-[8%] right-[8%] h-[3.5px] rounded-full bg-[#E6DDD2] dark:bg-[#382820]"
                  />

                  {/* Active filled connecting bar */}
                  <div
                    aria-hidden="true"
                    className="absolute top-[22px] left-[8%] h-[3.5px] rounded-full bg-[#362218] dark:bg-[#C9A887] transition-all duration-500"
                    style={{
                      width: `${(activeStepIdx / (DELIVERY_PROGRESS_STEPS.length - 1)) * 84}%`,
                    }}
                  />

                  {/* Steps */}
                  <div className="relative z-10 flex items-start justify-between">
                    {DELIVERY_PROGRESS_STEPS.map((step, idx) => {
                      const isCompleted = idx <= activeStepIdx;
                      const isCurrent = idx === activeStepIdx;

                      return (
                        <div
                          key={step.key}
                          className="flex flex-col items-center flex-1 min-w-0"
                        >
                          {/* Circle badge */}
                          <div
                            className={cn(
                              'grid h-11 w-11 place-items-center rounded-full text-base transition-all duration-300 select-none',
                              isCompleted
                                ? 'bg-[#362218] text-white'
                                : 'bg-[#EDE4DA] dark:bg-[#2C2018] text-[#362218]/40 border-2 border-[#D5C2B1] dark:border-[#4A3528] opacity-60',
                              isCurrent &&
                                'ring-4 ring-[#CDAF94] ring-offset-2 ring-offset-[#FAF7F2] dark:ring-offset-[#1E1612] shadow-md scale-105 opacity-100'
                            )}
                          >
                            {step.key === 'received' ? (
                              <Check className="h-5 w-5 text-white stroke-[2.5]" />
                            ) : (
                              <span>{step.icon}</span>
                            )}
                          </div>

                          {/* Label */}
                          <span
                            className={cn(
                              'text-xs font-bold mt-2.5 text-center leading-tight transition-colors',
                              isCompleted
                                ? 'text-[#362218] dark:text-[#F3ECE4]'
                                : 'text-[#362218]/50 dark:text-[#A8988B]'
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Status Pill Badge */}
                <div className="flex justify-center mt-7">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D5C2B1] dark:border-[#523A2B] bg-[#EDE4DA] dark:bg-[#2C1F18] px-6 py-2 shadow-xs">
                    <Check className="h-3.5 w-3.5 text-[#362218] dark:text-[#F3ECE4] stroke-[3]" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#362218] dark:text-[#F3ECE4]">
                      {currentStep.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-border/50 bg-muted/20 px-6 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
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

// ── Update Order Status Modal (with custom status & note) ────────────────────
interface StatusModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (order: Order) => void;
}

function UpdateStatusModal({ order, isOpen, onClose, onUpdated }: StatusModalProps) {
  const [status, setStatus] = useState<string>('ordered');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      setStatus(order.delivery_status || 'ordered');
      setNote('');
      setError(null);
    }
  }, [isOpen, order]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const cfg = DELIVERY_STATUS_CONFIG[status];
    const defaultNote = `Status updated to ${cfg?.label || status}`;
    const payload = {
      status,
      note: note.trim() || defaultNote,
    };

    try {
      const res = await authedFetch(`/booknpay/api/v1/orders/${order.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const msg =
          json?.error?.message ||
          json?.detail ||
          json?.message ||
          `Failed to update order status (${res.status})`;
        setError(msg);
        return;
      }

      const data = json?.data && typeof json.data === 'object' ? json.data : json;
      const updated: Order = {
        ...order,
        ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
        delivery_status: status,
        delivery_status_label: cfg?.label || status,
        delivery_status_label_ar: cfg?.labelAr || status,
        updated_at: new Date().toISOString(),
      };

      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while updating status.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    { key: 'ordered', label: 'Ordered', desc: 'Newly placed order' },
    { key: 'ready_to_go', label: 'Ready To Go', desc: 'Packed & ready to dispatch' },
    { key: 'on_the_way', label: 'On The Way', desc: 'Out for delivery' },
    { key: 'delivered', label: 'Delivered', desc: 'Delivered to recipient address' },
    { key: 'received', label: 'Received', desc: 'Customer receipt confirmed' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-fade-in-up">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Update Order Status</h3>
                <p className="text-xs text-muted-foreground">{order.order_number} · {order.customer_name}</p>
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

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Status Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                Select Status <span className="text-destructive">*</span>
              </label>
              <div className="space-y-2">
                {statusOptions.map((opt) => {
                  const cfg = DELIVERY_STATUS_CONFIG[opt.key];
                  const isSelected = status === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => setStatus(opt.key)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition text-xs',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/60 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full border flex items-center justify-center transition',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40'
                          )}
                        >
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground flex items-center gap-1.5">
                            <span>{opt.label}</span>
                            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg?.dotClass)} />
                          </p>
                          <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg?.badgeClass)}>
                        {cfg?.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Note <span className="text-muted-foreground text-[10px] font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter a status update note..."
                rows={3}
                className="w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>

            {/* Error Message */}
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save Status
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [addressModalOrder, setAddressModalOrder] = useState<Order | null>(null);
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);
  const [detailsModalOrder, setDetailsModalOrder] = useState<Order | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

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
        const msg =
          json?.error?.message ||
          json?.detail ||
          json?.message ||
          (typeof json?.error === 'string' ? json.error : null) ||
          'Failed to load orders';
        setError(msg);
        setOrders([]);
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

      const parsed = list.map((item, idx) => normaliseOrder(item, idx));
      setOrders(parsed);
    } catch (err) {
      console.warn('[OrdersPage] Fetch error:', err);
      setError('Unable to load orders. Please check your connection.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, initialized]);

  // Transition handler following the strict order:
  // ordered -> ready_to_go -> on_the_way -> delivered -> received
  const handleTransit = async (order: Order, nextStatus: DeliveryStatus) => {
    setUpdatingOrderId(order.id);

    const cfg = DELIVERY_STATUS_CONFIG[nextStatus];
    const defaultNote = `Status updated to ${cfg?.label || nextStatus}`;
    const payload = {
      status: nextStatus,
      note: defaultNote,
    };

    try {
      const res = await authedFetch(`/booknpay/api/v1/orders/${order.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.success === false) {
        const msg =
          json?.error?.message ||
          json?.detail ||
          json?.message ||
          `Failed to update status (${res.status})`;
        setToast({ type: 'error', message: msg });
        return;
      }

      // Success: update frontend UI accordingly
      const data = json?.data && typeof json.data === 'object' ? json.data : json;
      const updated: Order = {
        ...order,
        ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
        delivery_status: nextStatus,
        delivery_status_label: cfg?.label || nextStatus,
        delivery_status_label_ar: cfg?.labelAr || nextStatus,
        updated_at: new Date().toISOString(),
      };

      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      setToast({
        type: 'success',
        message: `Order ${order.order_number} status updated to "${cfg?.label || nextStatus}".`,
      });
    } catch (e) {
      console.error('Order status update error:', e);
      setToast({
        type: 'error',
        message: e instanceof Error ? e.message : 'Network error while updating status.',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStatusModalUpdated = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setToast({
      type: 'success',
      message: `Order ${updated.order_number} status updated to "${updated.delivery_status_label || updated.delivery_status}".`,
    });
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
        {toast && (
          <div
            className={cn(
              'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border p-4 shadow-2xl animate-fade-in-up max-w-md',
              toast.type === 'error'
                ? 'border-destructive/40 bg-card text-destructive shadow-destructive/10'
                : 'border-emerald-500/30 bg-card text-foreground shadow-emerald-500/10'
            )}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            )}
            <span className="text-xs font-bold text-foreground">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-muted-foreground hover:text-foreground ml-2 p-1"
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

        {/* Error Notification */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchOrders}
              className="font-bold underline hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

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
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="font-extrabold text-base text-foreground">No orders found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || deliveryStatusFilter !== 'all'
                ? 'No orders matching the selected delivery status filter or search query.'
                : 'No orders are currently available.'}
            </p>
            {(search || deliveryStatusFilter !== 'all') && (
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
            )}
          </div>
        ) : view === 'list' ? (
          /* Table / List View: Amount, Tracking, Status removed; Delivery Address and Delivery Status shown */
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Order Number</th>
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
                        {/* Order Number (tracking_code displayed in place of order_number, clickable to view details) */}
                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={() => setDetailsModalOrder(order)}
                            className="font-bold text-foreground font-mono text-xs sm:text-sm hover:text-primary hover:underline transition text-left cursor-pointer inline-flex items-center gap-1.5 group"
                            title={`Click to view full order details (${order.order_number})`}
                          >
                            <span>{order.tracking_code || order.order_number}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <p className="text-[11px] text-muted-foreground mt-0.5 cursor-help" title={`Order Number: ${order.order_number}`}>
                            {formatDate(order.created_at)}
                          </p>
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
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* ORDERED -> READY_TO_GO */}
                            {order.delivery_status === 'ordered' && (
                              <button
                                onClick={() => handleTransit(order, 'ready_to_go')}
                                disabled={updatingOrderId === order.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                              >
                                {updatingOrderId === order.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Package className="h-3.5 w-3.5" />
                                )}
                                Ready To Go
                              </button>
                            )}

                            {/* READY_TO_GO -> ON_THE_WAY */}
                            {order.delivery_status === 'ready_to_go' && (
                              <button
                                onClick={() => handleTransit(order, 'on_the_way')}
                                disabled={updatingOrderId === order.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
                              >
                                {updatingOrderId === order.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Truck className="h-3.5 w-3.5" />
                                )}
                                On The Way
                              </button>
                            )}

                            {/* ON_THE_WAY -> DELIVERED */}
                            {order.delivery_status === 'on_the_way' && (
                              <button
                                onClick={() => handleTransit(order, 'delivered')}
                                disabled={updatingOrderId === order.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                              >
                                {updatingOrderId === order.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Mark Delivered
                              </button>
                            )}

                            {/* DELIVERED -> RECEIVED */}
                            {order.delivery_status === 'delivered' && (
                              <button
                                onClick={() => handleTransit(order, 'received')}
                                disabled={updatingOrderId === order.id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition"
                                title="Confirm Received"
                              >
                                {updatingOrderId === order.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Confirm Received
                              </button>
                            )}

                            {/* RECEIVED: Completed milestone */}
                            {order.delivery_status === 'received' && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                                <Check className="h-3.5 w-3.5 text-purple-600" />
                                Received
                              </span>
                            )}

                            {/* Change status & add note modal button */}
                            <button
                              onClick={() => setStatusModalOrder(order)}
                              disabled={updatingOrderId === order.id}
                              className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition"
                              title="Update status & add note"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Update</span>
                            </button>
                          </div>
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
                        <button
                          type="button"
                          onClick={() => setDetailsModalOrder(order)}
                          className="font-extrabold text-sm text-foreground font-mono hover:text-primary hover:underline transition text-left cursor-pointer inline-flex items-center gap-1 group"
                          title={`Click to view full order details (${order.order_number})`}
                        >
                          <span>{order.tracking_code || order.order_number}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <p className="text-[11px] text-muted-foreground mt-0.5 cursor-help" title={`Order Number: ${order.order_number}`}>
                          {formatDate(order.created_at)}
                        </p>
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
                  <div className="border-t border-border/40 pt-3 flex items-center gap-2">
                    {order.delivery_status === 'ordered' && (
                      <button
                        onClick={() => handleTransit(order, 'ready_to_go')}
                        disabled={updatingOrderId === order.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition flex-1"
                      >
                        {updatingOrderId === order.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Package className="h-3.5 w-3.5" />
                        )}
                        Ready To Go
                      </button>
                    )}
                    {order.delivery_status === 'ready_to_go' && (
                      <button
                        onClick={() => handleTransit(order, 'on_the_way')}
                        disabled={updatingOrderId === order.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition flex-1"
                      >
                        {updatingOrderId === order.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Truck className="h-3.5 w-3.5" />
                        )}
                        On The Way
                      </button>
                    )}
                    {order.delivery_status === 'on_the_way' && (
                      <button
                        onClick={() => handleTransit(order, 'delivered')}
                        disabled={updatingOrderId === order.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition flex-1"
                      >
                        {updatingOrderId === order.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Mark Delivered
                      </button>
                    )}
                    {order.delivery_status === 'delivered' && (
                      <button
                        onClick={() => handleTransit(order, 'received')}
                        disabled={updatingOrderId === order.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition flex-1"
                      >
                        {updatingOrderId === order.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirm Received
                      </button>
                    )}
                    {order.delivery_status === 'received' && (
                      <div className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                        <Check className="h-3.5 w-3.5 text-purple-600" />
                        Customer Received
                      </div>
                    )}
                    {/* Change status & add note modal button */}
                    <button
                      onClick={() => setStatusModalOrder(order)}
                      disabled={updatingOrderId === order.id}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition shrink-0"
                      title="Update status & add note"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Update</span>
                    </button>
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

        {/* Full Order Details Modal */}
        <OrderDetailsModal
          order={detailsModalOrder}
          isOpen={Boolean(detailsModalOrder)}
          onClose={() => setDetailsModalOrder(null)}
        />

        {/* Update Status Modal (status & note) */}
        <UpdateStatusModal
          order={statusModalOrder}
          isOpen={Boolean(statusModalOrder)}
          onClose={() => setStatusModalOrder(null)}
          onUpdated={handleStatusModalUpdated}
        />
      </div>
    </DashboardShell>
  );
}
