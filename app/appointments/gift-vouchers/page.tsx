'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ, toZonedIsoFromLocal } from '@/lib/datetime';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Gift, Loader2, AlertCircle, RefreshCw, ExternalLink, Eye,
  X, CheckCircle2, Clock, XCircle, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
  User, Scissors, MapPin, Timer, Package, CreditCard,
  MessageSquare, Hash, Building2, Building, Smartphone, Truck, Phone, Mail, Calendar, CalendarDays,
  Sparkles, Star, Search, ArrowRight, Share2, Check, Copy, MessageCircle,
  KeyRound, Globe, Send, QrCode, FileText, ShieldCheck, Receipt,
  Trash2, Edit3, Pencil, SlidersHorizontal, Filter, History, UserCheck, FileSpreadsheet,
  Printer, Download, CheckSquare, Square,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { CreateVoucherModal } from '@/components/bookings/CreateVoucherModal';
import { RescheduleBookingModal } from '@/components/bookings/RescheduleBookingModal';
import { RedeemVoucherModal } from '@/components/bookings/RedeemVoucherModal';
import { MakePaymentModal } from '@/components/bookings/MakePaymentModal';
import { InvoiceDetailModal } from '@/components/bookings/InvoiceDetailModal';
import { paymentLinksApi, whatsappShareUrl, smsShareUrl, sendPaymentLinkSms, type PaymentLink } from '@/lib/paymentLinks';
import { usePermissions } from '@/hooks/use-permissions';
import { extractRoleCandidates } from '@/lib/permissions';
import {
  DateRangeFilter,
  DateFilterActiveBadge,
  type DateFilterType,
  type DateRange,
  matchesDateRange,
} from '@/components/dashboard/date-range-filter';

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

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
  appointment_time?: string;
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
    full_name?: string;
    therapist_name?: string;
    [key: string]: any;
  };
  secondary_therapist_id?: string;
  secondary_therapist_name?: string;
  secondary_therapist_data?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    therapist_name?: string;
    [key: string]: any;
  };
  therapist_ids?: string[];
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
  invoice_number?: string | null;
  invoice_id?: string | null;
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
  gift_from?: string | null;
  gift_to?: string | null;
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
  payment_number?: string | null;
  payment_data: PaymentData | null;
  payment_url: string | null;
  payment_provider?: string | null;
  payment_through?: string | null;
  created_at: string;
  updated_at: string;
  update_history?: Array<Record<string, any>>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function firstTruthy<T>(...vals: (T | null | undefined | '' | false | 0)[]): T | undefined {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== '' && (v as unknown) !== 'null' && (v as unknown) !== 'undefined') {
      return v as T;
    }
  }
  return undefined;
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const cleanStr = String(raw).includes(' ') && !String(raw).includes('T') ? String(raw).replace(' ', 'T') : String(raw);
  const parseStr = cleanStr.includes('T') ? cleanStr : cleanStr + 'T00:00:00';
  const d = new Date(parseStr);
  if (isNaN(d.getTime())) return String(raw);
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
  const timeMatch = String(iso).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${ampm}`;
  }
  const cleanIso = String(iso).includes(' ') && !String(iso).includes('T') ? String(iso).replace(' ', 'T') : String(iso);
  const d = new Date(cleanIso);
  if (isNaN(d.getTime())) return String(iso);
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

/**
 * Total voucher duration in minutes = service + add-ons + extra time.
 * Some sources (ushweb) send `duration` instead of `duration_minutes`, and the stored
 * `total_duration` may only contain the extra minutes, so take the larger value.
 */
function getVoucherTotalDuration(v: Voucher): number {
  const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
  const sd = (v.service_data ?? {}) as any;
  const base = num(sd.duration_minutes) || num(sd.duration);
  const addons = (v.addons ?? []).reduce((s: number, a: any) => s + (num(a.duration_minutes) || num(a.duration)), 0);
  const computed = base + addons + num(v.extra_time);
  return Math.max(computed, num(v.total_duration));
}

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
  const norm = s?.toLowerCase() ?? '';
  if (norm === 'payment_pending' || norm === 'created' || norm.includes('pending')) {
    return STATUS_CFG['pending'];
  }
  return STATUS_CFG[norm] ?? STATUS_CFG['pending'];
}

function getVoucherPublicUrl(voucher: Voucher): string {
  const ushwebEnv = (
    process.env.NEXT_PUBLIC_USHWEB ||
    process.env.USHWEB ||
    'http://127.0.0.1:3001'
  ).trim();
  const ushwebBase = ushwebEnv.endsWith('/') ? ushwebEnv.slice(0, -1) : ushwebEnv;
  const token = voucher.public_token || (voucher as any)?.token;
  if (token) {
    return `${ushwebBase}/gift/${token}`;
  }
  if (voucher.payment_url) {
    return voucher.payment_url;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://desk.ushspa.co';
  return `${origin}/appointments/gift-vouchers?code=${encodeURIComponent(voucher.secret_code || voucher.id)}`;
}

/**
 * Format message for SMS, WhatsApp and Copy:
 *
 * USHSPA:
 *
 * Hi {recipient_name}, you received a gift from {sender_name} !
 * Message say:
 * {gift_mesasge}
 *  🙏🏻
 *
 * View the link below to receive your gift
 *
 * {gift_voucher_url}
 */
export function buildVoucherShareMessage(voucher: Voucher): string {
  // recipient_name: comes from To
  const recipientName =
    voucher.recipient_data?.name ||
    voucher.recipient_details?.name ||
    (voucher as any).gift_to ||
    (voucher as any).recipient_name ||
    '';

  // sender_name: comes from From field of the form or choosen customer name if From field is null
  const senderName =
    (voucher as any).gift_from ||
    voucher.sender_data?.name ||
    voucher.sender_details?.name ||
    (voucher as any).sender_name ||
    'USH Spa';

  // gift_mesasge: comes from Gift Message box of the form data
  const giftMessage = (voucher.gift_message ?? (voucher as any).message ?? '').trim();

  // gift_voucher_url: is the generated url
  const giftVoucherUrl = getVoucherPublicUrl(voucher);

  const lines = [
    'USHSPA:',
    '',
    `Hi ${recipientName || 'Valued Guest'}, you received a gift from ${senderName} !`,
    'Message say:',
  ];

  if (giftMessage) {
    lines.push(giftMessage);
  }
  lines.push(' 🙏🏻');
  lines.push('');
  lines.push('View the link below to receive your gift');
  lines.push('');
  lines.push(giftVoucherUrl);

  return lines.join('\n');
}

// ── Voucher Share Dropdown ─────────────────────────────────────────────────────

interface VoucherShareDropdownProps {
  voucher: Voucher;
  label?: string;
  className?: string;
  dropUp?: boolean;
  align?: 'left' | 'right';
  iconOnly?: boolean;
  onSelectChannel: (voucher: Voucher, channel: 'sms' | 'whatsapp') => void;
  onCopyUrl?: (voucher: Voucher) => void;
}

function VoucherShareDropdown({
  voucher,
  label = 'Share',
  className,
  dropUp = false,
  align,
  iconOnly = false,
  onSelectChannel,
  onCopyUrl,
}: VoucherShareDropdownProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveAlign = align ?? (iconOnly ? 'left' : 'right');

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = buildVoucherShareMessage(voucher);
    try {
      await navigator.clipboard.writeText(text);
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={cn(
          iconOnly
            ? 'grid h-6 w-6 place-items-center rounded-lg border border-border/80 bg-background/90 text-muted-foreground hover:bg-muted hover:border-primary/50 hover:text-primary transition shadow-xs cursor-pointer'
            : 'inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 hover:text-primary transition shadow-sm cursor-pointer',
          className
        )}
        title={iconOnly ? 'Share voucher' : label}
      >
        <Share2 className={iconOnly ? 'h-3 w-3' : 'h-3.5 w-3.5 text-muted-foreground'} />
        {!iconOnly && <span>{label}</span>}
        {!iconOnly && (
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className={cn(
              'absolute z-50 w-52 rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-150',
              effectiveAlign === 'left' ? 'left-0' : 'right-0',
              dropUp
                ? effectiveAlign === 'left' ? 'bottom-full mb-1.5 origin-bottom-left' : 'bottom-full mb-1.5 origin-bottom-right'
                : effectiveAlign === 'left' ? 'top-full mt-1.5 origin-top-left' : 'top-full mt-1.5 origin-top-right'
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
                  {copied ? 'Copied Message!' : 'Copy Message'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Copy formatted gift message</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Edit Voucher Modal ─────────────────────────────────────────────────────────

function EditVoucherModal({
  voucher,
  onClose,
  onSuccess,
}: {
  voucher: Voucher;
  onClose: () => void;
  onSuccess: (updated: Voucher) => void;
}) {
  const [senderName, setSenderName] = useState(voucher.sender_data?.name || voucher.sender_details?.name || '');
  const [senderPhone, setSenderPhone] = useState(voucher.sender_data?.phone_number || voucher.sender_details?.phone_number || '');
  const [giftFrom, setGiftFrom] = useState(voucher.gift_from || voucher.sender_data?.name || '');
  const [recipientName, setRecipientName] = useState(voucher.recipient_data?.name || voucher.recipient_details?.name || '');
  const [recipientPhone, setRecipientPhone] = useState(voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number || '');
  const [giftMessage, setGiftMessage] = useState(voucher.gift_message || '');
  const [updateNote, setUpdateNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        sender_data: {
          ...(voucher.sender_data || {}),
          name: senderName.trim(),
          phone_number: senderPhone.trim(),
        },
        recipient_phone: recipientPhone.trim(),
        recipient_data: {
          ...(voucher.recipient_data || {}),
          name: recipientName.trim(),
          phone_number: recipientPhone.trim(),
        },
        gift_message: giftMessage.trim(),
        gift_from: giftFrom.trim() || senderName.trim(),
        update_note: updateNote.trim() || undefined,
      };

      const res = await authedFetch(`/booknpay/api/v1/vouchers/${voucher.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || `Failed to update voucher (Error ${res.status})`);
      }

      const resJson = await res.json();
      const updatedVoucher: Voucher = (resJson?.data && typeof resJson.data === 'object') ? resJson.data : resJson;
      onSuccess(updatedVoucher);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update voucher details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Edit3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">Edit Voucher Details</h3>
              <p className="text-[11px] text-muted-foreground">Update sender, recipient, and message</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* From / Sender */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <p className="font-bold uppercase tracking-wider text-[10px] text-primary flex items-center gap-1.5">
              <User className="h-3 w-3" /> From (Sender Details)
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Sender Name</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Sarah Smith"
                  required
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Sender Phone</label>
                  <input
                    type="text"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="e.g. +965 99123456"
                    className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Gift From (Signature)</label>
                  <input
                    type="text"
                    value={giftFrom}
                    onChange={(e) => setGiftFrom(e.target.value)}
                    placeholder="e.g. With love, Sarah"
                    className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* To / Recipient */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <p className="font-bold uppercase tracking-wider text-[10px] text-primary flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" /> To (Recipient Details)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Fatima Al-Ali"
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Recipient Phone</label>
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. +965 98765432"
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Gift Message */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
            <p className="font-bold uppercase tracking-wider text-[10px] text-primary flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Gift Message
            </p>
            <textarea
              rows={3}
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="Personal message for the recipient..."
              className="w-full rounded-xl border border-border bg-card p-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Update Reason / Note (Optional)</label>
            <input
              type="text"
              value={updateNote}
              onChange={(e) => setUpdateNote(e.target.value)}
              placeholder="e.g. Customer requested phone number correction"
              className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-10 rounded-xl border border-border bg-muted/40 text-xs font-semibold hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-10 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Voucher Detail Modal ───────────────────────────────────────────────────────

