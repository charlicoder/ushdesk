'use client';
/**
 * NewAppointmentBookingModal
 *
 * Dedicated multi-session booking popup triggered from the Therapist Schedule page.
 * Supports 1–3 sessions per booking on the same date.
 *
 * UX Flow:
 * 1. Main Popup Step 1: Displays header with therapist, branch, and date banner.
 *    The body starts blank with an "Add Session" button.
 * 2. Clicking "Add Session" opens a 2-step sub-popup:
 *    - Session 1 (Index 0):
 *      - Therapist and start time are fixed (from clicked schedule slot).
 *      - Services dropdown shows only services provided by that therapist.
 *      - Step 2 shows the fixed therapist & fixed time (read-only, not editable).
 *    - Subsequent Sessions (Index > 0):
 *      - Services dropdown shows all active services in the branch.
 *      - Step 2 shows all available therapists for the selected service(s).
 *      - Start times must be after the previous session's end time.
 *    - Clicking "Add Session" in the sub-popup appends the session summary to Step 1.
 * 3. Main Popup Step 2: Select/create customer & enter notes.
 * 4. Main Popup Step 3: Payment option (Pay on Branch vs Pay Now) & final confirmation.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, AlertCircle, X,
  Timer, Loader2, Scissors, Package, User, Phone, Mail,
  DollarSign, FileText, ChevronRight, CalendarCheck,
  LayoutGrid, Crown, Heart, Sparkles, Layers, Store, UserPlus,
  CreditCard, Hash, Trash2, Plus, ArrowRight, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { buildAppointmentWindow, parseClockToMinutes, kuwaitWallClockDate } from '@/lib/datetime';
import { MultiSelectDrop } from './MultiSelectDrop';
import { CreateCustomerModal, type CreatedCustomer } from './CreateCustomerModal';
import { MakePaymentModal } from './MakePaymentModal';
import { usePermissions } from '@/hooks/use-permissions';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SESSIONS = 3;
/** A booking that includes a package booked by its parts may use more sessions */
const PACKAGE_MAX_SESSIONS = 5;
const CURRENCY = 'KWD';

// ── Types ────────────────────────────────────────────────────────────────────

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
  image1?: string | null;
  thumbnail?: string | null;
  photo_url?: string | null;
  /** Components of a packaged service (returned by the services API) */
  included_services?: IncludedService[];
  /** Set on a component service that is booked as part of a package */
  package_id?: string;
  /** Ids of every component of that package (used to verify full coverage) */
  package_component_ids?: string[];
  package_components?: { id: string; name: string }[];
  package_name?: string;
  package_price?: string | number;
  /** Home service specific pricing fields */
  home_price_in_points?: number | null;
  home_loyalty_points?: number | null;
  home_price_for_extra_minutes?: string | number | null;
  [key: string]: unknown;
}

interface PackagePlanGroup {
  service_ids: string[];
  room_required: boolean;
  arrangements: { id: string; name: string; arrangement_type?: string }[];
  total_duration?: number;
}

interface PackagePlan {
  package_has_rooms: boolean;
  session_count: number;
  groups: PackagePlanGroup[];
  rooms_by_service: Record<string, string[]>;
}

interface PendingPackage {
  id: string;
  name: string;
  price: string | number;
}

interface IncludedService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  extra_minutes?: number;
  price_for_extra_minutes?: string | number | null;
  position?: number;
}

interface ApiAddOn {
  id: string;
  name: string;
  price?: string | number;
  duration_minutes?: number;
}

interface ApiArrangement {
  id: string;
  name: string;
  arrangement_type?: string;
  capacity?: number;
  arrangement_price?: string | number;
  base_price?: string | number;
  is_active?: boolean;
  image?: string | null;
  photo_url?: string | null;
  thumbnail?: string | null;
}

interface ApiTherapist {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar?: string;
  photo_url?: string;
  specialties?: { id: string; name: string }[];
  specialization?: string;
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

export interface SavedSession {
  id: string;
  serviceIds: string[];
  services: ApiService[];
  arrangementId: string;
  arrangementName: string;
  arrangementType: string;
  arrangementPrice?: number | null;
  addonIds: string[];
  arrangementAddonIds: string[];
  selectedAddons: ApiAddOn[];
  extraMinutes: number;
  extraPrice: number;
  therapistId: string;
  therapistName: string;
  therapistPhoto?: string | null;
  secondaryTherapistId?: string;
  secondaryTherapistName?: string;
  secondaryTherapistPhoto?: string | null;
  startTime: string; // e.g. "09:00 PM"
  totalDuration: number;
  servicePrice?: number;
  sessionPrice: number;
}

export interface NewAppointmentBookingModalProps {
  token: string;
  date: string;           // YYYY-MM-DD
  branchId: string;
  branchName: string;
  defaultTherapistId: string;
  defaultTherapistName: string;
  defaultTherapistPhoto?: string | null;
  defaultTimeSlot: string; // e.g. "10:00 AM" or "09:00 PM"
  maxDurationMinutes?: number;
  schedule?: Record<string, Record<string, any>>;
  scheduleData?: any;
  /** Home-service mode: same flow, but no branch / room; booking_type = home_service */
  homeService?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Room Icon & Gradient Configuration ───────────────────────────────────────

const ARRANGEMENT_CFG: Record<string, {
  label: string;
  Icon: React.ElementType;
  gradient: string;
  iconColor: string;
}> = {
  open_area:     { label: 'Open Area',     Icon: LayoutGrid, gradient: 'from-sky-400    via-cyan-500   to-blue-600',   iconColor: 'text-sky-200' },
  vip_suite:     { label: 'VIP Suite',     Icon: Crown,      gradient: 'from-amber-400  via-yellow-500 to-orange-600', iconColor: 'text-amber-200' },
  couple_room:   { label: 'Couple Room',   Icon: Heart,      gradient: 'from-rose-400   via-pink-500   to-fuchsia-600',iconColor: 'text-rose-200' },
  double_room:   { label: 'Double Room',   Icon: Heart,      gradient: 'from-pink-400   via-rose-500   to-red-600',    iconColor: 'text-pink-200' },
  single_room:   { label: 'Single Room',   Icon: Sparkles,   gradient: 'from-violet-400 via-purple-500  to-indigo-600', iconColor: 'text-violet-200' },
  private_suite: { label: 'Private Suite', Icon: Layers,     gradient: 'from-teal-400   via-emerald-500 to-green-600', iconColor: 'text-teal-200' },
  other:         { label: 'Arrangement',   Icon: Store,      gradient: 'from-slate-400  via-gray-500   to-zinc-600',   iconColor: 'text-slate-200' },
};

function getArrCfg(type?: string) {
  return ARRANGEMENT_CFG[type ?? 'other'] ?? ARRANGEMENT_CFG.other;
}

function isDoubleOccupancy(type?: string): boolean {
  return type === 'couple_room' || type === 'double_room';
}

function fmt(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return '0.000';
  const n = parseFloat(String(v));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

/** Price of a service when booked as a home service (falls back to the regular price) */
function homePriceOf(sv: ApiService): number {
  const hp = parseFloat(String((sv as Record<string, unknown>).home_service_price ?? ''));
  if (!isNaN(hp) && hp > 0) return hp;
  return parseFloat(String(sv.base_price ?? '0')) || 0;
}

/** Price of an add-on when booked as a home service (falls back to regular price) */
function homeAddonPriceOf(a: ApiAddOn, homeService?: boolean): number {
  if (!homeService) return parseFloat(String(a.price ?? '0')) || 0;
  const raw = a as unknown as Record<string, unknown>;
  const hp = parseFloat(String(raw.home_service_price ?? ''));
  if (!isNaN(hp) && hp > 0) return hp;
  return parseFloat(String(a.price ?? '0')) || 0;
}

/** Extra-minutes price when booked as home service (falls back to regular price_for_extra_minutes) */
function homePriceForExtraOf(sv: ApiService): number {
  const hp = parseFloat(String(sv.home_price_for_extra_minutes ?? ''));
  if (!isNaN(hp) && hp > 0) return hp;
  return parseFloat(String(sv.price_for_extra_minutes ?? '0')) || 0;
}

function therapistDisplayName(t: ApiTherapist | null | undefined): string {
  if (!t) return '';
  return t.full_name ?? ([t.first_name, t.last_name].filter(Boolean).join(' ') || '');
}

/** Convert "10:00 AM" or "10:00" → "10:00" (HH:MM 24h) */
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

function addMinutesToTime(timeStr: string, mins: number): string {
  const hhmm = toHHMM(timeStr);
  const total = parseClockToMinutes(hhmm) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatSessionTimeRange(startTime: string, durationMinutes: number): string {
  if (!startTime) return `${durationMinutes} min`;
  try {
    const end = addMinutesToTime(startTime, durationMinutes);
    return `${startTime} – ${end} (${durationMinutes} min)`;
  } catch {
    return `${startTime} (${durationMinutes} min)`;
  }
}

function minutesToSlotLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hd = h % 12 === 0 ? 12 : h % 12;
  return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTherapistScheduleSlots(
  therapistId: string,
  schedule?: Record<string, Record<string, any>>,
): Record<string, any> | null {
  if (!schedule || Object.keys(schedule).length === 0) return null;
  if (schedule[therapistId]) return schedule[therapistId];
  const target = String(therapistId).toLowerCase().trim();
  for (const [k, v] of Object.entries(schedule)) {
    if (String(k).toLowerCase().trim() === target) {
      return v;
    }
  }
  return null;
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
    const d = kuwaitWallClockDate(s);
    if (!isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
  } catch {}
  return null;
}

function isTherapistAvailableForWindow(
  therapistId: string,
  startTime: string,
  durationMinutes: number,
  schedule?: Record<string, Record<string, any>>,
  scheduleData?: any,
  liveBookings?: any[],
): boolean {
  if (!therapistId || !startTime) return false;

  const startMin = parseClockToMinutes(toHHMM(startTime));
  const dur = durationMinutes > 0 ? durationMinutes : 30;
  const endMin = startMin + dur;
  const targetId = String(therapistId).toLowerCase().trim();

  // 1. Check schedule grid (if loaded)
  if (schedule && Object.keys(schedule).length > 0) {
    const therapistSlots = getTherapistScheduleSlots(therapistId, schedule);
    if (!therapistSlots) {
      // If schedule is loaded and therapist is not in it, they are not scheduled at this branch/date
      return false;
    }

    for (let m = startMin; m < endMin; m += 30) {
      const slotLabel = minutesToSlotLabel(m);
      let slot = therapistSlots[slotLabel];
      if (!slot) {
        const noPad = slotLabel.replace(/^0/, '');
        slot = therapistSlots[noPad];
      }
      if (!slot || slot.status !== 'available') {
        return false;
      }
    }
  }

  // 2. Check bookings (from both scheduleData and liveBookings)
  const allBookings: any[] = [
    ...(scheduleData?.bookings ?? []),
    ...(liveBookings ?? []),
  ];

  for (const bk of allBookings) {
    const rawStatus = String(bk.status ?? bk.booking_status ?? '').toLowerCase().trim();
    if (rawStatus === 'cancelled' || rawStatus === 'refunded' || rawStatus === 'parked') continue;

    const bkTherapistId = String(bk.therapist_id ?? (bk.therapist_data as any)?.id ?? '').toLowerCase().trim();
    const bkSecondaryId = String(bk.secondary_therapist_id ?? '').toLowerCase().trim();

    if (Array.isArray(bk.sessions) && bk.sessions.length > 0) {
      for (const sess of bk.sessions) {
        const sessTId = String(sess.therapist_id || sess.therapist_data?.id || bkTherapistId).toLowerCase().trim();
        const sessSecId = String(sess.secondary_therapist_id ?? '').toLowerCase().trim();
        if (sessTId === targetId || sessSecId === targetId) {
          const ssm = parseTimeToMinutes(sess.appointment_start || sess.start || bk.appointment_start || bk.start);
          const sem = parseTimeToMinutes(sess.appointment_end || sess.end || bk.appointment_end || bk.end);
          if (ssm !== null && sem !== null) {
            if (startMin < sem && endMin > ssm) {
              return false;
            }
          }
        }
      }
    } else if (bkTherapistId === targetId || bkSecondaryId === targetId) {
      const bsm = parseTimeToMinutes(bk.appointment_start || bk.start);
      const bem = parseTimeToMinutes(bk.appointment_end || bk.end);
      if (bsm !== null && bem !== null) {
        if (startMin < bem && endMin > bsm) {
          return false;
        }
      }
    }
  }

  // 3. Fallback: If schedule grid is not loaded, verify working hours and breaks from scheduleData
  if ((!schedule || Object.keys(schedule).length === 0) && scheduleData) {
    const rawTList: any[] = scheduleData.therapists ?? [];
    const tMatch = rawTList.find(
      (t: any) => String(t.id).toLowerCase().trim() === targetId,
    );
    if (!tMatch) {
      return false;
    }

    const availList: any[] = scheduleData.availability ?? [];
    const avMatch = availList.find(
      (av: any) => String(av.therapist_id).toLowerCase().trim() === targetId,
    );
    if (avMatch && Array.isArray(avMatch.intervals)) {
      const hasCoverage = avMatch.intervals.some((iv: any) => {
        const ssm = parseTimeToMinutes(iv.start);
        const sem = parseTimeToMinutes(iv.end);
        return ssm !== null && sem !== null && ssm <= startMin && sem >= endMin;
      });
      if (!hasCoverage) return false;
    }

    const rawBreaks = [
      ...(tMatch.break_intervals ?? tMatch.break_times ?? []),
      ...(avMatch?.break_intervals ?? avMatch?.break_times ?? []),
    ];
    for (const brk of rawBreaks) {
      const bsm = parseTimeToMinutes(brk.start || brk.start_time);
      const bem = parseTimeToMinutes(brk.end || brk.end_time);
      if (bsm !== null && bem !== null && startMin < bem && endMin > bsm) {
        return false;
      }
    }
  }

  return true;
}

/** Generate 30-min time slots between 09:00 AM and 10:00 PM */
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let m = 9 * 60; m <= 22 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hd = h % 12 || 12;
    slots.push(`${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`);
  }
  return slots;
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </p>
  );
}

// ── SearchDrop Component ─────────────────────────────────────────────────────

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
  disabled?: boolean;
}

