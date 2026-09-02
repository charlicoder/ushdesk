'use client';
// Branch Appointments – mirrors Therapist Schedule design
// Data: /api/v1/service-arrangements/schedule/?branch_id=all&date=YYYY-MM-DD
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Search, Plus, ChevronDown, Store, CalendarDays,
  CheckCircle2, Clock, AlertCircle, X, Layers,
  Timer, Hash, MapPin, ChevronLeft, ChevronRight, Loader2,
  LayoutGrid, Crown, Heart, Users, Sparkles,
  Scissors, Package, User, Phone, Mail, DollarSign, FileText,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiBranch {
  branch_id: string;
  branch_name: string;
}

interface ApiArrangement {
  id: string;
  name: string;
  arrangement_type: string;
  capacity: number;
  branch_id: string;
  branch_name: string;
  status: string;
}

interface ApiBooking {
  id: string;
  arrangement_id: string;
  start: string;
  end: string;
  duration_minutes: number;
  status: string;
  bookings_id: string;
}

interface ApiGrid {
  start: string;
  end: string;
  slot_duration_minutes: 30 | 60;
}

interface ApiScheduleRecord {
  date: string;
  timezone: string;
  branch: {
    id: string;
    name: string | null;
    branches?: ApiBranch[];
  };
  grid: ApiGrid;
  arrangements: ApiArrangement[];
  bookings: ApiBooking[];
}

interface ApiService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  arrangement_price?: string | number;   // branch-specific price
  home_service_price?: string | number;
  price_for_extra_minutes?: string | number;
  extra_minutes?: number;
  category?: string;
  gender?: string;
  is_for_male?: boolean;
  is_for_female?: boolean;
  add_ons?: ApiAddOn[];
}

interface ApiAddOn {
  id: string;
  name: string;
  price?: string | number;
  home_service_price?: string | number;
  duration_minutes?: number;
}

interface ApiTherapist {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar?: string;           // actual API field
  photo_url?: string;        // alias fallback
  specialties?: { id: string; name: string }[];
  specialization?: string;   // alias fallback
}

interface ApiCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  avatar?: string;
  gender?: string;
}

// ── Slot model ─────────────────────────────────────────────────────────────────

type SlotStatus = 'unavailable' | 'available' | 'booking' | 'scheduled' | 'in_progress';

interface Slot {
  status: SlotStatus;
  arrangementName?: string;
  capacity?: number;
  start?: string;
  end?: string;
  duration?: string;
  reference?: string;
  bookingsId?: string;
  branchName?: string;
}

// ── Arrangement model used in UI ───────────────────────────────────────────────

interface Arrangement {
  id: string;
  name: string;
  initials: string;
  arrangementType: string;
  capacity: number;
  branchName: string;
  branchId: string;
  color: string;
}

// ── Column tints ───────────────────────────────────────────────────────────────
const COL_TINTS = [
  'bg-rose-50/60    dark:bg-rose-950/20',
  'bg-violet-50/60  dark:bg-violet-950/20',
  'bg-sky-50/60     dark:bg-sky-950/20',
  'bg-emerald-50/60 dark:bg-emerald-950/20',
  'bg-amber-50/60   dark:bg-amber-950/20',
  'bg-pink-50/60    dark:bg-pink-950/20',
  'bg-teal-50/60    dark:bg-teal-950/20',
  'bg-indigo-50/60  dark:bg-indigo-950/20',
];

const ARRANGEMENT_COLORS = [
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-cyan-400 to-blue-500',
  'from-indigo-400 to-purple-500',
  'from-teal-400 to-emerald-500',
  'from-fuchsia-400 to-pink-500',
];

// ── Arrangement type icons & labels ───────────────────────────────────────────
const ARRANGEMENT_TYPE_CFG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  open_area:     { label: 'Open Area',     Icon: LayoutGrid, color: 'text-sky-500' },
  vip_suite:     { label: 'VIP Suite',     Icon: Crown,      color: 'text-amber-500' },
  couple_room:   { label: 'Couple Room',   Icon: Heart,      color: 'text-rose-500' },
  single_room:   { label: 'Single Room',   Icon: Sparkles,   color: 'text-violet-500' },
  private_suite: { label: 'Private Suite', Icon: Layers,     color: 'text-teal-500' },
  other:         { label: 'Other',         Icon: Store,      color: 'text-muted-foreground' },
};