function VoucherDetailModal({
  voucher: initialVoucher,
  token,
  employeeMap,
  onClose,
  onShare,
  onCopyUrl,
  onReschedule,
  onRedeem,
  onRefresh,
}: {
  voucher: Voucher;
  token?: string | null;
  employeeMap?: Record<string, string>;
  onClose: () => void;
  onShare?: (voucher: Voucher, channel: 'sms' | 'whatsapp') => void;
  onCopyUrl?: (voucher: Voucher) => void;
  onReschedule?: (voucher: Voucher, bookingId?: string, bookingData?: any) => void;
  onRedeem?: (voucher: Voucher, initialAvailabilitiesPromise?: Promise<any>) => void;
  onRefresh?: () => void;
}) {
  const [voucher, setVoucher] = useState<Voucher>(initialVoucher);
  useEffect(() => {
    setVoucher(initialVoucher);
  }, [initialVoucher]);

  const { canEditGiftVoucher } = usePermissions();
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [copiedPaymentUrl, setCopiedPaymentUrl] = useState(false);

  // Payment links, payments & invoice state
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [voucherPayments, setVoucherPayments] = useState<Record<string, any>[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [syncingLink, setSyncingLink] = useState(false);
  const [renewingLink, setRenewingLink] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState<Record<string, any> | null>(null);

  const catCfg = getCategoryConfig(voucher.gift_category, voucher);
  const CatIcon = catCfg.icon;
  const isPhysical = (voucher.gift_category || '').toLowerCase() === 'physical';
  const isDigital = (voucher.gift_category || '').toLowerCase() === 'digital' || Boolean(voucher.digital_product_data);
  const delCfg = DELIVERY_STATUS_CONFIG[voucher.delivery_status || 'ordered'] ?? DELIVERY_STATUS_CONFIG.ordered;
  const ordStatusCfg = getOrderStatusConfig(voucher.status);

  const isExpired = voucher.expire_date && new Date(voucher.expire_date) < new Date();
  const canRedeem = !isExpired && voucher.status?.toLowerCase() === 'active';
  const isRedeemed = voucher.status?.toLowerCase() === 'redeemed' || !!voucher.redeemed_at;
  const bookingId =
    voucher.redeemed_booking_id ||
    voucher.booking_id ||
    voucher.booking_data?.id ||
    (voucher.booking_data as any)?.booking_id ||
    (voucher as any)?.redeemed_booking?.id ||
    (voucher as any)?.booking?.id ||
    null;

  const [fetchedBooking, setFetchedBooking] = useState<BookingData | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [resolvedPrimaryTherapist, setResolvedPrimaryTherapist] = useState<Record<string, any> | null>(null);
  const [resolvedSecondaryTherapist, setResolvedSecondaryTherapist] = useState<Record<string, any> | null>(null);

  const handleRedeemClick = () => {
    const serviceId = voucher.service_id || (voucher.service_data as any)?.id;
    const branchId = voucher.branch_id || voucher.branch_data?.branch_id;
    const arrangementId = voucher.service_arrangement_id || (voucher.service_arrangement_data as any)?.id;
    const expireDateWithTz = toZonedIsoFromLocal(voucher.expire_date);

    const promise = authedFetch('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        service_id: serviceId,
        branch_id: branchId,
        service_arrangement_id: arrangementId || null,
        expire_date: expireDateWithTz,
      }),
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `HTTP ${r.status}`);
      }
      return r.json().catch(() => ({}));
    });

    onRedeem?.(
      {
        ...voucher,
        invoice_number: invoiceNumber || voucher.invoice_number,
        payment_number: paymentNumber || voucher.payment_number,
      },
      promise
    );
  };

  useEffect(() => {
    if (!isRedeemed || !bookingId) return;
    const hasFullAppt = Boolean(
      voucher.booking_data &&
      (voucher.booking_data.appointment_date || voucher.booking_data.appointment_start) &&
      (voucher.booking_data.appointment_time || voucher.booking_data.appointment_end || voucher.booking_data.appointment_start)
    );
    if (hasFullAppt && fetchedBooking) {
      return;
    }
    let active = true;
    setLoadingBooking(true);
    authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          const actualBooking = (data?.success && data?.data) ? data.data : (data?.data ?? data);
          setFetchedBooking(actualBooking);
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
  }, [isRedeemed, bookingId, voucher.booking_data]);

  // Load payment links for voucher
  const fetchLinks = useCallback(() => {
    if (!voucher?.id) return;
    setLoadingLinks(true);
    paymentLinksApi.list('gift_voucher', voucher.id)
      .then((res) => {
        if (Array.isArray(res)) {
          setPaymentLinks(res);
        }
      })
      .catch((err) => {
        console.warn('Failed to load payment links for voucher:', err);
      })
      .finally(() => {
        setLoadingLinks(false);
      });
  }, [voucher?.id]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Load payment records for voucher
  const fetchPayments = useCallback(() => {
    if (!voucher?.id) return;
    setLoadingPayments(true);
    authedFetch(`/booknpay/api/v1/payments?voucher_id=${voucher.id}`)
      .then((r) => r.json())
      .then((res) => {
        const items =
          res?.data?.items ??
          res?.items ??
          (Array.isArray(res?.data) ? res.data : []);
        if (Array.isArray(items)) {
          setVoucherPayments(items);
        }
      })
      .catch((err) => {
        console.warn('Failed to load payments for voucher:', err);
      })
      .finally(() => {
        setLoadingPayments(false);
      });
  }, [voucher?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const latestPayment = voucherPayments[0] || null;
  const activePaymentLink = paymentLinks[0] || null;

  // Resolve invoice number & fetch invoice record
  const rawInvoiceNumber =
    latestPayment?.invoice_number ||
    voucher.invoice_number ||
    voucher.invoice_id ||
    (voucher.payment_data as any)?.invoice_number ||
    (voucher.payment_data as any)?.invoiceId ||
    (voucher.payment_data as any)?.data?.InvoiceId ||
    activePaymentLink?.invoice_number ||
    activePaymentLink?.invoice_id ||
    null;
  const invoiceNumber = rawInvoiceNumber ? String(rawInvoiceNumber) : null;

  // Resolve payment number (e.g. PMT/2026/10/000001)
  const rawPaymentNumber =
    latestPayment?.payment_number ||
    voucher.payment_number ||
    (voucher.payment_data as any)?.payment_number ||
    (voucher.payment_data as any)?.data?.InvoiceTransactions?.[0]?.PaymentId ||
    activePaymentLink?.payment_number ||
    null;
  const paymentNumber = rawPaymentNumber ? String(rawPaymentNumber) : null;

  // Resolve transaction ID & auth/trace code
  const transactionId =
    latestPayment?.transaction_id ||
    latestPayment?.track_id ||
    voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TrackId ||
    (voucher.payment_data?.data?.InvoiceTransactions?.[0] as any)?.TransactionId ||
    (voucher.payment_data as any)?.transaction_id ||
    (voucher.payment_data as any)?.track_id ||
    (voucher as any)?.payment_id ||
    null;

  const authCode =
    latestPayment?.reference_id ||
    voucher.payment_data?.data?.InvoiceTransactions?.[0]?.AuthorizationId ||
    (voucher.payment_data as any)?.reference_id ||
    activePaymentLink?.gateway_invoice_id ||
    null;

  useEffect(() => {
    if (!invoiceNumber || invoiceNumber === '—') {
      setInvoiceRecord(null);
      return;
    }
    let cancelled = false;
    authedFetch(`/uanr/api/v1/invoices?search=${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        const found = items.find((i: Record<string, any>) =>
          i.name === invoiceNumber || i.id === invoiceNumber || i.reference === invoiceNumber
        ) || items[0];
        if (found) setInvoiceRecord(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invoiceNumber]);

  const effectivePaymentUrl =
    activePaymentLink?.payment_url ||
    latestPayment?.payment_url ||
    voucher.payment_url ||
    voucher.payment_data?.paymentUrl ||
    (voucher as any)?.payment_link_url ||
    null;

  const isPaid = Boolean(
    latestPayment?.status === 'success' ||
    voucher.status === 'active' ||
    voucher.status === 'redeemed' ||
    voucher.payment_data?.isPaid ||
    (voucher.payment_data as any)?.status === 'success' ||
    (activePaymentLink && (activePaymentLink.status === 'paid' || activePaymentLink.status === 'success')) ||
    (voucher.payment_data?.data?.InvoiceStatus?.toLowerCase() === 'paid')
  );

  const isPaymentPending = Boolean(
    !isPaid &&
    (voucher.status === 'payment_pending' ||
      activePaymentLink?.status === 'pending' ||
      activePaymentLink?.status === 'active' ||
      (voucher.payment_data?.data?.InvoiceStatus?.toLowerCase() === 'pending'))
  );

  const isPaymentLinkExpired = Boolean(
    !isPaid &&
    activePaymentLink &&
    (activePaymentLink.is_expired ||
      activePaymentLink.status === 'expired' ||
      (activePaymentLink.expires_at && new Date(activePaymentLink.expires_at).getTime() <= Date.now()))
  );

  const isPending = Boolean(
    voucher.status?.toLowerCase() === 'pending' ||
    voucher.status?.toLowerCase() === 'payment_pending' ||
    voucher.status?.toLowerCase() === 'created' ||
    voucher.status?.toLowerCase().includes('pending') ||
    isPaymentPending
  );

  const handleCopyPaymentUrl = async () => {
    if (!effectivePaymentUrl) return;
    try {
      await navigator.clipboard.writeText(effectivePaymentUrl);
      setCopiedPaymentUrl(true);
      setTimeout(() => setCopiedPaymentUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRenewPaymentLink = async (linkId: string) => {
    try {
      setRenewingLink(true);
      setRenewError(null);
      const renewed = await paymentLinksApi.renew(linkId);
      setPaymentLinks((prev) => [renewed, ...prev.filter((l) => l.id !== linkId)]);
      onRefresh?.();
    } catch (err) {
      setRenewError(err instanceof Error ? err.message : 'Failed to create a new payment link.');
    } finally {
      setRenewingLink(false);
    }
  };

  const handleSyncPaymentLink = async (linkId: string) => {
    try {
      setSyncingLink(true);
      const updated = await paymentLinksApi.sync(linkId);
      setPaymentLinks((prev) => prev.map((l) => (l.id === linkId ? updated : l)));
      onRefresh?.();
    } catch (err) {
      console.error('Failed to sync payment link:', err);
    } finally {
      setSyncingLink(false);
    }
  };

  const senderName = voucher.sender_data?.name || voucher.sender_details?.name || 'Customer';
  const senderPhone = voucher.sender_data?.phone_number || voucher.sender_details?.phone_number;
  const recipientPhone = voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number;
  const targetSharePhone = senderPhone || recipientPhone || '';
  const paymentShareMessage = effectivePaymentUrl
    ? `Hello ${senderName}, please complete your USH Spa Gift Voucher payment of ${voucher.total_amount} ${voucher.currency} using this secure link: ${effectivePaymentUrl}`
    : '';

  const [sendingSms, setSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendPaymentLinkSms = async () => {
    if (!effectivePaymentUrl) {
      setSmsFeedback({ type: 'error', message: 'Payment link is not available yet.' });
      return;
    }
    const phone = (senderPhone || targetSharePhone)?.trim();
    if (!phone) {
      setSmsFeedback({ type: 'error', message: 'Sender phone number is required to send payment SMS.' });
      return;
    }

    setSendingSms(true);
    setSmsFeedback(null);
    try {
      const smsBody = `USHSPA: مرحباً${senderName ? ` ${senderName}` : ''}، يرجى استكمال دفع قسيمة الهدايا بمبلغ ${voucher.total_amount} ${voucher.currency} عبر هذا الرابط: ${effectivePaymentUrl}`;

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

  const vb = (voucher.booking_data && typeof voucher.booking_data === 'object') ? (voucher.booking_data as Record<string, any>) : {};
  const fb = (fetchedBooking && typeof fetchedBooking === 'object') ? (fetchedBooking as Record<string, any>) : {};
  const booking: Record<string, any> = {
    ...vb,
    ...fb,
    appointment_date: firstTruthy(fb.appointment_date, vb.appointment_date, fb.date, vb.date, fb.booking_date, vb.booking_date),
    appointment_start: firstTruthy(fb.appointment_start, vb.appointment_start, fb.appointment_datetime, vb.appointment_datetime),
    appointment_end: firstTruthy(fb.appointment_end, vb.appointment_end),
    appointment_time: firstTruthy(fb.appointment_time, vb.appointment_time, fb.time, vb.time, fb.time_slot, vb.time_slot),
    booking_number: firstTruthy(fb.booking_number, vb.booking_number, fb.booking_no, vb.booking_no),
    therapist_id: firstTruthy(
      fb.therapist_id,
      vb.therapist_id,
      fb.therapist_data?.id,
      fb.therapist_data?.therapist_id,
      vb.therapist_data?.id,
      vb.therapist_data?.therapist_id,
      Array.isArray(fb.therapist_ids) && fb.therapist_ids.length > 0 ? fb.therapist_ids[0] : null,
      Array.isArray(vb.therapist_ids) && vb.therapist_ids.length > 0 ? vb.therapist_ids[0] : null,
    ),
    therapist_name: firstTruthy(
      fb.therapist_name,
      vb.therapist_name,
      fb.therapist_data?.name,
      vb.therapist_data?.name,
      fb.therapist_data?.therapist_name,
      vb.therapist_data?.therapist_name,
      fb.therapist_data?.full_name,
      vb.therapist_data?.full_name,
    ),
    therapist_data: fb.therapist_data || vb.therapist_data || fb.therapist || vb.therapist,
    secondary_therapist_id: firstTruthy(
      fb.secondary_therapist_id,
      vb.secondary_therapist_id,
      fb.secondary_therapist_data?.id,
      fb.secondary_therapist_data?.therapist_id,
      vb.secondary_therapist_data?.id,
      vb.secondary_therapist_data?.therapist_id,
      Array.isArray(fb.therapist_ids) && fb.therapist_ids.length > 1 ? fb.therapist_ids[1] : null,
      Array.isArray(vb.therapist_ids) && vb.therapist_ids.length > 1 ? vb.therapist_ids[1] : null,
    ),
    secondary_therapist_name: firstTruthy(
      fb.secondary_therapist_name,
      vb.secondary_therapist_name,
      fb.secondary_therapist_data?.name,
      vb.secondary_therapist_data?.name,
      fb.secondary_therapist_data?.therapist_name,
      vb.secondary_therapist_data?.therapist_name,
      fb.secondary_therapist_data?.full_name,
      vb.secondary_therapist_data?.full_name,
    ),
    secondary_therapist_data: fb.secondary_therapist_data || vb.secondary_therapist_data || fb.secondary_therapist || vb.secondary_therapist,
    therapist_ids: Array.isArray(fb.therapist_ids) && fb.therapist_ids.length > 0
      ? fb.therapist_ids
      : Array.isArray(vb.therapist_ids)
      ? vb.therapist_ids
      : undefined,
    branch_name: firstTruthy(fb.branch_name, vb.branch_name, fb.branch_data?.name, vb.branch_data?.name, voucher.branch_data?.name),
    branch_data: fb.branch_data || vb.branch_data || voucher.branch_data,
    arrangement_name: firstTruthy(
      fb.service_arrangement_data?.arrangement_name,
      vb.service_arrangement_data?.arrangement_name,
      fb.arrangement_name,
      vb.arrangement_name,
      voucher.service_arrangement_data?.arrangement_name
    ),
    service_arrangement_data: fb.service_arrangement_data || vb.service_arrangement_data || voucher.service_arrangement_data,
  };

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

  const apptDateRaw = firstTruthy(
    booking?.appointment_date,
    booking?.appointment_start ? String(booking.appointment_start).split('T')[0] : null,
    booking?.appointment_datetime ? String(booking.appointment_datetime).split('T')[0] : null,
    booking?.date,
    booking?.booking_date
  );
  const apptDateFormatted = apptDateRaw ? fmtDate(apptDateRaw) : null;

  const apptStartRaw = firstTruthy(
    booking?.appointment_start,
    booking?.appointment_datetime,
    booking?.appointment_time,
    booking?.start_time,
    booking?.time
  );
  const apptEndRaw = firstTruthy(
    booking?.appointment_end,
    booking?.end_time
  );

  const apptStartFormatted = apptStartRaw ? formatTime(apptStartRaw) : null;
  const apptEndFormatted = apptEndRaw ? formatTime(apptEndRaw) : null;

  const apptTimeWindow =
    apptStartFormatted && apptEndFormatted
      ? `${apptStartFormatted} – ${apptEndFormatted}`
      : apptStartFormatted || (apptDateRaw && String(apptDateRaw).includes('T') ? formatTime(apptDateRaw) : null);

  const formatTherapistDisplayName = (tData: any, fallbackName?: any): string | null => {
    const fullFromParts = tData?.first_name
      ? `${tData.first_name} ${tData.last_name || ''}`.trim()
      : tData?.user?.first_name
      ? `${tData.user.first_name} ${tData.user.last_name || ''}`.trim()
      : null;
    return (
      firstTruthy(
        tData?.name,
        tData?.therapist_name,
        tData?.full_name,
        fullFromParts,
        tData?.user?.full_name,
        tData?.user?.name,
        typeof fallbackName === 'string' ? fallbackName : null,
      ) || null
    );
  };

  const rawPrimaryTherapistName =
    formatTherapistDisplayName(booking?.therapist_data, booking?.therapist_name) ||
    formatTherapistDisplayName(booking?.therapist) ||
    formatTherapistDisplayName(Array.isArray(booking?.therapists) ? booking.therapists[0] : null);

  const rawSecondaryTherapistName =
    formatTherapistDisplayName(booking?.secondary_therapist_data, booking?.secondary_therapist_name) ||
    formatTherapistDisplayName(booking?.secondary_therapist) ||
    formatTherapistDisplayName(Array.isArray(booking?.therapists) && booking.therapists.length > 1 ? booking.therapists[1] : null);

  const primaryTherapistId = booking?.therapist_id || null;
  const secondaryTherapistId =
    booking?.secondary_therapist_id && booking.secondary_therapist_id !== primaryTherapistId
      ? booking.secondary_therapist_id
      : null;

  useEffect(() => {
    if (!isRedeemed) return;
    let cancelled = false;
    const fetchTherapist = async (tId: string, setter: (d: Record<string, any>) => void) => {
      try {
        const res = await authedFetch(`/uauth/api/v1/therapists/${tId}/`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json?.data ?? json;
        if (!cancelled && data && typeof data === 'object') {
          setter(data);
        }
      } catch {
        // ignore fallback lookup errors
      }
    };
    if (primaryTherapistId && !rawPrimaryTherapistName) {
      fetchTherapist(String(primaryTherapistId), setResolvedPrimaryTherapist);
    }
    if (secondaryTherapistId && !rawSecondaryTherapistName) {
      fetchTherapist(String(secondaryTherapistId), setResolvedSecondaryTherapist);
    }
    return () => {
      cancelled = true;
    };
  }, [isRedeemed, primaryTherapistId, secondaryTherapistId, rawPrimaryTherapistName, rawSecondaryTherapistName]);

  const therapistName =
    rawPrimaryTherapistName ||
    formatTherapistDisplayName(resolvedPrimaryTherapist);

  const rawResolvedSecondaryName =
    rawSecondaryTherapistName ||
    formatTherapistDisplayName(resolvedSecondaryTherapist);

  const secondaryTherapistName =
    rawResolvedSecondaryName && rawResolvedSecondaryName !== therapistName
      ? rawResolvedSecondaryName
      : null;

  const bookingBranch = booking?.branch_data?.name || booking?.branch_name || voucher.branch_data?.name;
  const bookingRoom =
    booking?.service_arrangement_data?.arrangement_name ||
    booking?.arrangement_name ||
    voucher.service_arrangement_data?.arrangement_name;

  const bookingNumber = booking?.booking_number || booking?.booking_no || (bookingId ? `BOK-${bookingId.slice(0, 8).toUpperCase()}` : null);

  const ushwebEnv = (
    process.env.NEXT_PUBLIC_USHWEB ||
    process.env.USHWEB ||
    'http://127.0.0.1:3001'
  ).trim();
  const ushwebBase = ushwebEnv.endsWith('/') ? ushwebEnv.slice(0, -1) : ushwebEnv;
  const publicToken = voucher.public_token || (voucher as any)?.token;
  const trackingUrl = publicToken
    ? `${ushwebBase}/gift/${publicToken}`
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
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl flex flex-col">
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

        {/* Tabs Bar */}
        <div className="shrink-0 flex items-center border-b border-border/40 bg-muted/20 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Gift className="h-3.5 w-3.5" />
            Voucher Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={cn(
              'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
              activeTab === 'payments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Payment &amp; Invoices
            {isPaid ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Paid
              </span>
            ) : isPaymentPending ? (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Pending
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <History className="h-3.5 w-3.5" />
            History &amp; Updates
            {Array.isArray(voucher.update_history) && voucher.update_history.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                {voucher.update_history.length}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {activeTab === 'details' ? (
            <>
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
                {isPaid && (
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
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 relative group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From (Sender)</p>
                    {!isRedeemed && canEditGiftVoucher && (
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition cursor-pointer p-0.5"
                        title="Edit sender and voucher details"
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="text-[10px]">Edit</span>
                      </button>
                    )}
                  </div>
                  <p className="font-bold text-sm text-foreground">{voucher.sender_data?.name || voucher.sender_details?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-primary" />
                    {voucher.sender_data?.phone_number || voucher.sender_details?.phone_number || '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 relative group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To (Recipient)</p>
                    {!isRedeemed && canEditGiftVoucher && (
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition cursor-pointer p-0.5"
                        title="Edit recipient and voucher details"
                      >
                        <Pencil className="h-3 w-3" />
                        <span className="text-[10px]">Edit</span>
                      </button>
                    )}
                  </div>
                  <p className="font-bold text-sm text-foreground">{voucher.recipient_data?.name || voucher.recipient_details?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-primary" />
                    {voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number || '—'}
                  </p>
                </div>
              </div>

              {/* Ordered Items & Services */}
              {(Boolean(voucher.ordered_items?.length) || Boolean(voucher.service_data?.name) || Boolean(voucher.service_id) || Boolean(voucher.addons?.length)) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Gift Items
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
                            {getVoucherTotalDuration(voucher) > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-primary" />{getVoucherTotalDuration(voucher)} min
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
              {voucher.gift_message ? (
                <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-rose-50/60 to-pink-50/40 dark:from-rose-950/20 dark:to-pink-950/10 px-4 py-3 relative group">
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gift Message</p>
                      {!isRedeemed && canEditGiftVoucher && (
                        <button
                          type="button"
                          onClick={() => setShowEditModal(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition cursor-pointer p-0.5"
                          title="Edit gift message"
                        >
                          <Pencil className="h-3 w-3" />
                          <span className="text-[10px]">Edit</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed italic">&ldquo;{voucher.gift_message}&rdquo;</p>
                  </div>
                </div>
              ) : !isRedeemed && canEditGiftVoucher ? (
                <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span>No gift message attached.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Add Message</span>
                  </button>
                </div>
              ) : null}

              {/* Delivery Status — only when the voucher actually contains products */}
              {Boolean(voucher.ordered_items?.length) && (
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
                      <div className="rounded-xl bg-background/80 dark:bg-background/40 border border-violet-200/30 dark:border-violet-800/30 p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Schedule</p>
                              <p className="text-xs font-extrabold text-foreground">
                                {apptDateFormatted || 'Scheduled Appointment'}
                              </p>
                            </div>
                          </div>
                          {apptTimeWindow && (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2.5 py-1 text-xs font-bold font-mono">
                                <Clock className="h-3 w-3" />
                                {apptTimeWindow}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px]">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Date & Time</span>
                            <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                              <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                              {apptDateFormatted || '—'}
                              {apptTimeWindow ? ` • ${apptTimeWindow}` : ''}
                            </span>
                          </div>
                          {(bookingBranch || bookingRoom) && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Location</span>
                              <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5 truncate">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {[bookingBranch, bookingRoom].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                          )}
                          {(therapistName || secondaryTherapistName) && (
                            <div className="col-span-1 sm:col-span-2 pt-1 border-t border-border/20">
                              {therapistName && secondaryTherapistName ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Primary Therapist</span>
                                    <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {therapistName}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Secondary Therapist</span>
                                    <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {secondaryTherapistName}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Therapist</span>
                                  <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {therapistName || secondaryTherapistName}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Voucher Code & Tracking QR Code in one row (two cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Card 1: Voucher Code */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Voucher Code</span>
                    </div>
                    {voucher.secret_code && (
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Copy Voucher Code"
                      >
                        {copiedCode ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  <div className="my-auto py-1">
                    <p className="font-mono font-extrabold text-base sm:text-lg text-primary tracking-wider break-all">
                      {voucher.secret_code || '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Redemption &amp; verification code
                    </p>
                  </div>
                </div>

                {/* Card 2: QR Code with Tracking URL copy icon */}
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tracking QR Code</span>
                    </div>
                    {trackingUrl && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleCopyUrl}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Copy Tracking URL"
                        >
                          {copiedUrl ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Open Tracking Page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                  </div>

                  {trackingUrl ? (
                    <div className="flex items-center gap-3 my-auto py-1">
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-border/50 shrink-0">
                        <QRCodeSVG
                          value={trackingUrl}
                          size={64}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold text-foreground">Scan or Copy Link</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Click the copy icon to share the tracking link or scan with camera.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="my-auto py-2 text-center text-xs text-muted-foreground">
                      No tracking token available
                    </div>
                  )}
                </div>
              </div>

              {/* Created, Expires & Created By */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                  <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Created By</p>
                    <p className="font-semibold text-foreground truncate" title={employeeMap?.[voucher.created_by] || voucher.created_by || 'Online'}>
                      {employeeMap?.[voucher.created_by] || voucher.created_by || 'Online / Customer'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'payments' ? (
            /* ── TAB 2: PAYMENT & INVOICES ── */
            <div className="space-y-4">
              {/* 1. Official Invoice Card */}
              <div className="rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 via-card to-card dark:from-violet-950/20 p-5 space-y-4 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/40">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Invoice Number */}
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Number</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setShowInvoiceModal(true)}
                            className="group/inv inline-flex items-center gap-1.5 text-sm font-mono font-extrabold text-foreground hover:text-violet-600 dark:hover:text-violet-400 transition cursor-pointer text-left"
                            title="Click to view full invoice details"
                          >
                            <span className="underline underline-offset-4 decoration-violet-400/60 group-hover/inv:decoration-violet-600">
                              {invoiceNumber || 'Pending Generation'}
                            </span>
                            <Eye className="h-3.5 w-3.5 text-violet-500 opacity-75 group-hover/inv:opacity-100 shrink-0" />
                          </button>
                          {Boolean(invoiceNumber) && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(invoiceNumber!);
                                setCopiedType('invoice');
                                setTimeout(() => setCopiedType(null), 2000);
                              }}
                              className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                              title="Copy invoice number"
                            >
                              {copiedType === 'invoice' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block h-8 w-px bg-border/60" />

                    {/* Payment Number */}
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Number</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-sm font-mono font-extrabold text-foreground">
                            {paymentNumber || (isPaid ? 'Settled' : 'Generated upon settlement')}
                          </span>
                          {Boolean(paymentNumber) && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(paymentNumber!);
                                setCopiedType('pmt');
                                setTimeout(() => setCopiedType(null), 2000);
                              }}
                              className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                              title="Copy payment number"
                            >
                              {copiedType === 'pmt' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowInvoiceModal(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20 transition cursor-pointer"
                      title="Open invoice details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Invoice</span>
                    </button>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                      isPaid
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                    )}>
                      {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {isPaid ? 'PAID' : 'DRAFT'}
                    </span>
                    {Boolean(invoiceNumber) && (
                      <Link
                        href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber!)}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline px-2 py-1 rounded-lg hover:bg-muted/40 transition"
                      >
                        <span>Accounting</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Invoice details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-border/40 text-xs">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Billed To</p>
                    <p className="font-bold truncate mt-0.5">{voucher.sender_data?.name || voucher.sender_details?.name || voucher.recipient_data?.name || 'Customer'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Issue Date</p>
                    <p className="font-medium mt-0.5">{formatDate(voucher.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Amount</p>
                    <p className="font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
                      {formatAmount(voucher.total_amount, voucher.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Balance Due</p>
                    <p className="font-bold mt-0.5 text-foreground">
                      {isPaid ? formatAmount(0, voucher.currency) : formatAmount(voucher.total_amount, voucher.currency)}
                    </p>
                  </div>
                </div>

                {/* Itemized breakdown in invoice */}
                <div className="pt-1 space-y-2 pb-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {voucher.service_data?.name || (isDigital ? (voucher.digital_product_data?.title || 'Digital Gift Item') : (isPhysical ? 'Gift Voucher / Physical Products' : 'Gift Voucher'))}
                    </span>
                    <span className="font-semibold">{formatAmount(voucher.service_data?.base_price || voucher.total_amount, voucher.currency)}</span>
                  </div>
                  {voucher.addons && voucher.addons.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>+ Add-on: {a.name}</span>
                      <span>+{formatAmount(a.price, a.currency || voucher.currency)}</span>
                    </div>
                  ))}
                  {Boolean(voucher.extra_time && Number(voucher.extra_time) > 0) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>+ Extra Minutes (+{voucher.extra_time}m)</span>
                      <span>+{formatAmount(voucher.price_for_extra_time || 0, voucher.currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Payment Transaction Record */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Payment Transaction Record
                    </h4>
                  </div>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                    isPaid
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  )}>
                    {isPaid ? 'PAID' : (voucher.status === 'payment_pending' ? 'PAYMENT PENDING' : 'UNPAID')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Provider / Gateway</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {latestPayment?.payment_provider || voucher.payment_provider || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentGateway || activePaymentLink?.gateway || activePaymentLink?.provider || 'MyFatoorah'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Payment Method</p>
                    <p className="font-semibold text-foreground mt-0.5 capitalize">
                      {latestPayment?.payment_method || (voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionStatus ? 'Card / Online' : (activePaymentLink ? 'Payment Link' : '—'))}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Channel / Source</p>
                    <p className="font-semibold text-foreground mt-0.5 uppercase font-mono">
                      {(voucher.payment_through && voucher.payment_through.toLowerCase() !== 'other')
                        ? voucher.payment_through
                        : (latestPayment?.payment_through || voucher.payment_through || 'USHDESK')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Amount</p>
                    <p className="font-bold text-primary mt-0.5 font-mono">{formatAmount(voucher.total_amount, voucher.currency)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Card 1: Transaction / Ref ID */}
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Transaction / Ref ID</p>
                      {Boolean(transactionId) && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(transactionId!);
                            setCopiedType('txn');
                            setTimeout(() => setCopiedType(null), 2000);
                          }}
                          className="text-muted-foreground hover:text-foreground transition cursor-pointer p-0.5"
                          title="Copy transaction ID"
                        >
                          {copiedType === 'txn' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate" title={transactionId || undefined}>
                      {transactionId || (isPaid ? 'Settled' : 'Generated upon settlement')}
                    </p>
                  </div>

                  {/* Card 2: Trace / Auth Code */}
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Trace / Auth Code</p>
                      {Boolean(authCode) && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(authCode!);
                            setCopiedType('trace');
                            setTimeout(() => setCopiedType(null), 2000);
                          }}
                          className="text-muted-foreground hover:text-foreground transition cursor-pointer p-0.5"
                          title="Copy authorization/trace code"
                        >
                          {copiedType === 'trace' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate" title={authCode || undefined}>
                      {authCode || '—'}
                    </p>
                  </div>
                </div>

                {(latestPayment?.paid_at || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionDate || (voucher as any).paid_at || activePaymentLink?.paid_at) && (
                  <div className="rounded-xl bg-card border border-border/40 px-3 py-2 text-xs flex items-center justify-between text-muted-foreground">
                    <span>Paid Timestamp:</span>
                    <span className="font-medium text-foreground">
                      {formatDateTime(latestPayment?.paid_at || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionDate || (voucher as any).paid_at || activePaymentLink?.paid_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Customer Payment Link */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Customer Payment Link
                    </h4>
                  </div>
                  {Boolean(effectivePaymentUrl) && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyPaymentUrl}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition cursor-pointer"
                        title="Copy Payment Link"
                      >
                        {copiedPaymentUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedPaymentUrl ? 'Copied' : 'Copy URL'}</span>
                      </button>
                      <a
                        href={effectivePaymentUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition cursor-pointer"
                        title="Open Payment Link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Link</span>
                      </a>
                    </div>
                  )}
                </div>

                {effectivePaymentUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3.5 rounded-xl border border-border/40 bg-card/70 p-3">
                      <div className="p-2 bg-white rounded-xl shadow-xs border border-border/50 shrink-0">
                        <QRCodeSVG
                          value={effectivePaymentUrl}
                          size={72}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground">Scan QR Code to Pay</p>
                          {activePaymentLink?.status && (
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase',
                              activePaymentLink.status === 'paid' || activePaymentLink.status === 'success'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            )}>
                              {activePaymentLink.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono break-all line-clamp-2">
                          {effectivePaymentUrl}
                        </p>
                      </div>
                    </div>

                    {/* Share and status sync actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {targetSharePhone && (
                        <>
                          <a
                            href={whatsappShareUrl(targetSharePhone, paymentShareMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Share WhatsApp</span>
                          </a>
                          <button
                            type="button"
                            onClick={handleSendPaymentLinkSms}
                            disabled={sendingSms}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60',
                              smsSent
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
                            )}
                          >
                            {sendingSms ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Sending SMS…</span>
                              </>
                            ) : smsSent ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span>SMS Sent!</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>Send SMS</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                      {isPaymentLinkExpired && activePaymentLink && (
                        <button
                          type="button"
                          onClick={() => handleRenewPaymentLink(activePaymentLink.id)}
                          disabled={renewingLink}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition disabled:opacity-60 cursor-pointer"
                        >
                          {renewingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          <span>{renewingLink ? 'Creating…' : 'Create New Payment Link'}</span>
                        </button>
                      )}
                      {activePaymentLink && (
                        <button
                          type="button"
                          onClick={() => handleSyncPaymentLink(activePaymentLink.id)}
                          disabled={syncingLink}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition disabled:opacity-50 ml-auto cursor-pointer"
                        >
                          <RefreshCw className={cn('h-3.5 w-3.5', syncingLink && 'animate-spin text-primary')} />
                          <span>{syncingLink ? 'Checking...' : 'Check Status'}</span>
                        </button>
                      )}
                    </div>

                    {isPaymentLinkExpired && (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="flex-1">
                          This payment link expired{activePaymentLink?.expires_at ? ` on ${new Date(activePaymentLink.expires_at).toLocaleString()}` : ''}. Create a new one to collect payment.
                        </span>
                      </div>
                    )}
                    {renewError && (
                      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{renewError}</span>
                      </div>
                    )}

                    {smsFeedback && (
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition mt-2',
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
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-card/40 p-4 text-xs">
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>No customer payment link generated yet for this voucher.</span>
                    </div>
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => setShowMakePaymentModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Generate Payment Link</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── TAB 3: HISTORY & AUDIT LOG ── */
            <div className="space-y-4">
              {/* 1. Creation Record Card */}
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Creation Record
                    </h4>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary uppercase">
                    Initial Record
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Created Timestamp</p>
                    <p className="font-semibold text-foreground mt-0.5">
                      {formatDateTime(voucher.created_at)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Created By</p>
                    <p className="font-semibold text-foreground mt-0.5 truncate" title={employeeMap?.[voucher.created_by] || voucher.created_by || 'Online'}>
                      {employeeMap?.[voucher.created_by] || voucher.created_by || 'Online / Customer'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Sales Channel</p>
                    <p className="font-semibold text-foreground mt-0.5 uppercase font-mono">
                      {voucher.payment_through || 'USHDESK'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card border border-border/40 p-2.5">
                    <p className="text-[10px] text-muted-foreground font-medium">Initial Total</p>
                    <p className="font-bold text-primary mt-0.5 font-mono">
                      {formatAmount(voucher.total_amount, voucher.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Updates & Audit Trail */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Activity &amp; Updates Log
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {Array.isArray(voucher.update_history) ? `${voucher.update_history.length} event(s)` : 'No updates recorded'}
                  </span>
                </div>

                {Array.isArray(voucher.update_history) && voucher.update_history.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                    {voucher.update_history.map((entry, idx) => {
                      const action = String(entry.action || 'updated');
                      const isCreated = action === 'voucher_created';
                      const isStatus = action.includes('status');
                      const timestamp = entry.timestamp || entry.created_at;
                      const who = entry.performed_by_name || entry.performed_by || entry.created_by || entry.user || 'Staff';

                      return (
                        <div key={idx} className="relative group">
                          {/* Dot on timeline */}
                          <div className={cn(
                            'absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center',
                            isCreated ? 'bg-primary' : isStatus ? 'bg-amber-500' : 'bg-violet-500'
                          )} />

                          <div className="rounded-xl border border-border/50 bg-card p-3 space-y-1.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-xs text-foreground capitalize">
                                {action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {formatDateTime(timestamp)}
                              </span>
                            </div>

                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <User className="h-3 w-3 text-primary shrink-0" />
                              <span>Updated by: <strong className="text-foreground">{who}</strong></span>
                              {entry.ip_address && (
                                <span className="text-muted-foreground/60 font-mono text-[10px]">({entry.ip_address})</span>
                              )}
                            </p>

                            {entry.note && (
                              <div className="rounded-lg bg-muted/40 p-2 text-xs italic text-foreground">
                                &ldquo;{entry.note}&rdquo;
                              </div>
                            )}

                            {entry.changes && typeof entry.changes === 'object' && Object.keys(entry.changes).length > 0 && (
                              <div className="pt-1.5 border-t border-border/40 space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Changes Applied:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                  {Object.entries(entry.changes).map(([k, val]: [string, any]) => (
                                    <div key={k} className="rounded-md bg-muted/30 px-2 py-1 border border-border/30">
                                      <span className="font-semibold text-muted-foreground capitalize mr-1">
                                        {k.replace(/_/g, ' ')}:
                                      </span>
                                      <span className="text-foreground font-mono">
                                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    No field modifications or status changes have been recorded since voucher creation.
                  </div>
                )}
              </div>

              {/* 3. Milestones: Redemption & Payment */}
              {(isPaid || isRedeemed) && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Key Milestones</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {isPaid && (
                      <div className="flex items-center gap-2.5 rounded-xl bg-card border border-emerald-500/30 p-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-foreground">Payment Settled</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(latestPayment?.paid_at || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionDate || (voucher as any).paid_at || activePaymentLink?.paid_at || voucher.created_at)}
                          </p>
                        </div>
                      </div>
                    )}
                    {isRedeemed && (
                      <div className="flex items-center gap-2.5 rounded-xl bg-card border border-violet-500/30 p-2.5">
                        <Star className="h-4 w-4 text-violet-600 shrink-0" />
                        <div>
                          <p className="font-bold text-foreground">Voucher Redeemed</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(voucher.redeemed_at)} by {redeemedByName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 border-t border-border/40 px-6 py-4">
          <button onClick={onClose}
            type="button"
            className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          {activeTab === 'details' ? (
            <>
              {isRedeemed ? (
                <button
                  type="button"
                  onClick={() => onReschedule?.(voucher, bookingId || undefined, booking)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-sm transition active:scale-[0.98]"
                >
                  <RefreshCw className="h-4 w-4" /> Reschedule
                </button>
              ) : (
                !isPending && onShare && (
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
              {canRedeem && (
                <button
                  type="button"
                  onClick={handleRedeemClick}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition active:scale-[0.98] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> Redeem
                </button>
              )}
            </>
          ) : (
            <>
              {!isPaid && !effectivePaymentUrl && (
                <button
                  type="button"
                  onClick={() => setShowMakePaymentModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-sm transition active:scale-[0.98]"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Generate Payment Link</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invoice Details Modal */}
      {showInvoiceModal && (
        <InvoiceDetailModal
          invoiceNumber={invoiceNumber || `INV-${voucher.voucher_number || voucher.id.slice(0, 8)}`}
          invoiceRecord={invoiceRecord}
          bookingData={{
            customerName: voucher.sender_data?.name || voucher.sender_details?.name || voucher.recipient_data?.name || 'Customer',
            customerPhone: voucher.sender_data?.phone_number || voucher.sender_details?.phone_number,
            customerEmail: voucher.sender_data?.email || voucher.sender_details?.email,
            serviceName: voucher.service_data?.name || (isPhysical ? 'Gift Voucher / Physical Items' : 'Gift Voucher'),
            servicePrice: voucher.service_data?.base_price || voucher.total_amount,
            addons: voucher.addons,
            extraMinutes: voucher.extra_time,
            extraPrice: voucher.price_for_extra_time ? parseFloat(voucher.price_for_extra_time) : 0,
            totalPrice: voucher.total_amount,
            currency: voucher.currency,
            paymentMethod: latestPayment?.payment_method || (voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionStatus ? 'Card / Online' : 'Payment Link'),
            paymentProvider: latestPayment?.payment_provider || voucher.payment_provider || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentGateway || activePaymentLink?.gateway || activePaymentLink?.provider || 'MyFatoorah',
            paymentThrough: (voucher.payment_through && voucher.payment_through.toLowerCase() !== 'other')
              ? voucher.payment_through
              : (latestPayment?.payment_through || voucher.payment_through || 'ushdesk'),
            paymentNumber: paymentNumber,
            paymentDate: latestPayment?.paid_at || voucher.payment_data?.data?.InvoiceTransactions?.[0]?.TransactionDate || (voucher as any).paid_at || activePaymentLink?.paid_at,
            transactionId: transactionId,
            traceId: authCode,
            bookingNumber: voucher.voucher_number || `VOU-${voucher.id.slice(0, 8)}`,
            branchName: voucher.branch_data?.name,
            status: isPaid ? 'completed' : 'pending',
          }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* Make Payment Modal (Step 1: Select Provider -> Step 2: Make Payment Now) */}
      {showMakePaymentModal && (
        <MakePaymentModal
          isOpen={showMakePaymentModal}
          onClose={() => setShowMakePaymentModal(false)}
          targetType="voucher"
          targetId={voucher.id}
          targetNumber={voucher.voucher_number}
          targetLabel="Voucher No:"
          amount={voucher.total_amount}
          currency={voucher.currency}
          customerName={voucher.sender_data?.name || voucher.sender_details?.name || voucher.recipient_data?.name || 'Customer'}
          customerPhone={senderPhone || recipientPhone}
          onPaymentSuccess={() => {
            fetchLinks();
            onRefresh?.();
          }}
          onSuccess={() => {
            fetchLinks();
            onRefresh?.();
            setShowMakePaymentModal(false);
          }}
        />
      )}

      {/* Edit Voucher Modal */}
      {showEditModal && (
        <EditVoucherModal
          voucher={voucher}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setVoucher(updated);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

// ── Voucher Filter Popover (Multi-Status, Channel, Created By) ─────────────────

interface VoucherFilterPopoverProps {
  statusFilters: string[];
  onStatusChange: (statuses: string[]) => void;
  channelFilter: string;
  onChannelChange: (channel: string) => void;
  createdByFilter: string;
  onCreatedByChange: (creator: string) => void;
  creatorOptions: Array<{ id: string; name: string }>;
  onReset: () => void;
}

function VoucherFilterPopover({
  statusFilters,
  onStatusChange,
  channelFilter,
  onChannelChange,
  createdByFilter,
  onCreatedByChange,
  creatorOptions,
  onReset,
}: VoucherFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  const statusOptions = [
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'redeemed', label: 'Redeemed' },
    { id: 'expired', label: 'Expired' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const channelOptions = [
    { id: 'all', label: 'All Channels' },
    { id: 'desk', label: 'Desk' },
    { id: 'ushweb', label: 'USHWeb' },
    { id: 'ushspa', label: 'USHSpa' },
  ];

  const activeCount =
    (statusFilters.length > 0 && statusFilters.length < statusOptions.length ? 1 : 0) +
    (channelFilter !== 'all' ? 1 : 0) +
    (createdByFilter !== 'all' ? 1 : 0);

  const toggleStatus = (stId: string) => {
    if (statusFilters.includes(stId)) {
      onStatusChange(statusFilters.filter((s) => s !== stId));
    } else {
      onStatusChange([...statusFilters, stId]);
    }
  };

  const handleSelectAllStatuses = () => {
    onStatusChange(statusOptions.map((s) => s.id));
  };

  const handleClearStatuses = () => {
    onStatusChange([]);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-xs font-semibold shadow-xs transition hover:bg-muted/50 cursor-pointer',
          activeCount > 0 ? 'border-primary/50 text-primary bg-primary/5' : 'border-border text-foreground'
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary text-white text-[10px] font-bold px-1">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-3xl border border-border/80 bg-card p-4 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">Filter Vouchers</span>
              </div>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setOpen(false);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Reset all
                </button>
              )}
            </div>

            {/* 1. Status Multi-select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status (Multi-Select)
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={handleSelectAllStatuses}
                    className="text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Select all
                  </button>
                  <span className="text-border">•</span>
                  <button
                    type="button"
                    onClick={handleClearStatuses}
                    className="text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {statusOptions.map((opt) => {
                  const isChecked = statusFilters.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-2 text-xs font-medium cursor-pointer transition select-none',
                        isChecked
                          ? 'border-primary/50 bg-primary/5 text-foreground'
                          : 'border-border/60 hover:bg-muted/30 text-muted-foreground'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStatus(opt.id)}
                        className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. Channel Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Sales Channel
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {channelOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChannelChange(opt.id)}
                    className={cn(
                      'rounded-xl border py-1.5 px-2.5 text-xs font-semibold text-center transition cursor-pointer',
                      channelFilter === opt.id
                        ? 'border-primary bg-primary text-white shadow-xs'
                        : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Created By Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Created By
              </label>
              <select
                value={createdByFilter}
                onChange={(e) => onCreatedByChange(e.target.value)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">All Creators</option>
                <option value="__online__">Online / Self-Service</option>
                {creatorOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Done button */}
            <div className="pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full h-9 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Bulk Action Modals ────────────────────────────────────────────────────────

function BulkUpdateStatusModal({
  selectedCount,
  onClose,
  onSubmit,
}: {
  selectedCount: number;
  onClose: () => void;
  onSubmit: (status: string, note?: string) => Promise<void>;
}) {
  const [targetStatus, setTargetStatus] = useState<string>('active');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(targetStatus, note.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h3 className="font-extrabold text-sm text-foreground">Update Status ({selectedCount} Vouchers)</h3>
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">New Status</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold outline-none focus:border-primary"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="redeemed">Redeemed</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Update Reason / Note (Optional)</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bulk status update approved by supervisor"
              className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 h-9 rounded-xl border border-border bg-muted/40 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-9 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>Apply Status</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkDeleteModalProps {
  selectedVouchers: Voucher[];
  onClose: () => void;
  onConfirm: (validIds: string[]) => Promise<void>;
}

function BulkDeleteModal({
  selectedVouchers,
  onClose,
  onConfirm,
}: BulkDeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPendingStatus = (status?: string | null) => {
    const s = (status || '').trim().toLowerCase();
    return s === 'pending' || s === 'created' || s === 'payment_pending';
  };

  const deletableVouchers = useMemo(
    () => selectedVouchers.filter((v) => isPendingStatus(v.status)),
    [selectedVouchers]
  );

  const protectedVouchers = useMemo(
    () => selectedVouchers.filter((v) => !isPendingStatus(v.status)),
    [selectedVouchers]
  );

  const canProceed = deletableVouchers.length > 0;

  const handleDelete = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(deletableVouchers.map((v) => v.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vouchers');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-destructive/15 text-destructive">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-foreground">
              Delete {selectedVouchers.length} Voucher{selectedVouchers.length > 1 ? 's' : ''}
            </h3>
            <p className="text-[11px] text-muted-foreground">Only pending vouchers can be deleted</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Protection / Status Warning */}
        {protectedVouchers.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Active &amp; Redeemed Protection</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {protectedVouchers.length} of {selectedVouchers.length} voucher(s) have an active, redeemed, or completed status and <strong>cannot be deleted</strong>.
              {deletableVouchers.length > 0
                ? ` Only the ${deletableVouchers.length} pending voucher(s) will be deleted.`
                : ' None of the selected vouchers are pending. Deletion is not allowed.'}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          {canProceed ? (
            <>
              Are you sure you want to permanently delete the <strong className="text-foreground">{deletableVouchers.length}</strong> pending gift voucher{deletableVouchers.length > 1 ? 's' : ''}?
              All associated records will be removed.
            </>
          ) : (
            <>
              No pending vouchers selected. Only pending vouchers can be deleted. Active and redeemed gift vouchers cannot be deleted.
            </>
          )}
        </p>

        <div className="flex gap-2 pt-2 border-t border-border/40 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 h-9 rounded-xl border border-border bg-muted/40 font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || !canProceed}
            className="flex-1 h-9 rounded-xl bg-destructive text-destructive-foreground font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span>Confirm Delete ({deletableVouchers.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Report Generator Definitions & Modal ───────────────────────────────────────

type ReportFormat = 'csv' | 'xlsx' | 'pdf';

interface ReportField {
  id: string;
  label: string;
  category: 'General' | 'Service' | 'Financial' | 'Parties' | 'Audit';
  defaultSelected: boolean;
}

const REPORT_FIELDS: ReportField[] = [
  // General
  { id: 'secret_code', label: 'Voucher Code', category: 'General', defaultSelected: true },
  { id: 'voucher_number', label: 'Voucher Number', category: 'General', defaultSelected: true },
  { id: 'status', label: 'Status', category: 'General', defaultSelected: true },
  { id: 'payment_through', label: 'Sales Channel', category: 'General', defaultSelected: true },
  { id: 'gift_category', label: 'Gift Category', category: 'General', defaultSelected: false },

  // Service
  { id: 'service_name', label: 'Service Name', category: 'Service', defaultSelected: true },
  { id: 'duration', label: 'Duration (Mins)', category: 'Service', defaultSelected: true },
  { id: 'branch_name', label: 'Branch', category: 'Service', defaultSelected: true },
  { id: 'arrangement_name', label: 'Arrangement / Room', category: 'Service', defaultSelected: false },
  { id: 'addons', label: 'Add-ons', category: 'Service', defaultSelected: false },

  // Financial
  { id: 'total_amount', label: 'Total Amount', category: 'Financial', defaultSelected: true },
  { id: 'discount', label: 'Discount Amount', category: 'Financial', defaultSelected: true },
  { id: 'currency', label: 'Currency', category: 'Financial', defaultSelected: true },
  { id: 'payment_provider', label: 'Payment Gateway', category: 'Financial', defaultSelected: false },
  { id: 'invoice_number', label: 'Invoice Number', category: 'Financial', defaultSelected: true },
  { id: 'payment_number', label: 'Transaction / Payment ID', category: 'Financial', defaultSelected: false },

  // Parties
  { id: 'sender_name', label: 'Sender Name', category: 'Parties', defaultSelected: true },
  { id: 'sender_phone', label: 'Sender Phone', category: 'Parties', defaultSelected: true },
  { id: 'recipient_name', label: 'Recipient Name', category: 'Parties', defaultSelected: true },
  { id: 'recipient_phone', label: 'Recipient Phone', category: 'Parties', defaultSelected: true },
  { id: 'gift_message', label: 'Gift Message', category: 'Parties', defaultSelected: false },

  // Audit
  { id: 'created_at', label: 'Created At', category: 'Audit', defaultSelected: true },
  { id: 'expire_date', label: 'Expires At', category: 'Audit', defaultSelected: true },
  { id: 'redeemed_at', label: 'Redeemed At', category: 'Audit', defaultSelected: true },
  { id: 'redeemed_by', label: 'Redeemed By (Staff)', category: 'Audit', defaultSelected: false },
  { id: 'created_by', label: 'Created By (Staff)', category: 'Audit', defaultSelected: false },
];

function getVoucherFieldValue(
  voucher: Voucher,
  fieldId: string,
  employeeMap?: Record<string, string>
): string {
  switch (fieldId) {
    case 'secret_code':
      return voucher.secret_code || '';
    case 'voucher_number':
      return voucher.voucher_number || '';
    case 'status':
      return voucher.status || '';
    case 'payment_through':
      return voucher.payment_through || 'USHDESK';
    case 'gift_category':
      return voucher.gift_category || 'service';
    case 'service_name':
      return voucher.service_data?.name || 'Gift Voucher';
    case 'duration':
      return `${getVoucherTotalDuration(voucher)} min`;
    case 'branch_name':
      return voucher.branch_data?.name || '';
    case 'arrangement_name':
      return voucher.service_arrangement_data?.arrangement_name || '';
    case 'addons':
      return Array.isArray(voucher.addons)
        ? voucher.addons.map((a: any) => a.name || a.addon_name).filter(Boolean).join('; ')
        : '';
    case 'total_amount':
      return String(voucher.total_amount ?? 0);
    case 'discount':
      return String(voucher.discount ?? 0);
    case 'currency':
      return voucher.currency || 'KWD';
    case 'payment_provider':
      return voucher.payment_provider || '';
    case 'invoice_number':
      return voucher.invoice_number || (voucher.payment_data as any)?.invoice_number || '';
    case 'payment_number':
      return voucher.payment_number || (voucher.payment_data as any)?.payment_number || '';
    case 'sender_name':
      return voucher.sender_data?.name || voucher.sender_details?.name || '';
    case 'sender_phone':
      return voucher.sender_data?.phone_number || voucher.sender_details?.phone_number || '';
    case 'recipient_name':
      return voucher.recipient_data?.name || voucher.recipient_details?.name || (voucher as any).gift_to || '';
    case 'recipient_phone':
      return voucher.recipient_phone || voucher.recipient_data?.phone_number || voucher.recipient_details?.phone_number || '';
    case 'gift_message':
      return voucher.gift_message || '';
    case 'created_at':
      return voucher.created_at ? fmtDate(voucher.created_at) : '';
    case 'expire_date':
      return voucher.expire_date ? fmtDate(voucher.expire_date) : '';
    case 'redeemed_at':
      return voucher.redeemed_at ? fmtDate(voucher.redeemed_at) : '';
    case 'redeemed_by':
      return voucher.redeemed_by ? (employeeMap?.[voucher.redeemed_by] || voucher.redeemed_by) : '';
    case 'created_by':
      return voucher.created_by ? (employeeMap?.[voucher.created_by] || voucher.created_by) : '';
    default:
      return '';
  }
}

function exportToCsv(
  selectedVouchers: Voucher[],
  selectedFields: ReportField[],
  employeeMap?: Record<string, string>
) {
  const headers = selectedFields.map((f) => f.label);
  const rows = selectedVouchers.map((v) =>
    selectedFields.map((f) => {
      const val = getVoucherFieldValue(v, f.id, employeeMap);
      return `"${val.replace(/"/g, '""')}"`;
    })
  );

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  const nowStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `ushspa_gift_vouchers_report_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToXlsx(
  selectedVouchers: Voucher[],
  selectedFields: ReportField[],
  employeeMap?: Record<string, string>
) {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const headerCells = selectedFields
    .map((f) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(f.label)}</Data></Cell>`)
    .join('');

  const rowNodes = selectedVouchers
    .map((v) => {
      const cells = selectedFields
        .map((f) => {
          const val = getVoucherFieldValue(v, f.id, employeeMap);
          const isNum = (f.id === 'total_amount' || f.id === 'discount') && !isNaN(Number(val));
          if (isNum) {
            return `<Cell ss:StyleID="Number"><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          return `<Cell ss:StyleID="Data"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF" ss:FontName="Calibri" ss:Size="11"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="Data">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Number">
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <NumberFormat ss:Format="#,##0.000"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Gift Vouchers">
  <Table>
   <Row ss:Height="24">${headerCells}</Row>
   ${rowNodes}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const nowStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `ushspa_gift_vouchers_report_${nowStr}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportToPdf(
  selectedVouchers: Voucher[],
  selectedFields: ReportField[],
  employeeMap?: Record<string, string>
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export and print PDF reports.');
    return;
  }

  const nowStr = new Date().toLocaleString();
  const totalAmount = selectedVouchers.reduce((s, v) => s + (parseFloat(v.total_amount) || 0), 0);
  const activeCount = selectedVouchers.filter((v) => v.status?.toLowerCase() === 'active').length;
  const redeemedCount = selectedVouchers.filter((v) => v.status?.toLowerCase() === 'redeemed').length;

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const headersHtml = selectedFields.map((f) => `<th>${escapeHtml(f.label)}</th>`).join('');

  const rowsHtml = selectedVouchers
    .map(
      (v, idx) => `
    <tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
      ${selectedFields
        .map((f) => {
          const val = getVoucherFieldValue(v, f.id, employeeMap);
          const isNum = f.id === 'total_amount' || f.id === 'discount';
          return `<td class="${isNum ? 'num' : ''}">${escapeHtml(val)}</td>`;
        })
        .join('')}
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>USH Spa - Gift Vouchers Report</title>
  <style>
    @page {
      size: landscape;
      margin: 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1e293b;
      background: #fff;
      font-size: 11px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .brand p {
      margin: 2px 0 0;
      font-size: 11px;
      color: #64748b;
    }
    .meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .kpis {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      min-width: 110px;
    }
    .kpi-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th {
      background-color: #0f172a;
      color: #fff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 700;
      border: 1px solid #0f172a;
      white-space: nowrap;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr.even {
      background-color: #ffffff;
    }
    tr.odd {
      background-color: #f8fafc;
    }
    td.num {
      text-align: right;
      font-family: monospace;
    }
    .no-print {
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid #0f172a;
      background: #0f172a;
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="brand">
      <h1>USH SPA — GIFT VOUCHERS REPORT</h1>
      <p>Luxury Wellness &amp; Day Spa Appointments &amp; Vouchers</p>
    </div>
    <div class="meta">
      <div><strong>Generated:</strong> ${nowStr}</div>
      <div><strong>Records:</strong> ${selectedVouchers.length} Vouchers</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Total Selected</div>
      <div class="kpi-val">${selectedVouchers.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Total Value</div>
      <div class="kpi-val">${totalAmount.toFixed(3)} KWD</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Active</div>
      <div class="kpi-val">${activeCount}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Redeemed</div>
      <div class="kpi-val">${redeemedCount}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

interface VoucherReportModalProps {
  selectedVouchers: Voucher[];
  allFilteredVouchers: Voucher[];
  employeeMap: Record<string, string>;
  onClose: () => void;
}

function VoucherReportModal({
  selectedVouchers,
  allFilteredVouchers,
  employeeMap,
  onClose,
}: VoucherReportModalProps) {
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [scope, setScope] = useState<'selected' | 'all'>(
    selectedVouchers.length > 0 ? 'selected' : 'all'
  );
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(() => {
    return new Set(REPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.id));
  });
  const [generating, setGenerating] = useState(false);

  const targetVouchers = scope === 'selected' ? selectedVouchers : allFilteredVouchers;

  const categories: Array<ReportField['category']> = ['General', 'Service', 'Financial', 'Parties', 'Audit'];

  const handleToggleField = (id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedFieldIds(new Set(REPORT_FIELDS.map((f) => f.id)));
  };

  const handleDeselectAll = () => {
    setSelectedFieldIds(new Set());
  };

  const handleToggleCategory = (cat: ReportField['category']) => {
    const catFields = REPORT_FIELDS.filter((f) => f.category === cat);
    const allSelected = catFields.every((f) => selectedFieldIds.has(f.id));
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        catFields.forEach((f) => next.delete(f.id));
      } else {
        catFields.forEach((f) => next.add(f.id));
      }
      return next;
    });
  };

  const handleGenerate = () => {
    if (selectedFieldIds.size === 0 || targetVouchers.length === 0) return;
    setGenerating(true);

    const orderedFields = REPORT_FIELDS.filter((f) => selectedFieldIds.has(f.id));

    setTimeout(() => {
      try {
        if (format === 'csv') {
          exportToCsv(targetVouchers, orderedFields, employeeMap);
        } else if (format === 'xlsx') {
          exportToXlsx(targetVouchers, orderedFields, employeeMap);
        } else if (format === 'pdf') {
          exportToPdf(targetVouchers, orderedFields, employeeMap);
        }
        onClose();
      } catch (err) {
        console.error('Failed to export report:', err);
      } finally {
        setGenerating(false);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4.5 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground leading-tight">
                Generate Gift Vouchers Report
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select columns and export format ({targetVouchers.length} record{targetVouchers.length > 1 ? 's' : ''})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* 1. Scope selection (if some selected) */}
          {selectedVouchers.length > 0 && selectedVouchers.length < allFilteredVouchers.length && (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Records To Include:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border font-semibold transition cursor-pointer',
                    scope === 'selected'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>Selected Vouchers</span>
                  <span className="font-mono font-bold text-foreground">{selectedVouchers.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-xl border font-semibold transition cursor-pointer',
                    scope === 'all'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>All Filtered Vouchers</span>
                  <span className="font-mono font-bold text-foreground">{allFilteredVouchers.length}</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              1. Choose Report Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* XLSX */}
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={cn(
                  'flex flex-col items-start p-3.5 rounded-2xl border text-left transition cursor-pointer',
                  format === 'xlsx'
                    ? 'border-emerald-500/80 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-border bg-card hover:bg-muted/40'
                )}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  {format === 'xlsx' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <span className="font-bold text-xs text-foreground">Excel Workbook</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Formatted spreadsheet (.xlsx / .xls)
                </span>
              </button>

              {/* CSV */}
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={cn(
                  'flex flex-col items-start p-3.5 rounded-2xl border text-left transition cursor-pointer',
                  format === 'csv'
                    ? 'border-blue-500/80 bg-blue-500/10 ring-1 ring-blue-500/30'
                    : 'border-border bg-card hover:bg-muted/40'
                )}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  {format === 'csv' && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <span className="font-bold text-xs text-foreground">CSV Table</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  UTF-8 comma-separated (.csv)
                </span>
              </button>

              {/* PDF */}
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={cn(
                  'flex flex-col items-start p-3.5 rounded-2xl border text-left transition cursor-pointer',
                  format === 'pdf'
                    ? 'border-violet-500/80 bg-violet-500/10 ring-1 ring-violet-500/30'
                    : 'border-border bg-card hover:bg-muted/40'
                )}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <Printer className="h-4 w-4" />
                  </div>
                  {format === 'pdf' && (
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                  )}
                </div>
                <span className="font-bold text-xs text-foreground">Printable PDF</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Landscape layout with spa branding
                </span>
              </button>
            </div>
          </div>

          {/* 3. Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Select Report Fields
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <strong className="text-foreground">{selectedFieldIds.size}</strong> of {REPORT_FIELDS.length} fields selected
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-muted-foreground/40">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const catFields = REPORT_FIELDS.filter((f) => f.category === cat);
                const count = catFields.filter((f) => selectedFieldIds.has(f.id)).length;
                const isAll = count === catFields.length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold border transition cursor-pointer',
                      isAll
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : count > 0
                        ? 'bg-muted border-border text-foreground'
                        : 'bg-background border-border/60 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] px-1 rounded-md bg-background/80 font-mono font-bold">
                      {count}/{catFields.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1 border border-border/50 rounded-2xl bg-muted/10">
              {REPORT_FIELDS.map((field) => {
                const isChecked = selectedFieldIds.has(field.id);
                return (
                  <label
                    key={field.id}
                    className={cn(
                      'flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition',
                      isChecked
                        ? 'border-primary/30 bg-card text-foreground font-semibold shadow-xs'
                        : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleField(field.id)}
                      className="h-4 w-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                    />
                    <span className="min-w-0 flex-1 truncate">{field.label}</span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 px-1 py-0.5 rounded bg-muted">
                      {field.category}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-6 py-4 bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground">
            Target: <strong className="text-foreground">{targetVouchers.length}</strong> vouchers •{' '}
            <strong className="text-foreground">{selectedFieldIds.size}</strong> columns
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || selectedFieldIds.size === 0 || targetVouchers.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Payment Through Config ─────────────────────────────────────────────────────

function getPaymentThroughConfig(ptRaw?: string | null) {
  if (!ptRaw) return null;
  const pt = ptRaw.trim().toLowerCase();
  if (pt === 'ushweb' || pt === 'web') {
    return {
      label: 'USHWeb',
      badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      dotClass: 'bg-purple-500',
    };
  }
  if (pt === 'desk' || pt === 'ushdesk') {
    return {
      label: 'Desk',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      dotClass: 'bg-blue-500',
    };
  }
  if (pt === 'ushspa' || pt === 'spa' || pt === 'app') {
    return {
      label: 'USHSpa',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
    };
  }
  return {
    label: ptRaw,
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  };
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

  const recipientName =
    voucher.recipient_data?.name ||
    voucher.recipient_details?.name ||
    (voucher as any).gift_to ||
    (voucher as any).recipient_name ||
    'Valued Guest';
  const recipientPhone =
    voucher.recipient_phone ||
    voucher.recipient_data?.phone_number ||
    voucher.recipient_details?.phone_number ||
    '';
  const voucherCode = voucher.secret_code || voucher.voucher_number || voucher.id.slice(0, 8);
  const serviceName = voucher.service_data?.name || 'Spa Service';
  const expiryDate = fmtDate(voucher.expire_date);

  const [message, setMessage] = useState(() => buildVoucherShareMessage(voucher));
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
                  onClick={() => setMessage(buildVoucherShareMessage(voucher))}
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
  const user = useAppSelector((s) => s.auth.user);
  const {
    isAdmin,
    isSpaDirector,
    isFinanceManager,
    isRefundsAndFinancePermitted,
    roleInfo,
    canDeleteGiftVoucher,
    canUpdateVoucherStatus,
    canGenerateVoucherReport,
  } = usePermissions();

  const canViewVoucherNumber = useMemo(() => {
    if (isAdmin || isSpaDirector || isFinanceManager || isRefundsAndFinancePermitted) {
      return true;
    }
    const candidates = extractRoleCandidates(roleInfo, user);
    return candidates.some((c) =>
      c.includes('admin') ||
      c.includes('administrator') ||
      c.includes('finance') ||
      c.includes('spa director') ||
      c.includes('director')
    );
  }, [isAdmin, isSpaDirector, isFinanceManager, isRefundsAndFinancePermitted, roleInfo, user]);

  const [vouchers,        setVouchers]        = useState<Voucher[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [statusFilters,   setStatusFilters]   = useState<string[]>([]);
  const [channelFilter,   setChannelFilter]   = useState<string>('all');
  const [createdByFilter, setCreatedByFilter] = useState<string>('all');
  const [showCreate,      setShowCreate]      = useState(false);

  // Multi-select and bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    authedFetch('/uauth/api/v1/employees/')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.results ?? [];
        const map: Record<string, string> = {};
        list.forEach((emp: any) => {
          const name = emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.user?.first_name || emp.username;
          if (emp.id && name) map[String(emp.id)] = name;
          if (emp.user_id && name) map[String(emp.user_id)] = name;
          if (emp.user?.id && name) map[String(emp.user.id)] = name;
        });
        setEmployeeMap(map);
      })
      .catch(() => {});
  }, []);

  const creatorOptions = useMemo(() => {
    const ids = new Set<string>();
    vouchers.forEach((v) => {
      if (v.created_by && v.created_by !== 'online' && v.created_by !== 'web' && v.created_by !== 'customer') {
        ids.add(v.created_by);
      }
    });
    return Array.from(ids).map((id) => ({
      id,
      name: employeeMap[id] || (user?.id === id && user?.name ? user.name : (id.length > 20 ? `Staff (${id.slice(0, 6)})` : id)),
    }));
  }, [vouchers, employeeMap, user]);

  // Date filters & pagination
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [dateRange,  setDateRange]  = useState<DateRange>({});
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(20);

  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, statusFilters, channelFilter, createdByFilter, dateFilter, dateRange]);
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
    const text = buildVoucherShareMessage(voucher);
    navigator.clipboard?.writeText(text);
    setCopyAlert({ voucherCode: code, url: text });
  }, []);

  const handleSendReminder = useCallback((msg: string, recipientName: string, channel: 'sms' | 'whatsapp') => {
    const code = shareVoucher?.secret_code || shareVoucher?.voucher_number || shareVoucher?.id.slice(0, 8) || 'Voucher';
    const phone =
      shareVoucher?.recipient_phone ||
      shareVoucher?.recipient_data?.phone_number ||
      shareVoucher?.recipient_details?.phone_number ||
      '';

    if (channel === 'whatsapp') {
      const waUrl = whatsappShareUrl(phone, msg);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else if (channel === 'sms') {
      const smsUri = smsShareUrl(phone, msg);
      window.location.href = smsUri;
    }

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

  const [redeemVoucher, setRedeemVoucher] = useState<Voucher | null>(null);
  const [initialRedeemAvailabilitiesPromise, setInitialRedeemAvailabilitiesPromise] = useState<Promise<any> | null>(null);

  const handleOpenRedeem = useCallback((voucher: Voucher, promise?: Promise<any>) => {
    setSelectedVoucher(null);
    setRedeemVoucher(voucher);
    setInitialRedeemAvailabilitiesPromise(promise || null);
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
      // 1. Status multi-select filter
      if (statusFilters.length > 0 && statusFilters.length < 5) {
        const s = v.status?.toLowerCase() ?? '';
        const isPending =
          s === 'pending' ||
          s === 'payment_pending' ||
          s === 'created' ||
          s.includes('pending');
        const isRedeemed = s === 'redeemed' || Boolean(v.redeemed_at);

        const matchesAny = statusFilters.some((target) => {
          if (target === 'pending') return isPending;
          if (target === 'redeemed') return isRedeemed;
          if (target === 'active') return s === 'active' && !isRedeemed;
          if (target === 'expired') return s === 'expired';
          if (target === 'cancelled') return s === 'cancelled';
          return s === target;
        });

        if (!matchesAny) return false;
      }

      // 1b. Payment through channel filter (ushweb, desk, ushspa)
      if (channelFilter !== 'all') {
        const pt = (v.payment_through || (v as any).payment_data?.payment_through || (v as any).channel || '').trim().toLowerCase();
        if (channelFilter === 'ushweb') {
          if (pt !== 'ushweb' && pt !== 'web') return false;
        } else if (channelFilter === 'desk') {
          if (pt !== 'desk' && pt !== 'ushdesk') return false;
        } else if (channelFilter === 'ushspa') {
          if (pt !== 'ushspa' && pt !== 'spa' && pt !== 'app') return false;
        } else if (pt !== channelFilter.toLowerCase()) {
          return false;
        }
      }

      // 1c. Created By filter
      if (createdByFilter !== 'all') {
        if (createdByFilter === '__online__') {
          const cb = (v.created_by || '').toLowerCase();
          if (cb && cb !== 'online' && cb !== 'web' && cb !== 'customer') return false;
        } else {
          if (v.created_by !== createdByFilter) return false;
        }
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
        const ptName = (v.payment_through ?? '').toLowerCase();
        const srvName = (v.service_data?.name ?? '').toLowerCase();
        const brName = (v.branch_data?.name ?? '').toLowerCase();

        const match =
          matchesSecretCode ||
          matchesRecipientPhone ||
          matchesVNum ||
          matchesSenderPhone ||
          ptName.includes(q) ||
          vId.includes(q) ||
          recName.includes(q) ||
          recEmail.includes(q) ||
          sndName.includes(q) ||
          srvName.includes(q) ||
          brName.includes(q);

        if (!match) return false;
      }

      // 3. Date filter
      if (!matchesDateRange(v.created_at || v.expire_date, dateRange)) {
        return false;
      }

      return true;
    });
  }, [vouchers, statusFilters, channelFilter, createdByFilter, searchQuery, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedVouchers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Bulk action helpers
  const handleBulkDelete = async (idsToDelete?: string[]) => {
    const ids = idsToDelete && idsToDelete.length > 0 ? idsToDelete : Array.from(selectedIds);
    if (ids.length === 0) return;
    const res = await authedFetch('/booknpay/api/v1/vouchers/batch-delete/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voucher_ids: ids }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Failed to delete vouchers (HTTP ${res.status})`);
    }
    const data = await res.json().catch(() => ({}));
    if (data.errors && data.errors.length > 0 && (!data.deleted_ids || data.deleted_ids.length === 0)) {
      throw new Error(data.errors[0]?.error || 'Failed to delete selected vouchers');
    }
    setSelectedIds(new Set());
    fetchVouchers();
  };

  const handleBulkUpdateStatus = async (status: string, note?: string) => {
    const ids = Array.from(selectedIds);
    const res = await authedFetch('/booknpay/api/v1/vouchers/batch-update-status/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voucher_ids: ids, status, note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Failed to update status (HTTP ${res.status})`);
    }
    setSelectedIds(new Set());
    fetchVouchers();
  };

  const handleExportSelectedReport = () => {
    const selectedVouchers = vouchers.filter((v) => selectedIds.has(v.id));
    if (selectedVouchers.length === 0) return;

    const headers = [
      'Voucher Code',
      'Voucher Number',
      'Status',
      'Channel',
      'Amount',
      'Currency',
      'Service',
      'Sender Name',
      'Sender Phone',
      'Recipient Name',
      'Recipient Phone',
      'Created At',
      'Expires At',
      'Redeemed At',
    ];

    const rows = selectedVouchers.map((v) => [
      `"${(v.secret_code || '').replace(/"/g, '""')}"`,
      `"${(v.voucher_number || '').replace(/"/g, '""')}"`,
      `"${(v.status || '').replace(/"/g, '""')}"`,
      `"${(v.payment_through || 'USHDESK').replace(/"/g, '""')}"`,
      `"${v.total_amount || 0}"`,
      `"${v.currency || 'KWD'}"`,
      `"${(v.service_data?.name || 'Gift Voucher').replace(/"/g, '""')}"`,
      `"${(v.sender_data?.name || v.sender_details?.name || '').replace(/"/g, '""')}"`,
      `"${(v.sender_data?.phone_number || v.sender_details?.phone_number || '').replace(/"/g, '""')}"`,
      `"${(v.recipient_data?.name || v.recipient_details?.name || '').replace(/"/g, '""')}"`,
      `"${(v.recipient_phone || v.recipient_data?.phone_number || v.recipient_details?.phone_number || '').replace(/"/g, '""')}"`,
      `"${v.created_at || ''}"`,
      `"${v.expire_date || ''}"`,
      `"${v.redeemed_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const nowStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `gift_vouchers_report_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pageIds = useMemo(() => paginatedVouchers.map((v) => v.id), [paginatedVouchers]);
  const isAllPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const isSomePageSelected = pageIds.some((id) => selectedIds.has(id)) && !isAllPageSelected;

  const handleToggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((v) => v.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Aggregate stats across all matching filtered records (not just current page)
  const stats = useMemo(() => {
    const target = filtered;
    return {
      total:          target.length,
      active:         target.filter(v => v.status?.toLowerCase() === 'active').length,
      redeemed:       target.filter(v => v.status?.toLowerCase() === 'redeemed' || Boolean(v.redeemed_at)).length,
      expired:        target.filter(v => v.status?.toLowerCase() === 'expired').length,
      revenue:        target
                        .filter(v => v.status?.toLowerCase() === 'active' || v.status?.toLowerCase() === 'redeemed')
                        .reduce((sum, v) => sum + (parseFloat(v.total_amount) || 0), 0),
      pendingRevenue: target
                        .filter(v => {
                          const s = v.status?.toLowerCase() ?? '';
                          return s === 'pending' || s === 'payment_pending' || s === 'created' || s.includes('pending');
                        })
                        .reduce((sum, v) => sum + (parseFloat(v.total_amount) || 0), 0),
      currency:       target[0]?.currency ?? vouchers[0]?.currency ?? 'KWD',
    };
  }, [filtered, vouchers]);

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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total Vouchers',  value: stats.total,                                      sub: (dateFilter !== 'all' || statusFilters.length > 0 || channelFilter !== 'all' || createdByFilter !== 'all' || searchQuery.trim()) ? `${stats.total} filtered` : 'all time', grad: 'from-primary to-accent',         bg: 'bg-primary/5 dark:bg-primary/10',       border: 'border-primary/20' },
          { label: 'Active',          value: stats.active,                                     sub: 'ready to redeem',        grad: 'from-emerald-500 to-teal-500',    bg: 'bg-emerald-50 dark:bg-emerald-950/30',  border: 'border-emerald-200/80 dark:border-emerald-800/40' },
          { label: 'Redeemed',        value: stats.redeemed,                                   sub: 'used vouchers',          grad: 'from-blue-500 to-sky-500',        bg: 'bg-blue-50 dark:bg-blue-950/30',        border: 'border-blue-200/80 dark:border-blue-800/40' },
          { label: 'Total Revenue',   value: `${stats.revenue.toFixed(3)} ${stats.currency}`,         sub: 'active & redeemed',     grad: 'from-amber-500 to-orange-500',    bg: 'bg-amber-50 dark:bg-amber-950/30',      border: 'border-amber-200/80 dark:border-amber-800/40' },
          { label: 'Pending Revenue', value: `${stats.pendingRevenue.toFixed(3)} ${stats.currency}`, sub: 'awaiting confirmation', grad: 'from-violet-500 to-purple-500',   bg: 'bg-violet-50 dark:bg-violet-950/30',    border: 'border-violet-200/80 dark:border-violet-800/40' },
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

          {/* Filter Icon Popover (Status multi-select, Channel, Created By) */}
          <VoucherFilterPopover
            statusFilters={statusFilters}
            onStatusChange={(statuses) => setStatusFilters(statuses)}
            channelFilter={channelFilter}
            onChannelChange={(ch) => setChannelFilter(ch)}
            createdByFilter={createdByFilter}
            onCreatedByChange={(cr) => setCreatedByFilter(cr)}
            creatorOptions={creatorOptions}
            onReset={() => {
              setStatusFilters([]);
              setChannelFilter('all');
              setCreatedByFilter('all');
            }}
          />

          <DateRangeFilter
            buttonLabelPrefix="Date Filters"
            dateFilter={dateFilter}
            dateRange={dateRange}
            onChange={(type, range) => {
              setDateFilter(type);
              setDateRange(range);
              setPage(1);
            }}
          />
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

      {/* ── Active Date / Channel / Status / Created By Filter Badges ── */}
      <div className="flex flex-wrap items-center gap-2">
        <DateFilterActiveBadge
          dateFilter={dateFilter}
          dateRange={dateRange}
          onClear={() => {
            setDateFilter('all');
            setDateRange({});
            setPage(1);
          }}
        />
        {statusFilters.length > 0 && statusFilters.length < 5 && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <span>Status: {statusFilters.join(', ')}</span>
            <button
              type="button"
              onClick={() => setStatusFilters([])}
              className="hover:text-primary/70 transition-colors ml-0.5"
              title="Clear status filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {channelFilter !== 'all' && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <CreditCard className="h-3 w-3" />
            <span>
              Channel: {channelFilter === 'ushweb' ? 'USHWeb' : channelFilter === 'desk' ? 'Desk' : channelFilter === 'ushspa' ? 'USHSpa' : channelFilter}
            </span>
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className="hover:text-primary/70 transition-colors ml-0.5"
              title="Clear channel filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {createdByFilter !== 'all' && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <UserCheck className="h-3 w-3" />
            <span>
              Created By: {createdByFilter === '__online__' ? 'Online' : (creatorOptions.find((c) => c.id === createdByFilter)?.name || createdByFilter)}
            </span>
            <button
              type="button"
              onClick={() => setCreatedByFilter('all')}
              className="hover:text-primary/70 transition-colors ml-0.5"
              title="Clear created by filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
          {(searchQuery.trim() || statusFilters.length > 0 || channelFilter !== 'all' || createdByFilter !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilters([]);
                setChannelFilter('all');
                setCreatedByFilter('all');
                setDateFilter('all');
                setDateRange({});
              }}
              className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Clear filters
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
                  <th className="w-10 px-3 py-3 text-center align-middle first:rounded-tl-2xl">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomePageSelected;
                      }}
                      onChange={handleToggleSelectAllPage}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                      title="Select all on page"
                    />
                  </th>
                  {[
                    'Voucher Code', 'Sender → Recipient', 'Service',
                    'Price & Duration', 'Payment Through', 'Expires', 'Status',
                  ].map(col => (
                    <th
                      key={col}
                      className="whitespace-nowrap py-3 pl-4 pr-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground last:rounded-tr-2xl text-left"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedVouchers.map(v => {
                  const cfg = statusCfg(v.status);
                  const expired = v.expire_date && new Date(v.expire_date) < new Date();
                  const senderName = v.sender_data?.name || v.sender_details?.name;
                  const recipientName = v.recipient_data?.name || v.recipient_details?.name;
                  const recipientPhone = v.recipient_phone || v.recipient_data?.phone_number || v.recipient_details?.phone_number;
                  const isRedeemed = v.status?.toLowerCase() === 'redeemed' || Boolean(v.redeemed_at);
                  const isPending =
                    v.status?.toLowerCase() === 'pending' ||
                    v.status?.toLowerCase() === 'payment_pending' ||
                    v.status?.toLowerCase() === 'created' ||
                    v.status?.toLowerCase().includes('pending');
                  const canShare = !isRedeemed && !isPending;

                  return (
                    <tr
                      key={v.id}
                      className={cn('transition hover:bg-muted/20', selectedIds.has(v.id) && 'bg-primary/5 hover:bg-primary/10')}
                    >
                      {/* Selection Checkbox */}
                      <td className="w-10 px-3 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(v.id)}
                          onChange={(e) => handleToggleSelect(v.id, e)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                        />
                      </td>

                      {/* Voucher Code */}
                      <td
                        onClick={() => setSelectedVoucher(v)}
                        className="px-4 py-3 align-top whitespace-nowrap cursor-pointer group hover:bg-muted/30 transition-colors"
                        title="View voucher details"
                      >
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-1.5 font-bold text-foreground group-hover:text-primary font-mono text-[12px] transition-colors">
                            <Eye className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform shrink-0" />
                            <span className="group-hover:underline underline-offset-2">
                              {v.secret_code || v.voucher_number || '—'}
                            </span>
                          </div>
                          {canShare && (
                            <VoucherShareDropdown
                              voucher={v}
                              iconOnly
                              onSelectChannel={(voucher, channel) => {
                                setShareChannel(channel);
                                setShareVoucher(voucher);
                              }}
                              onCopyUrl={handleCopyPublicUrl}
                            />
                          )}
                        </div>
                        {canViewVoucherNumber && Boolean(v.voucher_number) && v.voucher_number !== v.secret_code && (
                          <p className="text-[11px] font-mono font-semibold text-primary/80 mt-0.5 tracking-tight" title="Voucher Number">
                            {v.voucher_number}
                          </p>
                        )}
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
                          <span>{getVoucherTotalDuration(v)} min</span>
                        </div>
                      </td>

                      {/* Payment Through */}
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {(() => {
                          const ptCfg = getPaymentThroughConfig(v.payment_through);
                          if (!ptCfg) {
                            return <span className="text-muted-foreground text-xs font-medium">—</span>;
                          }
                          return (
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap border', ptCfg.badgeClass)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', ptCfg.dotClass)} />
                              {ptCfg.label}
                            </span>
                          );
                        })()}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Spacing to ensure action dropdowns have ample room above footer */}
            <div className="h-28 pointer-events-none" aria-hidden="true" />
          </div>

          {/* Table footer / Pagination */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border/40 bg-muted/20 px-5 py-3">
            {/* Left: Summary & page size selector */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Showing{' '}
                <strong className="text-foreground font-semibold">
                  {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}
                </strong>
                –
                <strong className="text-foreground font-semibold">
                  {Math.min(page * pageSize, filtered.length)}
                </strong>{' '}
                of <strong className="text-foreground font-semibold">{filtered.length.toLocaleString()}</strong> vouchers
              </span>

              <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-border bg-muted/40 px-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
                >
                  {[10, 20, 50, 100].map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-[1px] bg-border/80 hidden lg:block" />

              <div className="hidden lg:flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span>
                  Total value:{' '}
                  <span className="font-bold text-primary">
                    {filtered.reduce((s, v) => s + (parseFloat(v.total_amount) || 0), 0).toFixed(3)} {stats.currency}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Page navigation buttons and jump */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <span>Go to:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  defaultValue={page}
                  key={`jump-${page}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (val >= 1 && val <= totalPages) setPage(val);
                    }
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= totalPages && val !== page) setPage(val);
                  }}
                  className="h-8 w-14 rounded-lg border border-border bg-card px-2 text-center text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="First page"
                aria-label="First page"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                  page === 1
                    ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
                )}
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                title="Previous page"
                aria-label="Previous page"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                  page <= 1
                    ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers(page, totalPages).map((p, idx) => {
                  if (p === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
                    );
                  }
                  const isCurrent = p === page;
                  return (
                    <button
                      key={`page-${p}`}
                      onClick={() => setPage(p)}
                      className={cn(
                        'flex h-8 min-w-8 px-2 items-center justify-center rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer',
                        isCurrent
                          ? 'bg-primary text-white shadow-sm'
                          : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                title="Next page"
                aria-label="Next page"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                  page >= totalPages
                    ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Last page"
                aria-label="Last page"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                  page === totalPages
                    ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
                )}
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedVoucher && (
        <VoucherDetailModal
          voucher={selectedVoucher}
          token={token}
          employeeMap={employeeMap}
          onClose={() => setSelectedVoucher(null)}
          onShare={(v, channel) => {
            setSelectedVoucher(null);
            setShareChannel(channel);
            setShareVoucher(v);
          }}
          onCopyUrl={handleCopyPublicUrl}
          onReschedule={handleOpenReschedule}
          onRedeem={handleOpenRedeem}
          onRefresh={fetchVouchers}
        />
      )}

      {/* ── Redeem Voucher Modal ── */}
      {redeemVoucher && (
        <RedeemVoucherModal
          voucher={redeemVoucher}
          invoiceNumber={redeemVoucher.invoice_number || (redeemVoucher.payment_data as any)?.invoice_number || null}
          paymentNumber={redeemVoucher.payment_number || (redeemVoucher.payment_data as any)?.payment_number || null}
          token={token || undefined}
          initialAvailabilitiesPromise={initialRedeemAvailabilitiesPromise}
          onClose={() => {
            setRedeemVoucher(null);
            setInitialRedeemAvailabilitiesPromise(null);
          }}
          onSuccess={() => {
            setRedeemVoucher(null);
            setInitialRedeemAvailabilitiesPromise(null);
            fetchVouchers();
          }}
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
            <p className="text-xs font-bold text-foreground">Gift Voucher Message Copied to Clipboard</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
              Voucher #{copyAlert.voucherCode}
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

      {/* ── Sticky Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-border/60 text-xs">
            <span className="font-bold text-foreground">{selectedIds.size}</span>
            <span className="text-muted-foreground">selected</span>
            {selectedIds.size < filtered.length && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] text-primary hover:underline font-semibold ml-1 cursor-pointer"
              >
                Select all {filtered.length}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canUpdateVoucherStatus && (
              <button
                type="button"
                onClick={() => setShowBulkStatusModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                <span>Update Status</span>
              </button>
            )}

            {canGenerateVoucherReport && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Generate Report</span>
              </button>
            )}

            {canDeleteGiftVoucher && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition cursor-pointer shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleClearSelection}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer ml-1"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Status Modal ── */}
      {showBulkStatusModal && (
        <BulkUpdateStatusModal
          selectedCount={selectedIds.size}
          onClose={() => setShowBulkStatusModal(false)}
          onSubmit={handleBulkUpdateStatus}
        />
      )}

      {/* ── Bulk Delete Modal ── */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          selectedVouchers={vouchers.filter((v) => selectedIds.has(v.id))}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
        />
      )}

      {/* ── Voucher Report Modal ── */}
      {showReportModal && (
        <VoucherReportModal
          selectedVouchers={vouchers.filter((v) => selectedIds.has(v.id))}
          allFilteredVouchers={filtered}
          employeeMap={employeeMap}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </DashboardShell>
  );
}
