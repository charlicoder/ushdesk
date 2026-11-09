'use client';
/**
 * RedeemVoucherModal
 *
 * "New Appointment Booking" modal for Gift Voucher redemption.
 * 3-step wizard with multi-session support (1–3 sessions):
 * - Step 1: Add Sessions (Branch & Date in header, sub-popup to configure each session)
 * - Step 2: Customer & Notes
 * - Step 3: Confirm Booking (Sessions list, pricing, discount, payment option)
 *
 * Backward-compatible: sends both legacy flat fields AND sessions[] array.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, AlertCircle, X,
  Timer, Loader2, Scissors, Package, User, Phone, Mail,
  DollarSign, FileText, ChevronLeft, ChevronRight, CalendarCheck,
  LayoutGrid, Crown, Heart, Sparkles, Layers, Store, UserPlus,
  CreditCard, Hash, Building2, Trash2, Plus, Users, Receipt, Gift,
  MapPin, Check, Printer,
} from 'lucide-react';
import { BookingReceiptModal } from './BookingReceiptModal';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import {
  kuwaitDateString,
  toZonedIsoFromLocal,
  buildAppointmentWindow,
  parseClockToMinutes,
  DEFAULT_TIMEZONE as KUWAIT_TZ,
} from '@/lib/datetime';
import { useAppSelector } from '@/store/hooks';
import { usePermissions } from '@/hooks/use-permissions';
import { CreateCustomerModal, type CreatedCustomer } from './CreateCustomerModal';
import { MultiSelectDrop } from './MultiSelectDrop';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface RedeemVoucherModalProps {
  voucher: AnyRecord;
  invoiceNumber?: string | null;
  paymentNumber?: string | null;
  token?: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialAvailabilitiesPromise?: Promise<any> | null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiBranch {
  id?: string;
  branch_id?: string;
  name?: string;
  branch_name?: string;
}

interface ApiArrangement {
  id: string;
  name: string;
  arrangement_name?: string;
  arrangement_type?: string;
  type?: string;
  capacity?: number;
  arrangement_price?: string | number;
  base_price?: string | number;
  branch_id?: string;
  branch_name?: string;
  is_active?: boolean;
  image?: string | null;
  photo_url?: string | null;
  thumbnail?: string | null;
  availabilities?: Record<string, string[]>;
}

interface ApiTherapist {
  id?: string;
  therapist_id?: string;
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  therapist_name?: string;
  full_name?: string;
  avatar?: string;
  photo_url?: string;
  profile_picture?: string;
  specialties?: Array<{ id: string; name: string }>;
  specialization?: string;
  availabilities?: Record<string, string[]>;
}

interface ApiService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  arrangement_price?: string | number;
  price_for_extra_minutes?: string | number;
  extra_minutes?: number;
  category?: string;
  add_ons?: ApiAddOn[];
  is_packaged_services?: boolean | string | number;
  image?: string | null;
  [key: string]: unknown;
}

interface ApiAddOn {
  id: string;
  name: string;
  price?: string | number;
  duration_minutes?: number;
}

interface ApiCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  avatar?: string;
}

export interface VoucherSession {
  id: string;
  therapistId: string;
  therapistName: string;
  therapistAvatar?: string;
  secondaryTherapistId?: string;
  secondaryTherapistName?: string;
  secondaryTherapistAvatar?: string;
  arrangementId: string;
  arrangementName: string;
  arrangementType: string;
  serviceIds: string[];
  services: ApiService[];
  addonIds: string[];
  arrangementAddonIds: string[];
  allAddons: ApiAddOn[];
  /** Internal ids of the voucher add-on units used by this session */
  addonUids?: string[];
  extraMinutes: number;
  extraMinutesPrice: number;
  /** What of the voucher this session consumes (sent to the voucher as a partial redemption) */
  redemptionServices?: Array<{ service_id: string; service_name: string; addon_ids: string[]; extra_time: number }>;
  startTime: string; // "10:00 AM" or "10:00"
  totalDuration: number;
  sessionPrice: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstTruthy(...args: unknown[]): string {
  for (const a of args) {
    if (a !== undefined && a !== null && String(a).trim() !== '') return String(a).trim();
  }
  return '';
}

function normalizeArrType(t: unknown): string {
  const s = String(t ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s.includes('couple')) return 'couple_room';
  if (s.includes('double')) return 'double_room';
  if (s.includes('single')) return 'single_room';
  if (s.includes('vip')) return 'vip_suite';
  if (s.includes('private')) return 'private_suite';
  if (s.includes('open')) return 'open_area';
  return s;
}

function fmt(val: unknown): string {
  if (val === undefined || val === null || val === '') return '0.000';
  const n = parseFloat(String(val));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

function getTherapistDisplayName(t: ApiTherapist | null | undefined): string {
  if (!t) return 'Therapist';
  const name = t.full_name ?? t.name ?? t.therapist_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
  return (name && String(name).trim()) || 'Therapist';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toHHMM(label: string): string {
  if (!label) return '10:00:00';
  const clean = label.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(clean)) {
    const parts = clean.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  }
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '10:00:00';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = (match[3] ?? '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}:00`;
}

function parseTimeToMinutes(str: string): number {
  if (!str) return 0;
  const s = str.trim();
  const matchAmPm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1], 10);
    const m = parseInt(matchAmPm[2], 10);
    const period = matchAmPm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const match24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 0;
}

function addMinutesToHHMM(hhmm: string, mins: number): string {
  const total = parseTimeToMinutes(hhmm) + mins;
  const h24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

const ARRANGEMENT_CFG: Record<string, { label: string; Icon: React.ElementType; gradient: string; iconColor: string }> = {
  open_area:     { label: 'Open Area',     Icon: LayoutGrid, gradient: 'from-sky-400 via-cyan-500 to-blue-600', iconColor: 'text-sky-200' },
  vip_suite:     { label: 'VIP Suite',     Icon: Crown,      gradient: 'from-amber-400 via-yellow-500 to-orange-600', iconColor: 'text-amber-200' },
  couple_room:   { label: 'Couple Room',   Icon: Heart,      gradient: 'from-rose-400 via-pink-500 to-fuchsia-600', iconColor: 'text-rose-200' },
  double_room:   { label: 'Double Room',   Icon: Heart,      gradient: 'from-pink-400 via-rose-500 to-red-600', iconColor: 'text-pink-200' },
  single_room:   { label: 'Single Room',   Icon: Sparkles,   gradient: 'from-violet-400 via-purple-500 to-indigo-600', iconColor: 'text-violet-200' },
  private_suite: { label: 'Private Suite', Icon: Layers,     gradient: 'from-teal-400 via-emerald-500 to-green-600', iconColor: 'text-teal-200' },
  other:         { label: 'Arrangement',   Icon: Store,      gradient: 'from-slate-400 via-gray-500 to-zinc-600', iconColor: 'text-slate-200' },
};
const getArrCfg = (t?: string) => ARRANGEMENT_CFG[t ?? 'other'] ?? ARRANGEMENT_CFG.other;

function isDoubleOccupancy(type?: string): boolean {
  return type === 'couple_room' || type === 'double_room';
}

function isSimilarArrangementType(typeA: string, typeB: string): boolean {
  if (!typeA || !typeB) return true;
  const a = typeA.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = typeB.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a === b) return true;
  if (a === 'room' || b === 'room' || a === 'suite' || b === 'suite' || a === 'arrangement' || b === 'arrangement') {
    return true;
  }
  const categories = ['vip', 'couple', 'single', 'open', 'private'];
  for (const cat of categories) {
    if (a.includes(cat) && b.includes(cat)) return true;
  }
  return a.includes(b) || b.includes(a);
}

// ── SearchDrop Generic Component ─────────────────────────────────────────────

interface SearchDropProps<T> {
  value: string;
  placeholder: string;
  loading?: boolean;
  items: T[];
  isSelected: (item: T) => boolean;
  selectedItem?: T | null;
  icon?: React.ElementType;
  onSearch: (q: string) => void;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderItem: (item: T) => React.ReactNode;
  getKey?: (item: T, idx: number) => string | number;
  disabled?: boolean;
}

function SearchDrop<T>({
  value, placeholder, loading, items, isSelected, selectedItem,
  icon: Icon, onSearch, onSelect, onClear, renderItem, getKey, disabled,
}: SearchDropProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sel = selectedItem != null;

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        {Icon && (
          <div className="pointer-events-none absolute left-3 z-10 grid h-5 w-5 place-items-center text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <input
          value={sel ? (value || '— selected —') : value}
          onChange={(e) => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => { if (!sel && !disabled) setOpen(true); }}
          placeholder={placeholder}
          readOnly={sel || disabled}
          disabled={disabled}
          className={cn(
            'h-10 w-full rounded-xl border border-border bg-muted/30 pr-8 text-sm outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50',
            Icon ? 'pl-9' : 'pl-3',
            sel ? 'font-medium text-foreground cursor-default bg-emerald-500/5 border-emerald-500/30' : '',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          )}
        />
        {loading && <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {sel && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 grid h-5 w-5 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && !sel && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">
              {loading ? 'Loading…' : 'No results'}
            </p>
          ) : (
            (() => {
              const seen = new Set<string>();
              return items.map((item, idx) => {
                const rawKey = getKey ? getKey(item, idx) : (item as Record<string, unknown>)?.id ?? idx;
                let key = String(rawKey);
                if (seen.has(key)) key = `${key}-${idx}`;
                seen.add(key);
                return (
                  <div
                    key={key}
                    onClick={() => { onSelect(item); setOpen(false); }}
                    className={cn('cursor-pointer transition hover:bg-muted/60', isSelected(item) && 'bg-primary/5')}
                  >
                    {renderItem(item)}
                  </div>
                );
              });
            })()
          )}
        </div>
      )}
    </div>
  );
}

// ── Calendar Picker Component ────────────────────────────────────────────────

