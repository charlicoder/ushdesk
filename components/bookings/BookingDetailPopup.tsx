"use client";

import Link from 'next/link';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, Calendar, CalendarClock, Clock, MapPin, User, Scissors,
  CreditCard, CheckCircle2, XCircle, BookOpen, BookMarked,
  ChevronLeft, ChevronRight, X, ExternalLink, Hash, Home,
  History, Info, UserCheck, Copy, Check, Plus, Banknote, Printer, Loader2,
  FileText, Receipt, Eye, ShieldCheck, ArrowRight, UserX, UserCog, QrCode, RotateCcw, Heart, Tag,
  Trash2, Pencil, Lock,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { DEFAULT_TIMEZONE as KUWAIT_TZ, kuwaitDateString, nowWithTimezone, parseClockToMinutes } from '@/lib/datetime';
import { useAppSelector } from '@/store/hooks';
import { checkBookingCancellationEligibility, getBookingAppointmentDateTime } from '@/lib/cancellation-policy';
import { RescheduleBookingModal } from '@/components/bookings/RescheduleBookingModal';
import { usePermissions } from '@/hooks/use-permissions';
import { ChangeTherapistModal } from '@/components/bookings/ChangeTherapistModal';
import { EditSessionModal, type EditableServiceItem } from '@/components/bookings/EditSessionModal';
import { AddSessionSubModal, type SavedSession } from '@/components/bookings/NewAppointmentBookingModal';
import { BookingReceiptModal } from '@/components/bookings/BookingReceiptModal';
import { InvoiceDetailModal } from '@/components/bookings/InvoiceDetailModal';
import { BookingCancellationModal } from '@/components/bookings/BookingCancellationModal';
import { PaymentReferenceModal, type PaymentReferenceData, type PaymentProviderOption } from '@/components/bookings/PaymentReferenceModal';
import { FeedbackLinkModal } from '@/components/bookings/FeedbackLinkModal';
import type { CreateFeedbackLinkPayload } from '@/lib/feedback';
import { MakePaymentModal } from '@/components/bookings/MakePaymentModal';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Booking {
  id: string;
  booking_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  branch_name: string;
  service_name: string;
  service_category: string;
  service_price: string;
  arrangement_name: string | null;
  therapist_name: string;
  therapist_id?: string | null;
  therapist_avatar?: string | null;
  secondary_therapist_name?: string | null;
  secondary_therapist_id?: string | null;
  secondary_therapist_avatar?: string | null;
  secondary_therapist_data?: Record<string, unknown> | null;
  appointment_start: string;
  appointment_end: string;
  duration_minutes: number;
  addons_duration: number;
  extra_minutes: number;
  total_duration: number;
  price_for_extra_minutes: string;
  booking_type: string;
  status: string;
  payment_status: string;
  payment_number?: string | null;
  payment_gateway: string | null;
  payment_provider: string | null;
  payment_method: string | null;
  payment_url: string | null;
  payment_data: Record<string, unknown> | null;
  channel?: string;
  source?: string;
  payment_through?: string;
  is_paid: boolean;
  total_amount: string;
  currency: string;
  created_at: string;
  created_by_user: string | null;
  customer_notes?: string | null;
  created_by_user_data: Record<string, unknown> | null;
  addons: Array<Record<string, unknown>>;
  pricing: Record<string, unknown> | null;
  discount?: string | null;
  arrangement_price?: string | null;
  addon_price?: string | null;
  total_price?: string | null;
  services?: Array<Record<string, unknown>>;
  sessions?: Array<Record<string, unknown>>;
  course_data?: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}

// ── Therapist extraction helpers ──────────────────────────────────────────────
export function extractTherapistName(
  data?: Record<string, unknown> | null,
  directName?: string | null,
  altObj?: Record<string, unknown> | null
): string {
  const d = (data || {}) as Record<string, any>;
  const alt = (altObj || {}) as Record<string, any>;
  const candidates = [
    directName,
    d.therapist_name,
    d.name,
    d.full_name,
    d.first_name || d.last_name ? [d.first_name, d.last_name].filter(Boolean).join(' ') : null,
    alt.therapist_name,
    alt.name,
    alt.full_name,
    alt.first_name || alt.last_name ? [alt.first_name, alt.last_name].filter(Boolean).join(' ') : null,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() && c.trim() !== '—') {
      return c.trim();
    }
  }
  return '';
}

export function extractTherapistAvatar(
  data?: Record<string, unknown> | null,
  directAvatar?: string | null,
  altObj?: Record<string, unknown> | null
): string {
  const d = (data || {}) as Record<string, any>;
  const alt = (altObj || {}) as Record<string, any>;
  const candidates = [
    directAvatar,
    d.avatar,
    d.photo_url,
    d.photo,
    d.image,
    d.profile_picture,
    (d.employee as any)?.avatar,
    (d.employee as any)?.photo_url,
    (d.user as any)?.avatar,
    alt.avatar,
    alt.photo_url,
    alt.photo,
    alt.image,
    alt.profile_picture,
    (alt.employee as any)?.avatar,
    (alt.employee as any)?.photo_url,
    (alt.user as any)?.avatar,
  ];
  for (const a of candidates) {
    if (typeof a === 'string' && a.trim()) {
      return a.trim();
    }
  }
  return '';
}

// ── Normalise ──────────────────────────────────────────────────────────────────
export function normalise(raw: Record<string, unknown>): Booking {
  const cd  = (raw.customer_data            ?? {}) as Record<string, unknown>;
  const bd  = (raw.branch_data              ?? {}) as Record<string, unknown>;
  const sd  = (raw.service_data             ?? {}) as Record<string, unknown>;
  const sad = (raw.service_arrangement_data ?? {}) as Record<string, unknown>;
  const td  = (raw.therapist_data           ?? {}) as Record<string, unknown>;
  const std = (raw.secondary_therapist_data ?? {}) as Record<string, unknown>;
  const pm  = (raw.payments_meta            ?? {}) as Record<string, unknown>;
  const pd  = (raw.payment_data             ?? {}) as Record<string, unknown>;
  const firstName = String(cd.first_name ?? '');
  const lastName  = String(cd.last_name  ?? '');

  const tRawObj = (raw.therapist ?? {}) as Record<string, unknown>;
  const secRawObj = (raw.secondary_therapist ?? {}) as Record<string, unknown>;

  const primaryName =
    extractTherapistName(td, raw.therapist_name as string, tRawObj) ||
    '—';

  const primaryAvatar =
    extractTherapistAvatar(td, (raw.therapist_avatar || raw.therapist_photo) as string, tRawObj) ||
    null;

  const secName =
    extractTherapistName(std, raw.secondary_therapist_name as string, secRawObj) ||
    null;

  const secAvatar =
    extractTherapistAvatar(std, (raw.secondary_therapist_avatar || raw.secondary_therapist_photo) as string, secRawObj) ||
    null;

  // Multi-service bookings carry a `services` array (legacy single-service bookings don't).
  const svcList = (Array.isArray(raw.services) ? raw.services : []) as Array<Record<string, unknown>>;
  const isMultiSvc = svcList.length > 1;
  const svcEntryName = (e: Record<string, unknown>) => {
    const d = (e.service_data ?? {}) as Record<string, unknown>;
    return String(d.name ?? d.service_name ?? e.service_name ?? '').trim();
  };
  const multiNames = isMultiSvc ? svcList.map(svcEntryName).filter(Boolean).join(' + ') : '';
  const multiDur   = isMultiSvc
    ? svcList.reduce((sum, e) => sum + (Number(e.duration_minutes ?? e.base_duration ?? (e.service_data as Record<string, unknown> | undefined)?.duration_minutes ?? 0) || 0), 0)
    : 0;
  const multiPrice = isMultiSvc ? svcList.reduce((sum, e) => sum + (Number(e.base_price ?? 0) || 0), 0) : 0;

  const durSvc    = isMultiSvc && multiDur > 0
    ? multiDur
    : Number(raw.duration_minutes ?? sd.duration_minutes ?? sd.base_duration ?? 0);
  const durAddons = Number(raw.addons_duration ?? 0);
  const durExtra  = Number(raw.extra_minutes ?? 0);
  const totalDur  = Number(raw.total_duration ?? (durSvc + durAddons + durExtra)) || (durSvc + durAddons + durExtra);

  const rawAddons = (Array.isArray(raw.addons) ? raw.addons : Array.isArray(raw.selected_addons) ? raw.selected_addons : []) as Array<Record<string, unknown>>;

    const isLoyaltyRaw = Boolean(
      String(raw.booking_type ?? '').toLowerCase() === 'loyalty' ||
      (raw.loyalty_data != null && Object.keys(raw.loyalty_data).length > 0)
    );
    const defaultChannel = isLoyaltyRaw ? 'ushspa' : 'ushdesk';

    return {
      id:                String(raw.id ?? ''),
      booking_number:    raw.booking_number ? String(raw.booking_number) : null,
      payment_number:    (raw.payment_number ?? pd.payment_number ?? pm.payment_number ?? null) as string | null,
      customer_name:     [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Customer',
      customer_phone:    (cd.phone_number ?? null) as string | null,
      customer_email:    (cd.email        ?? null) as string | null,
      branch_name:       String(bd.branch_name ?? bd.name ?? raw.branch_id ?? ''),
      service_name:      multiNames || String(sd.name ?? sd.service_name ?? ''),
      service_category:  String(sd.category ?? sd.service_category ?? ''),
      service_price:     isMultiSvc && multiPrice > 0 ? String(multiPrice) : String(sd.base_price ?? sd.arrangement_price ?? raw.base_price ?? '0'),
      arrangement_name:  (sad.arrangement_name ?? sad.room_name ?? null) as string | null,
      therapist_name:    primaryName,
      therapist_id:      raw.therapist_id ? String(raw.therapist_id) : (td.id || td.therapist_id ? String(td.id || td.therapist_id) : null),
      therapist_avatar:  primaryAvatar,
      secondary_therapist_name: secName,
      secondary_therapist_id: raw.secondary_therapist_id ? String(raw.secondary_therapist_id) : (std.id || std.therapist_id ? String(std.id || std.therapist_id) : null),
      secondary_therapist_avatar: secAvatar,
      secondary_therapist_data: (raw.secondary_therapist_data ?? null) as Record<string, unknown> | null,
      appointment_start: String(raw.appointment_start ?? ''),
      appointment_end:   String(raw.appointment_end   ?? ''),
      duration_minutes:  durSvc,
      addons_duration:   durAddons,
      extra_minutes:     durExtra,
      total_duration:    totalDur,
      price_for_extra_minutes: String(raw.price_for_extra_minutes ?? raw.extra_price ?? '0'),
      booking_type:      String(raw.booking_type      ?? 'branch'),
      status:            String(raw.status            ?? 'pending').toLowerCase(),
      payment_status:    String(raw.payment_status    ?? '').toLowerCase(),
      payment_gateway:   (pm.payment_gateway ?? pd.payment_gateway ?? raw.payment_gateway ?? null) as string | null,
      payment_provider:  (raw.payment_provider ?? pd.payment_provider ?? null) as string | null,
      payment_method:    (raw.payment_method ?? null) as string | null,
      payment_url:       (pd.payment_url     ?? pm.payment_url     ?? raw.payment_url ?? null) as string | null,
      payment_data:      (raw.payment_data ?? null) as Record<string, unknown> | null,
      channel:           String(raw.source || raw.payment_through || raw.booking_source || raw.channel || pm.payment_through || pd.payment_through || defaultChannel).trim(),
      source:            String(raw.source || raw.payment_through || raw.booking_source || raw.channel || pm.payment_through || pd.payment_through || defaultChannel).trim(),
      payment_through:   String(raw.source || raw.payment_through || raw.booking_source || raw.channel || pm.payment_through || pd.payment_through || defaultChannel).trim(),
      is_paid:           pm.is_paid === true || pd.is_paid === true || pd.status === 'success' || raw.payment_status === 'success' || raw.payment_status === 'rewarded' || raw.payment_status === 'paid',
      total_amount:      String(raw.total_amount ?? raw.total_price ?? (raw.pricing as any)?.total ?? (raw.pricing as any)?.total_price ?? (pd as any)?.total_amount ?? '0'),
      discount:          String(raw.discount ?? (raw.pricing as any)?.discount ?? (raw.pricing as any)?.discount_amount ?? (raw.pricing_details as any)?.discount ?? '0'),
      arrangement_price: String(raw.arrangement_price ?? (raw.pricing as any)?.arrangement_price ?? sd.arrangement_price ?? '0'),
      addon_price:       String(raw.addon_price ?? (raw.pricing as any)?.addon_price ?? '0'),
      total_price:       String(raw.total_price ?? raw.total_amount ?? (raw.pricing as any)?.total ?? '0'),
      currency:          String(raw.currency ?? (raw.pricing as any)?.currency ?? 'KWD'),
      created_at:        String(raw.created_at   ?? ''),
      created_by_user:   raw.created_by_user ? String(raw.created_by_user) : (raw.created_by ? String(raw.created_by) : null),
      created_by_user_data: (raw.created_by_user_data ?? null) as Record<string, unknown> | null,
      customer_notes:    (raw.customer_notes ?? raw.customer_message ?? raw.notes ?? (raw.customer_data as any)?.customer_notes ?? null) as string | null,
      addons:            rawAddons,
      services:          svcList,
      sessions:          (Array.isArray(raw.sessions) ? raw.sessions : []) as Array<Record<string, unknown>>,
      pricing:           (raw.pricing ?? raw.pricing_details ?? null) as Record<string, unknown> | null,
      course_data:       (raw.course_data ?? null) as Record<string, unknown> | null,
      raw,
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// Backends return timezone-aware instants (ISO-8601 with offset, rendered in +03:00).
// Always display them in Asia/Kuwait (business timezone), never in UTC or the
// browser timezone. Naive strings are treated as Kuwait wall-clock.
export function formatDateTime(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + '+03:00';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: KUWAIT_TZ,
  });
}

export function formatPaidTimestamp(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + '+03:00';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  // Format in user local timezone (e.g. Kuwait UTC+3) so 02:28 UTC shows as 05:28 AM
  return d.toLocaleString('en-US', { timeZone: KUWAIT_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(iso: string) {
  if (!iso) return '—';
  const s = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + '+03:00';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: KUWAIT_TZ,
  });
}

export function formatTime(iso: string) {
  if (!iso) return '';
  const s = iso.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + '+03:00';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: KUWAIT_TZ,
  });
}

const minutesToClock12 = (min: number) => {
  let h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

export function formatTimeRange(startIsoOrTime: string, endIsoOrTime?: string | null, durationMinutes?: number) {
  const startFmt = formatTime(startIsoOrTime);
  let endFmt = endIsoOrTime ? formatTime(endIsoOrTime) : '';
  if (!endFmt && startIsoOrTime && durationMinutes && durationMinutes > 0) {
    try {
      const startMin = parseClockToMinutes(startFmt || startIsoOrTime);
      if (typeof startMin === 'number' && !isNaN(startMin) && startMin >= 0) {
        endFmt = minutesToClock12(startMin + durationMinutes);
      }
    } catch {}
  }
  if (startFmt && endFmt && startFmt !== endFmt) {
    return `${startFmt} – ${endFmt}`;
  }
  return startFmt || '';
}
export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ── Style maps ─────────────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<string, string> = {
  confirmed:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  checked_in:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  refunded:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  pending:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  no_show:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  parked:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};
export const PAYMENT_STYLES: Record<string, string> = {
  success:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  refunded_with_points: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  partially_refunded: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  failed:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
export const STATUS_BAR: Record<string, string> = {
  confirmed:   'bg-blue-400',
  checked_in:  'bg-cyan-400',
  in_progress: 'bg-amber-400',
  completed:   'bg-emerald-400',
  cancelled:   'bg-red-400',
  refunded:    'bg-purple-400',
  pending:     'bg-amber-400',
  no_show:     'bg-slate-400',
  parked:      'bg-violet-400',
};
export const statusStyle  = (s: string) => STATUS_STYLES[s]  ?? 'bg-muted text-muted-foreground';
export const paymentStyle = (s: string) => PAYMENT_STYLES[s] ?? 'bg-muted text-muted-foreground';

export const PROGRESS_STAGES = [
  { key: 'confirmed', label: 'Confirmed', nextKey: 'checked_in', nextLabel: 'CheckedIn', nextReason: 'Customer Checked In' },
  { key: 'checked_in', label: 'CheckedIn', nextKey: 'in_progress', nextLabel: 'InProgress', nextReason: 'Service In Progress' },
  { key: 'in_progress', label: 'InProgress', nextKey: 'completed', nextLabel: 'Completed', nextReason: 'Service Completed' },
  { key: 'completed', label: 'Completed', nextKey: null, nextLabel: null, nextReason: null },
] as const;

export const STAGE_INDEX_MAP: Record<string, number> = {
  confirmed: 0,
  checked_in: 1,
  checkedin: 1,
  in_progress: 2,
  inprogress: 2,
  completed: 3,
};

// ── Sub-components ─────────────────────────────────────────────────────────────
export function CustomerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['from-sky-400 to-blue-500','from-violet-400 to-purple-500','from-rose-400 to-pink-500','from-emerald-400 to-teal-500','from-amber-400 to-orange-500'];
  const idx = name.charCodeAt(0) % colors.length;
  const sz = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={cn('shrink-0 rounded-xl bg-gradient-to-br font-bold text-white grid place-items-center', sz, colors[idx])}>
      {initials(name)}
    </div>
  );
}

export function DRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-bold text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

