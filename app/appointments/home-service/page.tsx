'use client';
// Home Service Schedule – mirrors Branch Appointments design
// API: /api/v1/therapists/schedule/?branch_id=home&date=YYYY-MM-DD
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Search, Plus, ChevronDown, CalendarDays,
  CheckCircle2, Clock, AlertCircle, X, User, Scissors,
  Timer, Hash, MapPin, ChevronLeft, ChevronRight, Loader2, Home,
  Phone, Mail, FileText, Package, Star, DollarSign, Link as LinkIcon,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiTherapist {
  id: string;
  name: string;
  photo_url: string | null;
  branch_id: string;
  branch_name: string;
  available_for_home_service: boolean;
  status: string;
}

interface ApiInterval {
  start: string;
  end: string;
}

interface ApiAvailability {
  therapist_id: string;
  intervals: ApiInterval[];
}

interface ApiBooking {
  id: string;
  therapist_id: string;
  start: string;
  end: string;
  duration_minutes?: number;
  status?: string;
  booking_type?: string;
  booking_id?: string;
  customer?: { name?: string; phone?: string } | null;
  service?: { name?: string } | null;
}

interface ApiGrid {
  start: string;
  end: string;
  slot_duration_minutes: 30 | 60;
}

interface ApiScheduleRecord {
  date: string;
  timezone: string;
  branch: { id: string; name: string | null };
  grid: ApiGrid;
  therapists: ApiTherapist[];
  availability: ApiAvailability[];
  bookings: ApiBooking[];
}

// ── Slot model ─────────────────────────────────────────────────────────────────

type SlotStatus = 'unavailable' | 'available' | 'booking' | 'scheduled' | 'in_progress';

interface Slot {
  status: SlotStatus;
  client?: string;
  service?: string;
  start?: string;
  end?: string;
  duration?: string;
  reference?: string;
}

// ── Therapist model used in UI ─────────────────────────────────────────────────

interface Therapist {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  color: string;
  branchId:   string;
  branchName: string;
}

// ── Service & AddOn types ──────────────────────────────────────────────────────

interface ApiAddOn {
  id: string;
  name: string;
  description?: string;
  price?: string | number;
  home_service_price?: string | number;
  duration_minutes?: number;
  is_active?: boolean;
}

interface ApiService {
  id: string;
  name: string;
  category?: string;
  service_types?: { id: string; name: string }[];
  base_price?: string | number;
  home_service_price?: string | number;
  duration_minutes?: number;
  is_home_service_eligible?: boolean;
  gender?: string;
  extra_minutes?: number;
  price_for_extra_minutes?: string | number;
  add_ons?: ApiAddOn[];
}

// ── Customer type ─────────────────────────────────────────────────────────────

interface ApiCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  email?: string;
  full_name?: string;
}

// ── Column tints ───────────────────────────────────────────────────────────────
const COL_TINTS = [
  'bg-rose-50/60    dark:bg-rose-950/20',
  'bg-violet-50/60  dark:bg-violet-950/20',
  'bg-sky-50/60     dark:bg-sky-950/20',
  'bg-emerald-50/60 dark:bg-emerald-950/20',
  'bg-amber-50/60   dark:bg-amber-950/20',
  'bg-pink-50/60    dark:bg-pink-950/20',
];

