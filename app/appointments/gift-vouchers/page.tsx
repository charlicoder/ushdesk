'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gift, Loader2, AlertCircle, RefreshCw, ExternalLink, Eye,
  X, CheckCircle2, Clock, XCircle, ChevronDown,
  User, Scissors, MapPin, Timer, Package, CreditCard,
  MessageSquare, Hash, Building2, Building, Smartphone, Truck, Phone, Mail, Calendar, CalendarDays,
  Sparkles, Star, Search, ArrowRight, Share2, Check, Copy, MessageCircle,
  KeyRound, Globe, Send,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { CreateVoucherModal } from '@/components/bookings/CreateVoucherModal';
import { RescheduleBookingModal } from '@/components/bookings/RescheduleBookingModal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ServiceType {
  id: string;
  name: string;
}

interface ServiceData {
  name: string;
  image: string | null;
  currency: string;
  base_price: string;
  service_types: ServiceType[];
  duration_minutes: number;
}

interface BranchData {
  name: string;
  branch_id: string;
}

interface ArrangementData {
  image: string | null;
  price: string | null;
  currency: string;
  arrangement_name: string;
  arrangement_type: string;
}

interface Addon {
  id: string;
  name: string;
  price: string;
  currency: string;
  description: string;
  duration_minutes: number;
}

interface PersonDetails {
  name: string;
  email?: string;
  phone_number?: string;
}

interface BookingData {
  id?: string;
  booking_number?: string;
  booking_no?: string;
  status?: string;
  appointment_date?: string;
  appointment_start?: string;
  appointment_end?: string;
  duration_minutes?: number;
  total_duration?: number;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_data?: {
    name?: string;
    phone_number?: string;
    email?: string;
    [key: string]: any;
  };
  therapist_id?: string;
  therapist_name?: string;
  therapist_data?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  };
  branch_name?: string;
  branch_data?: {
    name?: string;
    [key: string]: any;
  };
  arrangement_name?: string;
  arrangement_type?: string;
  service_arrangement_data?: {
    arrangement_name?: string;
    arrangement_type?: string;
    [key: string]: any;
  };
  created_at?: string;
  [key: string]: any;
}

interface PaymentTransaction {
  PaymentGateway: string;
  TransactionStatus: string;
  TrackId: string;
  TransactionDate: string;
  TransationValue: string;
  Currency: string;
  AuthorizationId: string;
}

interface PaymentData {
  data?: {
    InvoiceId?: number;
    InvoiceStatus?: string;
    InvoiceValue?: number;
    CustomerName?: string;
    InvoiceTransactions?: PaymentTransaction[];
    ExpiryDate?: string;
  };
  isPaid?: boolean;
  status?: string;
  invoiceId?: string;
  paymentUrl?: string;
}

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
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  notes?: string;
  formatted?: string;
}

interface Voucher {
  id: string;
  voucher_number?: string | null;
  service_id: string;
  service_data: ServiceData;
  branch_id: string;
  branch_data: BranchData;
  service_arrangement_id: string;
  service_arrangement_data: ArrangementData;
  addons: Addon[];
  extra_time: number;
  price_for_extra_time?: string | null;
  expire_date: string;
  status: string;
  sender_id: string;
  sender_details: PersonDetails;
  sender_data?: PersonDetails;
  recipient_phone: string;
  recipient_details: PersonDetails;
  recipient_data?: PersonDetails;
  created_by: string;
  total_duration: number;
  total_amount: string;
  currency: string;
  gift_message: string;
  gift_template: string;
  secret_code: string;
  public_token: string;
  gift_category?: 'physical' | 'digital' | 'service' | string;
  digital_product_data?: any;
  ordered_items?: OrderedItem[] | null;
  delivery_status?: string | null;
  delivery_status_label?: string | null;
  delivery_address?: DeliveryAddress | null;
  redeemed_booking_id: string | null;
  redeemed_at: string | null;
  redeemed_by?: string | null;
  redeemed_by_data?: PersonDetails | null;
  booking_id: string | null;
  booking_data?: BookingData | null;
  payment_id: string | null;
  payment_data: PaymentData | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', { timeZone: KUWAIT_TZ, day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { timeZone: KUWAIT_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatAmount(amount: string | number | null | undefined, currency = 'KWD'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const val = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(val)) return '—';
  return `${val.toFixed(3)} ${currency}`;
}

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

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', {
    timeZone: KUWAIT_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function fmtMoney(amount: string, currency: string): string {
  const n = parseFloat(amount ?? '0');
  return `${isNaN(n) ? '0.000' : n.toFixed(3)} ${currency}`;
}