// ── Payment Provider Selector ─────────────────────────────────────────────────
// ── Payment Provider Selector ─────────────────────────────────────────────────
export const PAYMENT_PROVIDERS = [
  {
    id: 'knet',
    providerOption: 'KNET Card' as PaymentProviderOption,
    name: 'KNET Card',
    description: 'In-branch card machine',
    tag: 'POS Terminal',
    tagColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    borderColor: 'border-emerald-400',
    checkColor: 'text-emerald-500',
  },
  {
    id: 'paymentlink',
    providerOption: 'PaymentLink' as PaymentProviderOption,
    name: 'MyFatoorah PaymentLink',
    description: 'SMS / WhatsApp link',
    tag: 'Direct Link',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
  {
    id: 'deema',
    providerOption: 'Deema' as PaymentProviderOption,
    name: 'Deema',
    description: 'Buy now, pay later - Deema installment link',
    tag: 'BNPL',
    tagColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-border',
    checkColor: 'text-primary',
  },
  {
    id: 'boubyan_link',
    providerOption: 'Boubyan Link' as PaymentProviderOption,
    name: 'Boubyan Link',
    description: 'Pay via Boubyan Link & enter reference number',
    tag: 'Boubyan Link',
    tagColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    borderColor: 'border-emerald-400',
    checkColor: 'text-emerald-500',
  },
] as const;

export type ProviderId = typeof PAYMENT_PROVIDERS[number]['id'];

function PaymentProviderModal({
  booking,
  totalAmount,
  currency,
  selected,
  onSelect,
  onClose,
  onContinue,
}: {
  booking: Booking;
  totalAmount?: number;
  currency?: string;
  selected: ProviderId;
  onSelect: (p: ProviderId) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const selectedProvider = PAYMENT_PROVIDERS.find((p) => p.id === selected) || PAYMENT_PROVIDERS[0];
  const displayAmount = (typeof totalAmount === 'number' && !isNaN(totalAmount))
    ? totalAmount
    : (parseFloat(booking.total_amount) || 0);
  const displayCurrency = currency || booking.currency || 'KWD';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-primary shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CreditCard className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Step 1 of 2: Select Payment Method</p>
              <p className="text-sm font-bold text-foreground">
                {booking.customer_name} — {displayCurrency} {displayAmount.toFixed(3)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {selectedProvider.name}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Provider Grid */}
        <div className="p-6">
          <p className="text-xs text-muted-foreground mb-3.5 font-medium">
            Choose a payment provider/method below. You will then be prompted to attach the payment reference ID and scan or upload the receipt slip.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_PROVIDERS.map((provider) => {
              const isSelected = selected === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => onSelect(provider.id)}
                  onDoubleClick={onContinue}
                  className={cn(
                    'relative rounded-2xl border-2 bg-card p-4 text-left transition hover:shadow-md cursor-pointer',
                    isSelected ? `${provider.borderColor} shadow-sm bg-muted/20 ring-1 ring-primary/20` : 'border-border/50 hover:border-border',
                  )}
                >
                  {isSelected && (
                    <span className={cn('absolute top-3 right-3', provider.checkColor)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
                  <p className="font-bold text-sm text-foreground pr-5 leading-tight">{provider.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{provider.description}</p>
                  <span className={cn('mt-2.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold', provider.tagColor)}>
                    {provider.tag}
                  </span>
                </button>
              );
            })}
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
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer active:scale-95"
          >
            <span>{selected === 'paymentlink' || selected === 'deema' ? 'Continue to Create Payment Link' : 'Continue to Reference & Receipt'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function toHHMM(label: string): string {
  if (!label || typeof label !== 'string') return '00:00';
  const clean = label.trim();
  if (!clean) return '00:00';
  const parts = clean.split(' ');
  if (!parts[0] || !parts[0].includes(':')) return '00:00';
  const [hStr, mStr] = parts[0].split(':');
  const ampm = (parts[1] ?? '').toUpperCase();
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h) || isNaN(m)) return '00:00';
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesToSlotLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hd = h % 12 === 0 ? 12 : h % 12;
  return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeToMinutes(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const p = ampm[3].toUpperCase();
    if (p === 'AM' && h === 12) h = 0;
    if (p === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const clock = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const kuwaitHours = (d.getUTCHours() + 3) % 24;
      return kuwaitHours * 60 + d.getUTCMinutes();
    }
  } catch {}
  return null;
}

export interface SessionLockContext {
  sessionId?: string | null;
  sessionIndex?: number | null;
  therapistId?: string | null;
  therapistName?: string | null;
  startTime?: string | null;
  arrangementId?: string | null;
}

// ── Booking Detail Modal ───────────────────────────────────────────────────────
export function BookingDetailPopup({
  booking,
  onClose,
  onSuccess,
  lockContext,
}: {
  booking: Booking | null;
  onClose: () => void;
  onSuccess?: () => void;
  lockContext?: SessionLockContext | null;
}) {
  if (!booking) return null;
  return <BookingDetailPopupContent booking={booking} onClose={onClose} onSuccess={onSuccess} lockContext={lockContext} />;
}

function BookingDetailPopupContent({
  booking,
  onClose,
  onSuccess,
  lockContext,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess?: () => void;
  lockContext?: SessionLockContext | null;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'payment'>('details');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [receiptZoom, setReceiptZoom] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentRefModal, setShowPaymentRefModal] = useState(false);
  const [showMakePaymentModal, setShowMakePaymentModal] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('knet');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const selectedPaymentConfig = useMemo(() => {
    return PAYMENT_PROVIDERS.find((p) => p.id === selectedProviderId) || PAYMENT_PROVIDERS[0];
  }, [selectedProviderId]);

  const [extraTherapistProfiles, setExtraTherapistProfiles] = useState<Record<string, { name?: string; avatar?: string }>>({});
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showChangeTherapistModal, setShowChangeTherapistModal] = useState(false);
  const [changeTherapistTarget, setChangeTherapistTarget] = useState<'primary' | 'secondary'>('primary');

  // Session details popup + per-session therapist change
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionTherapistModal, setShowSessionTherapistModal] = useState(false);

  // Staged session modifications & edit session modal
  const [editingSessionIndex, setEditingSessionIndex] = useState<number | null>(null);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [stagedSessions, setStagedSessions] = useState<Record<string, unknown>[] | null>(null);
  const [isSavingSessions, setIsSavingSessions] = useState(false);
  const [saveSessionsError, setSaveSessionsError] = useState<string | null>(null);

  const openChangeTherapist = (slot: 'primary' | 'secondary' = 'primary') => {
    setChangeTherapistTarget(slot);
    setShowChangeTherapistModal(true);
  };
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState<Record<string, unknown> | null>(null);
  const [fetchedPaymentNumber, setFetchedPaymentNumber] = useState<string>('');
  const [courseSubscription, setCourseSubscription] = useState<Record<string, any> | null>(null);
  const [loadingCourseSubscription, setLoadingCourseSubscription] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [advancingStep, setAdvancingStep] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [markingNoShow, setMarkingNoShow] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);
  const [parking, setParking] = useState(false);
  const [parkError, setParkError] = useState<string | null>(null);

  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);
  const authPermissions = useAppSelector((s) => s.auth.permissions);
  const reduxToken = useAppSelector((s) => s.auth.token);
  const cleanToken = (reduxToken || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '')).replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const {
    canRescheduleBooking: hasReschedulePermission,
    canCancelBooking: hasCancelPermission,
    canMakePayment: hasPaymentPermission,
    canAdvanceBookingStatus: hasAdvanceStatusPermission,
    canMarkNoShowBooking: hasNoShowPermission,
    canPrintReceipt: hasPrintReceiptPermission,
  } = usePermissions();
  const cancellationEligibility = checkBookingCancellationEligibility(detail || booking, roleInfo, user);
  const canCancel = cancellationEligibility.canCancel;

  // ── Role detection for Call Center Agent & Receptionist ──────────────
  const {
    isSuperuserOrAdmin,
    isCallCenterAgent,
    isReceptionist,
    isPaymentTabRestricted,
    rescheduleDaysCount,
    isPrivilegedCancelRole,
  } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;
    const candidates = [
      (roleInfo as any)?.role_code,
      roleInfo?.role_name,
      roleInfo?.role_description,
      u?.role,
      u?.role_name,
      u?.role_title,
      u?.position,
      u?.user_type,
    ]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().toLowerCase());

    const isSuperuserOrAdmin = Boolean(
      roleInfo?.is_superuser ||
      user?.user_type === 'admin' ||
      user?.user_type === 'administrator' ||
      (roleInfo?.role_name && ['admin', 'administrator', 'superuser'].includes(roleInfo.role_name.toLowerCase().trim()))
    );

    const userPerms = (authPermissions ?? []).map((p) => String(p).toLowerCase());

    const isAgent = candidates.some((c) =>
      c.includes('call center') ||
      c.includes('call_center') ||
      c.includes('callcenter')
    ) || userPerms.some((p) =>
      p.includes('call_center') ||
      p.includes('callcenter') ||
      p.includes('call center')
    );

    const isRecep = candidates.some((c) =>
      c.includes('receptionist') ||
      c.includes('reception') ||
      c.includes('front desk') ||
      c.includes('front_desk') ||
      c.includes('frontdesk')
    ) || userPerms.some((p) =>
      p.includes('receptionist') ||
      p.includes('reception') ||
      p.includes('front_desk') ||
      p.includes('frontdesk') ||
      p.includes('front desk')
    );

    const isManagerOrAdmin = isSuperuserOrAdmin || candidates.some((c) =>
      c.includes('admin') ||
      c.includes('manager') ||
      c.includes('director') ||
      c.includes('finance')
    );

    const isPrivilegedCancelRole = Boolean(
      isSuperuserOrAdmin ||
      candidates.some((c) =>
        c.includes('admin') ||
        c.includes('administrator') ||
        c.includes('spa director') ||
        c.includes('director') ||
        c.includes('finance manager') ||
        c.includes('finance')
      )
    );

    const isCallCenterOrReceptionist = !isManagerOrAdmin && (isAgent || isRecep);
    const rescheduleDaysCount = isCallCenterOrReceptionist ? 10 : 30;

    // Call Center Agent is permitted to view Payment & Invoices tab; Receptionist remains restricted
    const restricted = !isSuperuserOrAdmin && !isAgent && isRecep;

    return {
      isSuperuserOrAdmin,
      isCallCenterAgent: isAgent,
      isReceptionist: isRecep,
      isPaymentTabRestricted: restricted,
      rescheduleDaysCount,
      isPrivilegedCancelRole,
    };
  }, [user, roleInfo, authPermissions]);

  // Keep activeTab strictly on details when payment tab is restricted
  useEffect(() => {
    if (isPaymentTabRestricted && activeTab !== 'details') {
      setActiveTab('details');
    }
  }, [isPaymentTabRestricted, activeTab]);

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

  const apptDateTime =
    getBookingAppointmentDateTime(detail || booking) ||
    (booking?.raw ? getBookingAppointmentDateTime(booking.raw) : null) ||
    (booking?.appointment_start ? getBookingAppointmentDateTime(booking.appointment_start) : null);

  const rawEnd = (detail as any)?.appointment_end ?? booking?.appointment_end ?? (booking?.raw as any)?.appointment_end;
  const apptEndDateTime = (() => {
    if (rawEnd instanceof Date && !isNaN(rawEnd.getTime())) {
      return rawEnd;
    }
    if (rawEnd && typeof rawEnd === 'string' && rawEnd.trim()) {
      const parsed = getBookingAppointmentDateTime(rawEnd);
      if (parsed) return parsed;
    }
    if (apptDateTime) {
      const dur = Number(detail?.total_duration ?? booking?.total_duration ?? booking?.duration_minutes ?? 60);
      return new Date(apptDateTime.getTime() + dur * 60 * 1000);
    }
    return null;
  })();

  // 1. Reschedule is allowed max days_count (10 for Call Center Agent, Receptionist and 30 for Administrator, Finance Manager, Customer Support Manager, Spa Director etc)
  const rescheduleAllowedMs = rescheduleDaysCount * 24 * 60 * 60 * 1000;
  const isPastAllowedDaysFromApptStart = Boolean(
    apptDateTime && (Date.now() > apptDateTime.getTime() + rescheduleAllowedMs)
  );
  const RESCHEDULE_DAYS_REASON = `Reschedule is allowed only up to ${rescheduleDaysCount} days from the appointment start datetime.`;

  // Condition: current datetime + 6 hours is greater than booked appointment datetime
  const isCurrentPlus6HoursGreaterThanAppt = Boolean(
    apptDateTime && (Date.now() + SIX_HOURS_MS > apptDateTime.getTime())
  );
  const msUntilAppt = apptDateTime ? apptDateTime.getTime() - Date.now() : null;

  // For Call Center Agent: both cancel & reschedule are restricted if current datetime + 6h > booked appointment datetime
  const callCenterRescheduleBlocked = isCallCenterAgent && isCurrentPlus6HoursGreaterThanAppt;
  const callCenterCancelBlocked     = isCallCenterAgent && isCurrentPlus6HoursGreaterThanAppt;
  const AGENT_BLOCK_REASON = callCenterCancelBlocked && apptDateTime
    ? (msUntilAppt !== null && msUntilAppt > 0
        ? `Call Center Agents can only reschedule or cancel at least 6 hours before the appointment (appointment is in ${Math.max(0, msUntilAppt / (1000 * 60)).toFixed(0)} min).`
        : `Call Center Agents cannot reschedule or cancel past or immediate appointments.`)
    : null;

  // Reschedule restrictions: time-based restrictions removed as requested
  const canReschedule = true;
  const rescheduleBlockReason = undefined;

  // Combine existing cancel eligibility with Call Center restriction
  const effectiveCanCancel = canCancel && !callCenterCancelBlocked;

  // 2. If current datetime is greater than appointment_end + 3 hours dont show / hide "Mark Completed" button for employee role "Call Center Agent" and "Receptionist"
  const isPastApptEndPlus3Hours = Boolean(
    apptEndDateTime && (Date.now() > apptEndDateTime.getTime() + THREE_HOURS_MS)
  );
  const isCompleteRestrictedForRole =
    !isSuperuserOrAdmin &&
    (isCallCenterAgent || isReceptionist) &&
    isPastApptEndPlus3Hours;

  // 3. If current datetime is greater than appointment_end show a button "Mark No Show" for employee role "Administrator", "Branch Manager", "Finance Manager", "Spa Director"
  const isPastApptEnd = Boolean(
    apptEndDateTime && (Date.now() > apptEndDateTime.getTime())
  );

  const canMarkNoShow = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;
    if (roleInfo?.is_superuser || roleInfo?.is_branch_manager) return true;
    if (['admin', 'administrator', 'branch_manager'].includes((u?.user_type || '').toLowerCase().trim())) return true;

    const candidates = [
      (roleInfo as any)?.role_code,
      roleInfo?.role_name,
      roleInfo?.role_description,
      u?.role,
      u?.role_name,
      u?.role_title,
      u?.position,
      u?.user_type,
    ]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim().toLowerCase());

    const allowedPatterns = [
      'administrator',
      'admin',
      'branch manager',
      'branch_manager',
      'branch manger',
      'finance manager',
      'finance_manager',
      'spa director',
      'spa_director',
      'director',
      'call center',
      'call_center',
      'callcenter',
      'receptionist',
      'reception',
    ];

    const hasMatch = candidates.some((c) =>
      allowedPatterns.some((pattern) => c.includes(pattern) || pattern.includes(c))
    );
    if (hasMatch) return true;

    const userPerms = (authPermissions ?? []).map((p) => String(p).toLowerCase());
    return userPerms.some((p) =>
      p.includes('admin') ||
      p.includes('branch_manager') ||
      p.includes('finance_manager') ||
      p.includes('spa_director') ||
      p.includes('call_center') ||
      p.includes('callcenter') ||
      p.includes('receptionist') ||
      p.includes('reception')
    );
  }, [user, roleInfo, authPermissions]);

  useEffect(() => {
    if (!booking) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [booking, onClose]);

  const [rescheduleFetchState, setRescheduleFetchState] = useState<{
    params: {
      serviceId: string;
      arrangementType: string;
      branchId: string;
      appointmentDate: string;
      daysCount: number;
    };
    promise?: Promise<any>;
  } | null>(null);

  const handleOpenReschedule = useCallback(() => {
    if (!hasReschedulePermission || !booking) return;

    const rawBk = (detail || booking.raw || booking) as Record<string, any>;
    const sd = (rawBk.service_data || rawBk.service || {}) as Record<string, any>;
    const sad = (rawBk.service_arrangement_data || rawBk.arrangement || rawBk.service_arrangement || {}) as Record<string, any>;
    const bd = (rawBk.branch_data || rawBk.branch || {}) as Record<string, any>;

    const serviceId = String(
      rawBk.service_id ||
      sd.service_id ||
      sd.id ||
      (booking as any)?.service_id ||
      ''
    );
    const arrangementType = String(
      sad.arrangement_type ||
      sad.type ||
      rawBk.arrangement_type ||
      rawBk.room_type ||
      'room'
    );
    const branchId = String(
      rawBk.branch_id ||
      bd.branch_id ||
      bd.id ||
      (booking as any)?.branch_id ||
      ''
    );

    const apptStart = (detail?.appointment_start || booking?.appointment_start || rawBk.appointment_start || '') as string;
    // A parked booking has no live slot: availability must start from today, not from its old date
    const isParkedBooking = String(detail?.status ?? booking?.status ?? '').toLowerCase().replace(/[\s-]/g, '_') === 'parked';
    const appointmentDate = isParkedBooking
      ? kuwaitDateString()
      : apptStart
        ? (apptStart.includes('T') ? apptStart.split('T')[0] : apptStart.split(' ')[0])
        : String(rawBk.date || rawBk.booking_date || rawBk.appointment_date || kuwaitDateString());

    const daysCount = 30;

    const isUUID = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));
    const canFetch = isUUID(serviceId) && isUUID(branchId);

    // Send API request: /uauth/api/v1/find-availabilities-for-reschedule-appointment/?service_id=<service_id>&arrangement_type=<arrangement_type>&branch_id=<branch_id>&date=<current appointment booking date>&days_count=<days_count>
    const qs = new URLSearchParams({
      service_id: serviceId,
      arrangement_type: arrangementType,
      branch_id: branchId,
      date: appointmentDate,
      day_counts: String(daysCount),
      days_count: String(daysCount),
    });
    const endpoint = `/uauth/api/v1/find-availabilities-for-reschedule-appointment/?${qs.toString()}`;

    const fetchPromise = canFetch
      ? authedFetch(endpoint)
          .then((r) => r.json().catch(() => ({})))
          .catch((err) => {
            console.error('Error finding availabilities for reschedule:', err);
            return null;
          })
      : undefined;

    setRescheduleFetchState({
      params: {
        serviceId,
        arrangementType,
        branchId,
        appointmentDate,
        daysCount,
      },
      promise: fetchPromise,
    });

    // Window for reschedule appears
    setShowRescheduleModal(true);
  }, [hasReschedulePermission, detail, booking]);

  // Fetch full booking detail (addons, status_history, pricing breakdown) from backend
  const fetchDetail = useCallback(async (isManualRefresh = false) => {
    if (!booking?.id) {
      setDetail(null);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    setLoadingDetail(true);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`).then((r) => r.json());
      const fetchedDetail = (res?.success && res?.data)
        ? (res.data as Record<string, unknown>)
        : (res?.data as Record<string, unknown> | null);
      if (fetchedDetail) {
        setDetail(fetchedDetail);
        if (fetchedDetail.payment_number) {
          setFetchedPaymentNumber(String(fetchedDetail.payment_number));
        }
        const invNum = String(
          fetchedDetail.invoice_number ??
          fetchedDetail.invoice_id ??
          (fetchedDetail.pricing as any)?.invoice_number ??
          (fetchedDetail.pricing as any)?.invoice_id ??
          (fetchedDetail.payment_data as any)?.invoice_number ??
          (fetchedDetail.payment_data as any)?.invoice_id ??
          ''
        ).trim();
        if (invNum && invNum !== '—') {
          authedFetch(`/uanr/api/v1/invoices?search=${encodeURIComponent(invNum)}`)
            .then((r) => r.json())
            .then((invRes) => {
              const items = invRes?.data?.items ?? invRes?.items ?? (Array.isArray(invRes?.data) ? invRes.data : []);
              const found = items.find((i: Record<string, unknown>) => i.name === invNum || i.id === invNum || i.reference === invNum) || items[0];
              if (found) setInvoiceRecord(found);
            })
            .catch(() => {});
        }
      }
      if (isManualRefresh) {
        onSuccess?.();
      }
    } catch (err) {
      console.warn('[BookingDetailModal] fetch error:', err);
    } finally {
      if (isManualRefresh) setRefreshing(false);
      setLoadingDetail(false);
    }
  }, [booking?.id, onSuccess]);

  useEffect(() => {
    fetchDetail(false);
  }, [fetchDetail]);

  const handleRefresh = useCallback(() => {
    fetchDetail(true);
  }, [fetchDetail]);

  const rawBkObj = (detail || booking?.raw || {}) as Record<string, any>;

  const courseData = (
    detail?.course_data ||
    (booking as any)?.course_data ||
    (booking?.raw as any)?.course_data ||
    rawBkObj.course_data ||
    null
  ) as Record<string, any> | null;

  const courseSubscriptionId = String(
    courseData?.subscription_id ||
    (detail as any)?.course_subscription_id ||
    (booking?.raw as any)?.course_subscription_id ||
    (booking as any)?.course_subscription_id ||
    rawBkObj.course_subscription_id ||
    ''
  ).trim();

  const isCourseRedemption = Boolean(
    courseData ||
    courseSubscriptionId ||
    booking.payment_method === 'course_redemption' ||
    booking.payment_provider === 'course_redemption' ||
    rawBkObj.payment_method === 'course_redemption' ||
    rawBkObj.payment_type === 'course_redemption' ||
    rawBkObj.booking_type === 'course_redemption'
  );

  // Fetch course subscription for complete payment & session details
  useEffect(() => {
    if (!courseSubscriptionId) return;
    let cancelled = false;
    setLoadingCourseSubscription(true);
    authedFetch(`/booknpay/api/v1/course-subscriptions/${courseSubscriptionId}/`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const sub = res?.data ?? res;
        if (sub && (sub.id || sub.subscription_number)) {
          setCourseSubscription(sub);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCourseSubscription(false);
      });
    return () => { cancelled = true; };
  }, [courseSubscriptionId]);

  const courseCode = String(
    courseData?.course_code ||
    courseSubscription?.course_code ||
    courseSubscription?.course_data?.code ||
    ''
  ).trim();

  const courseName = String(
    courseData?.course_name ||
    courseSubscription?.course_name ||
    courseSubscription?.course_data?.name ||
    ''
  ).trim();

  const courseSubNumber = String(
    courseData?.subscription_number ||
    courseSubscription?.subscription_number ||
    ''
  ).trim();

  const currentSessionNumber = Number(
    courseData?.session_number ||
    (booking?.raw as any)?.session_number ||
    rawBkObj.session_number ||
    courseSubscription?.used_sessions ||
    1
  );

  const totalCourseSessions = Number(
    courseData?.total_sessions ||
    courseSubscription?.total_sessions ||
    0
  );

  const remainingCourseSessions = Number(
    courseData?.remaining_sessions ??
    courseSubscription?.available_sessions ??
    (totalCourseSessions > 0 ? Math.max(0, totalCourseSessions - currentSessionNumber) : 0)
  );

  const subPrice = String(
    courseData?.price ??
    courseSubscription?.price ??
    ''
  ).trim();

  const subCurrency = String(
    courseData?.currency ||
    courseSubscription?.currency ||
    booking.currency ||
    'KWD'
  ).trim();

  const subPaymentProvider = String(
    courseData?.payment_provider ||
    courseData?.payment_gateway ||
    courseSubscription?.payment_provider ||
    courseSubscription?.payment_gateway ||
    ''
  ).trim();

  const subPaymentMethod = String(
    courseData?.payment_method ||
    courseSubscription?.payment_method ||
    ''
  ).trim();

  const subPaymentNumber = String(
    courseData?.payment_number ||
    courseSubscription?.payment_number ||
    ''
  ).trim();

  const subTxRef = String(
    courseData?.transaction_reference ||
    courseSubscription?.transaction_reference ||
    ''
  ).trim();

  const subPaidAt = String(
    courseData?.activated_at ||
    courseData?.purchased_at ||
    courseSubscription?.activated_at ||
    courseSubscription?.purchased_at ||
    ''
  ).trim();

  const subInvoiceNumber = String(
    courseData?.invoice_number ||
    courseData?.invoice_id ||
    courseSubscription?.invoice_number ||
    courseSubscription?.invoice_id ||
    ''
  ).trim();

  const invoiceNumber = String(
    detail?.invoice_number ??
    detail?.invoice_id ??
    (detail?.pricing as any)?.invoice_number ??
    (detail?.pricing as any)?.invoice_id ??
    (detail?.payment_data as any)?.invoice_number ??
    (detail?.payment_data as any)?.invoice_id ??
    (detail?.voucher_data as any)?.invoice_number ??
    (detail?.voucher_data as any)?.invoice_id ??
    subInvoiceNumber ??
    (courseData as any)?.invoice_number ??
    (courseData as any)?.invoice_id ??
    (courseSubscription as any)?.invoice_number ??
    (courseSubscription as any)?.invoice_id ??
    (booking as any)?.invoice_number ??
    (booking as any)?.invoice_id ??
    (booking as any)?.payment_data?.invoice_id ??
    (booking as any)?.payment_data?.invoice_number ??
    (booking as any)?.voucher_data?.invoice_number ??
    (booking?.raw as any)?.invoice_number ??
    ''
  ).trim();

  const paymentNumber = String(
    (fetchedPaymentNumber || null) ??
    (detail as any)?.payment_number ??
    (detail?.payment_data as any)?.payment_number ??
    (detail?.payment_data as any)?.data?.InvoiceTransactions?.[0]?.PaymentId ??
    (detail?.voucher_data as any)?.payment_number ??
    (detail?.voucher_data as any)?.payment_data?.payment_number ??
    subPaymentNumber ??
    (courseData as any)?.payment_number ??
    (courseSubscription as any)?.payment_number ??
    (booking as any)?.payment_number ??
    (booking as any)?.payment_data?.payment_number ??
    (booking?.raw as any)?.payment_number ??
    (booking?.raw as any)?.payment_data?.payment_number ??
    (booking?.raw as any)?.payments_meta?.payment_number ??
    (booking?.raw as any)?.voucher_data?.payment_number ??
    ''
  ).trim();

  // Load payment detail from backend if payment number is not yet present
  useEffect(() => {
    if (paymentNumber || !booking?.id) return;
    let cancelled = false;
    authedFetch(`/booknpay/api/v1/payments/?booking_id=${booking.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        const pmt = items[0];
        if (pmt?.payment_number) {
          setFetchedPaymentNumber(String(pmt.payment_number));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [booking?.id, paymentNumber]);

  // Load invoice detail from backend if invoice number exists
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
        const found = items.find((i: Record<string, unknown>) => i.name === invoiceNumber || i.id === invoiceNumber || i.reference === invoiceNumber) || items[0];
        if (found) setInvoiceRecord(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoiceNumber]);

  // ── Dual therapist detection for couple room / double room ──
  const sadObj = (detail?.service_arrangement_data || (booking?.raw as any)?.service_arrangement_data || {}) as Record<string, any>;
  const arrType = String(
    sadObj.arrangement_type ||
    sadObj.type ||
    (detail as any)?.arrangement_type ||
    (booking?.raw as any)?.arrangement_type ||
    ''
  ).toLowerCase().trim().replace(/[\s-]+/g, '_');

  const arrName = String(
    booking?.arrangement_name ||
    sadObj.arrangement_name ||
    sadObj.name ||
    (detail as any)?.arrangement_name ||
    (booking?.raw as any)?.arrangement_name ||
    ''
  ).toLowerCase();

  // rawBkObj is defined above
  const isDualTherapistBooking =
    arrType === 'couple_room' ||
    arrType === 'double_room' ||
    arrName.includes('couple') ||
    arrName.includes('double') ||
    Boolean(detail?.secondary_therapist_id) ||
    Boolean(detail?.secondary_therapist_data) ||
    Boolean(rawBkObj.secondary_therapist_id) ||
    Boolean(rawBkObj.secondary_therapist_data) ||
    Boolean(booking?.secondary_therapist_id) ||
    Boolean(booking?.secondary_therapist_data);

  const t1Data = (detail?.therapist_data || (booking?.raw as any)?.therapist_data || (detail as any)?.therapist || (booking?.raw as any)?.therapist || {}) as Record<string, any>;
  const t2Data = (detail?.secondary_therapist_data || (booking?.raw as any)?.secondary_therapist_data || (detail as any)?.secondary_therapist || (booking?.raw as any)?.secondary_therapist || {}) as Record<string, any>;

  const primaryTherapistId = String(
    detail?.therapist_id ||
    (booking?.raw as any)?.therapist_id ||
    booking?.therapist_id ||
    t1Data.id ||
    t1Data.therapist_id ||
    ''
  ).trim();

  const secondaryTherapistId = String(
    detail?.secondary_therapist_id ||
    (booking?.raw as any)?.secondary_therapist_id ||
    booking?.secondary_therapist_id ||
    t2Data.id ||
    t2Data.therapist_id ||
    ''
  ).trim();

  const primaryTherapistName =
    extractTherapistName(t1Data, (detail as any)?.therapist_name, (booking?.raw as any)?.therapist_name ? { name: (booking?.raw as any).therapist_name } : undefined) ||
    (booking?.therapist_name && booking?.therapist_name !== '—' ? booking.therapist_name : '') ||
    extraTherapistProfiles[primaryTherapistId]?.name ||
    '—';

  const primaryTherapistImg =
    extractTherapistAvatar(t1Data, (detail as any)?.therapist_avatar, (booking?.raw as any)?.therapist_avatar ? { avatar: (booking?.raw as any).therapist_avatar } : undefined) ||
    booking?.therapist_avatar ||
    extraTherapistProfiles[primaryTherapistId]?.avatar ||
    '';

  const secondaryTherapistName =
    extractTherapistName(t2Data, (detail as any)?.secondary_therapist_name, (booking?.raw as any)?.secondary_therapist_name ? { name: (booking?.raw as any).secondary_therapist_name } : undefined) ||
    booking?.secondary_therapist_name ||
    extraTherapistProfiles[secondaryTherapistId]?.name ||
    '';

  const secondaryTherapistImg =
    extractTherapistAvatar(t2Data, (detail as any)?.secondary_therapist_avatar, (booking?.raw as any)?.secondary_therapist_avatar ? { avatar: (booking?.raw as any).secondary_therapist_avatar } : undefined) ||
    booking?.secondary_therapist_avatar ||
    extraTherapistProfiles[secondaryTherapistId]?.avatar ||
    '';

  // Background fetch to populate missing therapist profile / avatar (called unconditionally before early return)
  useEffect(() => {
    if (!booking) return;
    const idsToFetch: string[] = [];
    if (primaryTherapistId && (!primaryTherapistImg || primaryTherapistName === '—') && !extraTherapistProfiles[primaryTherapistId]) {
      idsToFetch.push(primaryTherapistId);
    }
    if (secondaryTherapistId && (!secondaryTherapistImg || !secondaryTherapistName) && !extraTherapistProfiles[secondaryTherapistId]) {
      idsToFetch.push(secondaryTherapistId);
    }
    if (idsToFetch.length === 0) return;

    let cancelled = false;
    idsToFetch.forEach((tId) => {
      authedFetch(`/uauth/api/v1/therapists/${tId}/`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const profile = (data.data || data) as Record<string, any>;
          const name = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.name || profile.therapist_name || '';
          const avatar = profile.avatar || profile.photo_url || profile.photo || (profile.employee as any)?.avatar || '';
          if (name || avatar) {
            setExtraTherapistProfiles((prev) => ({
              ...prev,
              [tId]: { name, avatar },
            }));
          }
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [booking, primaryTherapistId, secondaryTherapistId, primaryTherapistImg, primaryTherapistName, secondaryTherapistImg, secondaryTherapistName, extraTherapistProfiles]);

  const curStatus = String(detail?.status ?? booking.status ?? '').toLowerCase();
  const normStatus = curStatus.replace(/[\s-]/g, '_');
  const isNoShow =
    normStatus === 'no_show' ||
    String(booking.status ?? '').toLowerCase().replace(/[\s-]/g, '_') === 'no_show';
  const isCompleted = curStatus === 'completed';
  // Parked: paid booking whose appointment slot has been released
  const isParked = normStatus === 'parked';
  const isCancelled =
    curStatus === 'cancelled' ||
    curStatus === 'refunded' ||
    String(booking.status ?? '').toLowerCase() === 'cancelled' ||
    String(booking.status ?? '').toLowerCase() === 'refunded';
  const canChangeTherapist =
    !isParked &&
    !isPastApptEnd &&
    !isNoShow &&
    curStatus !== 'completed' &&
    curStatus !== 'no_show' &&
    curStatus !== 'cancelled' &&
    curStatus !== 'refunded' &&
    booking.status !== 'completed' &&
    booking.status !== 'no_show' &&
    booking.status !== 'cancelled' &&
    booking.status !== 'refunded' &&
    !isCompleted;
  const accentBar = isCompleted ? 'bg-[#7D6453]' : (STATUS_BAR[booking.status] ?? 'bg-slate-400');

  // Normalized payment status & isPaid determination
  const rawPaymentStatus = String(
    detail?.payment_status ??
    (detail as any)?.paymentStatus ??
    booking.payment_status ??
    ''
  ).toLowerCase().trim();

  // Bookings using loyalty points cannot be cancelled or refunded
  const isLoyaltyBooking = Boolean(
    String(detail?.booking_type ?? (booking.raw as any)?.booking_type ?? booking.booking_type ?? '').toLowerCase() === 'loyalty' ||
    Boolean(
      (detail?.loyalty_data && Object.keys(detail.loyalty_data).length > 0) ||
      ((booking.raw as any)?.loyalty_data && Object.keys((booking.raw as any).loyalty_data).length > 0) ||
      ((booking as any)?.loyalty_data && Object.keys((booking as any).loyalty_data).length > 0)
    )
  );

  const isRewarded = Boolean(
    rawPaymentStatus === 'rewarded' ||
    String(booking.payment_status ?? '').toLowerCase().trim() === 'rewarded' ||
    isLoyaltyBooking
  );

  const isRefunded =
    rawPaymentStatus === 'refunded' ||
    rawPaymentStatus === 'refunded_with_points' ||
    rawPaymentStatus === 'partially_refunded' ||
    booking.status === 'refunded' ||
    curStatus === 'refunded';

  const isPaid =
    !isRefunded && (
      booking.is_paid === true ||
      (detail as any)?.is_paid === true ||
      (booking.raw?.payments_meta as any)?.is_paid === true ||
      (booking.raw?.payment_data as any)?.is_paid === true ||
      rawPaymentStatus === 'success' ||
      rawPaymentStatus === 'paid' ||
      rawPaymentStatus === 'completed' ||
      isRewarded
    );

  // Whether payment is pending (not paid yet)
  const isPaymentPending = !isPaid && !isRefunded && !isRewarded && curStatus !== 'cancelled' && curStatus !== 'completed';

  // Payment is considered success if marked paid, success, or completed
  const isPaymentSuccess = Boolean(
    !isRefunded && (
      isPaid ||
      rawPaymentStatus === 'success' ||
      rawPaymentStatus === 'paid' ||
      rawPaymentStatus === 'completed' ||
      rawPaymentStatus === 'rewarded' ||
      isRewarded ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'success' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'paid' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'completed' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'rewarded' ||
      booking.is_paid === true ||
      (detail as any)?.is_paid === true
    )
  );

  const currentStageIndex = STAGE_INDEX_MAP[normStatus] ?? STAGE_INDEX_MAP[curStatus] ?? -1;
  const showStatusProgressBar = isPaymentSuccess && currentStageIndex >= 0;
  const currentStage = currentStageIndex >= 0 ? PROGRESS_STAGES[currentStageIndex] : null;

  // 1. If bookings status=payment_pending and appointment_end > current datetime add "Update" button in Booking Details popup window
  const isPaymentPendingStatus = curStatus === 'payment_pending' || booking.status === 'payment_pending';
  const isBeforeApptEnd = Boolean(apptEndDateTime && apptEndDateTime.getTime() > Date.now());

  // Show "Update" button if booking status=confirmed and payment_status=pending for changing booking details
  const isConfirmedStatus = curStatus === 'confirmed' || String(booking.status ?? '').toLowerCase().trim() === 'confirmed';
  const isPendingPayment =
    !isPaid &&
    !isPaymentSuccess &&
    (
      rawPaymentStatus === 'pending' ||
      rawPaymentStatus === 'payment_pending' ||
      rawPaymentStatus === 'unpaid' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'pending' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'payment_pending' ||
      String(booking.payment_status ?? '').toLowerCase().trim() === 'unpaid' ||
      isPaymentPending
    );

  // Cancel button rules:
  // Visible only if booking is not cancelled and user has permission.
  // All other conditions removed.
  // Bookings created by redeeming a gift voucher are already paid/gifted and cannot be cancelled here
  const isGiftVoucherBooking =
    String(detail?.payment_type ?? (booking.raw as any)?.payment_type ?? (booking as any)?.payment_type ?? '').toLowerCase() === 'gift_voucher' ||
    String(detail?.booking_type ?? (booking.raw as any)?.booking_type ?? booking.booking_type ?? '').toLowerCase() === 'gift_voucher' ||
    Boolean(detail?.voucher_id ?? (booking.raw as any)?.voucher_id ?? (booking as any)?.voucher_id);
  const canShowCancel = !isCancelled && hasCancelPermission && !isGiftVoucherBooking;

  // Unpaid booking: edit session icon only appears for unpaid bookings
  const isUnpaidBooking = !isPaymentSuccess && !isCancelled && !isCompleted;
  // Paid bookings: services may only be swapped for ones of the same price
  const isPaidEditableBooking = isPaymentSuccess && !isCancelled && !isCompleted;

  // ── Compute durations & amounts adding service + addons + extra minutes ─────
  const addons = (detail?.addons && Array.isArray(detail.addons) && detail.addons.length > 0)
    ? (detail.addons as Array<Record<string, unknown>>)
    : (booking.addons && booking.addons.length > 0)
    ? booking.addons
    : ((booking.raw?.selected_addons as Array<Record<string, unknown>>) ?? []);

  // Multi-service bookings: one entry per service (legacy bookings have no `services` array)
  const svcEntries = (Array.isArray(detail?.services) && (detail?.services as unknown[]).length > 0
    ? detail?.services
    : Array.isArray(booking.raw?.services) ? booking.raw.services : []) as Array<Record<string, unknown>>;
  const isMultiService = svcEntries.length > 1;
  const multiItems = isMultiService ? svcEntries.map(e => {
    const d = (e.service_data ?? {}) as Record<string, unknown>;
    return {
      name:     String(d.name ?? d.service_name ?? e.service_name ?? 'Service'),
      category: String(d.category ?? d.service_category ?? e.service_category ?? ''),
      price:    parseFloat(String(e.base_price ?? d.arrangement_price ?? d.base_price ?? '0')) || 0,
      duration: Number(e.duration_minutes ?? e.base_duration ?? d.duration_minutes ?? 0) || 0,
    };
  }) : [];
  const multiDurationSum = multiItems.reduce((sum, it) => sum + it.duration, 0);
  const multiPriceSum    = multiItems.reduce((sum, it) => sum + it.price, 0);

  const serviceDuration = isMultiService && multiDurationSum > 0
    ? multiDurationSum
    : Number(detail?.duration_minutes ?? booking.duration_minutes ?? 0);
  const addonsDuration  = Number(detail?.addons_duration  ?? booking.addons_duration  ?? 0);
  const extraMinutes    = Number(detail?.extra_minutes    ?? booking.extra_minutes    ?? 0);
  // ── Session-wise breakdown (matches attached session card design) ───────────
  const rawSessions = (
    stagedSessions !== null
      ? stagedSessions
      : (Array.isArray(detail?.sessions) && (detail?.sessions as unknown[]).length > 0
          ? detail?.sessions
          : (Array.isArray(booking.sessions) && booking.sessions.length > 0
            ? booking.sessions
            : (Array.isArray(booking.raw?.sessions) ? booking.raw.sessions : [])))
  ) as Array<Record<string, unknown>>;

  const stagedPriceSum = stagedSessions !== null
    ? stagedSessions.reduce((sum, s) => {
        const sServices = (Array.isArray(s.services) ? s.services : []) as Array<Record<string, unknown>>;
        const sSum = sServices.reduce((acc, sv) => acc + (parseFloat(String(sv.base_price ?? sv.price ?? 0)) || 0), 0);
        return sum + (sSum > 0 ? sSum : (parseFloat(String(s.session_price ?? s.services_price ?? 0)) || 0));
      }, 0)
    : null;

  const stagedDurationSum = stagedSessions !== null
    ? stagedSessions.reduce((sum, s) => {
        const sServices = (Array.isArray(s.services) ? s.services : []) as Array<Record<string, unknown>>;
        const sSum = sServices.reduce((acc, sv) => acc + (Number(sv.duration_minutes ?? sv.duration ?? 0) || 0), 0);
        return sum + (sSum > 0 ? sSum : (Number(s.total_session_duration ?? s.duration_minutes ?? 0) || 0));
      }, 0)
    : null;

  const pricingObj = (detail?.pricing ?? booking.pricing ?? booking.raw?.pricing_details) as Record<string, unknown> | undefined;

  const servicePrice = stagedPriceSum !== null
    ? stagedPriceSum
    : (isMultiService && multiPriceSum > 0
        ? multiPriceSum
        : parseFloat(String(pricingObj?.arrangement_price ?? pricingObj?.base_price ?? detail?.base_price ?? booking.service_price ?? '0')) || 0);

  // Aggregate add-ons / extra time across all sessions (fall back to booking-level data)
  const sessionsForTotals = rawSessions as Array<Record<string, any>>;
  const sessionAddonsAll = sessionsForTotals.flatMap((s) => (Array.isArray(s.addons) ? s.addons : [])) as Array<Record<string, any>>;
  const effAddons = (sessionAddonsAll.length > 0 ? sessionAddonsAll : addons) as Array<Record<string, any>>;
  const effAddonsDuration = addonsDuration > 0 && sessionAddonsAll.length === 0
    ? addonsDuration
    : effAddons.reduce((sum, a) => sum + (Number(a.duration_minutes ?? a.duration ?? 0) || 0), 0);
  const sessExtraMinutes = sessionsForTotals.reduce((sum, s) => sum + (Number(s.extra_minutes ?? 0) || 0), 0);
  const effExtraMinutes = sessExtraMinutes > 0 ? sessExtraMinutes : extraMinutes;
  const sessExtraPrice = sessionsForTotals.reduce((sum, s) => sum + (parseFloat(String(s.price_for_extra_minutes ?? s.extra_price ?? 0)) || 0), 0);

  const totalDuration = stagedDurationSum !== null
    ? (stagedDurationSum + effAddonsDuration + effExtraMinutes)
    : (serviceDuration + effAddonsDuration + effExtraMinutes) || Number(detail?.total_duration ?? booking.total_duration ?? serviceDuration);

  const serviceItems = isMultiService
    ? multiItems
    : [{ name: booking.service_name, category: booking.service_category, price: servicePrice, duration: serviceDuration }];

  const addonsPriceFromList = effAddons.reduce((sum, a) => sum + (parseFloat(String(a.price ?? a.base_price ?? '0')) || 0), 0);
  const addonsPrice = parseFloat(String(pricingObj?.addon_price ?? pricingObj?.addons_price ?? detail?.addons_price ?? (addonsPriceFromList > 0 ? addonsPriceFromList : '0'))) || 0;

  const extraPrice = sessExtraPrice > 0
    ? sessExtraPrice
    : (parseFloat(String(pricingObj?.price_for_extra_minutes ?? pricingObj?.extra_price ?? detail?.price_for_extra_minutes ?? booking.price_for_extra_minutes ?? '0')) || 0);

  const rawDiscount = parseFloat(String(pricingObj?.discount ?? pricingObj?.discount_amount ?? detail?.discount ?? booking.discount ?? (booking as any)?.discount ?? (booking.raw as any)?.discount ?? '0')) || 0;
  const subtotalPrice = servicePrice + addonsPrice + extraPrice;
  // Retain only genuine discount previously applied to the booking; do not synthesize or increase discount for new services
  const discountAmount = rawDiscount > 0 ? rawDiscount : 0;
  const computedTotal = Math.max(0, subtotalPrice - discountAmount);
  const currency = booking.currency || 'KWD';

  const displaySessions = (() => {
    if (rawSessions.length > 0) {
      return rawSessions.map((s, idx) => {
        const sArrData = (s.service_arrangement_data ?? {}) as Record<string, unknown>;
        const sTherapistData = (s.therapist_data ?? {}) as Record<string, unknown>;
        const sSecTherapistData = (s.secondary_therapist_data ?? {}) as Record<string, unknown>;

        // 1. Resolve session services (fall back to matching by session_id or position in booking.services)
        let sServices = (Array.isArray(s.services) ? s.services : []) as Array<Record<string, unknown>>;
        if (sServices.length === 0) {
          const allSvcs = (
            (Array.isArray(detail?.services) ? detail?.services : null) ||
            (Array.isArray(booking.services) ? booking.services : null) ||
            (Array.isArray(booking.raw?.services) ? booking.raw?.services : null) ||
            []
          ) as Array<Record<string, unknown>>;
          if (s.session_id) {
            sServices = allSvcs.filter(sv => String(sv.session_id) === String(s.session_id));
          }
          if (sServices.length === 0 && allSvcs.length > idx) {
            sServices = [allSvcs[idx]];
          }
        }

        // 2. Extract service name(s) specifically for THIS session
        const sServiceNames = sServices.map((sv) => {
          const sd = (sv.service_data ?? {}) as Record<string, unknown>;
          return String(
            sv.name ??
            sv.service_name ??
            sd.name ??
            sd.service_name ??
            ''
          ).trim();
        }).filter(Boolean);

        const sName =
          (sServiceNames.length > 0 ? sServiceNames.join(' + ') : '') ||
          (typeof s.service_name === 'string' && s.service_name.trim() ? s.service_name.trim() : '') ||
          ((s.service_data as any)?.name ?? (s.service_data as any)?.service_name ?? '') ||
          (multiItems[idx]?.name ? multiItems[idx].name : '') ||
          (rawSessions.length === 1 ? (booking.service_name || 'Service') : `Session ${idx + 1}`);

        const sRoom =
          String(sArrData.name ?? sArrData.arrangement_name ?? s.service_arrangement_name ?? s.room_name ?? booking.arrangement_name ?? 'Single Room').trim() ||
          'Single Room';

        const sTherapist =
          extractTherapistName(sTherapistData, s.therapist_name as string) ||
          primaryTherapistName ||
          booking.therapist_name ||
          '—';

        const sSecTherapist =
          extractTherapistName(sSecTherapistData, s.secondary_therapist_name as string) ||
          null;

        const sStart = String(s.appointment_start ?? s.appointment_time ?? (idx === 0 ? booking.appointment_start : '') ?? '');
        const sEnd = String(s.appointment_end ?? s.appointment_endtime ?? '');

        const sDur = Number(
          s.total_session_duration ??
          s.duration_minutes ??
          s.services_duration ??
          (sServices[0]?.duration_minutes || sServices[0]?.base_duration) ??
          60
        );

        const timeRange = formatTimeRange(sStart, sEnd, sDur);
        const timeLabel = timeRange ? `${timeRange} (${sDur} min)` : `${sDur} min`;

        const sServicesPriceSum = sServices.reduce(
          (acc, sv) => acc + (parseFloat(String(sv.base_price ?? sv.price ?? 0)) || 0),
          0
        );

        const sPrice = parseFloat(
          String(
            s.session_price ??
            s.services_price ??
            (sServicesPriceSum > 0 ? sServicesPriceSum : null) ??
            sServices[0]?.base_price ??
            sServices[0]?.arrangement_price ??
            sServices[0]?.price ??
            '0'
          )
        ) || 0;

        return {
          id: String(s.session_id ?? `session_${idx}`),
          position: typeof s.position === 'number' ? s.position : idx,
          number: idx + 1,
          serviceName: String(sName).toUpperCase(),
          roomName: sRoom,
          therapistName: sTherapist,
          secondaryTherapistName: sSecTherapist,
          timeLabel,
          price: sPrice,
          raw: { ...s, services: sServices } as Record<string, unknown> | null,
          durationMin: sDur,
          rangeLabel: timeRange,
        };
      });
    }

    if (isMultiService && multiItems.length > 0) {
      let cumulativeOffset = 0;
      return multiItems.map((it, idx) => {
        const itemDur = it.duration || serviceDuration || 60;
        let itemStart = booking.appointment_start;
        try {
          const bMin = parseClockToMinutes(formatTime(booking.appointment_start));
          if (typeof bMin === 'number' && !isNaN(bMin) && bMin >= 0) {
            itemStart = minutesToClock12(bMin + cumulativeOffset);
          }
        } catch {}
        cumulativeOffset += itemDur;
        return {
          id: `ms_${idx}`,
          position: idx,
          number: idx + 1,
          serviceName: String(it.name).toUpperCase(),
          roomName: booking.arrangement_name || 'Single Room',
          therapistName: primaryTherapistName !== '—' ? primaryTherapistName : booking.therapist_name,
          secondaryTherapistName: secondaryTherapistName || null,
          timeLabel: `${formatTimeRange(itemStart, null, itemDur)} (${itemDur} min)`,
          price: it.price,
          raw: null as Record<string, unknown> | null,
          durationMin: itemDur,
          rangeLabel: formatTimeRange(itemStart, null, itemDur),
        };
      });
    }

    const singleDur = totalDuration || serviceDuration || 60;
    return [{
      id: 'single_session',
      position: 0,
      number: 1,
      serviceName: String(booking.service_name || 'Service').toUpperCase(),
      roomName: booking.arrangement_name || 'Single Room',
      therapistName: primaryTherapistName !== '—' ? primaryTherapistName : booking.therapist_name,
      secondaryTherapistName: secondaryTherapistName || null,
      timeLabel: `${formatTimeRange(booking.appointment_start, booking.appointment_end, singleDur)} (${singleDur} min)`,
      price: servicePrice > 0 ? servicePrice : computedTotal,
      raw: null as Record<string, unknown> | null,
      durationMin: singleDur,
      rangeLabel: formatTimeRange(booking.appointment_start, booking.appointment_end, singleDur),
    }];
  })();

  // Add-ons / extra time per session (fall back to booking-level data for single-session bookings)
  const getSessionAddons = (raw: Record<string, any> | null | undefined): Array<Record<string, any>> => {
    if (Array.isArray(raw?.addons) && raw!.addons.length > 0) return raw!.addons;
    return displaySessions.length === 1 ? (addons as Array<Record<string, any>>) : [];
  };
  const getSessionExtraMinutes = (raw: Record<string, any> | null | undefined): number => {
    const v = Number(raw?.extra_minutes ?? 0);
    if (v > 0) return v;
    return displaySessions.length === 1 ? Number(extraMinutes) || 0 : 0;
  };

  // Detect whether this booking is for a package (multiple services bundled under a package price)
  const packageInfo = useMemo(() => {
    const isTruthyFlag = (v: unknown): boolean =>
      v === true || String(v ?? '').trim().toLowerCase() === 'true' || v === 1 || String(v ?? '').trim() === '1';

    const allSessionSvcEntries = rawSessions.flatMap((s) =>
      (Array.isArray(s.services) ? s.services : []) as Array<Record<string, unknown>>
    );
    const allEntries = [...svcEntries, ...allSessionSvcEntries];

    let pkgId = '';
    let pkgName = '';
    let hasPkgMeta = false;

    for (const e of allEntries) {
      const sd = (e.service_data ?? {}) as Record<string, unknown>;
      const pId = e.package_id ?? sd.package_id;
      const pName = e.package_name ?? sd.package_name;
      const isPkgSvc = isTruthyFlag(e.is_packaged_services ?? sd.is_packaged_services ?? e.is_packaged ?? sd.is_packaged);
      if (pId || pName || isPkgSvc) {
        hasPkgMeta = true;
        if (!pkgId && typeof pId === 'string' && pId.trim()) {
          pkgId = pId.trim();
        }
        if (!pkgName && typeof pName === 'string' && pName.trim()) {
          pkgName = pName.trim();
        }
      }
    }

    const detailSd = ((detail?.service_data ?? booking.raw?.service_data) ?? {}) as Record<string, unknown>;
    const voucherData = ((detail?.voucher_data ?? (booking.raw as any)?.voucher_data) ?? {}) as Record<string, unknown>;
    if (
      isTruthyFlag((detail as any)?.is_packaged_services) ||
      isTruthyFlag((booking.raw as any)?.is_packaged_services) ||
      isTruthyFlag(detailSd.is_packaged_services) ||
      isTruthyFlag(detailSd.is_packaged) ||
      isTruthyFlag(voucherData.is_package) ||
      Boolean((detail as any)?.package_id || (booking.raw as any)?.package_id || detailSd.package_id)
    ) {
      hasPkgMeta = true;
    }

    if (!pkgId) {
      const candidateId =
        voucherData.package_id ??
        (detail as any)?.package_id ??
        (booking.raw as any)?.package_id ??
        detailSd.package_id ??
        '';
      if (typeof candidateId === 'string' && candidateId.trim()) {
        pkgId = candidateId.trim();
      }
    }

    if (!pkgName) {
      const candidateName =
        voucherData.package_name ??
        (detail as any)?.package_name ??
        (booking.raw as any)?.package_name ??
        detailSd.package_name ??
        '';
      if (typeof candidateName === 'string' && candidateName.trim()) {
        pkgName = candidateName.trim();
      }
    }

    // Also detect multi-service / multi-session package carrier pricing pattern
    // (where the first component carries the package price > 0 and subsequent component(s) have 0 price)
    const hasCarrierZeroPricePattern =
      !isCourseRedemption &&
      ((multiItems.length > 1 && multiItems.some((it) => it.price > 0) && multiItems.some((it) => it.price === 0)) ||
        (displaySessions.length > 1 && displaySessions.some((s) => s.price > 0) && displaySessions.some((s) => s.price === 0)));

    const isPackage = hasPkgMeta || hasCarrierZeroPricePattern;

    return {
      isPackage,
      packageId: pkgId || null,
      packageName: pkgName || null,
    };
  }, [rawSessions, svcEntries, detail, booking.raw, isCourseRedemption, multiItems, displaySessions]);

  const isPackageBooking = packageInfo.isPackage;
  const packageName = packageInfo.packageName;
  const effectivePackagePrice =
    servicePrice > 0
      ? servicePrice
      : parseFloat(
          String(
            (detail?.voucher_data as any)?.package_price ??
            (booking.raw as any)?.voucher_data?.package_price ??
            (detail?.voucher_data as any)?.total_amount ??
            detail?.total_amount ??
            booking.total_amount ??
            '0'
          )
        ) || 0;

  const receiptServices = useMemo(() => {
    if (displaySessions.length > 0) {
      const items: Array<{
        name: string;
        category?: string | null;
        price: number;
        duration: number;
        therapistName?: string | null;
        secondaryTherapistName?: string | null;
        arrangementName?: string | null;
      }> = [];

      displaySessions.forEach((sess) => {
        const rawSvcs = Array.isArray(sess.raw?.services) ? (sess.raw?.services as Array<Record<string, any>>) : [];
        const tName = sess.therapistName && sess.therapistName !== '—' ? sess.therapistName : null;
        const secTName = sess.secondaryTherapistName && sess.secondaryTherapistName !== '—' ? sess.secondaryTherapistName : null;
        const arrName = sess.roomName && sess.roomName !== '—' ? sess.roomName : null;

        if (rawSvcs.length > 1) {
          rawSvcs.forEach((sv) => {
            const sd = (sv.service_data ?? {}) as Record<string, any>;
            const svName = String(sv.service_name ?? sv.name ?? sd.name ?? sd.service_name ?? sess.serviceName ?? 'Service').trim();
            const svPrice = parseFloat(String(sv.base_price ?? sv.arrangement_price ?? sv.price ?? sd.base_price ?? '0')) || 0;
            const svDur = Number(sv.duration_minutes ?? sv.base_duration ?? sd.duration_minutes ?? 0) || 0;
            items.push({
              name: svName,
              category: String(sd.category ?? sv.service_category ?? ''),
              price: svPrice,
              duration: svDur,
              therapistName: tName,
              secondaryTherapistName: secTName,
              arrangementName: arrName,
            });
          });
        } else {
          items.push({
            name: sess.serviceName,
            category: booking.service_category,
            price: sess.price,
            duration: sess.durationMin,
            therapistName: tName,
            secondaryTherapistName: secTName,
            arrangementName: arrName,
          });
        }
      });
      return items;
    }

    return serviceItems.map((it) => ({
      name: it.name,
      category: it.category,
      price: it.price,
      duration: it.duration,
      therapistName: primaryTherapistName !== '—' ? primaryTherapistName : booking.therapist_name,
      secondaryTherapistName: secondaryTherapistName || null,
      arrangementName: booking.arrangement_name,
    }));
  }, [displaySessions, serviceItems, booking.service_category, booking.therapist_name, booking.arrangement_name, primaryTherapistName, secondaryTherapistName]);

  const canAddSession = !isCancelled && !isCompleted && !isPaymentSuccess && displaySessions.length < 3;

  // Determine which session(s) are unlocked when opened from a specific schedule block
  const unlockedSessionIndices = useMemo(() => {
    const set = new Set<number>();
    if (!lockContext || displaySessions.length <= 1) return set;

    const targetSessId = String(lockContext.sessionId ?? '').toLowerCase().trim();
    const targetTid = String(lockContext.therapistId ?? '').toLowerCase().trim();
    const targetTName = String(lockContext.therapistName ?? '').toLowerCase().trim();
    const targetArrId = String(lockContext.arrangementId ?? '').toLowerCase().trim();
    const targetStartMin = lockContext.startTime ? parseTimeToMinutes(lockContext.startTime) : null;

    const matchesTime = (s: (typeof displaySessions)[number]) => {
      if (targetStartMin === null) return false;
      const sStart = s.raw?.appointment_start ?? s.raw?.appointment_time ?? s.raw?.start;
      const sMin = parseTimeToMinutes(sStart);
      if (sMin !== null && sMin === targetStartMin) return true;
      const sDur = Number(s.durationMin || 60);
      if (sMin !== null && targetStartMin >= sMin && targetStartMin < sMin + sDur) return true;
      return false;
    };

    // 1. Exact session_id match
    if (targetSessId && targetSessId !== String(booking.id).toLowerCase().trim()) {
      displaySessions.forEach((s, idx) => {
        const sId = String(s.raw?.session_id ?? s.raw?.id ?? s.id ?? '').toLowerCase().trim();
        if (sId && sId === targetSessId) {
          set.add(idx);
        }
      });
      if (set.size > 0) return set;
    }

    // 2. Therapist ID match (with time refinement if same therapist is in multiple sessions)
    if (targetTid) {
      const tidMatches: number[] = [];
      displaySessions.forEach((s, idx) => {
        const pId = String(
          s.raw?.therapist_id ??
          (s.raw?.therapist_data as any)?.id ??
          (s.raw?.therapist_data as any)?.therapist_id ??
          ''
        ).toLowerCase().trim();
        const secId = String(
          s.raw?.secondary_therapist_id ??
          (s.raw?.secondary_therapist_data as any)?.id ??
          (s.raw?.secondary_therapist_data as any)?.therapist_id ??
          ''
        ).toLowerCase().trim();
        if ((pId && pId === targetTid) || (secId && secId === targetTid)) {
          tidMatches.push(idx);
        }
      });
      if (tidMatches.length === 1) {
        set.add(tidMatches[0]);
        return set;
      }
      if (tidMatches.length > 1) {
        const timeRefined = tidMatches.filter((idx) => matchesTime(displaySessions[idx]));
        (timeRefined.length > 0 ? timeRefined : tidMatches).forEach((idx) => set.add(idx));
        return set;
      }
    }

    // 3. Therapist Name match (handles full name vs first name on schedule header)
    if (targetTName) {
      const targetFirst = targetTName.split(/\s+/)[0];
      const nameMatches: number[] = [];
      displaySessions.forEach((s, idx) => {
        const pName = String(s.therapistName ?? '').toLowerCase().trim();
        const secName = String(s.secondaryTherapistName ?? '').toLowerCase().trim();
        const pFirst = pName.split(/\s+/)[0];
        const secFirst = secName.split(/\s+/)[0];
        const isMatch =
          (pName && (pName === targetTName || pName.startsWith(targetTName + ' ') || targetTName.startsWith(pName + ' ') || (targetFirst.length >= 2 && pFirst === targetFirst))) ||
          (secName && (secName === targetTName || secName.startsWith(targetTName + ' ') || targetTName.startsWith(secName + ' ') || (targetFirst.length >= 2 && secFirst === targetFirst)));
        if (isMatch) {
          nameMatches.push(idx);
        }
      });
      if (nameMatches.length === 1) {
        set.add(nameMatches[0]);
        return set;
      }
      if (nameMatches.length > 1) {
        const timeRefined = nameMatches.filter((idx) => matchesTime(displaySessions[idx]));
        (timeRefined.length > 0 ? timeRefined : nameMatches).forEach((idx) => set.add(idx));
        return set;
      }
    }

    // 4. Arrangement ID match (for Room Schedule)
    if (targetArrId) {
      const arrMatches: number[] = [];
      displaySessions.forEach((s, idx) => {
        const aId = String(
          s.raw?.service_arrangement_id ??
          (s.raw?.service_arrangement_data as any)?.id ??
          (s.raw?.service_arrangement_data as any)?.arrangement_id ??
          ''
        ).toLowerCase().trim();
        if (aId && aId === targetArrId) {
          arrMatches.push(idx);
        }
      });
      if (arrMatches.length === 1) {
        set.add(arrMatches[0]);
        return set;
      }
      if (arrMatches.length > 1) {
        const timeRefined = arrMatches.filter((idx) => matchesTime(displaySessions[idx]));
        (timeRefined.length > 0 ? timeRefined : arrMatches).forEach((idx) => set.add(idx));
        return set;
      }
    }

    // 5. Fallback to explicit sessionIndex or startTime
    if (typeof lockContext.sessionIndex === 'number' && displaySessions[lockContext.sessionIndex]) {
      set.add(lockContext.sessionIndex);
      return set;
    }
    if (targetStartMin !== null) {
      displaySessions.forEach((s, idx) => {
        if (matchesTime(s)) set.add(idx);
      });
    }

    return set;
  }, [lockContext, displaySessions, booking.id]);

  const bookingDate = useMemo(() => {
    const raw = detail?.appointment_date || (booking as any)?.appointment_date || (booking as any)?.date || booking.appointment_start;
    if (raw) return String(raw).split('T')[0];
    return kuwaitDateString();
  }, [detail, booking]);

  const lastSess = displaySessions.length > 0 ? displaySessions[displaySessions.length - 1] : null;
  const defTherapistId = String(
    lastSess?.raw?.therapist_id ||
    (lastSess?.raw?.therapist_data as any)?.id ||
    booking.therapist_id ||
    detail?.therapist_id ||
    ''
  );
  const defTherapistName = String(
    lastSess?.therapistName ||
    booking.therapist_name ||
    detail?.therapist_name ||
    'Therapist'
  );

  const nextSessionDefaultTimeSlot = useMemo(() => {
    if (!lastSess) return '09:00 AM';
    const sStart = String(lastSess.raw?.appointment_start ?? lastSess.raw?.appointment_time ?? (displaySessions.length === 1 ? booking.appointment_start : '') ?? '');
    const sDur = Number(lastSess.raw?.total_session_duration ?? lastSess.raw?.duration_minutes ?? 60);
    const sEnd = String(lastSess.raw?.appointment_end ?? '');
    const endMin = parseTimeToMinutes(sEnd) ?? ((parseTimeToMinutes(sStart) ?? 600) + sDur);
    return minutesToSlotLabel(endMin);
  }, [lastSess, displaySessions.length, booking.appointment_start]);

  const nextSessionMinStartMinutes = useMemo(() => {
    if (!lastSess) return undefined;
    const sStart = String(lastSess.raw?.appointment_start ?? lastSess.raw?.appointment_time ?? (displaySessions.length === 1 ? booking.appointment_start : '') ?? '');
    const sDur = Number(lastSess.raw?.total_session_duration ?? lastSess.raw?.duration_minutes ?? 60);
    const sEnd = String(lastSess.raw?.appointment_end ?? '');
    return parseTimeToMinutes(sEnd) ?? ((parseTimeToMinutes(sStart) ?? 600) + sDur);
  }, [lastSess, displaySessions.length, booking.appointment_start]);

  // ── History & Creator & Payment references ──────────────────────────
  const historyList = (detail?.status_history && Array.isArray(detail.status_history))
    ? (detail.status_history as Array<Record<string, unknown>>)
    : [];

  const rawCreatorObj =
    detail?.created_by_user_data ??
    booking.created_by_user_data ??
    booking.raw?.created_by_user_data ??
    (detail as any)?.created_by_data ??
    (booking.raw as any)?.created_by_data ??
    (detail as any)?.creator ??
    (booking.raw as any)?.creator;

  const createdByUserObj: Record<string, unknown> | null = (() => {
    if (!rawCreatorObj) return null;
    if (typeof rawCreatorObj === 'object') return rawCreatorObj as Record<string, unknown>;
    if (typeof rawCreatorObj === 'string') {
      try {
        const parsed = JSON.parse(rawCreatorObj);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      } catch {
        return { name: rawCreatorObj };
      }
    }
    return null;
  })();

  const createdByUserName = (
    (createdByUserObj?.full_name as string) ||
    [createdByUserObj?.first_name, createdByUserObj?.last_name].filter(Boolean).join(' ') ||
    (createdByUserObj?.name as string) ||
    (createdByUserObj?.username as string) ||
    ((detail as any)?.created_by_name as string) ||
    ((booking as any)?.created_by_name as string) ||
    (typeof booking.created_by_user === 'string' && !/^[0-9a-f-]{10,}$/i.test(booking.created_by_user) ? booking.created_by_user : '') ||
    ''
  ).trim();

  const createdByUserRole = (
    (createdByUserObj?.role as string) ||
    (createdByUserObj?.role_name as string) ||
    (createdByUserObj?.role_title as string) ||
    ((createdByUserObj?.role_info as any)?.role_name as string) ||
    ((createdByUserObj?.roleInfo as any)?.role_name as string) ||
    (createdByUserObj?.position as string) ||
    ((detail as any)?.created_by_role as string) ||
    ((detail as any)?.created_by_user_role as string) ||
    ((booking as any)?.created_by_role as string) ||
    ((booking as any)?.created_by_user_role as string) ||
    ((booking.raw as any)?.created_by_role as string) ||
    ((booking.raw as any)?.created_by_user_role as string) ||
    ''
  ).trim();

  const createdByUserType = (
    (createdByUserObj?.user_type as string) ||
    (createdByUserObj?.type as string) ||
    ((detail as any)?.created_by_user_type as string) ||
    ((booking as any)?.created_by_user_type as string) ||
    ((booking.raw as any)?.created_by_user_type as string) ||
    ''
  ).trim();

  const paymentDataObj   = (detail?.payment_data ?? booking.payment_data) as Record<string, unknown> | null;
  const paidTimestamp    = (paymentDataObj?.paid_at ?? paymentDataObj?.transaction_date ?? paymentDataObj?.created_date) as string | undefined;
  const rawPaymentUrl = detail?.payment_url ?? booking.payment_url ?? paymentDataObj?.payment_url;
  const effectivePaymentUrl = (rawPaymentUrl && rawPaymentUrl !== 'null' && rawPaymentUrl !== 'undefined') ? String(rawPaymentUrl).trim() : '';

  const receiptImg = String(
    (paymentDataObj as any)?.receipt_image ??
    (detail as any)?.receipt_image ??
    (booking as any).receipt_image ??
    ''
  ).trim();

  const transactionId = String(
    (paymentDataObj as any)?.transaction_id ??
    (paymentDataObj as any)?.reference_id ??
    (detail as any)?.transaction_id ??
    (detail as any)?.reference_id ??
    subTxRef ??
    (courseData as any)?.transaction_reference ??
    (courseSubscription as any)?.transaction_reference ??
    (booking as any).transaction_id ??
    (booking as any).reference_id ??
    ''
  ).trim();

  const traceId = String(
    (paymentDataObj as any)?.trace_id ??
    (detail as any)?.trace_id ??
    (booking as any).trace_id ??
    ''
  ).trim();

  const paymentProvider = String(
    isCourseRedemption
      ? (subPaymentProvider ? `${subPaymentProvider} (Course Subscription)` : 'Course Subscription')
      : (
          booking.payment_provider ||
          booking.payment_gateway ||
          (paymentDataObj as any)?.payment_provider ||
          (paymentDataObj as any)?.payment_gateway ||
          booking.payment_method ||
          'Front Desk'
        )
  ).trim();

  // Cancel booking — opens BookingCancellationModal which handles all accounting steps
  const handleCancel = () => {
    if (!booking || !canShowCancel) return;
    setShowCancellationModal(true);
  };

  const handlePrintReceipt = () => {
    setShowReceiptModal(true);
  };

  const handleAdvanceNextStep = async (targetStatus: string, reason: string | null) => {
    if (!booking || advancingStep) return;
    // Feedback prompt is offered only for the InProgress → Completed transition.
    const wasInProgress = normStatus === 'in_progress';
    setAdvancingStep(true);
    setAdvanceError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: reason || `Status updated to ${targetStatus}`,
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to update status (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        setDetail(json.data);
      } else {
        setDetail((prev) => (prev ? { ...prev, status: targetStatus } : { ...booking, status: targetStatus }));
      }
      onSuccess?.();
      if (wasInProgress && targetStatus === 'completed') setShowFeedbackPrompt(true);
    } catch (err: unknown) {
      console.error('[BookingDetailModal] Error advancing booking status:', err);
      setAdvanceError(err instanceof Error ? err.message : `Failed to update status to ${targetStatus}`);
    } finally {
      setAdvancingStep(false);
    }
  };

  const handleCompleteBooking = async () => {
    if (!booking || isPaymentPending || completing) return;
    const wasInProgress = normStatus === 'in_progress';
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          reason: 'Service Completed',
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to update status (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        setDetail(json.data);
      } else {
        setDetail((prev) => (prev ? { ...prev, status: 'completed' } : { ...booking, status: 'completed' }));
      }
      onSuccess?.();
      if (wasInProgress) setShowFeedbackPrompt(true);
    } catch (err: unknown) {
      console.error('[BookingDetailModal] Error completing booking:', err);
      setCompleteError(err instanceof Error ? err.message : 'Failed to update status to completed');
    } finally {
      setCompleting(false);
    }
  };

  // Park a paid booking: releases its appointment date/time so others can book it
  const canParkBooking =
    isPaymentSuccess && !isRewarded && normStatus === 'confirmed' && !isCancelled && !isCompleted && !isNoShow && hasReschedulePermission;

  const handleParkBooking = async () => {
    if (!booking || parking || !canParkBooking) return;
    const ok = typeof window === 'undefined' || window.confirm(
      'Park this booking? Its appointment date and time will be released for other customers. You can reschedule it later to assign a new date and time.'
    );
    if (!ok) return;
    setParking(true);
    setParkError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          status: 'parked',
          reason: 'Booking parked - appointment slot released',
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const d = err?.detail ?? err?.message;
        throw new Error(typeof d === 'string' ? d : `Failed to park booking (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        setDetail(json.data);
      } else {
        setDetail((prev) => (prev ? { ...prev, status: 'parked' } : { ...booking, status: 'parked' }));
      }
      onSuccess?.();
    } catch (err: unknown) {
      console.error('[BookingDetailModal] Error parking booking:', err);
      setParkError(err instanceof Error ? err.message : 'Failed to park booking');
    } finally {
      setParking(false);
    }
  };

  const handleMarkNoShow = async () => {
    if (!booking || markingNoShow || !isPaymentSuccess) return;
    setMarkingNoShow(true);
    setNoShowError(null);
    try {
      let statusToSend = 'no_show';
      let res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          status: statusToSend,
          reason: 'Customer No Show',
          source: 'ushdesk',
          changed_by: user?.name || user?.id || 'Staff',
          change_by_user: user?.name || user?.id || 'Staff',
          change_by_user_data: user
            ? {
                id: user.id,
                name: user.name,
                full_name: user.name,
                first_name: user.name.split(' ')[0] || user.name,
                last_name: user.name.split(' ').slice(1).join(' ') || '',
                email: user.email,
                phone_number: user.phone_number,
                role: user.user_type,
              }
            : undefined,
        }),
      });

      // Fallback retry with uppercase 'NO_SHOW' if backend strictly expects uppercase
      if (!res.ok && res.status === 400) {
        const retryRes = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            status: 'NO_SHOW',
            reason: 'Customer No Show',
            source: 'ushdesk',
            changed_by: user?.name || user?.id || 'Staff',
            change_by_user: user?.name || user?.id || 'Staff',
            change_by_user_data: user
              ? {
                  id: user.id,
                  name: user.name,
                  full_name: user.name,
                  first_name: user.name.split(' ')[0] || user.name,
                  last_name: user.name.split(' ').slice(1).join(' ') || '',
                  email: user.email,
                  phone_number: user.phone_number,
                  role: user.user_type,
                }
              : undefined,
          }),
        });
        if (retryRes.ok) {
          res = retryRes;
          statusToSend = 'NO_SHOW';
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to update status to No Show (${res.status})`);
      }
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        setDetail(json.data);
      } else {
        setDetail((prev) => (prev ? { ...prev, status: statusToSend } : { ...booking, status: statusToSend }));
      }
      onSuccess?.();
    } catch (err: unknown) {
      console.error('[BookingDetailPopup] Error marking booking as no show:', err);
      setNoShowError(err instanceof Error ? err.message : 'Failed to update status to No Show');
    } finally {
      setMarkingNoShow(false);
    }
  };

  const handleUpdateSessionServices = useCallback((updatedServices: EditableServiceItem[], sessionIdx: number, updatedAddons: Array<Record<string, any>> = []) => {
    // Current base sessions list
    const base = rawSessions.length > 0
      ? rawSessions.map(s => ({ ...s }))
      : [{ ...(detail || {}), ...booking }];
    const targetSession: Record<string, any> = base[sessionIdx] ? { ...base[sessionIdx] } : { position: sessionIdx };

    const newDur = updatedServices.reduce((sum, sv) => sum + (Number(sv.duration_minutes) || 0), 0);
    const newPrice = updatedServices.reduce((sum, sv) => sum + (Number(sv.base_price) || 0), 0);
    const newNames = updatedServices.map((sv) => sv.service_name || sv.name).filter(Boolean).join(' + ');

    targetSession.services = updatedServices;
    targetSession.addons = updatedAddons;
    targetSession.total_session_duration = newDur;
    targetSession.duration_minutes = newDur;
    targetSession.services_duration = newDur;
    targetSession.session_price = newPrice;
    targetSession.services_price = newPrice;
    targetSession.service_name = newNames;

    delete targetSession.appointment_end; // stale once the duration changed
    base[sessionIdx] = targetSession;

    // Keep the sessions sequential: when this session grew, push the following ones forward
    // so they no longer overlap it (otherwise the server rejects the save with 422).
    const clockMin = (v: unknown): number | null => {
      const m = String(v ?? '').match(/(\d{2}):(\d{2})/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    let prevEnd: number | null = null;
    for (let i = 0; i < base.length; i++) {
      const sess: Record<string, any> = base[i];
      let start = clockMin(sess.appointment_start ?? sess.appointment_time);
      if (start === null) { prevEnd = null; continue; }
      if (i > sessionIdx && prevEnd !== null && start < prevEnd) {
        start = prevEnd;
        const hh = String(Math.floor(start / 60)).padStart(2, '0');
        const mm = String(start % 60).padStart(2, '0');
        sess.appointment_start = `${bookingDate}T${hh}:${mm}:00+03:00`;
        sess.appointment_time = `${hh}:${mm}`;
        delete sess.appointment_end;
      }
      const dur = Number(sess.total_session_duration ?? sess.duration_minutes ?? 60) || 60;
      prevEnd = start + dur;
    }

    setStagedSessions(base);
    setSaveSessionsError(null);
  }, [rawSessions, detail, booking, bookingDate]);

  const handleAddSessionFromModal = useCallback((sess: SavedSession) => {
    const base = rawSessions.length > 0
      ? rawSessions.map(s => ({ ...s }))
      : [{ ...(detail || {}), ...booking }];

    const newPosition = base.length;
    const sStartHHMM = toHHMM(sess.startTime);
    const startIso = `${bookingDate}T${sStartHHMM}:00+03:00`;
    const cleanSessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;

    const newSessionRecord: Record<string, any> = {
      session_id: cleanSessionId,
      session_number: newPosition + 1,
      position: newPosition,
      therapist_id: sess.therapistId,
      therapist_name: sess.therapistName,
      secondary_therapist_id: sess.secondaryTherapistId || undefined,
      secondary_therapist_name: sess.secondaryTherapistName || undefined,
      service_arrangement_id: sess.arrangementId,
      arrangement_name: sess.arrangementName,
      arrangement_type: sess.arrangementType,
      service_arrangement_data: {
        id: sess.arrangementId,
        name: sess.arrangementName,
        arrangement_type: sess.arrangementType,
        arrangement_price: sess.arrangementPrice,
      },
      therapist_data: {
        id: sess.therapistId,
        name: sess.therapistName,
        avatar: sess.therapistPhoto,
      },
      secondary_therapist_data: sess.secondaryTherapistId ? {
        id: sess.secondaryTherapistId,
        name: sess.secondaryTherapistName,
        avatar: sess.secondaryTherapistPhoto,
      } : undefined,
      services: sess.services.map((sv, sIdx) => ({
        service_id: sv.id,
        service_name: sv.name,
        base_price: parseFloat(String(sv.base_price ?? '0')) || 0,
        base_duration: Number(sv.duration_minutes ?? 60),
        duration_minutes: Number(sv.duration_minutes ?? 60),
        position: sIdx,
      })),
      appointment_time: sStartHHMM,
      appointment_start: startIso,
      total_session_duration: sess.totalDuration,
      duration_minutes: sess.totalDuration,
      services_duration: sess.totalDuration,
      session_price: sess.sessionPrice,
      services_price: sess.sessionPrice,
      service_name: sess.services.map(s => s.name).join(' + '),
    };

    setStagedSessions([...base, newSessionRecord]);
    setSaveSessionsError(null);
    setShowAddSessionModal(false);
  }, [rawSessions, detail, booking, bookingDate]);

  const handleSaveStagedSessions = async () => {
    if (!booking?.id || !stagedSessions) return;
    setIsSavingSessions(true);
    setSaveSessionsError(null);

    const isUuid = (v: unknown): v is string =>
      typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

    try {
      const payloadSessions = stagedSessions.map((s, idx) => {
        let sServices = (Array.isArray(s.services) ? s.services : [])
          .map((sv: any, sIdx: number) => {
            const sId = [sv.service_id, sv.id].find(isUuid) || undefined;
            const pkgId = [
              sv.package_id,
              sv.service_data?.package_id,
              packageInfo.packageId,
            ].find(isUuid) || undefined;
            const pkgName =
              sv.package_name ||
              sv.service_data?.package_name ||
              packageInfo.packageName ||
              undefined;
            return {
              service_id: sId,
              service_name: sv.service_name || sv.name || undefined,
              base_price: parseFloat(String(sv.base_price ?? sv.price ?? 0)) || 0,
              base_duration: Number(sv.duration_minutes ?? sv.duration ?? 60),
              duration_minutes: Number(sv.duration_minutes ?? sv.duration ?? 60),
              position: sIdx,
              ...(pkgId ? { package_id: pkgId } : {}),
              ...(pkgName ? { package_name: pkgName } : {}),
            };
          })
          .filter((sv: any) => Boolean(sv.service_id));

        if (sServices.length === 0) {
          const fallbackSvcId = [s.service_id, (booking as any)?.service_id, detail?.service_id].find(isUuid);
          if (fallbackSvcId) {
            sServices = [{
              service_id: fallbackSvcId,
              service_name: s.service_name || booking.service_name || 'Service',
              base_price: parseFloat(String(s.service_price || (booking as any)?.base_price || 0)) || 0,
              base_duration: Number(s.duration_minutes || booking.duration_minutes || 60),
              duration_minutes: Number(s.duration_minutes || booking.duration_minutes || 60),
              position: 0,
            }];
          }
        }

        const sid = [s.session_id, s.id].find(isUuid) || undefined;
        const tid = [
          s.therapist_id,
          (s.therapist_data as any)?.id,
          (s.therapist_data as any)?.therapist_id,
          booking.therapist_id,
          detail?.therapist_id,
        ].find(isUuid);

        const secTid = [
          s.secondary_therapist_id,
          (s.secondary_therapist_data as any)?.id,
        ].find(isUuid) || undefined;

        const arrId = [
          s.service_arrangement_id,
          (s.service_arrangement_data as any)?.id,
          (s as any)?.arrangementId,
          detail?.service_arrangement_id,
          (booking as any)?.service_arrangement_id,
        ].find(isUuid) || undefined;

        let apptTime: string | undefined = undefined;
        if (s.appointment_time && typeof s.appointment_time === 'string') {
          apptTime = toHHMM(s.appointment_time);
        } else if (s.appointment_start && typeof s.appointment_start === 'string') {
          const m = s.appointment_start.match(/T(\d{2}:\d{2})/);
          if (m) apptTime = m[1];
        }

        const apptStart = s.appointment_start || (apptTime ? `${bookingDate}T${apptTime}:00+03:00` : undefined);

        return {
          session_id: sid,
          therapist_id: tid,
          therapist_name: s.therapist_name || (s.therapist_data as any)?.name || booking.therapist_name,
          secondary_therapist_id: secTid,
          secondary_therapist_name: s.secondary_therapist_name || (s.secondary_therapist_data as any)?.name || undefined,
          service_arrangement_id: arrId,
          arrangement_name: s.arrangement_name || (s.service_arrangement_data as any)?.name || undefined,
          arrangement_type: s.arrangement_type || (s.service_arrangement_data as any)?.type || undefined,
          services: sServices,
          addons: (Array.isArray(s.addons) && s.addons.length > 0
            ? s.addons
            : (stagedSessions.length === 1 ? (addons as Array<Record<string, any>>) : [])
          ).map((a: any) => ({
            addon_id: a.addon_id ?? a.id,
            id: a.addon_id ?? a.id,
            name: a.name ?? a.addon_name,
            price: a.price ?? a.base_price ?? 0,
            duration_minutes: Number(a.duration_minutes ?? a.duration ?? 0) || 0,
          })),
          extra_minutes: Number(s.extra_minutes ?? (stagedSessions.length === 1 ? extraMinutes : 0)) || 0,
          appointment_date: bookingDate,
          appointment_time: apptTime,
          appointment_start: apptStart,
        };
      });

      const res = await authedFetch(`/api/v1/booknpay/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          appointment_date: bookingDate,
          sessions: payloadSessions,
          total_amount: computedTotal,
          total_price: computedTotal,
          total_duration: totalDuration,
          duration_minutes: Math.max(0, totalDuration - addonsDuration - extraMinutes),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let errMsg = 'Failed to update booking sessions';
        const errDetail = data?.error?.detail || data?.detail;
        const errMsgField = data?.error?.message || data?.message;
        if (typeof errDetail === 'string') {
          errMsg = errDetail;
        } else if (Array.isArray(errDetail) && errDetail.length > 0) {
          errMsg = errDetail
            .map((d: any) => d.msg || d.message || JSON.stringify(d))
            .join(', ');
        } else if (typeof errMsgField === 'string' && errMsgField.trim()) {
          errMsg = errMsgField;
        }
        throw new Error(errMsg);
      }

      setStagedSessions(null);
      await fetchDetail(true);
      onSuccess?.();
    } catch (err) {
      console.error('[BookingDetailModal] Save staged sessions error:', err);
      setSaveSessionsError(err instanceof Error ? err.message : 'Failed to save session changes');
    } finally {
      setIsSavingSessions(false);
    }
  };

  const handleProcessPayment = async (data: PaymentReferenceData) => {
    if (!booking) return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const providerOption = selectedPaymentConfig.providerOption;
      const providerId = selectedPaymentConfig.id;

      const paidAtNow = nowWithTimezone();
      const patchPayload = {
        status: curStatus === 'completed' ? 'completed' : 'confirmed',
        payment_status: 'success',
        payment_provider: providerId,
        payment_method: providerOption,
        payment_gateway: providerOption === 'KNET Card' ? 'KNET' : providerOption,
        transaction_id: data.transactionId || null,
        reference_id: data.transactionId || null,
        receipt_image: data.receiptImage || null,
        notes: data.notes || 'Paid on desk',
        reason: 'Paid on desk',
        source: 'ushdesk',
        payment_data: {
          transaction_id: data.transactionId,
          reference_id: data.transactionId,
          payment_provider: providerId,
          payment_method: providerOption,
          payment_gateway: providerOption === 'KNET Card' ? 'KNET' : providerOption,
          receipt_image: data.receiptImage || null,
          notes: data.notes || null,
          total_amount: booking.total_amount,
          currency: booking.currency,
          paid_at: paidAtNow,
        },
        payments_data: {
          is_paid: true,
          status: 'Paid',
          transaction_id: data.transactionId,
          reference_id: data.transactionId,
          payment_provider: providerId,
          payment_method: providerOption,
          payment_gateway: providerOption === 'KNET Card' ? 'KNET' : providerOption,
          receipt_image: data.receiptImage || null,
          notes: data.notes || null,
          transaction_date: paidAtNow,
          paid_at: paidAtNow,
        },
        changed_by: user?.name || user?.id || 'Staff',
        change_by_user: user?.name || user?.id || 'Staff',
        change_by_user_data: user
          ? {
              id: user.id,
              name: user.name,
              full_name: user.name,
              first_name: user.name.split(' ')[0] || user.name,
              last_name: user.name.split(' ').slice(1).join(' ') || '',
              email: user.email,
              phone_number: user.phone_number,
              role: user.user_type,
            }
          : undefined,
      };

      const res = await authedFetch(`/booknpay/api/v1/bookings/${booking.id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || `Failed to process payment (${res.status})`);
      }

      // Record in payments endpoint if supported
      try {
        await authedFetch('/booknpay/api/v1/payments/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            booking_id: booking.id,
            amount: parseFloat(booking.total_amount) || 0,
            currency: booking.currency || 'KWD',
            status: 'success',
            payment_method: providerOption === 'KNET Card' ? 'card' : providerId,
            payment_provider: providerOption,
            payment_gateway: providerOption === 'KNET Card' ? 'KNET' : providerOption,
            payment_through: 'ushdesk',
            payment_for: (booking.booking_type === 'home_service' || booking.booking_type === 'home') ? 'home_service' : 'branch_service',
            reference_id: data.transactionId || null,
            transaction_id: data.transactionId || null,
            transaction_date: paidAtNow,
            paid_at: paidAtNow,
            invoice_number: invoiceNumber || null,
            invoice_id: invoiceNumber || null,
            receipt_image: data.receiptImage || null,
            notes: data.notes || null,
            payment_data: {
              booking_number: booking.booking_number ?? booking.id,
              receipt_image: data.receiptImage || null,
              notes: data.notes || null,
              transaction_id: data.transactionId || null,
            },
          }),
        });
      } catch (e) {
        console.warn('[BookingDetailPopup] Optional /payments call:', e);
      }

      // Immediately update local booking object & state so UI updates instantly
      booking.is_paid = true;
      booking.payment_status = 'success';
      booking.payment_provider = providerId;
      booking.payment_method = providerOption;
      if (curStatus !== 'completed') {
        booking.status = 'confirmed';
      }
      if (data.receiptImage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (booking as any).receipt_image = data.receiptImage;
      }
      if (data.transactionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (booking as any).transaction_id = data.transactionId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (booking as any).reference_id = data.transactionId;
      }

      setDetail((prev) => {
        const nextStatus = curStatus === 'completed' ? 'completed' : 'confirmed';
        if (!prev) {
          return {
            ...booking.raw,
            status: nextStatus,
            is_paid: true,
            payment_status: 'success',
            payment_provider: providerId,
            payment_method: providerOption,
            receipt_image: data.receiptImage || null,
            transaction_id: data.transactionId || null,
            reference_id: data.transactionId || null,
          };
        }
        return {
          ...prev,
          status: nextStatus,
          is_paid: true,
          payment_status: 'success',
          payment_provider: providerId,
          payment_method: providerOption,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          receipt_image: data.receiptImage || (prev as any)?.receipt_image || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transaction_id: data.transactionId || (prev as any)?.transaction_id || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reference_id: data.transactionId || (prev as any)?.reference_id || null,
          payment_data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...((prev as any)?.payment_data ?? {}),
            status: 'success',
            is_paid: true,
            receipt_image: data.receiptImage || null,
            transaction_id: data.transactionId || null,
            payment_provider: providerId,
            payment_method: providerOption,
          },
        };
      });

      // Re-fetch detail from backend to sync full payments_meta, invoice, etc.
      authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.data) setDetail(d.data);
          else if (d?.success && d?.data) setDetail(d.data);
        })
        .catch(() => {});

      setShowPaymentRefModal(false);
      setShowPaymentModal(false);
      onSuccess?.();
    } catch (err: unknown) {
      console.error('[BookingDetailPopup] Payment error:', err);
      setPaymentError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Snapshot of the completed booking sent to ushanr when a feedback link is generated.
  const buildFeedbackPayload = (): CreateFeedbackLinkPayload => {
    const rb = { ...((booking.raw ?? {}) as Record<string, any>), ...((detail ?? {}) as Record<string, any>) };
    const cd = (rb.customer_data ?? {}) as Record<string, any>;
    const str = (v: unknown): string | null => {
      const s = v === undefined || v === null ? '' : String(v).trim();
      return s || null;
    };
    const uuid = (v: unknown): string | null => {
      const s = str(v);
      return s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
    };
    const langRaw = String(rb.customer_language ?? rb.language_preference ?? cd.language_preference ?? cd.language ?? 'ar');
    return {
      booking_id: booking.id,
      booking_number: str(rb.booking_number ?? booking.booking_number),
      customer_id: uuid(rb.customer_id ?? cd.id),
      customer_name: str(booking.customer_name ?? rb.customer_name),
      customer_phone: str(booking.customer_phone ?? rb.customer_phone ?? cd.phone_number),
      service_id: uuid(rb.service_id),
      service_name: str(booking.service_name ?? rb.service_name),
      services: Array.isArray(rb.services) ? rb.services : null,
      therapist_id: uuid(primaryTherapistId),
      therapist_name: str(primaryTherapistName !== '—' ? primaryTherapistName : booking.therapist_name),
      secondary_therapist_id: uuid(secondaryTherapistId),
      secondary_therapist_name: str(secondaryTherapistName),
      branch_id: uuid(rb.branch_id),
      branch_name: str(booking.branch_name ?? rb.branch_name),
      appointment_start: str(booking.appointment_start ?? rb.appointment_start),
      language: langRaw.toLowerCase().startsWith('en') ? 'en' : 'ar',
    };
  };

  return (
    <>
      {/* Feedback link prompt: InProgress → Completed */}
      {showFeedbackPrompt && (
        <FeedbackLinkModal
          isOpen={showFeedbackPrompt}
          onClose={() => setShowFeedbackPrompt(false)}
          payload={buildFeedbackPayload()}
        />
      )}

      {/* Step 1: Payment Provider Modal (nested, z-60) */}
      {showPaymentModal && (
        <PaymentProviderModal
          booking={booking}
          totalAmount={computedTotal}
          currency={currency}
          selected={selectedProviderId}
          onSelect={(id) => setSelectedProviderId(id)}
          onClose={() => setShowPaymentModal(false)}
          onContinue={() => {
            setPaymentError(null);
            setShowPaymentModal(false);
            if (selectedProviderId === 'paymentlink' || selectedProviderId === 'deema') {
              setShowMakePaymentModal(true);
            } else {
              setShowPaymentRefModal(true);
            }
          }}
        />
      )}

      {/* Step 2 (Direct): PaymentLink Modal (Make Payment Now) */}
      {showMakePaymentModal && (
        <MakePaymentModal
          isOpen={showMakePaymentModal}
          initialStep={2}
          initialProviderId={selectedProviderId === 'deema' ? 'deema' : 'myfatoorah'}
          onClose={() => setShowMakePaymentModal(false)}
          bookingId={booking.id}
          bookingNumber={booking.booking_number}
          invoiceId={
            (invoiceRecord?.id ? String(invoiceRecord.id) : null) ||
            (detail?.invoice_id ? String(detail.invoice_id) : null) ||
            ((detail?.payment_data as any)?.invoice_id ? String((detail?.payment_data as any)?.invoice_id) : null) ||
            null
          }
          invoiceNumber={invoiceNumber || null}
          amount={computedTotal.toFixed(3)}
          currency={currency}
          customerName={booking.customer_name}
          customerPhone={
            String(
              (detail as any)?.customer_phone ??
              (detail as any)?.phone ??
              (booking.raw as any)?.customer_phone ??
              (booking.raw as any)?.phone ??
              booking.customer_phone ??
              ''
            ).trim() || null
          }
          onPaymentSuccess={() => {
            authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`)
              .then((r) => r.json())
              .then((res) => {
                if (res?.success && res?.data) setDetail(res.data as Record<string, unknown>);
                else if (res?.data) setDetail(res.data as Record<string, unknown>);
              })
              .catch(() => {});
          }}
          onSuccess={() => {
            setShowMakePaymentModal(false);
            authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`)
              .then((r) => r.json())
              .then((res) => {
                if (res?.success && res?.data) setDetail(res.data as Record<string, unknown>);
                else if (res?.data) setDetail(res.data as Record<string, unknown>);
              })
              .catch(() => {});
            onSuccess?.();
          }}
        />
      )}

      {/* Step 2: Payment Reference & Receipt Scan Modal (nested, z-60) */}
      {showPaymentRefModal && (
        <PaymentReferenceModal
          isOpen={showPaymentRefModal}
          onClose={() => {
            setShowPaymentRefModal(false);
            setPaymentError(null);
          }}
          onBack={() => {
            setShowPaymentRefModal(false);
            setShowPaymentModal(true);
          }}
          paymentProvider={selectedPaymentConfig.providerOption}
          totalAmount={computedTotal || parseFloat(booking.total_amount) || 0}
          currency={currency || booking.currency || 'KWD'}
          initialReceiptImage={receiptImg || null}
          initialTransactionId={transactionId || ''}
          onConfirm={handleProcessPayment}
          isSubmitting={paymentSubmitting}
          confirmButtonLabel="Confirm & Record Payment"
          error={paymentError}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        {/* Widened when payment pending to fit buttons nicely */}
        <div
          className={cn(
            'relative z-10 w-full max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200',
            'max-w-3xl sm:max-w-4xl lg:max-w-[880px]',
            isCompleted
              ? 'booking-completed-modal border-[#B8A394] text-[#2D241E]'
              : 'border-border/60 bg-card text-foreground'
          )}
          style={isCompleted ? { backgroundColor: '#D3C0B2', color: '#2D241E' } : undefined}
        >
          {isCompleted && (
            <style>{`
              .booking-completed-modal {
                background-color: #D3C0B2 !important;
                color: #2D241E !important;
              }
              .booking-completed-modal h2,
              .booking-completed-modal h3,
              .booking-completed-modal p,
              .booking-completed-modal span:not([class*="bg-"]):not([class*="text-primary"]):not([class*="text-emerald"]):not([class*="text-rose"]) {
                color: #2D241E;
              }
              .booking-completed-modal .text-foreground {
                color: #2D241E !important;
              }
              .booking-completed-modal .text-muted-foreground {
                color: #69584D !important;
              }
              .booking-completed-modal .border-border\/40,
              .booking-completed-modal .border-border\/50,
              .booking-completed-modal .border-border\/60,
              .booking-completed-modal .border-border {
                border-color: rgba(105, 88, 77, 0.25) !important;
              }
              .booking-completed-modal .bg-muted\/20,
              .booking-completed-modal .bg-muted\/30,
              .booking-completed-modal .bg-muted\/40,
              .booking-completed-modal .bg-muted\/50,
              .booking-completed-modal .bg-muted\/60,
              .booking-completed-modal .bg-muted {
                background-color: rgba(255, 255, 255, 0.45) !important;
              }
              .booking-completed-modal .bg-card {
                background-color: rgba(255, 255, 255, 0.6) !important;
              }
            `}</style>
          )}

          <div className={cn('h-1.5 w-full shrink-0', accentBar)} />

          {/* Header */}
          <div className={cn(
            'shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
          )}>
            <div className="flex items-center gap-3">
              <CustomerAvatar name={booking.customer_name} size="lg" />
              <div>
                <p className={cn('text-[11px] font-semibold uppercase tracking-wider', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>Customer</p>
                <p className={cn('text-base font-extrabold leading-tight', isCompleted ? 'text-[#2D241E]' : 'text-foreground')}>{booking.customer_name}</p>
                {booking.customer_phone && <p className={cn('text-xs mt-0.5', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>{booking.customer_phone}</p>}
                {booking.customer_email && <p className={cn('text-xs', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>{booking.customer_email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize',
                isCompleted
                  ? 'bg-[#5C7359]/20 text-[#244221] border border-[#5C7359]/40'
                  : statusStyle(curStatus || booking.status)
              )}>
                {curStatus === 'confirmed' || curStatus === 'completed' || curStatus === 'checked_in' || curStatus === 'in_progress' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {curStatus || booking.status}
              </span>
              {/* Payment status badge */}
              {booking.payment_status && (
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize',
                  isCompleted
                    ? 'bg-[#3D5A6C]/15 text-[#1B3A4B] border border-[#3D5A6C]/30'
                    : paymentStyle(booking.payment_status)
                )}>
                  <CreditCard className="h-3 w-3" />
                  {booking.payment_status.replace(/_/g, ' ')}
                </span>
              )}
              {/* Refresh button to reload booking details */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loadingDetail || refreshing}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                  isCompleted
                    ? 'bg-black/10 hover:bg-black/20 text-[#2D241E]'
                    : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40'
                )}
                title="Reload booking details"
                aria-label="Reload booking details"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', (loadingDetail || refreshing) && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={onClose}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-xl transition cursor-pointer',
                  isCompleted ? 'bg-black/10 hover:bg-black/20 text-[#2D241E]' : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
                aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar (Confirmed -> CheckedIn -> InProgress -> Completed) */}
          {showStatusProgressBar && (
            <div className={cn(
              'shrink-0 border-b px-6 py-3 transition-colors',
              isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/20' : 'border-border/40 bg-muted/30'
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Stepper */}
                <div className="flex items-center flex-1 max-w-xl">
                  {PROGRESS_STAGES.map((stage, idx) => {
                    const isDone = currentStageIndex > idx;
                    const isCurrent = currentStageIndex === idx;
                    const isUpcoming = currentStageIndex < idx;
                    const isLast = idx === PROGRESS_STAGES.length - 1;

                    return (
                      <div key={stage.key} className={cn('flex items-center', !isLast && 'flex-1')}>
                        {/* Step indicator */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div
                            className={cn(
                              'relative flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold transition-all shadow-xs',
                              isDone && 'bg-emerald-600 text-white',
                              isCurrent && (isCompleted ? 'bg-[#3D2F27] text-white ring-4 ring-[#C8B5A7]/50' : 'bg-primary text-primary-foreground ring-4 ring-primary/20'),
                              isUpcoming && 'border border-border/70 bg-card text-muted-foreground'
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-xs whitespace-nowrap transition-colors',
                              isDone && 'font-semibold text-emerald-600 dark:text-emerald-400',
                              isCurrent && (isCompleted ? 'font-bold text-[#2D241E]' : 'font-bold text-foreground'),
                              isUpcoming && 'font-medium text-muted-foreground'
                            )}
                          >
                            {stage.label}
                          </span>
                        </div>

                        {/* Connector line */}
                        {!isLast && (
                          <div className="mx-1.5 sm:mx-3 flex-1 h-0.5 bg-border/60 overflow-hidden rounded-full min-w-[12px]">
                            <div
                              className={cn(
                                'h-full transition-all duration-300',
                                currentStageIndex > idx
                                  ? 'bg-emerald-600 w-full'
                                  : currentStageIndex === idx
                                  ? 'bg-primary/50 w-1/2'
                                  : 'w-0'
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Next Step Action Button */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {currentStage?.nextKey ? (
                    hasAdvanceStatusPermission && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceNextStep(currentStage.nextKey, currentStage.nextReason)}
                        disabled={advancingStep}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
                          currentStage.nextKey === 'completed'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                        )}
                      >
                        {advancingStep ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Updating…</span>
                          </>
                        ) : (
                          <>
                            <span>Next Step ({currentStage.nextLabel})</span>
                            <ChevronRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
              {advanceError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                  {advanceError}
                </p>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className={cn(
            'shrink-0 flex items-center border-b px-6 gap-1 sm:gap-2',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/25' : 'border-border/40 bg-muted/20'
          )}>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                activeTab === 'details'
                  ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                  : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Info className="h-3.5 w-3.5" />
              Booking Details
            </button>
            {!isPaymentTabRestricted && (
              <button
                type="button"
                onClick={() => setActiveTab('payment')}
                className={cn(
                  'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                  activeTab === 'payment'
                    ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                    : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Payment &amp; Invoices
                {booking.payment_status === 'refunded_with_points' || rawPaymentStatus === 'refunded_with_points' ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Refunded (Points)
                  </span>
                ) : booking.payment_status === 'refunded' || rawPaymentStatus === 'refunded' ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Refunded
                  </span>
                ) : isRewarded ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Rewarded
                  </span>
                ) : isPaid || booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid' ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Paid
                  </span>
                ) : isPaymentPending ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    Pending
                  </span>
                ) : null}
              </button>
            )}
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Unsaved Staged Sessions Banner */}
            {stagedSessions !== null && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 border-amber-400/80 bg-amber-500/10 p-4 shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-foreground">
                      You have unsaved session modifications
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      New Total: <span className="font-extrabold text-foreground font-mono">{computedTotal.toFixed(3)} {currency}</span> ({totalDuration} min). Click &quot;Save Changes&quot; to persist to database.
                    </p>
                    {saveSessionsError && (
                      <p className="text-[11px] font-bold text-destructive mt-1">{saveSessionsError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => { setStagedSessions(null); setSaveSessionsError(null); }}
                    disabled={isSavingSessions}
                    className="rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStagedSessions}
                    disabled={isSavingSessions}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingSessions ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'details' || isPaymentTabRestricted ? (
              <>
                {/* Row 1: Booking Number and Booked On in one row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={Hash} label="Booking Number">
                    <span className="font-mono tracking-wide font-bold text-primary text-sm">{booking.booking_number || '—'}</span>
                  </DRow>
                  <DRow icon={Calendar} label="Booked On">
                    {formatDateTime(booking.created_at)}
                  </DRow>
                </div>

                {/* Row 2: Session-wise Breakdown matching attached screenshot */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Scissors className="h-3.5 w-3.5 text-primary" />
                      {displaySessions.length > 1 ? `Sessions (${displaySessions.length})` : 'Session'}
                    </p>

                    {canAddSession && (
                      <button
                        type="button"
                        onClick={() => setShowAddSessionModal(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Another Session
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {displaySessions.map((sess, sessIdx) => {
                      const isSessionLocked = unlockedSessionIndices.size > 0 && !unlockedSessionIndices.has(sessIdx);
                      return (
                      <div
                        key={sess.id}
                        role={!isSessionLocked && sess.raw?.session_id ? 'button' : undefined}
                        tabIndex={!isSessionLocked && sess.raw?.session_id ? 0 : undefined}
                        onClick={() => { if (!isSessionLocked && sess.raw?.session_id) setActiveSessionId(String(sess.raw.session_id)); }}
                        onKeyDown={(e) => { if (!isSessionLocked && e.key === 'Enter' && sess.raw?.session_id) setActiveSessionId(String(sess.raw.session_id)); }}
                        title={isSessionLocked ? `Locked — open from ${sess.therapistName}'s schedule block to manage this session` : undefined}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-2xl border p-3.5 sm:p-4 shadow-xs transition-colors',
                          isSessionLocked
                            ? 'border-border/60 bg-muted/40 opacity-60 cursor-not-allowed select-none'
                            : cn('border-[#f4cfd3] bg-white hover:border-[#e8b5bb]', Boolean(sess.raw?.session_id) && 'cursor-pointer')
                        )}
                      >
                        {/* Left: Number circle + Info */}
                        <div className="flex min-w-0 items-center gap-3">
                          {/* Solid Circular Badge */}
                          <span className={cn(
                            'grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow-xs',
                            isSessionLocked ? 'bg-slate-400 dark:bg-slate-600' : 'bg-[#b85d63]'
                          )}>
                            {isSessionLocked ? <Lock className="h-4 w-4" /> : sess.number}
                          </span>

                          <div className="min-w-0">
                            {/* Service Name (bold uppercase) + Room Pill */}
                            <div className="flex flex-wrap items-center gap-2">
                              {Array.isArray(sess.raw?.services) && (sess.raw?.services as any[]).length > 0 ? (
                                <div className="flex flex-col">
                                  {(sess.raw?.services as any[]).map((sv: any, k: number) => (
                                    <h4 key={sv.id ?? sv.service_id ?? k} className="text-sm sm:text-base font-extrabold tracking-wide text-foreground uppercase">
                                      {String(sv.service_name ?? sv.name ?? sv.service_data?.name ?? 'Service')}
                                    </h4>
                                  ))}
                                </div>
                              ) : (
                                <h4 className="text-sm sm:text-base font-extrabold tracking-wide text-foreground">
                                  {sess.serviceName}
                                </h4>
                              )}
                              <span className="inline-flex items-center rounded-full bg-[#faebea] px-2.5 py-0.5 text-xs font-semibold text-[#b85d63]">
                                {sess.roomName}
                              </span>
                              {isSessionLocked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700">
                                  <Lock className="h-3 w-3" />
                                  Locked
                                </span>
                              )}
                            </div>

                            {/* Subtitle: User icon + Therapist name · Clock icon + Time (duration) */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground/80">
                                {sess.therapistName}
                                {sess.secondaryTherapistName ? ` + ${sess.secondaryTherapistName}` : ''}
                              </span>
                              <span className="font-bold text-muted-foreground/60 mx-1">·</span>
                              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground/80">{sess.timeLabel}</span>
                            </div>
                            {(() => {
                              const sAddons = getSessionAddons(sess.raw as any);
                              const sExtra = getSessionExtraMinutes(sess.raw as any);
                              if (sAddons.length === 0 && sExtra <= 0) return null;
                              return (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {sAddons.map((a, k) => (
                                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/40 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                      <Plus className="h-3 w-3" />
                                      {String(a.name ?? a.addon_name ?? 'Add-on')}
                                    </span>
                                  ))}
                                  {sExtra > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                      <Clock className="h-3 w-3" />
                                      Extra time +{sExtra} min
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Right: Price + Edit Action + Trash Action Button */}
                        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                          {!isPackageBooking && (
                            <span className="font-mono text-sm sm:text-base font-extrabold text-[#b85d63]">
                              {sess.price.toFixed(3)} {currency}
                            </span>
                          )}

                          {/* Edit session icon: appears only for unpaid bookings */}
                          {(isUnpaidBooking || isPaidEditableBooking) && (
                            <button
                              type="button"
                              disabled={isSessionLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSessionLocked) return;
                                setEditingSessionIndex(sess.number - 1);
                              }}
                              title={isSessionLocked ? 'Session locked' : isPaidEditableBooking ? 'Change service (same price only)' : 'Edit session services'}
                              className={cn(
                                'grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition',
                                isSessionLocked
                                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                                  : 'hover:bg-primary/20 hover:scale-105 active:scale-95 cursor-pointer'
                              )}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {!isPaymentSuccess && !isPaid && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSessionLocked) return;
                              if (displaySessions.length > 1 && !isCancelled && !isCompleted) {
                                const base = rawSessions.length > 0 ? rawSessions.map(s => ({ ...s })) : [{ ...(detail || {}), ...booking }];
                                const filtered = base.filter((_, i) => i !== sess.number - 1);
                                setStagedSessions(filtered);
                                setSaveSessionsError(null);
                              } else {
                                handleCancel();
                              }
                            }}
                            disabled={isSessionLocked || (displaySessions.length <= 1 && (!canShowCancel || isCancelled || isCompleted))}
                            title={isSessionLocked ? 'Session locked' : displaySessions.length > 1 ? 'Remove session' : (canShowCancel && !isCancelled && !isCompleted ? 'Cancel / Remove' : undefined)}
                            className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full bg-[#fdeeee] text-[#d9534f] hover:bg-rose-100 hover:text-red-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          )}
                        </div>
                      </div>
                      );
                    })}

                    {canAddSession && (
                      <button
                        type="button"
                        onClick={() => setShowAddSessionModal(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 py-3 text-xs font-bold text-primary transition cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Session
                      </button>
                    )}
                  </div>

                  {/* Summary for add-ons, extra minutes, discount, and total */}
                  {(addons.length > 0 || extraMinutes > 0 || discountAmount > 0) && (
                    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs divide-y divide-border/40">
                      {discountAmount > 0 && (
                        <div className="flex items-center justify-between gap-2 bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400"><Tag className="h-3.5 w-3.5" /></span>
                            <p className="text-xs font-bold text-foreground">Discount Applied</p>
                          </div>
                          <div className="grid shrink-0 grid-cols-[64px_96px] items-center gap-2 text-right text-xs">
                            <span className="text-muted-foreground">—</span>
                            <span className="font-mono font-bold text-rose-700 dark:text-rose-300">-{discountAmount.toFixed(3)} {currency}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-primary/5 px-4 py-3">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-foreground">Total</p>
                        <div className="grid shrink-0 grid-cols-[64px_96px] items-center gap-2 text-right">
                          <span className="text-xs font-bold text-primary">{totalDuration} min</span>
                          <span className="font-mono text-sm font-extrabold text-primary">{computedTotal.toFixed(3)} {currency}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isParked && (
                  <div className="rounded-2xl border border-violet-300/60 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 text-xs text-violet-800 dark:text-violet-200">
                    <p className="font-bold">Parked booking</p>
                    <p className="mt-0.5">
                      This paid booking has no appointment slot reserved. Use <strong>Reschedule</strong> to assign a new date and time.
                    </p>
                  </div>
                )}

                {/* Date & Time + Duration Breakdown (Service + Addons + Extra) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={Calendar} label="Date">{formatDate(booking.appointment_start)}</DRow>
                  <DRow icon={Clock} label="Time & Duration">
                    <p>{formatTime(booking.appointment_start)} – {formatTime(booking.appointment_end)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        Total: {totalDuration} min
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({serviceDuration}m{effAddonsDuration > 0 ? ` + ${effAddonsDuration}m addons` : ''}{effExtraMinutes > 0 ? ` + ${effExtraMinutes}m extra` : ''})
                      </span>
                    </div>
                  </DRow>
                </div>

                {/* Branch and Customer Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DRow icon={MapPin} label="Branch">{booking.branch_name || '—'}</DRow>
                  <DRow icon={FileText} label="Customer Notes">
                    <span className="text-foreground text-xs break-words">
                      {String(detail?.customer_notes ?? booking.customer_notes ?? detail?.notes ?? '') || '—'}
                    </span>
                  </DRow>
                </div>

                {/* Pricing Summary (Sum of all items: Service + Addons + Extra Minutes) */}
                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 p-4 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Pricing &amp; Total Amount
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {isPackageBooking ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="truncate pr-2">{packageName ? `Package Price (${packageName}):` : 'Package Price:'}</span>
                        <span className="font-mono font-semibold text-foreground">{effectivePackagePrice.toFixed(3)} {currency}</span>
                      </div>
                    ) : serviceItems.length > 1 ? serviceItems.map((it, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span className="truncate pr-2">#{i + 1} {it.name}{it.duration > 0 ? ` (${it.duration}m)` : ''}:</span>
                        <span className="font-mono font-semibold text-foreground">{it.price.toFixed(3)} {currency}</span>
                      </div>
                    )) : (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Base Service:</span>
                        <span className="font-mono font-semibold text-foreground">{servicePrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    {(effAddons.length > 0 || addonsPrice > 0) && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Addons ({effAddons.length}):</span>
                        <span className="font-mono font-semibold text-foreground">+{addonsPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    {effExtraMinutes > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Extra Time (+{effExtraMinutes} min):</span>
                        <span className="font-mono font-semibold text-foreground">+{extraPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span>Discount:</span>
                        <span className="font-mono font-semibold">-{discountAmount.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    <div className="border-t border-border/50 pt-2 flex justify-between items-baseline">
                      <span className="font-bold text-foreground">Total Amount:</span>
                      <span className="text-base font-extrabold text-primary font-mono">
                        {computedTotal.toFixed(3)} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── TAB 2: PAYMENT & INVOICES ── */}

                {/* ── COURSE SUBSCRIPTION REDEMPTION BANNER & METRICS ── */}
                {isCourseRedemption && (
                  <div className="rounded-2xl border border-[#543C30]/25 bg-gradient-to-br from-[#543C30]/[0.08] via-card to-card p-5 sm:p-6 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#543C30]/15">
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#543C30] text-white shadow-xs">
                          <BookMarked className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#543C30] bg-[#543C30]/10 px-2.5 py-0.5 rounded-full border border-[#543C30]/20">
                              Course Subscription Redemption
                            </span>
                            {courseSubNumber && (
                              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                                <span>{courseSubNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(courseSubNumber);
                                    setCopiedType('crs_sub');
                                    setTimeout(() => setCopiedType(null), 2000);
                                  }}
                                  className="text-muted-foreground hover:text-foreground transition p-0.5"
                                  title="Copy subscription number"
                                >
                                  {copiedType === 'crs_sub' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            )}
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                            {courseCode ? `${courseCode} – ${courseName}` : (courseName || 'Course Package')}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Prepaid Package</span>
                        </span>
                      </div>
                    </div>

                    {/* 3 Metrics: Current Session, Remaining Sessions, Total Sessions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[#543C30]/20 bg-card p-3.5 shadow-2xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Session</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-2xl font-black text-[#543C30]">#{currentSessionNumber}</span>
                          <span className="text-xs text-muted-foreground font-medium">of {totalCourseSessions || '—'}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Redeemed in this booking</p>
                      </div>

                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 shadow-2xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Remaining Sessions</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{remainingCourseSessions}</span>
                          <span className="text-xs text-emerald-600/80 font-medium">left</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Available for future bookings</p>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Package Sessions</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-2xl font-black text-foreground">{totalCourseSessions}</span>
                          <span className="text-xs text-muted-foreground font-medium">sessions</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Total purchased sessions</p>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    {totalCourseSessions > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground">Package Usage Progress</span>
                          <span className="font-bold text-[#543C30]">
                            {Math.min(100, Math.round((currentSessionNumber / totalCourseSessions) * 100))}% Completed
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#543C30] transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, Math.round((currentSessionNumber / totalCourseSessions) * 100)))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Course Subscription Payment & Invoice Summary */}
                    <div className="rounded-xl bg-muted/30 border border-border/50 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Package Price</p>
                        <p className="font-bold text-foreground mt-0.5 font-mono">
                          {subPrice ? `${parseFloat(subPrice).toFixed(3)} ${subCurrency}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Payment Provider</p>
                        <p className="font-bold text-foreground mt-0.5">{subPaymentProvider || 'Prepaid'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Payment Method</p>
                        <p className="font-bold text-foreground mt-0.5 capitalize">{subPaymentMethod || 'Course Package'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sub. Invoice #</p>
                        <p className="font-bold font-mono text-foreground mt-0.5 truncate">{subInvoiceNumber || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Official Invoice Card */}
                <div className={cn(
                  'rounded-2xl border p-5 sm:p-6 transition shadow-xs space-y-4',
                  isCompleted
                    ? 'border-[#B8A394] bg-white/40'
                    : 'border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 via-card to-card dark:from-violet-950/20'
                )}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/40">
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Invoice Number */}
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice number</p>
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
                                  navigator.clipboard.writeText(invoiceNumber);
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
                              {paymentNumber || (isRewarded || isPaid || booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid' ? 'Settled' : 'Generated upon settlement')}
                            </span>
                            {Boolean(paymentNumber) && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(paymentNumber);
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

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => setShowInvoiceModal(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20 transition cursor-pointer"
                        title="Open invoice details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Invoice</span>
                      </button>
                      {(booking.payment_status === 'refunded_with_points' || rawPaymentStatus === 'refunded_with_points') ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          <RotateCcw className="h-3 w-3" />
                          REFUNDED (POINTS)
                        </span>
                      ) : (booking.payment_status === 'refunded' || rawPaymentStatus === 'refunded') ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          <RotateCcw className="h-3 w-3" />
                          REFUNDED
                        </span>
                      ) : (isPaid || booking.is_paid || rawPaymentStatus === 'success' || rawPaymentStatus === 'paid' || booking.payment_status === 'success' || booking.payment_status === 'paid') && !isRewarded ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          PAID
                        </span>
                      ) : null}
                      {Boolean(invoiceNumber) && (
                        <Link
                          href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber)}`}
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
                      <p className="font-bold truncate mt-0.5">{booking.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Issue Date</p>
                      <p className="font-medium mt-0.5">{formatDate(booking.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Amount</p>
                      <p className="font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
                        {computedTotal.toFixed(3)} {currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Balance Due</p>
                      <p className="font-bold mt-0.5 text-foreground">
                        {isCourseRedemption
                          ? `0.000 ${currency} (Covered)`
                          : (isPaid || isRewarded || booking.is_paid || booking.payment_status === 'success' || booking.payment_status === 'paid')
                            ? `0.000 ${currency}`
                            : `${computedTotal.toFixed(3)} ${currency}`}
                      </p>
                    </div>
                  </div>

                  {/* Itemized breakdown in invoice */}
                  <div className="pt-1 space-y-2 pb-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                      <span>Description</span>
                      <span>Amount</span>
                    </div>
                    {isPackageBooking ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {packageName ? `Package Price (${packageName})` : 'Package Price'}
                          </span>
                          <span className="font-semibold font-mono">{effectivePackagePrice.toFixed(3)} {currency}</span>
                        </div>
                        {serviceItems.length > 1 && (
                          <div className="pl-2.5 space-y-1 border-l-2 border-border/50">
                            {serviceItems.map((it, i) => (
                              <div key={i} className="text-[11px] text-muted-foreground">
                                #{i + 1} {it.name}{it.duration > 0 ? ` (${it.duration}m)` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      serviceItems.map((it, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{serviceItems.length > 1 ? `#${i + 1} ` : ''}{it.name}{serviceItems.length > 1 && it.duration > 0 ? ` (${it.duration}m)` : ''}</span>
                          <span className="font-semibold">{it.price.toFixed(3)} {currency}</span>
                        </div>
                      ))
                    )}
                    {effAddons.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>+ Add-on: {String(a.name ?? a.addon_name ?? `Addon #${i + 1}`)}</span>
                        <span>+{parseFloat(String(a.price ?? a.base_price ?? '0')).toFixed(3)} {currency}</span>
                      </div>
                    ))}
                    {(extraPrice > 0 || effExtraMinutes > 0) && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>+ Extra Minutes (+{effExtraMinutes}m)</span>
                        <span>+{extraPrice.toFixed(3)} {currency}</span>
                      </div>
                    )}
                    {isCourseRedemption && (
                      <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-500/20 font-medium">
                        <div className="flex items-center gap-2">
                          <BookMarked className="h-4 w-4 shrink-0 text-[#543C30]" />
                          <span>Course Package Coverage ({courseSubNumber || 'Course Subscription'} – Session #{currentSessionNumber} of {totalCourseSessions})</span>
                        </div>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">-100% (Covered)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Payment Transaction & Gateway Details */}
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-primary" /> Transaction &amp; Gateway Details
                    </p>
                    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize', paymentStyle(booking.payment_status))}>
                      {(booking.payment_status || 'unpaid').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Provider / Gateway</p>
                      <p className="font-semibold text-foreground mt-0.5">{paymentProvider}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Payment Method</p>
                      <p className="font-semibold text-foreground mt-0.5 capitalize">{subPaymentMethod || booking.payment_method || (detail as any)?.payment_method || (detail?.voucher_data as any)?.payment_method || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Payment Number</p>
                      <p className="font-semibold font-mono text-foreground mt-0.5 truncate">{paymentNumber || (isRewarded || isPaid || booking.is_paid ? 'Settled' : 'Generated upon settlement')}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">Channel / Source</p>
                      <p className="font-semibold text-foreground mt-0.5 uppercase font-mono">{String(detail?.payment_through ?? (booking.raw as any)?.payment_through ?? (isLoyaltyBooking ? 'ushspa' : 'ushdesk'))}</p>
                    </div>
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium">{isCourseRedemption ? 'Session Balance' : 'Amount'}</p>
                      <p className="font-bold text-primary mt-0.5 font-mono">
                        {isCourseRedemption ? `0.000 ${currency} (Covered)` : `${computedTotal.toFixed(3)} ${currency}`}
                      </p>
                    </div>
                    {isCourseRedemption && Boolean(subPrice) && (
                      <div className="rounded-xl bg-card border border-border/40 p-2.5">
                        <p className="text-[10px] text-muted-foreground font-medium">Package Total Price</p>
                        <p className="font-bold text-foreground mt-0.5 font-mono">{parseFloat(subPrice).toFixed(3)} {subCurrency}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-medium">Transaction / Ref ID</p>
                        {Boolean(transactionId) && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(transactionId);
                              setCopiedType('txn');
                              setTimeout(() => setCopiedType(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            {copiedType === 'txn' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                        {transactionId || 'Auto-generated upon settlement'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-card border border-border/40 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground font-medium">Trace / Auth Code</p>
                        {Boolean(traceId) && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(traceId);
                              setCopiedType('trace');
                              setTimeout(() => setCopiedType(null), 2000);
                            }}
                            className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            {copiedType === 'trace' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">
                        {traceId || '—'}
                      </p>
                    </div>
                  </div>

                  {Boolean(paidTimestamp) && (
                    <div className="rounded-xl bg-card border border-border/40 px-3 py-2 text-xs flex items-center justify-between text-muted-foreground">
                      <span>Paid Timestamp:</span>
                      <span className="font-medium text-foreground">{formatPaidTimestamp(String(paidTimestamp))}</span>
                    </div>
                  )}
                </div>

                {/* 3 & 4. Scanned Receipt Slip & Customer Payment Link in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Scanned Receipt / Slip */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Scanned Receipt / Slip
                        </h4>
                      </div>
                      {Boolean(receiptImg) && (
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Full Slip
                        </button>
                      )}
                    </div>

                    {Boolean(receiptImg) ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/70 p-3">
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted hover:opacity-90 transition cursor-zoom-in"
                        >
                          <img src={receiptImg} alt="Receipt slip" className="h-full w-full object-cover" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">Scanned Payment Receipt Attached</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Physical POS or bank voucher slip captured during booking check-in.</p>
                          <button
                            type="button"
                            onClick={() => setReceiptZoom(true)}
                            className="mt-1.5 text-xs font-semibold text-primary hover:underline"
                          >
                            Click to expand receipt image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground flex-1">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>No physical receipt slip uploaded for this transaction. Digital ledger record attached.</span>
                      </div>
                    )}
                  </div>

                  {/* Customer Payment Link */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 flex flex-col justify-between">
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
                            onClick={() => {
                              navigator.clipboard.writeText(effectivePaymentUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition cursor-pointer"
                            title="Copy Payment Link"
                          >
                            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedLink ? 'Copied' : 'Copy URL'}</span>
                          </button>
                          {!isCancelled && (
                            <a
                              href={effectivePaymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition cursor-pointer"
                              title="Redirect to Payment Link"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>Redirect</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {effectivePaymentUrl ? (
                      <div className="flex items-center gap-3.5 rounded-xl border border-border/40 bg-card/70 p-3 flex-1">
                        <div className="p-2 bg-white rounded-xl shadow-xs border border-border/50 shrink-0">
                          <QRCodeSVG
                            value={effectivePaymentUrl}
                            size={64}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-foreground">Scan QR Code to Pay</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Scan with a camera to open payment gateway, or use the copy and redirect options above.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground flex-1">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>No customer payment link generated for this booking.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5 & 6. Created By User & Status History in one row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Created By User Info */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 flex flex-col">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> Created By User
                    </p>
                    {createdByUserName || createdByUserObj || createdByUserRole || createdByUserType ? (
                      <div className="rounded-xl bg-card border border-border/50 p-3 space-y-1.5 text-xs flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {createdByUserName || (createdByUserObj?.email ? String(createdByUserObj.email).split('@')[0] : 'System')}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Boolean(createdByUserRole) && (
                              <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold capitalize">
                                {createdByUserRole}
                              </span>
                            )}
                            {Boolean(createdByUserType) && (!createdByUserRole || createdByUserType.toLowerCase() !== createdByUserRole.toLowerCase()) && (
                              <span className="rounded-full bg-secondary/80 text-secondary-foreground border border-border/50 px-2 py-0.5 text-[10px] font-semibold capitalize">
                                {createdByUserType}
                              </span>
                            )}
                          </div>
                        </div>
                        {Boolean(createdByUserRole) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Role:</span>{' '}
                            <span className="capitalize">{createdByUserRole}</span>
                          </p>
                        )}
                        {Boolean(createdByUserType) && (!createdByUserRole || createdByUserType.toLowerCase() !== createdByUserRole.toLowerCase()) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">User Type:</span>{' '}
                            <span className="capitalize">{createdByUserType}</span>
                          </p>
                        )}
                        {Boolean(createdByUserObj?.email) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Email:</span> {String(createdByUserObj?.email)}
                          </p>
                        )}
                        {Boolean(createdByUserObj?.phone_number) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Phone:</span> {String(createdByUserObj?.phone_number)}
                          </p>
                        )}
                        {Boolean(createdByUserObj?.branch_name || (createdByUserObj as any)?.branch) && (
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <span className="font-medium text-foreground">Branch:</span> {String(createdByUserObj?.branch_name ?? (createdByUserObj as any)?.branch)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3 text-xs text-muted-foreground flex-1 flex items-center">
                        <p className="italic">No creator user information available.</p>
                      </div>
                    )}
                  </div>

                  {/* Status History */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-primary" /> Status History
                      </p>
                      {loadingDetail && <span className="text-[10px] text-muted-foreground animate-pulse">Updating...</span>}
                    </div>
                    {historyList.length > 0 ? (
                      <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60 flex-1">
                        {historyList.map((item, idx) => {
                          const changeByData = (item.change_by_user_data && typeof item.change_by_user_data === 'object')
                            ? (item.change_by_user_data as Record<string, unknown>)
                            : null;
                          const changerFromData = changeByData
                            ? ((changeByData.full_name as string) ||
                               [changeByData.first_name, changeByData.last_name].filter(Boolean).join(' ') ||
                               (changeByData.name as string) ||
                               (changeByData.username as string) ||
                               (changeByData.email as string) ||
                               (changeByData.phone_number as string))
                            : null;
                          const changerRaw = (
                            changerFromData ||
                            (typeof item.change_by_user === 'string' &&
                             !/^[0-9a-f-]{10,}$/i.test(item.change_by_user) &&
                             item.change_by_user !== 'undefined' &&
                             item.change_by_user !== 'null'
                              ? item.change_by_user
                              : '') ||
                            (item.source === 'ushdesk' && user?.name ? user.name : '') ||
                            (item.source === 'ushspa' && booking.customer_name ? booking.customer_name : '') ||
                            (item.source && item.source !== 'undefined' ? String(item.source) : '') ||
                            'Staff'
                          ).trim();
                          const changer = changerRaw || 'Staff';
                          return (
                            <div key={idx} className="relative text-xs space-y-1">
                              <div className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-card" />
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-foreground">
                                  {item.old_status ? `${String(item.old_status)} → ` : ''}
                                  <span className="capitalize">{String(item.new_status)}</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground">· {formatDateTime(String(item.created_at))}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Changed by: <span className="font-medium text-foreground">{changer}</span>
                                {Boolean(item.source) && <span className="ml-1 text-[10px] text-muted-foreground/80">({String(item.source)})</span>}
                              </p>
                              {Boolean(item.reason) && (
                                <p className="text-[11px] text-muted-foreground bg-card p-1.5 rounded-lg border border-border/40 italic">
                                  &ldquo;{String(item.reason)}&rdquo;
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3 text-xs space-y-1 flex-1 flex flex-col justify-center">
                        <p className="font-medium text-foreground">Initial status: <span className="capitalize font-bold">{booking.status}</span></p>
                        <p className="text-[11px] text-muted-foreground">Recorded at: {formatDateTime(booking.created_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {(cancelError || completeError || noShowError || parkError) && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                {cancelError || completeError || noShowError || parkError}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className={cn(
            'shrink-0 border-t px-6 py-4 flex flex-col gap-2.5',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
          )}>
            <div className="flex flex-wrap items-center gap-2 justify-between">
              {/* Left side: Cancel, Reschedule, No Show */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Cancel Booking: visible if paid, not cancelled, and user has permission */}
                {canShowCancel && !isCompleted && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap active:scale-[0.98] border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 cursor-pointer"
                  >
                    Cancel Booking
                  </button>
                )}

                {/* Reschedule Booking: active paid/rewarded/pending, not cancelled, not completed, not no-show, with permission */}
                {hasReschedulePermission && !isCancelled && !isCompleted && !isNoShow && (isPaymentSuccess || isPaymentPending) && (
                  <button
                    type="button"
                    onClick={handleOpenReschedule}
                    disabled={!canReschedule}
                    title={rescheduleBlockReason}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap active:scale-[0.98]',
                      !canReschedule
                        ? 'border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                        : 'border-blue-300 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer'
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Reschedule
                  </button>
                )}

                {/* Mark No Show: shown when expired, paid, not cancelled, not completed, not already no_show, and user has permission */}
                {/* Park Booking: paid + confirmed bookings only; releases the appointment slot */}
                {canParkBooking && (
                  <button
                    type="button"
                    onClick={handleParkBooking}
                    disabled={parking}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-[0.98]',
                      parking
                        ? 'border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                        : 'border-violet-300 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60'
                    )}
                  >
                    {parking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                    {parking ? 'Parking…' : 'Park Booking'}
                  </button>
                )}

                {isPastApptEnd && !isCancelled && !isCompleted && !isNoShow && !isParked && isPaymentSuccess && hasNoShowPermission && (
                  <button
                    type="button"
                    onClick={handleMarkNoShow}
                    disabled={markingNoShow}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-[0.98]',
                      markingNoShow
                        ? 'border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                        : 'border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                    )}
                  >
                    {markingNoShow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                    {markingNoShow ? 'Updating…' : 'Mark No Show'}
                  </button>
                )}
              </div>

              {/* Right side: Payment Done, Open Payment, Print Receipt, Close */}
              <div className="flex items-center gap-2">
                {/* Save Staged Changes buttons */}
                {stagedSessions !== null && (
                  <div className="flex items-center gap-2 mr-1">
                    <button
                      type="button"
                      onClick={() => { setStagedSessions(null); setSaveSessionsError(null); }}
                      disabled={isSavingSessions}
                      className="rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStagedSessions}
                      disabled={isSavingSessions}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-extrabold shadow-md shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSavingSessions ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                {/* Make Payment */}
                {hasPaymentPermission && !isCancelled && !isNoShow && (!isPastApptEnd || String(detail?.booking_type ?? (booking.raw as any)?.booking_type ?? booking.booking_type ?? '').toLowerCase().startsWith('home')) && isPaymentPending && !isPaid && !isRewarded && (!effectivePaymentUrl || String(detail?.booking_type ?? (booking.raw as any)?.booking_type ?? booking.booking_type ?? '').toLowerCase().startsWith('home')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentError(null);
                      setShowPaymentRefModal(false);
                      setShowPaymentModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer whitespace-nowrap"
                  >
                    <CreditCard className="h-4 w-4" />
                    Make Payment
                  </button>
                )}

                {/* Open Payment */}
                {hasPaymentPermission && !isCancelled && !isNoShow && !isPastApptEnd && !isPaymentTabRestricted && effectivePaymentUrl && (
                  <a href={effectivePaymentUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer whitespace-nowrap">
                    <ExternalLink className="h-3.5 w-3.5" /> Open Payment
                  </a>
                )}

                {/* Print Receipt */}
                {hasPrintReceiptPermission && !isNoShow && (() => {
                  const rawPaymentStatus = String(detail?.payment_status ?? (detail as any)?.paymentStatus ?? booking.payment_status ?? '').toLowerCase().trim();
                  const isStepAndPaid = ['confirmed', 'checked_in', 'in_progress', 'completed'].includes(normStatus) && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
                  const isConfirmedAndPaid = curStatus === 'confirmed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
                  const isCompletedAndPaid = curStatus === 'completed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
                  const showPrintReceiptBtn = isStepAndPaid || isConfirmedAndPaid || isCompletedAndPaid;
                  if (!showPrintReceiptBtn) return null;
                  if (isPastApptEnd && !isCompletedAndPaid) return null;
                  return (
                    <button
                      type="button"
                      onClick={handlePrintReceipt}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer whitespace-nowrap',
                        isCompleted
                          ? 'bg-[#3D2F27] hover:bg-[#281E18] text-white'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white'
                      )}
                    >
                      <Printer className="h-4 w-4" />
                      Print Receipt
                    </button>
                  );
                })()}

                <button
                  onClick={onClose}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap',
                    isCompleted
                      ? 'border border-[#B8A394] bg-white/40 hover:bg-white/60 text-[#2D241E]'
                      : 'border border-border/60 bg-muted/40 hover:bg-muted text-foreground'
                  )}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Session Modal (services add/edit/delete) ── */}
      {editingSessionIndex !== null && displaySessions[editingSessionIndex] && (
        <EditSessionModal
          isOpen={true}
          restrictToSamePrice={isPaidEditableBooking || isPackageBooking}
          isPackageBooking={isPackageBooking}
          addons={getSessionAddons(displaySessions[editingSessionIndex]?.raw as any)}
          sessionIndex={editingSessionIndex}
          sessionNumber={editingSessionIndex + 1}
          sessionData={displaySessions[editingSessionIndex]}
          branchId={String(detail?.branch_id || (booking as any)?.branch_id || '')}
          serviceArrangementId={String(
            (displaySessions[editingSessionIndex]?.raw as any)?.service_arrangement_id ||
            (displaySessions[editingSessionIndex]?.raw as any)?.service_arrangement_data?.id ||
            detail?.service_arrangement_id ||
            (booking as any)?.service_arrangement_id ||
            ''
          )}
          currency={currency}
          onClose={() => setEditingSessionIndex(null)}
          onUpdate={handleUpdateSessionServices}
        />
      )}

      {/* ── Add Session Sub Modal ── */}
      {showAddSessionModal && (
        <AddSessionSubModal
          authHeader={authHeader}
          branchId={String(detail?.branch_id || (booking as any)?.branch_id || (booking as any)?.branch?.id || '')}
          date={bookingDate}
          defaultTherapistId={defTherapistId}
          defaultTherapistName={defTherapistName}
          defaultTimeSlot={nextSessionDefaultTimeSlot}
          sessionIndex={displaySessions.length}
          minStartTimeMinutes={nextSessionMinStartMinutes}
          minStartTimeDisplay={nextSessionDefaultTimeSlot}
          onClose={() => setShowAddSessionModal(false)}
          onAddSession={handleAddSessionFromModal}
        />
      )}

      {/* Reschedule Booking Modal */}
      {showRescheduleModal && booking && (
        <RescheduleBookingModal
          bookingId={booking.id}
          initialBooking={(detail || booking) as unknown as Record<string, any>}
          onClose={() => setShowRescheduleModal(false)}
          onSuccess={() => {
            setShowRescheduleModal(false);
            onSuccess?.();
            onClose();
          }}
          initialRescheduleParams={rescheduleFetchState?.params}
          initialAvailabilitiesPromise={rescheduleFetchState?.promise}
        />
      )}

      {/* Session Details popup */}
      {(() => {
        const activeSess = activeSessionId
          ? displaySessions.find((x) => String(x.raw?.session_id ?? '') === activeSessionId)
          : null;
        if (!activeSess || showSessionTherapistModal) return null;
        const canChange = !isCancelled && !isCompleted;
        return (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setActiveSessionId(null)}>
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#b85d63] text-sm font-bold text-white">{activeSess.number}</span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Session {activeSess.number}</p>
                    <h3 className="text-sm font-extrabold text-foreground">{activeSess.serviceName}</h3>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveSessionId(null)} className="rounded-full p-2 text-muted-foreground hover:bg-muted cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 px-5 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time</span>
                  <span className="font-semibold text-foreground">{activeSess.timeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arrangement / Room</span>
                  <span className="font-semibold text-foreground">{activeSess.roomName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Therapist</span>
                  <span className="flex items-center gap-2 font-semibold text-foreground text-right">
                    {activeSess.therapistName}
                    {activeSess.secondaryTherapistName ? ` + ${activeSess.secondaryTherapistName}` : ''}
                    {canChange && (
                      <button
                        type="button"
                        onClick={() => setShowSessionTherapistModal(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/15 transition cursor-pointer"
                      >
                        <UserCog className="h-3 w-3" /> Change
                      </button>
                    )}
                  </span>
                </div>
                {!isPackageBooking && (
                  <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session price</span>
                    <span className="font-mono font-extrabold text-[#b85d63]">{activeSess.price.toFixed(3)} {currency}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end border-t border-border/50 bg-muted/20 px-5 py-3">
                <button type="button" onClick={() => setActiveSessionId(null)} className="rounded-xl border border-border/60 bg-background px-4 py-2 text-xs font-semibold hover:bg-muted transition cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Change Therapist Modal (single session) */}
      {showSessionTherapistModal && (() => {
        const activeSess = displaySessions.find((x) => String(x.raw?.session_id ?? '') === activeSessionId);
        if (!activeSess?.raw) return null;
        return (
          <ChangeTherapistModal
            bookingId={booking.id}
            initialBooking={(detail || booking) as unknown as Record<string, any>}
            session={activeSess.raw as Record<string, any>}
            currentTherapistName={activeSess.therapistName}
            secondaryTherapistName={activeSess.secondaryTherapistName ?? undefined}
            targetSlot="primary"
            onClose={() => setShowSessionTherapistModal(false)}
            onSuccess={(_t, _slot, freshBooking) => {
              if (freshBooking && typeof freshBooking === 'object') {
                setDetail(freshBooking as Record<string, unknown>);
              }
              setShowSessionTherapistModal(false);
              onSuccess?.();
            }}
          />
        );
      })()}

      {/* Change Therapist Modal */}
      {showChangeTherapistModal && (
        <ChangeTherapistModal
          bookingId={booking.id}
          initialBooking={(detail || booking) as unknown as Record<string, any>}
          currentTherapistName={primaryTherapistName}
          secondaryTherapistName={secondaryTherapistName}
          targetSlot={changeTherapistTarget}
          onClose={() => setShowChangeTherapistModal(false)}
          onSuccess={(updatedTherapist, slot, freshBooking) => {
            if (freshBooking && typeof freshBooking === 'object') {
              setDetail(freshBooking as Record<string, unknown>);
            } else {
              const tName =
                updatedTherapist?.name ||
                updatedTherapist?.full_name ||
                updatedTherapist?.therapist_name ||
                '';
              const effectiveSlot = slot || changeTherapistTarget;
              setDetail((prev) => {
                if (!prev) return prev;
                if (effectiveSlot === 'secondary') {
                  return {
                    ...prev,
                    secondary_therapist_id: updatedTherapist.id || updatedTherapist.therapist_id,
                    secondary_therapist_data: updatedTherapist.therapist_data || updatedTherapist,
                    secondary_therapist_name: tName || (prev as any).secondary_therapist_name,
                  };
                }
                return {
                  ...prev,
                  therapist_id: updatedTherapist.id || updatedTherapist.therapist_id,
                  therapist_data: updatedTherapist.therapist_data || updatedTherapist,
                  therapist_name: tName || (prev as any).therapist_name,
                };
              });
            }
            // Refetch fresh booking detail
            authedFetch(`/booknpay/api/v1/bookings/${booking.id}/`)
              .then((r) => r.json())
              .then((res) => {
                if (res?.data) setDetail(res.data);
              })
              .catch(() => {});
            onSuccess?.();
          }}
        />
      )}

      {/* Booking Receipt Modal Preview & Print */}
      {showReceiptModal && (
        <BookingReceiptModal
          data={{
            bookingNumber: booking.booking_number,
            reference: booking.booking_number || booking.id,
            invoiceNumber: invoiceNumber || (booking as any)?.invoice_number || (detail as any)?.invoice_number || null,
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            customerEmail: booking.customer_email,
            branchName: booking.branch_name,
            arrangementName: booking.arrangement_name,
            therapistName: primaryTherapistName !== '—' ? primaryTherapistName : booking.therapist_name,
            secondaryTherapistName: secondaryTherapistName || null,
            serviceName: booking.service_name,
            serviceCategory: booking.service_category,
            servicePrice: servicePrice,
            services: receiptServices,
            isPackageBooking: isPackageBooking,
            packageName: packageName,
            packagePrice: effectivePackagePrice,
            appointmentStart: booking.appointment_start,
            appointmentEnd: booking.appointment_end,
            appointmentDate: formatDate(booking.appointment_start),
            timeSlot: `${formatTime(booking.appointment_start)} – ${formatTime(booking.appointment_end)}`,
            totalDuration: totalDuration,
            serviceDuration: serviceDuration,
            addonsDuration: effAddonsDuration,
            extraMinutes: effExtraMinutes,
            extraPrice: extraPrice,
            addons: effAddons.map((a, idx) => ({
              name: String(a.name ?? a.addon_name ?? `Addon #${idx + 1}`),
              price: parseFloat(String(a.price ?? a.base_price ?? '0')) || 0,
              duration: Number(a.duration_minutes ?? a.duration ?? 0),
            })),
            currency: currency,
            subtotal: subtotalPrice,
            discount: discountAmount,
            totalAmount: computedTotal,
            status: 'completed',
            paymentStatus: String(detail?.payment_status ?? booking.payment_status ?? 'success'),
            paymentMethod: isCourseRedemption ? (subPaymentMethod || 'Course Package') : (booking.payment_method || booking.payment_provider || 'Desk Payment'),
            paymentProvider: isCourseRedemption ? (subPaymentProvider || 'Course Package') : (booking.payment_provider || booking.payment_gateway),
            transactionId: String(paymentDataObj?.transaction_id ?? (isCourseRedemption ? subTxRef : '')),
            referenceId: String(paymentDataObj?.reference_id ?? (isCourseRedemption ? (subPaymentNumber || courseSubNumber) : '')),
            paidAt: String(paymentDataObj?.paid_at ?? (isCourseRedemption ? subPaidAt : '')),
            isCourseRedemption: isCourseRedemption,
            courseCode: courseCode || null,
            courseName: courseName || null,
            courseSubscriptionNumber: courseSubNumber || null,
            currentSessionNumber: currentSessionNumber,
            totalSessions: totalCourseSessions,
            remainingSessions: remainingCourseSessions,
            subscriptionPrice: subPrice || null,
            subscriptionPaymentMethod: subPaymentMethod || null,
            subscriptionPaymentProvider: subPaymentProvider || null,
            subscriptionInvoiceNumber: subInvoiceNumber || null,
            isVoucherRedemption: isGiftVoucherBooking || Boolean(detail?.voucher_id || (booking.raw as any)?.voucher_id),
            isVoucherPackage: Boolean(
              (detail?.voucher_data as any)?.is_package ||
              (booking.raw as any)?.voucher_data?.is_package ||
              (detail as any)?.is_packaged_services ||
              (booking.raw as any)?.is_packaged_services
            ),
            voucherPackageName: String(
              (detail?.voucher_data as any)?.package_name ||
              (booking.raw as any)?.voucher_data?.package_name ||
              (detail as any)?.package_name ||
              (booking.raw as any)?.package_name ||
              ''
            ).trim() || null,
            voucherPackagePrice: (detail?.voucher_data as any)?.package_price ?? (booking.raw as any)?.voucher_data?.package_price ?? null,
            voucherCode: (detail?.voucher_data as any)?.voucher_number || (detail?.voucher_data as any)?.secret_code || (booking.raw as any)?.voucher_data?.voucher_number || null,
            isPartialRedeem: Boolean(
              (detail?.voucher_data as any)?.is_partial ||
              (booking.raw as any)?.voucher_data?.is_partial ||
              ((detail?.voucher_data as any)?.remaining_services && (detail?.voucher_data as any).remaining_services.length > 0) ||
              ((booking.raw as any)?.voucher_data?.remaining_services && (booking.raw as any).voucher_data.remaining_services.length > 0)
            ),
            redeemedServices: (detail?.voucher_data as any)?.redeemed_services || (booking.raw as any)?.voucher_data?.redeemed_services || null,
            remainingServices: (detail?.voucher_data as any)?.remaining_services || (booking.raw as any)?.voucher_data?.remaining_services || null,
          }}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* ── Scanned Receipt Slip Zoom Modal ── */}
      {receiptZoom && Boolean(receiptImg) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setReceiptZoom(false)} />
          <div className="relative z-10 max-w-2xl w-full max-h-[85vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Scanned Receipt Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptZoom(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 dark:bg-black/40">
              <img
                src={receiptImg}
                alt="Receipt slip full view"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-border/40"
              />
            </div>
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Invoice Reference: <strong className="font-mono text-foreground">{invoiceNumber || 'Attached'}</strong></p>
              <a
                href={receiptImg}
                download="booking-receipt-slip"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal Popup ── */}
      {showInvoiceModal && (
        <InvoiceDetailModal
          invoiceNumber={invoiceNumber || (invoiceRecord?.name as string) || ''}
          invoiceRecord={invoiceRecord}
          bookingData={{
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            customerEmail: booking.customer_email,
            serviceName: booking.service_name,
            serviceCategory: booking.service_category,
            servicePrice: servicePrice,
            addons: effAddons as any,
            extraMinutes: effExtraMinutes,
            extraPrice: extraPrice,
            totalPrice: computedTotal,
            currency: currency,
            paymentMethod: booking.payment_method,
            paymentProvider: paymentProvider,
            paymentThrough: String(detail?.payment_through ?? (booking.raw as any)?.payment_through ?? 'ushdesk'),
            paymentDate: String(paymentDataObj?.paid_at ?? booking.created_at ?? ''),
            transactionId: transactionId || undefined,
            traceId: traceId || undefined,
            bookingNumber: booking.booking_number,
            branchName: booking.branch_name,
            status: curStatus || booking.status,
            pricing: pricingObj,
          }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* ── Booking Cancellation Modal (with refund/accounting) ── */}
      {showCancellationModal && booking && (
        <BookingCancellationModal
          bookingId={booking.id}
          bookingNumber={booking.booking_number || null}
          invoiceNumber={invoiceNumber || null}
          isPaid={isPaymentSuccess}
          bookingStatus={curStatus || booking.status}
          paymentStatus={rawPaymentStatus || booking.payment_status}
          totalAmount={computedTotal}
          totalDuration={totalDuration}
          currency={currency}
          paymentMethod={paymentProvider !== 'Front Desk' ? paymentProvider : null}
          customerName={booking.customer_name || (detail as any)?.customer_name || null}
          customerPhone={booking.customer_phone || (detail as any)?.customer_phone || null}
          paymentUrl={effectivePaymentUrl || null}
          customerId={
            String(
              (detail as any)?.customer_id ??
              (booking.raw as any)?.customer_id ??
              (booking as any).customer_id ??
              ''
            ).trim() || undefined
          }
          customerData={
            (detail as any)?.customer_data ??
            (booking.raw as any)?.customer_data ??
            null
          }
          bookingType={
            String(
              (detail as any)?.booking_type ??
              (booking.raw as any)?.booking_type ??
              booking.booking_type ??
              ''
            ).trim() || undefined
          }
          onClose={() => setShowCancellationModal(false)}
          onSuccess={() => {
            setShowCancellationModal(false);
            onSuccess?.();
            onClose();
          }}
        />
      )}
    </>
  );
}

