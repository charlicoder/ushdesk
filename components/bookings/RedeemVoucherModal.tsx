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
  MapPin, Check,
} from 'lucide-react';
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
  extraMinutes: number;
  extraMinutesPrice: number;
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

// ── Add Session Sub-Popup Window ─────────────────────────────────────────────

interface AddVoucherSessionModalProps {
  sessionIndex: number;
  branchId: string;
  selectedDate: string;
  voucher: AnyRecord;
  availabilitiesData: any;
  authHeader: string;
  existingSessions: VoucherSession[];
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
  onAdd,
  onClose,
}: AddVoucherSessionModalProps) {
  const [services, setServices] = useState<ApiService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const [arrangements, setArrangements] = useState<ApiArrangement[]>([]);
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const [arrangementAddons, setArrangementAddons] = useState<ApiAddOn[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedArrAddonIds, setSelectedArrAddonIds] = useState<string[]>([]);
  const [extraMinutes, setExtraMinutes] = useState<number>(0);

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);
  const [selectedSecondaryTherapistId, setSelectedSecondaryTherapistId] = useState<string>('');
  const [selectedSecondaryTherapist, setSelectedSecondaryTherapist] = useState<ApiTherapist | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const voucherServiceId = firstTruthy(voucher.service_id, voucher.service_data?.id);
  const voucherServiceName = firstTruthy(voucher.service_data?.name, voucher.service_data?.service_name, 'Spa Service');
  const requiredArrType = firstTruthy(voucher.service_arrangement_data?.arrangement_type, 'room');

  // 1. Load services for this branch
  useEffect(() => {
    setServicesLoading(true);
    authedFetch(`/api/v1/services/?branch_id=${branchId}&is_active=true`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        const list: ApiService[] = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        setServices(list);
        // Pre-select voucher service if matching
        if (voucherServiceId && list.some((s) => String(s.id) === String(voucherServiceId))) {
          setSelectedServiceIds([String(voucherServiceId)]);
        } else if (list.length > 0) {
          setSelectedServiceIds([String(list[0].id)]);
        }
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [branchId, authHeader, voucherServiceId]);

  // Selected services objects
  const selectedServices = useMemo(() => {
    return selectedServiceIds
      .map((id) => services.find((s) => String(s.id) === String(id)))
      .filter((s): s is ApiService => Boolean(s));
  }, [services, selectedServiceIds]);

  const primaryService = selectedServices[0] ?? null;

  // Toggle service selection
  const toggleService = (sv: ApiService) => {
    const id = String(sv.id);
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  // 2. Load arrangements for primary service
  useEffect(() => {
    if (!primaryService?.id || !branchId) {
      setArrangements([]);
      return;
    }
    setArrangementsLoading(true);
    authedFetch(`/api/v1/services/${primaryService.id}/arrangements/?branch_id=${branchId}`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        const list: ApiArrangement[] = (Array.isArray(d) ? d : (d.data ?? d.results ?? [])).filter((a: ApiArrangement) => a.is_active !== false);
        setArrangements(list);
        if (list.length > 0) {
          setSelectedRoomId(list[0].id);
        }
      })
      .catch(() => setArrangements([]))
      .finally(() => setArrangementsLoading(false));
  }, [primaryService?.id, branchId, authHeader]);

  // Selected arrangement object
  const selectedArrangement = useMemo(
    () => arrangements.find((a) => a.id === selectedRoomId) || arrangements[0] || null,
    [arrangements, selectedRoomId]
  );

  const isCoupleRoom = useMemo(() => {
    const arrType = String(selectedArrangement?.arrangement_type || selectedArrangement?.type || '').toLowerCase();
    return arrType === 'couple_room' || arrType === 'double_room' || arrType.includes('couple') || arrType.includes('double');
  }, [selectedArrangement]);

  // 3. Load arrangement add-ons
  useEffect(() => {
    if (!selectedRoomId) {
      setArrangementAddons([]);
      return;
    }
    authedFetch(`/api/v1/service-arrangements/${selectedRoomId}/addons/`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => setArrangementAddons(Array.isArray(d) ? d : (d.data ?? d.results ?? [])))
      .catch(() => setArrangementAddons([]));
    setSelectedArrAddonIds([]);
  }, [selectedRoomId, authHeader]);

  // Service add-ons union
  const serviceAddons = useMemo(() => {
    const seen = new Set<string>();
    const out: ApiAddOn[] = [];
    selectedServices.forEach((sv) => {
      (sv.add_ons ?? []).forEach((a) => {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          out.push(a);
        }
      });
    });
    return out;
  }, [selectedServices]);

  // Extra time calculation
  const extraMinutesUnit = primaryService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(primaryService?.price_for_extra_minutes ?? '0')) || 0;
  const hasExtraTime = Number(extraMinutesUnit) > 0 && extraPricePerUnit > 0;
  const calcExtraPrice = (mins: number) => {
    if (mins <= 0 || !hasExtraTime) return 0;
    return (mins / Number(extraMinutesUnit)) * extraPricePerUnit;
  };
  const extraMinutesPrice = calcExtraPrice(extraMinutes);

  // Price calculations
  const arrPrice = selectedArrangement?.arrangement_price != null ? parseFloat(String(selectedArrangement.arrangement_price)) || 0 : null;
  const priceOfService = (sv: ApiService, idx: number) => {
    if (idx === 0) {
      return arrPrice !== null ? arrPrice : parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0;
    }
    return parseFloat(String(sv.arrangement_price ?? sv.base_price ?? '0')) || 0;
  };
  const servicesPrice = selectedServices.reduce((sum, sv, i) => sum + priceOfService(sv, i), 0);

  const selAddons = serviceAddons.filter((a) => selectedAddonIds.includes(a.id));
  const selArrAddons = arrangementAddons.filter((a) => selectedArrAddonIds.includes(a.id));
  const allAddons = [...selAddons, ...selArrAddons];
  const addonsPrice = allAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonsDuration = allAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);

  const baseDuration = selectedServices.reduce((sum, sv) => sum + (sv.duration_minutes ?? 60), 0) || 60;
  const totalDuration = baseDuration + addonsDuration + extraMinutes;
  const sessionPrice = servicesPrice + addonsPrice + extraMinutesPrice;

  // 4. Therapists from availabilitiesData
  const therapists = useMemo<ApiTherapist[]>(() => {
    return Array.isArray(availabilitiesData?.therapists)
      ? availabilitiesData.therapists
      : Array.isArray(availabilitiesData?.data?.therapists)
      ? availabilitiesData.data.therapists
      : [];
  }, [availabilitiesData]);

  // Compute Available Timeslots
  useEffect(() => {
    if (!selectedDate || arrangements.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const selArrangement = arrangements.find((a) => a.id === selectedRoomId) || arrangements[0];
    if (!selArrangement) {
      setAvailableSlots([]);
      return;
    }

    const therapistSlotsForDay = new Set<number>();
    const therapistCountByMin = new Map<number, number>();
    for (const t of therapists) {
      const tSlots: string[] = t.availabilities?.[selectedDate] || [];
      const seenForTherapist = new Set<number>();
      for (const s of tSlots) {
        const m = parseTimeToMinutes(s);
        therapistSlotsForDay.add(m);
        if (!seenForTherapist.has(m)) {
          seenForTherapist.add(m);
          therapistCountByMin.set(m, (therapistCountByMin.get(m) ?? 0) + 1);
        }
      }
    }

    const rawArrSlots: string[] = selArrangement.availabilities?.[selectedDate] || [];
    const arrangementSlotsForDay = new Set<number>(rawArrSlots.map((s) => parseTimeToMinutes(s)));

    const branchInfo = availabilitiesData?.branch;
    const openTime = branchInfo?.opening_time || '09:00:00';
    const closeTime = branchInfo?.closing_time || '23:00:00';
    const step = 30;

    const startMin = parseTimeToMinutes(openTime);
    let endMin = parseTimeToMinutes(closeTime);
    if (endMin <= startMin) endMin = 23 * 60;

    const allKnownMinutes = new Set<number>();
    for (let m = startMin; m < endMin; m += step) {
      allKnownMinutes.add(m);
    }
    therapistSlotsForDay.forEach((m) => allKnownMinutes.add(m));
    arrangementSlotsForDay.forEach((m) => allKnownMinutes.add(m));

    const sortedMinutes = Array.from(allKnownMinutes).sort((a, b) => a - b);
    const minRequiredTherapists = isCoupleRoom && therapists.length >= 2 ? 2 : 1;

    const slots: { time: string; available: boolean }[] = [];
    for (const m of sortedMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;

      const isAvailableInTherapists = (therapistCountByMin.get(m) ?? 0) >= minRequiredTherapists;
      const isAvailableInArrangement = arrangementSlotsForDay.size === 0 || arrangementSlotsForDay.has(m);
      const available = isAvailableInTherapists && isAvailableInArrangement;

      slots.push({ time: timeLabel, available });
    }

    setAvailableSlots(slots);
  }, [selectedDate, selectedRoomId, arrangements, therapists, availabilitiesData, isCoupleRoom]);

  // Available therapists for chosen time slot
  const availableTherapistsForSlot = useMemo<ApiTherapist[]>(() => {
    if (!selectedTimeSlot || !selectedDate || therapists.length === 0) return therapists;
    const slotMin = parseTimeToMinutes(selectedTimeSlot);
    const filtered = therapists.filter((t) => {
      const daySlots: string[] = t.availabilities?.[selectedDate] || [];
      return daySlots.length === 0 || daySlots.some((s) => parseTimeToMinutes(s) === slotMin);
    });
    return filtered.length > 0 ? filtered : therapists;
  }, [selectedTimeSlot, selectedDate, therapists]);

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
    }
  }, [availableTherapistsForSlot, selectedTherapistId, isCoupleRoom]);

  // Check overlap with existing sessions
  const checkOverlap = (startTime: string, dur: number): boolean => {
    const sStart = parseTimeToMinutes(startTime);
    const sEnd = sStart + dur;
    for (const other of existingSessions) {
      const oStart = parseTimeToMinutes(other.startTime);
      const oEnd = oStart + other.totalDuration;
      if (sStart < oEnd && oStart < sEnd) {
        return true;
      }
    }
    return false;
  };

  // Submit session
  const handleSaveSession = () => {
    if (selectedServices.length === 0) {
      setErrorMsg('Please select at least one service.');
      return;
    }
    if (!selectedRoomId) {
      setErrorMsg('Please select a room / arrangement.');
      return;
    }
    if (!selectedTimeSlot) {
      setErrorMsg('Please select a start time slot.');
      return;
    }
    if (!selectedTherapistId) {
      setErrorMsg('Please select an available therapist.');
      return;
    }
    if (checkOverlap(selectedTimeSlot, totalDuration)) {
      setErrorMsg('This session overlaps with another scheduled session. Please choose a different time slot.');
      return;
    }

    const tName = getTherapistDisplayName(selectedTherapist);
    const secTName = isCoupleRoom && selectedSecondaryTherapist ? getTherapistDisplayName(selectedSecondaryTherapist) : undefined;

    const newSess: VoucherSession = {
      id: Math.random().toString(36).slice(2),
      therapistId: selectedTherapistId,
      therapistName: tName,
      therapistAvatar: selectedTherapist?.avatar || selectedTherapist?.photo_url,
      secondaryTherapistId: selectedSecondaryTherapistId || undefined,
      secondaryTherapistName: secTName,
      secondaryTherapistAvatar: selectedSecondaryTherapist?.avatar || selectedSecondaryTherapist?.photo_url,
      arrangementId: selectedRoomId,
      arrangementName: selectedArrangement?.name || 'Room',
      arrangementType: selectedArrangement?.arrangement_type || requiredArrType,
      serviceIds: selectedServiceIds,
      services: selectedServices,
      addonIds: selectedAddonIds,
      arrangementAddonIds: selectedArrAddonIds,
      allAddons,
      extraMinutes,
      extraMinutesPrice,
      startTime: selectedTimeSlot,
      totalDuration,
      sessionPrice,
    };

    onAdd(newSess);
    onClose();
  };

  const filteredServices = useMemo(() => {
    if (!serviceSearch) return services;
    return services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()));
  }, [services, serviceSearch]);

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

          {/* 1. Services Selection */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Scissors className="h-4 w-4 text-primary" />
              <p className="text-sm font-extrabold text-foreground">Select Service(s) *</p>
              {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <MultiSelectDrop<ApiService>
              items={filteredServices}
              selectedIds={selectedServiceIds}
              getId={(sv) => String(sv.id)}
              search={serviceSearch}
              placeholder={servicesLoading ? 'Loading services…' : 'Search & select one or more services…'}
              loading={servicesLoading}
              icon={Scissors}
              onSearch={setServiceSearch}
              onToggle={toggleService}
              renderItem={(sv, checked) => (
                <div className="flex items-start gap-3 py-2.5 px-3">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Scissors className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{sv.name}</p>
                      {String(sv.id) === String(voucherServiceId) && (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-extrabold uppercase">
                          Covered by Voucher
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {sv.category && <span className="mr-2">{sv.category}</span>}
                      {sv.duration_minutes && <span>{sv.duration_minutes} min</span>}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">{fmt(sv.arrangement_price ?? sv.base_price)} KWD</p>
                  {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />}
                </div>
              )}
            />
            {selectedServices.map((sv, idx) => (
              <div key={sv.id} className="mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary truncate">#{idx + 1} {sv.name}</p>
                  <p className="text-[10px] text-muted-foreground">{sv.duration_minutes} min</p>
                </div>
                <p className="shrink-0 text-xs font-extrabold text-primary">{fmt(priceOfService(sv, idx))} KWD</p>
                <button
                  type="button"
                  onClick={() => toggleService(sv)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* 2. Extra Time */}
          {hasExtraTime && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Extra Time</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 15, 30, 45, 60].map((mins) => {
                  const active = extraMinutes === mins;
                  const price = calcExtraPrice(mins);
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setExtraMinutes(mins)}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl border py-2 px-2 text-center transition cursor-pointer',
                        active
                          ? 'border-primary/50 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30'
                          : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                      )}
                    >
                      <p className="text-xs font-extrabold">{mins === 0 ? 'None' : `+${mins} min`}</p>
                      <p className="text-[10px] font-semibold mt-0.5 opacity-80">{mins === 0 ? '+0 KWD' : `+${fmt(price)} KWD`}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Room / Arrangement Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-extrabold text-foreground">Select Room / Arrangement *</p>
                {arrangementsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {arrangements.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto pb-1.5" style={{ scrollbarWidth: 'none' }}>
                {arrangements.map((arr) => {
                  const cfg = getArrCfg(arr.arrangement_type);
                  const Icon = cfg.Icon;
                  const isSel = selectedRoomId === arr.id;
                  const price = arr.arrangement_price ?? arr.base_price;
                  return (
                    <button
                      key={arr.id}
                      type="button"
                      onClick={() => setSelectedRoomId(arr.id)}
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
                        <p className="text-xs font-extrabold truncate">{arr.name}</p>
                        <p className="text-[10px] font-semibold text-amber-200 mt-0.5">{price ? `${fmt(price)} KWD` : 'Included'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No arrangement available for this branch</p>
            )}

            {/* Room Add-ons */}
            {arrangementAddons.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Room Add-ons</p>
                <div className="grid grid-cols-2 gap-2">
                  {arrangementAddons.map((addon) => {
                    const checked = selectedArrAddonIds.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-xs transition',
                          checked ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'border-border/60 bg-card hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedArrAddonIds((prev) => (prev.includes(addon.id) ? prev.filter((x) => x !== addon.id) : [...prev, addon.id]));
                          }}
                          className="mt-0.5 h-3.5 w-3.5 accent-amber-500 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{addon.name}</p>
                          <p className="text-[10px] text-muted-foreground">+{fmt(addon.price)} KWD · +{addon.duration_minutes ?? 0}m</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Timeslots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-extrabold text-foreground">Select Start Time *</p>
              </div>
              <span className="text-xs text-muted-foreground">{availableSlots.filter((s) => s.available).length} available</span>
            </div>
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1" style={{ scrollbarWidth: 'none' }}>
                {availableSlots.map((slot) => {
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

          {/* 5. Therapist Selection */}
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

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-border/60 px-6 py-4 bg-muted/10">
          <div>
            <p className="text-xs text-muted-foreground">Duration: <strong className="text-foreground">{totalDuration} min</strong></p>
            <p className="text-xs text-muted-foreground">Session Total: <strong className="text-primary font-bold">{fmt(sessionPrice)} KWD</strong></p>
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
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
  voucher,
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
  const { canApplyDiscount: allowDiscount } = usePermissions();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sessions, setSessions] = useState<VoucherSession[]>([]);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);

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

  const serviceId = firstTruthy(voucher.service_id, voucher.service_data?.id);
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

  // Fetch voucher availabilities for branch
  useEffect(() => {
    if (!selectedBranchId) return;
    setAvailabilitiesLoading(true);
    const payload = {
      service_id: serviceId,
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

  // Load customers for search
  useEffect(() => {
    setCustomersLoading(true);
    const qs = customerQuery ? `?search=${encodeURIComponent(customerQuery)}` : '';
    authedFetch(`/api/v1/customers/${qs}`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then((r) => r.json())
      .then((d) => {
        const list: ApiCustomer[] = Array.isArray(d) ? d : (d.results ?? d.data ?? []);
        setCustomers(list);
      })
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  }, [customerQuery, authHeader]);

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

  // Submit handler
  const handleConfirmRedeem = async () => {
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

    const firstSess = sessions[0];
    const firstApptWindow = buildAppointmentWindow(selectedDate, firstSess.startTime, firstSess.totalDuration);
    const lastSess = sessions[sessions.length - 1];
    const lastApptWindow = buildAppointmentWindow(selectedDate, lastSess.startTime, lastSess.totalDuration);

    const sessionsPayload = sessions.map((sess) => {
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
      payment_method: paymentOption === 'pay_on_branch' ? 'on_branch' : 'voucher',
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
        throw new Error(errJson.detail || errJson.message || `Booking failed (${res.status})`);
      }

      const bookingRes = await res.json();
      const newBooking = bookingRes?.data || bookingRes;
      const newBookingId = newBooking?.id || newBooking?.booking_id;

      // Update Voucher status to redeemed
      const voucherUpdatePayload = {
        status: 'redeemed',
        booking_id: newBookingId,
        redeemed_booking_id: newBookingId,
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

      await authedFetch(`/booknpay/api/v1/vouchers/${voucher.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(voucherUpdatePayload),
      }).catch(() => {});

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
              <p className="text-xs text-muted-foreground">Gift Voucher Redemption · Multi-Session Booking</p>
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
                {branches.map((b) => {
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
                  minDate={todayStr}
                  maxDate={expireDateDay || undefined}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Stepper Navigation ── */}
        {!bookingSuccess && (
          <div className="shrink-0 flex items-center justify-center border-b border-border/40 bg-card px-6 py-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition',
                  step === 1 ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
                <span>Sessions ({sessions.length})</span>
              </button>
              <span className="text-muted-foreground/30">/</span>
              <button
                type="button"
                disabled={sessions.length === 0}
                onClick={() => setStep(2)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition',
                  step === 2 ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted',
                  sessions.length === 0 && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
                <span>Customer & Notes</span>
              </button>
              <span className="text-muted-foreground/30">/</span>
              <button
                type="button"
                disabled={sessions.length === 0}
                onClick={() => setStep(3)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition',
                  step === 3 ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted',
                  sessions.length === 0 && 'opacity-40 cursor-not-allowed'
                )}
              >
                <span className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
                <span>Confirmation</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {bookingSuccess ? (
            /* ── Success Screen ── */
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Voucher Successfully Redeemed!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  The appointment has been confirmed with {sessions.length} session{sessions.length > 1 ? 's' : ''}.
                </p>
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
                <div className="pt-2 border-t border-border/40 space-y-1">
                  {sessions.map((s, i) => (
                    <div key={s.id} className="text-muted-foreground flex justify-between">
                      <span>Session {i + 1}: {s.startTime} ({s.totalDuration}m)</span>
                      <strong className="text-foreground">{s.therapistName}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 transition shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* ── STEP 1: SESSIONS ── */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Voucher Coverage Pill */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Covered Voucher Service</p>
                        <p className="text-[11px] text-muted-foreground">{serviceName} · {originalDuration} min</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      {fmt(voucherAmount)} {currency}
                    </span>
                  </div>

                  {/* Sessions Header */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h4 className="text-sm font-extrabold text-foreground">Booking Sessions</h4>
                      <p className="text-xs text-muted-foreground">Add up to 3 non-overlapping sessions for {selectedDate}</p>
                    </div>
                    {sessions.length < 3 && (
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
                            <span className="text-xs font-extrabold text-foreground">{fmt(sess.sessionPrice)} KWD</span>
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

              {/* ── STEP 2: CUSTOMER & NOTES ── */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Customer search & select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <p className="text-sm font-extrabold text-foreground">Customer *</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCreateCustomer(true)}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-1 text-[11px] font-bold text-primary transition cursor-pointer"
                      >
                        <UserPlus className="h-3 w-3" />
                        <span>New Customer</span>
                      </button>
                    </div>

                    <SearchDrop<ApiCustomer>
                      value={customerSearch}
                      placeholder="Search customer by name or phone…"
                      loading={customersLoading}
                      items={customers}
                      getKey={(c, idx) => String(c.id ?? idx)}
                      isSelected={(c) => String(c.id) === customerId}
                      selectedItem={selectedCustomer}
                      icon={User}
                      onSearch={(q) => {
                        setCustomerQuery(q);
                        setCustomerSearch(q);
                        setCustomerId('');
                      }}
                      onSelect={(c) => {
                        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || 'Customer';
                        setCustomerId(String(c.id));
                        setCustomerSearch(name);
                        setSelectedCustomer(c);
                      }}
                      onClear={() => {
                        setCustomerId('');
                        setCustomerSearch('');
                        setSelectedCustomer(null);
                        setCustomerQuery('');
                      }}
                      renderItem={(c) => {
                        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || 'Customer';
                        return (
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center shrink-0">
                              {getInitials(name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{name}</p>
                              {c.phone_number && <p className="text-xs text-muted-foreground">{c.phone_number}</p>}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes (Optional)</p>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special requests or notes…"
                      rows={3}
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ── STEP 3: CONFIRMATION & PAYMENT ── */}
              {step === 3 && (
                <div className="space-y-4">
                  {/* Select Payment Option */}
                  <div>
                    <h4 className="text-sm font-extrabold text-foreground mb-1">Select Payment Option</h4>
                    <p className="text-xs text-muted-foreground">Choose settlement method for this booking</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={cn(
                        'relative flex flex-col justify-between rounded-2xl border-2 p-3.5 cursor-pointer transition select-none',
                        paymentOption === 'pay_on_branch'
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <input
                        type="radio"
                        name="voucher-payment-option"
                        value="pay_on_branch"
                        checked={paymentOption === 'pay_on_branch'}
                        onChange={() => setPaymentOption('pay_on_branch')}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-foreground">Pay on Branch</p>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">In-branch counter</span>
                          </div>
                        </div>
                        <div className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', paymentOption === 'pay_on_branch' ? 'border-amber-500' : 'border-muted-foreground/30')}>
                          {paymentOption === 'pay_on_branch' && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Confirm booking and settle counter charges if needed</p>
                    </label>

                    <label
                      className={cn(
                        'relative flex flex-col justify-between rounded-2xl border-2 p-3.5 cursor-pointer transition select-none',
                        paymentOption === 'pay_now'
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <input
                        type="radio"
                        name="voucher-payment-option"
                        value="pay_now"
                        checked={paymentOption === 'pay_now'}
                        onChange={() => setPaymentOption('pay_now')}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="grid h-7 w-7 place-items-center rounded-xl bg-primary/10 text-primary">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-foreground">Pay Now</p>
                            <span className="text-[10px] text-primary font-semibold">Online Payment</span>
                          </div>
                        </div>
                        <div className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center', paymentOption === 'pay_now' ? 'border-primary' : 'border-muted-foreground/30')}>
                          {paymentOption === 'pay_now' && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Generate link for immediate online checkout</p>
                    </label>
                  </div>

                  {/* Summary Card */}
                  <div className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden divide-y divide-border/40">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Sessions Summary</span>
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground">{sessions.length} Session{sessions.length > 1 ? 's' : ''} · {totalBookingDuration} min</span>
                    </div>

                    {/* Sessions List */}
                    <div className="divide-y divide-border/30">
                      {sessions.map((sess, idx) => (
                        <div key={sess.id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              Session #{idx + 1}: {sess.startTime} ({sess.totalDuration} min)
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {sess.arrangementName} · {sess.therapistName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs font-bold text-foreground">{fmt(sess.sessionPrice)} KWD</span>
                            <button
                              type="button"
                              onClick={() => removeSession(idx)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition cursor-pointer"
                              title="Remove session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="px-4 py-3 bg-muted/20 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-foreground">{fmt(totalBookingPrice)} KWD</span>
                      </div>

                      {allowDiscount && (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <label className="font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3 text-emerald-500" />
                            <span>Discount Amount</span>
                          </label>
                          <div className="relative w-32">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="0.000"
                              value={discount}
                              onChange={(e) => setDiscount(e.target.value)}
                              className="w-full h-8 rounded-lg border border-border bg-background px-2.5 pr-8 text-right text-xs font-bold text-foreground outline-none transition focus:border-primary"
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">KWD</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Total Payable</span>
                        <div className="text-right">
                          <span className="text-base font-black text-primary">{fmt(netPayablePrice)}</span>
                          <span className="text-xs font-bold text-primary ml-1">KWD</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Total ({sessions.length} session{sessions.length > 1 ? 's' : ''})
                </span>
                <span className="text-sm font-extrabold text-foreground">{fmt(netPayablePrice)} KWD</span>
                <span className="text-xs text-muted-foreground ml-1.5">({totalBookingDuration} min)</span>
              </div>

              {step < 3 ? (
                <button
                  type="button"
                  disabled={step === 1 && sessions.length === 0}
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || sessions.length === 0}
                  onClick={handleConfirmRedeem}
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
          onAdd={(newSess) => setSessions((prev) => [...prev, newSess])}
          onClose={() => setShowAddSessionModal(false)}
        />
      )}

      {/* ── Customer Create Modal ── */}
      {showCreateCustomer && (
        <CreateCustomerModal
          authHeader={authHeader}
          onClose={() => setShowCreateCustomer(false)}
          onCreated={(newCust: CreatedCustomer) => {
            const apiCust: ApiCustomer = {
              id: String(newCust.id),
              first_name: newCust.first_name,
              last_name: newCust.last_name,
              full_name: newCust.full_name || [newCust.first_name, newCust.last_name].filter(Boolean).join(' '),
              phone_number: newCust.phone_number,
              email: newCust.email,
              avatar: newCust.avatar,
            };
            setCustomers((prev) => [apiCust, ...prev]);
            setSelectedCustomer(apiCust);
            setCustomerId(String(newCust.id));
            setCustomerSearch(apiCust.full_name || 'Customer');
            setShowCreateCustomer(false);
          }}
        />
      )}
    </div>
  );
}
