'use client';
// Shared booking modal used by Branch Appointments and Therapist Schedule pages.
// When arrangement.id is '' (empty) the modal fetches all services instead of
// arrangement-specific ones and omits arrangement fields from the POST body.
// preselectedTherapistId / preselectedTherapistName allow pre-selecting a therapist.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Store, CalendarDays, CheckCircle2, Clock, AlertCircle, X, Layers,
  Timer, Loader2, Crown, Heart, Sparkles, LayoutGrid,
  Scissors, Package, User, Phone, Mail, DollarSign, FileText,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Exported types ─────────────────────────────────────────────────────────────

export interface ApiService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  arrangement_price?: string | number;
  home_service_price?: string | number;
  price_for_extra_minutes?: string | number;
  extra_minutes?: number;
  category?: string;
  gender?: string;
  is_for_male?: boolean;
  is_for_female?: boolean;
  add_ons?: ApiAddOn[];
}

export interface ApiAddOn {
  id: string;
  name: string;
  price?: string | number;
  home_service_price?: string | number;
  duration_minutes?: number;
}

export interface ApiTherapist {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar?: string;
  photo_url?: string;
  specialties?: { id: string; name: string }[];
  specialization?: string;
}

export interface ApiCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  avatar?: string;
  gender?: string;
}

/** id === '' means "no specific arrangement" — direct / therapist-schedule booking */
export interface Arrangement {
  id: string;
  name: string;
  initials: string;
  arrangementType: string;
  capacity: number;
  branchName: string;
  branchId: string;
  color: string;
}

export interface NewBookingPayload {
  arrangement: Arrangement;
  timeSlot: string;
  date: string;
}

export type BookingStep = 1 | 2 | 3;

export interface BranchBookingForm {
  serviceId: string;
  serviceSearch: string;
  therapistId: string;
  therapistSearch: string;
  customerId: string;
  customerSearch: string;
  addonIds: string[];
  extraMinutes: number;
  notes: string;
}

const INITIAL_FORM: BranchBookingForm = {
  serviceId: '', serviceSearch: '', therapistId: '', therapistSearch: '',
  customerId: '', customerSearch: '', addonIds: [], extraMinutes: 0, notes: '',
};

export function fmtPriceB(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === '') return '0.000';
  const n = parseFloat(String(v));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

// ── Arrangement type icon/label map (also used in branch schedule grid) ────────

export const ARRANGEMENT_TYPE_CFG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  open_area:     { label: 'Open Area',     Icon: LayoutGrid, color: 'text-sky-500' },
  vip_suite:     { label: 'VIP Suite',     Icon: Crown,      color: 'text-amber-500' },
  couple_room:   { label: 'Couple Room',   Icon: Heart,      color: 'text-rose-500' },
  single_room:   { label: 'Single Room',   Icon: Sparkles,   color: 'text-violet-500' },
  private_suite: { label: 'Private Suite', Icon: Layers,     color: 'text-teal-500' },
  other:         { label: 'Other',         Icon: Store,      color: 'text-muted-foreground' },
};

export function getArrangementType(type: string) {
  return ARRANGEMENT_TYPE_CFG[type] ?? ARRANGEMENT_TYPE_CFG['other'];
}

// ── Private form helper components ─────────────────────────────────────────────

function BFormLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
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
              {loading ? 'Loading\u2026' : 'No results'}
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

// ── Main modal component ───────────────────────────────────────────────────────