function VoucherCalendarPicker({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (d: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const todayStr = kuwaitDateString();
  const initial = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const canGoPrev = useMemo(() => {
    if (!minDate) return true;
    const minD = new Date(minDate + 'T00:00:00');
    const firstOfCurrent = new Date(viewYear, viewMonth, 1);
    return firstOfCurrent > new Date(minD.getFullYear(), minD.getMonth(), 1);
  }, [minDate, viewYear, viewMonth]);

  const canGoNext = useMemo(() => {
    if (!maxDate) return true;
    const maxD = new Date(maxDate + 'T00:00:00');
    const lastOfCurrent = new Date(viewYear, viewMonth + 1, 0);
    return lastOfCurrent < maxD;
  }, [maxDate, viewYear, viewMonth]);

  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-sm select-none">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-xl border border-border/60 transition cursor-pointer',
            canGoPrev ? 'hover:bg-muted text-foreground' : 'opacity-25 cursor-not-allowed text-muted-foreground'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <p className="text-xs sm:text-sm font-bold text-foreground">{monthName}</p>
          {todayStr && (
            <button
              type="button"
              onClick={() => {
                const t = new Date(todayStr + 'T00:00:00');
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                onChange(todayStr);
              }}
              className="text-[10px] font-semibold text-primary hover:underline px-2 py-0.5 rounded-md bg-primary/10 transition cursor-pointer"
            >
              Today
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-xl border border-border/60 transition cursor-pointer',
            canGoNext ? 'hover:bg-muted text-foreground' : 'opacity-25 cursor-not-allowed text-muted-foreground'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="text-[10px] font-bold text-muted-foreground py-0.5">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <span key={`b-${i}`} className="h-8 w-8 mx-auto" />
        ))}
        {days.map((d) => {
          const mm = String(viewMonth + 1).padStart(2, '0');
          const dd = String(d).padStart(2, '0');
          const dateStr = `${viewYear}-${mm}-${dd}`;

          const isSel = value === dateStr;
          const isToday = todayStr === dateStr;
          const isDisabled =
            (Boolean(minDate) && dateStr < minDate!) ||
            (Boolean(maxDate) && dateStr > maxDate!);

          return (
            <button
              key={d}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              className={cn(
                'h-8 w-8 mx-auto rounded-xl text-xs font-semibold transition flex items-center justify-center',
                isDisabled
                  ? 'opacity-25 cursor-not-allowed text-muted-foreground pointer-events-none'
                  : isSel
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : isToday
                  ? 'border border-primary text-primary font-bold hover:bg-primary/10 cursor-pointer'
                  : 'hover:bg-muted text-foreground cursor-pointer'
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface GiftedService {
  id: string;
  name: string;
  duration: number;
  price: unknown;
  addons: ApiAddOn[];
  extra: { minutes: number; price: number };
}

function mapAddons(raw: unknown): ApiAddOn[] {
  return (Array.isArray(raw) ? raw : []).map((a: AnyRecord, i: number) => ({
    id: String(a.id ?? a.addon_id ?? `addon-${i}`),
    name: String(a.name ?? a.addon_name ?? 'Add-on'),
    price: a.price ?? 0,
    duration_minutes: Number(a.duration_minutes ?? a.duration ?? 0) || 0,
  }));
}

/**
 * Gifted services of a voucher, each with its own add-ons / extra time.
 * Legacy single-service vouchers (no `services`) are returned as one entry.
 */
function getVoucherServices(voucher: AnyRecord): GiftedService[] {
  // Services already used by earlier (partial) redemptions are no longer redeemable
  const usedIds = new Set<string>(
    (Array.isArray(voucher?.redemptions) ? voucher.redemptions : []).flatMap((r: AnyRecord) =>
      (Array.isArray(r?.services) ? r.services : []).map((x: AnyRecord) => String(x?.service_id ?? ''))
    )
  );
  const list: AnyRecord[] =
    Array.isArray(voucher?.services) && voucher.services.length > 0
      ? voucher.services
      : [
          {
            service_id: voucher?.service_id,
            service_data: voucher?.service_data,
            addons: voucher?.addons,
            extra_time: voucher?.extra_time,
            price_for_extra_time: voucher?.price_for_extra_time,
          },
        ];
  const single = list.length === 1;
  return list
    .filter((e) => !usedIds.has(String(e.service_id ?? e.service_data?.id ?? '')))
    .map((e, i) => ({
    id: String(e.service_id ?? e.service_data?.id ?? `svc-${i}`),
    name: firstTruthy(e.service_data?.name, e.service_data?.service_name, 'Spa Service'),
    duration: parseInt(String(e.service_data?.duration_minutes ?? 0), 10) || 0,
    price: e.service_data?.base_price ?? (single ? voucher?.total_amount : undefined),
    addons: mapAddons(e.addons),
    extra: {
      minutes: Number(e.extra_time) > 0 ? Number(e.extra_time) : 0,
      price: parseFloat(String(e.price_for_extra_time ?? 0)) || 0,
    },
  }));
}

/** Read-only list of what the gift voucher already covers: services, their add-ons and extra time. */
function VoucherCoverageList({
  voucher,
  currency,
  isPackage,
  packagePrice,
}: {
  voucher: AnyRecord;
  currency: string;
  isPackage?: boolean;
  packagePrice?: number | string;
}) {
  const gifted = getVoucherServices(voucher);
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 divide-y divide-emerald-500/15 overflow-hidden">
      {gifted.map((g) => (
        <React.Fragment key={g.id}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Scissors className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{g.name}</p>
                <p className="text-[11px] text-muted-foreground">Service{g.duration > 0 ? ` · ${g.duration} min` : ''}</p>
              </div>
            </div>
            {isPackage ? (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full shrink-0">
                Included in Package
              </span>
            ) : g.price != null ? (
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">{fmt(g.price)} {currency}</span>
            ) : null}
          </div>
          {!isPackage && g.addons.map((a) => (
            <div key={`${g.id}-${a.id}`} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">Add-on{a.duration_minutes ? ` · ${a.duration_minutes} min` : ''}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-foreground shrink-0">{fmt(a.price)} {currency}</span>
            </div>
          ))}
          {!isPackage && g.extra.minutes > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex items-center gap-2.5">
                <Timer className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Extra Time</p>
                  <p className="text-[11px] text-muted-foreground">+{g.extra.minutes} min</p>
                </div>
              </div>
              {g.extra.price > 0 && <span className="text-xs font-bold text-foreground shrink-0">{fmt(g.extra.price)} {currency}</span>}
            </div>
          )}
        </React.Fragment>
      ))}
      {isPackage && packagePrice != null && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20 text-xs">
          <span className="font-bold text-foreground">Package Total Price</span>
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
            {fmt(packagePrice)} {currency}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Voucher add-on pool ──────────────────────────────────────────────────────
// Add-ons of a voucher are NOT bound to a service: any still-unused add-on can be attached to any
// service of any session (or left for a later redemption).

interface PoolAddon extends ApiAddOn {
  /** Unique id of this gifted add-on unit within the voucher */
  uid: string;
  /** Service the add-on was originally gifted with (only used as the default attachment) */
  originServiceId: string;
}

function getVoucherAddonPool(voucher: AnyRecord): PoolAddon[] {
  const pool: PoolAddon[] = [];
  if (voucher?.__package) {
    mapAddons(voucher.__package.addons).forEach((a, i) =>
      pool.push({ ...a, uid: `pkg:${a.id}:${i}`, originServiceId: '' })
    );
  } else {
    const raw: AnyRecord[] =
      Array.isArray(voucher?.services) && voucher.services.length > 0
        ? voucher.services
        : [{ service_id: voucher?.service_id, service_data: voucher?.service_data, addons: voucher?.addons }];
    raw.forEach((e, si) => {
      const sid = String(e.service_id ?? e.service_data?.id ?? `svc-${si}`);
      mapAddons(e.addons).forEach((a, i) => pool.push({ ...a, uid: `${sid}:${a.id}:${i}`, originServiceId: sid }));
    });
  }
  // Remove add-ons already consumed by earlier (partial) redemptions
  const used = new Map<string, number>();
  (Array.isArray(voucher?.redemptions) ? voucher.redemptions : []).forEach((r: AnyRecord) =>
    (Array.isArray(r?.services) ? r.services : []).forEach((x: AnyRecord) =>
      (Array.isArray(x?.addon_ids) ? x.addon_ids : []).forEach((id: unknown) =>
        used.set(String(id), (used.get(String(id)) ?? 0) + 1)
      )
    )
  );
  return pool.filter((a) => {
    const n = used.get(a.id) ?? 0;
    if (n > 0) {
      used.set(a.id, n - 1);
      return false;
    }
    return true;
  });
}

/** Arrangement type required by the voucher for the given service(s), if any. */
function computeRequiredArrType(voucher: AnyRecord, serviceIds: string[]): string {
  const rawServices: AnyRecord[] = Array.isArray(voucher.services) ? voucher.services : [];
  const matchedSvc = rawServices.find((s) => serviceIds.includes(String(s.service_id ?? s.service_data?.id ?? '')));
  if (matchedSvc) {
    const svcType = normalizeArrType(
      firstTruthy(
        matchedSvc.service_arrangement_data?.arrangement_type,
        matchedSvc.service_arrangement_data?.type,
        matchedSvc.arrangement_type,
        matchedSvc.room_type,
        matchedSvc.service_arrangement_data?.room_type,
        matchedSvc.service_arrangement_data?.arrangement_name,
        matchedSvc.service_arrangement_data?.room,
        matchedSvc.arrangement_name
      )
    );
    if (svcType) return svcType;
  }
  if (rawServices.length <= 1) {
    return normalizeArrType(
      firstTruthy(
        voucher.service_arrangement_data?.arrangement_type,
        voucher.service_arrangement_data?.type,
        voucher.arrangement_type,
        voucher.room_type,
        voucher.service_arrangement_data?.room_type,
        voucher.service_arrangement_data?.arrangement_name,
        voucher.service_arrangement_data?.room,
        voucher.arrangement_name
      )
    );
  }
  return '';
}

const arrTypeKey = (a: ApiArrangement) =>
  normalizeArrType(a.arrangement_type || a.type || a.name || a.arrangement_name) || `id:${a.id}`;

// ── Per-service session block (room, time slot, therapist, add-ons) ──────────

interface SessionReport {
  draft: VoucherSession | null;
  missing: string | null;
  duration: number;
  price: number;
}

interface ServiceSessionBlockProps {
  gifted: GiftedService;
  service: ApiService | undefined;
  servicesLoading: boolean;
  showTitle: boolean;
  isPkg: boolean;
  pkgId: string;
  giftedCount: number;
  branchId: string;
  selectedDate: string;
  voucher: AnyRecord;
  availabilitiesData: any;
  authHeader: string;
  addonPool: PoolAddon[];
  blockAddons: PoolAddon[];
  assignedTo: (uid: string) => string;
  serviceNameOf: (id: string) => string;
  onAssignAddon: (uid: string, serviceId: string) => void;
  onReport: (serviceId: string, report: SessionReport) => void;
}

function ServiceSessionBlock({
  gifted,
  service,
  servicesLoading,
  showTitle,
  isPkg,
  pkgId,
  giftedCount,
  branchId,
  selectedDate,
  voucher,
  availabilitiesData,
  authHeader,
  addonPool,
  blockAddons,
  assignedTo,
  serviceNameOf,
  onAssignAddon,
  onReport,
}: ServiceSessionBlockProps) {
  const gid = gifted.id;
  const requiredArrType = useMemo(() => computeRequiredArrType(voucher, [gid]), [voucher, gid]);
  const [skipExtra, setSkipExtra] = useState(false);

  const [arrangements, setArrangements] = useState<ApiArrangement[]>([]);
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  const [selectedTypeKey, setSelectedTypeKey] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);
  const [selectedSecondaryTherapistId, setSelectedSecondaryTherapistId] = useState<string>('');
  const [selectedSecondaryTherapist, setSelectedSecondaryTherapist] = useState<ApiTherapist | null>(null);

  // 1. Load this service's arrangements (package: the packaged service's first, falling back to the service's own)
  useEffect(() => {
    if (!branchId) {
      setArrangements([]);
      return;
    }
    let cancelled = false;
    setArrangementsLoading(true);
    const load = (sid: string) =>
      authedFetch(`/api/v1/services/${sid}/arrangements/?branch_id=${branchId}`, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      })
        .then((r) => r.json())
        .then(
          (d) =>
            (Array.isArray(d) ? d : (d.data ?? d.results ?? [])).filter(
              (a: ApiArrangement) => a.is_active !== false
            ) as ApiArrangement[]
        )
        .catch(() => [] as ApiArrangement[]);
    (pkgId ? load(pkgId).then((l) => (l.length > 0 ? l : load(gid))) : load(gid))
      .then((all) => {
        if (cancelled) return;
        const matched = requiredArrType
          ? all.filter((a) => normalizeArrType(a.arrangement_type || a.type || a.name || a.arrangement_name) === requiredArrType)
          : all;
        const common = matched.length > 0 ? matched : all;
        setArrangements(common);
        setSelectedTypeKey(common.length > 0 ? arrTypeKey(common[0]) : '');
        setSelectedRoomId(common.length > 0 ? common[0].id : '');
        setSelectedTimeSlot('');
      })
      .finally(() => {
        if (!cancelled) setArrangementsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gid, pkgId, branchId, authHeader, requiredArrType]);

  // Arrangements of the same type are shown once; their time slots are combined
  const groups = useMemo(() => {
    const m = new Map<string, ApiArrangement[]>();
    arrangements.forEach((a) => {
      const k = arrTypeKey(a);
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    return Array.from(m.entries()).map(([key, list]) => ({ key, list }));
  }, [arrangements]);
  const selectedGroup = groups.find((g) => g.key === selectedTypeKey) ?? groups[0] ?? null;
  const groupRooms = useMemo(() => selectedGroup?.list ?? [], [selectedGroup]);
  const selectedArrangement = useMemo(
    () => groupRooms.find((a) => a.id === selectedRoomId) || groupRooms[0] || null,
    [groupRooms, selectedRoomId]
  );

  const isCoupleRoom = useMemo(() => {
    const arrType = String(selectedArrangement?.arrangement_type || selectedArrangement?.type || '').toLowerCase();
    return arrType === 'couple_room' || arrType === 'double_room' || arrType.includes('couple') || arrType.includes('double');
  }, [selectedArrangement]);

  // Price / duration of this service's session
  const extra = skipExtra ? { minutes: 0, price: 0 } : gifted.extra;
  const arrPrice =
    selectedArrangement?.arrangement_price != null ? parseFloat(String(selectedArrangement.arrangement_price)) || 0 : null;
  const servicePrice =
    arrPrice !== null ? arrPrice : parseFloat(String(service?.arrangement_price ?? service?.base_price ?? '0')) || 0;
  const addonsPrice = blockAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonsDuration = blockAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
  const baseDuration = (service?.duration_minutes ?? 60) || 60;
  const totalDuration = baseDuration + addonsDuration + extra.minutes;
  const sessionPrice = servicePrice + addonsPrice + extra.price;

  // 2. Therapists: for multi-service vouchers re-load availability for exactly this service
  const [serviceAvail, setServiceAvail] = useState<any>(null);
  useEffect(() => {
    if (giftedCount <= 1 || !branchId) return;
    let cancelled = false;
    authedFetch('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        service_id: gid,
        service_ids: [gid],
        branch_id: branchId,
        expire_date: toZonedIsoFromLocal(voucher.expire_date),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setServiceAvail(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [giftedCount, gid, branchId, authHeader, voucher.expire_date]);
  const effectiveAvail = giftedCount > 1 ? serviceAvail : availabilitiesData;

  const therapists = useMemo<ApiTherapist[]>(() => {
    return Array.isArray(effectiveAvail?.therapists)
      ? effectiveAvail.therapists
      : Array.isArray(effectiveAvail?.data?.therapists)
      ? effectiveAvail.data.therapists
      : [];
  }, [effectiveAvail]);

  // 3. Time slots: combined over every arrangement of the selected type
  const slotInfo = useMemo(() => {
    const out = {
      slots: [] as { time: string; minutes: number; available: boolean }[],
      fit: new Map<number, string[]>(),
    };
    if (!selectedDate || groupRooms.length === 0) return out;

    // A start time is only free when EVERY 30-min step of the session fits in the free slots
    const steps = Math.max(1, Math.ceil(totalDuration / 30));
    const fitsDuration = (free: Set<number>, start: number) => {
      for (let k = 0; k < steps; k++) {
        if (!free.has(start + k * 30)) return false;
      }
      return true;
    };

    const therapistSlotsForDay = new Set<number>();
    const therapistCountByMin = new Map<number, number>();
    for (const t of therapists) {
      const tSlots: string[] = t.availabilities?.[selectedDate] || [];
      const free = new Set<number>(tSlots.map((x) => parseTimeToMinutes(x)));
      free.forEach((m) => {
        therapistSlotsForDay.add(m);
        if (fitsDuration(free, m)) therapistCountByMin.set(m, (therapistCountByMin.get(m) ?? 0) + 1);
      });
    }

    const roomData = groupRooms.map((r) => {
      const raw = r.availabilities?.[selectedDate];
      return {
        id: r.id,
        // no availability data for the room/day = unknown (allow, the server re-checks); empty list = fully booked
        hasData: Array.isArray(raw),
        free: new Set<number>((Array.isArray(raw) ? (raw as string[]) : []).map((s) => parseTimeToMinutes(s))),
      };
    });

    const branchInfo = effectiveAvail?.branch ?? availabilitiesData?.branch;
    const startMin = parseTimeToMinutes(branchInfo?.opening_time || '09:00:00');
    let endMin = parseTimeToMinutes(branchInfo?.closing_time || '23:00:00');
    if (endMin <= startMin) endMin = 23 * 60;

    const allKnownMinutes = new Set<number>();
    for (let m = startMin; m < endMin; m += 30) allKnownMinutes.add(m);
    therapistSlotsForDay.forEach((m) => allKnownMinutes.add(m));
    roomData.forEach((r) => r.free.forEach((m) => allKnownMinutes.add(m)));

    const minRequiredTherapists = isCoupleRoom && therapists.length >= 2 ? 2 : 1;
    for (const m of Array.from(allKnownMinutes).sort((a, b) => a - b)) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
      const roomsFit = roomData.filter((r) => !r.hasData || fitsDuration(r.free, m)).map((r) => r.id);
      const available = (therapistCountByMin.get(m) ?? 0) >= minRequiredTherapists && roomsFit.length > 0;
      out.fit.set(m, roomsFit);
      out.slots.push({ time: timeLabel, minutes: m, available });
    }
    return out;
  }, [selectedDate, groupRooms, therapists, effectiveAvail, availabilitiesData, isCoupleRoom, totalDuration]);

  // Keep the chosen time valid and auto-select the room (of the chosen type) that is free at that time
  useEffect(() => {
    if (!selectedTimeSlot) return;
    const m = parseTimeToMinutes(selectedTimeSlot);
    const slot = slotInfo.slots.find((s) => s.minutes === m);
    if (!slot || !slot.available) {
      setSelectedTimeSlot('');
      return;
    }
    const ids = slotInfo.fit.get(m) ?? [];
    if (ids.length > 0 && !ids.includes(selectedRoomId)) setSelectedRoomId(ids[0]);
  }, [slotInfo, selectedTimeSlot, selectedRoomId]);

  // Available therapists for the chosen time slot
  const availableTherapistsForSlot = useMemo<ApiTherapist[]>(() => {
    if (!selectedTimeSlot || !selectedDate || therapists.length === 0) return therapists;
    const slotMin = parseTimeToMinutes(selectedTimeSlot);
    // Only therapists free for the WHOLE session (never fall back to busy / fully booked ones)
    return therapists.filter((t) => {
      const free = new Set<number>(((t.availabilities?.[selectedDate] || []) as string[]).map((x) => parseTimeToMinutes(x)));
      for (let k = 0; k < Math.max(1, Math.ceil(totalDuration / 30)); k++) {
        if (!free.has(slotMin + k * 30)) return false;
      }
      return true;
    });
  }, [selectedTimeSlot, selectedDate, therapists, totalDuration]);

  // Auto-select therapist
  useEffect(() => {
    if (availableTherapistsForSlot.length > 0) {
      if (!selectedTherapistId || !availableTherapistsForSlot.some((t) => (t.id ?? t.therapist_id) === selectedTherapistId)) {
        const first = availableTherapistsForSlot[0];
        setSelectedTherapistId(first.id ?? first.therapist_id ?? '');
        setSelectedTherapist(first);
      }
      if (isCoupleRoom && availableTherapistsForSlot.length > 1) {
        const second = availableTherapistsForSlot.find((t) => (t.id ?? t.therapist_id) !== selectedTherapistId);
        if (second) {
          setSelectedSecondaryTherapistId(second.id ?? second.therapist_id ?? '');
          setSelectedSecondaryTherapist(second);
        }
      }
    } else if (selectedTherapistId) {
      // nobody is free for this slot: do not keep a stale (busy) therapist selected
      setSelectedTherapistId('');
      setSelectedTherapist(null);
      setSelectedSecondaryTherapistId('');
      setSelectedSecondaryTherapist(null);
    }
  }, [availableTherapistsForSlot, selectedTherapistId, isCoupleRoom]);

  // Report this block's session (or what is still missing) to the parent modal
  const draft = useMemo<VoucherSession | null>(() => {
    if (!service || !selectedRoomId || !selectedTimeSlot || !selectedTherapistId) return null;
    const secTName = isCoupleRoom && selectedSecondaryTherapist ? getTherapistDisplayName(selectedSecondaryTherapist) : undefined;
    return {
      id: Math.random().toString(36).slice(2),
      therapistId: selectedTherapistId,
      therapistName: getTherapistDisplayName(selectedTherapist),
      therapistAvatar: selectedTherapist?.avatar || selectedTherapist?.photo_url,
      secondaryTherapistId: selectedSecondaryTherapistId || undefined,
      secondaryTherapistName: secTName,
      secondaryTherapistAvatar: selectedSecondaryTherapist?.avatar || selectedSecondaryTherapist?.photo_url,
      arrangementId: selectedRoomId,
      arrangementName: selectedArrangement?.name || 'Room',
      arrangementType: selectedArrangement?.arrangement_type || requiredArrType,
      serviceIds: [gid],
      services: [service],
      addonIds: [],
      arrangementAddonIds: [],
      allAddons: blockAddons.map(({ id, name, price, duration_minutes }) => ({ id, name, price, duration_minutes })),
      addonUids: blockAddons.map((a) => a.uid),
      extraMinutes: extra.minutes,
      extraMinutesPrice: extra.price,
      redemptionServices: [
        {
          service_id: gid,
          service_name: gifted.name,
          addon_ids: blockAddons.map((a) => a.id),
          extra_time: extra.minutes,
        },
      ],
      startTime: selectedTimeSlot,
      totalDuration,
      sessionPrice,
    };
  }, [
    service, gid, gifted.name, selectedRoomId, selectedTimeSlot, selectedTherapistId, selectedTherapist,
    selectedSecondaryTherapistId, selectedSecondaryTherapist, isCoupleRoom, selectedArrangement, requiredArrType,
    blockAddons, extra.minutes, extra.price, totalDuration, sessionPrice,
  ]);
  const missing = !service
    ? 'Not available in this branch.'
    : !selectedRoomId
    ? 'Please select a room / arrangement.'
    : !selectedTimeSlot
    ? 'Please select a start time slot.'
    : !selectedTherapistId
    ? 'Please select an available therapist.'
    : null;
  useEffect(() => {
    onReport(gid, { draft, missing, duration: totalDuration, price: sessionPrice });
  }, [gid, draft, missing, totalDuration, sessionPrice, onReport]);

  return (
    <div className={cn('space-y-5', showTitle && 'rounded-2xl border border-border/70 bg-muted/10 p-4')}>
      {showTitle && (
        <p className="text-sm font-extrabold text-foreground flex items-center gap-2">
          <Scissors className="h-4 w-4 text-emerald-600" />
          {gifted.name}
          {gifted.duration > 0 ? ` · ${gifted.duration} min` : ''}
        </p>
      )}

      {/* Add-ons (any unused add-on of the voucher can be attached to any service) + extra time */}
      {(addonPool.length > 0 || gifted.extra.minutes > 0) && (
        <div className="space-y-1.5">
          {addonPool.length > 0 && (
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Voucher add-ons</p>
          )}
          {addonPool.map((a) => {
            const owner = assignedTo(a.uid);
            const mine = owner === gid;
            return (
              <label key={a.uid} className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={() => onAssignAddon(a.uid, mine ? '' : gid)}
                  className="h-3.5 w-3.5 accent-violet-500"
                />
                <Sparkles className="h-3 w-3 text-violet-500" />
                <span>
                  {a.name}
                  {a.duration_minutes ? ` · ${a.duration_minutes} min` : ''}
                </span>
                {owner && !mine && (
                  <span className="text-[10px] text-muted-foreground italic">(attached to {serviceNameOf(owner)})</span>
                )}
              </label>
            );
          })}
          {gifted.extra.minutes > 0 && (
            <label className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={!skipExtra}
                onChange={() => setSkipExtra((v) => !v)}
                className="h-3.5 w-3.5 accent-amber-500"
              />
              <Timer className="h-3 w-3 text-amber-500" />
              <span>Extra time +{gifted.extra.minutes} min</span>
            </label>
          )}
        </div>
      )}

      {/* Room / Arrangement Selection (one card per arrangement type) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-extrabold text-foreground">Select Room / Arrangement *</p>
            {arrangementsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none' }}>
            {groups.map((g) => {
              const rep = g.list.find((a) => a.id === selectedRoomId) ?? g.list[0];
              const cfg = getArrCfg(rep.arrangement_type);
              const Icon = cfg.Icon;
              const isSel = selectedGroup?.key === g.key;
              const price = rep.arrangement_price ?? rep.base_price;
              const label = g.list.length > 1 ? (ARRANGEMENT_CFG[g.key]?.label ?? rep.name) : rep.name;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    setSelectedTypeKey(g.key);
                    setSelectedRoomId(g.list[0].id);
                  }}
                  className={cn(
                    'relative flex-shrink-0 w-[130px] rounded-2xl overflow-hidden transition-all duration-200 group h-[130px] border cursor-pointer',
                    isSel ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-md' : 'border-border/70 hover:border-border'
                  )}
                >
                  <div className={cn('absolute inset-0 bg-gradient-to-br', cfg.gradient)}>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                      <Icon className={cn('h-16 w-16', cfg.iconColor)} />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  {isSel && (
                    <div className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <div className="relative z-10 h-full w-full flex flex-col justify-end p-2.5 text-center text-white">
                    <p className="text-xs font-extrabold truncate">{label}</p>
                    <p className="text-[10px] font-semibold text-amber-200 mt-0.5">{price ? `${fmt(price)} KWD` : 'Included'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {arrangementsLoading || servicesLoading ? 'Loading…' : 'No arrangement available for this branch'}
          </p>
        )}
      </div>

      {/* Timeslots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-extrabold text-foreground">Select Start Time *</p>
          </div>
          <span className="text-xs text-muted-foreground">{slotInfo.slots.filter((s) => s.available).length} available</span>
        </div>
        {slotInfo.slots.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1" style={{ scrollbarWidth: 'none' }}>
            {slotInfo.slots.map((slot) => {
              const isSel = slot.time === selectedTimeSlot;
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setSelectedTimeSlot(slot.time)}
                  className={cn(
                    'py-2 px-1 text-center rounded-xl text-xs font-bold border transition cursor-pointer',
                    isSel
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                      : slot.available
                      ? 'border-border/70 bg-card hover:bg-emerald-500/10 text-foreground'
                      : 'border-border/30 bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through'
                  )}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No slots available for this date and room</p>
        )}
      </div>

      {/* Therapist Selection */}
      {selectedTimeSlot && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-extrabold text-foreground">{isCoupleRoom ? 'Select Therapists (Primary & Secondary) *' : 'Select Therapist *'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableTherapistsForSlot.map((t) => {
              const tId = t.id ?? t.therapist_id ?? '';
              const isPrimary = tId === selectedTherapistId;
              const isSecondary = isCoupleRoom && tId === selectedSecondaryTherapistId;
              const isSel = isPrimary || isSecondary;
              const tName = getTherapistDisplayName(t);
              return (
                <button
                  key={tId}
                  type="button"
                  onClick={() => {
                    if (!isCoupleRoom) {
                      setSelectedTherapistId(tId);
                      setSelectedTherapist(t);
                      return;
                    }
                    if (isPrimary) return;
                    if (isSecondary) {
                      const prevId = selectedTherapistId;
                      const prevObj = selectedTherapist;
                      setSelectedTherapistId(tId);
                      setSelectedTherapist(t);
                      setSelectedSecondaryTherapistId(prevId);
                      setSelectedSecondaryTherapist(prevObj);
                    } else {
                      setSelectedSecondaryTherapistId(tId);
                      setSelectedSecondaryTherapist(t);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-2 text-left transition cursor-pointer',
                    isSel ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500' : 'border-border/70 bg-card hover:bg-muted/40'
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {getInitials(tName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate text-foreground">{tName}</p>
                    <p className="text-[10px] text-muted-foreground">{isCoupleRoom && isPrimary ? 'Primary' : isCoupleRoom && isSecondary ? 'Secondary' : 'Available'}</p>
                  </div>
                  {isSel && <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Session Sub-Popup Window ─────────────────────────────────────────────

interface AddVoucherSessionModalProps {
  sessionIndex: number;
  branchId: string;
  selectedDate: string;
  voucher: AnyRecord;
  availabilitiesData: any;
  authHeader: string;
  existingSessions: VoucherSession[];
  /** How many more sessions (= services in this popup) may still be created */
  maxNewSessions: number;
  onAdd: (sess: VoucherSession) => void;
  onClose: () => void;
}

function AddVoucherSessionModal({
  sessionIndex,
  branchId,
  selectedDate,
  voucher,
  availabilitiesData,
  authHeader,
  existingSessions,
  maxNewSessions,
  onAdd,
  onClose,
}: AddVoucherSessionModalProps) {
  const [services, setServices] = useState<ApiService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  // add-on uid -> service id it is attached to ('' = not used in this booking)
  const [addonAssign, setAddonAssign] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<Record<string, SessionReport>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Package voucher: services are the package's included services (nothing preselected)
  const isPkg = Boolean(voucher.__package);
  const pkgId = isPkg && voucher.__package?.id ? String(voucher.__package.id) : '';
  const sessionLimit = Math.max(1, maxNewSessions);

  // Gifted services of the voucher not yet assigned to another session
  const giftedServices = useMemo(() => getVoucherServices(voucher), [voucher]);
  const assignedElsewhere = useMemo(
    () => new Set(existingSessions.flatMap((x) => x.serviceIds.map(String))),
    [existingSessions]
  );
  const availableGifted = useMemo(
    () => giftedServices.filter((g) => !assignedElsewhere.has(g.id)),
    [giftedServices, assignedElsewhere]
  );
  const availableGiftedKey = availableGifted.map((g) => g.id).join(',');
  const voucherServiceName = availableGifted.map((g) => g.name).join(' + ') || 'Spa Service';

  // Voucher add-ons still unused (not consumed earlier, not used by another session of this booking)
  const fullPool = useMemo(() => getVoucherAddonPool(voucher), [voucher]);
  const usedHere = useMemo(() => new Set(existingSessions.flatMap((s) => s.addonUids ?? [])), [existingSessions]);
  const pool = useMemo(() => fullPool.filter((a) => !usedHere.has(a.uid)), [fullPool, usedHere]);

  // 1. Load the voucher services for this branch
  useEffect(() => {
    setServicesLoading(true);
    authedFetch(`/api/v1/services/?branch_id=${branchId}&is_active=true`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        const all: ApiService[] = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        const wanted = availableGiftedKey ? availableGiftedKey.split(',') : [];
        const list = wanted.length > 0
          ? wanted.map((id) => all.find((s) => String(s.id) === id)).filter((s): s is ApiService => Boolean(s))
          : all.slice(0, 1);
        setServices(list);
        // default: still-unassigned gifted services (up to the remaining session limit) get their own block
        setSelectedServiceIds(isPkg ? [] : list.slice(0, sessionLimit).map((s) => String(s.id)));
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [branchId, authHeader, availableGiftedKey]);

  const toggleService = (sv: ApiService) => {
    const id = String(sv.id);
    const order = services.map((x) => String(x.id));
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 || isPkg ? prev.filter((x) => x !== id) : prev; // keep at least one (not for packages)
      }
      if (prev.length >= sessionLimit) return prev;
      return order.filter((x) => x === id || prev.includes(x)); // keep gifted order
    });
  };

  // Which service an add-on is attached to (default: the service it was gifted with; packages: the first service)
  const assignedTo = useCallback(
    (uid: string): string => {
      const explicit = addonAssign[uid];
      if (explicit !== undefined) return selectedServiceIds.includes(explicit) ? explicit : '';
      const a = pool.find((x) => x.uid === uid);
      if (!a) return '';
      if (isPkg) return selectedServiceIds[0] ?? '';
      return selectedServiceIds.includes(a.originServiceId) ? a.originServiceId : '';
    },
    [addonAssign, selectedServiceIds, pool, isPkg]
  );
  const blockAddonsMap = useMemo(() => {
    const m: Record<string, PoolAddon[]> = {};
    selectedServiceIds.forEach((id) => {
      m[id] = pool.filter((a) => assignedTo(a.uid) === id);
    });
    return m;
  }, [pool, assignedTo, selectedServiceIds]);
  const onAssignAddon = useCallback((uid: string, serviceId: string) => {
    setAddonAssign((prev) => ({ ...prev, [uid]: serviceId }));
  }, []);
  const onReport = useCallback((serviceId: string, report: SessionReport) => {
    setReports((prev) => ({ ...prev, [serviceId]: report }));
  }, []);
  const serviceNameOf = useCallback(
    (id: string) => giftedServices.find((g) => g.id === id)?.name ?? 'service',
    [giftedServices]
  );

  const totalDuration = selectedServiceIds.reduce((s, id) => s + (reports[id]?.duration ?? 0), 0);
  const sessionPrice = selectedServiceIds.reduce((s, id) => s + (reports[id]?.price ?? 0), 0);

  // Submit: one session per selected service (each with its own room / time / therapist)
  const handleSaveSession = () => {
    if (selectedServiceIds.length === 0) {
      setErrorMsg('Please select at least one service.');
      return;
    }
    const drafts: VoucherSession[] = [];
    for (const id of selectedServiceIds) {
      const r = reports[id];
      if (!r || r.missing || !r.draft) {
        const msg = r?.missing ?? 'Please complete the session details.';
        setErrorMsg(selectedServiceIds.length > 1 ? `${serviceNameOf(id)}: ${msg}` : msg);
        return;
      }
      drafts.push(r.draft);
    }
    const overlaps = (a: VoucherSession, b: VoucherSession) => {
      const aStart = parseTimeToMinutes(a.startTime);
      const bStart = parseTimeToMinutes(b.startTime);
      return aStart < bStart + b.totalDuration && bStart < aStart + a.totalDuration;
    };
    for (let i = 0; i < drafts.length; i++) {
      const clash = existingSessions.some((o) => overlaps(drafts[i], o)) || drafts.slice(0, i).some((o) => overlaps(drafts[i], o));
      if (clash) {
        setErrorMsg(
          `${serviceNameOf(drafts[i].serviceIds[0])}: this session overlaps with another scheduled session. Please choose a different time slot.`
        );
        return;
      }
    }
    drafts.forEach((d) => onAdd(d));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">Add Session #{sessionIndex + 1}</h3>
              <p className="text-xs text-muted-foreground">Configure service, room, therapist, and time slot</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: 'none' }}>
          {errorMsg && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Gifted services for this booking (each selected service gets its own room / time / therapist) */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-extrabold text-foreground">
                {isPkg ? 'Choose the package services for this session' : availableGifted.length > 1 ? 'Services in this session' : 'Covered by Voucher (fixed)'}
              </p>
              {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              {availableGifted.map((g) => {
                const checked = selectedServiceIds.includes(g.id);
                const sv = services.find((x) => String(x.id) === g.id);
                const limitReached = !checked && selectedServiceIds.length >= sessionLimit;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 transition',
                      checked ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/70 bg-card'
                    )}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!sv || (availableGifted.length === 1 && !isPkg) || limitReached}
                        onChange={() => sv && toggleService(sv)}
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">{g.name}{g.duration > 0 ? ` · ${g.duration} min` : ''}</p>
                        {!sv && !servicesLoading && (
                          <p className="text-[11px] text-destructive italic">Not available in this branch</p>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground">
                {availableGifted.length > 1
                  ? 'Untick a service to leave it for another session or booking. Each ticked service gets its own room and time. Unticked add-ons / extra time are not used.'
                  : 'Unticked add-ons / extra time are not used in this booking.'}
              </p>
            </div>
            {!servicesLoading && availableGifted.length > 0 && services.length === 0 && (
              <p className="mt-2 text-xs text-destructive italic">{voucherServiceName} is not available in this branch.</p>
            )}
          </div>

          {isPkg && selectedServiceIds.length === 0 && (
            <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
              Tick one or more services above to choose a room, time slot and therapist.
            </p>
          )}

          {selectedServiceIds.map((id) => {
            const g = availableGifted.find((x) => x.id === id);
            if (!g) return null;
            return (
              <ServiceSessionBlock
                key={id}
                gifted={g}
                service={services.find((x) => String(x.id) === id)}
                servicesLoading={servicesLoading}
                showTitle={selectedServiceIds.length > 1}
                isPkg={isPkg}
                pkgId={pkgId}
                giftedCount={giftedServices.length}
                branchId={branchId}
                selectedDate={selectedDate}
                voucher={voucher}
                availabilitiesData={availabilitiesData}
                authHeader={authHeader}
                addonPool={pool}
                blockAddons={blockAddonsMap[id] ?? []}
                assignedTo={assignedTo}
                serviceNameOf={serviceNameOf}
                onAssignAddon={onAssignAddon}
                onReport={onReport}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-border/60 px-6 py-4 bg-muted/10">
          <div>
            <p className="text-xs text-muted-foreground">Duration: <strong className="text-foreground">{totalDuration} min</strong></p>
            {isPkg ? (
              <p className="text-xs text-muted-foreground">Session: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Covered by Package</strong></p>
            ) : (
              <p className="text-xs text-muted-foreground">Session Total: <strong className="text-primary font-bold">{fmt(sessionPrice)} KWD</strong></p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={isPkg && selectedServiceIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              <span>Add Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Redeem Voucher Modal ────────────────────────────────────────────────

export function RedeemVoucherModal({
  voucher: voucherProp,
  invoiceNumber: propsInvoiceNumber,
  paymentNumber: propsPaymentNumber,
  token,
  onClose,
  onSuccess,
  initialAvailabilitiesPromise,
}: RedeemVoucherModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';
  const currentUser = useAppSelector((s) => s.auth.user);
  const { canApplyDiscount: allowDiscount, isAdmin } = usePermissions();

  // ── Package vouchers: the gifted package is redeemed through its included services ──
  const [pkgInfo, setPkgInfo] = useState<{
    id: string;
    name: string;
    components: { id: string; name: string; duration_minutes: number; base_price: string }[];
    /** Add-ons covered by the package (redeemed together with its first included service) */
    addons: { id: string; name: string; price: string | number; duration_minutes: number }[];
  } | null>(null);
  useEffect(() => {
    const list = getVoucherServices(voucherProp);
    if (list.length !== 1) return;
    let cancelled = false;
    authedFetch(`/api/v1/services/${list[0].id}/`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then((r) => r.json())
      .then((d) => {
        const svc = (d?.data ?? d) as AnyRecord;
        const inc: AnyRecord[] = Array.isArray(svc?.included_services) ? svc.included_services : [];
        if (cancelled || !svc?.is_packaged_services || inc.length === 0) return;
        setPkgInfo({
          id: String(svc.id ?? list[0].id),
          name: String(svc.name ?? list[0].name),
          components: inc.map((c) => ({
            id: String(c.id),
            name: String(c.name),
            duration_minutes: Number(c.duration_minutes) || 60,
            base_price: String(c.base_price ?? '0'),
          })),
          addons: (Array.isArray(svc?.included_addons) ? (svc.included_addons as AnyRecord[]) : []).map((a) => ({
            id: String(a.id),
            name: String(a.name ?? 'Add-on'),
            price: a.price ?? 0,
            duration_minutes: Number(a.duration_minutes) || 0,
          })),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherProp.id, authHeader]);
  const voucher: AnyRecord = useMemo(
    () =>
      !pkgInfo
        ? voucherProp
        : {
            ...voucherProp,
            services: pkgInfo.components.map((c, idx) => ({
              service_id: c.id,
              service_data: { id: c.id, name: c.name, duration_minutes: c.duration_minutes, base_price: c.base_price },
              // package add-ons are covered by the voucher and can be attached to any included service (see the add-on pool)
              addons: [],
              extra_time: 0,
              price_for_extra_time: 0,
            })),
            redemptions: Array.isArray(voucherProp.redemptions) ? voucherProp.redemptions : [],
            service_arrangement_data: voucherProp.service_arrangement_data ?? null,
            service_arrangement_id: voucherProp.service_arrangement_id ?? null,
            arrangement_type: voucherProp.arrangement_type ?? voucherProp.service_arrangement_data?.arrangement_type ?? '',
            room_type: voucherProp.room_type ?? voucherProp.service_arrangement_data?.room_type ?? voucherProp.arrangement_type ?? '',
            __package: pkgInfo,
          },
    [voucherProp, pkgInfo],
  );
  const isPackageVoucher = Boolean(pkgInfo);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sessions, setSessions] = useState<VoucherSession[]>([]);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Derived voucher metadata
  const originalBranchId = firstTruthy(voucher.branch_id, voucher.branch_data?.branch_id, voucher.branch_data?.id);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(originalBranchId);

  const todayStr = useMemo(() => kuwaitDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const expireDateDay = useMemo(() => (voucher.expire_date ? voucher.expire_date.split('T')[0] : ''), [voucher.expire_date]);
  const expireDateWithTz = useMemo(() => toZonedIsoFromLocal(voucher.expire_date), [voucher.expire_date]);

  const voucherCode = firstTruthy(voucher.voucher_number, voucher.secret_code, voucher.id ? voucher.id.slice(0, 8) : '');
  const recipientName = firstTruthy(voucher.recipient_details?.name, voucher.recipient_data?.name, 'Recipient');
  const recipientPhone = firstTruthy(voucher.recipient_phone, voucher.recipient_details?.phone_number, voucher.recipient_data?.phone_number);
  const recipientEmail = firstTruthy(voucher.recipient_details?.email, voucher.recipient_data?.email);

  const giftedList = useMemo(() => getVoucherServices(voucher), [voucher]);
  const serviceId = giftedList[0]?.id || firstTruthy(voucher.service_id, voucher.service_data?.id);
  const giftedServiceIds = useMemo(() => giftedList.map((g) => g.id), [giftedList]);
  const assignedCount = new Set(sessions.flatMap((x) => x.serviceIds.map(String))).size;
  const unassignedCount = Math.max(0, giftedList.length - assignedCount);
  const maxSessions = isPackageVoucher ? Math.min(5, giftedList.length) : Math.min(3, giftedList.length);
  const serviceName = firstTruthy(voucher.service_data?.name, voucher.service_data?.service_name, 'Spa Service');
  const originalDuration = parseInt(String(voucher.total_duration ?? voucher.service_data?.duration_minutes ?? 60), 10) || 60;
  const voucherAmount = parseFloat(String(voucher.total_amount ?? voucher.service_data?.base_price ?? '0')) || 0;
  const currency = firstTruthy(voucher.currency, 'KWD');

  // Customer & Notes state (Step 2)
  const [customerId, setCustomerId] = useState<string>(voucher.recipient_id || voucher.sender_id || '');
  const [customerSearch, setCustomerSearch] = useState<string>(recipientName);
  const [customerQuery, setCustomerQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<ApiCustomer | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState<boolean>(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(`Redeemed from Gift Voucher #${voucherCode}`);

  // Payment Option state (Step 3)
  const [paymentOption, setPaymentOption] = useState<'pay_on_branch' | 'pay_now'>('pay_on_branch');
  const [discount, setDiscount] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<AnyRecord | null>(null);
  const [redeemOutcome, setRedeemOutcome] = useState<{ status: string; remaining: number; warning?: string } | null>(null);

  // Resolved payment ids
  const resolvedInvoiceNumber = firstTruthy(
    propsInvoiceNumber,
    voucher.invoice_number,
    voucher.invoice_id,
    voucher.payment_data?.invoice_number
  );
  const resolvedPaymentNumber = firstTruthy(
    propsPaymentNumber,
    voucher.payment_number,
    voucher.payment_data?.payment_number
  );
  const resolvedPaymentGateway = firstTruthy(voucher.payment_gateway, voucher.payment_data?.payment_gateway, 'KNET');
  const resolvedPaymentProvider = firstTruthy(voucher.payment_provider, voucher.payment_data?.payment_provider, 'MyFatoorah');
  const resolvedPaymentMethod = firstTruthy(voucher.payment_method, voucher.payment_data?.payment_method, 'voucher');
  const resolvedPaymentThrough = firstTruthy(voucher.payment_through, voucher.payment_data?.payment_through, 'ushdesk');
  const resolvedPaymentId = firstTruthy(voucher.payment_id, voucher.payment_data?.payment_id);

  // Availabilities data from server
  const [availabilitiesData, setAvailabilitiesData] = useState<any>(null);
  const [availabilitiesLoading, setAvailabilitiesLoading] = useState(false);

  // Consume prefetched voucher availabilities if provided
  useEffect(() => {
    if (!initialAvailabilitiesPromise) return;
    let cancelled = false;
    initialAvailabilitiesPromise
      .then((data) => {
        if (!cancelled && data) {
          setAvailabilitiesData((prev: any) => prev || data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialAvailabilitiesPromise]);

  // Fetch branches
  useEffect(() => {
    authedFetch('/api/v1/branches/', { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then((r) => r.json())
      .then((data) => {
        const list: ApiBranch[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        setBranches(list);
      })
      .catch(() => setBranches([]));
  }, [authHeader]);

  // Only offer branches where the voucher service has an arrangement of the voucher's room type
  const [eligibleBranchIds, setEligibleBranchIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!serviceId || branches.length === 0) return;
    let cancelled = false;
    const rawServices: AnyRecord[] = Array.isArray(voucher.services) ? voucher.services : [];
    const isMultiSvc = rawServices.length > 1;
    const requiredType = !isMultiSvc
      ? normalizeArrType(
          firstTruthy(
            voucher.service_arrangement_data?.arrangement_type,
            voucher.service_arrangement_data?.type,
            voucher.arrangement_type,
            voucher.room_type,
            voucher.service_arrangement_data?.room_type,
            voucher.service_arrangement_data?.arrangement_name,
            voucher.service_arrangement_data?.room,
            voucher.arrangement_name
          )
        )
      : '';
    Promise.all(
      branches.map(async (b) => {
        const bId = String(b.id ?? b.branch_id ?? '');
        if (!bId) return null;
        try {
          // For package vouchers, check arrangements of the packaged service itself;
          // if the package has none at this branch, fall back to its included services.
          const hasArrangements = async (sids: string[]): Promise<boolean> => {
            for (const sid of sids) {
              const r = await authedFetch(`/api/v1/services/${sid}/arrangements/?branch_id=${bId}`, {
                headers: authHeader ? { Authorization: authHeader } : undefined,
              });
              const d = await r.json();
              const list: ApiArrangement[] = (Array.isArray(d) ? d : (d.data ?? d.results ?? [])).filter(
                (a: ApiArrangement) => a.is_active !== false
              );
              if (list.length === 0) return false;
              if (requiredType) {
                const matchesReq = list.some((a) => normalizeArrType(a.arrangement_type || a.type || a.name || a.arrangement_name) === requiredType);
                if (!matchesReq) return false;
              }
            }
            return true;
          };
          const includedIds = giftedServiceIds.length > 0 ? giftedServiceIds : [serviceId];
          if (isPackageVoucher && pkgInfo?.id) {
            if (await hasArrangements([String(pkgInfo.id)])) return bId;
            return (await hasArrangements(includedIds)) ? bId : null;
          }
          return (await hasArrangements(includedIds)) ? bId : null;
        } catch {
          return null;
        }
      })
    ).then((ids) => {
      if (cancelled) return;
      const set = new Set(ids.filter((x): x is string => Boolean(x)));
      if (originalBranchId) set.add(originalBranchId);
      setEligibleBranchIds(set);
    });
    return () => {
      cancelled = true;
    };
  }, [branches, serviceId, giftedServiceIds, isPackageVoucher, pkgInfo?.id, authHeader, originalBranchId, voucher.service_arrangement_data, voucher.arrangement_type, voucher.services]);

  // Fetch voucher availabilities for branch
  useEffect(() => {
    if (!selectedBranchId) return;
    setAvailabilitiesLoading(true);
    const payload = {
      service_id: serviceId,
      // multi-service vouchers: only therapists / rooms supporting every gifted service
      ...(giftedServiceIds.length > 1 ? { service_ids: giftedServiceIds } : {}),
      branch_id: selectedBranchId,
      expire_date: expireDateWithTz,
    };
    authedFetch('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => setAvailabilitiesData(d))
      .catch(() => {})
      .finally(() => setAvailabilitiesLoading(false));
  }, [selectedBranchId, serviceId, expireDateWithTz, authHeader]);


  // Totals across all sessions
  const totalBookingPrice = useMemo(() => sessions.reduce((s, sess) => s + sess.sessionPrice, 0), [sessions]);
  const totalBookingDuration = useMemo(() => sessions.reduce((s, sess) => s + sess.totalDuration, 0), [sessions]);
  const discountAmount = allowDiscount ? Math.max(0, parseFloat(discount) || 0) : 0;
  const netPayablePrice = Math.max(0, totalBookingPrice - discountAmount);

  // Date formatted strings
  const parsedDateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);
  const dayName = useMemo(() => parsedDateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: KUWAIT_TZ }), [parsedDateObj]);
  const dayNum = useMemo(() => parsedDateObj.toLocaleDateString('en-US', { day: 'numeric', timeZone: KUWAIT_TZ }), [parsedDateObj]);
  const monthFull = useMemo(() => parsedDateObj.toLocaleDateString('en-US', { month: 'short', timeZone: KUWAIT_TZ }), [parsedDateObj]);
  const yearFull = useMemo(() => parsedDateObj.toLocaleDateString('en-US', { year: 'numeric', timeZone: KUWAIT_TZ }), [parsedDateObj]);

  const selectedBranchName = useMemo(() => {
    const b = branches.find((x) => (x.id ?? x.branch_id) === selectedBranchId);
    return b?.branch_name ?? b?.name ?? voucher.branch_data?.name ?? 'Branch';
  }, [branches, selectedBranchId, voucher.branch_data?.name]);

  // Remove session handler
  const removeSession = (idx: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  };

  // When the chosen therapist turns out to be booked, find another therapist free for the whole session
  const baseSessions = sessions;
  const findAlternativeTherapist = async (
    sess: VoucherSession,
    excluded: Set<string>
  ): Promise<{ id: string; name: string; avatar?: string } | null> => {
    try {
      const r = await authedFetch('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          service_id: sess.serviceIds[0],
          service_ids: sess.serviceIds,
          branch_id: selectedBranchId,
          expire_date: toZonedIsoFromLocal(voucher.expire_date),
        }),
      });
      const d = await r.json();
      const list: ApiTherapist[] = Array.isArray(d?.therapists)
        ? d.therapists
        : Array.isArray(d?.data?.therapists)
        ? d.data.therapists
        : [];
      const start = parseTimeToMinutes(sess.startTime);
      const steps = Math.max(1, Math.ceil(sess.totalDuration / 30));
      const busyWithOthers = new Set(
        [...baseSessions]
          .filter((o) => o.id !== sess.id)
          .filter((o) => {
            const os = parseTimeToMinutes(o.startTime);
            return start < os + o.totalDuration && os < start + sess.totalDuration;
          })
          .flatMap((o) => [o.therapistId, o.secondaryTherapistId ?? ''])
      );
      for (const t of list) {
        const tid = String(t.id ?? t.therapist_id ?? '');
        if (!tid || excluded.has(tid) || busyWithOthers.has(tid)) continue;
        const free = new Set<number>(((t.availabilities?.[selectedDate] || []) as string[]).map((x) => parseTimeToMinutes(x)));
        let ok = true;
        for (let k = 0; k < steps; k++) {
          if (!free.has(start + k * 30)) {
            ok = false;
            break;
          }
        }
        if (ok) return { id: tid, name: getTherapistDisplayName(t), avatar: t.avatar || t.photo_url };
      }
    } catch {
      /* fall through */
    }
    return null;
  };

  // Submit handler
  const handleConfirmRedeem = async (sessionList?: VoucherSession[], triedTherapists: Set<string> = new Set()): Promise<void> => {
    const sessions = sessionList ?? baseSessions;
    if (sessions.length === 0) {
      setSubmitError('Please add at least one session.');
      return;
    }
    if (!selectedBranchId || !selectedDate) {
      setSubmitError('Please select branch and appointment date.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Sessions are sent in chronological order
    const orderedSessions = [...sessions].sort((x, y) => parseTimeToMinutes(x.startTime) - parseTimeToMinutes(y.startTime));
    const firstSess = orderedSessions[0];
    const firstApptWindow = buildAppointmentWindow(selectedDate, firstSess.startTime, firstSess.totalDuration);
    const lastSess = orderedSessions[orderedSessions.length - 1];
    const lastApptWindow = buildAppointmentWindow(selectedDate, lastSess.startTime, lastSess.totalDuration);

    const sessionsPayload = orderedSessions.map((sess) => {
      const apptWindow = buildAppointmentWindow(selectedDate, sess.startTime, sess.totalDuration);
      return {
        appointment_start: apptWindow.appointment_start,
        appointment_end: apptWindow.appointment_end,
        timezone: apptWindow.timezone,
        duration: sess.totalDuration,
        therapist_id: sess.therapistId,
        therapist_name: sess.therapistName,
        ...(sess.secondaryTherapistId ? {
          secondary_therapist_id: sess.secondaryTherapistId,
          secondary_therapist_name: sess.secondaryTherapistName,
        } : {}),
        service_arrangement_id: sess.arrangementId,
        service_arrangement_data: {
          arrangement_id: sess.arrangementId,
          arrangement_name: sess.arrangementName,
          arrangement_type: sess.arrangementType,
        },
        service_id: sess.services[0]?.id || serviceId,
        service_name: sess.services[0]?.name || serviceName,
        service_data: sess.services[0] || null,
        services: sess.services.map((sv) => ({
          service_id: sv.id,
          service_name: sv.name,
          service_category: sv.category ?? '',
          base_price: fmt(sv.base_price),
          duration_minutes: sv.duration_minutes ?? 60,
          ...(pkgInfo ? { package_id: pkgInfo.id } : {}),
        })),
        service_ids: sess.serviceIds,
        addons: sess.allAddons.map((a) => ({
          id: a.id,
          name: a.name,
          price: fmt(a.price),
          duration_minutes: a.duration_minutes ?? 0,
        })),
        addons_duration: sess.allAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
        extra_minutes: sess.extraMinutes,
        extra_price: fmt(sess.extraMinutesPrice),
        session_price: fmt(sess.sessionPrice),
        total_session_duration: sess.totalDuration,
      };
    });

    const custObj = selectedCustomer || {
      id: customerId,
      name: customerSearch || recipientName,
      phone_number: recipientPhone,
      email: recipientEmail,
    };

    const bookingPayload = {
      customer_id: customerId || voucher.recipient_id || voucher.sender_id || null,
      customer_data: custObj,
      service_id: firstSess.services[0]?.id || serviceId,
      service_name: firstSess.services[0]?.name || serviceName,
      service_data: firstSess.services[0] || voucher.service_data,
      services: firstSess.services.map((sv) => ({
        service_id: sv.id,
        service_name: sv.name,
        service_category: sv.category ?? '',
        base_price: fmt(sv.base_price),
        base_duration: sv.duration_minutes ?? 60,
        ...(pkgInfo ? { package_id: pkgInfo.id } : {}),
      })),
      branch_id: selectedBranchId,
      branch_name: selectedBranchName,
      branch_data: { branch_id: selectedBranchId, name: selectedBranchName },
      service_arrangement_id: firstSess.arrangementId,
      arrangement_name: firstSess.arrangementName,
      arrangement_type: firstSess.arrangementType,
      service_arrangement_data: {
        arrangement_id: firstSess.arrangementId,
        arrangement_name: firstSess.arrangementName,
        arrangement_type: firstSess.arrangementType,
      },
      therapist_id: firstSess.therapistId,
      therapist_name: firstSess.therapistName,
      therapist_data: {
        id: firstSess.therapistId,
        therapist_id: firstSess.therapistId,
        name: firstSess.therapistName,
      },
      ...(firstSess.secondaryTherapistId ? {
        secondary_therapist_id: firstSess.secondaryTherapistId,
        secondary_therapist_name: firstSess.secondaryTherapistName,
        secondary_therapist_data: {
          id: firstSess.secondaryTherapistId,
          therapist_id: firstSess.secondaryTherapistId,
          name: firstSess.secondaryTherapistName,
        },
      } : {}),
      appointment_date: selectedDate,
      appointment_time: toHHMM(firstSess.startTime),
      appointment_start: firstApptWindow.appointment_start,
      appointment_end: lastApptWindow.appointment_end,
      booking_type: 'branch_service',
      payment_type: 'gift_voucher',
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'voucher',
      payment_gateway: resolvedPaymentGateway,
      payment_provider: resolvedPaymentProvider,
      payment_through: resolvedPaymentThrough,
      payment_id: resolvedPaymentId,
      payment_number: resolvedPaymentNumber,
      invoice_number: resolvedInvoiceNumber,
      total_price: fmt(netPayablePrice),
      currency,
      total_duration: totalBookingDuration,
      customer_notes: notes,
      voucher_id: voucher.id,
      voucher_data: {
        id: voucher.id,
        voucher_number: voucher.voucher_number || voucherCode,
        secret_code: voucher.secret_code,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        expire_date: voucher.expire_date,
        invoice_number: resolvedInvoiceNumber,
        payment_number: resolvedPaymentNumber,
        payment_gateway: resolvedPaymentGateway,
        payment_provider: resolvedPaymentProvider,
        payment_method: resolvedPaymentMethod,
        payment_through: resolvedPaymentThrough,
        payment_id: resolvedPaymentId,
        is_package: isPackageVoucher,
        package_name: pkgInfo?.name || null,
        package_price: voucherAmount,
        currency,
        all_gifted_services: giftedList.map((g) => ({ id: g.id, name: g.name, duration: g.duration })),
        redeemed_services: sessions.flatMap((s) => s.services.map((sv) => ({ id: sv.id, name: sv.name, duration: sv.duration_minutes }))),
        remaining_services: giftedList
          .filter((g) => !new Set(sessions.flatMap((s) => s.serviceIds.map(String))).has(g.id))
          .map((g) => ({ id: g.id, name: g.name, duration: g.duration })),
        is_partial: unassignedCount > 0,
      },
      created_by_user: currentUser?.id,
      created_by_user_data: currentUser ? { id: currentUser.id, name: currentUser.name || (currentUser as any).username || '' } : undefined,
      sessions: sessionsPayload,
    };

    try {
      const res = await authedFetch('/booknpay/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        // The API wraps errors as { error: { message, detail } } (or FastAPI's { detail })
        const pick = (v: unknown): string =>
          typeof v === 'string'
            ? v
            : Array.isArray(v)
            ? v.map((d: any) => d?.msg || d?.message || JSON.stringify(d)).join('; ')
            : '';
        // Selected therapist is already booked → automatically switch to another available therapist and retry
        const errText = [pick(errJson?.error?.detail), pick(errJson?.error?.message), pick(errJson?.detail), pick(errJson?.message)].join(' ');
        const busyId = errText.match(/therapist\s+([0-9a-f]{8}-[0-9a-f-]{27})\s+is already booked/i)?.[1];
        if (busyId && triedTherapists.size < 10) {
          const nextTried = new Set(triedTherapists).add(busyId);
          const target = sessions.find((x) => x.therapistId === busyId || x.secondaryTherapistId === busyId);
          if (target) {
            const alt = await findAlternativeTherapist(target, nextTried);
            if (alt) {
              const isSecondary = target.secondaryTherapistId === busyId && target.therapistId !== busyId;
              const updated = sessions.map((x) =>
                x.id !== target.id
                  ? x
                  : isSecondary
                  ? { ...x, secondaryTherapistId: alt.id, secondaryTherapistName: alt.name, secondaryTherapistAvatar: alt.avatar }
                  : { ...x, therapistId: alt.id, therapistName: alt.name, therapistAvatar: alt.avatar }
              );
              setSessions(updated);
              return await handleConfirmRedeem(updated, nextTried);
            }
          }
        }
        throw new Error(
          pick(errJson?.error?.detail) ||
            pick(errJson?.error?.message) ||
            pick(errJson?.detail) ||
            pick(errJson?.message) ||
            `Booking failed (${res.status})`
        );
      }

      const bookingRes = await res.json();
      const newBooking = bookingRes?.data || bookingRes;
      const newBookingId = newBooking?.id || newBooking?.booking_id;

      // Record the redemption on the voucher. The backend derives the status:
      // partially_redeemed while gifted services remain, redeemed once all are used.
      const voucherUpdatePayload = {
        redemption: {
          booking_number: newBooking?.booking_number || newBooking?.booking_no,
          services: pkgInfo
            ? [{ service_id: pkgInfo.id, service_name: pkgInfo.name, addon_ids: pkgInfo.addons.map((a) => a.id), extra_time: 0 }]
            : sessions.flatMap((x) => x.redemptionServices ?? []),
        },
        booking_id: newBookingId,
        booking_data: {
          ...(newBooking && typeof newBooking === 'object' ? newBooking : {}),
          id: newBookingId,
          booking_id: newBookingId,
          booking_number: newBooking?.booking_number || newBooking?.booking_no,
          appointment_date: selectedDate,
          appointment_time: firstSess.startTime,
          therapist_id: firstSess.therapistId,
          therapist_name: firstSess.therapistName,
          branch_id: selectedBranchId,
          branch_name: selectedBranchName,
          service_arrangement_id: firstSess.arrangementId,
          arrangement_name: firstSess.arrangementName,
        },
        redeemed_by: currentUser?.id,
      };

      try {
        const vRes = await authedFetch(`/booknpay/api/v1/vouchers/${voucher.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(voucherUpdatePayload),
        });
        const vJson = await vRes.json().catch(() => ({}));
        if (vRes.ok) {
          const vd = (vJson?.data ?? vJson) as AnyRecord;
          setRedeemOutcome({
            status: String(vd?.status ?? ''),
            remaining: Array.isArray(vd?.remaining_service_ids) ? vd.remaining_service_ids.length : 0,
          });
        } else {
          setRedeemOutcome({ status: '', remaining: 0, warning: String(vJson?.detail ?? 'Voucher could not be updated.') });
        }
      } catch {
        setRedeemOutcome({ status: '', remaining: 0, warning: 'Voucher could not be updated.' });
      }

      setBookingSuccess(newBooking);
      onSuccess?.();
    } catch (err) {
      console.error('Error redeeming voucher:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to redeem voucher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary/80 to-accent text-white shadow-md">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-foreground tracking-tight">New Appointment Booking</h2>
                {voucherCode && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                    <Gift className="h-2.5 w-2.5" />
                    #{voucherCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Gift Voucher Redemption · Already paid</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Header Context Banner (Branch & Date Details) ── */}
        <div className="shrink-0 border-b border-border/60 bg-muted/10 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Branch Picker */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl grid place-items-center bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</p>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-foreground cursor-pointer focus:outline-none"
              >
                {branches
                  .filter((b) => !eligibleBranchIds || eligibleBranchIds.has(String(b.id ?? b.branch_id ?? '')))
                  .map((b) => {
                  const bId = b.id ?? b.branch_id ?? '';
                  return (
                    <option key={bId} value={bId} className="bg-card text-foreground">
                      {b.branch_name ?? b.name ?? bId}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Date Picker Button / Card */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker((prev) => !prev)}
              className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 px-3.5 py-1.5 transition text-left cursor-pointer"
            >
              <div className="flex flex-col items-center justify-center rounded-xl bg-primary text-white px-2 py-0.5 shadow-sm">
                <span className="text-[8px] font-bold uppercase">{dayName}</span>
                <span className="text-sm font-black leading-none">{dayNum}</span>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Date</p>
                <p className="text-xs font-extrabold text-foreground">{monthFull} {dayNum}, {yearFull}</p>
              </div>
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 shadow-2xl">
                <VoucherCalendarPicker
                  value={selectedDate}
                  onChange={(d) => {
                    setSelectedDate(d);
                    setShowDatePicker(false);
                  }}
                  minDate={isAdmin ? undefined : todayStr}
                  maxDate={expireDateDay || undefined}
                />
              </div>
            )}
          </div>
        </div>


        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {bookingSuccess ? (
            /* ── Success Screen ── */
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">
                  {redeemOutcome?.status === 'partially_redeemed' ? 'Voucher Partially Redeemed' : 'Voucher Successfully Redeemed!'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  The appointment has been confirmed with {sessions.length} session{sessions.length > 1 ? 's' : ''}.
                  {redeemOutcome?.status === 'partially_redeemed' &&
                    ` ${redeemOutcome.remaining} service${redeemOutcome.remaining === 1 ? '' : 's'} can still be redeemed from this voucher.`}
                </p>
                {redeemOutcome?.warning && (
                  <p className="text-xs text-destructive mt-2 max-w-sm">
                    Booking created, but the voucher record was not updated: {redeemOutcome.warning}
                  </p>
                )}
              </div>

              <div className="w-full max-w-md rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-2 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking Number:</span>
                  <span className="font-bold text-foreground">
                    {bookingSuccess.booking_number || bookingSuccess.number || bookingSuccess.id?.slice(0, 8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Appointment Date:</span>
                  <span className="font-bold text-foreground">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-bold text-foreground">{selectedBranchName}</span>
                </div>
                {isPackageVoucher && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gift Package:</span>
                    <span className="font-bold text-foreground">{pkgInfo?.name || 'Spa Package'}</span>
                  </div>
                )}
                {isPackageVoucher && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package Total Price:</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {fmt(voucher.total_amount ?? voucherAmount)} {currency} (Covered)
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/40 space-y-1">
                  {sessions.map((s, i) => (
                    <div key={s.id} className="text-muted-foreground flex justify-between">
                      <span>Session {i + 1}: {s.startTime} ({s.totalDuration}m)</span>
                      <strong className="text-foreground">{s.therapistName}</strong>
                    </div>
                  ))}
                </div>
                {/* Explain redeemed & remaining services for partial redeem */}
                {(redeemOutcome?.status === 'partially_redeemed' || unassignedCount > 0) && (
                  <div className="pt-2 border-t border-border/40 space-y-2 text-xs">
                    <div>
                      <p className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <span>✓ Redeemed in this booking ({sessions.flatMap((s) => s.services).length}):</span>
                      </p>
                      <p className="text-[11px] text-foreground font-semibold pl-2 mt-0.5">
                        {sessions.flatMap((s) => s.services.map((sv) => sv.name)).join(', ')}
                      </p>
                    </div>
                    {giftedList.filter((g) => !new Set(sessions.flatMap((s) => s.serviceIds.map(String))).has(g.id)).length > 0 && (
                      <div className="pt-1.5 border-t border-dashed border-border/40">
                        <p className="font-bold text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <span>⏳ Remaining on voucher ({giftedList.filter((g) => !new Set(sessions.flatMap((s) => s.serviceIds.map(String))).has(g.id)).length}):</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground pl-2 mt-0.5">
                          {giftedList
                            .filter((g) => !new Set(sessions.flatMap((s) => s.serviceIds.map(String))).has(g.id))
                            .map((g) => g.name)
                            .join(', ')}
                        </p>
                        <p className="text-[10px] text-amber-700/80 italic pl-2 pt-0.5">
                          Remaining services can be redeemed in future bookings using this voucher.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 text-primary hover:bg-primary/10 px-5 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 transition shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── STEP 1: SESSIONS ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Voucher Coverage: service, add-ons, extra time */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-xs font-bold text-foreground">Covered by Voucher</p>
                    </div>
                    {pkgInfo && (
                      <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold text-amber-800 dark:text-amber-200">{pkgInfo.name} · package</p>
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-500/20 px-2 py-0.5 rounded-full">
                            Package Price: {fmt(voucher.total_amount ?? voucherAmount)} {currency}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {assignedCount}/{giftedList.length} included services scheduled. Add a session, choose the services
                          for it, then its room, time and therapist. Every service must be scheduled before you can confirm.
                        </p>
                      </div>
                    )}
                    <VoucherCoverageList voucher={voucher} currency={currency} isPackage={isPackageVoucher} packagePrice={voucher.total_amount ?? voucherAmount} />
                  </div>

                  {/* Sessions Header */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h4 className="text-sm font-extrabold text-foreground">Booking Sessions</h4>
                      <p className="text-xs text-muted-foreground">{giftedList.length > 1 ? 'Choose the services to redeem now (the rest stay on the voucher), then therapist, room and start time' : 'Choose therapist, room and start time'} for {selectedDate} — services and room type are fixed by the voucher</p>
                    </div>
                    {sessions.length < maxSessions && unassignedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddSessionModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Session</span>
                      </button>
                    )}
                  </div>

                  {/* Sessions List */}
                  {sessions.length === 0 ? (
                    <div className="py-10 px-4 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2">
                      <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-xs font-bold text-foreground">No sessions added yet</p>
                      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                        Click &quot;Add Session&quot; to configure your service, room arrangement, start time, and therapist.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddSessionModal(true)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add First Session</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {sessions.map((sess, idx) => (
                        <div
                          key={sess.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl border border-border/70 bg-card hover:bg-muted/10 transition shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm text-foreground">{sess.startTime}</span>
                                <span className="text-[11px] text-muted-foreground">({sess.totalDuration} min)</span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  <Building2 className="h-3 w-3" />
                                  {sess.arrangementName}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {sess.services.map((s) => s.name).join(' + ')} · Therapist: <strong className="text-foreground">{sess.therapistName}</strong>
                                {sess.secondaryTherapistName && ` & ${sess.secondaryTherapistName}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {isPackageVoucher ? (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                                Covered by Package
                              </span>
                            ) : (
                              <span className="text-xs font-extrabold text-foreground">{fmt(sess.sessionPrice)} KWD</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSession(idx)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-muted transition cursor-pointer"
                              title="Remove session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* Submit Error */}
              {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!bookingSuccess && (
          <div className="shrink-0 flex items-center justify-between border-t border-border/60 bg-card px-6 py-3.5">
            <div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  {isPackageVoucher ? 'Package Total Price' : `Total (${sessions.length} session${sessions.length > 1 ? 's' : ''})`}
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {isPackageVoucher ? `${fmt(voucher.total_amount ?? voucherAmount)} KWD` : `${fmt(netPayablePrice)} KWD`}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">({totalBookingDuration} min)</span>
              </div>

              {(
                <button
                  type="button"
                  disabled={submitting || sessions.length === 0 || (isPackageVoucher && unassignedCount > 0)}
                  onClick={() => handleConfirmRedeem()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Confirming Booking…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirm Booking & Redeem</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Sub-popup: Add Session Modal ── */}
      {showAddSessionModal && (
        <AddVoucherSessionModal
          sessionIndex={sessions.length}
          branchId={selectedBranchId}
          selectedDate={selectedDate}
          voucher={voucher}
          availabilitiesData={availabilitiesData}
          authHeader={authHeader}
          existingSessions={sessions}
          maxNewSessions={Math.min(maxSessions - sessions.length, unassignedCount)}
          onAdd={(newSess) => setSessions((prev) => [...prev, newSess])}
          onClose={() => setShowAddSessionModal(false)}
        />
      )}

      {/* ── Print Receipt Modal ── */}
      {showReceiptModal && bookingSuccess && (
        <BookingReceiptModal
          data={{
            bookingNumber: bookingSuccess.booking_number || bookingSuccess.number || null,
            reference: bookingSuccess.booking_number || bookingSuccess.id || null,
            invoiceNumber: resolvedInvoiceNumber || null,
            customerName: recipientName,
            customerPhone: recipientPhone,
            customerEmail: recipientEmail,
            branchName: selectedBranchName,
            arrangementName: sessions[0]?.arrangementName || null,
            therapistName: sessions[0]?.therapistName || null,
            secondaryTherapistName: sessions[0]?.secondaryTherapistName || null,
            serviceName: isPackageVoucher ? (pkgInfo?.name || 'Spa Package') : sessions[0]?.services[0]?.name || 'Spa Service',
            services: sessions.flatMap((s) =>
              s.services.map((sv) => ({
                name: sv.name,
                category: sv.category,
                price: isPackageVoucher ? 0 : sv.base_price,
                duration: sv.duration_minutes,
                therapistName: s.therapistName || null,
                secondaryTherapistName: s.secondaryTherapistName || null,
                arrangementName: s.arrangementName || null,
              }))
            ),
            appointmentStart: sessions[0]?.startTime || null,
            appointmentDate: selectedDate,
            timeSlot: sessions.map((s) => s.startTime).filter(Boolean).join(', ') || null,
            totalDuration: totalBookingDuration,
            currency,
            subtotal: isPackageVoucher ? (voucher.total_amount ?? voucherAmount) : totalBookingPrice,
            totalAmount: isPackageVoucher ? (voucher.total_amount ?? voucherAmount) : netPayablePrice,
            paymentStatus: 'paid',
            paymentMethod: `Gift Voucher (${resolvedPaymentProvider || 'Prepaid'})`,
            paymentProvider: resolvedPaymentProvider || 'Gift Voucher',
            isVoucherRedemption: true,
            isVoucherPackage: isPackageVoucher,
            voucherPackageName: pkgInfo?.name || null,
            voucherPackagePrice: voucher.total_amount ?? voucherAmount,
            voucherCode: voucher.voucher_number || voucherCode,
            isPartialRedeem: unassignedCount > 0 || redeemOutcome?.status === 'partially_redeemed',
            redeemedServices: sessions.flatMap((s) =>
              s.services.map((sv) => ({ name: sv.name, duration: sv.duration_minutes }))
            ),
            remainingServices: giftedList
              .filter((g) => !new Set(sessions.flatMap((s) => s.serviceIds.map(String))).has(g.id))
              .map((g) => ({ name: g.name, duration: g.duration })),
          }}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

    </div>
  );
}