const GIFT_CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  physical: { label: 'Physical Gift', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800', icon: Package },
  digital:  { label: 'Digital Gift',  color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: Smartphone },
  service:  { label: 'Service Gift',  color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800', icon: Sparkles },
};

function getCategoryConfig(category?: string | null, voucher?: Voucher) {
  const cat = (category || '').toLowerCase();
  if (cat === 'digital' || (voucher as any)?.digital_product_data || (voucher as any)?.gift_type === 'digital' || (voucher as any)?.gift_type === 'digital_service') {
    return GIFT_CATEGORY_CONFIG.digital;
  }
  if (cat && GIFT_CATEGORY_CONFIG[cat]) {
    return GIFT_CATEGORY_CONFIG[cat];
  }
  return GIFT_CATEGORY_CONFIG.service;
}

const DELIVERY_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  ordered: {
    label: 'Ordered',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  accepted: {
    label: 'Accepted',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    dotClass: 'bg-sky-500',
  },
  ready_to_go: {
    label: 'Ready To Go',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    dotClass: 'bg-blue-500',
  },
  on_the_way: {
    label: 'On The Way',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    dotClass: 'bg-sky-500 animate-pulse',
  },
  delivered: {
    label: 'Delivered',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  received: {
    label: 'Received',
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

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string; icon: React.ElementType }> = {
  active:   { label: 'Active',   pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500',            icon: CheckCircle2 },
  redeemed: { label: 'Redeemed', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',     dot: 'bg-violet-500',             icon: Star },
  expired:  { label: 'Expired',  pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             dot: 'bg-rose-500',               icon: XCircle },
  pending:  { label: 'Pending',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         dot: 'bg-amber-500 animate-pulse', icon: Clock },
};

function statusCfg(s: string) {
  return STATUS_CFG[s?.toLowerCase()] ?? STATUS_CFG['pending'];
}

function getVoucherPublicUrl(voucher: Voucher): string {
  if (voucher.public_token) {
    return `https://ushspa.co/gift/${voucher.public_token}`;
  }
  if (voucher.payment_url) {
    return voucher.payment_url;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://desk.ushspa.co';
  return `${origin}/appointments/gift-vouchers?code=${encodeURIComponent(voucher.secret_code || voucher.id)}`;
}

// ── Voucher Share Dropdown ─────────────────────────────────────────────────────

interface VoucherShareDropdownProps {
  voucher: Voucher;
  label?: string;
  className?: string;
  dropUp?: boolean;
  onSelectChannel: (voucher: Voucher, channel: 'sms' | 'whatsapp') => void;
  onCopyUrl?: (voucher: Voucher) => void;
}

function VoucherShareDropdown({
  voucher,
  label = 'Share',
  className,
  dropUp = false,
  onSelectChannel,
  onCopyUrl,
}: VoucherShareDropdownProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getVoucherPublicUrl(voucher);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback
    }
    setCopied(true);
    onCopyUrl?.(voucher);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1200);
  };

  const handleChannel = (channel: 'sms' | 'whatsapp') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    onSelectChannel(voucher, channel);
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 hover:text-primary transition shadow-sm',
          className
        )}
        title={label}
      >
        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute right-0 z-50 w-52 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-150',
              dropUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'
            )}
          >
            <div className="px-2.5 py-1 border-b border-border/40 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Share Options</p>
            </div>
            <button
              type="button"
              onClick={handleChannel('sms')}
              className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition text-left group"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground leading-none">SMS</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Send reminder via SMS</p>
              </div>
            </button>
            <button
              type="button"
              onClick={handleChannel('whatsapp')}
              className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition text-left group"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 transition">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground leading-none">WhatsApp</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Send reminder via WhatsApp</p>
              </div>
            </button>
            <div className="border-t border-border/40 my-1" />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition text-left group"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold leading-none', copied ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-foreground')}>
                  {copied ? 'Copied URL!' : 'Copy Public URL'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Copy link to clipboard</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Voucher Detail Modal ───────────────────────────────────────────────────────

function VoucherDetailModal({
  voucher,
  token,
  onClose,
  onShare,
  onCopyUrl,
  onReschedule,
}: {
  voucher: Voucher;
  token?: string | null;
  onClose: () => void;
  onShare?: (voucher: Voucher, channel: 'sms' | 'whatsapp') => void;
  onCopyUrl?: (voucher: Voucher) => void;
  onReschedule?: (voucher: Voucher, bookingId?: string, bookingData?: any) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const catCfg = getCategoryConfig(voucher.gift_category, voucher);
  const CatIcon = catCfg.icon;
  const isPhysical = (voucher.gift_category || '').toLowerCase() === 'physical';
  const isDigital = (voucher.gift_category || '').toLowerCase() === 'digital' || Boolean(voucher.digital_product_data);
  const delCfg = DELIVERY_STATUS_CONFIG[voucher.delivery_status || 'ordered'] ?? DELIVERY_STATUS_CONFIG.ordered;
  const ordStatusCfg = getOrderStatusConfig(voucher.status);

  const isExpired = voucher.expire_date && new Date(voucher.expire_date) < new Date();
  const canRedeem = !isExpired && voucher.status?.toLowerCase() === 'active';
  const isRedeemed = voucher.status?.toLowerCase() === 'redeemed' || !!voucher.redeemed_at;
  const bookingId = voucher.redeemed_booking_id || voucher.booking_id || voucher.booking_data?.id;

  const [fetchedBooking, setFetchedBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  useEffect(() => {
    if (!isRedeemed || !bookingId) return;
    if (voucher.booking_data && (voucher.booking_data.appointment_date || voucher.booking_data.appointment_start)) {
      return;
    }
    let active = true;
    setLoadingBooking(true);
    fetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setFetchedBooking(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch booking details for redeemed voucher:', err);
      })
      .finally(() => {
        if (active) setLoadingBooking(false);
      });
    return () => {
      active = false;
    };
  }, [isRedeemed, bookingId, voucher.booking_data, token]);

  const booking = voucher.booking_data || fetchedBooking;

  const redeemedByName =
    booking?.customer_data?.name ||
    booking?.customer_name ||
    voucher.redeemed_by_data?.name ||
    (typeof voucher.redeemed_by === 'string' && !voucher.redeemed_by.includes('-') ? voucher.redeemed_by : null) ||
    voucher.recipient_data?.name ||
    voucher.recipient_details?.name ||
    'Guest';

  const redeemedByPhone =
    booking?.customer_data?.phone_number ||
    booking?.customer_phone ||
    voucher.redeemed_by_data?.phone_number ||
    voucher.recipient_phone ||
    voucher.recipient_data?.phone_number ||
    voucher.recipient_details?.phone_number ||
    null;

  const redeemedByEmail =
    booking?.customer_data?.email ||
    voucher.redeemed_by_data?.email ||
    voucher.recipient_data?.email ||
    voucher.recipient_details?.email ||
    null;

  const apptDateRaw = booking?.appointment_date || booking?.appointment_start;
  const apptDateFormatted = apptDateRaw ? fmtDate(apptDateRaw) : null;
  const apptStartFormatted = booking?.appointment_start ? formatTime(booking.appointment_start) : null;
  const apptEndFormatted = booking?.appointment_end ? formatTime(booking.appointment_end) : null;
  const apptTimeWindow =
    apptStartFormatted && apptEndFormatted
      ? `${apptStartFormatted} – ${apptEndFormatted}`
      : apptStartFormatted || (apptDateRaw ? formatDateTime(apptDateRaw) : null);

  const therapistName =
    booking?.therapist_data?.name ||
    (booking?.therapist_data?.first_name ? `${booking.therapist_data.first_name} ${booking.therapist_data.last_name || ''}`.trim() : null) ||
    booking?.therapist_name ||
    null;

  const bookingBranch = booking?.branch_data?.name || booking?.branch_name || voucher.branch_data?.name;
  const bookingRoom =
    booking?.service_arrangement_data?.arrangement_name ||
    booking?.arrangement_name ||
    voucher.service_arrangement_data?.arrangement_name;

  const bookingNumber = booking?.booking_number || booking?.booking_no || (bookingId ? `BOK-${bookingId.slice(0, 8).toUpperCase()}` : null);

  const publicUrl = voucher.public_token
    ? `https://ushspa.co/gift/${voucher.public_token}`
    : (voucher.payment_url || null);

  const handleCopyCode = async () => {
    if (!voucher.secret_code) return;
    try {
      await navigator.clipboard.writeText(voucher.secret_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground">Gift Voucher Details</h3>
              <p className="text-xs text-muted-foreground">
                {formatDate(voucher.created_at)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Category & Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold', catCfg.color)}>
              <CatIcon className="h-3.5 w-3.5" />{catCfg.label}
            </span>
            {voucher.status && (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', ordStatusCfg.badgeClass)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', ordStatusCfg.dotClass)} />
                {ordStatusCfg.label}
              </span>
            )}
            {voucher.payment_data?.isPaid && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CreditCard className="h-3 w-3" /> Paid
              </span>
            )}
            {isExpired && voucher.status === 'active' && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                <XCircle className="h-3 w-3" /> Expired
              </span>
            )}
          </div>

          {/* Sender → Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">From (Sender)</p>
              <p className="font-bold text-sm text-foreground">{voucher.sender_data?.name || voucher.sender_details?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3 text-primary" />
                {voucher.sender_data?.phone_number || voucher.sender_details?.phone_number || '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">To (Recipient)</p>
              <p className="font-bold text-sm text-foreground">{voucher.recipient_data?.name || voucher.recipient_details?.name || '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3 text-primary" />
                {voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number || '—'}
              </p>
            </div>
          </div>

          {/* Ordered Items & Services */}
          {(Boolean(voucher.ordered_items?.length) || Boolean(voucher.service_data?.name) || Boolean(voucher.service_id) || Boolean(isDigital && voucher.digital_product_data) || Boolean(voucher.addons?.length)) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                Ordered Items
                {voucher.ordered_items && voucher.ordered_items.length > 0 ? ` (${voucher.ordered_items.length})` : ''}
              </p>
              <div className="space-y-3">
                {/* Physical Products */}
                {voucher.ordered_items && voucher.ordered_items.length > 0 && (
                  <div className="space-y-2">
                    {voucher.ordered_items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                        {item.image && (
                          <img src={item.image} alt={item.name_en || item.name} className="h-12 w-12 rounded-lg object-cover shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{item.name_en || item.name || 'Item'}</p>
                          <p className="text-[11px] text-muted-foreground">Qty: {item.quantity ?? 1} · {formatAmount(item.price, item.currency || voucher.currency)}</p>
                        </div>
                        <span className="text-xs font-bold text-foreground shrink-0">{formatAmount(item.total_price, item.currency || voucher.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Digital: Product Data */}
                {isDigital && voucher.digital_product_data && (
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                      <Smartphone className="h-3.5 w-3.5" />Digital Gift Details
                    </div>
                    {voucher.digital_product_data?.image && (
                      <img src={voucher.digital_product_data.image} alt="Digital Gift" className="h-28 w-full rounded-lg object-cover mb-2"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <p className="font-bold text-sm text-foreground">{voucher.digital_product_data?.title || voucher.digital_product_data?.name || 'Digital Gift Item'}</p>
                    {voucher.digital_product_data?.price && (
                      <p className="text-xs text-muted-foreground">{formatAmount(voucher.digital_product_data.price, voucher.digital_product_data.currency || voucher.currency)}</p>
                    )}
                  </div>
                )}

                {/* Service Details (including addons & extratime) */}
                {(voucher.service_data?.name || voucher.service_id) && (
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                    {voucher.service_data?.image && (
                      <img src={voucher.service_data.image} alt={voucher.service_data.name} className="w-full h-28 object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-0.5">
                            <Sparkles className="h-3 w-3" />Spa Service
                          </div>
                          <p className="font-bold text-sm text-foreground">{voucher.service_data?.name || 'Service'}</p>
                        </div>
                        {(voucher.service_data?.base_price || voucher.total_amount) && (
                          <span className="text-xs font-bold text-foreground shrink-0">
                            {formatAmount(voucher.service_data?.base_price || voucher.total_amount, voucher.service_data?.currency || voucher.currency)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {(voucher.service_data?.duration_minutes || voucher.total_duration) && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />{voucher.service_data?.duration_minutes || voucher.total_duration} min
                          </span>
                        )}
                        {voucher.branch_data?.name && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3 text-muted-foreground" />{voucher.branch_data.name}
                          </span>
                        )}
                        {voucher.service_arrangement_data?.arrangement_name && (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {voucher.service_arrangement_data.arrangement_name}
                          </span>
                        )}
                      </div>

                      {voucher.service_data?.service_types && voucher.service_data.service_types.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {voucher.service_data.service_types.map((st, idx) => (
                            <span key={st.id || `st-${idx}`} className="rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                              {st.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add-ons */}
                      {voucher.addons && voucher.addons.length > 0 && (
                        <div className="pt-2.5 border-t border-border/50">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-violet-500" />Add-ons ({voucher.addons.length})
                          </p>
                          <div className="space-y-1.5">
                            {voucher.addons.map((addon, idx) => (
                              <div key={addon.id || `addon-${idx}`} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                                <div>
                                  <span className="font-medium text-foreground">{addon.name}</span>
                                  {addon.duration_minutes ? (
                                    <span className="text-[11px] text-muted-foreground block">{addon.duration_minutes} min</span>
                                  ) : null}
                                </div>
                                <span className="font-semibold text-foreground shrink-0 ml-2">
                                  {formatAmount(addon.price, addon.currency || voucher.currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extra Time */}
                      {Boolean(voucher.extra_time && Number(voucher.extra_time) > 0) && (
                        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Timer className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium text-foreground">Extra Time:</span>
                            <span className="font-semibold text-foreground">+{voucher.extra_time} min</span>
                          </div>
                          {voucher.price_for_extra_time && Number(voucher.price_for_extra_time) > 0 ? (
                            <span className="font-semibold text-foreground">
                              {formatAmount(voucher.price_for_extra_time, voucher.currency)}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fallback Addons if no service_data?.name */}
                {!(voucher.service_data?.name || voucher.service_id) && voucher.addons && voucher.addons.length > 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-violet-500" />Add-ons ({voucher.addons.length})
                    </p>
                    <div className="space-y-1.5">
                      {voucher.addons.map((addon, idx) => (
                        <div key={addon.id || `addon-${idx}`} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                          <span className="font-medium text-foreground">{addon.name}</span>
                          <span className="font-semibold text-foreground shrink-0 ml-2">
                            {formatAmount(addon.price, addon.currency || voucher.currency)}
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
          {voucher.gift_message && (
            <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-rose-50/60 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/10 px-4 py-3">
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Gift Message</p>
                <p className="text-xs text-foreground leading-relaxed italic">&ldquo;{voucher.gift_message}&rdquo;</p>
              </div>
            </div>
          )}

          {/* Delivery Status */}
          {(isPhysical || voucher.delivery_status) && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Status</span>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', delCfg.badgeClass)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', delCfg.dotClass)} />
                  {voucher.delivery_status_label || delCfg.label}
                </span>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {(isPhysical || voucher.delivery_address) && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Address</span>
              </div>
              {voucher.delivery_address ? (
                <div className="space-y-2">
                  <p className="font-semibold text-foreground leading-snug">
                    {formatAddressPreview(voucher.delivery_address)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    {voucher.delivery_address.area && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Area</span>
                        <span className="font-medium text-foreground">{voucher.delivery_address.area}</span>
                      </div>
                    )}
                    {voucher.delivery_address.city && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">City</span>
                        <span className="font-medium text-foreground">{voucher.delivery_address.city}</span>
                      </div>
                    )}
                    {voucher.delivery_address.block && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Block</span>
                        <span className="font-medium text-foreground">{voucher.delivery_address.block}</span>
                      </div>
                    )}
                    {voucher.delivery_address.street && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Street</span>
                        <span className="font-medium text-foreground">{voucher.delivery_address.street}</span>
                      </div>
                    )}
                    {voucher.delivery_address.building && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Building</span>
                        <span className="font-medium text-foreground">{voucher.delivery_address.building}</span>
                      </div>
                    )}
                    {(voucher.delivery_address.floor || voucher.delivery_address.apartment) && (
                      <div className="rounded-lg border border-border/50 bg-card p-2">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Floor / Apt</span>
                        <span className="font-medium text-foreground">
                          {[voucher.delivery_address.floor && `Fl: ${voucher.delivery_address.floor}`, voucher.delivery_address.apartment && `Apt: ${voucher.delivery_address.apartment}`].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  {voucher.delivery_address.notes && (
                    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 p-2 text-xs">
                      <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Notes</span>
                      <p className="text-foreground italic mt-0.5">&ldquo;{voucher.delivery_address.notes}&rdquo;</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No delivery address set</p>
              )}
            </div>
          )}

          {/* Redeemed Booking Details Card */}
          {isRedeemed && (
            <div className="rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/70 via-card to-indigo-50/50 dark:from-violet-950/30 dark:via-card dark:to-indigo-950/20 p-4 space-y-3.5 shadow-xs">
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2 border-b border-violet-200/40 dark:border-violet-800/30 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-foreground tracking-tight">Redeemed Booking Details</h3>
                    <p className="text-[10px] text-muted-foreground">Voucher has been redeemed for an appointment</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                    <Star className="h-2.5 w-2.5 fill-violet-500 text-violet-500" /> Redeemed
                  </span>
                  {booking?.status && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary capitalize">
                      {booking.status}
                    </span>
                  )}
                </div>
              </div>

              {loadingBooking ? (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                  Loading appointment details…
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Grid of Key Redemption & Booking Info */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Who Redeemed */}
                    <div className="flex flex-col gap-1 rounded-xl bg-background/80 dark:bg-background/40 border border-violet-200/30 dark:border-violet-800/30 p-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3 w-3 text-violet-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Redeemed By</span>
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">{redeemedByName}</p>
                      {redeemedByPhone && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Phone className="h-2.5 w-2.5" />{redeemedByPhone}
                        </p>
                      )}
                      {redeemedByEmail && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {redeemedByEmail}
                        </p>
                      )}
                    </div>

                    {/* Redemption Time */}
                    <div className="flex flex-col gap-1 rounded-xl bg-background/80 dark:bg-background/40 border border-violet-200/30 dark:border-violet-800/30 p-2.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3 text-violet-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Redeemed At</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        {voucher.redeemed_at ? formatDateTime(voucher.redeemed_at) : '—'}
                      </p>
                      {bookingNumber && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono mt-auto">
                          <Hash className="h-2.5 w-2.5" />{bookingNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Appointment Schedule & Therapist Box */}
                  <div className="rounded-xl bg-background/80 dark:bg-background/40 border border-violet-200/30 dark:border-violet-800/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Calendar className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Schedule</p>
                          <p className="text-xs font-extrabold text-foreground">
                            {apptDateFormatted ?? 'Scheduled Appointment'}
                          </p>
                        </div>
                      </div>
                      {apptTimeWindow && (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-1 text-xs font-bold font-mono">
                            <Clock className="h-3 w-3" />
                            {apptTimeWindow}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px]">
                      {therapistName && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Therapist</span>
                          <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3 text-muted-foreground" /> {therapistName}
                          </span>
                        </div>
                      )}
                      {(bookingBranch || bookingRoom) && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Location</span>
                          <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5 truncate">
                            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                            {[bookingBranch, bookingRoom].filter(Boolean).join(' • ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment info */}
          {voucher.payment_data?.data && (
            <div className="rounded-2xl border border-emerald-200/40 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Payment</p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Status',   val: voucher.payment_data.data.InvoiceStatus },
                  { label: 'Invoice',  val: voucher.payment_data.data.InvoiceId?.toString() },
                  { label: 'Amount',   val: voucher.payment_data.data.InvoiceValue ? `${voucher.payment_data.data.InvoiceValue} ${voucher.payment_data.data?.InvoiceTransactions?.[0]?.Currency ?? ''}` : null },
                  { label: 'Gateway',  val: voucher.payment_data.data?.InvoiceTransactions?.[0]?.PaymentGateway },
                ].filter(r => r.val).map(r => (
                  <div key={r.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secret Code & Public URL Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Secret Code</p>
                  <p className="font-mono font-extrabold text-base text-primary tracking-widest truncate">{voucher.secret_code || '—'}</p>
                </div>
              </div>
              {voucher.secret_code && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-background/80 hover:bg-background px-2.5 py-1.5 text-xs font-semibold text-primary shadow-xs transition"
                  title="Copy Voucher Code"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {publicUrl && (
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-primary/10">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">Public URL:</span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-mono truncate"
                    title={publicUrl}
                  >
                    {publicUrl}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition"
                    title="Copy Public URL"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition"
                    title="Open public URL"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Created & Expires Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <Calendar className="h-4 w-4 text-sky-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created</p>
                <p className="font-semibold text-foreground truncate">{formatDate(voucher.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <Clock className="h-4 w-4 text-rose-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expires</p>
                <p className={cn('font-semibold truncate', isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                  {formatDate(voucher.expire_date)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 border-t border-border/40 px-6 py-4">
          <button onClick={onClose}
            type="button"
            className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          {isRedeemed ? (
            <button
              type="button"
              onClick={() => onReschedule?.(voucher, bookingId || undefined, booking)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-sm transition active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" /> Reschedule
            </button>
          ) : (
            onShare && (
              <div className="flex-1 flex justify-center">
                <VoucherShareDropdown
                  voucher={voucher}
                  label="Share Reminder"
                  className="w-full justify-center py-2.5 text-sm"
                  dropUp={true}
                  onSelectChannel={onShare}
                  onCopyUrl={onCopyUrl}
                />
              </div>
            )
          )}
          {voucher.payment_url && (
            <a
              href={voucher.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-sm transition active:scale-[0.98]"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Payment
            </a>
          )}
          {canRedeem && (
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" /> Redeem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status Filter Dropdown ─────────────────────────────────────────────────────

function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { val: 'all',      label: 'All Statuses' },
    { val: 'active',   label: 'Active' },
    { val: 'redeemed', label: 'Redeemed' },
    { val: 'expired',  label: 'Expired' },
    { val: 'pending',  label: 'Pending' },
  ];
  const current = options.find(o => o.val === value) ?? options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition"
      >
        <span>{current.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-50 w-44 rounded-2xl border border-border bg-card shadow-2xl py-2 overflow-hidden">
            {options.map(o => (
              <button
                key={o.val}
                onClick={() => { onChange(o.val); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-muted/60',
                  o.val === value ? 'text-primary font-bold bg-primary/5' : 'text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Share Voucher Modal ────────────────────────────────────────────────────────

interface ShareVoucherModalProps {
  voucher: Voucher;
  channel?: 'sms' | 'whatsapp';
  onClose: () => void;
  onSend: (message: string, recipientName: string, channel: 'sms' | 'whatsapp') => void;
}

function ShareVoucherModal({ voucher, channel = 'whatsapp', onClose, onSend }: ShareVoucherModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const recipientName = voucher.recipient_data?.name || voucher.recipient_details?.name || 'Valued Guest';
  const recipientPhone = voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number || '';
  const senderName = voucher.sender_data?.name || voucher.sender_details?.name || 'USH Spa';
  const voucherCode = voucher.secret_code || voucher.voucher_number || voucher.id.slice(0, 8);
  const serviceName = voucher.service_data?.name || 'Spa Service';
  const branchName = voucher.branch_data?.name || '';
  const expiryDate = fmtDate(voucher.expire_date);

  const getShareUrl = useCallback(() => {
    if (voucher.public_token) {
      return `https://ushspa.co/gift/${voucher.public_token}`;
    }
    if (voucher.payment_url) {
      return voucher.payment_url;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://desk.ushspa.co';
    return `${origin}/appointments/gift-vouchers?code=${encodeURIComponent(voucher.secret_code || voucher.id)}`;
  }, [voucher.public_token, voucher.payment_url, voucher.secret_code, voucher.id]);

  const buildReminderText = useCallback(() => {
    const url = getShareUrl();
    const lines = [
      `Dear ${recipientName},`,
      '',
      `This is a friendly reminder from USH Spa regarding your Gift Voucher from ${senderName}.`,
      '',
      `• Voucher Code: ${voucherCode}`,
      `• Service: ${serviceName}`,
    ];

    if (branchName) {
      lines.push(`• Branch: ${branchName}`);
    }
    if (expiryDate && expiryDate !== '—') {
      lines.push(`• Valid Until: ${expiryDate}`);
    }
    if (voucher.gift_message && voucher.gift_message.trim()) {
      lines.push(`• Gift Note: "${voucher.gift_message.trim()}"`);
    }

    lines.push('');
    lines.push('You can view and redeem your gift voucher here:');
    lines.push(url);
    lines.push('');
    lines.push('We look forward to welcoming you at USH Spa!');

    return lines.join('\n');
  }, [recipientName, senderName, voucherCode, serviceName, branchName, expiryDate, voucher.gift_message, getShareUrl]);

  const [message, setMessage] = useState(buildReminderText);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      onSend(message, recipientName, channel);
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4.5 bg-muted/20">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'grid h-10 w-10 place-items-center rounded-2xl',
                channel === 'whatsapp'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
              )}
            >
              {channel === 'whatsapp' ? <MessageCircle className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground leading-tight">
                  Share Reminder via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    channel === 'whatsapp'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                  )}
                >
                  {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {channel === 'whatsapp'
                  ? 'Preview template and send reminder message via WhatsApp'
                  : 'Preview template and send reminder text message via SMS'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Recipient & Voucher Info Card */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <User className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground">{recipientName}</span>
                {recipientPhone && (
                  <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                    (<Phone className="h-2.5 w-2.5" />{recipientPhone})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary font-mono">
                  <KeyRound className="h-2.5 w-2.5" /> {voucherCode}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
              <span className="truncate">{serviceName}</span>
              {expiryDate && expiryDate !== '—' && (
                <span className="shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Valid until: {expiryDate}
                </span>
              )}
            </div>
          </div>

          {/* Textbox Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="reminder-message" className="text-xs font-bold text-foreground">
                Formatted Reminder Message
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMessage(buildReminderText())}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                  title="Reset to default formatted message"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] text-primary hover:text-primary/80 font-semibold transition flex items-center gap-1"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <textarea
              id="reminder-message"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-2xl border border-border/80 bg-background p-3.5 text-xs text-foreground font-mono leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition resize-y"
              placeholder="Enter reminder message..."
            />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Characters: {message.length}</span>
              <span>Recipient: {recipientPhone || 'No phone number'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/40 px-6 py-4 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50',
              channel === 'whatsapp'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            {sending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                {channel === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                Send via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GiftVouchersPage() {
  const token = useAppSelector((s) => s.auth.token);

  const [vouchers,        setVouchers]        = useState<Voucher[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [statusFilter,    setStatusFilter]    = useState<string>('all');
  const [showCreate,      setShowCreate]      = useState(false);

  const [searchQuery,     setSearchQuery]     = useState<string>('');
  const [shareVoucher,     setShareVoucher]     = useState<Voucher | null>(null);
  const [shareChannel,     setShareChannel]     = useState<'sms' | 'whatsapp'>('whatsapp');
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleInitialBooking, setRescheduleInitialBooking] = useState<any>(null);
  const [successAlert,    setSuccessAlert]    = useState<{
    recipientName: string;
    voucherCode: string;
    channel?: 'sms' | 'whatsapp';
  } | null>(null);
  const [copyAlert,       setCopyAlert]       = useState<{
    voucherCode: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!successAlert) return;
    const timer = setTimeout(() => {
      setSuccessAlert(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [successAlert]);

  useEffect(() => {
    if (!copyAlert) return;
    const timer = setTimeout(() => {
      setCopyAlert(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [copyAlert]);

  const handleCopyPublicUrl = useCallback((voucher: Voucher) => {
    const code = voucher.secret_code || voucher.voucher_number || voucher.id.slice(0, 8);
    const url = getVoucherPublicUrl(voucher);
    navigator.clipboard?.writeText(url);
    setCopyAlert({ voucherCode: code, url });
  }, []);

  const handleSendReminder = useCallback((_msg: string, recipientName: string, channel: 'sms' | 'whatsapp') => {
    const code = shareVoucher?.secret_code || shareVoucher?.voucher_number || shareVoucher?.id.slice(0, 8) || 'Voucher';
    setShareVoucher(null);
    setSuccessAlert({
      recipientName,
      voucherCode: code,
      channel,
    });
  }, [shareVoucher]);

  const handleOpenReschedule = useCallback((voucher: Voucher, bookingId?: string, bookingData?: any) => {
    const bId = bookingId || voucher.redeemed_booking_id || voucher.booking_id || voucher.booking_data?.id;
    if (bId) {
      setSelectedVoucher(null);
      setRescheduleBookingId(bId);
      setRescheduleInitialBooking(bookingData || voucher.booking_data || null);
    } else {
      setSelectedVoucher(voucher);
    }
  }, []);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/booknpay/api/v1/vouchers/', {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).detail ?? `Error ${res.status}`);
      }
      const data = await res.json();
      // Handle both array and paginated { results: [] } responses
      const list: Voucher[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
      setVouchers(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // ── Derived / filtered ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return vouchers.filter((v) => {
      // 1. Status filter
      if (statusFilter !== 'all' && v.status?.toLowerCase() !== statusFilter) {
        return false;
      }

      // 2. Search box filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const qDigits = q.replace(/\D/g, '');
        const qCode = q.replace(/[\s\-_]/g, '');

        // Voucher code (secret_code) matching
        const secretCode = (v.secret_code ?? '').toLowerCase();
        const secretCodeClean = secretCode.replace(/[\s\-_]/g, '');
        const matchesSecretCode = secretCode.includes(q) || (qCode.length > 0 && secretCodeClean.includes(qCode));

        const vNum = (v.voucher_number ?? '').toLowerCase();
        const vNumClean = vNum.replace(/[\s\-_]/g, '');
        const matchesVNum = vNum.includes(q) || (qCode.length > 0 && vNumClean.includes(qCode));

        // Recipient number matching
        const recipientPhones = [
          v.recipient_phone,
          v.recipient_data?.phone_number,
          v.recipient_details?.phone_number,
          (v as any).recipient_number,
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
          v.sender_data?.phone_number,
          v.sender_details?.phone_number,
          (v as any).sender_phone,
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

        const vId = (v.id ?? '').toLowerCase();
        const recName = (v.recipient_data?.name ?? v.recipient_details?.name ?? '').toLowerCase();
        const recEmail = (v.recipient_data?.email ?? v.recipient_details?.email ?? '').toLowerCase();
        const sndName = (v.sender_data?.name ?? v.sender_details?.name ?? '').toLowerCase();
        const srvName = (v.service_data?.name ?? '').toLowerCase();
        const brName = (v.branch_data?.name ?? '').toLowerCase();

        const match =
          matchesSecretCode ||
          matchesRecipientPhone ||
          matchesVNum ||
          matchesSenderPhone ||
          vId.includes(q) ||
          recName.includes(q) ||
          recEmail.includes(q) ||
          sndName.includes(q) ||
          srvName.includes(q) ||
          brName.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [vouchers, statusFilter, searchQuery]);

  const stats = {
    total:    vouchers.length,
    active:   vouchers.filter(v => v.status === 'active').length,
    redeemed: vouchers.filter(v => v.status === 'redeemed').length,
    expired:  vouchers.filter(v => v.status === 'expired').length,
    revenue:  vouchers.reduce((sum, v) => sum + (parseFloat(v.total_amount) || 0), 0),
    currency: vouchers[0]?.currency ?? 'KWD',
  };

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gift Vouchers</h1>
            <p className="text-sm text-muted-foreground">Manage and track all issued gift vouchers</p>
          </div>
        </div>
      </div>

      {/* ── Success Alert Banner ── */}
      {successAlert && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4.5 py-3.5 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">
              Reminder message for voucher <strong className="font-mono font-bold text-emerald-950 dark:text-emerald-100">{successAlert.voucherCode}</strong> has been sent successfully{successAlert.channel ? ` via ${successAlert.channel === 'sms' ? 'SMS' : 'WhatsApp'}` : ''} to <strong className="font-bold text-emerald-950 dark:text-emerald-100">{successAlert.recipientName}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessAlert(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition"
            aria-label="Dismiss alert banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Vouchers', value: stats.total,                          sub: 'all time',        grad: 'from-primary to-accent', bg: 'bg-primary/5 dark:bg-primary/10', border: 'border-primary/20' },
          { label: 'Active',         value: stats.active,                         sub: 'ready to redeem', grad: 'from-emerald-500 to-teal-500',   bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200/80 dark:border-emerald-800/40' },
          { label: 'Redeemed',       value: stats.redeemed,                       sub: 'used vouchers',   grad: 'from-blue-500 to-sky-500',       bg: 'bg-blue-50 dark:bg-blue-950/30',  border: 'border-blue-200/80 dark:border-blue-800/40' },
          { label: 'Total Revenue',  value: `${stats.revenue.toFixed(3)} ${stats.currency}`, sub: 'voucher sales', grad: 'from-amber-500 to-orange-500', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200/80 dark:border-amber-800/40' },
        ].map(k => (
          <div key={k.label} className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5', k.bg, k.border)}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-xl font-extrabold tracking-tight">{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10', k.grad)} />
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher code, recipient number, sender…"
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-card text-sm font-medium outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <button
            onClick={fetchVouchers}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] shrink-0"
        >
          <Gift className="h-4 w-4" />
          New Voucher
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading vouchers…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <button
            onClick={fetchVouchers}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card py-20 text-center">
          <Gift className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-semibold text-muted-foreground">
            {vouchers.length === 0
              ? 'No vouchers found'
              : searchQuery.trim()
              ? `No vouchers match "${searchQuery}"`
              : 'No vouchers match the selected filter'}
          </p>
          {searchQuery.trim() && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs font-bold text-primary hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[300px] pb-32">
            <table className="w-full min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {[
                    'Voucher Code', 'Sender → Recipient', 'Service',
                    'Price & Duration', 'Expires', 'Status', 'Action',
                  ].map(col => (
                    <th
                      key={col}
                      className={cn(
                        'whitespace-nowrap py-3 pl-4 pr-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground first:rounded-tl-2xl last:rounded-tr-2xl',
                        col === 'Action' ? 'text-right' : 'text-left',
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map(v => {
                  const cfg = statusCfg(v.status);
                  const expired = v.expire_date && new Date(v.expire_date) < new Date();
                  const senderName = v.sender_data?.name || v.sender_details?.name;
                  const recipientName = v.recipient_data?.name || v.recipient_details?.name;
                  const recipientPhone = v.recipient_phone || v.recipient_data?.phone_number || v.recipient_details?.phone_number;

                  return (
                    <tr
                      key={v.id}
                      className="transition hover:bg-muted/20"
                    >
                      {/* Voucher Code */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(v)}
                          className="font-bold text-foreground font-mono text-[12px] hover:text-primary hover:underline text-left block cursor-pointer transition-colors"
                          title="View voucher details"
                        >
                          {v.secret_code || '—'}
                        </button>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(v.created_at)}</p>
                      </td>

                      {/* Sender → Recipient */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary font-bold text-[10px] shrink-0">
                            {initials(senderName)}
                          </div>
                          <p className="font-semibold text-foreground text-xs truncate max-w-[120px]">{senderName || '—'}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-muted-foreground ml-0.5" />
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/10 text-violet-600 font-bold text-[10px] shrink-0">
                            {initials(recipientName)}
                          </div>
                          <p className="font-semibold text-foreground text-xs truncate max-w-[120px]">{recipientName || '—'}</p>
                        </div>
                        {recipientPhone && (
                          <p className="text-[11px] text-muted-foreground ml-7">{recipientPhone}</p>
                        )}
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3 align-top min-w-[150px]">
                        <p className="font-semibold text-[13px] line-clamp-2 leading-snug">{v.service_data?.name ?? '—'}</p>
                        {v.service_data?.service_types?.[0]?.name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{v.service_data.service_types[0].name}</p>
                        )}
                      </td>

                      {/* Price & Duration */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <p className="text-[13px] font-extrabold text-primary tabular-nums leading-snug">
                          {fmtMoney(v.total_amount, v.currency)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-muted-foreground">
                          <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{v.total_duration} min</span>
                        </div>
                      </td>

                      {/* Expires */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <p className={cn('text-[12px] font-medium tabular-nums whitespace-nowrap', expired && v.status !== 'redeemed' ? 'text-rose-600 dark:text-rose-400' : '')}>
                          {fmtDate(v.expire_date)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap', cfg.pill)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 pl-4 pr-5 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVoucher(v)}
                            className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition shadow-sm"
                            title="View voucher details"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            View
                          </button>
                          {v.status?.toLowerCase() === 'redeemed' || v.redeemed_at ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReschedule(v)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition shadow-sm"
                              title="Reschedule redeemed booking"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Reschedule
                            </button>
                          ) : (
                            <VoucherShareDropdown
                              voucher={v}
                              label="Share"
                              onSelectChannel={(voucher, channel) => {
                                setShareChannel(channel);
                                setShareVoucher(voucher);
                              }}
                              onCopyUrl={handleCopyPublicUrl}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Spacing to ensure action dropdowns have ample room above footer */}
            <div className="h-28 pointer-events-none" aria-hidden="true" />
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-5 py-3">
            <p className="text-[12px] text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> of{' '}
              <span className="font-bold text-foreground">{vouchers.length}</span> vouchers
            </p>
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                Total value:{' '}
                <span className="font-bold text-primary">
                  {filtered.reduce((s, v) => s + (parseFloat(v.total_amount) || 0), 0).toFixed(3)} {stats.currency}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedVoucher && (
        <VoucherDetailModal
          voucher={selectedVoucher}
          token={token}
          onClose={() => setSelectedVoucher(null)}
          onShare={(v, channel) => {
            setSelectedVoucher(null);
            setShareChannel(channel);
            setShareVoucher(v);
          }}
          onCopyUrl={handleCopyPublicUrl}
          onReschedule={handleOpenReschedule}
        />
      )}

      {/* ── Reschedule Booking Modal ── */}
      {rescheduleBookingId && (
        <RescheduleBookingModal
          bookingId={rescheduleBookingId}
          initialBooking={rescheduleInitialBooking}
          token={token || undefined}
          onClose={() => {
            setRescheduleBookingId(null);
            setRescheduleInitialBooking(null);
          }}
          onSuccess={() => {
            setRescheduleBookingId(null);
            setRescheduleInitialBooking(null);
            fetchVouchers();
          }}
        />
      )}

      {/* ── Share Reminder Modal ── */}
      {shareVoucher && (
        <ShareVoucherModal
          voucher={shareVoucher}
          channel={shareChannel}
          onClose={() => setShareVoucher(null)}
          onSend={handleSendReminder}
        />
      )}

      {/* ── Create Voucher Modal ── */}
      {showCreate && token && (
        <CreateVoucherModal
          token={token}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchVouchers(); }}
        />
      )}

      {/* ── Copy URL Floating Toast ── */}
      {copyAlert && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3.5 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md p-4 shadow-2xl max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Check className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">Public URL Copied to Clipboard</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
              {copyAlert.url}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCopyAlert(null)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition"
            aria-label="Dismiss copy alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Success Alert Floating Toast ── */}
      {successAlert && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-card/95 backdrop-blur-md p-4 shadow-2xl max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">
              Reminder Sent Successfully{successAlert.channel ? ` via ${successAlert.channel === 'sms' ? 'SMS' : 'WhatsApp'}` : ''}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Reminder message for voucher{' '}
              <span className="font-mono font-bold text-foreground">{successAlert.voucherCode}</span>{' '}
              has been sent to{' '}
              <span className="font-semibold text-foreground">{successAlert.recipientName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessAlert(null)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </DashboardShell>
  );
}