const THERAPIST_COLORS = [
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Shared status config ───────────────────────────────────────────────────────
const STATUS_CFG = {
  in_progress: {
    label: 'In Progress', badge: 'IN PROGRESS',
    dot: 'bg-emerald-500 animate-pulse',
    cardCls: 'border-2 border-emerald-400/80 dark:border-emerald-500/60 bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:from-emerald-950/50 dark:to-emerald-900/30 shadow-sm shadow-emerald-500/10 hover:shadow-md hover:border-emerald-500',
    badgeCls: 'text-emerald-700 dark:text-emerald-300 font-extrabold',
    pillCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    iconCls: 'text-emerald-600 dark:text-emerald-400',
    btnCls: 'bg-emerald-500 hover:bg-emerald-600', btnLabel: 'Mark Complete', Icon: CheckCircle2,
  },
  booking: {
    label: 'Booking', badge: 'BOOKING',
    dot: 'bg-blue-500',
    cardCls: 'border-2 border-blue-400/80 dark:border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/70 dark:from-blue-950/50 dark:to-blue-900/30 shadow-sm shadow-blue-500/10 hover:shadow-md hover:border-blue-500',
    badgeCls: 'text-blue-700 dark:text-blue-300 font-extrabold',
    pillCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    iconCls: 'text-blue-600 dark:text-blue-400',
    btnCls: 'bg-blue-500 hover:bg-blue-600', btnLabel: 'Confirm Booking', Icon: CalendarDays,
  },
  scheduled: {
    label: 'Scheduled', badge: 'SCHEDULED',
    dot: 'bg-violet-500',
    cardCls: 'border-2 border-violet-400/80 dark:border-violet-500/60 bg-gradient-to-br from-violet-50 to-violet-100/70 dark:from-violet-950/50 dark:to-violet-900/30 shadow-sm shadow-violet-500/10 hover:shadow-md hover:border-violet-500',
    badgeCls: 'text-violet-700 dark:text-violet-300 font-extrabold',
    pillCls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    iconCls: 'text-violet-600 dark:text-violet-400',
    btnCls: 'bg-violet-500 hover:bg-violet-600', btnLabel: 'View Details', Icon: Clock,
  },
} as const;

type ActiveStatus = keyof typeof STATUS_CFG;

// ── Slot Detail Modal (existing bookings) ──────────────────────────────────────
interface ModalPayload {
  slot: Slot; therapist: Therapist; timeSlot: string; date: string;
}

function SlotDetailModal({ payload, onClose }: { payload: ModalPayload; onClose: () => void }) {
  const { slot, therapist, timeSlot, date } = payload;
  const cfg = STATUS_CFG[slot.status as ActiveStatus];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const refNo = slot.reference ?? `USH-${therapist.id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className={cn('h-1.5 w-full', { 'bg-emerald-400': slot.status === 'in_progress', 'bg-blue-400': slot.status === 'booking', 'bg-violet-400': slot.status === 'scheduled' })} />
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className={cn('absolute inset-0 rounded-full blur-md opacity-40 bg-gradient-to-br', therapist.color)} />
              <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-background shadow-md">
                {therapist.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={therapist.photoUrl} alt={therapist.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
                <div className={cn('absolute inset-0 grid place-items-center text-white text-sm font-bold bg-gradient-to-br -z-10', therapist.color)}>{therapist.initials}</div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Therapist</p>
              <p className="text-base font-extrabold">{therapist.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', cfg.pillCls)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />{cfg.label}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          {[
            { icon: User, label: 'Client', value: slot.client ?? '—' },
            { icon: Scissors, label: 'Service', value: slot.service ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><Icon className="h-4 w-4" /></div>
              <div><p className="text-[11px] text-muted-foreground font-medium">{label}</p><p className="text-sm font-bold">{value}</p></div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><Clock className="h-4 w-4" /></div>
              <div><p className="text-[11px] text-muted-foreground font-medium">Time</p><p className="text-sm font-bold">{slot.start && slot.end ? `${slot.start} – ${slot.end}` : timeSlot}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><Timer className="h-4 w-4" /></div>
              <div><p className="text-[11px] text-muted-foreground font-medium">Duration</p><p className="text-sm font-bold">{slot.duration ?? '—'}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 min-w-0">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><MapPin className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="text-[11px] text-muted-foreground font-medium">Service Type</p><p className="text-sm font-bold truncate">Home Service</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
              <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><CalendarDays className="h-4 w-4" /></div>
              <div><p className="text-[11px] text-muted-foreground font-medium">Date</p><p className="text-sm font-bold">{date}</p></div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}><Hash className="h-4 w-4" /></div>
            <div><p className="text-[11px] text-muted-foreground font-medium">Booking Reference</p><p className="text-sm font-bold font-mono tracking-wide">{refNo}</p></div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-border/40 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">Close</button>
          <button className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition', cfg.btnCls)}>{cfg.btnLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeSlotToIso(date: string, timeSlot: string): string {
  const [timePart, period] = timeSlot.trim().split(' ');
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function fmtPrice(v: string | number | undefined): string {
  if (v === undefined || v === null || v === '') return '';
  const n = parseFloat(String(v));
  return isNaN(n) ? '' : n.toFixed(3);
}

function customerLabel(c: ApiCustomer): string {
  const name = c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ');
  return [name, c.phone_number].filter(Boolean).join(' · ') || c.id;
}

// ── Searchable Dropdown ────────────────────────────────────────────────────────
interface SearchDropdownProps<T> {
  value: string;
  placeholder: string;
  loading?: boolean;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  renderSelected?: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onSearch: (q: string) => void;
  onSelect: (item: T) => void;
  onClear?: () => void;
  selectedItem?: T | null;
  icon?: React.ElementType;
}

function SearchDropdown<T>({
  value, placeholder, loading, items, renderItem, getKey, isSelected,
  onSearch, onSelect, onClear, selectedItem, icon: Icon = Search,
}: SearchDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? 'Loading…' : placeholder}
          disabled={loading}
          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-8 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
        />
        {selectedItem
          ? <button type="button" onClick={() => { onClear?.(); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition" /></button>
          : <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        }
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
          {loading && <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>}
          {!loading && items.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No results found</p>}
          {!loading && items.map((item) => (
            <button key={getKey(item)} type="button"
              onClick={() => { onSelect(item); setOpen(false); }}
              className={cn('w-full text-left transition hover:bg-muted/60 px-1 py-0.5', isSelected(item) && 'bg-primary/5')}>
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared form sub-components (must be module-level to avoid remount on every render) ──
function FormLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
}
function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
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

// ── Booking Form Modal – two-step wizard ──────────────────────────────────────
interface BookingFormPayload {
  therapist:    Therapist;
  timeSlot:     string;
  date:         string;         // YYYY-MM-DD
  dateDisplay:  string;         // "Sep 10, 2026"
  slotIsoStart: string;
}

type ServiceGender = 'female' | 'male';

interface BookingFormState {
  // Step 1
  gender:        ServiceGender;
  serviceId:     string;
  serviceSearch: string;
  addonIds:      string[];
  extraMinutes:  number;
  // Step 2
  customerId:    string;
  customerSearch: string;
  addressLine1:  string;
  addressLine2:  string;
  city:          string;
  area:          string;
  notes:         string;
}

function BookingFormModal({
  payload, token, onClose, onSuccess,
}: {
  payload: BookingFormPayload;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { therapist, timeSlot, date, dateDisplay, slotIsoStart } = payload;

  // ── Step ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Holds the created booking returned by the API (step 3)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult, setBookingResult] = useState<Record<string, any> | null>(null);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [paymentLinkSent,    setPaymentLinkSent]    = useState(false);
  const [paymentLinkError,   setPaymentLinkError]   = useState<string | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [services,         setServices]         = useState<ApiService[]>([]);
  const [servicesLoading,  setServicesLoading]  = useState(true);
  const [globalAddons,     setGlobalAddons]     = useState<ApiAddOn[]>([]);
  const [addonsLoading,    setAddonsLoading]    = useState(true);
  const [customers,        setCustomers]        = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerQuery,    setCustomerQuery]    = useState('');

  const authHdr = token ? { Authorization: `Bearer ${token}` } : {};

  // Fetch therapist services
  useEffect(() => {
    (async () => {
      setServicesLoading(true);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/v1/therapists/${therapist.id}/services`, { headers });
        const raw = await res.json();
        setServices(Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? []));
      } catch { setServices([]); }
      finally { setServicesLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist.id, token]);

  // Fetch global add-ons
  useEffect(() => {
    (async () => {
      setAddonsLoading(true);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/v1/addons', { headers });
        const raw = await res.json();
        setGlobalAddons(Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? []));
      } catch { setGlobalAddons([]); }
      finally { setAddonsLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fetch customers (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      setCustomersLoading(true);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const q = customerQuery.trim();
        const url = q ? `/api/v1/customers?search=${encodeURIComponent(q)}` : '/api/v1/customers';
        const res = await fetch(url, { headers });
        const raw = await res.json();
        setCustomers(Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? []));
      } catch { setCustomers([]); }
      finally { setCustomersLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerQuery, token]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<BookingFormState>({
    gender: 'female', serviceId: '', serviceSearch: '', addonIds: [], extraMinutes: 0,
    customerId: '', customerSearch: '',
    addressLine1: '', addressLine2: '', city: '', area: '', notes: '',
  });
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const genderFiltered = useMemo(() =>
    services.filter((s) => { const g = s.gender; return !g || g.toLowerCase() === form.gender; }),
  [services, form.gender]);

  const filteredServices = useMemo(() => {
    const q = form.serviceSearch.toLowerCase();
    return genderFiltered.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q));
  }, [genderFiltered, form.serviceSearch]);

  const selectedService  = useMemo(() => services.find((s) => s.id === form.serviceId) ?? null, [services, form.serviceId]);
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === form.customerId) ?? null, [customers, form.customerId]);

  // Merge service add-ons with global add-ons (de-duped by id)
  const serviceAddons: ApiAddOn[] = selectedService?.add_ons ?? [];
  const allAddons: ApiAddOn[] = useMemo(() => {
    const ids = new Set(serviceAddons.map((a) => a.id));
    return [...serviceAddons, ...globalAddons.filter((a) => !ids.has(a.id))];
  }, [serviceAddons, globalAddons]);

  // ── Pricing ───────────────────────────────────────────────────────────────
  const servicePrice = parseFloat(String(selectedService?.home_service_price ?? selectedService?.base_price ?? '0')) || 0;

  // Selected addons price + total duration added
  const selectedAddons = allAddons.filter((a) => form.addonIds.includes(a.id));
  const addonTotal     = selectedAddons.reduce((sum, a) => sum + (parseFloat(String(a.home_service_price ?? a.price ?? '0')) || 0), 0);
  const addonDuration  = selectedAddons.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);

  const extraMinutesUnit  = selectedService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(selectedService?.price_for_extra_minutes ?? '0')) || 0;
  const extraMinutesPrice = form.extraMinutes > 0 && extraMinutesUnit > 0
    ? extraPricePerUnit * (form.extraMinutes / extraMinutesUnit) : 0;
  const hasExtraTime = extraMinutesUnit > 0;
  const extraOptions = hasExtraTime ? [0, extraMinutesUnit, extraMinutesUnit * 2, extraMinutesUnit * 3] : [];

  const baseDuration = selectedService?.duration_minutes ?? 0;
  const totalDuration = baseDuration + addonDuration + form.extraMinutes;
  const totalPrice    = servicePrice + addonTotal + extraMinutesPrice;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const setF = (key: keyof BookingFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const toggleAddon = (id: string) =>
    setForm((p) => ({ ...p, addonIds: p.addonIds.includes(id) ? p.addonIds.filter((x) => x !== id) : [...p.addonIds, id] }));

  const selectService  = (s: ApiService) => setForm((p) => ({ ...p, serviceId: s.id, serviceSearch: s.name, addonIds: [], extraMinutes: 0 }));
  const selectCustomer = (c: ApiCustomer) => setForm((p) => ({ ...p, customerId: c.id, customerSearch: customerLabel(c) }));
  const clearService   = () => setForm((p) => ({ ...p, serviceId: '', serviceSearch: '', addonIds: [], extraMinutes: 0 }));
  const clearCustomer  = () => setForm((p) => ({ ...p, customerId: '', customerSearch: '' }));

  const goNext = () => {
    if (!form.serviceId) { setSubmitError('Please select a service to continue.'); return; }
    setSubmitError(null); setStep(2);
  };
  const goBack = () => { setSubmitError(null); setStep(1); };

  // Convert "02:30 PM" → "14:30" (24-hour HH:MM)
  const toHHMM = (slot: string): string => {
    const [timePart, ampm] = slot.trim().split(' ');
    const [hStr, mStr]     = timePart.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr ?? '0', 10);
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Format price safely to 3 decimal string
  const fmtPrice = (n: number) => n.toFixed(3);

  // ── Submit (POST to /api/v1/booknpay/bookings) ────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId)  { setSubmitError('Please select a customer.'); return; }
    if (!form.addressLine1){ setSubmitError('Please enter the home address.'); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const svc         = selectedService!;
      const svcCategory = svc.service_types?.[0]?.name ?? svc.category ?? '';
      const baseP       = parseFloat(String(svc.home_service_price ?? svc.base_price ?? '0')) || 0;
      const addonP      = addonTotal;
      const extraP      = extraMinutesPrice;
      const total       = totalPrice;
      const timeHHMM    = toHHMM(timeSlot);

      const body = {
        service_id:         svc.id,
        service_name:       svc.name,
        service_category:   svcCategory,
        base_price:         fmtPrice(parseFloat(String(svc.base_price ?? '0')) || 0),
        home_service_price: fmtPrice(baseP),
        baseDuration:       svc.duration_minutes ?? 0,
        branch_id:        therapist.branchId || 'home',
        branch_data: {
          branch_name:    therapist.branchName || 'Home Service',
          branch_address: 'Home Service',
        },
        service_arrangement_id:   null,
        service_arrangement_data: null,
        therapist_id:   therapist.id,
        therapist_data: { therapist_name: therapist.name },
        selected_addons: selectedAddons.map((a) => ({
          id:          a.id,
          name:        a.name,
          description: (a as unknown as Record<string, string>).description ?? '',
          price:       fmtPrice(parseFloat(String(a.home_service_price ?? a.price ?? '0')) || 0),
          currency:    'KWD',
          is_active:   true,
        })),
        addons_duration: addonDuration,
        extra_minutes:   form.extraMinutes,
        extra_price:     fmtPrice(extraP),
        date:            date,
        formattedDate:   dateDisplay,
        time_slot:       timeHHMM,
        displayTime:     timeSlot,
        customerMessage: '',
        customer_notes:  form.notes,
        customer_id:     form.customerId,
        home_address: {
          address_line_1: form.addressLine1,
          address_line_2: form.addressLine2,
          city:           form.city,
          area:           form.area,
        },
        booking_type: 'home',
        appointment_start: slotIsoStart,
        pricing_details: {
          base:              fmtPrice(baseP),
          base_price:        fmtPrice(baseP),
          arrangement:       fmtPrice(baseP),
          arrangement_price: fmtPrice(baseP),
          addons:            fmtPrice(addonP),
          addons_price:      fmtPrice(addonP),
          extratime:         fmtPrice(extraP),
          extra_time:        fmtPrice(extraP),
          extra_time_price:  fmtPrice(extraP),
          subtotal:          fmtPrice(total),
          total:             fmtPrice(total),
          total_price:       fmtPrice(total),
          currency:          'KWD',
        },
        total_price:    fmtPrice(total),
        // duration_minutes + addons_duration + extra_minutes
        total_duration: (svc.duration_minutes ?? 0) + addonDuration + form.extraMinutes,
        currency:       'KWD',
      };

    const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/v1/booknpay/bookings', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = (json as Record<string, string>).detail ?? (json as Record<string, string>).message ?? `Error ${res.status}`;
        throw new Error(detail);
      }
      // Success → show step 3
      setBookingResult(json.data ?? json);
      setStep(3);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally { setSubmitting(false); }
  };

  // ── Create Payment Link ────────────────────────────────────────────────────
  const handleCreatePaymentLink = async () => {
    if (!bookingResult) return;
    const bookingId = bookingResult.id ?? bookingResult.booking_id;
    if (!bookingId) { setPaymentLinkError('Booking ID not found.'); return; }
    setPaymentLinkLoading(true); setPaymentLinkError(null);
    try {
      const plHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
      if (token) plHeaders['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/v1/booknpay/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: plHeaders,
        body: JSON.stringify({
          status:         'confirmed',
          payment_status: 'pending',
          reason:         'Payment Link Sent to Customer',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).detail ?? `Error ${res.status}`);
      }
      setPaymentLinkSent(true);
    } catch (err) {
      setPaymentLinkError(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally { setPaymentLinkLoading(false); }
  };

  // FormLabel and FormInput are defined at module level to prevent remount on each render

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal shell – fixed height so both steps feel the same size */}
      <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* ── Accent bar ── */}
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 to-blue-500 shrink-0" />

        {/* ── Top header: label + step pills + close ── */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-sky-500" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-500">New Home Service Booking</p>
            {/* Step pills */}
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
              {step === 1 ? 'Service Selection' : step === 2 ? 'Customer & Address' : 'Booking Confirmed'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Static sub-header: Therapist | Date + Time ── */}
        <div className="shrink-0 border-b border-border/40 bg-muted/20">
          <div className="flex items-stretch divide-x divide-border/40">

            {/* ── LEFT: Therapist portrait ── */}
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-4 w-[36%] shrink-0">
              <div className="relative">
                <div className={cn('absolute -inset-1.5 rounded-full opacity-20 blur-xl bg-gradient-to-br', therapist.color)} />
                <div className="relative h-[78px] w-[78px] rounded-full p-[3px] shadow-xl"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.4) 100%)' }}>
                  <div className="h-full w-full rounded-full overflow-hidden bg-muted">
                    {therapist.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={therapist.photoUrl} alt={therapist.name}
                        className="h-full w-full object-cover object-top"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                        }} />
                    ) : null}
                    <div className={cn('h-full w-full items-center justify-center text-white text-sm font-extrabold bg-gradient-to-br', therapist.color, therapist.photoUrl ? 'hidden' : 'flex')}>
                      {therapist.initials}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[100px]">{therapist.name}</p>
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />Therapist
                </span>
              </div>
            </div>

            {/* ── RIGHT: Date tile + Time slot pill ── */}
            <div className="flex items-center justify-end gap-3.5 px-5 py-4 flex-1 min-w-0">
              {(() => {
                const d = new Date(date + 'T00:00:00');
                const dayName  = d.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum   = d.getDate();
                const month    = d.toLocaleDateString('en-US', { month: 'long' });
                const year     = d.getFullYear();
                return (
                  <>
                    {/* Calendar tile – styled like the reference image */}
                    <div className="flex flex-col items-center justify-center w-[68px] h-[80px] rounded-2xl shrink-0 shadow-lg"
                      style={{ background: 'linear-gradient(160deg, #3b2f2f 0%, #4a3728 100%)' }}>
                      <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest leading-none mb-1">{dayName}</p>
                      <p className="text-[34px] font-black text-white leading-none">{dayNum}</p>
                    </div>

                    {/* Full date + time slot details */}
                    <div className="flex flex-col gap-2 min-w-0">
                      {/* Full date text */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Date</p>
                        <p className="text-sm font-extrabold text-foreground leading-tight">{month} {dayNum}, {year}</p>
                      </div>
                      {/* Time slot – modern pill style */}
                      <div className="inline-flex items-center gap-2 rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/30 px-3 py-1.5 w-fit">
                        <div className="grid h-5 w-5 place-items-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 shrink-0">
                          <Clock className="h-3 w-3" />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500/70 dark:text-violet-400/70 leading-none">Time Slot</p>
                          <p className="text-xs font-extrabold text-violet-700 dark:text-violet-300 leading-tight">{timeSlot}</p>
                        </div>
                        {totalDuration > 0 && (
                          <>
                            <span className="text-violet-300/60 dark:text-violet-700/60 text-xs">·</span>
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <Timer className="h-3 w-3" />{totalDuration}m
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Scrollable form body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="booking-form" onSubmit={handleSubmit}>

            {/* ════════════ STEP 1: Service Selection ════════════ */}
            {step === 1 && (
              <div className="px-6 py-5 space-y-5">

                {/* Gender toggle */}
                <div>
                  <FormLabel>Service For</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(['female', 'male'] as ServiceGender[]).map((g) => (
                      <button key={g} type="button"
                        onClick={() => setForm((p) => ({ ...p, gender: g, serviceId: '', serviceSearch: '', addonIds: [], extraMinutes: 0 }))}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition',
                          form.gender === g
                            ? g === 'female'
                              ? 'border-pink-400/60 bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 shadow-sm'
                              : 'border-blue-400/60 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40',
                        )}>
                        <span className="text-base">{g === 'female' ? '♀' : '♂'}</span>
                        <span className="capitalize">{g}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service search */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Select Service</p>
                    {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <FormLabel>Search & Select *</FormLabel>
                  <SearchDropdown<ApiService>
                    value={form.serviceSearch}
                    placeholder={servicesLoading ? 'Loading services…' : `Search ${form.gender} services…`}
                    loading={servicesLoading}
                    items={filteredServices}
                    getKey={(s) => s.id}
                    isSelected={(s) => s.id === form.serviceId}
                    selectedItem={selectedService}
                    icon={Scissors}
                    onSearch={(q) => setForm((p) => ({ ...p, serviceSearch: q, serviceId: '' }))}
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
                        {(s.home_service_price ?? s.base_price) && (
                          <p className="shrink-0 text-sm font-bold text-primary mt-0.5">
                            {fmtPrice(parseFloat(String(s.home_service_price ?? s.base_price ?? 0)) || 0)} KWD
                          </p>
                        )}
                        {s.id === form.serviceId && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />}
                      </div>
                    )}
                  />
                  {/* Selected service summary */}
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
                        {fmtPrice(parseFloat(String(selectedService.home_service_price ?? selectedService.base_price ?? 0)) || 0)} KWD
                      </p>
                    </div>
                  )}
                </div>

                {/* Extra time (shown when selected service has extra_minutes) */}
                {hasExtraTime && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Extra Time
                        {extraPricePerUnit > 0 && (
                          <span className="ml-1 font-normal normal-case text-muted-foreground/70">
                            ({fmtPrice(extraPricePerUnit)} KWD / {extraMinutesUnit} min)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {extraOptions.map((mins) => (
                        <button key={mins} type="button"
                          onClick={() => setForm((p) => ({ ...p, extraMinutes: mins }))}
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

                {/* Add-ons – always shown, independent of service selection */}
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
                      const price   = fmtPrice(parseFloat(String(addon.home_service_price ?? addon.price ?? 0)) || 0);
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
                  {/* Duration + price callout when add-ons selected */}
                  {(addonDuration > 0 || addonTotal > 0) && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/30 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {addonDuration > 0 && <span className="font-bold">+{addonDuration} min</span>}
                        {addonDuration > 0 && addonTotal > 0 && ' · '}
                        {addonTotal > 0 && <span className="font-bold">+{fmtPrice(addonTotal)} KWD</span>}
                        <span className="font-normal text-emerald-600/70"> added by selected add-ons</span>
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ════════════ STEP 2: Customer & Address ════════════ */}
            {step === 2 && (
              <div className="px-6 py-5 space-y-5">

                {/* Customer */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Customer</p>
                  </div>
                  <FormLabel>Search & Select Customer *</FormLabel>
                  <SearchDropdown<ApiCustomer>
                    value={form.customerSearch}
                    placeholder="Search by name or phone…"
                    loading={customersLoading}
                    items={customers}
                    getKey={(c) => c.id}
                    isSelected={(c) => c.id === form.customerId}
                    selectedItem={selectedCustomer}
                    icon={User}
                    onSearch={(q) => { setCustomerQuery(q); setForm((p) => ({ ...p, customerSearch: q, customerId: '' })); }}
                    onSelect={selectCustomer}
                    onClear={clearCustomer}
                    renderItem={(c) => {
                      const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || '—';
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-xs font-bold">
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {c.phone_number && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {c.phone_number}</span>}
                              {c.email && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
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

                {/* Home Address */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Home className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Home Address</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <FormLabel>Address Line 1 *</FormLabel>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <FormInput placeholder="Street, building, floor…" value={form.addressLine1} onChange={setF('addressLine1')} className="pl-8" required />
                      </div>
                    </div>
                    <div>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormInput placeholder="Apartment, block, landmark…" value={form.addressLine2} onChange={setF('addressLine2')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><FormLabel>City</FormLabel><FormInput placeholder="City" value={form.city} onChange={setF('city')} /></div>
                      <div><FormLabel>Area / District</FormLabel><FormInput placeholder="Area" value={form.area} onChange={setF('area')} /></div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <FormLabel>Notes</FormLabel>
                  </div>
                  <textarea value={form.notes} onChange={setF('notes')}
                    placeholder="Any special instructions or notes…" rows={3}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none" />
                </div>

              </div>
            )}
            {/* ════════════ STEP 3: Booking Success ════════════ */}
            {step === 3 && bookingResult && (
              <div className="flex flex-col items-center justify-center h-full px-8 py-10 text-center gap-6">
                {/* Success icon */}
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-emerald-500/15 blur-xl" />
                  <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-xl">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-foreground">Booking Created!</h3>
                  <p className="text-sm text-muted-foreground mt-1">The appointment has been successfully recorded.</p>
                </div>

                {/* Booking detail card */}
                <div className="w-full rounded-2xl border border-border/60 bg-muted/30 divide-y divide-border/40 text-left">
                  {bookingResult.booking_id && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference</span>
                      <span className="text-sm font-extrabold text-primary font-mono">{bookingResult.booking_id}</span>
                    </div>
                  )}
                  {(bookingResult.service_name || bookingResult.service?.name) && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service</span>
                      <span className="text-sm font-semibold truncate max-w-[60%] text-right">{bookingResult.service_name ?? bookingResult.service?.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Therapist</span>
                    <span className="text-sm font-semibold">{bookingResult.therapist_data?.therapist_name ?? therapist.name}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date & Time</span>
                    <span className="text-sm font-semibold">{bookingResult.formattedDate ?? dateDisplay} · {bookingResult.displayTime ?? timeSlot}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</span>
                    <span className="text-sm font-extrabold text-primary">{bookingResult.total_price ?? bookingResult.pricing_details?.total_price ?? '—'} KWD</span>
                  </div>
                  {(bookingResult.status || bookingResult.payment_status) && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                      <div className="flex items-center gap-2">
                        {bookingResult.status && (
                          <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-950/40 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 capitalize">
                            {bookingResult.status}
                          </span>
                        )}
                        {bookingResult.payment_status && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 capitalize">
                            {bookingResult.payment_status}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment link feedback */}
                {paymentLinkError && (
                  <div className="w-full flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/30 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{paymentLinkError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="w-full flex flex-col gap-3">
                  {paymentLinkSent ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Payment link sent to customer
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreatePaymentLink}
                      disabled={paymentLinkLoading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-primary py-3 text-sm font-bold text-white shadow-lg hover:from-violet-700 hover:to-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {paymentLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                      {paymentLinkLoading ? 'Sending…' : 'Create Payment Link'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* ── Fixed footer: pricing strip + error + action buttons ── */}
        {step !== 3 && (
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
                {/* Service */}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Scissors className="h-2.5 w-2.5" />Service
                  </p>
                  <p className="text-xs font-semibold truncate">{fmtPrice(servicePrice)} KWD</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {selectedService.name}{baseDuration > 0 ? ` · ${baseDuration}m` : ''}
                  </p>
                </div>
                {/* Add-ons */}
                {addonTotal > 0 && (
                  <>
                    <div className="w-px self-stretch bg-border/60 mx-3" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Package className="h-2.5 w-2.5" />Add-ons
                      </p>
                      <p className="text-xs font-semibold text-primary">+{fmtPrice(addonTotal)} KWD</p>
                      <p className="text-[10px] text-muted-foreground">
                        {form.addonIds.length} selected{addonDuration > 0 ? ` · +${addonDuration}m` : ''}
                      </p>
                    </div>
                  </>
                )}
                {/* Extra time */}
                {extraMinutesPrice > 0 && (
                  <>
                    <div className="w-px self-stretch bg-border/60 mx-3" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Timer className="h-2.5 w-2.5" />Extra
                      </p>
                      <p className="text-xs font-semibold text-primary">+{fmtPrice(extraMinutesPrice)} KWD</p>
                      <p className="text-[10px] text-muted-foreground">+{form.extraMinutes} min</p>
                    </div>
                  </>
                )}
                {/* Total price + total duration */}
                <div className="w-px self-stretch bg-border/60 mx-3" />
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                  <p className="text-lg font-black text-primary leading-none">{fmtPrice(totalPrice)}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">KWD</p>
                  {totalDuration > 0 && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 mt-0.5">
                      <Timer className="h-2.5 w-2.5" />{totalDuration} min
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error + Buttons */}
          <div className="px-6 py-3 space-y-3">
            {submitError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{submitError}</span>
              </div>
            )}
            <div className="flex gap-2">
              {step === 1 ? (
                <>
                  <button type="button" onClick={onClose}
                    className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">
                    Cancel
                  </button>
                  <button type="button" onClick={goNext}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition">
                    Next: Customer & Address <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={goBack}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button type="submit" form="booking-form" disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {submitting ? 'Creating…' : 'Confirm Booking'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        )}
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
      <div role="button" tabIndex={0} onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
        className="flex h-full min-h-[82px] flex-col items-center justify-center rounded-xl border border-dashed border-sky-300/70 dark:border-sky-700/40 bg-card/70 transition hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 hover:shadow-sm cursor-pointer group">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/70 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
          <Plus className="h-3.5 w-3.5" /> Book Slot
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground/50 group-hover:text-sky-500/70 transition">Home Service</span>
      </div>
    );
  }

  const cfg  = STATUS_CFG[slot.status as ActiveStatus];
  const Icon = cfg.Icon;

  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={cn('relative h-full min-h-[82px] w-full rounded-xl p-3 transition-all duration-200 cursor-pointer select-none active:scale-[0.98]', cfg.cardCls)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className={cn('text-[10px] uppercase tracking-wider', cfg.badgeCls)}>{cfg.badge}</span>
        <div className="flex items-center gap-1">
          <Icon className={cn('h-3.5 w-3.5', cfg.iconCls)} />
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
        </div>
      </div>
      <p className="text-sm font-bold leading-tight text-foreground truncate">{slot.client}</p>
      {slot.service && <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-1">{slot.service}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-foreground">{slot.duration}</span>
        {slot.start && slot.end && <span className="text-[10px] font-medium text-muted-foreground">{slot.start} – {slot.end}</span>}
      </div>
    </div>
  );
}

// ── Mini Calendar Picker ───────────────────────────────────────────────────────
function CalendarPicker({ value, onChange, onClose }: { value: string; onChange: (d: string) => void; onClose: () => void }) {
  const todayObj = new Date();
  const initial  = value ? new Date(value + 'T00:00:00') : todayObj;
  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName   = new Date(viewYear, viewMonth, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const handleDay = (d: number) => { onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`); onClose(); };

  return (
    <div className="absolute top-full left-0 mt-2 z-50 w-72 rounded-2xl border border-border bg-card shadow-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition"><ChevronLeft className="h-4 w-4" /></button>
        <p className="text-sm font-bold">{monthName}</p>
        <button onClick={nextMonth} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[10px] font-bold text-muted-foreground py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
          const isSel = selectedDate && selectedDate.getFullYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === d;
          const isToday = todayObj.getFullYear() === viewYear && todayObj.getMonth() === viewMonth && todayObj.getDate() === d;
          return (
            <button key={d} onClick={() => handleDay(d)}
              className={cn('h-8 w-8 mx-auto rounded-full text-xs font-semibold transition',
                isSel ? 'bg-primary text-white' : isToday ? 'border border-primary text-primary' : 'hover:bg-muted text-foreground')}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Time slot generation ───────────────────────────────────────────────────────
function generateTimeSlots(grid: ApiGrid): string[] {
  const slots: string[] = [];
  const [sH, sM] = grid.start.split(':').map(Number);
  const [eH, eM] = grid.end.split(':').map(Number);
  for (let m = sH * 60 + sM; m < eH * 60 + eM; m += grid.slot_duration_minutes) {
    const h = Math.floor(m / 60); const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM'; const hd = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`);
  }
  return slots;
}

// ── Build schedule map ─────────────────────────────────────────────────────────
function buildScheduleFromApi(
  therapists: ApiTherapist[], availability: ApiAvailability[], bookings: ApiBooking[],
  timeSlots: string[], slotDurationMinutes: number,
): Record<string, Record<string, Slot>> {
  const sched: Record<string, Record<string, Slot>> = {};
  const slotToMin = (label: string) => {
    const [tp, pd] = label.split(' '); const [hS, mS] = tp.split(':');
    let h = parseInt(hS, 10); const m = parseInt(mS, 10);
    if (pd === 'AM' && h === 12) h = 0; if (pd === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  };
  const availMap: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const av of availability) {
    availMap[av.therapist_id] = av.intervals.map(iv => {
      const s = new Date(iv.start); const e = new Date(iv.end);
      return { startMin: s.getHours() * 60 + s.getMinutes(), endMin: e.getHours() * 60 + e.getMinutes() };
    });
  }
  type BkEntry = { startMin: number; endMin: number; client?: string; service?: string; startLabel: string; endLabel: string; duration: string; reference?: string; status: string };
  const bookingMap: Record<string, BkEntry[]> = {};
  for (const bk of bookings) {
    if (!bookingMap[bk.therapist_id]) bookingMap[bk.therapist_id] = [];
    const s = new Date(bk.start); const e = new Date(bk.end);
    const sm = s.getUTCHours() * 60 + s.getUTCMinutes(); const em = e.getUTCHours() * 60 + e.getUTCMinutes();
    const fmt = (h: number, m: number) => { const ap = h >= 12 ? 'PM' : 'AM'; const hd = h % 12 === 0 ? 12 : h % 12; return `${String(hd).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; };
    const dur = bk.duration_minutes ?? (em - sm);
    bookingMap[bk.therapist_id].push({ startMin: sm, endMin: em, client: bk.customer?.name, service: bk.service?.name, startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()), endLabel: fmt(e.getUTCHours(), e.getUTCMinutes()), duration: `${dur}m`, reference: bk.booking_id ?? bk.id, status: bk.status ?? 'scheduled' });
  }
  for (const therapist of therapists) {
    sched[therapist.id] = {};
    const avIntervals = availMap[therapist.id] ?? [];
    const bkSlots = bookingMap[therapist.id] ?? [];
    for (const slotLabel of timeSlots) {
      const slotStart = slotToMin(slotLabel); const slotEnd = slotStart + slotDurationMinutes;
      const bk = bkSlots.find(b => b.startMin < slotEnd && b.endMin > slotStart);
      if (bk) {
        let st: SlotStatus = 'scheduled';
        if (bk.status === 'in_progress') st = 'in_progress';
        else if (bk.status === 'booking' || bk.status === 'pending') st = 'booking';
        sched[therapist.id][slotLabel] = { status: st, client: bk.client, service: bk.service, start: bk.startLabel, end: bk.endLabel, duration: bk.duration, reference: bk.reference };
        continue;
      }
      sched[therapist.id][slotLabel] = { status: avIntervals.some(av => av.startMin <= slotStart && av.endMin >= slotEnd) ? 'available' : 'unavailable' };
    }
  }
  return sched;
}

function formatDateDisplay(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HomeServiceSchedulePage() {
  const token = useAppSelector((s) => s.auth.token);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [search,       setSearch]       = useState('');
  const [modal,        setModal]        = useState<ModalPayload | null>(null);
  const [bookingForm,  setBookingForm]  = useState<BookingFormPayload | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [scheduleData, setScheduleData] = useState<ApiScheduleRecord | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);
  const onBodyScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/v1/therapists/schedule/?branch_id=home&date=${selectedDate}`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as Record<string,string>).detail ?? `Error ${res.status}`); }
        const data: ApiScheduleRecord[] = await res.json();
        setScheduleData(data?.[0] ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load schedule'); setScheduleData(null);
      } finally { setLoading(false); }
    })();
    return () => controller.abort();
  }, [selectedDate, token, refreshKey]);

  const grid      = scheduleData?.grid ?? { start: '09:00', end: '22:00', slot_duration_minutes: 30 as const };
  const timeSlots = generateTimeSlots(grid);
  const therapists: Therapist[] = (scheduleData?.therapists ?? []).map((t, i) => ({
    id: t.id, name: t.name, initials: getInitials(t.name), photoUrl: t.photo_url,
    color: THERAPIST_COLORS[i % THERAPIST_COLORS.length],
    branchId: t.branch_id ?? '', branchName: t.branch_name ?? '',
  }));
  const schedule = scheduleData ? buildScheduleFromApi(scheduleData.therapists, scheduleData.availability, scheduleData.bookings, timeSlots, grid.slot_duration_minutes) : {};
  const filteredTherapists = search ? therapists.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : therapists;

  const allSlots    = therapists.flatMap(t => Object.values(schedule[t.id] ?? {}));
  const bookedCount = allSlots.filter(s => s.status !== 'unavailable' && s.status !== 'available').length;
  const availCount  = allSlots.filter(s => s.status === 'available').length;
  const occupancy   = Math.round((bookedCount / (bookedCount + availCount)) * 100) || 0;
  const dateDisplay = formatDateDisplay(selectedDate);

  const openModal = useCallback((slot: Slot, therapist: Therapist, timeSlot: string) => {
    setModal({ slot, therapist, timeSlot, date: dateDisplay });
  }, [dateDisplay]);

  const openBookingForm = useCallback((therapist: Therapist, timeSlot: string) => {
    setBookingForm({ therapist, timeSlot, date: selectedDate, dateDisplay, slotIsoStart: timeSlotToIso(selectedDate, timeSlot) });
  }, [selectedDate, dateDisplay]);

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Home Service Schedule</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live session board · <span className="font-semibold text-foreground">{dateDisplay}</span>
          {' '}· <span className="font-semibold text-foreground">Home Service</span>
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-950/20 px-4 text-sm font-semibold text-sky-700 dark:text-sky-400 shadow-sm">
          <Home className="h-4 w-4" /><span>Home Service</span>
        </div>
        <div className="relative">
          <button onClick={() => setShowCalendar(d => !d)}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />{dateDisplay}<ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          </button>
          {showCalendar && (
            <><div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
              <CalendarPicker value={selectedDate} onChange={d => setSelectedDate(d)} onClose={() => setShowCalendar(false)} /></>
          )}
        </div>
        <div className="flex-1" />
        <div className="relative min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search therapist or client…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm hover:bg-primary/90 transition"><Plus className="h-5 w-5" /></button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Daily Occupancy',   value: `${occupancy}%`,           sub: 'booked slots',     icon: <CheckCircle2 className="h-5 w-5" />, grad: 'from-primary to-accent',       bg: 'bg-rose-50 dark:bg-rose-950/30',     border: 'border-rose-200/80 dark:border-rose-800/40' },
          { label: 'Active Therapists', value: String(therapists.length), sub: 'on duty today',    icon: <AlertCircle className="h-5 w-5" />,  grad: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200/80 dark:border-violet-800/40' },
          { label: 'Total Bookings',    value: String(bookedCount),       sub: 'slots scheduled',  icon: <CalendarDays className="h-5 w-5" />, grad: 'from-rose-500 to-pink-600',     bg: 'bg-pink-50 dark:bg-pink-950/30',     border: 'border-pink-200/80 dark:border-pink-800/40' },
          { label: 'Available Slots',   value: String(availCount),        sub: 'open for booking', icon: <Home className="h-5 w-5" />,         grad: 'from-sky-500 to-blue-600',      bg: 'bg-sky-50 dark:bg-sky-950/30',       border: 'border-sky-200/80 dark:border-sky-800/40' },
        ].map((k) => (
          <div key={k.label} className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5', k.bg, k.border)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight">{k.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
              </div>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', k.grad)}>{k.icon}</div>
            </div>
            <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10', k.grad)} />
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading schedule…</span>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-end gap-4 border-b border-border/40 px-4 py-3 bg-muted/20 rounded-t-2xl overflow-hidden">
            {[
              { label: 'In Progress', color: 'bg-emerald-500' },
              { label: 'Booking',     color: 'bg-blue-500' },
              { label: 'Scheduled',   color: 'bg-violet-500' },
              { label: 'Available',   color: 'bg-sky-400 border border-dashed border-sky-300' },
              { label: 'Unavailable', color: 'bg-muted/80' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 rounded-full', l.color)} />{l.label}
              </span>
            ))}
          </div>

          {filteredTherapists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                {search ? 'No therapists match your search' : 'No home-service therapists scheduled for this date'}
              </p>
            </div>
          ) : (
            <>
              <div className="sticky top-16 z-20 flex border-b-2 border-border/60 bg-card/95 backdrop-blur-md shadow-sm">
                <div className="w-28 shrink-0 flex items-center pl-4 py-3 font-bold text-xs text-muted-foreground uppercase tracking-wider border-r border-border/30 bg-card/95">Time</div>
                <div ref={headerScrollRef} className="flex-1 overflow-x-hidden">
                  <div style={{ width: `${filteredTherapists.length * 175}px`, minWidth: '100%' }} className="flex">
                    {filteredTherapists.map((t, tIdx) => (
                      <div key={t.id} style={{ width: 175, minWidth: 175 }} className={cn('flex flex-col items-center py-4 border-l border-border/30 first:border-l-0 px-2', COL_TINTS[tIdx % COL_TINTS.length])}>
                        <div className="relative flex items-center justify-center p-1 rounded-full bg-gradient-to-b from-card to-muted/70 shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-border/50">
                          <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-background shrink-0">
                            {t.photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.photoUrl} alt={t.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            )}
                            <div className={cn('absolute inset-0 grid place-items-center text-white text-xs font-bold bg-gradient-to-br -z-10', t.color)}>{t.initials}</div>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground text-center truncate max-w-[130px]">{t.name}</p>
                        <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 mt-0.5">{dateDisplay}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex rounded-b-2xl">
                <div className="w-28 shrink-0 flex flex-col border-r border-border/30 bg-muted/10">
                  {timeSlots.map((time) => (
                    <div key={`tcol-${time}`} className="flex flex-col justify-center pl-4 py-2.5 border-t border-border/30" style={{ height: 98 }}>
                      <p className="text-xs font-bold text-foreground">{time}</p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{grid.slot_duration_minutes} min slots</p>
                    </div>
                  ))}
                </div>
                <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-x-auto">
                  <div style={{ width: `${filteredTherapists.length * 175}px`, minWidth: '100%', display: 'grid', gridTemplateColumns: `repeat(${filteredTherapists.length}, 175px)`, gridTemplateRows: `repeat(${timeSlots.length}, 98px)` }}>
                    {filteredTherapists.map((t, tIdx) => {
                      const cells: React.ReactNode[] = [];
                      let rowIdx = 0;
                      while (rowIdx < timeSlots.length) {
                        const time = timeSlots[rowIdx];
                        const slot = schedule[t.id]?.[time] ?? { status: 'unavailable' as SlotStatus };
                        const isBooked = slot.status === 'booking' || slot.status === 'scheduled' || slot.status === 'in_progress';
                        let span = 1;
                        if (isBooked && slot.reference) {
                          while (rowIdx + span < timeSlots.length) {
                            const ns = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (ns && (ns.status === 'booking' || ns.status === 'scheduled' || ns.status === 'in_progress') && ns.reference === slot.reference) { span++; } else break;
                          }
                        } else if (isBooked && slot.start && slot.end) {
                          while (rowIdx + span < timeSlots.length) {
                            const ns = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (ns && (ns.status === 'booking' || ns.status === 'scheduled' || ns.status === 'in_progress') && ns.start === slot.start && ns.end === slot.end) { span++; } else break;
                          }
                        }
                        const capturedTime = time;
                        cells.push(
                          <div key={`${t.id}-${time}`}
                            style={{ gridColumn: tIdx + 1, gridRow: span > 1 ? `${rowIdx + 1} / span ${span}` : rowIdx + 1 }}
                            className={cn('p-2 border-t border-l border-border/30 transition-colors first:border-l-0', COL_TINTS[tIdx % COL_TINTS.length])}>
                            <SlotCell slot={slot}
                              onClick={isBooked ? () => openModal(slot, t, capturedTime) : slot.status === 'available' ? () => openBookingForm(t, capturedTime) : undefined} />
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

      {modal && <SlotDetailModal payload={modal} onClose={() => setModal(null)} />}
      {bookingForm && (
        <BookingFormModal
          payload={bookingForm}
          token={token}
          onClose={() => setBookingForm(null)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </DashboardShell>
  );
}