function getArrangementType(type: string) {
  return ARRANGEMENT_TYPE_CFG[type] ?? ARRANGEMENT_TYPE_CFG['other'];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Shared status config ───────────────────────────────────────────────────────
const STATUS_CFG = {
  in_progress: {
    label:    'In Progress',
    badge:    'IN PROGRESS',
    dot:      'bg-emerald-500 animate-pulse',
    cardCls:  'border-2 border-emerald-400/80 dark:border-emerald-500/60 bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:from-emerald-950/50 dark:to-emerald-900/30 shadow-sm shadow-emerald-500/10 hover:shadow-md hover:border-emerald-500',
    badgeCls: 'text-emerald-700 dark:text-emerald-300 font-extrabold',
    pillCls:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    iconCls:  'text-emerald-600 dark:text-emerald-400',
    btnCls:   'bg-emerald-500 hover:bg-emerald-600',
    btnLabel: 'Mark Complete',
    Icon:     CheckCircle2,
  },
  booking: {
    label:    'Booking',
    badge:    'BOOKING',
    dot:      'bg-blue-500',
    cardCls:  'border-2 border-blue-400/80 dark:border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/70 dark:from-blue-950/50 dark:to-blue-900/30 shadow-sm shadow-blue-500/10 hover:shadow-md hover:border-blue-500',
    badgeCls: 'text-blue-700 dark:text-blue-300 font-extrabold',
    pillCls:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    iconCls:  'text-blue-600 dark:text-blue-400',
    btnCls:   'bg-blue-500 hover:bg-blue-600',
    btnLabel: 'Confirm Booking',
    Icon:     CalendarDays,
  },
  scheduled: {
    label:    'Scheduled',
    badge:    'SCHEDULED',
    dot:      'bg-violet-500',
    cardCls:  'border-2 border-violet-400/80 dark:border-violet-500/60 bg-gradient-to-br from-violet-50 to-violet-100/70 dark:from-violet-950/50 dark:to-violet-900/30 shadow-sm shadow-violet-500/10 hover:shadow-md hover:border-violet-500',
    badgeCls: 'text-violet-700 dark:text-violet-300 font-extrabold',
    pillCls:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    iconCls:  'text-violet-600 dark:text-violet-400',
    btnCls:   'bg-violet-500 hover:bg-violet-600',
    btnLabel: 'View Details',
    Icon:     Clock,
  },
} as const;

type ActiveStatus = keyof typeof STATUS_CFG;

// ── Slot Detail Modal (for booked slots) ───────────────────────────────────────
interface DetailModalPayload {
  slot:        Slot;
  arrangement: Arrangement;
  timeSlot:    string;
  branch:      string;
  date:        string;
}

function SlotDetailModal({ payload, onClose }: { payload: DetailModalPayload; onClose: () => void }) {
  const { slot, arrangement, timeSlot, branch, date } = payload;
  const cfg = STATUS_CFG[slot.status as ActiveStatus];
  const typeCfg = getArrangementType(arrangement.arrangementType);
  const TypeIcon = typeCfg.Icon;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const refNo = slot.bookingsId ?? slot.reference ?? `USH-${arrangement.id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className={cn('h-1.5 w-full', {
          'bg-emerald-400': slot.status === 'in_progress',
          'bg-blue-400':    slot.status === 'booking',
          'bg-violet-400':  slot.status === 'scheduled',
        })} />
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className={cn('absolute inset-0 rounded-full blur-md opacity-40 bg-gradient-to-br', arrangement.color)} />
              <div className={cn('relative h-12 w-12 rounded-full grid place-items-center ring-2 ring-background shadow-md bg-gradient-to-br text-white text-sm font-bold', arrangement.color)}>
                {arrangement.initials}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arrangement</p>
              <p className="text-base font-extrabold leading-tight">{arrangement.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TypeIcon className={cn('h-3.5 w-3.5', typeCfg.color)} />
                <span className="text-[11px] text-muted-foreground font-medium">{typeCfg.label}</span>
                <span className="text-[11px] text-muted-foreground">· cap {arrangement.capacity}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', cfg.pillCls)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
              {cfg.label}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Capacity</p>
              <p className="text-sm font-bold">{arrangement.capacity} {arrangement.capacity === 1 ? 'person' : 'people'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Time</p>
                <p className="text-sm font-bold">
                  {slot.start && slot.end ? `${slot.start} – ${slot.end}` : timeSlot}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
                <Timer className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Duration</p>
                <p className="text-sm font-bold">{slot.duration ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 min-w-0">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium">Branch</p>
                <p className="text-sm font-bold truncate">{arrangement.branchName || branch}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Date</p>
                <p className="text-sm font-bold">{date}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Booking Reference</p>
              <p className="text-sm font-bold font-mono tracking-wide">{refNo}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border/40 px-6 py-4">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          <button className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition', cfg.btnCls)}>
            {cfg.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers: module-level form components (prevent remount on render) ───────────
function BFormLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
}
function BFormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm outline-none transition',
        'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50',
        props.className,
      )}
    />
  );
}

// ── Generic searchable dropdown ────────────────────────────────────────────────
interface SearchDropdownProps<T> {
  value: string;
  placeholder: string;
  loading?: boolean;
  items: T[];
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  selectedItem?: T | null;
  icon?: React.ElementType;
  onSearch: (q: string) => void;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderItem: (item: T) => React.ReactNode;
}

function BSearchDropdown<T>({
  value, placeholder, loading, items, getKey, isSelected, selectedItem,
  icon: Icon, onSearch, onSelect, onClear, renderItem,
}: SearchDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isItemSelected = selectedItem != null;

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        {Icon && (
          <div className="pointer-events-none absolute left-3 z-10 grid h-5 w-5 place-items-center text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <input
          value={isItemSelected ? '' : value}
          onChange={(e) => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={isItemSelected ? '— selected —' : placeholder}
          readOnly={isItemSelected}
          className={cn(
            'h-10 w-full rounded-xl border border-border bg-muted/30 pr-8 text-sm outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50',
            Icon ? 'pl-9' : 'pl-3',
            isItemSelected && 'text-muted-foreground/50 cursor-default',
          )}
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {isItemSelected && (
          <button type="button" onClick={onClear}
            className="absolute right-2.5 grid h-5 w-5 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && !isItemSelected && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">
              {loading ? 'Loading…' : 'No results'}
            </p>
          ) : (
            items.map((item) => (
              <div
                key={getKey(item)}
                onClick={() => { onSelect(item); setOpen(false); }}
                className={cn(
                  'cursor-pointer transition hover:bg-muted/60',
                  isSelected(item) && 'bg-primary/5',
                )}
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

// ── New Booking Modal payload ──────────────────────────────────────────────────
interface NewBookingPayload {
  arrangement: Arrangement;
  timeSlot:    string;
  date:        string;
}

type BookingStep = 1 | 2 | 3;

interface BranchBookingForm {
  serviceId:      string;
  serviceSearch:  string;
  therapistId:    string;
  therapistSearch: string;
  customerId:     string;
  customerSearch: string;
  addonIds:       string[];
  extraMinutes:   number;
  notes:          string;
}

const INITIAL_FORM: BranchBookingForm = {
  serviceId: '', serviceSearch: '', therapistId: '', therapistSearch: '',
  customerId: '', customerSearch: '', addonIds: [], extraMinutes: 0, notes: '',
};

function fmtPriceB(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return '0.000';
  const n = parseFloat(String(v));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

// ── New Branch Booking Form Modal ──────────────────────────────────────────────
function NewBranchBookingModal({
  payload, onClose, onSuccess, token,
}: {
  payload: NewBookingPayload;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}) {
  const { arrangement, timeSlot, date } = payload;

  const [step, setStep]             = useState<BookingStep>(1);
  const [form, setForm]             = useState<BranchBookingForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 3 – booking result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult, setBookingResult]   = useState<Record<string, any> | null>(null);
  const [bookingId,     setBookingId]       = useState<string>('');
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [paymentLinkError,    setPaymentLinkError]    = useState<string | null>(null);
  const [paymentLinkSuccess,  setPaymentLinkSuccess]  = useState(false);
  // Snapshot names captured at submit time — independent of reactive arrays
  const [snapTherapistName, setSnapTherapistName] = useState<string>('');
  const [snapTherapistImg,  setSnapTherapistImg]  = useState<string>('');
  const [snapCustomerName,  setSnapCustomerName]  = useState<string>('');
  const [snapCustomerImg,   setSnapCustomerImg]   = useState<string>('');
  const [snapCustomerPhone, setSnapCustomerPhone] = useState<string>('');

  // Services
  const [services, setServices]           = useState<ApiService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Therapists (after service selected)
  const [therapists, setTherapists]           = useState<ApiTherapist[]>([]);
  const [therapistsLoading, setTherapistsLoading] = useState(false);

  // Global add-ons
  const [globalAddons, setGlobalAddons] = useState<ApiAddOn[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);

  // Customers
  const [customers, setCustomers]             = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerQuery, setCustomerQuery]     = useState('');

  const authHeader = `Bearer ${token}`;

  // Load services for this arrangement
  useEffect(() => {
    setServicesLoading(true);
    fetch(`/api/v1/service-arrangements/${arrangement.id}/services`, {
      headers: { Authorization: authHeader },
    })
      .then(r => r.json())
      .then(d => {
        // API shape: { success, data: [...], meta } OR plain array OR { results: [...] }
        const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        setServices(list);
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [arrangement.id, authHeader]);

  // Load add-ons from the arrangement (arrangement-specific addons)
  useEffect(() => {
    setAddonsLoading(true);
    fetch(`/api/v1/service-arrangements/${arrangement.id}/addons`, {
      headers: { Authorization: authHeader },
    })
      .then(r => r.json())
      .then(d => {
        // The arrangement detail returns addons at top level (no data wrapper)
        const list = Array.isArray(d) ? d : (d.addons ?? d.data ?? d.results ?? []);
        setGlobalAddons(list);
      })
      .catch(() => setGlobalAddons([]))
      .finally(() => setAddonsLoading(false));
  }, [arrangement.id, authHeader]);

  // Convert "02:30 PM" → "14:30" for the API's appointment_start param
  const toHHMM = (slot: string): string => {
    const [timePart, ampm] = slot.split(' ');
    const [hStr, mStr] = timePart.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Load therapists with availability check — fires when user enters step 2
  useEffect(() => {
    if (step !== 2 || !form.serviceId) { setTherapists([]); return; }
    setTherapistsLoading(true);
    const qs = new URLSearchParams({
      branch_id:              arrangement.branchId,
      no_service_list:        'true',
      check_for_availability: 'true',
      date:                   date,
      appointment_start:      toHHMM(timeSlot),
      duration:               String(totalDuration > 0 ? totalDuration : (selectedService?.duration_minutes ?? 60)),
    });
    fetch(`/api/v1/services/${form.serviceId}/therapists?${qs}`, {
      headers: { Authorization: authHeader },
    })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        setTherapists(list);
      })
      .catch(() => setTherapists([]))
      .finally(() => setTherapistsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.serviceId, authHeader]);

  // Customer search (debounced)
  useEffect(() => {
    setCustomersLoading(true);
    const t = setTimeout(() => {
      const qs = customerQuery ? `search=${encodeURIComponent(customerQuery)}` : '';
      fetch(`/api/v1/customers${qs ? '?' + qs : ''}`, { headers: { Authorization: authHeader } })
        .then(r => r.json())
        .then(d => {
          // API shape: { success, data: [...], meta }
          const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
          setCustomers(list);
        })
        .catch(() => setCustomers([]))
        .finally(() => setCustomersLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, authHeader]);

  // Derived helpers
  const selectedService  = useMemo(() => services.find(s => s.id === form.serviceId) ?? null, [services, form.serviceId]);
  const selectedTherapist = useMemo(() => therapists.find(t => t.id === form.therapistId) ?? null, [therapists, form.therapistId]);
  const selectedCustomer = useMemo(() => customers.find(c => c.id === form.customerId) ?? null, [customers, form.customerId]);

  const filteredServices  = useMemo(() =>
    form.serviceSearch ? services.filter(s => s.name.toLowerCase().includes(form.serviceSearch.toLowerCase())) : services,
    [services, form.serviceSearch]);

  const filteredTherapists = useMemo(() =>
    form.therapistSearch ? therapists.filter(t => {
      const name = (t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')).toLowerCase();
      return name.includes(form.therapistSearch.toLowerCase());
    }) : therapists,
    [therapists, form.therapistSearch]);

  // Merge service add-ons + global add-ons
  const serviceAddons: ApiAddOn[] = selectedService?.add_ons ?? [];
  const allAddons = useMemo(() => {
    const ids = new Set(serviceAddons.map(a => a.id));
    return [...serviceAddons, ...globalAddons.filter(a => !ids.has(a.id))];
  }, [serviceAddons, globalAddons]);

  // Pricing
  const servicePrice    = parseFloat(String(selectedService?.arrangement_price ?? selectedService?.base_price ?? '0')) || 0;
  const selectedAddons  = allAddons.filter(a => form.addonIds.includes(a.id));
  const addonTotal      = selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonDuration   = selectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
  const extraMinutesUnit = selectedService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(selectedService?.price_for_extra_minutes ?? '0')) || 0;
  const extraSteps = extraMinutesUnit > 0 ? Math.round(form.extraMinutes / extraMinutesUnit) : 0;
  const extraMinutesPrice = extraSteps * extraPricePerUnit;
  const totalPrice    = servicePrice + addonTotal + extraMinutesPrice;
  const baseDuration  = selectedService?.duration_minutes ?? 0;
  const totalDuration = baseDuration + addonDuration + form.extraMinutes;
  const hasExtraTime  = !!selectedService && extraMinutesUnit > 0;
  const extraOptions  = hasExtraTime
    ? [0, 1, 2, 3, 4].map(n => n * extraMinutesUnit)
    : [];

  const toggleAddon = (id: string) =>
    setForm(p => ({ ...p, addonIds: p.addonIds.includes(id) ? p.addonIds.filter(x => x !== id) : [...p.addonIds, id] }));

  const selectService = (s: ApiService) =>
    setForm(p => ({ ...p, serviceId: s.id, serviceSearch: s.name, therapistId: '', therapistSearch: '', addonIds: [], extraMinutes: 0 }));
  const clearService  = () => setForm(p => ({ ...p, serviceId: '', serviceSearch: '', therapistId: '', therapistSearch: '', addonIds: [], extraMinutes: 0 }));

  const selectTherapist = (t: ApiTherapist) => {
    const name = t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
    setForm(p => ({ ...p, therapistId: t.id, therapistSearch: name }));
  };
  const clearTherapist = () => setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));

  const selectCustomer = (c: ApiCustomer) => {
    const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || c.email || '';
    setForm(p => ({ ...p, customerId: c.id, customerSearch: name }));
    setSubmitError(null);
  };
  const clearCustomer = () => setForm(p => ({ ...p, customerId: '', customerSearch: '' }));

  const goNext = () => {
    if (!form.serviceId) { setSubmitError('Please select a service.'); return; }
    setSubmitError(null);
    setStep(2);
  };
  const goBack = () => {
    setSubmitError(null);
    // Clear therapist when going back so it re-fetches availability fresh on next step 2 visit
    setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setSubmitError('Please select a customer.'); return; }
    setSubmitting(true);
    setSubmitError(null);

    const svc          = selectedService!;
    const svcCategory  = svc.category ?? '';
    const baseP        = parseFloat(String(svc.arrangement_price ?? svc.base_price ?? '0')) || 0;
    const timeHHMM     = toHHMM(timeSlot);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const therapistName = selectedTherapist
      ? ((selectedTherapist.full_name ?? [selectedTherapist.first_name, selectedTherapist.last_name].filter(Boolean).join(' ')) || 'Therapist')
      : null;
    const customerName = selectedCustomer
      ? ((selectedCustomer.full_name ?? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || 'Customer')
      : null;

    const body = {
      service_id:       svc.id,
      service_name:     svc.name,
      service_category: svcCategory,
      base_price:       fmtPriceB(svc.base_price),
      baseDuration:     baseDuration,
      branch_id:        arrangement.branchId,
      branch_data: {
        branch_name:    arrangement.branchName,
        branch_address: arrangement.branchName,
      },
      service_arrangement_id:   arrangement.id,
      service_arrangement_data: {
        arrangement_name: arrangement.name,
        arrangement_type: arrangement.arrangementType,
      },
      therapist_id:   form.therapistId || null,
      therapist_data: therapistName ? { therapist_name: therapistName } : null,
      selected_addons: selectedAddons.map((a) => ({
        id:          a.id,
        name:        a.name,
        description: (a as unknown as Record<string, string>).description ?? '',
        price:       fmtPriceB(a.price),
        currency:    'KWD',
        is_active:   true,
      })),
      addons_duration: addonDuration,
      extra_minutes:   form.extraMinutes,
      extra_price:     fmtPriceB(extraMinutesPrice),
      date:            date,
      formattedDate:   formattedDate,
      time_slot:       timeHHMM,
      displayTime:     timeSlot,
      customer_id:     form.customerId,
      customer_data:   customerName ? {
        customer_name:  customerName,
        phone_number:   selectedCustomer?.phone_number ?? null,
        email:          selectedCustomer?.email ?? null,
      } : null,
      customerMessage: '',
      customer_notes:  form.notes,
      booking_type:    'branch',
      pricing_details: {
        base:              fmtPriceB(baseP),
        base_price:        fmtPriceB(baseP),
        arrangement:       fmtPriceB(baseP),
        arrangement_price: fmtPriceB(baseP),
        addons:            fmtPriceB(addonTotal),
        addons_price:      fmtPriceB(addonTotal),
        extratime:         fmtPriceB(extraMinutesPrice),
        extra_time:        fmtPriceB(extraMinutesPrice),
        extra_time_price:  fmtPriceB(extraMinutesPrice),
        subtotal:          fmtPriceB(totalPrice),
        total:             fmtPriceB(totalPrice),
        total_price:       fmtPriceB(totalPrice),
        currency:          'KWD',
      },
      total_price:    fmtPriceB(totalPrice),
      total_duration: totalDuration,
      currency:       'KWD',
    };

    try {
      const res = await fetch('/booknpay/api/v1/bookings/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
        body:    JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (json as Record<string, string>).detail ?? (json as Record<string, string>).message ?? `Error ${res.status}`;
        throw new Error(detail);
      }
      const result = (json as Record<string, unknown>).data ?? json;
      const raw    = result as Record<string, unknown>;

      // Extract booking ID — try every common field name the backend might use
      const rid = String(
        raw.id ?? raw.booking_id ?? raw.bookings_id ?? raw.pk ?? ''
      ).replace('undefined', '').replace('null', '');

      // Snapshot therapist & customer at submit time so step 3 doesn't depend on reactive arrays
      const tSnap = selectedTherapist;
      const cSnap = selectedCustomer;
      const tNameSnap = tSnap
        ? ((tSnap.full_name ?? [tSnap.first_name, tSnap.last_name].filter(Boolean).join(' ')) || 'Therapist')
        : (raw.therapist_data as Record<string, string> | null)?.therapist_name ?? '';
      const cNameSnap = cSnap
        ? ((cSnap.full_name ?? [cSnap.first_name, cSnap.last_name].filter(Boolean).join(' ')) || 'Customer')
        : '';

      setSnapTherapistName(tNameSnap);
      setSnapTherapistImg(tSnap?.avatar ?? tSnap?.photo_url ?? '');
      setSnapCustomerName(cNameSnap);
      setSnapCustomerImg(cSnap?.avatar ?? '');
      setSnapCustomerPhone(cSnap?.phone_number ?? '');
      setBookingResult(raw);
      setBookingId(rid);
      setStep(3);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    // Try bookingId state first, fall back to bookingResult fields
    const raw = bookingResult as Record<string, unknown> | null;
    const id = bookingId ||
      String(raw?.id ?? raw?.booking_id ?? raw?.bookings_id ?? raw?.pk ?? '')
        .replace('undefined', '').replace('null', '');
    if (!id) {
      setPaymentLinkError('Booking ID not found in response. Cannot send payment link.');
      return;
    }
    setCreatingPaymentLink(true);
    setPaymentLinkError(null);
    try {
      const res = await fetch(`/booknpay/api/v1/bookings/${id}/status/`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          status:         'confirmed',
          payment_status: 'pending',
          reason:         'Payment Link Sent to Customer',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (json as Record<string, string>).detail ?? (json as Record<string, string>).message ?? `Error ${res.status}`;
        throw new Error(detail);
      }
      setPaymentLinkSuccess(true);
    } catch (err) {
      setPaymentLinkError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Date display helpers
  const dateObj   = new Date(date + 'T00:00:00');
  const dayName   = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum    = dateObj.getDate();
  const monthFull = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearFull  = dateObj.getFullYear();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal shell */}
      <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent shrink-0" />

        {/* Top header */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">New Branch Booking</p>
            {step < 3 && (
              <div className="flex items-center gap-1 ml-2">
                {([1, 2] as const).map((n) => (
                  <span key={n} className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold transition',
                    step === n ? 'bg-primary text-white shadow-sm' : step > n ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    {step > n ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </span>
                ))}
                <span className="text-[11px] text-muted-foreground font-medium ml-1">
                  {step === 1 ? 'Service & Add-ons' : 'Customer & Notes'}
                </span>
              </div>
            )}
            {step === 3 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Booking Confirmed
              </span>
            )}
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header: Arrangement | Date + Time */}
        <div className="shrink-0 border-b border-border/40 bg-muted/20">
          <div className="flex items-stretch divide-x divide-border/40">

            {/* LEFT: Arrangement portrait */}
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-4 w-[30%] shrink-0">
              <div className="relative">
                <div className={cn('absolute -inset-1.5 rounded-full opacity-20 blur-xl bg-gradient-to-br', arrangement.color)} />
                <div className="relative h-[64px] w-[64px] rounded-full p-[3px] shadow-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.4) 100%)' }}>
                  <div className={cn('h-full w-full rounded-full grid place-items-center bg-gradient-to-br text-white text-lg font-black', arrangement.color)}>
                    {arrangement.initials}
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[100px]">{arrangement.name}</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{arrangement.branchName}</p>
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                  {getArrangementType(arrangement.arrangementType).label}
                </span>
              </div>
            </div>

            {/* MIDDLE: Selected Therapist (visible once one is picked) */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 w-[30%] shrink-0 border-x border-border/40">
              {selectedTherapist ? (() => {
                const tName = (selectedTherapist.full_name ?? [selectedTherapist.first_name, selectedTherapist.last_name].filter(Boolean).join(' ')) || 'Therapist';
                const tImg  = selectedTherapist.avatar ?? selectedTherapist.photo_url;
                const tSpec = selectedTherapist.specialties?.[0]?.name ?? selectedTherapist.specialization ?? '';
                return (
                  <>
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-full bg-primary/20 blur-md" />
                      <div className="relative h-[60px] w-[60px] rounded-full ring-2 ring-primary/40 shadow-lg overflow-hidden">
                        {tImg ? (
                          <img src={tImg} alt={tName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-lg font-black">
                            {tName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                        <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[110px]">{tName}</p>
                      {tSpec && <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">{tSpec}</p>}
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                        Therapist
                      </span>
                    </div>
                  </>
                );
              })() : (
                <div className="flex flex-col items-center gap-1 opacity-40">
                  <div className="h-[60px] w-[60px] rounded-full border-2 border-dashed border-border grid place-items-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">No therapist<br/>selected</p>
                </div>
              )}
            </div>

            {/* RIGHT: Date tile + Time slot */}
            <div className="flex items-center justify-end gap-3.5 px-4 py-4 flex-1 min-w-0">
              {/* Calendar tile */}
              <div className="flex flex-col items-center justify-center w-[60px] h-[72px] rounded-2xl shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(160deg, #3b2f2f 0%, #4a3728 100%)' }}>
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest leading-none mb-1">{dayName}</p>
                <p className="text-[30px] font-black text-white leading-none">{dayNum}</p>
              </div>
              {/* Date + time text */}
              <div className="flex flex-col gap-2 min-w-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Date</p>
                  <p className="text-sm font-extrabold text-foreground leading-tight">{monthFull} {dayNum}, {yearFull}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 w-fit">
                  <div className="grid h-5 w-5 place-items-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500/70 leading-none">Time Slot</p>
                    <p className="text-xs font-extrabold text-violet-700 dark:text-violet-300 leading-tight">{timeSlot}</p>
                  </div>
                  {totalDuration > 0 && (
                    <>
                      <span className="text-violet-300/60 text-xs">·</span>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <Timer className="h-3 w-3" />{totalDuration}m
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="branch-booking-form" onSubmit={handleSubmit}>

            {/* STEP 1: Service, Therapist, Extra Time, Add-ons */}
            {step === 1 && (
              <div className="px-6 py-5 space-y-5">

                {/* Service search */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Select Service</p>
                    {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <BFormLabel>Search & Select *</BFormLabel>
                  <BSearchDropdown<ApiService>
                    value={form.serviceSearch}
                    placeholder={servicesLoading ? 'Loading services…' : 'Search services…'}
                    loading={servicesLoading}
                    items={filteredServices}
                    getKey={(s) => s.id}
                    isSelected={(s) => s.id === form.serviceId}
                    selectedItem={selectedService}
                    icon={Scissors}
                    onSearch={(q) => setForm(p => ({ ...p, serviceSearch: q, serviceId: '' }))}
                    onSelect={selectService}
                    onClear={clearService}
                    renderItem={(s) => (
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Scissors className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.category && <span className="mr-2">{s.category}</span>}
                            {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                          </p>
                        </div>
                          {(s.arrangement_price ?? s.base_price) && (
                          <p className="shrink-0 text-sm font-bold text-primary mt-0.5">
                            {fmtPriceB(s.arrangement_price ?? s.base_price)} KWD
                          </p>
                        )}
                        {s.id === form.serviceId && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />}
                      </div>
                    )}
                  />
                  {selectedService && (
                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-primary truncate">{selectedService.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedService.duration_minutes && <span>{selectedService.duration_minutes} min</span>}
                          {selectedService.category && <span> · {selectedService.category}</span>}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-primary">
                        {fmtPriceB(selectedService.arrangement_price ?? selectedService.base_price)} KWD
                      </p>
                    </div>
                  )}
                </div>


                {/* Extra time */}
                {hasExtraTime && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Extra Time
                        {extraPricePerUnit > 0 && (
                          <span className="ml-1 font-normal normal-case text-muted-foreground/70">
                            ({fmtPriceB(extraPricePerUnit)} KWD / {extraMinutesUnit} min)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {extraOptions.map((mins) => (
                        <button key={mins} type="button"
                          onClick={() => setForm(p => ({ ...p, extraMinutes: mins }))}
                          className={cn(
                            'flex flex-col items-center rounded-xl border py-2.5 text-center transition',
                            form.extraMinutes === mins
                              ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40',
                          )}>
                          <p className="text-sm font-extrabold">{mins === 0 ? 'None' : `+${mins}`}</p>
                          {mins > 0 && <p className="text-[10px]">min</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons – always shown */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Add-on Services</p>
                    {addonsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  {allAddons.length === 0 && !addonsLoading && (
                    <p className="text-xs text-muted-foreground italic">No add-ons available</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {allAddons.map((addon) => {
                      const checked = form.addonIds.includes(addon.id);
                      const price   = fmtPriceB(addon.price);
                      const dur     = addon.duration_minutes;
                      return (
                        <label key={addon.id} className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                          checked ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40',
                        )}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAddon(addon.id)}
                            className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold leading-tight">{addon.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {price && <span className="text-[10px] font-bold text-primary">+{price} KWD</span>}
                              {dur && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Timer className="h-2.5 w-2.5" />+{dur}m</span>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {(addonDuration > 0 || addonTotal > 0) && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/30 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {addonDuration > 0 && <span className="font-bold">+{addonDuration} min</span>}
                        {addonDuration > 0 && addonTotal > 0 && ' · '}
                        {addonTotal > 0 && <span className="font-bold">+{fmtPriceB(addonTotal)} KWD</span>}
                        <span className="font-normal text-emerald-600/70"> added by selected add-ons</span>
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* STEP 2: Therapist + Customer + Notes */}
            {step === 2 && (
              <div className="px-6 py-5 space-y-5">

                {/* Therapist – searchable, filtered by availability for the chosen slot */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Therapist</p>
                    {therapistsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Optional</span>
                  </div>
                  <BFormLabel>Search &amp; Select Available Therapist</BFormLabel>
                  <BSearchDropdown<ApiTherapist>
                    value={form.therapistSearch}
                    placeholder={
                      therapistsLoading
                        ? 'Loading available therapists…'
                        : therapists.length === 0
                        ? 'No therapists available for this slot'
                        : 'Search therapists…'
                    }
                    loading={therapistsLoading}
                    items={filteredTherapists}
                    getKey={(t) => t.id}
                    isSelected={(t) => t.id === form.therapistId}
                    selectedItem={selectedTherapist}
                    icon={User}
                    onSearch={(q) => setForm(p => ({ ...p, therapistSearch: q, therapistId: '' }))}
                    onSelect={selectTherapist}
                    onClear={clearTherapist}
                    renderItem={(t) => {
                      const tName = (t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')) || 'Therapist';
                      const tImg  = t.avatar ?? t.photo_url;
                      const tSpec = t.specialties?.[0]?.name ?? t.specialization ?? '';
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                            {tImg ? (
                              <img src={tImg} alt={tName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold">
                                {tName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{tName}</p>
                            {tSpec && <p className="text-[11px] text-muted-foreground truncate">{tSpec}</p>}
                          </div>
                          {t.id === form.therapistId && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                        </div>
                      );
                    }}
                  />
                  {selectedTherapist && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-xs font-semibold text-primary">
                        {(selectedTherapist.full_name ?? [selectedTherapist.first_name, selectedTherapist.last_name].filter(Boolean).join(' ')) || 'Therapist'} assigned
                      </p>
                    </div>
                  )}
                </div>

                {/* Customer */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Customer</p>
                  </div>
                  <BFormLabel>Search & Select Customer *</BFormLabel>
                  <BSearchDropdown<ApiCustomer>
                    value={form.customerSearch}
                    placeholder="Search by name or phone…"
                    loading={customersLoading}
                    items={customers}
                    getKey={(c) => c.id}
                    isSelected={(c) => c.id === form.customerId}
                    selectedItem={selectedCustomer}
                    icon={User}
                    onSearch={(q) => { setCustomerQuery(q); setForm(p => ({ ...p, customerSearch: q, customerId: '' })); }}
                    onSelect={selectCustomer}
                    onClear={clearCustomer}
                    renderItem={(c) => {
                      const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || '—';
                      const img  = c.avatar;
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          {/* Avatar circle */}
                          <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                            {img ? (
                              <img src={img} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center bg-gradient-to-br from-violet-400 to-purple-600 text-white text-xs font-bold">
                                {name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {c.phone_number && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {c.phone_number}</span>}
                              {c.email && <span className="flex items-center gap-0.5 truncate"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
                            </div>
                          </div>
                          {c.id === form.customerId && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                        </div>
                      );
                    }}
                  />
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/30 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {([selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || 'Customer'} selected
                        {selectedCustomer.phone_number && <span className="font-normal text-emerald-600/70"> · {selectedCustomer.phone_number}</span>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <BFormLabel>Notes</BFormLabel>
                  </div>
                  <textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any special instructions or notes…" rows={3}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none" />
                </div>

              </div>
            )}

            {/* STEP 3: Booking result */}
            {step === 3 && bookingResult && (() => {
              const r      = bookingResult as Record<string, unknown>;
              // Booking reference — try every common field name
              const ref    = String(
                r.bookings_id ?? r.reference_number ?? r.booking_number ?? r.id ?? r.booking_id ?? r.pk ?? '—'
              ).replace('undefined', '—').replace('null', '—');
              const sName  = (r.service_name  ?? selectedService?.name ?? '—') as string;
              const bName  = (r.branch_name   ?? arrangement.branchName ?? '—') as string;
              const arrName= (r.arrangement_name ?? arrangement.name    ?? '—') as string;
              // Use snapshots captured at submit time — never depend on reactive arrays
              const tName  = snapTherapistName || 'Not assigned';
              const cName  = snapCustomerName  || '—';
              const tImg   = snapTherapistImg;
              const cImg   = snapCustomerImg;
              return (
                <div className="px-6 py-5 space-y-4">

                  {/* Success banner */}
                  <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border border-emerald-300/40 dark:border-emerald-700/30 px-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">Booking Created Successfully</p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 truncate">Ref: {ref}</p>
                    </div>
                  </div>

                  {/* Service + arrangement */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Scissors className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                        <p className="text-sm font-semibold truncate">{sName}</p>
                        {selectedService?.category && <p className="text-[11px] text-muted-foreground">{selectedService.category}</p>}
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-primary">{fmtPriceB(servicePrice)} KWD</p>
                    </div>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Arrangement · Branch</p>
                        <p className="text-sm font-semibold truncate">{arrName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{bName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Therapist + Customer */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Therapist */}
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center gap-3">
                      <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                        {tImg ? (
                          <img src={tImg} alt={tName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold">
                            {tName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Therapist</p>
                        <p className="text-xs font-semibold truncate">{tName}</p>
                      </div>
                    </div>
                    {/* Customer */}
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center gap-3">
                      <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                        {cImg ? (
                          <img src={cImg} alt={cName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-violet-400 to-purple-600 text-white text-xs font-bold">
                            {cName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                        <p className="text-xs font-semibold truncate">{cName}</p>
                        {snapCustomerPhone && <p className="text-[10px] text-muted-foreground">{snapCustomerPhone}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Date / time / duration */}
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                    <CalendarDays className="h-4 w-4 shrink-0 text-violet-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{date}</p>
                      <p className="text-[11px] text-muted-foreground">{timeSlot} · {totalDuration} min total</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                      <p className="text-base font-black text-primary leading-none">{fmtPriceB(totalPrice)} <span className="text-[10px] font-semibold">KWD</span></p>
                    </div>
                  </div>

                  {/* Payment link feedback */}
                  {paymentLinkSuccess && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Payment link created — status set to Confirmed / Pending payment.</p>
                    </div>
                  )}
                  {paymentLinkError && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{paymentLinkError}</p>
                    </div>
                  )}

                </div>
              );
            })()}
          </form>
        </div>

        {/* Fixed footer: pricing strip + error + buttons */}
        <div className="shrink-0 border-t border-border/40 bg-card">

          {/* Pricing strip */}
          <div className="border-b border-border/40 bg-muted/30 px-6 py-3">
            {!selectedService ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <DollarSign className="h-3.5 w-3.5" />
                Select a service to see pricing
              </div>
            ) : (
              <div className="flex items-center gap-0">
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Scissors className="h-2.5 w-2.5" />Service
                  </p>
                  <p className="text-xs font-semibold">{fmtPriceB(servicePrice)} KWD</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedService.name}</p>
                </div>
                {addonTotal > 0 && (
                  <>
                    <div className="w-px self-stretch bg-border/60 mx-3" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Package className="h-2.5 w-2.5" />Add-ons
                      </p>
                      <p className="text-xs font-semibold text-primary">+{fmtPriceB(addonTotal)} KWD</p>
                      <p className="text-[10px] text-muted-foreground">{form.addonIds.length} selected</p>
                    </div>
                  </>
                )}
                {extraMinutesPrice > 0 && (
                  <>
                    <div className="w-px self-stretch bg-border/60 mx-3" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Timer className="h-2.5 w-2.5" />Extra
                      </p>
                      <p className="text-xs font-semibold text-primary">+{fmtPriceB(extraMinutesPrice)} KWD</p>
                      <p className="text-[10px] text-muted-foreground">+{form.extraMinutes} min</p>
                    </div>
                  </>
                )}
                <div className="w-px self-stretch bg-border/60 mx-3" />
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                  <p className="text-lg font-black text-primary leading-none">{fmtPriceB(totalPrice)}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">KWD</p>
                </div>
              </div>
            )}
          </div>

          {/* Error + buttons */}
          <div className="px-6 py-3 space-y-3">
            {submitError && step !== 3 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{submitError}</span>
              </div>
            )}
            <div className="flex gap-2">
              {step === 1 && (
                <>
                  <button type="button" onClick={onClose}
                    className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">
                    Cancel
                  </button>
                  <button type="button" onClick={goNext}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition">
                    Next: Customer <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <button type="button" onClick={goBack}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button type="submit" form="branch-booking-form" disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {submitting ? 'Creating…' : 'Confirm Booking'}
                  </button>
                </>
              )}
              {step === 3 && (
                <>
                  <button type="button" onClick={onClose}
                    className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePaymentLink}
                    disabled={creatingPaymentLink || paymentLinkSuccess}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                    {creatingPaymentLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                    {creatingPaymentLink ? 'Sending…' : paymentLinkSuccess ? 'Payment Link Sent ✓' : 'Create Payment Link'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slot Cell ──────────────────────────────────────────────────────────────────
function SlotCell({ slot, onClick }: { slot: Slot; onClick?: () => void }) {
  if (slot.status === 'unavailable') {
    return (
      <div className="flex h-full min-h-[82px] items-center justify-center rounded-xl border border-border/80 dark:border-white/10 bg-muted/40 transition hover:bg-muted/60">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Unavailable</span>
      </div>
    );
  }

  if (slot.status === 'available') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
        className="flex h-full min-h-[82px] items-center justify-center rounded-xl border border-dashed border-border/90 dark:border-white/15 bg-card/70 transition hover:border-primary hover:bg-primary/5 hover:shadow-sm cursor-pointer group"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/70 group-hover:text-primary transition">
          <Plus className="h-3.5 w-3.5" /> Available
        </span>
      </div>
    );
  }

  const cfg  = STATUS_CFG[slot.status as ActiveStatus];
  const Icon = cfg.Icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={cn(
        'relative h-full min-h-[82px] rounded-xl p-3 transition-all duration-200 cursor-pointer select-none active:scale-[0.98]',
        cfg.cardCls,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className={cn('text-[10px] uppercase tracking-wider', cfg.badgeCls)}>{cfg.badge}</span>
        <div className="flex items-center gap-1">
          <Icon className={cn('h-3.5 w-3.5', cfg.iconCls)} />
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
        </div>
      </div>
      <p className="text-sm font-bold leading-tight text-foreground truncate">{slot.arrangementName ?? 'Booked'}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
          {slot.duration}
        </span>
        {slot.start && slot.end && (
          <span className="text-[10px] font-medium text-muted-foreground">{slot.start} – {slot.end}</span>
        )}
      </div>
    </div>
  );
}

// ── Mini Calendar Picker ───────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }: {
  value: string;
  onChange: (d: string) => void;
  onClose: () => void;
}) {
  const todayObj = new Date();
  const initial  = value ? new Date(value + 'T00:00:00') : todayObj;
  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const handleDay = (d: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    onClose();
  };

  const blanks = Array.from({ length: firstDay });
  const days   = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="absolute top-full left-0 mt-2 z-50 w-72 rounded-2xl border border-border bg-card shadow-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold">{monthName}</p>
        <button onClick={nextMonth} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <span key={d} className="text-[10px] font-bold text-muted-foreground py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {blanks.map((_, i) => <span key={`b${i}`} />)}
        {days.map(d => {
          const isSel = selectedDate &&
            selectedDate.getFullYear() === viewYear &&
            selectedDate.getMonth()    === viewMonth &&
            selectedDate.getDate()     === d;
          const isToday = todayObj.getFullYear() === viewYear &&
            todayObj.getMonth()    === viewMonth &&
            todayObj.getDate()     === d;
          return (
            <button
              key={d}
              onClick={() => handleDay(d)}
              className={cn(
                'h-8 w-8 mx-auto rounded-full text-xs font-semibold transition',
                isSel    ? 'bg-primary text-white' :
                isToday  ? 'border border-primary text-primary' :
                           'hover:bg-muted text-foreground',
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

// ── Time slot generation ────────────────────────────────────────────────────────
function generateTimeSlots(grid: ApiGrid): string[] {
  const slots: string[] = [];
  const [startH, startM] = grid.start.split(':').map(Number);
  const [endH,   endM]   = grid.end.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin   = endH   * 60 + endM;

  for (let m = startMin; m < endMin; m += grid.slot_duration_minutes) {
    const h    = Math.floor(m / 60);
    const min  = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hd   = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`);
  }
  return slots;
}

