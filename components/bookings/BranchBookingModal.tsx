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
  ChevronLeft, ChevronRight, UserPlus, CreditCard, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { buildAppointmentWindow } from '@/lib/datetime';
import { MakePaymentModal } from './MakePaymentModal';
import { CreateCustomerModal, type CreatedCustomer } from './CreateCustomerModal';
import { MultiSelectDrop } from './MultiSelectDrop';
import { exceedsMaxDuration, maxDurationMessage } from '@/lib/booking-duration';

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
  /**
   * Maximum total duration (minutes) that fits in the free room time starting at
   * `timeSlot` (no overlap with other bookings / unavailable time). Undefined = no limit.
   */
  maxDurationMinutes?: number;
}

export type BookingStep = 1 | 2 | 3;

export interface BranchBookingForm {
  /** Primary (first selected) service — kept in sync with serviceIds[0] */
  serviceId: string;
  /** All selected services, in selection order */
  serviceIds: string[];
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
  serviceId: '', serviceIds: [], serviceSearch: '', therapistId: '', therapistSearch: '',
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
  getKey?: (item: T, index?: number) => string | number;
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
          value={isItemSelected ? (value || '— selected —') : value}
          onChange={(e) => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => { if (!isItemSelected) setOpen(true); }}
          placeholder={isItemSelected ? (value || '— selected —') : placeholder}
          readOnly={isItemSelected}
          className={cn(
            'h-10 w-full rounded-xl border border-border bg-muted/30 pr-8 text-sm outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50',
            Icon ? 'pl-9' : 'pl-3',
            isItemSelected ? 'font-medium text-foreground cursor-default bg-emerald-500/5 border-emerald-500/30' : '',
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
            (() => {
              const seenKeys = new Set<string>();
              return items.map((item, index) => {
                const keyCandidate = getKey ? getKey(item, index) : undefined;
                const rawKey = keyCandidate ?? (item as Record<string, unknown>)?.id ?? (item as Record<string, unknown>)?.pk ?? (item as Record<string, unknown>)?.uuid;
                let itemKey = (rawKey != null && rawKey !== '') ? String(rawKey) : `bsearch-item-${index}`;
                if (seenKeys.has(itemKey)) {
                  itemKey = `${itemKey}-${index}`;
                }
                seenKeys.add(itemKey);
                return (
                  <div
                    key={itemKey}
                    onClick={() => { onSelect(item); setOpen(false); }}
                    className={cn(
                      'cursor-pointer transition hover:bg-muted/60',
                      isSelected(item) && 'bg-primary/5',
                    )}
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
  const maxDuration = payload.maxDurationMinutes;

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
  const [paymentOption, setPaymentOption] = useState<'pay_on_branch' | 'pay_now'>('pay_on_branch');
  const [showMakePayment, setShowMakePayment] = useState(false);
  const [createdBookingInfo, setCreatedBookingInfo] = useState<{
    id: string;
    bookingNumber?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    amount: string;
    customerName?: string;
    customerPhone?: string;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bookingResult,       setBookingResult]       = useState<Record<string, any> | null>(null);
  const [bookingId,           setBookingId]           = useState<string>('');

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
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  // Load services — all services when no arrangement, arrangement-specific otherwise
  useEffect(() => {
    setServicesLoading(true);
    const url = arrangement.id
      ? `/api/v1/service-arrangements/${arrangement.id}/services`
      : `/api/v1/services/`;
    authedFetch(url, { headers: authHeader ? { Authorization: authHeader } : undefined })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []); setServices(list); })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [arrangement.id, authHeader]);

  // Load add-ons (skipped when no arrangement)
  useEffect(() => {
    if (!arrangement.id) { setGlobalAddons([]); setAddonsLoading(false); return; }
    setAddonsLoading(true);
    authedFetch(`/api/v1/service-arrangements/${arrangement.id}/addons`, { headers: authHeader ? { Authorization: authHeader } : undefined })
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

  // All selected services in selection order; the first one is the primary service.
  const selectedServices  = useMemo(() => {
    const byId = new Map(services.map(s => [s.id, s] as const));
    return form.serviceIds.map(id => byId.get(id)).filter((s): s is ApiService => Boolean(s));
  }, [services, form.serviceIds]);
  const selectedService   = selectedServices[0] ?? null;
  const selectedTherapist = useMemo(() => therapists.find(t => t.id === form.therapistId) ?? null, [therapists, form.therapistId]);
  const selectedCustomer  = useMemo(() => {
    if (!form.customerId) return null;
    return customers.find(c => String(c.id ?? (c as any).customer_id ?? (c as any).pk ?? '') === String(form.customerId)) ?? null;
  }, [customers, form.customerId]);

  const filteredServices = useMemo(() =>
    form.serviceSearch ? services.filter(s => s.name.toLowerCase().includes(form.serviceSearch.toLowerCase())) : services,
    [services, form.serviceSearch]);

  const filteredTherapists = useMemo(() =>
    form.therapistSearch ? therapists.filter(t => {
      const name = (t.full_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')).toLowerCase();
      return name.includes(form.therapistSearch.toLowerCase());
    }) : therapists,
    [therapists, form.therapistSearch]);

  const serviceAddons: ApiAddOn[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ApiAddOn[] = [];
    for (const svc of selectedServices) {
      for (const a of svc.add_ons ?? []) {
        if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
      }
    }
    return out;
  }, [selectedServices]);
  const allAddons = useMemo(() => {
    const ids = new Set(serviceAddons.map(a => a.id));
    return [...serviceAddons, ...globalAddons.filter(a => !ids.has(a.id))];
  }, [serviceAddons, globalAddons]);

  const servicePrice      = selectedServices.reduce(
    (sum, svc) => sum + (parseFloat(String(svc.arrangement_price ?? svc.base_price ?? '0')) || 0), 0);
  const selectedAddons    = allAddons.filter(a => form.addonIds.includes(a.id));
  const addonTotal        = selectedAddons.reduce((s, a) => s + (parseFloat(String(a.price ?? '0')) || 0), 0);
  const addonDuration     = selectedAddons.reduce((s, a) => s + (a.duration_minutes ?? 0), 0);
  const extraMinutesUnit  = selectedService?.extra_minutes ?? 0;
  const extraPricePerUnit = parseFloat(String(selectedService?.price_for_extra_minutes ?? '0')) || 0;
  const baseDuration      = selectedServices.length > 0
    ? selectedServices.reduce((sum, svc) => sum + (svc.duration_minutes ?? 60), 0)
    : 60;

  // Extra time is offered only when the service defines both extra_minutes and
  // price_for_extra_minutes (> 0). Price = (mins / extra_minutes) * price_for_extra_minutes.
  const hasExtraTime = (Number(extraMinutesUnit) || 0) > 0 && extraPricePerUnit > 0;
  const calcExtraPrice = (mins: number) => {
    if (mins <= 0 || !hasExtraTime) return 0;
    return (mins / Number(extraMinutesUnit)) * extraPricePerUnit;
  };

  const extraMinutesPrice = calcExtraPrice(form.extraMinutes);
  const totalPrice        = servicePrice + addonTotal + extraMinutesPrice;
  const totalDuration     = (selectedService ? baseDuration : 0) + addonDuration + form.extraMinutes;
  const extraOptions      = [0, 30, 60] as const;

  // ── Duration validation against the free room time ──────────────────────────
  const durationExceeded = exceedsMaxDuration(totalDuration, maxDuration);
  const durationMsg      = typeof maxDuration === 'number' ? maxDurationMessage(maxDuration) : '';
  /** Reason an unselected service can't be added (would overflow the free time) */
  const serviceDisabledReason = (svc: ApiService): string | null => {
    if (typeof maxDuration !== 'number') return null;
    const added = svc.duration_minutes ?? 60;
    const base  = selectedServices.length === 0 ? 0 : totalDuration;
    return base + added > maxDuration ? durationMsg : null;
  };
  const addonDisabledReason = (a: ApiAddOn): string | null => {
    if (typeof maxDuration !== 'number') return null;
    return totalDuration + (a.duration_minutes ?? 0) > maxDuration ? durationMsg : null;
  };
  const extraDisabledReason = (mins: number): string | null => {
    if (typeof maxDuration !== 'number') return null;
    return totalDuration - form.extraMinutes + mins > maxDuration ? durationMsg : null;
  };

  useEffect(() => {
    if (!hasExtraTime && form.extraMinutes !== 0) setForm(p => ({ ...p, extraMinutes: 0 }));
  }, [hasExtraTime, form.extraMinutes]);

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
    // Every selected service must be performed by the same therapist → intersect the lists.
    const ids = form.serviceIds.length > 0 ? form.serviceIds : [form.serviceId];
    Promise.all(ids.map(id =>
      authedFetch(`/api/v1/services/${id}/therapists?${qs}`, { headers: authHeader ? { Authorization: authHeader } : undefined })
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : (d.data ?? d.results ?? [])) as ApiTherapist[]),
    ))
      .then(lists => {
        let common = lists[0] ?? [];
        for (let i = 1; i < lists.length; i++) {
          const ids_i = new Set(lists[i].map(t => t.id));
          common = common.filter(t => ids_i.has(t.id));
        }
        setTherapists(common);
        // Drop a previously chosen therapist that can't do every selected service
        setForm(p => (p.therapistId && !common.some(t => t.id === p.therapistId))
          ? { ...p, therapistId: '', therapistSearch: '' } : p);
      })
      .catch(() => setTherapists([]))
      .finally(() => setTherapistsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.serviceIds, authHeader]);

  // Customer search (debounced)
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

  const toggleAddon     = (id: string) =>
    setForm(p => ({ ...p, addonIds: p.addonIds.includes(id) ? p.addonIds.filter(x => x !== id) : [...p.addonIds, id] }));
  /** Tick / un-tick a service (multi-select). The first ticked service is the primary one. */
  const toggleService   = (s: ApiService) =>
    setForm(p => {
      const has = p.serviceIds.includes(s.id);
      const serviceIds = has ? p.serviceIds.filter(x => x !== s.id) : [...p.serviceIds, s.id];
      return { ...p, serviceIds, serviceId: serviceIds[0] ?? '', therapistId: '', therapistSearch: '' };
    });
  const clearService    = () =>
    setForm(p => ({ ...p, serviceId: '', serviceIds: [], serviceSearch: '', therapistId: '', therapistSearch: '', addonIds: [], extraMinutes: 0 }));
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
    setCustomers(prev => [asApiCustomer, ...prev.filter(c => String(c.id ?? (c as any).customer_id ?? '') !== id)]);
    selectCustomer(asApiCustomer);
  };

  const goNext = () => {
    if (!form.serviceId) { setSubmitError('Please select a service.'); return; }
    if (durationExceeded) { setSubmitError(durationMsg); return; }
    setSubmitError(null); setStep(2);
  };
  const goNextToStep3 = () => {
    if (!form.customerId) { setSubmitError('Please select a customer.'); return; }
    setSubmitError(null); setStep(3);
  };
  const goBack = () => {
    setSubmitError(null);
    setForm(p => ({ ...p, therapistId: '', therapistSearch: '' }));
    setStep(1);
  };
  const goBackFromStep3 = () => {
    setSubmitError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { setSubmitError('Please select a customer.'); return; }
    if (durationExceeded) { setSubmitError(durationMsg); return; }
    setSubmitting(true); setSubmitError(null);

    const svc           = selectedService!;
    const svcCategory   = svc.category ?? '';
    const baseP         = servicePrice; // sum of all selected services
    const primaryDuration = svc.duration_minutes ?? 60;
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
      baseDuration: primaryDuration,
      service_data: {
        service_id:       svc.id,
        service_name:     svc.name,
        service_category: svcCategory,
        base_price:       fmtPriceB(svc.base_price),
        arrangement_price: fmtPriceB(svc.arrangement_price ?? svc.base_price),
        duration_minutes: primaryDuration,
      },
      // Multi-service booking: all services share the same room and therapist.
      ...(selectedServices.length > 1 ? {
        services: selectedServices.map((sv) => ({
          service_id:       sv.id,
          service_name:     sv.name,
          service_category: sv.category ?? '',
          base_price:       fmtPriceB(sv.arrangement_price ?? sv.base_price),
          base_duration:    sv.duration_minutes ?? 60,
          service_data: {
            service_id:        sv.id,
            service_name:      sv.name,
            service_category:  sv.category ?? '',
            base_price:        fmtPriceB(sv.base_price),
            arrangement_price: fmtPriceB(sv.arrangement_price ?? sv.base_price),
            duration_minutes:  sv.duration_minutes ?? 60,
          },
          ...(arrangement.id ? {
            service_arrangement_id: arrangement.id,
            service_arrangement_data: {
              arrangement_id:   arrangement.id,
              arrangement_name: arrangement.name,
              arrangement_type: arrangement.arrangementType,
              ...(arrangement.capacity ? { capacity: arrangement.capacity } : {}),
            },
          } : {}),
        })),
      } : {}),
      branch_id:        arrangement.branchId,
      branch_data: {
        branch_id:      arrangement.branchId,
        branch_name:    arrangement.branchName,
        branch_address: arrangement.branchName,
      },
      ...(arrangement.id ? {
        service_arrangement_id:   arrangement.id,
        service_arrangement_data: {
          arrangement_id:   arrangement.id,
          arrangement_name: arrangement.name,
          arrangement_type: arrangement.arrangementType,
          ...(arrangement.capacity ? { capacity: arrangement.capacity } : {}),
        },
      } : {}),
      therapist_id:   form.therapistId || null,
      therapist_data: therapistName ? {
        therapist_id:   form.therapistId || null,
        therapist_name: therapistName,
        ...(selectedTherapist?.avatar || selectedTherapist?.photo_url ? { photo_url: selectedTherapist.avatar || selectedTherapist.photo_url } : {}),
        ...(selectedTherapist?.specialization || selectedTherapist?.specialties?.[0]?.name ? { specialization: selectedTherapist.specialization || selectedTherapist?.specialties?.[0]?.name } : {}),
      } : null,
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
      ...(() => {
        const w = buildAppointmentWindow(date, timeHHMM, totalDuration);
        return {
          timezone:          w.timezone,
          appointment_date:  w.appointment_date,
          appointment_start: w.appointment_start,
          appointment_end:   w.appointment_end,
        };
      })(),
      customer_id:      form.customerId,
      customer_data: customerName ? {
        customer_id:   form.customerId,
        customer_name: customerName,
        phone_number:  selectedCustomer?.phone_number ?? null,
        email:         selectedCustomer?.email ?? null,
        ...(selectedCustomer?.avatar ? { avatar: selectedCustomer.avatar } : {}),
      } : null,
      customerMessage:  '',
      customer_notes:   form.notes,
      booking_type:     'branch_service',
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
      status:           'confirmed',
      payment_status:   'pending',
      payment_through:  'ushdesk',
      payment_provider: null,
      payment_gateway:  null,
      payment_method:   paymentOption === 'pay_on_branch' ? 'on_branch' : 'pay_now',
      source:           'ushdesk',
      transaction_id:   null,
      reference_id:     null,
      invoice_id:       null,
      invoice_number:   null,
      invoice_reference: null,
      receipt_image:    null,
      transaction_date: null,
      paid_at:          null,
      payment_data:     null,
      payments_data:    null,
    };

    try {
      const res  = await authedFetch('/booknpay/api/v1/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body:    JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errObj = json as Record<string, unknown>;
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
      setBookingId(rid);

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
      const extractedInvoiceNumber = String(
        raw.invoice_number ??
        (raw.payment_data as Record<string, unknown>)?.invoice_number ??
        (raw.payments_data as Record<string, unknown>)?.invoice_number ??
        ''
      ).replace('null', '').replace('undefined', '').trim();

      const extractedInvoiceId = String(
        raw.invoice_id ??
        (raw.payment_data as Record<string, unknown>)?.invoice_id ??
        (raw.payments_data as Record<string, unknown>)?.invoice_id ??
        ''
      ).replace('null', '').replace('undefined', '').trim();

      if (paymentOption === 'pay_now') {
        setCreatedBookingInfo({
          id: rid,
          bookingNumber: String(raw.booking_number ?? raw.bookings_id ?? rid),
          invoiceId: extractedInvoiceId || undefined,
          invoiceNumber: extractedInvoiceNumber || undefined,
          amount: fmtPriceB(totalPrice),
          customerName: cNameSnap,
          customerPhone: cSnap?.phone_number ?? '',
        });
        setShowMakePayment(true);
        onSuccess();
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
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

  // If payment modal is opened for "Pay now", close the booking popup window and render MakePaymentModal
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
        invoiceId={createdBookingInfo.invoiceId}
        invoiceNumber={createdBookingInfo.invoiceNumber}
        amount={createdBookingInfo.amount}
        customerName={createdBookingInfo.customerName}
        customerPhone={createdBookingInfo.customerPhone}
        initialProviderId="knet_card"
        onSuccess={() => {
          setShowMakePayment(false);
          onSuccess();
          onClose();
        }}
      />
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl h-[88vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-accent shrink-0" />

        {/* Top header */}
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border/40 px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">New Branch Booking</p>
            <div className="flex items-center gap-1 ml-2">
              {([1, 2, 3] as const).map((n) => (
                <span key={n} className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold transition',
                  step === n ? 'bg-primary text-white shadow-sm' : step > n ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                )}>
                  {step > n ? <CheckCircle2 className="h-3 w-3" /> : n}
                </span>
              ))}
              <span className="text-[11px] text-muted-foreground font-medium ml-1">
                {step === 1 ? 'Service & Add-ons' : step === 2 ? 'Customer & Notes' : 'Payment Option'}
              </span>
            </div>
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
                {isDirect && (
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                    Direct Booking
                  </span>
                )}
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
                  <MultiSelectDrop<ApiService>
                    items={filteredServices}
                    selectedIds={form.serviceIds}
                    getId={(s) => String(s.id ?? '')}
                    search={form.serviceSearch}
                    placeholder={servicesLoading ? 'Loading services\u2026' : 'Search & tick one or more services\u2026'}
                    loading={servicesLoading}
                    icon={Scissors}
                    onSearch={(q) => setForm(p => ({ ...p, serviceSearch: q }))}
                    onToggle={toggleService}
                    getDisabledReason={serviceDisabledReason}
                    renderItem={(s, checked) => (
                      <div className="flex items-start gap-3 py-3 pr-4">
                        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Scissors className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {checked && selectedServices.length > 1 && (
                              <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-black shrink-0">
                                #{form.serviceIds.indexOf(s.id) + 1}
                              </span>
                            )}
                            <p className="text-sm font-semibold truncate">{s.name}</p>
                          </div>
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
                        {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />}
                      </div>
                    )}
                  />
                  {typeof maxDuration === 'number' && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Available time from {timeSlot}: <span className="font-bold text-foreground">{maxDuration} min</span>
                      {' · '}Selected: <span className={cn('font-bold', durationExceeded ? 'text-destructive' : 'text-foreground')}>{totalDuration} min</span>
                    </p>
                  )}
                  {selectedServices.map((svc, idx) => (
                    <div key={svc.id} className="mt-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {selectedServices.length > 1 && (
                            <span className="rounded-md bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-black shrink-0">
                              #{idx + 1}
                            </span>
                          )}
                          <p className="text-xs font-bold text-primary truncate">{svc.name}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {svc.duration_minutes && <span>{svc.duration_minutes} min</span>}
                          {svc.category && <span> · {svc.category}</span>}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-primary">
                        {fmtPriceB(svc.arrangement_price ?? svc.base_price)} KWD
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleService(svc)}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted transition"
                        aria-label={`Remove ${svc.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
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
                        const blocked = !active && Boolean(extraDisabledReason(mins));
                        return (
                          <button
                            key={mins}
                            type="button"
                            disabled={blocked}
                            title={blocked ? durationMsg : undefined}
                            onClick={() => setForm(p => ({ ...p, extraMinutes: mins }))}
                            className={cn(
                              'flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-center transition cursor-pointer',
                              blocked && 'opacity-45 cursor-not-allowed',
                              active
                                ? 'border-primary/50 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30'
                                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                            )}
                          >
                            <p className="text-sm font-extrabold">{mins === 0 ? 'None' : `${mins} min`}</p>
                            <p className="text-[11px] font-semibold mt-0.5 opacity-80">
                              {mins === 0 ? '+0 KWD' : `+${fmtPriceB(price)} KWD`}
                            </p>
                          </button>
                        );
                      })}
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
                      const addonBlocked = !checked && Boolean(addonDisabledReason(addon));
                      return (
                        <label key={addon.id} title={addonBlocked ? durationMsg : undefined} className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                          addonBlocked && 'opacity-45 cursor-not-allowed',
                          checked ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-muted/20 hover:border-border/80 hover:bg-muted/40',
                        )}>
                          <input type="checkbox" checked={checked} disabled={addonBlocked} onChange={() => toggleAddon(addon.id)}
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
                    getKey={(t, idx) => String(t.id ?? (t as any).therapist_id ?? (t as any).pk ?? idx)}
                    isSelected={(t) => String(t.id ?? '') === form.therapistId}
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
                  <div className="flex items-center justify-between mb-1">
                    <BFormLabel>Search &amp; Select Customer *</BFormLabel>
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
                  <BSearchDropdown<ApiCustomer>
                    value={form.customerSearch}
                    placeholder="Search by name or phone\u2026"
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
                        {([selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || selectedCustomer.full_name || 'Customer'} selected
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

            {/* STEP 3: Payment Option */}
            {step === 3 && (
              <div className="px-6 py-5 space-y-5">
                <div>
                  <h3 className="text-sm font-extrabold text-foreground mb-1">Select Payment Option</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose how the customer will settle this booking.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setPaymentOption('pay_on_branch')}
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl border-2 p-4 cursor-pointer transition select-none',
                      paymentOption === 'pay_on_branch'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="radio"
                      name="branch-payment-option"
                      value="pay_on_branch"
                      checked={paymentOption === 'pay_on_branch'}
                      onChange={() => setPaymentOption('pay_on_branch')}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-foreground">Pay on Branch</p>
                          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            In-person payment
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        paymentOption === 'pay_on_branch' ? 'border-amber-500' : 'border-muted-foreground/30'
                      )}>
                        {paymentOption === 'pay_on_branch' && (
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Booking will be confirmed immediately. The customer will pay at the branch counter when arriving or completing their appointment.
                    </p>
                  </div>

                  <div
                    onClick={() => setPaymentOption('pay_now')}
                    className={cn(
                      'relative flex flex-col justify-between rounded-2xl border-2 p-4 cursor-pointer transition select-none',
                      paymentOption === 'pay_now'
                        ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    )}
                  >
                    <input
                      type="radio"
                      name="branch-payment-option"
                      value="pay_now"
                      checked={paymentOption === 'pay_now'}
                      onChange={() => setPaymentOption('pay_now')}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-foreground">Pay Now</p>
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            Payment Link
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        paymentOption === 'pay_now' ? 'border-primary' : 'border-muted-foreground/30'
                      )}>
                        {paymentOption === 'pay_now' && (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Confirm booking and immediately open the payment link creator. Choose provider (MyFatoorah, etc.) and share link with customer.
                    </p>
                  </div>
                </div>

                {/* Summary card before submitting */}
                <div className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden divide-y divide-border/40">
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Booking Summary</span>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {selectedServices.length} {selectedServices.length === 1 ? 'Service' : 'Services'} · {totalDuration} min
                    </span>
                  </div>

                  {/* Services List */}
                  <div className="divide-y divide-border/30">
                    {selectedServices.map((svc, idx) => (
                      <div key={svc.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Scissors className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {selectedServices.length > 1 && (
                                <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-black shrink-0">
                                  #{idx + 1}
                                </span>
                              )}
                              <p className="text-xs font-bold text-foreground truncate">{svc.name}</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {svc.duration_minutes ?? 60} min{svc.category ? ` · ${svc.category}` : ''}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-extrabold text-foreground shrink-0 ml-3">
                          {fmtPriceB(svc.arrangement_price ?? svc.base_price)} <span className="text-[10px] font-semibold text-muted-foreground">KWD</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Add-ons List (if any selected) */}
                  {selectedAddons.length > 0 && (
                    <div className="bg-primary/[0.02] px-4 py-2.5 border-t border-border/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <Package className="h-3 w-3" />
                          <span>Add-ons ({selectedAddons.length})</span>
                        </p>
                        <span className="text-[11px] font-extrabold text-primary">+{fmtPriceB(addonTotal)} KWD</span>
                      </div>
                      <div className="space-y-1">
                        {selectedAddons.map((addon) => (
                          <div key={addon.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <Sparkles className="h-3 w-3 text-primary shrink-0" />
                              <span className="text-xs font-medium text-foreground truncate">{addon.name}</span>
                              {addon.duration_minutes ? (
                                <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                                  (+{addon.duration_minutes} min)
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs font-bold text-foreground shrink-0 ml-2">
                              +{fmtPriceB(addon.price ?? 0)} KWD
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extra Time (if selected) */}
                  {form.extraMinutes > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/[0.04] border-t border-border/40">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Timer className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Extra Time</p>
                          <p className="text-[10px] text-muted-foreground">+{form.extraMinutes} minutes duration</p>
                        </div>
                      </div>
                      <p className="text-xs font-extrabold text-foreground shrink-0">
                        +{fmtPriceB(extraMinutesPrice)} <span className="text-[10px] font-semibold text-muted-foreground">KWD</span>
                      </p>
                    </div>
                  )}

                  {/* Customer & Appointment Schedule */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-6 w-6 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {selectedCustomer ? (([selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')) || selectedCustomer.full_name) : 'Customer'}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{selectedCustomer?.phone_number || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <p className="text-xs font-bold text-foreground">{date}</p>
                      <p className="text-[11px] text-muted-foreground font-semibold">{timeSlot}</p>
                    </div>
                  </div>

                  {/* Price Breakdown & Total Payable */}
                  <div className="px-4 py-3 bg-muted/40 border-t border-border/40 space-y-2">
                    {(selectedAddons.length > 0 || form.extraMinutes > 0) && (
                      <div className="space-y-1 pb-2 border-b border-border/40 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Services Subtotal ({selectedServices.length}):</span>
                          <span className="font-semibold text-foreground">{fmtPriceB(servicePrice)} KWD</span>
                        </div>
                        {selectedAddons.length > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Add-ons ({selectedAddons.length}):</span>
                            <span className="font-semibold text-primary">+{fmtPriceB(addonTotal)} KWD</span>
                          </div>
                        )}
                        {form.extraMinutes > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Extra Time (+{form.extraMinutes} min):</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPriceB(extraMinutesPrice)} KWD</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">Total Payable</span>
                        {(selectedAddons.length > 0 || form.extraMinutes > 0) && (
                          <span className="text-[10px] text-muted-foreground">Includes all services, add-ons and extra time</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-primary">{fmtPriceB(totalPrice)}</span>
                        <span className="text-xs font-bold text-primary ml-1">KWD</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  <p className="text-[10px] text-muted-foreground truncate">
                    {selectedServices.length > 1 ? `${selectedServices.length} services` : selectedService.name}
                  </p>
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Duration</p>
                  <p className="text-xs font-bold text-foreground">{totalDuration} min</p>
                </div>
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
            {submitError && (
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
                <button type="button" onClick={goNextToStep3}
                  disabled={!form.customerId}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  Next: Payment <ChevronRight className="h-4 w-4" />
                </button>
              </>)}
              {step === 3 && (<>
                <button type="button" onClick={goBackFromStep3}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <button type="submit" form="branch-booking-form"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {submitting ? 'Confirming…' : 'Confirm Booking'}
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