export function NewBranchBookingModal({
  payload,
  onClose,
  onSuccess,
  token,
  preselectedTherapistId,
  preselectedTherapistName,
}: {
  payload: NewBookingPayload;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  /** When set (e.g. from Therapist Schedule), the therapist is pre-selected */
  preselectedTherapistId?: string;
  preselectedTherapistName?: string;
}) {
  const { arrangement, timeSlot, date } = payload;

  const [step, setStep]           = useState<BookingStep>(1);
  const [form, setForm]           = useState<BranchBookingForm>(() => ({
    ...INITIAL_FORM,
    ...(preselectedTherapistId ? {
      therapistId:     preselectedTherapistId,
      therapistSearch: preselectedTherapistName ?? '',
    } : {}),
  }));
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult,       setBookingResult]       = useState<Record<string, any> | null>(null);
  const [bookingId,           setBookingId]           = useState<string>('');
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [paymentLinkError,    setPaymentLinkError]    = useState<string | null>(null);
  const [paymentLinkSuccess,  setPaymentLinkSuccess]  = useState(false);

  const [snapTherapistName, setSnapTherapistName] = useState<string>('');
  const [snapTherapistImg,  setSnapTherapistImg]  = useState<string>('');
  const [snapCustomerName,  setSnapCustomerName]  = useState<string>('');
  const [snapCustomerImg,   setSnapCustomerImg]   = useState<string>('');
  const [snapCustomerPhone, setSnapCustomerPhone] = useState<string>('');

  const [services,        setServices]        = useState<ApiService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [therapists,        setTherapists]        = useState<ApiTherapist[]>([]);
  const [therapistsLoading, setTherapistsLoading] = useState(false);
  const [globalAddons,  setGlobalAddons]  = useState<ApiAddOn[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [customers,        setCustomers]        = useState<ApiCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerQuery,    setCustomerQuery]    = useState('');

  const authHeader = `Bearer ${token}`;

  // Load services — all services when no arrangement, arrangement-specific otherwise
  useEffect(() => {
    setServicesLoading(true);
    const url = arrangement.id
      ? `/api/v1/service-arrangements/${arrangement.id}/services`
      : `/api/v1/services/`;
    fetch(url, { headers: { Authorization: authHeader } })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setServices(list); })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [arrangement.id, authHeader]);

  // Load add-ons (skipped when no arrangement)
  useEffect(() => {
    if (!arrangement.id) { setGlobalAddons([]); setAddonsLoading(false); return; }
    setAddonsLoading(true);
    fetch(`/api/v1/service-arrangements/${arrangement.id}/addons`, { headers: { Authorization: authHeader } })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.addons ?? d.data ?? d.results ?? []); setGlobalAddons(list); })
      .catch(() => setGlobalAddons([]))
      .finally(() => setAddonsLoading(false));
  }, [arrangement.id, authHeader]);

  const toHHMM = (slot: string): string => {
    const [timePart, ampm] = slot.split(' ');
    const [hStr, mStr] = timePart.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const selectedService   = useMemo(() => services.find(s => s.id === form.serviceId) ?? null, [services, form.serviceId]);
  const selectedTherapist = useMemo(() => therapists.find(t => t.id === form.therapistId) ?? null, [therapists, form.therapistId]);
  const selectedCustomer  = useMemo(() => customers.find(c => c.id === form.customerId) ?? null, [customers, form.customerId]);

  const filteredServices = useMemo(() =>
    form.serviceSearch ? services.filter(s => s.name.toLowerCase().includes(form.serviceSearch.toLowerCase())) : services,
    [services, form.serviceSearch]);

  const filteredTherapists = useMemo(() =>
    form.therapistSearch ? therapists.filter(t => {
      const name = (t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')).toLowerCase();
      return name.includes(form.therapistSearch.toLowerCase());
    }) : therapists,
    [therapists, form.therapistSearch]);

  const serviceAddons: ApiAddOn[] = selectedService?.add_ons ?? [];
  const allAddons = useMemo(() => {
    const ids = new Set(serviceAddons.map(a => a.id));
    return [...serviceAddons, ...globalAddons.filter(a => !ids.has(a.id))];
  }, [serviceAddons, globalAddons]);

  const servicePrice      = parseFloat(String(selectedService?.arrangement_price ?? selectedService?.base_price ?? '0')) || 0;
  const selectedAddons    = allAddons.filter(a => form.addonIds.includes(a.id));
  const addonTotal        = selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonDuration     = selectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
  const extraMinutesUnit  = selectedService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(selectedService?.price_for_extra_minutes ?? '0')) || 0;
  const extraSteps        = extraMinutesUnit > 0 ? Math.round(form.extraMinutes / extraMinutesUnit) : 0;
  const extraMinutesPrice = extraSteps * extraPricePerUnit;
  const totalPrice        = servicePrice + addonTotal + extraMinutesPrice;
  const baseDuration      = selectedService?.duration_minutes ?? 0;
  const totalDuration     = baseDuration + addonDuration + form.extraMinutes;
  const hasExtraTime      = !!selectedService && extraMinutesUnit > 0;
  const extraOptions      = hasExtraTime ? [0, 1, 2, 3, 4].map(n => n * extraMinutesUnit) : [];

  // Load therapists on step 2 (after service is selected)
  useEffect(() => {
    if (step !== 2 || !form.serviceId) { setTherapists([]); return; }
    setTherapistsLoading(true);
    const qs = new URLSearchParams({
      branch_id:              arrangement.branchId,
      no_service_list:        'true',
      check_for_availability: 'true',
      date,
      appointment_start:      toHHMM(timeSlot),
      duration:               String(totalDuration > 0 ? totalDuration : (selectedService?.duration_minutes ?? 60)),
    });
    fetch(`/api/v1/services/${form.serviceId}/therapists?${qs}`, { headers: { Authorization: authHeader } })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setTherapists(list); })
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
        .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setCustomers(list); })
        .catch(() => setCustomers([]))
        .finally(() => setCustomersLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery, authHeader]);

  const toggleAddon     = (id: string) =>
    setForm(p => ({ ...p, addonIds: p.addonIds.includes(id) ? p.addonIds.filter(x => x !== id) : [...p.addonIds, id] }));
  const selectService   = (s: ApiService) =>
    setForm(p => ({ ...p, serviceId: s.id, serviceSearch: s.name, therapistId: '', therapistSearch: '', addonIds: [], extraMinutes: 0 }));
  const clearService    = () =>
    setForm(p => ({ ...p, serviceId: '', serviceSearch: '', therapistId: '', therapistSearch: '', addonIds: [], extraMinutes: 0 }));
  const selectTherapist = (t: ApiTherapist) => {
    const name = t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
    setForm(p => ({ ...p, therapistId: t.id, therapistSearch: name }));
  };
  const clearTherapist  = () => setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));
  const selectCustomer  = (c: ApiCustomer) => {
    const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || c.email || '';
    setForm(p => ({ ...p, customerId: c.id, customerSearch: name }));
    setSubmitError(null);
  };
  const clearCustomer   = () => setForm(p => ({ ...p, customerId: '', customerSearch: '' }));

  const goNext = () => {
    if (!form.serviceId) { setSubmitError('Please select a service.'); return; }
    setSubmitError(null); setStep(2);
  };
  const goBack = () => {
    setSubmitError(null);
    setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setSubmitError('Please select a customer.'); return; }
    setSubmitting(true); setSubmitError(null);

    const svc           = selectedService!;
    const svcCategory   = svc.category ?? '';
    const baseP         = parseFloat(String(svc.arrangement_price ?? svc.base_price ?? '0')) || 0;
    const timeHHMM      = toHHMM(timeSlot);
    const dateObj       = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const therapistName = selectedTherapist
      ? ((selectedTherapist.full_name ?? [selectedTherapist.first_name, selectedTherapist.last_name].filter(Boolean).join(' ')) || 'Therapist')
      : null;
    const customerName  = selectedCustomer
      ? ((selectedCustomer.full_name ?? [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || 'Customer')
      : null;

    const body = {
      service_id:       svc.id,
      service_name:     svc.name,
      service_category: svcCategory,
      base_price:       fmtPriceB(svc.base_price),
      baseDuration,
      branch_id:        arrangement.branchId,
      branch_data: { branch_name: arrangement.branchName, branch_address: arrangement.branchName },
      ...(arrangement.id ? {
        service_arrangement_id:   arrangement.id,
        service_arrangement_data: { arrangement_name: arrangement.name, arrangement_type: arrangement.arrangementType },
      } : {}),
      therapist_id:   form.therapistId || null,
      therapist_data: therapistName ? { therapist_name: therapistName } : null,
      selected_addons: selectedAddons.map((a) => ({
        id: a.id, name: a.name,
        description: (a as unknown as Record<string, string>).description ?? '',
        price: fmtPriceB(a.price), currency: 'KWD', is_active: true,
      })),
      addons_duration:  addonDuration,
      extra_minutes:    form.extraMinutes,
      extra_price:      fmtPriceB(extraMinutesPrice),
      date, formattedDate,
      time_slot:        timeHHMM,
      displayTime:      timeSlot,
      customer_id:      form.customerId,
      customer_data: customerName ? {
        customer_name: customerName,
        phone_number:  selectedCustomer?.phone_number ?? null,
        email:         selectedCustomer?.email ?? null,
      } : null,
      customerMessage:  '',
      customer_notes:   form.notes,
      booking_type:     'branch',
      pricing_details: {
        base: fmtPriceB(baseP), base_price: fmtPriceB(baseP),
        arrangement: fmtPriceB(baseP), arrangement_price: fmtPriceB(baseP),
        addons: fmtPriceB(addonTotal), addons_price: fmtPriceB(addonTotal),
        extratime: fmtPriceB(extraMinutesPrice), extra_time: fmtPriceB(extraMinutesPrice),
        extra_time_price: fmtPriceB(extraMinutesPrice),
        subtotal: fmtPriceB(totalPrice), total: fmtPriceB(totalPrice), total_price: fmtPriceB(totalPrice),
        currency: 'KWD',
      },
      total_price: fmtPriceB(totalPrice), total_duration: totalDuration, currency: 'KWD',
    };

    try {
      const res  = await fetch('/booknpay/api/v1/bookings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
        body:    JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as Record<string, string>).detail ?? (json as Record<string, string>).message ?? `Error ${res.status}`);
      }
      const result = (json as Record<string, unknown>).data ?? json;
      const raw    = result as Record<string, unknown>;
      const rid    = String(raw.id ?? raw.booking_id ?? raw.bookings_id ?? raw.pk ?? '')
        .replace('undefined', '').replace('null', '');

      const tSnap     = selectedTherapist;
      const cSnap     = selectedCustomer;
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
    const raw = bookingResult as Record<string, unknown> | null;
    const id  = bookingId ||
      String(raw?.id ?? raw?.booking_id ?? raw?.bookings_id ?? raw?.pk ?? '')
        .replace('undefined', '').replace('null', '');
    if (!id) { setPaymentLinkError('Booking ID not found in response. Cannot send payment link.'); return; }
    setCreatingPaymentLink(true); setPaymentLinkError(null);
    try {
      const res  = await fetch(`/booknpay/api/v1/bookings/${id}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
        body:    JSON.stringify({ status: 'confirmed', payment_status: 'pending', reason: 'Payment Link Sent to Customer' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as Record<string, string>).detail ?? `Error ${res.status}`);
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

  const dateObj   = new Date(date + 'T00:00:00');
  const dayName   = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum    = dateObj.getDate();
  const monthFull = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const yearFull  = dateObj.getFullYear();
  const isDirect  = !arrangement.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
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

        {/* Sub-header */}
        <div className="shrink-0 border-b border-border/40 bg-muted/20">
          <div className="flex items-stretch divide-x divide-border/40">
            {/* LEFT: Arrangement or branch portrait */}
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
                {!isDirect && arrangement.name && (
                  <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[100px]">{arrangement.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{arrangement.branchName}</p>
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                  {isDirect ? 'Direct Booking' : getArrangementType(arrangement.arrangementType).label}
                </span>
              </div>
            </div>

            {/* MIDDLE: Selected Therapist */}
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
                        {tImg ? <img src={tImg} alt={tName} className="h-full w-full object-cover" />
                          : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-lg font-black">{tName.slice(0, 2).toUpperCase()}</div>}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                        <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-extrabold text-foreground leading-tight truncate max-w-[110px]">{tName}</p>
                      {tSpec && <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">{tSpec}</p>}
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" /> Therapist
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

            {/* STEP 1 */}
            {step === 1 && (
              <div className="px-6 py-5 space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Select Service</p>
                    {servicesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  <BFormLabel>Search &amp; Select *</BFormLabel>
                  <BSearchDropdown<ApiService>
                    value={form.serviceSearch}
                    placeholder={servicesLoading ? 'Loading services\u2026' : 'Search services\u2026'}
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
                              {addon.price && <span className="text-[10px] font-bold text-primary">+{fmtPriceB(addon.price)} KWD</span>}
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
                        {addonTotal > 0 && <span className="font-bold">+{fmtPriceB(addonTotal)} KWD</span>}
                        <span className="font-normal text-emerald-600/70"> added by selected add-ons</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="px-6 py-5 space-y-5">
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
                      therapistsLoading ? 'Loading available therapists\u2026'
                        : therapists.length === 0 ? 'No therapists available for this slot'
                        : 'Search therapists\u2026'
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
                            {tImg ? <img src={tImg} alt={tName} className="h-full w-full object-cover" />
                              : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/80 to-accent text-white text-xs font-bold">{tName.slice(0, 2).toUpperCase()}</div>}
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

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold">Customer</p>
                  </div>
                  <BFormLabel>Search &amp; Select Customer *</BFormLabel>
                  <BSearchDropdown<ApiCustomer>
                    value={form.customerSearch}
                    placeholder="Search by name or phone\u2026"
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
                      const name = (c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')) || '\u2014';
                      return (
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                            {c.avatar ? <img src={c.avatar} alt={name} className="h-full w-full object-cover" />
                              : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-violet-400 to-purple-600 text-white text-xs font-bold">{name.slice(0, 2).toUpperCase()}</div>}
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

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <BFormLabel>Notes</BFormLabel>
                  </div>
                  <textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any special instructions or notes\u2026" rows={3}
                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none" />
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && bookingResult && (() => {
              const r       = bookingResult as Record<string, unknown>;
              const ref     = String(r.bookings_id ?? r.reference_number ?? r.booking_number ?? r.id ?? r.booking_id ?? r.pk ?? '\u2014')
                .replace('undefined', '\u2014').replace('null', '\u2014');
              const sName   = (r.service_name  ?? selectedService?.name ?? '\u2014') as string;
              const bName   = (r.branch_name   ?? arrangement.branchName ?? '\u2014') as string;
              const arrName = (r.arrangement_name ?? arrangement.name ?? '\u2014') as string;
              const tName   = snapTherapistName || 'Not assigned';
              const cName   = snapCustomerName  || '\u2014';
              return (
                <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border border-emerald-300/40 dark:border-emerald-700/30 px-4 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">Booking Created Successfully</p>
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 truncate">Ref: {ref}</p>
                    </div>
                  </div>
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {isDirect ? 'Branch' : 'Arrangement \u00b7 Branch'}
                        </p>
                        {!isDirect && <p className="text-sm font-semibold truncate">{arrName}</p>}
                        <p className="text-[11px] text-muted-foreground truncate">{bName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Therapist', name: tName, img: snapTherapistImg, grad: 'from-primary/80 to-accent' },
                      { label: 'Customer',  name: cName, img: snapCustomerImg,  grad: 'from-violet-400 to-purple-600' },
                    ].map(({ label, name, img, grad }) => (
                      <div key={label} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center gap-3">
                        <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-2 ring-border shadow-sm">
                          {img ? <img src={img} alt={name} className="h-full w-full object-cover" />
                            : <div className={cn('h-full w-full grid place-items-center bg-gradient-to-br text-white text-xs font-bold', grad)}>{name.slice(0, 2).toUpperCase()}</div>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                          <p className="text-xs font-semibold truncate">{name}</p>
                          {label === 'Customer' && snapCustomerPhone && <p className="text-[10px] text-muted-foreground">{snapCustomerPhone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {paymentLinkSuccess && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Payment link created \u2014 status set to Confirmed / Pending payment.</p>
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
                  <p className="text-xs font-semibold">{fmtPriceB(servicePrice)} KWD</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedService.name}</p>
                </div>
                {addonTotal > 0 && (<>
                  <div className="w-px self-stretch bg-border/60 mx-3" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Package className="h-2.5 w-2.5" />Add-ons</p>
                    <p className="text-xs font-semibold text-primary">+{fmtPriceB(addonTotal)} KWD</p>
                    <p className="text-[10px] text-muted-foreground">{form.addonIds.length} selected</p>
                  </div>
                </>)}
                {extraMinutesPrice > 0 && (<>
                  <div className="w-px self-stretch bg-border/60 mx-3" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Timer className="h-2.5 w-2.5" />Extra</p>
                    <p className="text-xs font-semibold text-primary">+{fmtPriceB(extraMinutesPrice)} KWD</p>
                    <p className="text-[10px] text-muted-foreground">+{form.extraMinutes} min</p>
                  </div>
                </>)}
                <div className="w-px self-stretch bg-border/60 mx-3" />
                <div className="flex flex-col items-end shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total</p>
                  <p className="text-lg font-black text-primary leading-none">{fmtPriceB(totalPrice)}</p>
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
                  className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">Cancel</button>
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
                <button type="submit" form="branch-booking-form" disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? 'Creating\u2026' : 'Confirm Booking'}
                </button>
              </>)}
              {step === 3 && (<>
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-border/60 bg-muted/40 px-5 py-2.5 text-sm font-semibold hover:bg-muted transition">Close</button>
                <button type="button" onClick={handleCreatePaymentLink} disabled={creatingPaymentLink || paymentLinkSuccess}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {creatingPaymentLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                  {creatingPaymentLink ? 'Sending\u2026' : paymentLinkSuccess ? 'Payment Link Sent \u2713' : 'Create Payment Link'}
                </button>
              </>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