// ── Build schedule map from API data ──────────────────────────────────────────
function buildScheduleFromApi(
  arrangements: ApiArrangement[],
  bookings: ApiBooking[],
  timeSlots: string[],
  slotDurationMinutes: number,
): Record<string, Record<string, Slot>> {
  const sched: Record<string, Record<string, Slot>> = {};

  const slotToMinutes = (label: string): number => {
    const [timePart, period] = label.split(' ');
    const [hStr, mStr] = timePart.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  };

  type BkEntry = {
    startMin: number; endMin: number;
    startLabel: string; endLabel: string;
    duration: string; reference: string;
    bookingsId: string; status: string;
  };

  const bookingMap: Record<string, BkEntry[]> = {};
  for (const bk of bookings) {
    if (!bookingMap[bk.arrangement_id]) bookingMap[bk.arrangement_id] = [];
    const s = new Date(bk.start);
    const e = new Date(bk.end);
    const sm = s.getUTCHours() * 60 + s.getUTCMinutes();
    const em = e.getUTCHours() * 60 + e.getUTCMinutes();
    const fmt = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd   = h % 12 === 0 ? 12 : h % 12;
      return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    const durationMin = bk.duration_minutes ?? (em - sm);
    bookingMap[bk.arrangement_id].push({
      startMin:   sm,
      endMin:     em,
      startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()),
      endLabel:   fmt(e.getUTCHours(), e.getUTCMinutes()),
      duration:   `${durationMin}m`,
      reference:  bk.id,
      bookingsId: bk.bookings_id,
      status:     bk.status ?? 'confirmed',
    });
  }

  for (const arr of arrangements) {
    sched[arr.id] = {};
    const bkSlots = bookingMap[arr.id] ?? [];

    for (const slotLabel of timeSlots) {
      const slotStart = slotToMinutes(slotLabel);
      const slotEnd   = slotStart + slotDurationMinutes;

      const bk = bkSlots.find(b => b.startMin < slotEnd && b.endMin > slotStart);
      if (bk) {
        let st: SlotStatus = 'scheduled';
        if (bk.status === 'in_progress') st = 'in_progress';
        else if (bk.status === 'booking' || bk.status === 'pending') st = 'booking';
        sched[arr.id][slotLabel] = {
          status: st,
          arrangementName: arr.name,
          capacity: arr.capacity,
          start: bk.startLabel, end: bk.endLabel,
          duration: bk.duration,
          reference: bk.reference,
          bookingsId: bk.bookingsId,
          branchName: arr.branch_name,
        };
        continue;
      }

      sched[arr.id][slotLabel] = { status: 'available' };
    }
  }
  return sched;
}

