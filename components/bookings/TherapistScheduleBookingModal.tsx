'use client';
// Dedicated booking popup for the Therapist Schedule page.
// Title: "New Therapist Schedule Booking" — Ush Spa company brand theme.
// Therapist is pre-selected from the clicked slot (editable if needed).

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, AlertCircle, X,
  Timer, Loader2, Scissors, Package, User, Phone, Mail,
  DollarSign, FileText, ChevronLeft, ChevronRight, CalendarCheck,
  LayoutGrid, Crown, Heart, Sparkles, Layers, Store, UserPlus,
  CreditCard, Hash, Fingerprint, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateCustomerModal, type CreatedCustomer } from './CreateCustomerModal';
import { authedFetch } from '@/lib/authedFetch';

// ── Types ──────────────────────────────────────────────────────────────────────

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

const ARRANGEMENT_CFG: Record<string, {
  label: string;
  Icon: React.ElementType;
  gradient: string;
  iconColor: string;
}> = {
  open_area:     { label: 'Open Area',     Icon: LayoutGrid, gradient: 'from-sky-400    via-cyan-500   to-blue-600',   iconColor: 'text-sky-200' },
  vip_suite:     { label: 'VIP Suite',     Icon: Crown,      gradient: 'from-amber-400  via-yellow-500 to-orange-600', iconColor: 'text-amber-200' },
  couple_room:   { label: 'Couple Room',   Icon: Heart,      gradient: 'from-rose-400   via-pink-500   to-fuchsia-600',iconColor: 'text-rose-200' },
  single_room:   { label: 'Single Room',   Icon: Sparkles,   gradient: 'from-violet-400 via-purple-500  to-indigo-600', iconColor: 'text-violet-200' },
  private_suite: { label: 'Private Suite', Icon: Layers,     gradient: 'from-teal-400   via-emerald-500 to-green-600', iconColor: 'text-teal-200' },
  other:         { label: 'Arrangement',   Icon: Store,      gradient: 'from-slate-400  via-gray-500   to-zinc-600',   iconColor: 'text-slate-200' },
};
function getArrCfg(type?: string) { return ARRANGEMENT_CFG[type ?? 'other'] ?? ARRANGEMENT_CFG.other; }

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

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TherapistScheduleBookingProps {
  token: string;
  timeSlot: string;
  date: string;
  branchId: string;
  branchName: string;
  therapistId: string;
  therapistName: string;
  therapistPhoto?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return '0.000';
  const n = parseFloat(String(v));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

function toHHMM(slot: string): string {
  const parts = slot.trim().split(' ');
  const [hStr, mStr] = parts[0].split(':');
  const ampm = parts[1] ?? '';
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

interface DropProps<T> {
  value: string;
  placeholder: string;
  loading?: boolean;
  items: T[];
  getKey?: (item: T, index?: number) => string | number;
  isSelected: (item: T) => boolean;
  selectedItem?: T | null;
  icon?: React.ElementType;
  onSearch: (q: string) => void;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderItem: (item: T) => React.ReactNode;
}

function SearchDrop<T>({
  value, placeholder, loading, items, getKey, isSelected, selectedItem,
  icon: Icon, onSearch, onSelect, onClear, renderItem,
}: DropProps<T>) {
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
          onFocus={() => { if (!sel) setOpen(true); }}
          placeholder={sel ? (value || '— selected —') : placeholder}
          readOnly={sel}
          className={cn(
            'h-10 w-full rounded-xl border border-border bg-muted/30 pr-8 text-sm outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50',
            Icon ? 'pl-9' : 'pl-3',
            sel ? 'font-medium text-foreground cursor-default bg-emerald-500/5 border-emerald-500/30' : '',
          )}
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {sel && (
          <button type="button" onClick={onClear}
            className="absolute right-2.5 grid h-5 w-5 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && !sel && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">
              {loading ? 'Loading…' : 'No results'}
            </p>
          ) : (
            (() => {
              const seenKeys = new Set<string>();
              return items.map((item, idx) => {
                const keyCandidate = getKey ? getKey(item, idx) : undefined;
                const rawKey = keyCandidate ?? (item as Record<string, unknown>)?.id ?? (item as Record<string, unknown>)?.pk ?? (item as Record<string, unknown>)?.uuid;
                let itemKey = (rawKey != null && rawKey !== '') ? String(rawKey) : `item-${idx}`;
                if (seenKeys.has(itemKey)) {
                  itemKey = `${itemKey}-${idx}`;
                }
                seenKeys.add(itemKey);
                return (
                  <div
                    key={itemKey}
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

type Step = 1 | 2 | 3 | 4;

interface PaymentForm {
  invoice_id: string;
  transaction_date: string;
  total_amount: string;
  trace_id: string;
  reference_id: string;
  received_by: string;
}

interface Form {
  serviceId: string;
  serviceSearch: string;
  therapistId: string;
  therapistSearch: string;
  customerId: string;
  customerSearch: string;
  addonIds: string[];           // service add-ons
  arrangementAddonIds: string[];// arrangement-specific add-ons
  extraMinutes: number;
  notes: string;
  arrangementId: string;
  arrangementName: string;
  arrangementType: string;
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function TherapistScheduleBookingModal({
  token, timeSlot, date, branchId, branchName,
  therapistId, therapistName, therapistPhoto,
  onClose, onSuccess,
}: TherapistScheduleBookingProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>({
    serviceId: '', serviceSearch: '',
    therapistId, therapistSearch: therapistName,
    customerId: '', customerSearch: '',
    addonIds: [], arrangementAddonIds: [], extraMinutes: 0, notes: '',
    arrangementId: '', arrangementName: '', arrangementType: '',
  });
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'completed' | 'on_branch'>('completed');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult,          setBookingResult]          = useState<Record<string, any> | null>(null);
  const [bookingId,              setBookingId]              = useState('');
  const [confirmingPayment,      setConfirmingPayment]      = useState(false);
  const [confirmPaymentError,    setConfirmPaymentError]    = useState<string | null>(null);
  const [confirmPaymentSuccess,  setConfirmPaymentSuccess]  = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    invoice_id: '', transaction_date: '', total_amount: '',
    trace_id: '', reference_id: '', received_by: '',
  });

  const [snapTherapistName, setSnapTherapistName] = useState('');
  const [snapTherapistImg,  setSnapTherapistImg]  = useState('');
  const [snapCustomerName,  setSnapCustomerName]  = useState('');
  const [snapCustomerImg,   setSnapCustomerImg]   = useState('');
  const [snapCustomerPhone, setSnapCustomerPhone] = useState('');

  const [services,              setServices]              = useState<ApiService[]>([]);
  const [servicesLoading,       setServicesLoading]       = useState(false);
  const [arrangements,          setArrangements]          = useState<ApiArrangement[]>([]);
  const [arrangementsLoading,   setArrangementsLoading]   = useState(false);
  const [arrangementAddons,     setArrangementAddons]     = useState<ApiAddOn[]>([]);
  const [arrAddonsLoading,      setArrAddonsLoading]      = useState(false);
  const [therapists,            setTherapists]            = useState<ApiTherapist[]>([]);
  const [therapistsLoading,     setTherapistsLoading]     = useState(false);
  const [customers,             setCustomers]             = useState<ApiCustomer[]>([]);
  const [customersLoading,      setCustomersLoading]      = useState(false);
  const [customerQuery,         setCustomerQuery]         = useState('');
  const [showCreateCustomer,    setShowCreateCustomer]    = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Load therapist-specific services
  useEffect(() => {
    setServicesLoading(true);
    authedFetch(`/api/v1/therapists/${therapistId}/services/`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setServices(list); })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [therapistId, authHeader]);

  // Load arrangements when a service is selected
  useEffect(() => {
    if (!form.serviceId || !branchId) { setArrangements([]); return; }
    setArrangementsLoading(true);
    const qs = new URLSearchParams({ branch_id: branchId });
    // Reset arrangement + arrangement addons when service changes
    setForm(p => ({ ...p, arrangementId: '', arrangementName: '', arrangementType: '', arrangementAddonIds: [] }));
    setArrangementAddons([]);
    authedFetch(`/api/v1/services/${form.serviceId}/arrangements/?${qs}`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => {
        const list: ApiArrangement[] = (Array.isArray(d) ? d : (d.data ?? d.results ?? [])).filter((a: ApiArrangement) => a.is_active !== false);
        setArrangements(list);
        // Auto-select the first arrangement
        if (list.length > 0) {
          const first = list[0];
          setForm(p => ({
            ...p,
            arrangementId:   first.id,
            arrangementName: first.name,
            arrangementType: first.arrangement_type ?? '',
          }));
        }
      })
      .catch(() => setArrangements([]))
      .finally(() => setArrangementsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serviceId, branchId, authHeader]);

  // Load arrangement add-ons when an arrangement is selected
  useEffect(() => {
    if (!form.arrangementId) { setArrangementAddons([]); return; }
    setArrAddonsLoading(true);
    authedFetch(`/api/v1/service-arrangements/${form.arrangementId}/addons/`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setArrangementAddons(list); })
      .catch(() => setArrangementAddons([]))
      .finally(() => setArrAddonsLoading(false));
    // Clear arrangement addon selections when arrangement changes
    setForm(p => ({ ...p, arrangementAddonIds: [] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.arrangementId, authHeader]);

  // Derived pricing (need before therapist effect for duration)
  const selectedService   = useMemo(() => services.find(s => s.id === form.serviceId) ?? null, [services, form.serviceId]);
  const selectedTherapist = useMemo(() => therapists.find(t => t.id === form.therapistId) ?? null, [therapists, form.therapistId]);
  const selectedCustomer  = useMemo(() => {
    if (!form.customerId) return null;
    return customers.find(c => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === String(form.customerId)) ?? null;
  }, [customers, form.customerId]);

  const filteredServices   = useMemo(() =>
    form.serviceSearch ? services.filter(s => s.name.toLowerCase().includes(form.serviceSearch.toLowerCase())) : services,
    [services, form.serviceSearch]);

  const filteredTherapists = useMemo(() =>
    form.therapistSearch ? therapists.filter(t => {
      const name = (t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')).toLowerCase();
      return name.includes(form.therapistSearch.toLowerCase());
    }) : therapists,
    [therapists, form.therapistSearch]);

  const serviceAddons     = selectedService?.add_ons ?? [];
  // Pricing: if an arrangement is selected and has arrangement_price, use it; otherwise fall back to service price
  const selectedArrangement = useMemo(
    () => arrangements.find(a => a.id === form.arrangementId) ?? null,
    [arrangements, form.arrangementId],
  );
  const arrPrice = selectedArrangement?.arrangement_price != null
    ? parseFloat(String(selectedArrangement.arrangement_price)) || 0
    : null;
  const servicePrice = arrPrice !== null
    ? arrPrice
    : (parseFloat(String(selectedService?.arrangement_price ?? selectedService?.base_price ?? '0')) || 0);
  // Merge service add-ons + arrangement add-ons into one total
  const selectedAddons         = serviceAddons.filter(a => form.addonIds.includes(a.id));
  const selectedArrAddons      = arrangementAddons.filter(a => form.arrangementAddonIds.includes(a.id));
  const allSelectedAddons      = [...selectedAddons, ...selectedArrAddons];
  const addonTotal             = allSelectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonDuration          = allSelectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
  const extraMinutesUnit  = selectedService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(selectedService?.price_for_extra_minutes ?? '0')) || 0;
  const baseDuration      = selectedService?.duration_minutes ?? 60;

  // 3 options for Extra Time: None (0 min), 30 min, 60 min. Price based on service.
  const calcExtraPrice = (mins: number) => {
    if (mins <= 0) return 0;
    if (extraPricePerUnit > 0 && extraMinutesUnit > 0) {
      return (mins / extraMinutesUnit) * extraPricePerUnit;
    }
    if (extraPricePerUnit > 0) {
      return (mins / 30) * extraPricePerUnit;
    }
    const effPrice = servicePrice > 0 ? servicePrice : (parseFloat(String(selectedService?.base_price ?? '0')) || 0);
    const effDur   = baseDuration > 0 ? baseDuration : 60;
    return (effPrice / effDur) * mins;
  };

  const extraMinutesPrice = calcExtraPrice(form.extraMinutes);
  const totalPrice        = servicePrice + addonTotal + extraMinutesPrice;
  const totalDuration     = (selectedService ? baseDuration : 0) + addonDuration + form.extraMinutes;
  const hasExtraTime      = !!selectedService;
  const extraOptions      = [0, 30, 60] as const;

  // Load therapists on step 2
  useEffect(() => {
    if (step !== 2 || !form.serviceId) { setTherapists([]); return; }
    setTherapistsLoading(true);
    const qs = new URLSearchParams({
      branch_id:              branchId,
      no_service_list:        'true',
      check_for_availability: 'true',
      date,
      appointment_start:      toHHMM(timeSlot),
      duration:               String(totalDuration > 0 ? totalDuration : (selectedService?.duration_minutes ?? 60)),
    });
    authedFetch(`/api/v1/services/${form.serviceId}/therapists?${qs}`, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => {
        const list: ApiTherapist[] = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        // Always ensure the pre-selected therapist appears in the list
        const exists = list.some(t => t.id === therapistId);
        if (!exists) {
          const presel: ApiTherapist = { id: therapistId, full_name: therapistName, avatar: therapistPhoto ?? undefined };
          setTherapists([presel, ...list]);
        } else {
          setTherapists(list);
        }
      })
      .catch(() => setTherapists([]))
      .finally(() => setTherapistsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.serviceId, authHeader]);

  // Customer search
  useEffect(() => {
    setCustomersLoading(true);
    const t = setTimeout(() => {
      const qs = customerQuery ? `search=${encodeURIComponent(customerQuery)}` : '';
      authedFetch(`/api/v1/customers${qs ? '?' + qs : ''}`, { headers: authHeader ? { Authorization: authHeader } : undefined })
        .then(r => r.json())
        .then(d => {
          const rawList = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
          const list = rawList.map((item: any, idx: number) => ({
            ...item,
            id: String(item.id ?? item.customer_id ?? item.pk ?? item.uuid ?? `cust-${idx}`),
          }));
          setCustomers(prev => {
            if (form.customerId) {
              const currentSelected = prev.find(c => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === String(form.customerId));
              if (currentSelected && !list.some((c: any) => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === String(form.customerId))) {
                return [currentSelected, ...list];
              }
            }
            return list;
          });
        })
        .catch(() => setCustomers([]))
        .finally(() => setCustomersLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, authHeader, form.customerId]);

  const selectService   = (s: ApiService) =>
    setForm(p => ({ ...p, serviceId: s.id, serviceSearch: s.name, addonIds: [], arrangementAddonIds: [], extraMinutes: 0, arrangementId: '', arrangementName: '', arrangementType: '' }));
  const clearService    = () =>
    setForm(p => ({ ...p, serviceId: '', serviceSearch: '', addonIds: [], arrangementAddonIds: [], extraMinutes: 0, arrangementId: '', arrangementName: '', arrangementType: '' }));
  const selectTherapist = (t: ApiTherapist) => {
    const name = t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
    setForm(p => ({ ...p, therapistId: t.id, therapistSearch: name }));
  };
  const clearTherapist  = () => setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));
  const selectCustomer  = (c: ApiCustomer) => {
    const id = String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? (c as any).uuid ?? '');
    const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || c.email || '';
    const label = [name, c.phone_number].filter(Boolean).join(' · ') || name;
    setForm(p => ({ ...p, customerId: id, customerSearch: label }));
    setSubmitError(null);
  };
  const clearCustomer   = () => {
    setForm(p => ({ ...p, customerId: '', customerSearch: '' }));
    setCustomerQuery('');
  };
  const handleCustomerCreated = (created: CreatedCustomer) => {
    const id = String(created.id);
    const fullName = created.full_name || [created.first_name, created.last_name].filter(Boolean).join(' ');
    const asApiCustomer: ApiCustomer = {
      id,
      first_name:   created.first_name ?? '',
      last_name:    created.last_name  ?? '',
      full_name:    fullName,
      phone_number: created.phone_number,
      email:        created.email,
      avatar:       created.avatar,
    };
    setCustomers(prev => [asApiCustomer, ...prev.filter(c => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') !== id)]);
    selectCustomer(asApiCustomer);
  };
  const toggleAddon     = (id: string) =>
    setForm(p => ({ ...p, addonIds: p.addonIds.includes(id) ? p.addonIds.filter(x => x !== id) : [...p.addonIds, id] }));
  const toggleArrAddon  = (id: string) =>
    setForm(p => ({ ...p, arrangementAddonIds: p.arrangementAddonIds.includes(id) ? p.arrangementAddonIds.filter(x => x !== id) : [...p.arrangementAddonIds, id] }));

  const goNext = () => {
    if (!form.serviceId) { setSubmitError('Please select a service.'); return; }
    setSubmitError(null); setStep(2);
  };
  const goBack = () => { setSubmitError(null); setStep(1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setSubmitError('Please select a customer.'); return; }
    setSubmitting(true); setSubmitError(null);

    const svc             = selectedService!;
    const baseP           = parseFloat(String(svc.arrangement_price ?? svc.base_price ?? '0')) || 0;
    const timeHHMM        = toHHMM(timeSlot);
    const dateObj         = new Date(date + 'T00:00:00');
    const formattedDate   = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const activeThId      = form.therapistId || therapistId;
    const activeThName    = form.therapistSearch || therapistName;
    const customerName    = selectedCustomer
      ? ((selectedCustomer.full_name ?? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || 'Customer')
      : null;

    const activeThDisplayImg = selectedTherapist?.avatar ?? selectedTherapist?.photo_url ?? therapistPhoto ?? null;
    const activeThSpec        = selectedTherapist?.specialties?.[0]?.name ?? selectedTherapist?.specialization ?? '';

    // Arrangement effective price (overrides service base when set)
    const arrangementP = form.arrangementId && selectedArrangement?.arrangement_price != null
      ? parseFloat(String(selectedArrangement.arrangement_price)) || 0
      : null;
    const effectiveBaseP = arrangementP !== null ? arrangementP : baseP;

    // Display time (e.g. "1:00 PM")
    const [hh, mm]   = timeHHMM.split(':').map(Number);
    const ampm       = hh >= 12 ? 'PM' : 'AM';
    const displayH   = hh % 12 || 12;
    const displayTime = `${displayH}:${String(mm).padStart(2, '0')} ${ampm}`;

    const body = {
      // ── Service ─────────────────────────────────────────────────────────────
      service_id:       svc.id,
      service_name:     svc.name,
      service_category: svc.category ?? '',
      base_price:       fmt(svc.base_price),
      baseDuration,
      service_data: {
        service_id:       svc.id,
        service_name:     svc.name,
        service_category: svc.category ?? '',
        base_price:       fmt(svc.base_price),
        arrangement_price: fmt(svc.arrangement_price ?? svc.base_price),
        duration_minutes: svc.duration_minutes ?? baseDuration,
      },
      // ── Branch ──────────────────────────────────────────────────────────────
      branch_id: branchId,
      branch_data: {
        branch_id:      branchId,
        branch_name:    branchName,
        branch_address: branchName,
      },
      // ── Arrangement ─────────────────────────────────────────────────────────
      ...(form.arrangementId ? {
        service_arrangement_id: form.arrangementId,
        service_arrangement_data: {
          arrangement_id:   form.arrangementId,
          arrangement_name: form.arrangementName,
          arrangement_type: form.arrangementType,
          ...(selectedArrangement?.capacity ? { capacity: selectedArrangement.capacity } : {}),
          ...(selectedArrangement?.arrangement_price != null
            ? { arrangement_price: fmt(selectedArrangement.arrangement_price) }
            : {}),
        },
      } : {}),
      // ── Therapist ───────────────────────────────────────────────────────────
      therapist_id: activeThId || null,
      therapist_data: activeThName ? {
        therapist_id:    activeThId || null,
        therapist_name:  activeThName,
        ...(activeThDisplayImg ? { photo_url: activeThDisplayImg } : {}),
        ...(activeThSpec        ? { specialization: activeThSpec }  : {}),
      } : null,
      // ── Add-ons ─────────────────────────────────────────────────────────────
      selected_addons: allSelectedAddons.map(a => ({
        id: a.id, name: a.name,
        description: (a as unknown as Record<string, string>).description ?? '',
        price: fmt(a.price), currency: 'KWD', is_active: true,
      })),
      addons_duration: addonDuration,
      extra_minutes:   form.extraMinutes,
      extra_price:     fmt(extraMinutesPrice),
      // ── DateTime ────────────────────────────────────────────────────────────
      date, formattedDate,
      time_slot:   timeHHMM,
      displayTime,
      // ── Customer ────────────────────────────────────────────────────────────
      customer_id: form.customerId || '',
      customer_data: customerName ? {
        customer_id:   form.customerId,
        customer_name: customerName,
        phone_number:  selectedCustomer?.phone_number ?? null,
        email:         selectedCustomer?.email ?? null,
        ...(selectedCustomer?.avatar ? { avatar: selectedCustomer.avatar } : {}),
      } : null,
      customerMessage: '', customer_notes: form.notes,
      // ── Booking meta ────────────────────────────────────────────────────────
      booking_type: 'branch_service',
      pricing_details: {
        base:              fmt(baseP),
        base_price:        fmt(baseP),
        arrangement:       fmt(effectiveBaseP),
        arrangement_price: fmt(effectiveBaseP),
        addons:            fmt(addonTotal),
        addons_price:      fmt(addonTotal),
        extratime:         fmt(extraMinutesPrice),
        extra_time:        fmt(extraMinutesPrice),
        extra_time_price:  fmt(extraMinutesPrice),
        subtotal:          fmt(totalPrice),
        total:             fmt(totalPrice),
        total_price:       fmt(totalPrice),
        currency: 'KWD',
      },
      total_price:    fmt(totalPrice),
      total_duration: totalDuration,
      currency: 'KWD',
      status:         paymentMethod === 'on_branch' ? 'payment_pending' : 'confirmed',
      payment_status: paymentMethod === 'completed' ? 'success' : 'pending',
      source:         'ushdesk',
    };

    try {
      const res  = await authedFetch('/booknpay/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body:   JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errObj = json as Record<string, unknown>;
        console.error('[TherapistScheduleBooking] POST failed', res.status, errObj);
        const errField = errObj.error;
        const nestedMsg = (errField && typeof errField === 'object')
          ? ((errField as Record<string, unknown>).message ?? (errField as Record<string, unknown>).detail)
          : (typeof errField === 'string' ? errField : null);
        let msg = (errObj.detail ?? errObj.message ?? nestedMsg ?? errObj.non_field_errors);
        if (!msg) {
          if (res.status === 401) {
            msg = 'Authentication failed (401). Your session may have expired. Please log in again.';
          } else {
            msg = Object.keys(errObj).length > 0 ? JSON.stringify(errObj) : `Booking failed with status ${res.status}`;
          }
        }
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      const result = (json as Record<string, unknown>).data ?? json;
      const raw    = result as Record<string, unknown>;
      const rid    = String(raw.id ?? raw.booking_id ?? raw.bookings_id ?? raw.pk ?? '')
        .replace('undefined', '').replace('null', '');

      const tSnap     = selectedTherapist;
      const cSnap     = selectedCustomer;
      const tNameSnap = tSnap
        ? ((tSnap.full_name ?? [tSnap.first_name, tSnap.last_name].filter(Boolean).join(' ')) || activeThName)
        : activeThName;
      const cNameSnap = cSnap
        ? ((cSnap.full_name ?? [cSnap.first_name, cSnap.last_name].filter(Boolean).join(' ')) || 'Customer')
        : '';

      setSnapTherapistName(tNameSnap);
      setSnapTherapistImg(tSnap?.avatar ?? tSnap?.photo_url ?? therapistPhoto ?? '');
      setSnapCustomerName(cNameSnap);
      setSnapCustomerImg(cSnap?.avatar ?? '');
      setSnapCustomerPhone(cSnap?.phone_number ?? '');
      setBookingResult(raw);
      setBookingId(rid);
      // Close modal and trigger schedule reload immediately after booking success
      onSuccess?.();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    const raw = bookingResult as Record<string, unknown> | null;
    const id  = bookingId ||
      String(raw?.id ?? raw?.booking_id ?? raw?.bookings_id ?? raw?.pk ?? '')
        .replace('undefined', '').replace('null', '');
    if (!id) { setConfirmPaymentError('Booking ID not found. Cannot confirm payment.'); return; }
    setConfirmingPayment(true); setConfirmPaymentError(null);
    try {
      // ── 1. PATCH booking status → confirmed ──────────────────────────────────
      const statusPayload = {
        status:         'confirmed',
        payment_status: 'success',
        reason:         'Payment Success',
        source:         'ushdesk',
        payments_data: {
          is_paid:          true,
          invoice_id:       paymentForm.invoice_id,
          status:           'Paid',
          reference_id:     paymentForm.reference_id,
          invoice_value:    paymentForm.total_amount,
          transaction_date: paymentForm.transaction_date,
          payment_gateway:  'KNET',
          trace_id:         paymentForm.trace_id,
          received_by:      paymentForm.received_by,
        },
      };
      const statusRes = await authedFetch(`/booknpay/api/v1/bookings/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(statusPayload),
      });
      const statusJson = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) {
        const errObj = statusJson as Record<string, unknown>;
        const errField = errObj.error;
        const nestedMsg = (errField && typeof errField === 'object')
          ? ((errField as Record<string, unknown>).message ?? (errField as Record<string, unknown>).detail)
          : (typeof errField === 'string' ? errField : null);
        const msg = (errObj.detail ?? errObj.message ?? nestedMsg ?? `Error ${statusRes.status}`);
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      // ── 2. POST payment record ────────────────────────────────────────────────
      // Resolve fields from bookingResult + component state
      const activeThId   = form.therapistId || therapistId;
      const activeThName = form.therapistSearch || therapistName;
      const customerName = selectedCustomer
        ? ((selectedCustomer.full_name ?? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || 'Customer')
        : snapCustomerName || '';

      const timeHHMM = (() => {
        const parts = timeSlot.trim().split(' ');
        const [hStr, mStr] = parts[0].split(':');
        const ampm = parts[1] ?? '';
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (ampm === 'AM' && h === 12) h = 0;
        if (ampm === 'PM' && h !== 12) h += 12;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      })();

      const paymentRecord = {
        // ── Booking reference ──────────────────────────────────────────────────
        booking_id:   id,
        booking_data: raw ?? {},
        booking_type: 'branch_service',
        source:       'ushdesk',

        // ── KNET transaction (from payment form) ──────────────────────────────
        invoice_id:       paymentForm.invoice_id,
        reference_id:     paymentForm.reference_id,
        trace_id:         paymentForm.trace_id,
        transaction_date: paymentForm.transaction_date,
        total_amount:     parseFloat(paymentForm.total_amount) || totalPrice,
        invoice_value:    paymentForm.total_amount,
        received_by:      paymentForm.received_by,
        payment_gateway:  'KNET',
        payment_status:   'success',
        is_paid:          true,
        status:           'Paid',
        payment_through:  'desk',
        provider:         'directlink',
        currency:         'KWD',

        // ── Service ────────────────────────────────────────────────────────────
        service_id:   selectedService?.id ?? (raw?.service_id as string) ?? '',
        service_name: selectedService?.name ?? (raw?.service_name as string) ?? '',
        service_data: {
          service_id:        selectedService?.id ?? '',
          service_name:      selectedService?.name ?? '',
          service_category:  selectedService?.category ?? '',
          base_price:        fmt(selectedService?.base_price),
          arrangement_price: fmt(selectedService?.arrangement_price ?? selectedService?.base_price),
          duration_minutes:  selectedService?.duration_minutes ?? baseDuration,
        },

        // ── Branch ─────────────────────────────────────────────────────────────
        branch_id:   branchId,
        branch_name: branchName,
        branch_data: {
          branch_id:   branchId,
          branch_name: branchName,
        },

        // ── Arrangement ────────────────────────────────────────────────────────
        ...(form.arrangementId ? {
          service_arrangement_id: form.arrangementId,
          service_arrangement_data: {
            arrangement_id:    form.arrangementId,
            arrangement_name:  form.arrangementName,
            arrangement_type:  form.arrangementType,
            ...(selectedArrangement?.arrangement_price != null
              ? { arrangement_price: fmt(selectedArrangement.arrangement_price) }
              : {}),
          },
        } : {}),

        // ── Therapist ──────────────────────────────────────────────────────────
        therapist_id:   activeThId || null,
        therapist_name: activeThName,
        therapist_data: activeThName ? {
          therapist_id:   activeThId || null,
          therapist_name: activeThName,
          ...(selectedTherapist?.avatar ?? selectedTherapist?.photo_url ?? therapistPhoto
            ? { photo_url: selectedTherapist?.avatar ?? selectedTherapist?.photo_url ?? therapistPhoto }
            : {}),
          ...(selectedTherapist?.specialties?.[0]?.name ?? selectedTherapist?.specialization
            ? { specialization: selectedTherapist?.specialties?.[0]?.name ?? selectedTherapist?.specialization }
            : {}),
        } : null,

        // ── Customer ───────────────────────────────────────────────────────────
        customer_id:   form.customerId || (raw?.customer_id as string) || '',
        customer_name: customerName,
        customer_data: customerName ? {
          customer_id:   form.customerId,
          customer_name: customerName,
          phone_number:  selectedCustomer?.phone_number ?? snapCustomerPhone ?? null,
          email:         selectedCustomer?.email ?? null,
        } : null,

        // ── Add-ons ────────────────────────────────────────────────────────────
        selected_addons: allSelectedAddons.map(a => ({
          id:       a.id,
          name:     a.name,
          price:    fmt(a.price),
          currency: 'KWD',
          duration: a.duration_minutes ?? 0,
        })),
        addons_total:    fmt(addonTotal),
        addons_duration: addonDuration,

        // ── Extra time ─────────────────────────────────────────────────────────
        extra_minutes: form.extraMinutes,
        extra_price:   fmt(extraMinutesPrice),

        // ── Appointment date/time ──────────────────────────────────────────────
        date,
        time_slot:    timeHHMM,
        display_time: timeSlot,

        // ── Pricing summary ────────────────────────────────────────────────────
        pricing_details: {
          base_price:        fmt(servicePrice),
          arrangement_price: fmt(servicePrice),
          addons_price:      fmt(addonTotal),
          extra_time_price:  fmt(extraMinutesPrice),
          subtotal:          fmt(totalPrice),
          total:             fmt(totalPrice),
          total_price:       fmt(totalPrice),
          currency:          'KWD',
        },
        total_price:    fmt(totalPrice),
        total_duration: totalDuration,
      };

      // Fire the payment record creation — errors are non-fatal (booking already confirmed)
      try {
        const payRes = await authedFetch('/booknpay/api/v1/payments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(paymentRecord),
        });
        const payJson = await payRes.json().catch(() => ({}));
        if (!payRes.ok) {
          console.warn('[TherapistScheduleBooking] Payment record creation failed', payRes.status, payJson);
        }
      } catch (payErr) {
        console.warn('[TherapistScheduleBooking] Payment record POST error', payErr);
      }

      setConfirmPaymentSuccess(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1800);
    } catch (err) {
      setConfirmPaymentError(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setConfirmingPayment(false);
    }
  };

  const updatePaymentField = (field: keyof PaymentForm) => (v: string) =>
    setPaymentForm(prev => ({ ...prev, [field]: v }));

  const dateObj   = new Date(date + 'T00:00:00');
  const dayName   = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum    = dateObj.getDate();
  const monthFull = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearFull  = dateObj.getFullYear();

  const activeThImg          = selectedTherapist?.avatar ?? selectedTherapist?.photo_url ?? therapistPhoto ?? '';
  const activeThDisplayName  = selectedTherapist
    ? ((selectedTherapist.full_name ?? [selectedTherapist.first_name, selectedTherapist.last_name].filter(Boolean).join(' ')) || therapistName)
    : therapistName;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent shrink-0" />

        {/* Top header */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              New Therapist Schedule Booking
            </p>
            {step <= 2 && (
              <div className="flex items-center gap-1 ml-2">
                {([1, 2] as const).map((n) => (
                  <span key={n} className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold transition',
                    step === n ? 'bg-primary text-white shadow-sm'
                      : step > n ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground',
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
                <CheckCircle2 className="h-3 w-3" /> Booking Created
              </span>
            )}
            {step === 4 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                <CreditCard className="h-3 w-3" /> Confirm Payment
              </span>
            )}
          </div>
          <button onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition"
            aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header */}
        <div className="shrink-0 border-b border-border/40 bg-muted/20">
          <div className="flex items-stretch divide-x border-border/40">

            {/* Therapist portrait */}
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-4 w-[32%] shrink-0">
              <div className="relative">
                <div className="absolute -inset-1.5 rounded-full opacity-20 blur-xl bg-primary/30" />
                <div className="relative h-[64px] w-[64px] rounded-full ring-2 ring-primary/40 shadow-xl overflow-hidden">
                  {activeThImg
                    ? <img src={activeThImg} alt={activeThDisplayName} className="h-full w-full object-cover" />
                    : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-lg font-black">
                        {activeThDisplayName.slice(0, 2).toUpperCase()}
                      </div>
                  }
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card shadow-sm">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </span>
              </div>
              <div className="text-center">
                <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[110px]">
                  {activeThDisplayName}
                </p>
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                  Therapist
                </span>
              </div>
            </div>

            {/* Branch */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 w-[28%] shrink-0">
              <div className="h-[48px] w-[48px] rounded-2xl grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[100px]">
                  {branchName || 'Branch'}
                </p>
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                  Direct Booking
                </span>
              </div>
            </div>

            {/* Date + time */}
            <div className="flex items-center justify-end gap-3.5 px-4 py-4 flex-1 min-w-0">
              <div className="flex flex-col items-center justify-center w-[60px] h-[72px] rounded-2xl shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(160deg, #3b2f2f 0%, #4a3728 100%)' }}>
                <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest leading-none mb-1">{dayName}</p>
                <p className="text-[30px] font-black text-white leading-none">{dayNum}</p>
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appointment Date</p>
                  <p className="text-sm font-extrabold text-foreground leading-tight">{monthFull} {dayNum}, {yearFull}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 w-fit">
                  <div className="grid h-5 w-5 place-items-center rounded-lg bg-primary/15 text-primary shrink-0">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 leading-none">Time Slot</p>
                    <p className="text-xs font-extrabold text-primary leading-tight">{timeSlot}</p>
                  </div>
                  {totalDuration > 0 && (
                    <>
                      <span className="text-primary/40 text-xs">·</span>
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="ts-booking-form" onSubmit={handleSubmit}>

            {/* ── STEP 1: Service ── */}
            {step === 1 && (
              <div className="px-6 py-5 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Select Service</p>
                    {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <FLabel>Search & Select *</FLabel>
                  <SearchDrop<ApiService>
                    value={form.serviceSearch}
                    placeholder={servicesLoading ? 'Loading services…' : 'Search services…'}
                    loading={servicesLoading}
                    items={filteredServices}
                    getKey={(s, idx) => String(s.id ?? (s as any).service_id ?? (s as any).pk ?? idx)}
                    isSelected={(s) => String(s.id ?? '') === form.serviceId}
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
                            {fmt(s.arrangement_price ?? s.base_price)} KWD
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
                        {fmt(selectedService.arrangement_price ?? selectedService.base_price)} KWD
                      </p>
                    </div>
                  )}
                </div>

                {hasExtraTime && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Extra Time
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {extraOptions.map((mins) => {
                        const active = form.extraMinutes === mins;
                        const price = calcExtraPrice(mins);
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, extraMinutes: mins }))}
                            className={cn(
                              'flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-center transition cursor-pointer',
                              active
                                ? 'border-primary/50 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30'
                                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                            )}
                          >
                            <p className="text-sm font-extrabold">{mins === 0 ? 'None' : `${mins} min`}</p>
                            <p className="text-[11px] font-semibold mt-0.5 opacity-80">
                              {mins === 0 ? '+0 KWD' : `+${fmt(price)} KWD`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Arrangement picker ── */}
                {selectedService && (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-extrabold text-foreground">Select Room</p>
                        {arrangementsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>
                      {arrangements.length > 0 && (
                        <span className="text-sm font-semibold text-muted-foreground">
                          {arrangements.length} option{arrangements.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {!arrangementsLoading && arrangements.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No arrangements available for this branch</p>
                    )}

                    {arrangements.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1"
                        style={{ scrollbarWidth: 'none' }}>
                        {arrangements.map((arr) => {
                          const cfg      = getArrCfg(arr.arrangement_type);
                          const Icon     = cfg.Icon;
                          const isSelected = form.arrangementId === arr.id;
                          const price    = arr.arrangement_price ?? arr.base_price;
                          const imgSrc   = arr.image ?? arr.photo_url ?? arr.thumbnail ?? null;
                          return (
                            <button
                              key={arr.id}
                              type="button"
                              onClick={() => setForm(p => isSelected
                                ? { ...p, arrangementId: '', arrangementName: '', arrangementType: '' }
                                : { ...p, arrangementId: arr.id, arrangementName: arr.name, arrangementType: arr.arrangement_type ?? '' }
                              )}
                              className={cn(
                                'relative flex-shrink-0 w-[140px] h-[175px] rounded-2xl overflow-hidden transition-all duration-200 group',
                                isSelected
                                  ? 'ring-[3px] ring-offset-2 ring-offset-card'
                                  : 'ring-1 ring-border hover:ring-2 hover:ring-border/80',
                              )}
                              style={isSelected ? { '--tw-ring-color': '#c9a96e' } as React.CSSProperties : {}}
                            >
                              {/* Background: image or gradient */}
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={arr.name}
                                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <div className={cn(
                                  'absolute inset-0 bg-gradient-to-br transition-transform duration-300 group-hover:scale-105',
                                  cfg.gradient,
                                )}>
                                  {/* Decorative icon watermark */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                    <Icon className={cn('h-20 w-20', cfg.iconColor)} />
                                  </div>
                                </div>
                              )}

                              {/* Always-on dark bottom gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                              {/* Selected checkmark badge (top-right) */}
                              {isSelected && (
                                <div className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                                  style={{ background: '#c9a96e' }}>
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                </div>
                              )}

                              {/* Bottom text: name + type badge + price */}
                              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-6">
                                <p className="text-[13px] font-extrabold text-white leading-tight truncate">
                                  {arr.name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                                    style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                                    {cfg.label}
                                  </span>
                                  {arr.capacity && (
                                    <span className="text-[10px] text-white/70 font-semibold">Cap {arr.capacity}</span>
                                  )}
                                </div>
                                {price && (
                                  <p className="mt-1 text-[12px] font-bold leading-none"
                                    style={{ color: isSelected ? '#f0d49a' : '#d4b483' }}>
                                    KWD {fmt(price)}
                                  </p>
                                )}
                              </div>

                              {/* Selected golden border overlay */}
                              {isSelected && (
                                <div className="absolute inset-0 rounded-2xl pointer-events-none"
                                  style={{ boxShadow: 'inset 0 0 0 2px #c9a96e' }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {form.arrangementId && (
                      <div className="mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: '#c9a96e33', background: '#c9a96e0a' }}>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#c9a96e' }} />
                        <p className="text-xs font-semibold" style={{ color: '#a07840' }}>
                          {form.arrangementName} selected
                        </p>
                      </div>
                    )}

                    {/* Arrangement add-ons — shown only when an arrangement is selected */}
                    {form.arrangementId && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-3.5 w-3.5 text-amber-500" />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Room Add-ons
                          </p>
                          {arrAddonsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                          <span className="ml-auto text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Optional</span>
                        </div>
                        {!arrAddonsLoading && arrangementAddons.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No add-ons available for this room</p>
                        )}
                        {arrangementAddons.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {arrangementAddons.map((addon) => {
                              const checked = form.arrangementAddonIds.includes(addon.id);
                              return (
                                <label key={addon.id} className={cn(
                                  'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                                  checked
                                    ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                                    : 'border-border bg-muted/20 hover:bg-muted/40',
                                )}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleArrAddon(addon.id)}
                                    className="mt-0.5 h-3.5 w-3.5 accent-amber-500 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold leading-tight">{addon.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {addon.price && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">+{fmt(addon.price)} KWD</span>}
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
                        {form.arrangementAddonIds.length > 0 && (() => {
                          const arrAddonTotal    = selectedArrAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
                          const arrAddonDuration = selectedArrAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
                          return (
                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/30 px-3 py-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                {arrAddonDuration > 0 && <span className="font-bold">+{arrAddonDuration} min</span>}
                                {arrAddonDuration > 0 && arrAddonTotal > 0 && ' · '}
                                {arrAddonTotal > 0 && <span className="font-bold">+{fmt(arrAddonTotal)} KWD</span>}
                                <span className="font-normal text-amber-600/70"> from room add-ons</span>
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Add-on Services</p>
                  </div>
                  {serviceAddons.length === 0 && !servicesLoading && (
                    <p className="text-xs text-muted-foreground italic">No add-ons available for this service</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {serviceAddons.map((addon) => {
                      const checked = form.addonIds.includes(addon.id);
                      return (
                        <label key={addon.id} className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                          checked ? 'border-primary/40 bg-primary/5 text-primary'
                            : 'border-border bg-muted/20 hover:bg-muted/40',
                        )}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAddon(addon.id)}
                            className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold leading-tight">{addon.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {addon.price && <span className="text-[10px] font-bold text-primary">+{fmt(addon.price)} KWD</span>}
                              {addon.duration_minutes && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Timer className="h-2.5 w-2.5" />+{addon.duration_minutes}m</span>}
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
                        {addonTotal > 0 && <span className="font-bold">+{fmt(addonTotal)} KWD</span>}
                        <span className="font-normal text-emerald-600/70"> added by selected add-ons</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: Therapist & Customer ── */}
            {step === 2 && (
              <div className="px-6 py-5 space-y-5">
                {/* Customer */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Customer</p>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <FLabel>Search &amp; Select Customer *</FLabel>
                    <button
                      type="button"
                      onClick={() => setShowCreateCustomer(true)}
                      title="Create new customer"
                      className="flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-1 text-[11px] font-bold text-primary transition cursor-pointer"
                    >
                      <UserPlus className="h-3 w-3" />
                      New
                    </button>
                  </div>
                  <SearchDrop<ApiCustomer>
                    value={form.customerSearch}
                    placeholder="Search by name or phone…"
                    loading={customersLoading}
                    items={customers}
                    getKey={(c, idx) => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? (c as any).uuid ?? idx)}
                    isSelected={(c) => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === form.customerId}
                    selectedItem={selectedCustomer}
                    icon={User}
                    onSearch={(q) => { setCustomerQuery(q); setForm(p => ({ ...p, customerSearch: q, customerId: '' })); }}
                    onSelect={selectCustomer}
                    onClear={clearCustomer}
                    renderItem={(c) => {
                      const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || '—';
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                            {c.avatar ? <img src={c.avatar} alt={name} className="h-full w-full object-cover" />
                              : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold">{name.slice(0, 2).toUpperCase()}</div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {c.phone_number && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {c.phone_number}</span>}
                              {c.email && <span className="flex items-center gap-0.5 truncate"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
                            </div>
                          </div>
                          {String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === form.customerId && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                        </div>
                      );
                    }}
                  />
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-800/30 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {([selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || selectedCustomer.full_name || 'Customer'} selected
                        {selectedCustomer.phone_number && <span className="font-normal text-emerald-600/70"> · {selectedCustomer.phone_number}</span>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <FLabel>Notes</FLabel>
                  </div>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any special instructions or notes…"
                    rows={3}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Payment Method</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'completed', label: 'Payment Completed', desc: 'Paid now', color: 'emerald' },
                      { value: 'on_branch', label: 'Pay on Branch',     desc: 'Pay later',  color: 'amber'   },
                    ].map(({ value, label, desc, color }) => (
                      <label
                        key={value}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition select-none ${
                          paymentMethod === value
                            ? color === 'emerald'
                              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                              : 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                            : 'border-border bg-muted/20 hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tsch-payment-method"
                          value={value}
                          checked={paymentMethod === value}
                          onChange={() => setPaymentMethod(value as 'completed' | 'on_branch')}
                          className="sr-only"
                        />
                        <span className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                          paymentMethod === value
                            ? color === 'emerald' ? 'border-emerald-500' : 'border-amber-500'
                            : 'border-muted-foreground/40'
                        }`}>
                          {paymentMethod === value && (
                            <span className={`h-2 w-2 rounded-full block ${
                              color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${
                            paymentMethod === value
                              ? color === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                              : 'text-foreground'
                          }`}>{label}</p>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Confirmation ── */}
            {step === 3 && bookingResult && (() => {
              const r     = bookingResult as Record<string, unknown>;
              const ref   = String(r.bookings_id ?? r.reference_number ?? r.booking_number ?? r.id ?? r.booking_id ?? r.pk ?? '—')
                .replace('undefined', '—').replace('null', '—');
              const sName = (r.service_name ?? selectedService?.name ?? '—') as string;
              const tName = snapTherapistName || 'Not assigned';
              const cName = snapCustomerName  || '—';
              return (
                <div className="px-6 py-5 space-y-4">
                  {/* ── Booking created banner ── */}
                  <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border border-emerald-300/40 dark:border-emerald-700/30 px-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">Booking Created Successfully</p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 font-mono truncate">Ref: {ref}</p>
                    </div>
                  </div>

                  {/* ── Service & Arrangement ── */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 divide-y divide-border/40">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <Scissors className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                        <p className="text-sm font-semibold truncate">{sName}</p>
                        {selectedService?.category && <p className="text-[11px] text-muted-foreground">{selectedService.category}</p>}
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-primary">{fmt(servicePrice)} KWD</p>
                    </div>

                    {form.arrangementId && (
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className="h-3.5 w-3.5 mt-0.5 shrink-0 rounded-sm flex items-center justify-center" style={{ background: '#c9a96e22' }}>
                          <span className="text-[8px] font-black" style={{ color: '#c9a96e' }}>R</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Room / Arrangement</p>
                          <p className="text-xs font-semibold truncate">{form.arrangementName}</p>
                          {form.arrangementType && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                              {form.arrangementType.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 px-4 py-3">
                      <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</p>
                        <p className="text-xs font-semibold truncate">{branchName}</p>
                      </div>
                    </div>

                    {allSelectedAddons.length > 0 && (
                      <div className="flex items-start gap-3 px-4 py-3">
                        <Package className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/70" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add-ons</p>
                          {allSelectedAddons.map(a => (
                            <div key={a.id} className="flex items-center justify-between">
                              <p className="text-[11px] font-medium truncate">{a.name}</p>
                              {a.price && <p className="text-[11px] font-bold text-primary shrink-0 ml-2">+{fmt(a.price)} KWD</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Therapist & Customer ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Therapist', name: tName, img: snapTherapistImg, grad: 'from-primary/80 to-accent' },
                      { label: 'Customer',  name: cName, img: snapCustomerImg,  grad: 'from-primary/70 to-accent' },
                    ].map(({ label, name, img, grad }) => (
                      <div key={label} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center gap-3">
                        <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                          {img ? <img src={img} alt={name} className="h-full w-full object-cover" />
                            : <div className={cn('h-full w-full grid place-items-center bg-gradient-to-br text-white text-xs font-bold', grad)}>
                                {name.slice(0, 2).toUpperCase()}
                              </div>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="text-xs font-semibold truncate">{name}</p>
                          {label === 'Customer' && snapCustomerPhone && <p className="text-[10px] text-muted-foreground">{snapCustomerPhone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Date / Time / Total ── */}
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{date}</p>
                      <p className="text-[11px] text-muted-foreground">{timeSlot} · {totalDuration} min total</p>
                    </div>
                    <div className="text-right shrink-0 border-l border-border/40 pl-3">
                      {addonTotal > 0 && (
                        <p className="text-[10px] text-muted-foreground">Service: {fmt(servicePrice)} + Add-ons: {fmt(addonTotal)}</p>
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                      <p className="text-base font-black text-primary leading-none">
                        {fmt(totalPrice)} <span className="text-[10px] font-semibold">KWD</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 4: Payment Form ── */}
            {step === 4 && (() => {
              const payFormValid =
                paymentForm.invoice_id.trim() !== '' &&
                paymentForm.transaction_date.trim() !== '' &&
                paymentForm.total_amount.trim() !== '' &&
                paymentForm.received_by.trim() !== '';
              return (
                <div className="px-6 py-5 space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 px-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-foreground">Payment Details</p>
                      <p className="text-[11px] text-muted-foreground">Enter the KNET transaction information to confirm payment</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total Due</p>
                      <p className="text-base font-black text-primary leading-none">{fmt(totalPrice)} <span className="text-[10px] font-semibold">KWD</span></p>
                    </div>
                  </div>

                  {/* Payment fields grid — matching design */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    {/* Order Number (Invoice ID) */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Order Number (Invoice ID) <span className="text-destructive">*</span>
                      </p>
                      <div className="relative flex items-center">
                        <DollarSign className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="text"
                          id="pay-invoice-id"
                          value={paymentForm.invoice_id}
                          onChange={e => updatePaymentField('invoice_id')(e.target.value)}
                          placeholder="e.g. ORD-00123"
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>

                    {/* Transaction Date */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Transaction Date <span className="text-destructive">*</span>
                      </p>
                      <div className="relative flex items-center">
                        <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="datetime-local"
                          id="pay-transaction-date"
                          value={paymentForm.transaction_date}
                          onChange={e => updatePaymentField('transaction_date')(e.target.value)}
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground"
                        />
                      </div>
                    </div>

                    {/* Amount Paid */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Amount Paid <span className="text-destructive">*</span>
                      </p>
                      <div className="relative flex items-center">
                        <CreditCard className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="text"
                          id="pay-total-amount"
                          value={paymentForm.total_amount}
                          onChange={e => updatePaymentField('total_amount')(e.target.value)}
                          placeholder={`e.g. ${fmt(totalPrice)}`}
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>

                    {/* Trace ID */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Trace ID
                      </p>
                      <div className="relative flex items-center">
                        <Hash className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="text"
                          id="pay-trace-id"
                          value={paymentForm.trace_id}
                          onChange={e => updatePaymentField('trace_id')(e.target.value)}
                          placeholder="Transaction trace ID"
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>

                    {/* KNET Ref ID */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        KNET Ref ID
                      </p>
                      <div className="relative flex items-center">
                        <Fingerprint className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="text"
                          id="pay-reference-id"
                          value={paymentForm.reference_id}
                          onChange={e => updatePaymentField('reference_id')(e.target.value)}
                          placeholder="KNET reference ID"
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>

                    {/* Received By */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Received By <span className="text-destructive">*</span>
                      </p>
                      <div className="relative flex items-center">
                        <User className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60" />
                        <input
                          type="text"
                          id="pay-received-by"
                          value={paymentForm.received_by}
                          onChange={e => updatePaymentField('received_by')(e.target.value)}
                          placeholder="Staff name or ID"
                          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Success / Error banners */}
                  {confirmPaymentSuccess && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        Payment confirmed — booking status updated to Confirmed.
                      </p>
                    </div>
                  )}
                  {confirmPaymentError && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{confirmPaymentError}</p>
                    </div>
                  )}

                  {/* Required-field note */}
                  {!payFormValid && (
                    <p className="text-[10px] text-muted-foreground italic">
                      <span className="text-destructive">*</span> Required fields must be filled to confirm payment.
                    </p>
                  )}
                </div>
              );
            })()}
          </form>
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 border-t border-border/40 bg-card">
          <div className="border-b border-border/40 bg-muted/30 px-6 py-3">
            {!selectedService ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <DollarSign className="h-3.5 w-3.5" /> Select a service to see pricing
              </div>
            ) : (
              <div className="flex items-center gap-0">
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Scissors className="h-2.5 w-2.5" />Service</p>
                  <p className="text-xs font-semibold">{fmt(servicePrice)} KWD</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedService.name}</p>
                </div>
                {addonTotal > 0 && (<>
                  <div className="w-px self-stretch bg-border/60 mx-3" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Package className="h-2.5 w-2.5" />Add-ons</p>
                    <p className="text-xs font-semibold text-primary">+{fmt(addonTotal)} KWD</p>
                    <p className="text-[10px] text-muted-foreground">{form.addonIds.length} selected</p>
                  </div>
                </>)}
                {extraMinutesPrice > 0 && (<>
                  <div className="w-px self-stretch bg-border/60 mx-3" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Timer className="h-2.5 w-2.5" />Extra</p>
                    <p className="text-xs font-semibold text-primary">+{fmt(extraMinutesPrice)} KWD</p>
                    <p className="text-[10px] text-muted-foreground">+{form.extraMinutes} min</p>
                  </div>
                </>)}
                <div className="w-px self-stretch bg-border/60 mx-3" />
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Duration</p>
                  <p className="text-xs font-bold text-foreground">{totalDuration} min</p>
                </div>
                <div className="w-px self-stretch bg-border/60 mx-3" />
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                  <p className="text-lg font-black text-primary leading-none">{fmt(totalPrice)}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">KWD</p>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-3 space-y-3">
            {submitError && step !== 3 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /><span>{submitError}</span>
              </div>
            )}
            <div className="flex gap-2">
              {step === 1 && (<>
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">
                  Cancel
                </button>
                <button type="button" onClick={goNext}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition">
                  Next: Customer <ChevronRight className="h-4 w-4" />
                </button>
              </>)}
              {step === 2 && (<>
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit" form="ts-booking-form"
                  disabled={submitting || !form.customerId}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? 'Creating…' : 'Confirm Booking'}
                </button>
              </>)}
              {step === 3 && (<>
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">
                  Close
                </button>
                <button type="button" onClick={() => setStep(4)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition">
                  <CreditCard className="h-4 w-4" />
                  Next: Confirm Payment
                </button>
              </>)}
              {step === 4 && (<>
                <button type="button" onClick={() => { setStep(3); setConfirmPaymentError(null); }}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button
                  type="button"
                  id="confirm-payment-btn"
                  onClick={handleConfirmPayment}
                  disabled={confirmingPayment || confirmPaymentSuccess ||
                    !paymentForm.invoice_id.trim() ||
                    !paymentForm.transaction_date.trim() ||
                    !paymentForm.total_amount.trim() ||
                    !paymentForm.received_by.trim()
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {confirmingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {confirmingPayment ? 'Confirming…' : confirmPaymentSuccess ? 'Payment Confirmed ✓' : 'Confirm Payment'}
                </button>
              </>)}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ── Quick-add new customer ── */}
      {showCreateCustomer && (
        <CreateCustomerModal
          authHeader={authHeader}
          onCreated={handleCustomerCreated}
          onClose={() => setShowCreateCustomer(false)}
        />
      )}
    </>
  );
}

