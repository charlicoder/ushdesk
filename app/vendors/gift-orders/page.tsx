'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle, X,
  CheckCircle2, Clock, Phone,
  ArrowRight, Gift, Truck,
  Package, MapPin, Copy, Check, Eye, RotateCcw,
  KeyRound, Edit3, Sparkles, Star,
  Building, MessageSquare, Pencil, Smartphone,
  Calendar, Timer,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderedItem {
  sku?: string;
  name?: string;
  image?: string;
  price?: number | string;
  name_ar?: string;
  name_en?: string;
  currency?: string;
  quantity?: number;
  product_id?: string;
  total_price?: number | string;
}

interface DeliveryAddress {
  area?: string;
  city?: string;
  block?: string;
  floor?: string;
  notes?: string;
  street?: string;
  building?: string;
  apartment?: string;
  formatted?: string;
  [key: string]: string | undefined;
}

interface ServiceData {
  name?: string;
  image?: string;
  currency?: string;
  base_price?: string;
  duration_minutes?: number;
  service_types?: { id?: string; name: string }[];
}

interface BranchData {
  name?: string;
  branch_id?: string;
}

interface SenderData {
  name?: string;
  phone_number?: string;
}

interface RecipientData {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string | null;
  phone_number?: string;
}

interface ServiceArrangementData {
  image?: string;
  price?: string;
  currency?: string;
  arrangement_name?: string;
  arrangement_type?: string;
}

interface Addon {
  id?: string;
  addon_id?: string;
  name: string;
  price: string | number;
  currency: string;
  description?: string;
  duration_minutes?: number;
}

interface DigitalProductData {
  id?: string;
  title?: string;
  name?: string;
  image?: string | null;
  video_url?: string | null;
  price?: string | number | null;
  currency?: string;
  category_code?: string;
}

interface GiftOrder {
  id: string;
  voucher_number?: string | null;
  voucher_no?: string | null;
  gift_category: 'physical' | 'digital' | 'service' | string;
  digital_product_data?: DigitalProductData | null;
  ordered_items: OrderedItem[] | null;
  delivery_status: string | null;
  delivery_status_label: string | null;
  delivery_status_label_ar: string | null;
  delivery_address: DeliveryAddress | null;
  service_id: string | null;
  service_data: ServiceData;
  branch_id: string | null;
  branch_data: BranchData;
  service_arrangement_id: string | null;
  service_arrangement_data: ServiceArrangementData;
  addons: Addon[];
  extra_time: number;
  price_for_extra_time: string | null;
  expire_date: string;
  status: string;
  sender_id: string;
  sender_data: SenderData;
  recipient_phone: string;
  recipient_id: string | null;
  recipient_data: RecipientData;
  created_by: string;
  total_duration: number;
  total_amount: string;
  currency: string;
  gift_message: string | null;
  gift_template: string | null;
  secret_code: string;
  public_token: string;
  redeemed_booking_id: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  booking_id: string | null;
  payment_id: string | null;
  payment_url: string | null;
  payment_provider: string | null;
  payment_through: string | null;
  created_at: string;
  updated_at: string;
}

// ── Status Constants ───────────────────────────────────────────────────────────
const DELIVERY_STATUS_CONFIG: Record<
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

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  active: {
    label: 'Active',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  redeemed: {
    label: 'Redeemed',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300',
    dotClass: 'bg-purple-500',
  },
  expired: {
    label: 'Expired',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    dotClass: 'bg-rose-500',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300',
    dotClass: 'bg-zinc-500',
  },
};

function getOrderStatusConfig(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (ORDER_STATUS_CONFIG[s]) {
    return ORDER_STATUS_CONFIG[s];
  }
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ') : '—';
  return {
    label,
    badgeClass: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  };
}

function getOrderVoucherNumber(order?: GiftOrder | null): string | null {
  if (!order) return null;
  return order.voucher_number || (order as any).voucher_no || null;
}

const GIFT_CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  physical: { label: 'Physical Gift', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: Package },
  digital:  { label: 'Digital Gift',  color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: Smartphone },
  service:  { label: 'Service Gift',  color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800', icon: Sparkles },
};

function getCategoryConfig(category?: string | null, order?: GiftOrder) {
  const cat = (category || '').toLowerCase();
  if (cat === 'digital' || (order as any)?.digital_product_data || (order as any)?.gift_type === 'digital' || (order as any)?.gift_type === 'digital_service') {
    return GIFT_CATEGORY_CONFIG.digital;
  }
  if (cat && GIFT_CATEGORY_CONFIG[cat]) {
    return GIFT_CATEGORY_CONFIG[cat];
  }
  return GIFT_CATEGORY_CONFIG.physical;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAddressPreview(addr: DeliveryAddress | null | undefined): string {
  if (!addr) return '—';
  if (addr.formatted) return addr.formatted;
  const parts = [
    addr.area     && `Area: ${addr.area}`,
    addr.block    && `Block: ${addr.block}`,
    addr.street   && `Street: ${addr.street}`,
    addr.building && `Bldg: ${addr.building}`,
    addr.city     && addr.city,
  ].filter(Boolean);
  return parts.join(', ') || 'Address Provided';
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function initials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function formatAmount(amount: string | number | null | undefined, currency = 'KWD') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const val = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(val)) return '—';
  return `${val.toFixed(3)} ${currency}`;
}