function SearchDrop<T>({
  value, placeholder, loading, items, isSelected, selectedItem,
  icon: Icon, onSearch, onSelect, onClear, renderItem, disabled,
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
            className="absolute right-2.5 grid h-5 w-5 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && !sel && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">
              {loading ? 'Loading…' : 'No results found'}
            </p>
          ) : (
            items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => { onSelect(item); setOpen(false); }}
                className={cn('cursor-pointer transition hover:bg-muted/60', isSelected(item) && 'bg-primary/5')}
              >
                {renderItem(item)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-Popup: Add Session Modal (2-Step) ────────────────────────────────────

export interface AddSessionModalProps {
  authHeader: string;
  branchId: string;
  date: string;
  defaultTherapistId: string;
  defaultTherapistName: string;
  defaultTherapistPhoto?: string | null;
  defaultTimeSlot: string;
  sessionIndex: number;
  minStartTimeMinutes?: number; // earliest allowed time in minutes from midnight for subsequent sessions
  minStartTimeDisplay?: string; // string representation e.g. "11:00 AM"
  schedule?: Record<string, Record<string, any>>;
  scheduleData?: any;
  /** package id -> component service ids already booked in earlier sessions */
  usedPackageComponents?: Record<string, string[]>;
  /** A package with services not yet in any session: this session pre-fills its next group */
  pendingPackage?: PendingPackage | null;
  /** The booking already has non-package services: a package cannot be added */
  blockPackages?: boolean;
  /** Home-service mode: no rooms, home-service prices, home-service therapists */
  homeService?: boolean;
  onClose: () => void;
  onAddSession: (session: SavedSession) => void;
}

export function AddSessionSubModal({
  authHeader, branchId, date,
  defaultTherapistId, defaultTherapistName, defaultTherapistPhoto,
  defaultTimeSlot, sessionIndex, minStartTimeMinutes, minStartTimeDisplay,
  schedule, scheduleData, usedPackageComponents, pendingPackage, blockPackages, homeService,
  onClose, onAddSession,
}: AddSessionModalProps) {
  const isFirstSession = sessionIndex === 0;
  const [subStep, setSubStep] = useState<1 | 2>(1);

  // ── Step 1 Form State ──
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [services, setServices] = useState<ApiService[]>([]);
  // Package support: component lists of selected packages, and "split package" state
  const [packageDetails, setPackageDetails] = useState<Record<string, ApiService>>({});
  const [extraServices, setExtraServices] = useState<Record<string, ApiService>>({});
  const [splitPkg, setSplitPkg] = useState<ApiService | null>(null);
  const [pkgPlan, setPkgPlan] = useState<PackagePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  /** Rooms common to the services of the group being built (restricts the room list) */
  const groupRoomIdsRef = useRef<Set<string> | null>(null);
  const [groupRoomless, setGroupRoomless] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);

  const [arrangementId, setArrangementId] = useState('');
  const [arrangementName, setArrangementName] = useState('');
  const [arrangementType, setArrangementType] = useState('');
  const [arrangements, setArrangements] = useState<ApiArrangement[]>([]);
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  /** Rooms of the same arrangement type are shown as one card; the actual room is auto-assigned per time slot */
  const [arrangementTypeKey, setArrangementTypeKey] = useState('');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);

  const [arrangementServices, setArrangementServices] = useState<ApiService[] | null>(null);
  const [arrangementAddons, setArrangementAddons] = useState<ApiAddOn[]>([]);

  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [arrangementAddonIds, setArrangementAddonIds] = useState<string[]>([]);
  const [extraMinutes, setExtraMinutes] = useState<number>(0);

  // ── Step 2 Form State ──
  // For Session 1: strictly locked to defaultTherapistId and defaultTimeSlot
  const [selectedTherapistId, setSelectedTherapistId] = useState(defaultTherapistId);
  const [selectedTherapistName, setSelectedTherapistName] = useState(defaultTherapistName);
  const [selectedTherapistPhoto, setSelectedTherapistPhoto] = useState<string | null>(defaultTherapistPhoto ?? null);
  const [secondaryTherapistId, setSecondaryTherapistId] = useState('');
  const [secondaryTherapistName, setSecondaryTherapistName] = useState('');
  const [secondaryTherapistPhoto, setSecondaryTherapistPhoto] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(defaultTimeSlot);

  const [availableTherapists, setAvailableTherapists] = useState<ApiTherapist[]>([]);
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  const [therapistsLoading, setTherapistsLoading] = useState(false);

  // ── 1. Fetch Services based on Session Index ──
  // For Session 1 (index 0): ONLY services available for the pre-selected therapist!
  // For Subsequent Sessions (index > 0): ALL available services in that branch!
  useEffect(() => {
    setServicesLoading(true);
    const endpoint = isFirstSession
      ? `/api/v1/therapists/${defaultTherapistId}/services/`
      : homeService
        ? `/api/v1/services/?is_active=true&is_home_service_eligible=true`
        : `/api/v1/services/?branch_id=${branchId}&is_active=true`;

    authedFetch(endpoint, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => {
        let list: ApiService[] = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        if (homeService) {
          list = list.filter((sv: ApiService) => {
            const raw = sv as Record<string, unknown>;
            return (
              sv.is_home_service_eligible === true ||
              raw.is_home_service_eligible === true ||
              String(raw.is_home_service_eligible).toLowerCase() === 'true'
            );
          });
        }
        setServices(list);
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [isFirstSession, defaultTherapistId, branchId, authHeader, homeService]);

  // ── Load arrangements when primary service (or package) changes ──
  const arrangementTargetServiceId = splitPkg
    ? (serviceIds.length > 0 ? String(splitPkg.id) : '')
    : String(extraServices[serviceIds[0]]?.package_id || serviceIds[0] || '');

  useEffect(() => {
    if (homeService || !arrangementTargetServiceId || !branchId) {
      setArrangements([]);
      setArrangementId('');
      setArrangementName('');
      setArrangementType('');
      return;
    }
    setArrangementsLoading(true);
    const qs = new URLSearchParams({ branch_id: branchId });
    authedFetch(`/api/v1/services/${arrangementTargetServiceId}/arrangements/?${qs}`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then(r => r.json())
      .then(d => {
        let list: ApiArrangement[] = (Array.isArray(d) ? d : (d.data ?? d.results ?? []))
          .filter((a: ApiArrangement) => a.is_active !== false);
        // Package group: only rooms that every service of the group shares (when not using package-level rooms)
        if (!splitPkg && groupRoomIdsRef.current && groupRoomIdsRef.current.size > 0) {
          const allowed = groupRoomIdsRef.current;
          list = list.filter(a => allowed.has(String(a.id)));
        }
        setArrangements(list);
        setArrangementTypeKey(list.length > 0 ? String(list[0].arrangement_type ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') || `id:${list[0].id}` : '');
        if (list.length > 0) {
          const first = list[0];
          setArrangementId(first.id);
          setArrangementName(first.name);
          setArrangementType(first.arrangement_type ?? '');
        } else {
          setArrangementId('');
          setArrangementName('');
          setArrangementType('');
        }
      })
      .catch(() => setArrangements([]))
      .finally(() => setArrangementsLoading(false));
  }, [arrangementTargetServiceId, branchId, authHeader, homeService, splitPkg]);

  // ── Load arrangement services ──
  useEffect(() => {
    setArrangementServices(null); // avoid using the previous room's services while loading
    if (!arrangementId) return;
    let cancelled = false;
    authedFetch(`/api/v1/service-arrangements/${arrangementId}/services`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setArrangementServices(Array.isArray(d) ? d : (d.data ?? d.results ?? [])); })
      .catch(() => { if (!cancelled) setArrangementServices([]); });
    return () => { cancelled = true; };
  }, [arrangementId, authHeader]);

  // ── Load arrangement add-ons ──
  useEffect(() => {
    if (!arrangementId) { setArrangementAddons([]); return; }
    authedFetch(`/api/v1/service-arrangements/${arrangementId}/addons/`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then(r => r.json())
      .then(d => { setArrangementAddons(Array.isArray(d) ? d : (d.data ?? d.results ?? [])); })
      .catch(() => setArrangementAddons([]));
    setArrangementAddonIds([]);
  }, [arrangementId, authHeader]);

  // ── Derived Selected Services & Add-ons ──
  const selectedServices = useMemo(
    () => serviceIds
      .map(id => extraServices[id] ?? services.find(s => s.id === id))
      .filter((s): s is ApiService => Boolean(s)),
    [services, serviceIds, extraServices],
  );
  const primaryService = selectedServices[0] ?? null;

  const isPackagedService = Boolean(
    primaryService?.is_packaged_services === true ||
    String(primaryService?.is_packaged_services).toLowerCase() === 'true',
  );

  const serviceAddons = useMemo(() => {
    const seen = new Set<string>();
    const out: ApiAddOn[] = [];
    selectedServices.forEach((sv, i) => {
      const pkg = i === 0 ? isPackagedService : Boolean(
        sv.is_packaged_services === true || String(sv.is_packaged_services).toLowerCase() === 'true',
      );
      if (pkg) return;
      const rawAddons = sv.add_ons ?? (sv as Record<string, unknown>).addons ?? [];
      (rawAddons as ApiAddOn[]).forEach(a => {
        if (!seen.has(a.id)) {
          if (homeService) {
            const raw = a as unknown as Record<string, unknown>;
            const eligible =
              raw.is_available_for_home_service !== false &&
              raw.is_home_service_eligible !== false &&
              raw.is_active !== false;
            if (!eligible) return;
          }
          seen.add(a.id);
          out.push(a);
        }
      });
    });
    return out;
  }, [selectedServices, isPackagedService, homeService]);

  const selectedArrangement = useMemo(
    () => arrangements.find(a => a.id === arrangementId) ?? null,
    [arrangements, arrangementId],
  );

  const arrPrice = selectedArrangement?.arrangement_price != null
    ? parseFloat(String(selectedArrangement.arrangement_price)) || 0
    : null;

  const priceOfService = (sv: ApiService, idx: number): number => {
    if (sv.package_id) {
      // A package is charged once: its price rides on the first component booked overall
      const alreadyBooked = (usedPackageComponents?.[sv.package_id] ?? []).length > 0;
      const firstHere = selectedServices.find(x => x.package_id === sv.package_id);
      return !alreadyBooked && firstHere?.id === sv.id
        ? parseFloat(String(sv.package_price ?? '0')) || 0
        : 0;
    }
    if (homeService) return homePriceOf(sv);
    if (idx === 0) {
      return arrPrice !== null
        ? arrPrice
        : (parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0);
    }
    const fromRoom = arrangementServices?.find(x => String(x.id) === String(sv.id));
    return parseFloat(String(fromRoom?.arrangement_price ?? sv.arrangement_price ?? sv.base_price ?? '0')) || 0;
  };

  const servicePrice = selectedServices.reduce((sum, sv, i) => sum + priceOfService(sv, i), 0);

  const noAddons = isPackagedService || Boolean(splitPkg);
  const selectedSvcAddons = noAddons ? [] : serviceAddons.filter(a => addonIds.includes(a.id));
  const selectedArrAddons = noAddons ? [] : arrangementAddons.filter(a => arrangementAddonIds.includes(a.id));
  const allSelectedAddons = [...selectedSvcAddons, ...selectedArrAddons];
  const addonTotal = allSelectedAddons.reduce((s, a) => s + homeAddonPriceOf(a, homeService), 0);
  const addonDuration = allSelectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);

  const extraMinutesUnit = Number(primaryService?.extra_minutes ?? 0);
  const extraPricePerUnit = primaryService
    ? (homeService ? homePriceForExtraOf(primaryService) : (parseFloat(String(primaryService.price_for_extra_minutes ?? '0')) || 0))
    : 0;
  const hasExtraTime = extraMinutesUnit > 0 && extraPricePerUnit > 0;
  const calcExtraPrice = (mins: number) => {
    if (mins <= 0 || !hasExtraTime) return 0;
    return (mins / extraMinutesUnit) * extraPricePerUnit;
  };
  const extraMinutesPrice = calcExtraPrice(extraMinutes);

  const baseDuration = selectedServices.reduce((sum, sv) => sum + (sv.duration_minutes ?? 60), 0);
  const totalDuration = (primaryService ? baseDuration : 0) + addonDuration + extraMinutes;
  const totalPrice = servicePrice + addonTotal + extraMinutesPrice;

  // ── Rooms of the same type: one card, combined availability, auto-assigned room ──
  const arrKeyOf = (a: ApiArrangement) =>
    String(a.arrangement_type ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') || `id:${a.id}`;
  const arrangementGroups = useMemo(() => {
    const m = new Map<string, ApiArrangement[]>();
    arrangements.forEach(a => {
      const k = arrKeyOf(a);
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    return Array.from(m.entries()).map(([key, list]) => ({ key, list }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangements]);
  const activeGroup = arrangementGroups.find(g => g.key === arrangementTypeKey)
    ?? arrangementGroups.find(g => g.list.some(a => a.id === arrangementId))
    ?? arrangementGroups[0]
    ?? null;
  const groupRooms = activeGroup?.list ?? [];

  // Existing bookings of the day (to know which rooms are taken at a given time)
  useEffect(() => {
    if (homeService || !branchId || !date || arrangements.length === 0) { setRoomBookings([]); return; }
    let cancelled = false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
    const branchParam = isUuid ? `&branch_id=${branchId}` : '';
    authedFetch(`/booknpay/api/v1/bookings?date=${date}${branchParam}&page_size=100`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setRoomBookings(Array.isArray(d) ? d : (d?.data ?? d?.results ?? [])); })
      .catch(() => { if (!cancelled) setRoomBookings([]); });
    return () => { cancelled = true; };
  }, [homeService, branchId, date, arrangements.length, authHeader]);

  const isRoomFree = (roomId: string, startSlot: string, dur: number): boolean => {
    if (!roomId || !startSlot) return true;
    const startMin = parseClockToMinutes(toHHMM(startSlot));
    const endMin = startMin + (dur > 0 ? dur : 30);
    const target = String(roomId).toLowerCase().trim();
    const overlaps = (st: any, en: any) => {
      const a = parseTimeToMinutes(st);
      const b = parseTimeToMinutes(en);
      return a !== null && b !== null && startMin < b && endMin > a;
    };
    for (const bk of [...((scheduleData as any)?.bookings ?? []), ...roomBookings]) {
      const status = String(bk.status ?? bk.booking_status ?? '').toLowerCase().trim();
      if (status === 'cancelled' || status === 'refunded' || status === 'parked') continue;
      if (Array.isArray(bk.sessions) && bk.sessions.length > 0) {
        for (const ss of bk.sessions) {
          const rid = String(ss.service_arrangement_id ?? ss.service_arrangement_data?.arrangement_id ?? bk.service_arrangement_id ?? '').toLowerCase().trim();
          if (rid === target && overlaps(ss.appointment_start || ss.start || bk.appointment_start || bk.start, ss.appointment_end || ss.end || bk.appointment_end || bk.end)) return false;
        }
      } else {
        const rid = String(bk.service_arrangement_id ?? bk.service_arrangement_data?.arrangement_id ?? '').toLowerCase().trim();
        if (rid === target && overlaps(bk.appointment_start || bk.start, bk.appointment_end || bk.end)) return false;
      }
    }
    return true;
  };
  const effectiveStartSlot = isFirstSession ? defaultTimeSlot : selectedTimeSlot;
  const roomsFreeAt = (slot: string): ApiArrangement[] => groupRooms.filter(r => isRoomFree(r.id, slot, totalDuration));

  const applyRoom = (a: ApiArrangement) => {
    setArrangementId(a.id);
    setArrangementName(a.name);
    setArrangementType(a.arrangement_type ?? '');
  };
  const selectGroup = (key: string) => {
    setArrangementTypeKey(key);
    const list = arrangementGroups.find(g => g.key === key)?.list ?? [];
    const free = effectiveStartSlot ? list.filter(r => isRoomFree(r.id, effectiveStartSlot, totalDuration)) : list;
    const pick = free.find(r => r.id === arrangementId) ?? free[0] ?? list[0];
    if (pick) applyRoom(pick);
  };

  // Auto-select the room (of the chosen type) that is free for the selected start time
  useEffect(() => {
    if (groupRooms.length === 0 || !effectiveStartSlot) return;
    const free = groupRooms.filter(r => isRoomFree(r.id, effectiveStartSlot, totalDuration));
    if (free.length === 0 || free.some(r => r.id === arrangementId)) return;
    applyRoom(free[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupRooms, effectiveStartSlot, totalDuration, roomBookings, arrangementId]);

  // ── Available Time Slots for this session ──
  // For subsequent sessions: timeslots must start at or after previous session's end time!
  const timeSlots = useMemo(() => {
    const rawSlots = generateTimeSlots();
    if (typeof minStartTimeMinutes === 'number') {
      return rawSlots.filter(slot => {
        const slotMin = parseClockToMinutes(toHHMM(slot));
        return slotMin >= minStartTimeMinutes;
      });
    }
    return rawSlots;
  }, [minStartTimeMinutes]);

  // Ensure selectedTimeSlot is valid for subsequent sessions
  useEffect(() => {
    if (!isFirstSession && timeSlots.length > 0) {
      if (!selectedTimeSlot || !timeSlots.includes(selectedTimeSlot)) {
        setSelectedTimeSlot(timeSlots[0]);
      }
    }
  }, [isFirstSession, timeSlots, selectedTimeSlot]);

  // ── Fetch Therapists on SubStep 2 (For subsequent sessions only, or for dual therapist) ──
  useEffect(() => {
    if (subStep !== 2 || !primaryService) return;
    if (isFirstSession && !isDoubleOccupancy(arrangementType)) return;

    setTherapistsLoading(true);
    const startSlot = isFirstSession ? defaultTimeSlot : selectedTimeSlot;
    const dur = totalDuration > 0 ? totalDuration : (primaryService.duration_minutes ?? 60);
    const qs = new URLSearchParams({
      ...(homeService ? { available_for_home_service: 'true' } : { branch_id: branchId }),
      no_service_list: 'true',
      check_for_availability: 'true',
      date,
      appointment_start: toHHMM(startSlot),
      duration: String(dur),
    });
    const ids = serviceIds.length > 0 ? serviceIds : [primaryService.id];

    const fetchTherapists = Promise.all(ids.map(id =>
      authedFetch(`/api/v1/services/${id}/therapists?${qs}`, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      })
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : (d.data ?? d.results ?? [])) as ApiTherapist[]),
    ));

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
    const branchParam = isUuid ? `&branch_id=${branchId}` : '';
    const fetchLiveBookings = authedFetch(`/booknpay/api/v1/bookings?date=${date}${branchParam}&page_size=100`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (Array.isArray(d) ? d : (d?.data ?? d?.results ?? [])))
      .catch(() => []);

    Promise.all([fetchTherapists, fetchLiveBookings])
      .then(([lists, bpBookings]) => {
        setLiveBookings(bpBookings);
        let list: ApiTherapist[] = lists[0] ?? [];
        for (let i = 1; i < lists.length; i++) {
          const idsI = new Set(lists[i].map(t => t.id));
          list = list.filter(t => idsI.has(t.id));
        }

        // Strictly filter qualified therapists by schedule availability for the full session window
        list = list.filter(t => isTherapistAvailableForWindow(t.id, startSlot, dur, schedule, scheduleData, bpBookings));

        setAvailableTherapists(list);
        if (!isFirstSession && list.length > 0) {
          // If no therapist selected or currently selected isn't in available list, pick first
          if (!selectedTherapistId || !list.some(t => t.id === selectedTherapistId)) {
            const first = list[0];
            setSelectedTherapistId(first.id);
            setSelectedTherapistName(therapistDisplayName(first));
            setSelectedTherapistPhoto(first.avatar ?? first.photo_url ?? null);
          }
        }
      })
      .catch(() => setAvailableTherapists([]))
      .finally(() => setTherapistsLoading(false));
  }, [subStep, isFirstSession, arrangementType, primaryService, serviceIds, branchId, date, defaultTimeSlot, selectedTimeSlot, totalDuration, authHeader, schedule, scheduleData, homeService]);

  // Keep secondary therapist valid when availableTherapists change
  useEffect(() => {
    if (secondaryTherapistId && isDoubleOccupancy(arrangementType)) {
      const primaryId = isFirstSession ? defaultTherapistId : selectedTherapistId;
      const isStillAvailable = availableTherapists.some(t => t.id === secondaryTherapistId && t.id !== primaryId);
      if (!isStillAvailable) {
        setSecondaryTherapistId('');
        setSecondaryTherapistName('');
        setSecondaryTherapistPhoto(null);
      }
    }
  }, [availableTherapists, secondaryTherapistId, arrangementType, isFirstSession, defaultTherapistId, selectedTherapistId]);

  // Services offered by the selected room (arrangement) of this session
  const arrangementServiceIdSet = useMemo(
    () => new Set((arrangementServices ?? []).map(s => String(s.id))),
    [arrangementServices],
  );
  /** Reason an unselected service can't be added: it is not offered in the room chosen for the first service */
  const serviceDisabledReason = (svc: ApiService): string | null => {
    // A package must be booked on its own: never combined with other services or packages
    const isPkg = (x: ApiService) => x.is_packaged_services === true || String(x.is_packaged_services).toLowerCase() === 'true';
    if (!serviceIds.includes(svc.id)) {
      if (isPkg(svc)) {
        if (blockPackages) return 'Packages cannot be combined with other services';
        if (serviceIds.length > 0) return 'A package must be booked on its own';
      } else if (selectedServices.some(isPkg)) {
        return 'Not available while a package is selected';
      }
    }
    if (selectedServices.some(isPkg)) return null;
    if (serviceIds.length === 0) return null;
    if (homeService) return null;
    if (!arrangementId || arrangementServices === null) return 'Loading room services\u2026';
    if (!arrangementServiceIdSet.has(String(svc.id))) return 'Unavailable for this room and session';
    return null;
  };

  // Drop additional services that are not offered in the (changed) room
  useEffect(() => {
    if (splitPkg || selectedServices.some(s => Boolean(s.package_id))) return;
    if (arrangementServices === null || serviceIds.length < 2) return;
    const keep = serviceIds.filter((id, i) => i === 0 || arrangementServiceIdSet.has(String(id)));
    if (keep.length !== serviceIds.length) setServiceIds(keep);
  }, [arrangementServices, arrangementServiceIdSet, serviceIds, splitPkg, selectedServices]);

  const toggleService = (sv: ApiService) => {
    if (!serviceIds.includes(sv.id) && serviceDisabledReason(sv)) return;
    const ids = serviceIds.includes(sv.id)
      ? serviceIds.filter(x => x !== sv.id)
      : [...serviceIds, sv.id];
    setServiceIds(ids);
  };

  // ── Packages: show included services; book whole, or split across sessions ──
  const isPackage = (sv: ApiService) =>
    sv.is_packaged_services === true || String(sv.is_packaged_services).toLowerCase() === 'true';
  const componentsOf = (sv: ApiService): IncludedService[] =>
    sv.included_services ?? packageDetails[sv.id]?.included_services ?? [];

  // Load the component list of any selected package that does not carry it yet
  useEffect(() => {
    selectedServices.filter(sv => isPackage(sv) && !sv.included_services && !packageDetails[sv.id]).forEach(sv => {
      authedFetch(`/api/v1/services/${sv.id}/`, { headers: authHeader ? { Authorization: authHeader } : undefined })
        .then(r => r.json())
        .then(d => {
          const detail = (d?.data ?? d) as ApiService;
          setPackageDetails(prev => ({ ...prev, [sv.id]: { ...sv, included_services: detail?.included_services ?? [] } }));
        })
        .catch(() => setPackageDetails(prev => ({ ...prev, [sv.id]: { ...sv, included_services: [] } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServices]);

  const makeComponent = (pkg: ApiService, c: IncludedService, all: IncludedService[]): ApiService => ({
    id: c.id,
    name: c.name,
    duration_minutes: c.duration_minutes,
    base_price: c.base_price ?? 0,
    extra_minutes: c.extra_minutes ?? 0,
    price_for_extra_minutes: c.price_for_extra_minutes ?? 0,
    package_id: pkg.id,
    package_name: pkg.name,
    package_price: pkg.base_price ?? 0,
    package_component_ids: all.map(x => x.id),
    package_components: all.map(x => ({ id: x.id, name: x.name })),
  });

  const usedIds = (pkgId: string) => new Set(usedPackageComponents?.[pkgId] ?? []);
  const therapistOffers = (id: string) => !isFirstSession || services.some(sv => String(sv.id) === String(id));

  /** Why a package service cannot be ticked in this session (null = selectable) */
  const componentDisabledReason = (c: IncludedService): string | null => {
    if (!splitPkg) return null;
    if (usedIds(splitPkg.id).has(c.id)) return 'Already in another session';
    if (!therapistOffers(c.id)) return `Not offered by ${defaultTherapistName}`;
    return null;
  };

  const loadPackagePlan = async (pkgId: string): Promise<PackagePlan | null> => {
    setPlanLoading(true);
    try {
      const r = await authedFetch(`/api/v1/services/${pkgId}/package-plan/?branch_id=${encodeURIComponent(branchId)}`, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      });
      if (!r.ok) return null;
      const plan = (await r.json()) as PackagePlan;
      setPkgPlan(plan);
      return plan;
    } catch {
      return null;
    } finally {
      setPlanLoading(false);
    }
  };

  /**
   * Switch to "services of this package, grouped by session". Picks the first suggested group that still
   * has unbooked services (and that this session's therapist can perform) and restricts rooms to the
   * ones that group shares.
   */
  const startSplit = async (pkg: ApiService, preloaded?: IncludedService[], auto = false) => {
    const all = preloaded ?? componentsOf(pkg);
    const used = usedIds(pkg.id);
    const remaining = all.filter(c => !used.has(c.id));
    if (remaining.length === 0) return;
    const plan = pkgPlan ?? (await loadPackagePlan(pkg.id));
    const remainingIds = new Set(remaining.filter(c => therapistOffers(c.id)).map(c => c.id));
    const group = plan?.groups.find(g => g.service_ids.some(id => remainingIds.has(id)));
    const pickIds = group
      ? group.service_ids.filter(id => remainingIds.has(id))
      : [remaining.find(c => therapistOffers(c.id))?.id ?? remaining[0].id];
    groupRoomIdsRef.current = null;
    setGroupRoomless(false);
    const comps = Object.fromEntries(
      remaining.map(c => [c.id, makeComponent(pkg, c, all)]),
    );
    setExtraServices(prev => ({ ...prev, ...comps }));
    setSplitPkg({ ...pkg, included_services: all });
    setArrangementId('');
    setServiceIds(prev => [...prev.filter(id => id !== pkg.id), ...(auto ? pickIds : [])]);
  };

  const toggleComponent = (c: IncludedService) => {
    if (!splitPkg) return;
    const reason = componentDisabledReason(c);
    if (reason && !serviceIds.includes(c.id)) return;
    const all = splitPkg.included_services ?? [];
    setExtraServices(prev => ({ ...prev, [c.id]: prev[c.id] ?? makeComponent(splitPkg, c, all) }));
    setServiceIds(prev => {
      return prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id];
    });
  };

  /** Leave "package mode" and go back to choosing a service */
  const leavePackageMode = () => {
    const pkgId = splitPkg?.id;
    setServiceIds(prev => prev.filter(id => !splitPkg?.included_services?.some(c => c.id === id) && id !== pkgId));
    setSplitPkg(null);
    setExtraServices({});
    groupRoomIdsRef.current = null;
    setGroupRoomless(false);
    setArrangementId('');
  };

  // While a package (with included services) is chosen, room / extra time / add-ons wait for "Add session"
  const selectedPackage = !splitPkg ? selectedServices.find(isPackage) : undefined;
  const packageGate = Boolean(
    selectedPackage &&
      (componentsOf(selectedPackage).length > 0 || (!selectedPackage.included_services && !packageDetails[selectedPackage.id])),
  );

  // A package still has unbooked services: open this session already split with its next group
  const pendingStartedRef = useRef(false);
  useEffect(() => {
    if (!pendingPackage || pendingStartedRef.current) return;
    pendingStartedRef.current = true;
    (async () => {
      let comps: IncludedService[] = [];
      try {
        const r = await authedFetch(`/api/v1/services/${pendingPackage.id}/`, {
          headers: authHeader ? { Authorization: authHeader } : undefined,
        });
        const d = await r.json();
        comps = ((d?.data ?? d) as ApiService)?.included_services ?? [];
      } catch { /* handled below */ }
      if (comps.length === 0) return;
      await startSplit({ id: pendingPackage.id, name: pendingPackage.name, base_price: pendingPackage.price } as ApiService, comps);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPackage]);

  const handleFinishAdd = () => {
    if (!primaryService) return;
    if (!selectedTherapistId) return;

    const selectedAddonsWithPrice: ApiAddOn[] = allSelectedAddons.map(a => ({
      ...a,
      price: homeAddonPriceOf(a, homeService),
    }));

    const newSession: SavedSession = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      serviceIds,
      services: selectedServices,
      arrangementId,
      arrangementName,
      arrangementType,
      arrangementPrice: arrPrice,
      addonIds,
      arrangementAddonIds,
      selectedAddons: selectedAddonsWithPrice,
      extraMinutes,
      extraPrice: extraMinutesPrice,
      therapistId: isFirstSession ? defaultTherapistId : selectedTherapistId,
      therapistName: isFirstSession ? defaultTherapistName : selectedTherapistName,
      therapistPhoto: isFirstSession ? defaultTherapistPhoto : selectedTherapistPhoto,
      secondaryTherapistId: secondaryTherapistId || undefined,
      secondaryTherapistName: secondaryTherapistName || undefined,
      secondaryTherapistPhoto: secondaryTherapistPhoto || undefined,
      startTime: isFirstSession ? defaultTimeSlot : selectedTimeSlot,
      totalDuration,
      servicePrice,
      sessionPrice: totalPrice,
    };

    onAddSession(newSession);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl h-[90vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden">
        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent shrink-0" />

        {/* Top Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/40 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-xl bg-primary/10 text-primary">
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-primary">
                Session {sessionIndex + 1} Configuration
              </p>
              <p className="text-[11px] text-muted-foreground">
                {subStep === 1
                  ? isFirstSession
                    ? `Step 1: Select Service for ${defaultTherapistName}`
                    : `Step 1: Select Service from Branch Catalog`
                  : `Step 2: Therapist & Time Slot`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition text-muted-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {subStep === 1 ? (
            <div className="space-y-5">
              {/* Select Service Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold text-foreground">Select Service</p>
                    {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {isFirstSession && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <Lock className="h-2.5 w-2.5" /> {defaultTherapistName}&apos;s Services Only
                    </span>
                  )}
                  {!isFirstSession && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                      All Branch Services
                    </span>
                  )}
                </div>

                {!splitPkg && (<>
                <FLabel required>Search & Select</FLabel>
                <MultiSelectDrop<ApiService>
                  items={services.filter(s => {
                    if (homeService) {
                      const raw = s as Record<string, unknown>;
                      const el =
                        s.is_home_service_eligible === true ||
                        raw.is_home_service_eligible === true ||
                        String(raw.is_home_service_eligible).toLowerCase() === 'true';
                      if (!el) return false;
                    }
                    return !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase());
                  })}
                  selectedIds={serviceIds}
                  getId={sv => String(sv.id)}
                  search={serviceSearch}
                  placeholder={
                    servicesLoading
                      ? 'Loading services…'
                      : isFirstSession
                      ? `Select service for ${defaultTherapistName}…`
                      : 'Search & tick one or more branch services…'
                  }
                  loading={servicesLoading}
                  icon={Scissors}
                  onSearch={setServiceSearch}
                  onToggle={toggleService}
                  getDisabledReason={serviceDisabledReason}
                  renderItem={(sv, checked) => {
                    const priceVal = homeService
                      ? homePriceOf(sv)
                      : (parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0);
                    return (
                      <div className="flex items-start gap-3 py-3 pr-4">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Scissors className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{sv.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {sv.category && <span className="mr-2">{sv.category}</span>}
                            {sv.duration_minutes && <span>{sv.duration_minutes} min</span>}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary mt-0.5">
                          {fmt(priceVal)} KWD
                        </p>
                        {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />}
                      </div>
                    );
                  }}
                />

                {/* Selected Services Chips Matching Image 2 */}
                {selectedServices.map(sv => {
                  const priceVal = homeService
                    ? homePriceOf(sv)
                    : (parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0);
                  return (
                    <div
                      key={sv.id}
                      className="mt-2.5 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-wide text-primary truncate">
                            {sv.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-semibold">
                            {sv.duration_minutes ?? 60} min
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="text-sm font-black text-primary">
                          {fmt(priceVal)} KWD
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleService(sv)}
                          className="grid h-6 w-6 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                </>)}

                {/* Package details: included services + guided session builder */}
                {(() => {
                  const pkg = splitPkg ?? selectedServices.find(sv => isPackage(sv) && componentsOf(sv).length > 0) ?? null;
                  if (!pkg) return null;
                  const comps = splitPkg ? (splitPkg.included_services ?? []) : componentsOf(pkg);
                  if (comps.length === 0) return null;
                  const used = usedIds(pkg.id);
                  const inThisSession = new Set(serviceIds);
                  const doneCount = comps.filter(c => used.has(c.id)).length;
                  const hereCount = splitPkg ? comps.filter(c => inThisSession.has(c.id) && !used.has(c.id)).length : 0;
                  const leftCount = comps.length - doneCount - hereCount;
                  return (
                    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          {pkg.name} — included services
                        </p>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {doneCount + hereCount}/{comps.length} scheduled
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-500/15">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${Math.round(((doneCount + hereCount) / comps.length) * 100)}%` }}
                        />
                      </div>

                      <ul className="mt-3 space-y-1.5">
                        {comps.filter(c => !splitPkg || !used.has(c.id)).map(c => {
                          const takenElsewhere = used.has(c.id);
                          const reason = splitPkg ? componentDisabledReason(c) : null;
                          const checked = splitPkg ? inThisSession.has(c.id) : false;
                          const disabled = Boolean(reason) && !checked;
                          return (
                            <li key={c.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs', checked && 'bg-amber-500/10', disabled && 'opacity-60')}>
                              {splitPkg ? (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleComponent(c)}
                                />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className={cn('block font-semibold', takenElsewhere && 'line-through text-muted-foreground')}>{c.name}</span>
                                {disabled && <span className="block text-[10px] text-muted-foreground">{reason}</span>}
                                {takenElsewhere && !disabled && <span className="block text-[10px] text-emerald-600">Scheduled in another session</span>}
                              </span>
                              {c.duration_minutes ? <span className="shrink-0 text-muted-foreground">{c.duration_minutes} min</span> : null}
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!splitPkg ? (
                          <button
                            type="button"
                            disabled={planLoading}
                            onClick={() => startSplit(pkg)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition cursor-pointer disabled:opacity-60"
                          >
                            {planLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Add session
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={planLoading}
                              onClick={() => startSplit(splitPkg, splitPkg.included_services, true)}
                              className="rounded-xl border border-amber-500/40 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition cursor-pointer disabled:opacity-60"
                            >
                              Suggest grouping
                            </button>
                            {!pendingPackage && (
                              <button
                                type="button"
                                onClick={leavePackageMode}
                                className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
                              >
                                Choose another service
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {splitPkg && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {groupRoomless
                            ? 'These services need no room. '
                            : 'Tick the services for this session — services that cannot share a room with your selection are disabled. '}
                          {leftCount > 0
                            ? `${leftCount} service${leftCount > 1 ? 's' : ''} will remain — you’ll be guided to schedule them next.`
                            : 'Every service of the package is covered.'}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Extra Time Buttons Matching Image 2 */}
              {hasExtraTime && !packageGate && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Extra Time
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[0, 30, 60].map(mins => {
                      const active = extraMinutes === mins;
                      const price = calcExtraPrice(mins);
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setExtraMinutes(mins)}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-2xl border py-3 px-2 text-center transition cursor-pointer',
                            active
                              ? 'border-primary/60 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40'
                              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <p className="text-sm font-extrabold">{mins === 0 ? 'None' : `${mins} min`}</p>
                          <p className="text-[11px] font-semibold mt-0.5 opacity-85">
                            {mins === 0 ? '+0 KWD' : `+${fmt(price)} KWD`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Select Room Carousel Matching Image 2 */}
              {primaryService && !packageGate && !homeService && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-extrabold text-foreground">Select Room</p>
                      {arrangementsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>
                    {arrangementGroups.length > 0 && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {arrangementGroups.length} options
                      </span>
                    )}
                  </div>

                  {arrangements.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                      {arrangementGroups.map(({ key: groupKey, list: groupList }) => {
                        const arr = groupList.find(a => a.id === arrangementId) ?? groupList[0];
                        const cfg = getArrCfg(arr.arrangement_type);
                        const Icon = cfg.Icon;
                        const isSelected = activeGroup?.key === groupKey;
                        const price = arr.arrangement_price ?? arr.base_price;
                        const cardLabel = groupList.length > 1 && ARRANGEMENT_CFG[groupKey] ? ARRANGEMENT_CFG[groupKey].label : arr.name;
                        return (
                          <div
                            key={groupKey}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectGroup(groupKey)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') selectGroup(groupKey);
                            }}
                            className={cn(
                              'relative flex-shrink-0 w-[140px] h-[175px] rounded-2xl overflow-hidden transition-all duration-200 group cursor-pointer select-none',
                              isSelected
                                ? 'ring-[3px] ring-offset-2 ring-offset-card'
                                : 'ring-1 ring-border hover:ring-2 hover:ring-border/80',
                            )}
                            style={isSelected ? { '--tw-ring-color': '#c9a96e' } as React.CSSProperties : {}}
                          >
                            {/* Background gradient with icon watermark */}
                            <div className={cn('absolute inset-0 bg-gradient-to-br transition-transform group-hover:scale-105', cfg.gradient)}>
                              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                <Icon className={cn('h-20 w-20', cfg.iconColor)} />
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />

                            {/* Gold checkmark badge */}
                            {isSelected && (
                              <div
                                className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                                style={{ background: '#c9a96e' }}
                              >
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              </div>
                            )}

                            {/* Card Content */}
                            <div className="relative z-10 h-full w-full flex flex-col justify-between p-3 pointer-events-none">
                              <div className="h-6 shrink-0" />
                              <div className="flex-1 flex items-center justify-center px-1">
                                <p className="text-[13px] font-extrabold text-white leading-snug text-center break-words line-clamp-3">
                                  {cardLabel}
                                </p>
                              </div>
                              <div className="shrink-0 pt-1 text-center">
                                {price ? (
                                  <p className="text-[12px] font-bold" style={{ color: isSelected ? '#f0d49a' : '#d4b483' }}>
                                    KWD {fmt(price)}
                                  </p>
                                ) : (
                                  <div className="h-[12px]" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Golden Selection Confirmation Chip */}
                  {arrangementId && (
                    <div
                      className="mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-2"
                      style={{ borderColor: '#c9a96e33', background: '#c9a96e0a' }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#c9a96e' }} />
                      <p className="text-xs font-semibold" style={{ color: '#a07840' }}>
                        {arrangementName} selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Room Add-ons (Optional) Matching Image 2 */}
              {arrangementId && !isPackagedService && !splitPkg && !packageGate && arrangementAddons.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Room Add-ons
                    </p>
                    <span className="ml-auto text-[10px] font-semibold text-muted-foreground/60 uppercase">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {arrangementAddons.map(addon => {
                      const checked = arrangementAddonIds.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition select-none',
                            checked
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                              : 'border-border bg-muted/20 hover:bg-muted/40',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setArrangementAddonIds(prev =>
                                checked ? prev.filter(x => x !== addon.id) : [...prev, addon.id],
                              );
                            }}
                            className="mt-0.5 h-3.5 w-3.5 accent-amber-500 shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold leading-tight">{addon.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {addon.price && (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  +{fmt(addon.price)} KWD
                                </span>
                              )}
                              {addon.duration_minutes && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Timer className="h-2.5 w-2.5" />+{addon.duration_minutes}m
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add-on Services Matching Image 2 */}
              {!isPackagedService && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Add-on Services
                    </p>
                  </div>
                  {serviceAddons.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No add-ons available for this service</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {serviceAddons.map(addon => {
                        const checked = addonIds.includes(addon.id);
                        return (
                          <label
                            key={addon.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition select-none',
                              checked
                                ? 'border-primary/50 bg-primary/5 text-primary'
                                : 'border-border bg-muted/20 hover:bg-muted/40',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setAddonIds(prev =>
                                  checked ? prev.filter(x => x !== addon.id) : [...prev, addon.id],
                                );
                              }}
                              className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold leading-tight">{addon.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {addon.price && <span className="text-[10px] font-bold text-primary">+{fmt(homeAddonPriceOf(addon, homeService))} KWD</span>}
                                {addon.duration_minutes && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Timer className="h-2.5 w-2.5" />+{addon.duration_minutes}m
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Sub-Step 2: Therapist & Time Slot ── */
            <div className="space-y-6">
              {/* If Session 1: Show Fixed Therapist & Time (Read-only, Not Editable) */}
              {isFirstSession ? (
                <div className="space-y-5">
                  {/* Fixed Therapist Card */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-primary" />
                      <p className="text-sm font-extrabold text-foreground">Assigned Therapist</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Lock className="h-2.5 w-2.5" /> Fixed (From Schedule Slot)
                      </span>
                    </div>
                    <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
                      <div className="relative h-14 w-14 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/40 shadow-sm bg-muted">
                        {defaultTherapistPhoto ? (
                          <img src={defaultTherapistPhoto} alt={defaultTherapistName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-base font-black">
                            {defaultTherapistName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card shadow-xs">
                          <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-extrabold text-foreground leading-tight truncate">
                          {defaultTherapistName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Therapist fixed for Session 1 from the clicked schedule timeslot
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Start Time Card */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <p className="text-sm font-extrabold text-foreground">Appointment Time Slot</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Lock className="h-2.5 w-2.5" /> Fixed (From Schedule Slot)
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs">
                      <div className="flex items-center gap-3.5">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-base font-extrabold text-foreground leading-tight">
                            {defaultTimeSlot} → {addMinutesToTime(defaultTimeSlot, totalDuration)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Total Duration: <span className="font-bold text-foreground">{totalDuration} min</span>
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs px-3 py-1">
                        Locked Slot
                      </span>
                    </div>
                  </div>

                  {/* If Couple Room: allow second therapist */}
                  {isDoubleOccupancy(arrangementType) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-rose-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Second Therapist (Required for Couple/Double Room)
                        </p>
                        {therapistsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>
                      {therapistsLoading ? (
                        <div className="flex items-center justify-center p-4 border rounded-xl bg-muted/10">
                          <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                          <span className="text-xs text-muted-foreground">Checking therapist availability…</span>
                        </div>
                      ) : availableTherapists.filter(t => t.id !== defaultTherapistId && isTherapistAvailableForWindow(t.id, defaultTimeSlot, totalDuration, schedule, scheduleData, liveBookings)).length === 0 ? (
                        <div className="p-3 border border-dashed rounded-xl bg-muted/10 text-center">
                          <p className="text-xs font-medium text-muted-foreground">
                            No other therapists available for this service on {date} at {defaultTimeSlot} ({totalDuration} min).
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5 max-h-36 overflow-y-auto p-1">
                          {availableTherapists
                            .filter(t => t.id !== defaultTherapistId && isTherapistAvailableForWindow(t.id, defaultTimeSlot, totalDuration, schedule, scheduleData, liveBookings))
                            .map(t => {
                              const sel = secondaryTherapistId === t.id;
                              const name = therapistDisplayName(t);
                              const img = t.avatar ?? t.photo_url;
                              return (
                                <div
                                  key={t.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    if (sel) {
                                      setSecondaryTherapistId('');
                                      setSecondaryTherapistName('');
                                      setSecondaryTherapistPhoto(null);
                                    } else {
                                      setSecondaryTherapistId(t.id);
                                      setSecondaryTherapistName(name);
                                      setSecondaryTherapistPhoto(img ?? null);
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      if (sel) {
                                        setSecondaryTherapistId('');
                                        setSecondaryTherapistName('');
                                      } else {
                                        setSecondaryTherapistId(t.id);
                                        setSecondaryTherapistName(name);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-xl border p-2.5 transition cursor-pointer select-none',
                                    sel
                                      ? 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                      : 'border-border bg-muted/20 hover:bg-muted/40',
                                  )}
                                >
                                  <div className="h-8 w-8 shrink-0 rounded-full bg-rose-200 dark:bg-rose-900 grid place-items-center text-xs font-bold overflow-hidden">
                                    {img ? (
                                      <img src={img} alt={name} className="h-full w-full object-cover" />
                                    ) : (
                                      name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold truncate flex-1">{name}</span>
                                  {sel && <CheckCircle2 className="h-4 w-4 text-rose-500 shrink-0" />}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Subsequent Sessions (Session > 1): Select from Available Therapists and Available Time Slots */
                <div className="space-y-6">
                  {/* Therapist Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <p className="text-sm font-extrabold text-foreground">Select Available Therapist</p>
                        {therapistsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {availableTherapists.length} available
                      </span>
                    </div>

                    {availableTherapists.length === 0 && !therapistsLoading ? (
                      <p className="text-xs text-muted-foreground italic py-3">
                        No therapists available for this service on {date} at {selectedTimeSlot}.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                        {availableTherapists.map(t => {
                          const sel = selectedTherapistId === t.id;
                          const name = therapistDisplayName(t);
                          const img = t.avatar ?? t.photo_url;
                          return (
                            <div
                              key={t.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedTherapistId(t.id);
                                setSelectedTherapistName(name);
                                setSelectedTherapistPhoto(img ?? null);
                                if (secondaryTherapistId === t.id) {
                                  setSecondaryTherapistId('');
                                  setSecondaryTherapistName('');
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setSelectedTherapistId(t.id);
                                  setSelectedTherapistName(name);
                                  setSelectedTherapistPhoto(img ?? null);
                                }
                              }}
                              className={cn(
                                'flex items-center gap-3 rounded-2xl border p-3 transition cursor-pointer select-none',
                                sel
                                  ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30'
                                  : 'border-border bg-muted/20 hover:bg-muted/40',
                              )}
                            >
                              <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-primary/30 bg-muted">
                                {img ? (
                                  <img src={img} alt={name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold">
                                    {name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-foreground truncate">{name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {t.specialties?.[0]?.name ?? t.specialization ?? 'Therapist'}
                                </p>
                              </div>
                              {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Secondary Therapist if Couple/Double Room */}
                  {isDoubleOccupancy(arrangementType) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-rose-500" />
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Second Therapist (Required for Couple/Double Room)
                        </p>
                        {therapistsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>
                      {therapistsLoading ? (
                        <div className="flex items-center justify-center p-4 border rounded-xl bg-muted/10">
                          <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                          <span className="text-xs text-muted-foreground">Checking therapist availability…</span>
                        </div>
                      ) : availableTherapists.filter(t => t.id !== selectedTherapistId && isTherapistAvailableForWindow(t.id, selectedTimeSlot, totalDuration, schedule, scheduleData, liveBookings)).length === 0 ? (
                        <div className="p-3 border border-dashed rounded-xl bg-muted/10 text-center">
                          <p className="text-xs font-medium text-muted-foreground">
                            No other therapists available for this service on {date} at {selectedTimeSlot} ({totalDuration} min).
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5 max-h-36 overflow-y-auto p-1">
                          {availableTherapists
                            .filter(t => t.id !== selectedTherapistId && isTherapistAvailableForWindow(t.id, selectedTimeSlot, totalDuration, schedule, scheduleData, liveBookings))
                            .map(t => {
                              const sel = secondaryTherapistId === t.id;
                              const name = therapistDisplayName(t);
                              const img = t.avatar ?? t.photo_url;
                              return (
                                <div
                                  key={t.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    if (sel) {
                                      setSecondaryTherapistId('');
                                      setSecondaryTherapistName('');
                                      setSecondaryTherapistPhoto(null);
                                    } else {
                                      setSecondaryTherapistId(t.id);
                                      setSecondaryTherapistName(name);
                                      setSecondaryTherapistPhoto(img ?? null);
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      if (sel) {
                                        setSecondaryTherapistId('');
                                        setSecondaryTherapistName('');
                                      } else {
                                        setSecondaryTherapistId(t.id);
                                        setSecondaryTherapistName(name);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-xl border p-2.5 transition cursor-pointer select-none',
                                    sel
                                      ? 'border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                      : 'border-border bg-muted/20 hover:bg-muted/40',
                                  )}
                                >
                                  <div className="h-8 w-8 shrink-0 rounded-full bg-rose-200 dark:bg-rose-900 grid place-items-center text-xs font-bold overflow-hidden">
                                    {img ? (
                                      <img src={img} alt={name} className="h-full w-full object-cover" />
                                    ) : (
                                      name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold truncate flex-1">{name}</span>
                                  {sel && <CheckCircle2 className="h-4 w-4 text-rose-500 shrink-0" />}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Time Slot Selection (Filtered to start after previous session) */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <p className="text-sm font-extrabold text-foreground">Available Time Slots</p>
                      </div>
                      {minStartTimeDisplay && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          Starts after: <span className="font-bold text-foreground">{minStartTimeDisplay}</span>
                        </span>
                      )}
                    </div>

                    {timeSlots.length === 0 ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          No more timeslots available on this date after {minStartTimeDisplay}.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                        {timeSlots.map(slot => {
                          const active = selectedTimeSlot === slot;
                          // free if ANY room of the chosen type is free at this time
                          const roomTaken = !homeService && groupRooms.length > 0 && roomsFreeAt(slot).length === 0;
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={roomTaken && !active}
                              onClick={() => setSelectedTimeSlot(slot)}
                              className={cn(
                                'rounded-xl border py-2 px-1 text-center text-xs font-bold transition cursor-pointer',
                                active
                                  ? 'border-primary bg-primary text-white shadow-md'
                                  : roomTaken
                                    ? 'border-border/30 bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through'
                                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                              )}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedTimeSlot && (
                      <p className="text-xs font-semibold text-primary mt-2">
                        Selected: {selectedTimeSlot} → {addMinutesToTime(selectedTimeSlot, totalDuration)} ({totalDuration}m)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sub-Popup Footer Bar Matching Image 2 Exactly */}
        <div className="shrink-0 border-t border-border/40 bg-card px-6 py-3.5 space-y-3">
          <div className="flex items-center justify-between">
            {/* Left: Service info */}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Scissors className="h-3 w-3 text-muted-foreground" />
                Service
              </p>
              <p className="text-sm font-black text-foreground">
                {fmt(servicePrice)} KWD
              </p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase truncate max-w-[180px]">
                {primaryService?.name ?? 'No service selected'}
              </p>
            </div>

            {/* Middle: Duration */}
            <div className="text-center px-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
                <Timer className="h-3 w-3 text-muted-foreground" />
                Duration
              </p>
              <p className="text-base font-black text-foreground">
                {totalDuration} min
              </p>
            </div>

            {/* Right: Total in Red/Brand color */}
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="text-xl font-black text-primary leading-tight">
                {fmt(totalPrice)}
              </p>
              <p className="text-[10px] font-black text-primary">KWD</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            {subStep === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedServices.length === 0 || packageGate || (!arrangementId && !groupRoomless && !homeService)}
                  onClick={() => setSubStep(2)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold text-white transition shadow-md cursor-pointer',
                    selectedServices.length === 0 || packageGate || (!arrangementId && !groupRoomless && !homeService)
                      ? 'bg-muted-foreground/30 cursor-not-allowed text-muted-foreground'
                      : 'bg-primary hover:bg-primary/90 shadow-primary/20',
                  )}
                >
                  Next: Select Therapist & Time
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSubStep(1)}
                  className="rounded-xl border border-border px-5 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  ← Back to Services
                </button>
                <button
                  type="button"
                  disabled={
                    !primaryService ||
                    (isFirstSession ? false : !selectedTherapistId) ||
                    !selectedTimeSlot ||
                    (isDoubleOccupancy(arrangementType) && !secondaryTherapistId)
                  }
                  onClick={handleFinishAdd}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold text-white transition shadow-md cursor-pointer',
                    !primaryService ||
                    (isFirstSession ? false : !selectedTherapistId) ||
                    !selectedTimeSlot ||
                    (isDoubleOccupancy(arrangementType) && !secondaryTherapistId)
                      ? 'bg-muted-foreground/30 cursor-not-allowed text-muted-foreground'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Add Session
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main NewAppointmentBookingModal Component ────────────────────────────────

export function NewAppointmentBookingModal({
  token, date, branchId, branchName,
  defaultTherapistId, defaultTherapistName, defaultTherapistPhoto,
  defaultTimeSlot, schedule, scheduleData, homeService, onClose, onSuccess,
}: NewAppointmentBookingModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const { canApplyDiscount: allowDiscount } = usePermissions();

  // ── Step State: 1 = Sessions, 2 = Customer & Notes, 3 = Confirm & Payment ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Sessions List ──
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);

  // ── Customer State ──
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ApiCustomer | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  // ── Notes & Payment Option ──
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'pay_on_branch' | 'pay_now'>('pay_on_branch');

  // ── Submission State ──
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<{ bookingNumber?: string; id?: string } | null>(null);
  const [showMakePayment, setShowMakePayment] = useState(false);
  const [createdBookingInfo, setCreatedBookingInfo] = useState<{
    id: string;
    bookingNumber?: string;
    amount: string;
    customerName?: string;
    customerPhone?: string;
  } | null>(null);

  // ── Date Formatting for Image 1 Header ──
  const dateObj = useMemo(() => new Date(date + 'T00:00:00'), [date]);
  const dayName = useMemo(() => dateObj.toLocaleDateString('en-US', { weekday: 'short' }), [dateObj]);
  const dayNum = useMemo(() => dateObj.getDate(), [dateObj]);
  const monthFull = useMemo(() => dateObj.toLocaleDateString('en-US', { month: 'long' }), [dateObj]);
  const yearFull = useMemo(() => dateObj.getFullYear(), [dateObj]);

  // ── Customer Search Fetch ──
  useEffect(() => {
    setCustomersLoading(true);
    const t = setTimeout(() => {
      const qs = customerQuery ? `search=${encodeURIComponent(customerQuery)}` : '';
      authedFetch(`/api/v1/customers${qs ? '?' + qs : ''}`, {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      })
        .then(r => r.json())
        .then(d => {
          const rawList = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
          setCustomers(rawList.map((item: unknown, idx: number) => {
            const r = item as Record<string, unknown>;
            return {
              ...(item as ApiCustomer),
              id: String(r.id ?? r.customer_id ?? r.pk ?? `cust-${idx}`),
            };
          }));
        })
        .catch(() => setCustomers([]))
        .finally(() => setCustomersLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, authHeader]);

  // ── Totals Calculation ──
  const bookingTotalDuration = useMemo(
    () => sessions.reduce((s, sess) => s + sess.totalDuration, 0),
    [sessions],
  );
  const bookingSubtotalPrice = useMemo(
    () => sessions.reduce((s, sess) => s + sess.sessionPrice, 0),
    [sessions],
  );
  const discountAmount = allowDiscount ? Math.max(0, parseFloat(discount) || 0) : 0;
  const bookingTotalPrice = Math.max(0, bookingSubtotalPrice - discountAmount);

  // ── Overlap Detection ──
  const overlapWarning = useMemo(() => {
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const s1 = sessions[i];
        const s2 = sessions[j];
        if (s1.therapistId === s2.therapistId) {
          const t1Start = parseClockToMinutes(toHHMM(s1.startTime));
          const t1End = t1Start + s1.totalDuration;
          const t2Start = parseClockToMinutes(toHHMM(s2.startTime));
          const t2End = t2Start + s2.totalDuration;
          if (t1Start < t2End && t2Start < t1End) {
            return `Session ${i + 1} and Session ${j + 1} overlap in time for therapist ${s1.therapistName}.`;
          }
        }
      }
    }
    return null;
  }, [sessions]);

  // ── Customer Handlers ──
  const selectCustomer = (c: ApiCustomer) => {
    const id = String(c.id);
    const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || c.email || '';
    const label = [name, c.phone_number].filter(Boolean).join(' · ');
    setCustomerId(id);
    setCustomerSearch(label || name);
    setSelectedCustomer(c);
    setSubmitError(null);
  };

  const clearCustomer = () => {
    setCustomerId('');
    setCustomerSearch('');
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  const handleCustomerCreated = (created: CreatedCustomer) => {
    const id = String(created.id);
    const asApiCustomer: ApiCustomer = {
      id,
      first_name: created.first_name ?? '',
      last_name: created.last_name ?? '',
      full_name: created.full_name || [created.first_name, created.last_name].filter(Boolean).join(' '),
      phone_number: created.phone_number,
      email: created.email,
      avatar: created.avatar,
    };
    setCustomers(prev => [asApiCustomer, ...prev]);
    selectCustomer(asApiCustomer);
    setShowCreateCustomer(false);
  };

  // ── Calculation for Next Session's Starting Constraints ──
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const nextSessionMinStartMinutes = lastSession
    ? parseClockToMinutes(toHHMM(lastSession.startTime)) + lastSession.totalDuration
    : undefined;
  const nextSessionDefaultTimeSlot = lastSession
    ? addMinutesToTime(lastSession.startTime, lastSession.totalDuration)
    : defaultTimeSlot;

  // Package coverage: every included service of a package booked by its parts must be in a session
  const packageCoverage = useMemo(() => {
    const byPkg: Record<string, { id: string; name: string; price: string | number; all: { id: string; name: string }[]; booked: Set<string> }> = {};
    sessions.forEach(sess => sess.services.forEach(sv => {
      if (!sv.package_id) return;
      const e = (byPkg[sv.package_id] ??= {
        id: sv.package_id,
        name: sv.package_name ?? 'Package',
        price: sv.package_price ?? 0,
        all: sv.package_components ?? (sv.package_component_ids ?? []).map(id => ({ id, name: id })),
        booked: new Set<string>(),
      });
      e.booked.add(String(sv.id));
    }));
    return Object.values(byPkg).map(e => ({
      ...e,
      missing: e.all.filter(c => !e.booked.has(c.id)),
    }));
  }, [sessions]);
  const pendingPackageInfo = packageCoverage.find(c => c.missing.length > 0) ?? null;
  const hasPackageSession = packageCoverage.length > 0;
  const sessionLimit = hasPackageSession ? PACKAGE_MAX_SESSIONS : MAX_SESSIONS;
  const svcIsPackage = (sv: ApiService) =>
    sv.is_packaged_services === true || String(sv.is_packaged_services).toLowerCase() === 'true';
  // A package booked as one service (no included services configured) must stand alone
  const hasWholePackage = sessions.some(sess => sess.services.some(sv => svcIsPackage(sv) && !sv.package_id));
  const hasPlainService = sessions.some(sess => sess.services.some(sv => !svcIsPackage(sv) && !sv.package_id));
  // No "Add session" once every service of the package is scheduled (or a whole package fills the booking)
  const canAddSession =
    sessions.length < sessionLimit &&
    !hasWholePackage &&
    (!hasPackageSession || Boolean(pendingPackageInfo));

  // Package components already booked in the sessions added so far
  const usedPackageComponents = useMemo(() => {
    const m: Record<string, string[]> = {};
    sessions.forEach(sess => sess.services.forEach(sv => {
      if (sv.package_id) (m[sv.package_id] ??= []).push(String(sv.id));
    }));
    return m;
  }, [sessions]);

  // ── Booking Submission ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessions.length === 0) {
      setSubmitError('Please add at least one session.');
      return;
    }
    // Every package booked by its parts must include all of its services exactly once
    for (const sess of sessions) {
      for (const sv of sess.services) {
        if (!sv.package_id) continue;
        const expected = [...(sv.package_component_ids ?? [])].sort();
        const booked = [...(usedPackageComponents[sv.package_id] ?? [])].sort();
        if (expected.length > 0 && JSON.stringify(expected) !== JSON.stringify(booked)) {
          setSubmitError('Each package must be booked with all of its included services. Add the remaining services in another session.');
          return;
        }
      }
    }
    if (!customerId) {
      setSubmitError('Please select a customer.');
      return;
    }
    if (overlapWarning) {
      setSubmitError(overlapWarning);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const firstSess = sessions[0];
    const firstSvc = firstSess.services[0];
    const firstApptWindow = buildAppointmentWindow(date, toHHMM(firstSess.startTime), firstSess.totalDuration);
    const lastSess = sessions[sessions.length - 1];
    const lastApptWindow = buildAppointmentWindow(date, toHHMM(lastSess.startTime), lastSess.totalDuration);

    const sessionsPayload = sessions.map(sess => {
      const apptWindow = buildAppointmentWindow(date, toHHMM(sess.startTime), sess.totalDuration);
      const svcDataList = sess.services.map((sv, i) => {
        const p = homeService
          ? homePriceOf(sv)
          : i === 0
          ? (sess.arrangementPrice != null ? sess.arrangementPrice : parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0)
          : (parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0);
        return {
          service_id: sv.id,
          service_name: sv.name,
          service_category: sv.category ?? '',
          base_price: homeService ? fmt(p) : fmt(sv.base_price),
          arrangement_price: fmt(p),
          duration_minutes: sv.duration_minutes ?? 60,
          ...(sv.package_id ? { package_id: sv.package_id } : {}),
        };
      });

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
        service_arrangement_id: homeService ? null : sess.arrangementId,
        service_arrangement_data: homeService ? null : {
          arrangement_id: sess.arrangementId,
          arrangement_name: sess.arrangementName,
          arrangement_type: sess.arrangementType,
        },
        service_id: sess.services[0]?.id ?? '',
        service_name: sess.services.map(s => s.name).filter(Boolean).join(' + ') || sess.services[0]?.name || '',
        service_data: svcDataList[0] ?? null,
        services: svcDataList,
        service_ids: sess.serviceIds,
        addons: sess.selectedAddons.map(a => ({
          id: a.id,
          name: a.name,
          price: fmt(a.price),
          duration_minutes: a.duration_minutes ?? 0,
        })),
        addons_duration: sess.selectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
        extra_minutes: sess.extraMinutes,
        extra_price: fmt(sess.extraPrice),
        services_price: fmt(sess.servicePrice ?? Math.max(0, sess.sessionPrice - sess.selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? 0)) || 0), 0) - sess.extraPrice)),
        session_price: fmt(sess.sessionPrice),
        total_session_duration: sess.totalDuration,
      };
    });

    const cust = selectedCustomer ?? customers.find(c => String(c.id) === String(customerId));
    const customerName = cust
      ? ((cust.full_name ?? [cust.first_name, cust.last_name].filter(Boolean).join(' ')) || 'Customer')
      : '';

    const body = {
      // Legacy flat fields mirrored from session 0
      service_id: firstSvc?.id ?? '',
      service_name: firstSvc?.name ?? '',
      service_category: firstSvc?.category ?? '',
      base_price: fmt(firstSvc?.base_price),
      baseDuration: firstSvc?.duration_minutes ?? 60,
      service_data: {
        service_id: firstSvc?.id ?? '',
        service_name: firstSvc?.name ?? '',
        service_category: firstSvc?.category ?? '',
        base_price: fmt(firstSvc?.base_price),
        arrangement_price: fmt(firstSess.arrangementPrice ?? firstSvc?.base_price),
        duration_minutes: firstSvc?.duration_minutes ?? 60,
      },
      branch_id: homeService ? null : branchId,
      branch_data: homeService
        ? { branch_name: 'Home Service', branch_address: 'Home Service' }
        : { branch_id: branchId, branch_name: branchName, branch_address: branchName },
      service_arrangement_id: homeService ? null : firstSess.arrangementId,
      service_arrangement_data: homeService ? null : {
        arrangement_id: firstSess.arrangementId,
        arrangement_name: firstSess.arrangementName,
        arrangement_type: firstSess.arrangementType,
      },
      therapist_id: firstSess.therapistId || null,
      therapist_data: firstSess.therapistName ? {
        therapist_id: firstSess.therapistId || null,
        therapist_name: firstSess.therapistName,
        ...(firstSess.therapistPhoto ? { photo_url: firstSess.therapistPhoto } : {}),
      } : null,
      ...(firstSess.secondaryTherapistId ? {
        secondary_therapist_id: firstSess.secondaryTherapistId,
        secondary_therapist_data: {
          therapist_id: firstSess.secondaryTherapistId,
          therapist_name: firstSess.secondaryTherapistName,
        },
      } : {}),
      selected_addons: firstSess.selectedAddons.map(a => ({
        id: a.id,
        name: a.name,
        price: fmt(a.price),
        duration_minutes: a.duration_minutes ?? 0,
      })),
      addons_duration: firstSess.selectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
      extra_minutes: firstSess.extraMinutes,
      extra_price: fmt(firstSess.extraPrice),
      date,
      time_slot: firstSess.startTime,
      timezone: firstApptWindow.timezone,
      appointment_date: firstApptWindow.appointment_date,
      appointment_start: firstApptWindow.appointment_start,
      appointment_end: lastApptWindow.appointment_end,
      customer_id: customerId || '',
      customer_data: customerName ? {
        customer_id: customerId,
        customer_name: customerName,
        phone_number: cust?.phone_number ?? null,
        email: cust?.email ?? null,
      } : null,
      customer_notes: notes,
      customerMessage: '',
      booking_type: homeService ? 'home_service' : 'branch_service',
      pricing_details: {
        base: fmt(firstSess.servicePrice ?? Math.max(0, firstSess.sessionPrice - firstSess.selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? 0)) || 0), 0) - firstSess.extraPrice)),
        base_price: fmt(firstSess.servicePrice ?? Math.max(0, firstSess.sessionPrice - firstSess.selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? 0)) || 0), 0) - firstSess.extraPrice)),
        subtotal: fmt(bookingSubtotalPrice),
        discount: fmt(discountAmount),
        discount_amount: fmt(discountAmount),
        total: fmt(bookingTotalPrice),
        total_price: fmt(bookingTotalPrice),
        currency: CURRENCY,
      },
      discount: fmt(discountAmount),
      total_price: fmt(bookingTotalPrice),
      total_duration: bookingTotalDuration,
      currency: CURRENCY,
      status: 'confirmed',
      payment_status: 'pending',
      payment_through: 'ushdesk',
      payment_provider: null,
      payment_gateway: null,
      payment_method: paymentOption === 'pay_on_branch' ? 'on_branch' : 'pay_now',
      source: 'ushdesk',
      sessions: sessionsPayload,
    };

    try {
      const res = await authedFetch('/booknpay/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errObj = json as Record<string, unknown>;
        let msg = errObj.detail ?? errObj.message ?? errObj.error ?? errObj.non_field_errors;
        if (!msg) {
          if (res.status === 401) msg = 'Authentication failed. Please log in again.';
          else msg = `Booking failed (${res.status}): ${JSON.stringify(errObj)}`;
        }
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const result = (json as Record<string, unknown>).data ?? json;
      const raw = result as Record<string, unknown>;
      const bNumber = String(raw.booking_number ?? raw.reference ?? '');
      const bId = String(raw.id ?? raw.booking_id ?? raw.pk ?? '');

      if (paymentOption === 'pay_now') {
        setCreatedBookingInfo({
          id: bId,
          bookingNumber: bNumber,
          amount: fmt(bookingTotalPrice),
          customerName,
          customerPhone: cust?.phone_number,
        });
        setShowMakePayment(true);
      } else {
        setBookingSuccess({ bookingNumber: bNumber, id: bId });
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // If MakePaymentModal is active
  if (showMakePayment && createdBookingInfo) {
    return (
      <MakePaymentModal
        isOpen={showMakePayment}
        onClose={() => {
          setShowMakePayment(false);
          onClose();
        }}
        bookingId={createdBookingInfo.id}
        bookingNumber={createdBookingInfo.bookingNumber}
        amount={createdBookingInfo.amount}
        customerName={createdBookingInfo.customerName}
        customerPhone={createdBookingInfo.customerPhone}
        initialProviderId="knet_card"
        onSuccess={() => {
          setShowMakePayment(false);
          onSuccess?.();
          onClose();
        }}
      />
    );
  }

  // If Booking Success screen
  if (bookingSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-2xl text-center border border-border/80">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Booking Confirmed!</h2>
          <p className="mb-1 text-sm text-muted-foreground">
            {sessions.length} session{sessions.length > 1 ? 's' : ''} booked for {monthFull} {dayNum}, {yearFull}
          </p>
          {bookingSuccess.bookingNumber && (
            <div className="mb-4 flex items-center justify-center gap-1.5 text-sm font-black text-primary">
              <Hash className="h-4 w-4" />
              {bookingSuccess.bookingNumber}
            </div>
          )}
          <div className="mb-6 rounded-2xl bg-muted/40 p-3.5 text-left space-y-1.5 border border-border/40">
            {sessions.map((sess, i) => (
              <div key={sess.id} className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">
                  Session {i + 1}: {sess.services[0]?.name ?? 'Service'}
                </span>
                <span className="text-muted-foreground font-semibold">
                  {sess.startTime} · {sess.therapistName}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold transition hover:bg-muted cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => { onSuccess?.(); onClose(); }}
              className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-white transition hover:bg-primary/90 cursor-pointer shadow-md shadow-primary/20"
            >
              View Schedule
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal Window */}
        <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden">
          {/* Accent top gradient bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent shrink-0" />

          {/* Top Header Matching Image 1 */}
          <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 px-6 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                New Therapist Schedule Booking
              </p>
              <div className="flex items-center gap-1 ml-2">
                {([1, 2, 3] as const).map(n => (
                  <span
                    key={n}
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold transition',
                      step === n
                        ? 'bg-primary text-white shadow-xs'
                        : step > n
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {step > n ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </span>
                ))}
                <span className="text-[11px] text-muted-foreground font-medium ml-1">
                  {step === 1 ? 'Service & Add-ons' : step === 2 ? 'Customer & Notes' : 'Payment Option'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition text-muted-foreground cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sub-Header (3 Columns Matching Image 1) */}
          <div className="shrink-0 border-b border-border/40 bg-muted/20">
            <div className="flex items-stretch divide-x border-border/40">
              {/* Column 1: Therapist Info */}
              <div className="w-[32%] px-5 py-4 flex flex-col items-center justify-center shrink-0 gap-2">
                <div className="relative">
                  <div className="absolute -inset-1.5 rounded-full opacity-20 blur-xl bg-primary/30" />
                  <div className="relative h-[64px] w-[64px] rounded-full ring-2 ring-primary/40 shadow-xl overflow-hidden bg-muted">
                    {defaultTherapistPhoto ? (
                      <img src={defaultTherapistPhoto} alt={defaultTherapistName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-lg font-black">
                        {defaultTherapistName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card shadow-xs">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[120px]">
                    {defaultTherapistName}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block mr-0.5" />
                    Therapist
                  </span>
                </div>
              </div>

              {/* Column 2: Branch Info */}
              <div className="w-[28%] px-4 py-4 flex flex-col items-center justify-center gap-1.5 shrink-0">
                <div className="h-[44px] w-[44px] rounded-2xl grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[100px]">
                    {homeService ? 'Home Service' : (branchName || 'Branch')}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block mr-0.5" />
                    Direct Booking
                  </span>
                </div>
              </div>

              {/* Column 3: Dark Calendar Date & Time Slot */}
              <div className="flex-1 px-4 py-4 flex items-center justify-end min-w-0 gap-3.5">
                <div
                  className="flex flex-col items-center justify-center rounded-2xl shrink-0 shadow-lg w-[60px] h-[72px]"
                  style={{ background: 'linear-gradient(160deg, #3b2f2f 0%, #4a3728 100%)' }}
                >
                  <p className="text-[10px] font-semibold text-white/70 uppercase tracking-widest leading-none mb-1">
                    {dayName}
                  </p>
                  <p className="font-black text-white leading-none text-[30px]">
                    {dayNum}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Appointment Date
                    </p>
                    <p className="font-extrabold text-foreground leading-tight text-sm">
                      {monthFull} {dayNum}, {yearFull}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1 w-fit">
                    <div className="grid h-4 w-4 place-items-center rounded-lg bg-primary/15 text-primary shrink-0">
                      <Clock className="h-2.5 w-2.5" />
                    </div>
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest text-primary/70 leading-none">
                        Time Slot
                      </p>
                      <p className="text-[11px] font-extrabold text-primary leading-tight">
                        {defaultTimeSlot}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Body Container */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {step === 1 && (
              /* ── STEP 1: Sessions Section ── */
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  /* Red Box Area is Blank with an Add Session Button */
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-border/80 rounded-3xl bg-muted/10">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
                      <Plus className="h-7 w-7" />
                    </div>
                    <h3 className="text-base font-extrabold text-foreground mb-1">No Sessions Added Yet</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-5">
                      Configure your booking sessions. Session 1 is booked for {defaultTherapistName} at {defaultTimeSlot}. Subsequent sessions can select any service, room, therapist, and time slot.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAddSessionModal(true)}
                      className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Add Session
                    </button>
                  </div>
                ) : (
                  /* Sessions List with Summary Cards */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Booked Sessions ({sessions.length}/{sessionLimit})
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

                    {overlapWarning && (
                      <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>{overlapWarning}</span>
                      </div>
                    )}

                    {sessions.map((sess, idx) => (
                      <div
                        key={sess.id}
                        className="rounded-2xl border border-border/80 bg-muted/10 p-4 transition hover:border-primary/40 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-extrabold text-foreground truncate">
                                  {sess.services.map(s => s.name).join(' + ')}
                                </p>
                                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                  {sess.arrangementName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  {sess.therapistName}
                                  {sess.secondaryTherapistName && ` & ${sess.secondaryTherapistName}`}
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatSessionTimeRange(sess.startTime, sess.totalDuration)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-black text-primary">
                                {fmt(sess.sessionPrice)} KWD
                              </p>
                              {sess.selectedAddons.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  +{sess.selectedAddons.length} add-on{sess.selectedAddons.length > 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSessions(prev => prev.filter((_, i) => i !== idx))}
                              className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 transition cursor-pointer"
                              title="Remove Session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {pendingPackageInfo && (
                      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                        <p className="text-xs font-extrabold text-amber-800 dark:text-amber-200">
                          {pendingPackageInfo.name}: {pendingPackageInfo.missing.length} service{pendingPackageInfo.missing.length > 1 ? 's' : ''} still need a session
                        </p>
                        <ul className="mt-1.5 list-disc pl-5 text-[11px] text-amber-900/80 dark:text-amber-100/80">
                          {pendingPackageInfo.missing.map(m => <li key={m.id}>{m.name}</li>)}
                        </ul>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">Every package service must be scheduled before you can continue.</p>
                        {sessions.length < sessionLimit ? (
                          <button
                            type="button"
                            onClick={() => setShowAddSessionModal(true)}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600 transition cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Schedule remaining services
                          </button>
                        ) : (
                          <p className="mt-2 text-[11px] font-semibold text-destructive">
                            Session limit reached — remove a session and regroup the services.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              /* ── STEP 2: Customer & Notes ── */
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold text-foreground">Customer</p>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FLabel required>Search & Select Customer</FLabel>
                    <button
                      type="button"
                      onClick={() => setShowCreateCustomer(true)}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-1 text-[11px] font-bold text-primary transition cursor-pointer"
                    >
                      <UserPlus className="h-3 w-3" />
                      New
                    </button>
                  </div>
                  <SearchDrop<ApiCustomer>
                    value={customerSearch}
                    placeholder="Search by name or phone…"
                    loading={customersLoading}
                    items={customers}
                    isSelected={c => String(c.id) === customerId}
                    selectedItem={selectedCustomer}
                    icon={User}
                    onSearch={q => { setCustomerQuery(q); setCustomerSearch(q); setCustomerId(''); }}
                    onSelect={selectCustomer}
                    onClear={clearCustomer}
                    renderItem={c => {
                      const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || '—';
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold grid place-items-center">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.phone_number ?? c.email}</p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {selectedCustomer && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{customerSearch} selected</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <FLabel>Booking Notes</FLabel>
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any special instructions or client preferences…"
                    rows={3}
                    className="w-full rounded-2xl border border-border bg-muted/20 px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              /* ── STEP 3: Confirm & Payment ── */
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-foreground mb-1">Select Payment Option</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose how the customer will settle this booking.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl border-2 p-4 cursor-pointer transition select-none',
                      paymentOption === 'pay_on_branch'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm'
                        : 'border-border bg-muted/20 hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === 'pay_on_branch'}
                      onChange={() => setPaymentOption('pay_on_branch')}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-extrabold text-foreground">Pay on Branch</span>
                      </div>
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        paymentOption === 'pay_on_branch' ? 'border-amber-500' : 'border-muted-foreground/30',
                      )}>
                        {paymentOption === 'pay_on_branch' && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">In-person payment at the front desk</p>
                  </label>

                  <label
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl border-2 p-4 cursor-pointer transition select-none',
                      paymentOption === 'pay_now'
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-border bg-muted/20 hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={paymentOption === 'pay_now'}
                      onChange={() => setPaymentOption('pay_now')}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-xs font-extrabold text-foreground">Pay Now</span>
                      </div>
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                        paymentOption === 'pay_now' ? 'border-primary' : 'border-muted-foreground/30',
                      )}>
                        {paymentOption === 'pay_now' && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Immediate payment via payment link</p>
                  </label>
                </div>

                {/* Booking Summary Box */}
                <div className="rounded-2xl border border-border/80 bg-muted/10 p-4 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Booking Summary ({sessions.length} Session{sessions.length > 1 ? 's' : ''})
                  </p>
                  <div className="divide-y divide-border/40 text-xs">
                    {sessions.map((sess, i) => (
                      <div key={sess.id} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-foreground">
                            Session {i + 1}: {sess.services.map(s => s.name).join(' + ')}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {sess.therapistName} · {formatSessionTimeRange(sess.startTime, sess.totalDuration)}
                          </p>
                        </div>
                        <span className="font-bold text-foreground">{fmt(sess.sessionPrice)} KWD</span>
                      </div>
                    ))}
                  </div>

                  {allowDiscount && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <span className="font-bold text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        Discount (KWD)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="0.000"
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                        className="w-28 h-8 rounded-lg border border-border bg-background px-2.5 text-right font-bold text-xs outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">Total Payable</span>
                    <span className="text-base font-black text-primary">{fmt(bookingTotalPrice)} KWD</span>
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Modal Footer Matching Image 1 Exactly */}
          <div className="shrink-0 border-t border-border/40 bg-card px-6 py-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              {sessions.length === 0 ? (
                <p className="italic text-muted-foreground/80 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Select a service to see pricing
                </p>
              ) : (
                <p className="flex items-center gap-2 text-foreground">
                  <span className="text-primary font-bold">
                    ${fmt(bookingTotalPrice)} {CURRENCY}
                  </span>
                  <span>·</span>
                  <span>{bookingTotalDuration} min</span>
                  <span>·</span>
                  <span>{sessions.length} session{sessions.length > 1 ? 's' : ''}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={step === 1 ? onClose : () => setStep(p => (p - 1) as 1 | 2)}
                className="rounded-xl border border-border px-6 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>

              {step === 1 && (
                <button
                  type="button"
                  disabled={sessions.length === 0 || Boolean(pendingPackageInfo)}
                  onClick={() => setStep(2)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs font-extrabold text-white transition shadow-md cursor-pointer',
                    sessions.length === 0 || pendingPackageInfo
                      ? 'bg-muted-foreground/30 text-muted-foreground cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 shadow-primary/20',
                  )}
                >
                  Next: Customer
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  disabled={!customerId}
                  onClick={() => setStep(3)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs font-extrabold text-white transition shadow-md cursor-pointer',
                    !customerId
                      ? 'bg-muted-foreground/30 text-muted-foreground cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 shadow-primary/20',
                  )}
                >
                  Next: Payment Option
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={submitting || Boolean(pendingPackageInfo)}
                  onClick={handleSubmit}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-7 py-2.5 text-xs font-extrabold text-white transition shadow-md cursor-pointer',
                    submitting
                      ? 'bg-primary/60 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 shadow-primary/25',
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Booking
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Step Sub-Popup: Add Session Modal */}
      {showAddSessionModal && (
        <AddSessionSubModal
          authHeader={authHeader}
          branchId={branchId}
          date={date}
          defaultTherapistId={defaultTherapistId}
          defaultTherapistName={defaultTherapistName}
          defaultTherapistPhoto={defaultTherapistPhoto}
          defaultTimeSlot={nextSessionDefaultTimeSlot}
          sessionIndex={sessions.length}
          minStartTimeMinutes={nextSessionMinStartMinutes}
          minStartTimeDisplay={lastSession ? nextSessionDefaultTimeSlot : undefined}
          schedule={schedule}
          scheduleData={scheduleData}
          usedPackageComponents={usedPackageComponents}
          blockPackages={hasPlainService}
          homeService={homeService}
          pendingPackage={pendingPackageInfo ? { id: pendingPackageInfo.id, name: pendingPackageInfo.name, price: pendingPackageInfo.price } : null}
          onClose={() => setShowAddSessionModal(false)}
          onAddSession={sess => {
            setSessions(prev => [...prev, sess]);
            setShowAddSessionModal(false);
          }}
        />
      )}

      {/* Quick-add Customer Modal */}
      {showCreateCustomer && (
        <CreateCustomerModal
          authHeader={authHeader}
          onClose={() => setShowCreateCustomer(false)}
          onCreated={handleCustomerCreated}
        />
      )}
    </>
  );
}