function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BranchAppointmentsPage() {
  const token = useAppSelector((s) => s.auth.token) ?? '';

  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedDate,     setSelectedDate]      = useState<string>(todayStr);
  const [search,           setSearch]            = useState('');
  const [detailModal,      setDetailModal]       = useState<DetailModalPayload | null>(null);
  const [newBookingModal,  setNewBookingModal]   = useState<NewBookingPayload | null>(null);
  const [showBranchDrop,   setShowBranchDrop]    = useState(false);
  const [showCalendar,     setShowCalendar]      = useState(false);

  const [scheduleData, setScheduleData] = useState<ApiScheduleRecord | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);
  const onBodyScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  // Fetch schedule when branch or date changes
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/v1/service-arrangements/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`;
        const res = await fetch(url, {
          signal:  controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as Record<string, string>).detail ?? `Error ${res.status}`);
        }
        const data: ApiScheduleRecord[] = await res.json();
        setScheduleData(data?.[0] ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
        setScheduleData(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedBranchId, selectedDate, token]);

  // Derived data
  const grid      = scheduleData?.grid ?? { start: '09:00', end: '22:00', slot_duration_minutes: 30 as const };
  const timeSlots = generateTimeSlots(grid);

  const allArrangements: ApiArrangement[] = scheduleData?.arrangements ?? [];
  const filteredByBranch = selectedBranchId === 'all'
    ? allArrangements
    : allArrangements.filter(a => a.branch_id === selectedBranchId);

  const arrangements: Arrangement[] = filteredByBranch.map((a, i) => ({
    id:              a.id,
    name:            a.name,
    initials:        getInitials(a.name),
    arrangementType: a.arrangement_type,
    capacity:        a.capacity,
    branchName:      a.branch_name,
    branchId:        a.branch_id,
    color:           ARRANGEMENT_COLORS[i % ARRANGEMENT_COLORS.length],
  }));

  const schedule = scheduleData
    ? buildScheduleFromApi(scheduleData.arrangements, scheduleData.bookings, timeSlots, grid.slot_duration_minutes)
    : {};

  const filteredArrangements = search
    ? arrangements.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.branchName.toLowerCase().includes(search.toLowerCase())
      )
    : arrangements;

  const allSlots    = arrangements.flatMap(a => Object.values(schedule[a.id] ?? {}));
  const bookedCount = allSlots.filter(s => s.status !== 'unavailable' && s.status !== 'available').length;
  const availCount  = allSlots.filter(s => s.status === 'available').length;
  const occupancy   = Math.round((bookedCount / (bookedCount + availCount)) * 100) || 0;

  const apiBranches: ApiBranch[] = scheduleData?.branch?.branches ?? (
    scheduleData?.branch?.id && scheduleData.branch.id !== 'all'
      ? [{ branch_id: scheduleData.branch.id, branch_name: scheduleData.branch.name ?? scheduleData.branch.id }]
      : []
  );

  const branchLabel = (() => {
    if (selectedBranchId === 'all') return 'All Branches';
    return apiBranches.find(b => b.branch_id === selectedBranchId)?.branch_name ?? 'Select Branch';
  })();

  const dateDisplay = formatDateDisplay(selectedDate);

  const openDetailModal = useCallback((slot: Slot, arrangement: Arrangement, timeSlot: string) => {
    setDetailModal({ slot, arrangement, timeSlot, branch: branchLabel, date: dateDisplay });
  }, [branchLabel, dateDisplay]);

  const openNewBooking = useCallback((arrangement: Arrangement, timeSlot: string) => {
    setNewBookingModal({ arrangement, timeSlot, date: selectedDate });
  }, [selectedDate]);

  const handleBookingSuccess = useCallback(() => {
    // Reload schedule
    setScheduleData(null);
    setLoading(true);
    const url = `/api/v1/service-arrangements/schedule?branch_id=${selectedBranchId}&date=${selectedDate}`;
    fetch(url, { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
      .then(r => r.json())
      .then((data: ApiScheduleRecord[]) => setScheduleData(data?.[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBranchId, selectedDate, token]);

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Branch Appointments</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live arrangement board · <span className="font-semibold text-foreground">{dateDisplay}</span>
          {selectedBranchId === 'all'
            ? <> · <span className="font-semibold text-foreground">All Branches</span></>
            : branchLabel !== 'Select Branch' && <> · <span className="font-semibold text-foreground">{branchLabel}</span></>
          }
        </p>
      </div>

      {/* ── Top controls ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">

        {/* Branch dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowBranchDrop(d => !d); setShowCalendar(false); }}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition"
          >
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[180px] truncate">{branchLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          </button>
          {showBranchDrop && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowBranchDrop(false)} />
              <div className="absolute top-full left-0 mt-2 z-50 w-64 rounded-2xl border border-border bg-card shadow-2xl py-2 overflow-hidden">
                <button
                  onClick={() => { setSelectedBranchId('all'); setShowBranchDrop(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-muted/60',
                    selectedBranchId === 'all' ? 'text-primary font-bold bg-primary/5' : 'text-foreground',
                  )}
                >
                  All Branches
                </button>
                {apiBranches.length > 0 && (
                  <div className="my-1 border-t border-border/40" />
                )}
                {apiBranches.map(b => (
                  <button
                    key={b.branch_id}
                    onClick={() => { setSelectedBranchId(b.branch_id); setShowBranchDrop(false); }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm font-medium transition hover:bg-muted/60',
                      b.branch_id === selectedBranchId ? 'text-primary font-bold bg-primary/5' : 'text-foreground',
                    )}
                  >
                    {b.branch_name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Date picker */}
        <div className="relative">
          <button
            onClick={() => { setShowCalendar(d => !d); setShowBranchDrop(false); }}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition"
          >
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {dateDisplay}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          </button>
          {showCalendar && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
              <CalendarPicker
                value={selectedDate}
                onChange={d => setSelectedDate(d)}
                onClose={() => setShowCalendar(false)}
              />
            </>
          )}
        </div>

        <div className="flex-1" />

        <div className="relative min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search arrangement or branch…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm hover:bg-primary/90 transition">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Daily Occupancy',     value: `${occupancy}%`,              sub: 'booked slots',      icon: <CheckCircle2 className="h-5 w-5" />, grad: 'from-primary to-accent',       bg: 'bg-rose-50 dark:bg-rose-950/30',     border: 'border-rose-200/80 dark:border-rose-800/40' },
          { label: 'Total Arrangements',  value: String(arrangements.length),  sub: 'spaces active',     icon: <LayoutGrid className="h-5 w-5" />,  grad: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200/80 dark:border-violet-800/40' },
          { label: 'Total Bookings',      value: String(bookedCount),          sub: 'slots scheduled',   icon: <CalendarDays className="h-5 w-5" />, grad: 'from-rose-500 to-pink-600',     bg: 'bg-pink-50 dark:bg-pink-950/30',     border: 'border-pink-200/80 dark:border-pink-800/40' },
          { label: 'Available Slots',     value: String(availCount),           sub: 'open for booking',  icon: <Store className="h-5 w-5" />,        grad: 'from-amber-500 to-orange-600',  bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200/80 dark:border-amber-800/40' },
        ].map((k) => (
          <div key={k.label}
            className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5', k.bg, k.border)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight">{k.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
              </div>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', k.grad)}>
                {k.icon}
              </div>
            </div>
            <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10', k.grad)} />
          </div>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading schedule…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {/* ── Main schedule grid ── */}
      {!loading && !error && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm">

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-end gap-4 border-b border-border/40 px-4 py-3 bg-muted/20 rounded-t-2xl overflow-hidden">
            {[
              { label: 'In Progress', color: 'bg-emerald-500' },
              { label: 'Booking',     color: 'bg-blue-500' },
              { label: 'Scheduled',   color: 'bg-violet-500' },
              { label: 'Available',   color: 'bg-card border border-dashed border-border' },
              { label: 'Unavailable', color: 'bg-muted/80' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 rounded-full', l.color)} />
                {l.label}
              </span>
            ))}
          </div>

          {filteredArrangements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <LayoutGrid className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                {search ? 'No arrangements match your search' : 'No arrangements found for this selection'}
              </p>
            </div>
          ) : (
            <>
              {/* Sticky header */}
              <div className="sticky top-16 z-20 flex border-b-2 border-border/60 bg-card/95 backdrop-blur-md shadow-sm">
                <div className="w-28 shrink-0 flex items-center pl-4 py-3 font-bold text-xs text-muted-foreground uppercase tracking-wider border-r border-border/30 bg-card/95">
                  Time
                </div>
                <div ref={headerScrollRef} className="flex-1 overflow-x-hidden">
                  <div style={{ width: `${filteredArrangements.length * 175}px`, minWidth: '100%' }} className="flex">
                    {filteredArrangements.map((a, aIdx) => {
                      const typeCfg = getArrangementType(a.arrangementType);
                      const TypeIcon = typeCfg.Icon;
                      return (
                        <div key={a.id} style={{ width: 175, minWidth: 175 }} className={cn(
                          'flex flex-col items-center py-4 border-l border-border/30 first:border-l-0 px-2',
                          COL_TINTS[aIdx % COL_TINTS.length],
                        )}>
                          <div className="relative flex items-center justify-center p-1 rounded-full bg-gradient-to-b from-card to-muted/70 shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-border/50">
                            <div className={cn('relative h-10 w-10 rounded-full grid place-items-center ring-2 ring-background shrink-0 bg-gradient-to-br text-white text-xs font-bold', a.color)}>
                              {a.initials}
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-bold text-foreground text-center truncate max-w-[130px]">{a.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TypeIcon className={cn('h-3 w-3', typeCfg.color)} />
                            <p className="text-[10px] font-semibold text-muted-foreground">{typeCfg.label}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[130px]">{a.branchName}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex rounded-b-2xl">
                {/* Time column */}
                <div className="w-28 shrink-0 flex flex-col border-r border-border/30 bg-muted/10">
                  {timeSlots.map((time) => (
                    <div
                      key={`tcol-${time}`}
                      className="flex flex-col justify-center pl-4 py-2.5 border-t border-border/30"
                      style={{ height: 98 }}
                    >
                      <p className="text-xs font-bold text-foreground">{time}</p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                        {grid.slot_duration_minutes} min slots
                      </p>
                    </div>
                  ))}
                </div>

                {/* Arrangement columns */}
                <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-x-auto">
                  <div
                    style={{
                      width: `${filteredArrangements.length * 175}px`,
                      minWidth: '100%',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${filteredArrangements.length}, 175px)`,
                      gridTemplateRows: `repeat(${timeSlots.length}, 98px)`,
                    }}
                  >
                    {filteredArrangements.map((a, aIdx) => {
                      const cells: React.ReactNode[] = [];
                      let rowIdx = 0;

                      while (rowIdx < timeSlots.length) {
                        const time = timeSlots[rowIdx];
                        const slot = schedule[a.id]?.[time] ?? { status: 'unavailable' as SlotStatus };
                        const isBooked = slot.status === 'booking' || slot.status === 'scheduled' || slot.status === 'in_progress';

                        let span = 1;
                        if (isBooked && slot.reference) {
                          while (rowIdx + span < timeSlots.length) {
                            const next = schedule[a.id]?.[timeSlots[rowIdx + span]];
                            if (
                              next &&
                              (next.status === 'booking' || next.status === 'scheduled' || next.status === 'in_progress') &&
                              next.reference === slot.reference
                            ) { span++; } else { break; }
                          }
                        } else if (isBooked && slot.start && slot.end) {
                          while (rowIdx + span < timeSlots.length) {
                            const next = schedule[a.id]?.[timeSlots[rowIdx + span]];
                            if (
                              next &&
                              (next.status === 'booking' || next.status === 'scheduled' || next.status === 'in_progress') &&
                              next.start === slot.start && next.end === slot.end
                            ) { span++; } else { break; }
                          }
                        }

                        cells.push(
                          <div
                            key={`${a.id}-${time}`}
                            style={{
                              gridColumn: aIdx + 1,
                              gridRow: span > 1 ? `${rowIdx + 1} / span ${span}` : rowIdx + 1,
                            }}
                            className={cn(
                              'p-2 border-t border-l border-border/30 transition-colors first:border-l-0',
                              COL_TINTS[aIdx % COL_TINTS.length],
                            )}
                          >
                            <SlotCell
                              slot={slot}
                              onClick={
                                isBooked
                                  ? () => openDetailModal(slot, a, time)
                                  : slot.status === 'available'
                                    ? () => openNewBooking(a, time)
                                    : undefined
                              }
                            />
                          </div>,
                        );

                        rowIdx += span;
                      }

                      return cells;
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Detail Modal (booked slots) ── */}
      {detailModal && <SlotDetailModal payload={detailModal} onClose={() => setDetailModal(null)} />}

      {/* ── New Booking Modal (available slots) ── */}
      {newBookingModal && (
        <NewBranchBookingModal
          payload={newBookingModal}
          onClose={() => setNewBookingModal(null)}
          onSuccess={handleBookingSuccess}
          token={token}
        />
      )}
    </DashboardShell>
  );
}