// ── Address Detail Modal ──────────────────────────────────────────────────────
function DeliveryAddressModal({ order, isOpen, onClose }: { order: GiftOrder | null; isOpen: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen || !order || !order.delivery_address) return null;

  const addr = order.delivery_address;
  const formatted = formatAddressPreview(addr);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Delivery Address</h3>
              <p className="text-xs text-muted-foreground">{order.sender_data?.name} → {order.recipient_data?.name || '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recipient</p>
            <p className="text-sm font-bold text-foreground">{order.recipient_data?.name || '—'}</p>
            {order.recipient_phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Phone className="h-3.5 w-3.5 text-primary" />{order.recipient_phone}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {addr.area && <div className="rounded-xl border border-border/60 bg-card p-3"><span className="text-[10px] uppercase font-bold text-muted-foreground">Area</span><p className="font-semibold text-foreground mt-0.5">{addr.area}</p></div>}
            {addr.city && <div className="rounded-xl border border-border/60 bg-card p-3"><span className="text-[10px] uppercase font-bold text-muted-foreground">City</span><p className="font-semibold text-foreground mt-0.5">{addr.city}</p></div>}
            {addr.block && <div className="rounded-xl border border-border/60 bg-card p-3"><span className="text-[10px] uppercase font-bold text-muted-foreground">Block</span><p className="font-semibold text-foreground mt-0.5">{addr.block}</p></div>}
            {addr.street && <div className="rounded-xl border border-border/60 bg-card p-3"><span className="text-[10px] uppercase font-bold text-muted-foreground">Street</span><p className="font-semibold text-foreground mt-0.5">{addr.street}</p></div>}
            {addr.building && <div className="rounded-xl border border-border/60 bg-card p-3"><span className="text-[10px] uppercase font-bold text-muted-foreground">Building</span><p className="font-semibold text-foreground mt-0.5">{addr.building}</p></div>}
            {(addr.floor || addr.apartment) && (
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Floor / Apt</span>
                <p className="font-semibold text-foreground mt-0.5">{[addr.floor && `Fl: ${addr.floor}`, addr.apartment && `Apt: ${addr.apartment}`].filter(Boolean).join(', ')}</p>
              </div>
            )}
          </div>
          {addr.notes && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Notes</span>
              <p className="text-amber-900 dark:text-amber-300 mt-0.5">{addr.notes}</p>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Formatted Address</span>
              <button onClick={() => { navigator.clipboard.writeText(formatted); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="rounded-xl border border-border/80 bg-background p-3 text-xs leading-relaxed text-foreground">{formatted}</div>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-border/50 bg-muted/20 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Gift Details Modal ────────────────────────────────────────────────────────
function GiftDetailsModal({ order, isOpen, onClose }: { order: GiftOrder | null; isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen || !order) return null;

  const catCfg = getCategoryConfig(order.gift_category, order);
  const CatIcon = catCfg.icon;
  const isPhysical = (order.gift_category || '').toLowerCase() === 'physical';
  const isDigital = (order.gift_category || '').toLowerCase() === 'digital' || Boolean(order.digital_product_data);
  const delCfg = DELIVERY_STATUS_CONFIG[order.delivery_status || 'ordered'] ?? DELIVERY_STATUS_CONFIG.ordered;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Gift Voucher Details</h3>
              <p className="text-xs text-muted-foreground">
                {formatDate(order.created_at)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Category & Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold', catCfg.color)}>
              <CatIcon className="h-3.5 w-3.5" />{catCfg.label}
            </span>
            {order.status && (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', getOrderStatusConfig(order.status).badgeClass)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', getOrderStatusConfig(order.status).dotClass)} />
                {getOrderStatusConfig(order.status).label}
              </span>
            )}
          </div>

          {/* Sender → Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">From (Sender)</p>
              <p className="font-bold text-sm text-foreground">{order.sender_data?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3 text-primary" />{order.sender_data?.phone_number || '—'}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">To (Recipient)</p>
              <p className="font-bold text-sm text-foreground">{order.recipient_data?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3 text-primary" />{order.recipient_phone || '—'}</p>
            </div>
          </div>

          {/* Ordered Items & Services */}
          {(Boolean(order.ordered_items?.length) || Boolean(order.service_data?.name) || Boolean(order.service_id) || Boolean(isDigital && order.digital_product_data) || Boolean(order.addons?.length)) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                Ordered Items
                {order.ordered_items && order.ordered_items.length > 0 ? ` (${order.ordered_items.length})` : ''}
              </p>
              <div className="space-y-3">
                {/* Physical Products */}
                {order.ordered_items && order.ordered_items.length > 0 && (
                  <div className="space-y-2">
                    {order.ordered_items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                        {item.image && (
                          <img src={item.image} alt={item.name_en || item.name} className="h-12 w-12 rounded-lg object-cover shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{item.name_en || item.name || 'Item'}</p>
                          <p className="text-[11px] text-muted-foreground">Qty: {item.quantity ?? 1} · {formatAmount(item.price, item.currency || order.currency)}</p>
                        </div>
                        <span className="text-xs font-bold text-foreground shrink-0">{formatAmount(item.total_price, item.currency || order.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Digital: Product Data */}
                {isDigital && order.digital_product_data && (
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                      <Smartphone className="h-3.5 w-3.5" />Digital Gift Details
                    </div>
                    {order.digital_product_data?.image && (
                      <img src={order.digital_product_data.image} alt="Digital Gift" className="h-28 w-full rounded-lg object-cover mb-2"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <p className="font-bold text-sm text-foreground">{order.digital_product_data?.title || order.digital_product_data?.name || 'Digital Gift Item'}</p>
                    {order.digital_product_data?.price && (
                      <p className="text-xs text-muted-foreground">{formatAmount(order.digital_product_data.price, order.digital_product_data.currency || order.currency)}</p>
                    )}
                  </div>
                )}

                {/* Service Details (including addons & extratime) */}
                {(order.service_data?.name || order.service_id) && (
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    {order.service_data?.image && (
                      <img src={order.service_data.image} alt={order.service_data.name} className="w-full h-28 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-0.5">
                            <Sparkles className="h-3 w-3" />Spa Service
                          </div>
                          <p className="font-bold text-sm text-foreground">{order.service_data?.name || 'Service'}</p>
                        </div>
                        {order.service_data?.base_price && (
                          <span className="text-xs font-bold text-foreground shrink-0">
                            {formatAmount(order.service_data.base_price, order.service_data.currency || order.currency)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {order.service_data?.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />{order.service_data.duration_minutes} min
                          </span>
                        )}
                        {order.branch_data?.name && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3 text-muted-foreground" />{order.branch_data.name}
                          </span>
                        )}
                        {order.service_arrangement_data?.arrangement_name && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {order.service_arrangement_data.arrangement_name}
                          </span>
                        )}
                      </div>

                      {order.service_data?.service_types && order.service_data.service_types.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {order.service_data.service_types.map((st, idx) => (
                            <span key={st.id || `st-${idx}`} className="rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                              {st.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add-ons */}
                      {order.addons && order.addons.length > 0 && (
                        <div className="pt-2.5 border-t border-border/50">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-violet-500" />Add-ons ({order.addons.length})
                          </p>
                          <div className="space-y-1.5">
                            {order.addons.map((addon, idx) => (
                              <div key={addon.id || addon.addon_id || `addon-${idx}`} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                                <div>
                                  <span className="font-medium text-foreground">{addon.name}</span>
                                  {addon.description && <span className="text-[11px] text-muted-foreground block">{addon.description}</span>}
                                </div>
                                <span className="font-semibold text-foreground shrink-0 ml-2">
                                  {formatAmount(addon.price, addon.currency || order.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extra Time */}
                      {Boolean(order.extra_time && Number(order.extra_time) > 0) && (
                        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Timer className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium text-foreground">Extra Time:</span>
                            <span className="font-semibold text-foreground">+{order.extra_time} min</span>
                          </div>
                          {order.price_for_extra_time && Number(order.price_for_extra_time) > 0 ? (
                            <span className="font-semibold text-foreground">
                              {formatAmount(order.price_for_extra_time, order.currency)}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fallback Addons if no service_data?.name */}
                {!(order.service_data?.name || order.service_id) && order.addons && order.addons.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-violet-500" />Add-ons ({order.addons.length})
                    </p>
                    <div className="space-y-1.5">
                      {order.addons.map((addon, idx) => (
                        <div key={addon.id || addon.addon_id || `addon-${idx}`} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                          <span className="font-medium text-foreground">{addon.name}</span>
                          <span className="font-semibold text-foreground shrink-0 ml-2">
                            {formatAmount(addon.price, addon.currency || order.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Under Ordered Items: Gift Message */}
          {order.gift_message && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-rose-50/60 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/10 px-4 py-3">
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Gift Message</p>
                <p className="text-xs text-foreground leading-relaxed italic">&ldquo;{order.gift_message}&rdquo;</p>
              </div>
            </div>
          )}

          {/* Delivery Status */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Status</span>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', delCfg.badgeClass)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', delCfg.dotClass)} />
                {order.delivery_status_label || delCfg.label}
              </span>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Address</span>
            </div>
            {order.delivery_address ? (
              <div className="space-y-2">
                <p className="font-semibold text-foreground leading-snug">
                  {formatAddressPreview(order.delivery_address)}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  {order.delivery_address.area && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">Area</span>
                      <span className="font-medium text-foreground">{order.delivery_address.area}</span>
                    </div>
                  )}
                  {order.delivery_address.city && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">City</span>
                      <span className="font-medium text-foreground">{order.delivery_address.city}</span>
                    </div>
                  )}
                  {order.delivery_address.block && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">Block</span>
                      <span className="font-medium text-foreground">{order.delivery_address.block}</span>
                    </div>
                  )}
                  {order.delivery_address.street && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">Street</span>
                      <span className="font-medium text-foreground">{order.delivery_address.street}</span>
                    </div>
                  )}
                  {order.delivery_address.building && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">Building</span>
                      <span className="font-medium text-foreground">{order.delivery_address.building}</span>
                    </div>
                  )}
                  {(order.delivery_address.floor || order.delivery_address.apartment) && (
                    <div className="rounded-lg border border-border/50 bg-card p-2">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground block">Floor / Apt</span>
                      <span className="font-medium text-foreground">
                        {[order.delivery_address.floor && `Fl: ${order.delivery_address.floor}`, order.delivery_address.apartment && `Apt: ${order.delivery_address.apartment}`].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                {order.delivery_address.notes && (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 p-2 text-xs">
                    <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Notes</span>
                    <p className="text-foreground italic mt-0.5">&ldquo;{order.delivery_address.notes}&rdquo;</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No delivery address set</p>
            )}
          </div>

          {/* Secret Code */}
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Secret Code</p>
                <p className="font-mono font-extrabold text-base text-primary tracking-widest truncate">{order.secret_code || '—'}</p>
              </div>
            </div>
          </div>

          {/* Created & Expires Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <Calendar className="h-4 w-4 text-sky-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="font-semibold text-foreground truncate">{formatDate(order.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <Clock className="h-4 w-4 text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expires</p>
                <p className="font-semibold text-foreground truncate">{formatDate(order.expire_date)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border/50 bg-muted/20 px-6 py-3 shrink-0">
          <button type="button" onClick={onClose} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Address Field (module-level to avoid re-mount on every keystroke) ─────────
function AddressField({
  label, field, placeholder, required, value, onChange,
}: {
  label: string;
  field: keyof DeliveryAddress;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange(field)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
      />
    </div>
  );
}

// ── Edit Delivery Address Modal ───────────────────────────────────────────────
function EditDeliveryAddressModal({
  order, isOpen, onClose, onUpdated,
}: { order: GiftOrder | null; isOpen: boolean; onClose: () => void; onUpdated: (o: GiftOrder) => void }) {
  const empty: DeliveryAddress = { area: '', city: '', block: '', street: '', building: '', floor: '', apartment: '', notes: '' };
  const [form, setForm]       = useState<DeliveryAddress>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setForm({
        area:      order.delivery_address?.area      ?? '',
        city:      order.delivery_address?.city      ?? '',
        block:     order.delivery_address?.block     ?? '',
        street:    order.delivery_address?.street    ?? '',
        building:  order.delivery_address?.building  ?? '',
        floor:     order.delivery_address?.floor     ?? '',
        apartment: order.delivery_address?.apartment ?? '',
        notes:     order.delivery_address?.notes     ?? '',
      });
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, order]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen || !order) return null;

  const handleChange = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // handleFieldChange typed for input-only (used by AddressField)
  const handleFieldChange = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Strip empty strings so the payload stays clean
      const payload: DeliveryAddress = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v && (v as string).trim() !== '')
      ) as DeliveryAddress;
      const res  = await authedFetch(`/booknpay/api/v1/vouchers/${order.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_address: payload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || json?.detail || json?.message || `Failed (${res.status})`);
        return;
      }
      setSuccess(true);
      onUpdated({ ...order, delivery_address: payload, updated_at: new Date().toISOString() });
      setTimeout(() => onClose(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Edit Delivery Address</h3>
              <p className="text-xs text-muted-foreground">
                {order.sender_data?.name} → {order.recipient_data?.name || order.recipient_phone}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            {/* Recipient info banner */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex items-center gap-3 text-xs">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/10 text-violet-600 font-bold text-[10px] shrink-0">
                {order.recipient_data?.name?.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() || '?'}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-foreground truncate">{order.recipient_data?.name || '—'}</p>
                <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{order.recipient_phone || '—'}</p>
              </div>
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-2 gap-3">
              <AddressField label="Area"     field="area"     value={form.area     ?? ''} onChange={handleFieldChange} placeholder="e.g. Salmiya" />
              <AddressField label="City"     field="city"     value={form.city     ?? ''} onChange={handleFieldChange} placeholder="e.g. Kuwait City" />
              <AddressField label="Block"    field="block"    value={form.block    ?? ''} onChange={handleFieldChange} placeholder="e.g. 12" />
              <AddressField label="Street"   field="street"   value={form.street   ?? ''} onChange={handleFieldChange} placeholder="e.g. Al-Corniche St" />
              <AddressField label="Building" field="building" value={form.building ?? ''} onChange={handleFieldChange} placeholder="e.g. 45" />
              <div className="grid grid-cols-2 gap-2 col-span-2">
                <AddressField label="Floor"     field="floor"     value={form.floor     ?? ''} onChange={handleFieldChange} placeholder="e.g. 3" />
                <AddressField label="Apartment" field="apartment" value={form.apartment ?? ''} onChange={handleFieldChange} placeholder="e.g. 12A" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes ?? ''}
                onChange={handleChange('notes')}
                placeholder="Delivery instructions, landmark, etc."
                className="w-full resize-none rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" /><span>Address updated successfully!</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border/50 bg-muted/20 px-6 py-3 shrink-0">
            <button type="button" onClick={onClose} className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={submitting || success}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition">
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {success ? 'Saved!' : 'Update Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Update Delivery Status Modal ──────────────────────────────────────────────
function UpdateDeliveryStatusModal({
  order, isOpen, onClose, onUpdated,
}: { order: GiftOrder | null; isOpen: boolean; onClose: () => void; onUpdated: (o: GiftOrder) => void }) {
  const [status, setStatus]       = useState<string>('ordered');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) { setStatus(order.delivery_status || 'ordered'); setError(null); }
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
    try {
      const res  = await authedFetch(`/booknpay/api/v1/vouchers/${order.id}/delivery-status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_status: status, status, note: '' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setError(json?.error?.message || json?.detail || json?.message || `Failed (${res.status})`);
        return;
      }
      const cfg = DELIVERY_STATUS_CONFIG[status];
      onUpdated({ ...order, delivery_status: status, delivery_status_label: cfg?.label || status, delivery_status_label_ar: cfg?.labelAr || status, updated_at: new Date().toISOString() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    { key: 'ordered',     label: 'Ordered',     desc: 'Gift order placed' },
    { key: 'ready_to_go', label: 'Ready To Go', desc: 'Packed & ready to dispatch' },
    { key: 'on_the_way',  label: 'On The Way',  desc: 'Out for delivery' },
    { key: 'delivered',   label: 'Delivered',   desc: 'Delivered to recipient' },
    { key: 'received',    label: 'Received',    desc: 'Recipient confirmed receipt' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Update Delivery Status</h3>
                <p className="text-xs text-muted-foreground">{order.sender_data?.name} → {order.recipient_data?.name || order.recipient_phone}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                Select Delivery Status <span className="text-destructive">*</span>
              </label>
              <div className="space-y-2">
                {statusOptions.map((opt) => {
                  const cfg = DELIVERY_STATUS_CONFIG[opt.key];
                  const isSelected = status === opt.key;
                  return (
                    <div key={opt.key} onClick={() => setStatus(opt.key)}
                      className={cn('flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition text-xs',
                        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:bg-muted/40')}>
                      <div className="flex items-center gap-2.5">
                        <div className={cn('h-4 w-4 rounded-full border flex items-center justify-center transition',
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
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
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg?.badgeClass)}>{cfg?.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/50 bg-muted/20 px-6 py-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 transition">
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save Status
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Gift Orders Page ──────────────────────────────────────────────────────
export default function GiftOrdersPage() {
  const initialized     = useAppSelector((s) => s.auth.initialized);
  const locale          = useAppSelector((s) => s.ui.locale);

  const [orders, setOrders]               = useState<GiftOrder[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [updatingId, setUpdatingId]       = useState<string | null>(null);
  const [view, setView]                   = useState<'list' | 'grid'>('list');
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<string>('all');
  const [toast, setToast]                 = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [addressModalOrder, setAddressModalOrder]     = useState<GiftOrder | null>(null);
  const [detailsModalOrder, setDetailsModalOrder]     = useState<GiftOrder | null>(null);
  const [statusModalOrder, setStatusModalOrder]       = useState<GiftOrder | null>(null);
  const [editAddrModalOrder, setEditAddrModalOrder]   = useState<GiftOrder | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await authedFetch('/booknpay/api/v1/vouchers/?gift_category=physical', { headers: { Accept: 'application/json' } });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.detail || 'Failed to load gift orders'); setOrders([]); return; }
      let list: GiftOrder[] = [];
      if (Array.isArray(json))                             list = json;
      else if (Array.isArray(json?.results))               list = json.results;
      else if (json?.success && Array.isArray(json?.data)) list = json.data;
      else if (Array.isArray(json?.data))                  list = json.data;
      // Exclude service gift orders — this page is physical delivery only
      setOrders(list.filter((o) => o.gift_category !== 'service'));
    } catch {
      setError('Unable to load gift orders. Please check your connection.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders, initialized]);

  const handleTransit = async (order: GiftOrder, nextStatus: string) => {
    setUpdatingId(order.id);
    try {
      const res  = await authedFetch(`/booknpay/api/v1/vouchers/${order.id}/delivery-status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_status: nextStatus, status: nextStatus, note: '' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setToast({ type: 'error', message: json?.error?.message || json?.detail || json?.message || `Failed (${res.status})` });
        return;
      }
      const cfg = DELIVERY_STATUS_CONFIG[nextStatus];
      setOrders((prev) => prev.map((o) => o.id === order.id
        ? { ...o, delivery_status: nextStatus, delivery_status_label: cfg?.label || nextStatus, delivery_status_label_ar: cfg?.labelAr || nextStatus, updated_at: new Date().toISOString() }
        : o));
      setToast({ type: 'success', message: `Gift order delivery status updated to "${cfg?.label || nextStatus}".` });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Network error.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusModalUpdated = (updated: GiftOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setToast({ type: 'success', message: `Gift order delivery status updated to "${updated.delivery_status_label || updated.delivery_status}".` });
  };

  const handleAddressUpdated = (updated: GiftOrder) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setToast({ type: 'success', message: 'Delivery address updated successfully.' });
  };

  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (statusFilter !== 'all' && (o.delivery_status || '') !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');
      const qCode = q.replace(/[\s\-_]/g, '');

      // Voucher code / secret_code matching
      const secretCode = (o.secret_code || '').toLowerCase();
      const secretCodeClean = secretCode.replace(/[\s\-_]/g, '');
      const matchesSecretCode = secretCode.includes(q) || (qCode.length > 0 && secretCodeClean.includes(qCode));

      const vNum = (o.voucher_number || (o as any).voucher_no || '').toLowerCase();
      const vNumClean = vNum.replace(/[\s\-_]/g, '');
      const matchesVNum = vNum.includes(q) || (qCode.length > 0 && vNumClean.includes(qCode));

      // Recipient number matching (check all potential phone fields)
      const recipientPhones = [
        o.recipient_phone,
        o.recipient_data?.phone_number,
        (o as any).recipient_number,
        (o as any).recipient_phone_number,
        (o as any).recipient_details?.phone_number,
      ].filter(Boolean) as string[];

      const matchesRecipientPhone = recipientPhones.some((phone) => {
        const phoneLower = phone.toLowerCase();
        if (phoneLower.includes(q)) return true;
        if (qDigits.length >= 3) {
          const phoneDigits = phone.replace(/\D/g, '');
          if (phoneDigits.includes(qDigits)) return true;
        }
        return false;
      });

      // Sender phone matching
      const senderPhones = [
        o.sender_data?.phone_number,
        (o as any).sender_phone,
      ].filter(Boolean) as string[];

      const matchesSenderPhone = senderPhones.some((phone) => {
        const phoneLower = phone.toLowerCase();
        if (phoneLower.includes(q)) return true;
        if (qDigits.length >= 3) {
          const phoneDigits = phone.replace(/\D/g, '');
          if (phoneDigits.includes(qDigits)) return true;
        }
        return false;
      });

      return (
        matchesSecretCode ||
        matchesRecipientPhone ||
        matchesVNum ||
        matchesSenderPhone ||
        o.id.toLowerCase().includes(q) ||
        (o.sender_data?.name || '').toLowerCase().includes(q) ||
        (o.recipient_data?.name || '').toLowerCase().includes(q) ||
        (o.gift_message || '').toLowerCase().includes(q) ||
        (o.status || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [orders, search, statusFilter]);

  const kpis = useMemo(() => ({
    total:     orders.length,
    ordered:   orders.filter((o) => o.delivery_status === 'ordered').length,
    rtg:       orders.filter((o) => o.delivery_status === 'ready_to_go').length,
    onWay:     orders.filter((o) => o.delivery_status === 'on_the_way').length,
    delivered: orders.filter((o) => o.delivery_status === 'delivered').length,
    received:  orders.filter((o) => o.delivery_status === 'received').length,
  }), [orders]);

  const statusCfgFor = (o: GiftOrder) => DELIVERY_STATUS_CONFIG[o.delivery_status || 'ordered'] ?? DELIVERY_STATUS_CONFIG.ordered;
  const statusLabelFor = (o: GiftOrder) => {
    const cfg = statusCfgFor(o);
    return locale === 'ar' && o.delivery_status_label_ar ? o.delivery_status_label_ar : o.delivery_status_label || cfg.label;
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className={cn('fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border p-4 shadow-2xl max-w-md',
            toast.type === 'error' ? 'border-destructive/40 bg-card text-destructive' : 'border-emerald-500/30 bg-card text-foreground')}>
            {toast.type === 'error' ? <AlertCircle className="h-5 w-5 text-destructive shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            <span className="text-xs font-bold text-foreground">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground ml-2 p-1"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Header */}
        <PageHeader title="Gift Vouchers" subtitle="Track and manage physical gift deliveries for all gift vouchers.">
          <button onClick={fetchOrders} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-card px-4 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </PageHeader>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>
            <button onClick={fetchOrders} className="font-bold underline hover:opacity-80">Retry</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs font-bold uppercase tracking-wider">Total</span><Gift className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{kpis.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Physical gift vouchers</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400"><span className="text-xs font-bold uppercase tracking-wider">Ordered</span><Clock className="h-4 w-4" /></div>
            <p className="mt-2 text-2xl font-black tracking-tight text-amber-900 dark:text-amber-200">{kpis.ordered}</p>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">Newly placed</p>
          </div>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400"><span className="text-xs font-bold uppercase tracking-wider">Ready To Go</span><Package className="h-4 w-4" /></div>
            <p className="mt-2 text-2xl font-black tracking-tight text-blue-900 dark:text-blue-200">{kpis.rtg}</p>
            <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">Packed &amp; ready</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-sky-700 dark:text-sky-400"><span className="text-xs font-bold uppercase tracking-wider">On The Way</span><Truck className="h-4 w-4" /></div>
            <p className="mt-2 text-2xl font-black tracking-tight text-sky-900 dark:text-sky-200">{kpis.onWay}</p>
            <p className="text-[11px] text-sky-700/70 dark:text-sky-400/70 mt-0.5">In transit</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400"><span className="text-xs font-bold uppercase tracking-wider">Delivered</span><CheckCircle2 className="h-4 w-4" /></div>
            <p className="mt-2 text-2xl font-black tracking-tight text-emerald-900 dark:text-emerald-200">{kpis.delivered + kpis.received}</p>
            <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">{kpis.delivered} delivered · {kpis.received} received</p>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher code, recipient number, sender..."
                className="w-full rounded-xl border border-border/80 bg-background pl-10 pr-10 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* View Switcher */}
              <div className="flex rounded-xl border border-border/80 bg-background p-0.5">
                <button onClick={() => setView('list')} title="List View"
                  className={cn('rounded-lg p-1.5 transition', view === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <List className="h-4 w-4" />
                </button>
                <button onClick={() => setView('grid')} title="Grid View"
                  className={cn('rounded-lg p-1.5 transition', view === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-border/40 pt-3">
            {[
              { id: 'all',          label: 'All',          count: orders.length },
              { id: 'ordered',      label: 'Ordered',      count: orders.filter((o) => o.delivery_status === 'ordered').length },
              { id: 'ready_to_go',  label: 'Ready To Go',  count: orders.filter((o) => o.delivery_status === 'ready_to_go').length },
              { id: 'on_the_way',   label: 'On The Way',   count: orders.filter((o) => o.delivery_status === 'on_the_way').length },
              { id: 'delivered',    label: 'Delivered',    count: orders.filter((o) => o.delivery_status === 'delivered').length },
              { id: 'received',     label: 'Received',     count: orders.filter((o) => o.delivery_status === 'received').length },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                className={cn('flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  statusFilter === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <span>{tab.label}</span>
                <span className={cn('rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  statusFilter === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground')}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mb-3"><Gift className="h-8 w-8" /></div>
            <h3 className="font-extrabold text-base text-foreground">No gift vouchers found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || statusFilter !== 'all'
                ? 'No gift vouchers matching the selected filters or search query.'
                : 'No physical gift vouchers are currently available.'}
            </p>
            {(search || statusFilter !== 'all') && (
              <button onClick={() => { setStatusFilter('all'); setSearch(''); }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition">
                <RotateCcw className="h-3.5 w-3.5" />Reset Filters
              </button>
            )}
          </div>
        ) : view === 'list' ? (
          /* ── TABLE VIEW ── */
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Voucher Code</th>
                    <th className="py-3 px-4">Sender → Recipient</th>
                    <th className="py-3 px-4">Category / Items</th>
                    <th className="py-3 px-4">Delivery Address</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredOrders.map((order) => {
                    const cfg = statusCfgFor(order);
                    const label = statusLabelFor(order);
                    const orderStatusCfg = getOrderStatusConfig(order.status);
                    const catCfg = getCategoryConfig(order.gift_category, order);
                    const CatIcon = catCfg.icon;
                    const isPhysical = (order.gift_category || '').toLowerCase() === 'physical';
                    const isDigital = (order.gift_category || '').toLowerCase() === 'digital' || Boolean(order.digital_product_data);
                    const itemCount = isPhysical ? (order.ordered_items?.length ?? 0) : 1;

                    return (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <p className="font-bold text-foreground font-mono text-[11px]">{order.secret_code || '—'}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-[10px] shrink-0">{initials(order.sender_data?.name)}</div>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[100px]">{order.sender_data?.name || '—'}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ArrowRight className="h-3 w-3 text-muted-foreground ml-0.5" />
                            <div className="grid h-6 w-6 place-items-center rounded-lg bg-violet-500/10 text-violet-600 font-bold text-[10px] shrink-0">{initials(order.recipient_data?.name)}</div>
                            <p className="font-semibold text-foreground text-xs truncate max-w-[100px]">{order.recipient_data?.name || '—'}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground ml-7">{order.recipient_phone}</p>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', catCfg.color)}>
                            <CatIcon className="h-3 w-3" />{catCfg.label}
                          </span>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {isDigital
                              ? (order.digital_product_data?.title || order.digital_product_data?.name || 'Digital gift')
                              : isPhysical
                              ? `${itemCount} item${itemCount !== 1 ? 's' : ''}`
                              : (order.service_data?.name || 'Service gift')}
                          </p>
                        </td>
                        <td className="py-3 px-4 align-top max-w-[200px]">
                          {isPhysical ? (
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                                {order.delivery_address ? formatAddressPreview(order.delivery_address) : <span className="italic">No address set</span>}
                              </p>
                              <button
                                onClick={() => setEditAddrModalOrder(order)}
                                title="Edit delivery address"
                                className="inline-flex items-center justify-center h-6 w-6 rounded-lg border border-border/80 bg-background text-primary hover:bg-primary/10 transition shrink-0">
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">{order.branch_data?.name || '—'}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          {isPhysical ? (
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.badgeClass)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />{label}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">N/A (Service)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          {order.status ? (
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize', orderStatusCfg.badgeClass)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', orderStatusCfg.dotClass)} />
                              {orderStatusCfg.label}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button onClick={() => setDetailsModalOrder(order)}
                              className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition">
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />Details
                            </button>
                            {isPhysical && (
                              <>
                                {order.delivery_status === 'ordered' && (
                                  <button onClick={() => handleTransit(order, 'ready_to_go')} disabled={updatingId === order.id}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
                                    {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                                    Ready To Go
                                  </button>
                                )}
                                {order.delivery_status === 'ready_to_go' && (
                                  <button onClick={() => handleTransit(order, 'on_the_way')} disabled={updatingId === order.id}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition">
                                    {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                                    On The Way
                                  </button>
                                )}
                                {order.delivery_status === 'on_the_way' && (
                                  <button onClick={() => handleTransit(order, 'delivered')} disabled={updatingId === order.id}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition">
                                    {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Mark Delivered
                                  </button>
                                )}
                                {order.delivery_status === 'delivered' && (
                                  <button onClick={() => handleTransit(order, 'received')} disabled={updatingId === order.id}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition">
                                    {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                    Confirm Received
                                  </button>
                                )}
                                {order.delivery_status === 'received' && (
                                  <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300">
                                    <Check className="h-3.5 w-3.5 text-purple-600" />Received
                                  </span>
                                )}
                                <button onClick={() => setStatusModalOrder(order)} disabled={updatingId === order.id}
                                  className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition">
                                  <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />Update
                                </button>
                              </>
                            )}
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
          /* ── GRID VIEW ── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const cfg = statusCfgFor(order);
              const label = statusLabelFor(order);
              const orderStatusCfg = getOrderStatusConfig(order.status);
              const voucherNum = getOrderVoucherNumber(order);
              const catCfg = getCategoryConfig(order.gift_category, order);
              const CatIcon = catCfg.icon;
              const isPhysical = (order.gift_category || '').toLowerCase() === 'physical';
              const isDigital = (order.gift_category || '').toLowerCase() === 'digital' || Boolean(order.digital_product_data);

              return (
                <div key={order.id} className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        {voucherNum ? (
                          <>
                            <p className="font-extrabold text-sm text-foreground font-mono">{voucherNum}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          </>
                        ) : (
                          <p className="font-extrabold text-sm text-foreground font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0', catCfg.color)}>
                          <CatIcon className="h-3 w-3" />{catCfg.label}
                        </span>
                        {isPhysical && (
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0', cfg.badgeClass)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />{label}
                          </span>
                        )}
                        {order.status && (
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 capitalize', orderStatusCfg.badgeClass)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', orderStatusCfg.dotClass)} />{orderStatusCfg.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sender → Recipient */}
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0">{initials(order.sender_data?.name)}</div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-xs text-foreground truncate">{order.sender_data?.name || '—'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{order.sender_data?.phone_number || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground mb-1 ml-1"><ArrowRight className="h-3 w-3" /></div>
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/10 text-violet-600 font-bold text-xs shrink-0">{initials(order.recipient_data?.name)}</div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-xs text-foreground truncate">{order.recipient_data?.name || '—'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{order.recipient_phone || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-xs mb-3">
                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-2.5">
                        <span className="text-muted-foreground font-semibold">Total</span>
                        <span className="font-extrabold text-foreground">{formatAmount(order.total_amount, order.currency)}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background p-2.5">
                        <KeyRound className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">Code:</span>
                        <span className="font-mono font-extrabold tracking-widest text-foreground">{order.secret_code}</span>
                      </div>
                      {isPhysical && (
                        <div className="rounded-xl border border-border/50 bg-background p-2.5">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />Delivery Address</span>
                            <button onClick={() => setEditAddrModalOrder(order)} title="Edit delivery address"
                              className="inline-flex items-center justify-center h-5 w-5 rounded-md border border-border/80 bg-background text-primary hover:bg-primary/10 transition">
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                            {order.delivery_address ? formatAddressPreview(order.delivery_address) : <span className="italic text-muted-foreground">No address set</span>}
                          </p>
                        </div>
                      )}
                      {isDigital && (
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background p-2.5">
                          <Smartphone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <p className="text-foreground font-semibold truncate">{order.digital_product_data?.title || order.digital_product_data?.name || 'Digital Gift'}</p>
                        </div>
                      )}
                      {!isPhysical && !isDigital && order.service_data?.name && (
                        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background p-2.5">
                          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <p className="text-foreground font-semibold truncate">{order.service_data.name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-border/40 pt-3 flex items-center gap-2 flex-wrap">
                    <button onClick={() => setDetailsModalOrder(order)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition shrink-0">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />Details
                    </button>
                    {isPhysical && (
                      <>
                        {order.delivery_status === 'ordered' && (
                          <button onClick={() => handleTransit(order, 'ready_to_go')} disabled={updatingId === order.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition flex-1">
                            {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}Ready To Go
                          </button>
                        )}
                        {order.delivery_status === 'ready_to_go' && (
                          <button onClick={() => handleTransit(order, 'on_the_way')} disabled={updatingId === order.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition flex-1">
                            {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}On The Way
                          </button>
                        )}
                        {order.delivery_status === 'on_the_way' && (
                          <button onClick={() => handleTransit(order, 'delivered')} disabled={updatingId === order.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition flex-1">
                            {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Mark Delivered
                          </button>
                        )}
                        {order.delivery_status === 'delivered' && (
                          <button onClick={() => handleTransit(order, 'received')} disabled={updatingId === order.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50 transition flex-1">
                            {updatingId === order.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}Confirm Received
                          </button>
                        )}
                        {order.delivery_status === 'received' && (
                          <div className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/40 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                            <Check className="h-3.5 w-3.5 text-purple-600" />Received
                          </div>
                        )}
                        <button onClick={() => setStatusModalOrder(order)} disabled={updatingId === order.id}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition shrink-0">
                          <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />Update
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modals */}
        <DeliveryAddressModal order={addressModalOrder} isOpen={Boolean(addressModalOrder)} onClose={() => setAddressModalOrder(null)} />
        <GiftDetailsModal order={detailsModalOrder} isOpen={Boolean(detailsModalOrder)} onClose={() => setDetailsModalOrder(null)} />
        <UpdateDeliveryStatusModal order={statusModalOrder} isOpen={Boolean(statusModalOrder)} onClose={() => setStatusModalOrder(null)} onUpdated={handleStatusModalUpdated} />
        <EditDeliveryAddressModal order={editAddrModalOrder} isOpen={Boolean(editAddrModalOrder)} onClose={() => setEditAddrModalOrder(null)} onUpdated={handleAddressUpdated} />
      </div>
    </DashboardShell>
  );
}
