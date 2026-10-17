'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CalendarDays, Clock, Building2, MapPin, Scissors,
  AlertCircle, CheckCircle2, Loader2, X, Hash, CreditCard,
  User, Sparkles, Crown, Heart, LayoutGrid, Layers, Store, RefreshCw, Gift,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { kuwaitDateString, toZonedIsoFromLocal, DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { useAppSelector } from '@/store/hooks';

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
  branch_id?: string;
  branch_name?: string;
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
  availabilities?: Record<string, string[]>;
}

function firstTruthy(...args: unknown[]): string {
  for (const a of args) {
    if (a !== undefined && a !== null && String(a).trim() !== '') return String(a).trim();
  }
  return '';
}

function fmtPrice(val: unknown): string {
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

const TYPE_ICONS: Record<string, React.ElementType> = {
  open_area:     LayoutGrid,
  vip_suite:     Crown,
  couple_room:   Heart,
  single_room:   Sparkles,
  private_suite: Layers,
  other:         Store,
};

function isSimilarArrangementType(typeA: string, typeB: string): boolean {
  if (!typeA || !typeB) return true;
  const a = typeA.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = typeB.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a === b) return true;
  const categories = ['vip', 'couple', 'single', 'open', 'private'];
  for (const cat of categories) {
    if (a.includes(cat) && b.includes(cat)) return true;
  }
  return a.includes(b) || b.includes(a);
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
      {/* Month Navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-xl border border-border/60 transition cursor-pointer',
            canGoPrev ? 'hover:bg-muted text-foreground' : 'opacity-25 cursor-not-allowed text-muted-foreground'
          )}
          title="Previous month"
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
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="text-[10px] font-bold text-muted-foreground py-0.5">
            {d}
          </span>
        ))}
      </div>

      {/* Days grid */}
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

  // ── Derived Voucher Info ───────────────────────────────────────────────
  const [resolvedInvoiceNumber, setResolvedInvoiceNumber] = useState<string | undefined>(
    firstTruthy(
      propsInvoiceNumber,
      voucher.invoice_number,
      voucher.invoice_id,
      voucher.payment_data?.invoice_number,
      voucher.payment_data?.invoiceId,
      voucher.payment_data?.data?.InvoiceId
    ) || undefined
  );

  const [resolvedPaymentNumber, setResolvedPaymentNumber] = useState<string | undefined>(
    firstTruthy(
      propsPaymentNumber,
      voucher.payment_number,
      voucher.payment_data?.payment_number,
      voucher.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentId,
      voucher.payment_data?.data?.PaymentId
    ) || undefined
  );

  useEffect(() => {
    if ((!resolvedInvoiceNumber || !resolvedPaymentNumber) && voucher.id) {
      authedFetch(`/booknpay/api/v1/payments/?voucher_id=${voucher.id}`)
        .then((r) => r.json())
        .then((res) => {
          const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
          const latest = items?.[0];
          if (latest) {
            if (!resolvedInvoiceNumber && latest.invoice_number) {
              setResolvedInvoiceNumber(String(latest.invoice_number));
            }
            if (!resolvedPaymentNumber && latest.payment_number) {
              setResolvedPaymentNumber(String(latest.payment_number));
            }
          }
        })
        .catch(() => {});
    }
  }, [voucher.id, resolvedInvoiceNumber, resolvedPaymentNumber]);

  const resolvedPaymentGateway = firstTruthy(
    voucher.payment_gateway,
    voucher.payment_data?.payment_gateway,
    voucher.payment_data?.gateway,
    voucher.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentGateway,
    voucher.payment_provider,
    'KNET'
  );

  const resolvedPaymentProvider = firstTruthy(
    voucher.payment_provider,
    voucher.payment_data?.payment_provider,
    voucher.payment_data?.provider,
    'MyFatoorah'
  );

  const resolvedPaymentMethod = firstTruthy(
    voucher.payment_method,
    voucher.payment_data?.payment_method,
    voucher.payment_data?.method,
    'voucher'
  );

  const resolvedPaymentThrough = firstTruthy(
    voucher.payment_through,
    voucher.payment_data?.payment_through,
    'ushdesk'
  );

  const resolvedPaymentId = firstTruthy(
    voucher.payment_id,
    voucher.payment_data?.payment_id,
    voucher.payment_data?.id,
    voucher.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentId
  ) || undefined;
  const serviceId = firstTruthy(
    voucher.service_id,
    voucher.service_data?.id,
    voucher.service_data?.service_id
  );
  const serviceName = firstTruthy(
    voucher.service_data?.name,
    voucher.service_data?.service_name,
    'Spa Service'
  );
  const serviceCategory = firstTruthy(
    voucher.service_data?.category,
    voucher.service_data?.service_category
  );
  const durationVal = parseInt(
    String(voucher.total_duration ?? voucher.service_data?.duration_minutes ?? 60),
    10
  ) || 60;
  const totalPrice = voucher.total_amount ?? voucher.service_data?.base_price ?? '0';
  const currency = firstTruthy(voucher.currency, 'KWD');

  const originalBranchId = firstTruthy(
    voucher.branch_id,
    voucher.branch_data?.branch_id,
    voucher.branch_data?.id
  );
  const originalArrangementId = firstTruthy(
    voucher.service_arrangement_id,
    voucher.service_arrangement_data?.id,
    voucher.service_arrangement_data?.arrangement_id
  );
  const requiredArrType = firstTruthy(
    voucher.service_arrangement_data?.arrangement_type,
    voucher.service_arrangement_data?.type,
    'room'
  );

  const recipientName = firstTruthy(
    voucher.recipient_details?.name,
    voucher.recipient_data?.name,
    'Recipient'
  );
  const recipientPhone = firstTruthy(
    voucher.recipient_phone,
    voucher.recipient_details?.phone_number,
    voucher.recipient_data?.phone_number
  );
  const recipientEmail = firstTruthy(
    voucher.recipient_details?.email,
    voucher.recipient_data?.email
  );

  const voucherCode = firstTruthy(
    voucher.voucher_number,
    voucher.secret_code,
    voucher.id ? voucher.id.slice(0, 8) : ''
  );

  // Timezone-aware expiry date string
  const expireDateWithTz = useMemo(() => {
    return toZonedIsoFromLocal(voucher.expire_date);
  }, [voucher.expire_date]);

  const expireDateDay = useMemo(() => {
    return voucher.expire_date ? voucher.expire_date.split('T')[0] : '';
  }, [voucher.expire_date]);

  // Today in Kuwait
  const todayStr = useMemo(() => kuwaitDateString(), []);

  // ── States ────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(originalBranchId);

  const availabilitiesCache = useRef<Record<string, any>>({});
  const inFlightRequests = useRef<Record<string, Promise<any> | undefined>>({});
  const [availabilitiesData, setAvailabilitiesData] = useState<any>(null);
  const [availabilitiesLoading, setAvailabilitiesLoading] = useState(false);
  const [availabilitiesError, setAvailabilitiesError] = useState<string | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<AnyRecord | null>(null);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper to fetch and parse JSON with authedFetch
  const fetchJson = useCallback(async (url: string, init?: RequestInit): Promise<any> => {
    const res = await authedFetch(url, {
      ...init,
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
  }, [authHeader]);

  // ── 1. Fetch Branches for dropdown ────────────────────────────────────
  useEffect(() => {
    fetchJson('/api/v1/branches/')
      .then((data) => {
        const list: ApiBranch[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        setBranches(list);
      })
      .catch(() => setBranches([]));
  }, [fetchJson]);

  // ── 2. Handle Initial Availabilities Promise if passed ─────────────────
  useEffect(() => {
    if (!initialAvailabilitiesPromise || !originalBranchId) return;
    const bId = originalBranchId;
    inFlightRequests.current[bId] = initialAvailabilitiesPromise;
    setAvailabilitiesLoading(true);

    let active = true;
    initialAvailabilitiesPromise
      .then((data) => {
        if (!active || !data) return;
        availabilitiesCache.current[bId] = data;
        setAvailabilitiesData(data);
      })
      .catch((err) => {
        if (!active) return;
        setAvailabilitiesError(err instanceof Error ? err.message : 'Failed to load voucher availabilities');
      })
      .finally(() => {
        delete inFlightRequests.current[bId];
        if (active) setAvailabilitiesLoading(false);
      });

    return () => { active = false; };
  }, [initialAvailabilitiesPromise, originalBranchId]);

  // ── 3. Fetch Availabilities for Branch via POST ────────────────────────
  const fetchAvailabilitiesForBranch = useCallback(async (branchIdToFetch: string) => {
    if (!branchIdToFetch) return;

    // 1. Check in-memory cache
    if (availabilitiesCache.current[branchIdToFetch]) {
      setAvailabilitiesData(availabilitiesCache.current[branchIdToFetch]);
      setAvailabilitiesError(null);
      setAvailabilitiesLoading(false);
      return;
    }

    // 2. Check in-flight
    const activeReq = inFlightRequests.current[branchIdToFetch];
    if (activeReq) {
      setAvailabilitiesLoading(true);
      try {
        const data = await activeReq;
        if (data) {
          availabilitiesCache.current[branchIdToFetch] = data;
          setAvailabilitiesData(data);
        }
      } catch (err) {
        setAvailabilitiesError(err instanceof Error ? err.message : 'Failed to load availability');
      } finally {
        setAvailabilitiesLoading(false);
      }
      return;
    }

    // 3. Make POST request
    setAvailabilitiesLoading(true);
    setAvailabilitiesError(null);

    // If fetching for the original branch, we can specify service_arrangement_id;
    // for other branches, omit/null it so all branch arrangements are returned for matching.
    const isOrig = branchIdToFetch === originalBranchId;
    const payload = {
      service_id: serviceId,
      branch_id: branchIdToFetch,
      service_arrangement_id: isOrig && originalArrangementId ? originalArrangementId : null,
      expire_date: expireDateWithTz,
    };

    const promise = fetchJson('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((data) => {
        availabilitiesCache.current[branchIdToFetch] = data;
        setAvailabilitiesData(data);
        return data;
      })
      .catch((err) => {
        console.error('Failed to fetch voucher availabilities on branch change:', err);
        setAvailabilitiesError(err instanceof Error ? err.message : 'Failed to load branch availability');
        throw err;
      })
      .finally(() => {
        delete inFlightRequests.current[branchIdToFetch];
        setAvailabilitiesLoading(false);
      });

    inFlightRequests.current[branchIdToFetch] = promise;
  }, [serviceId, originalBranchId, originalArrangementId, expireDateWithTz, fetchJson]);

  // Trigger branch availabilities fetch on branch change
  useEffect(() => {
    if (!selectedBranchId) return;

    if (
      selectedBranchId === originalBranchId &&
      (initialAvailabilitiesPromise || availabilitiesCache.current[selectedBranchId] || inFlightRequests.current[selectedBranchId])
    ) {
      if (availabilitiesCache.current[selectedBranchId]) {
        setAvailabilitiesData(availabilitiesCache.current[selectedBranchId]);
      }
      return;
    }

    fetchAvailabilitiesForBranch(selectedBranchId);
  }, [selectedBranchId, fetchAvailabilitiesForBranch, originalBranchId, initialAvailabilitiesPromise]);

  // Ensure current branch from availabilitiesData is present in branches list
  useEffect(() => {
    if (!availabilitiesData?.branch) return;
    const b = availabilitiesData.branch;
    const bId = b.id ?? b.branch_id;
    if (bId) {
      setBranches((prev) => {
        if (prev.some((item) => (item.id ?? item.branch_id) === bId)) return prev;
        return [{ id: bId, branch_id: bId, name: b.name, branch_name: b.name }, ...prev];
      });
    }
  }, [availabilitiesData]);

  // ── Compute Compatible Arrangements from availabilitiesData ──────────
  const arrangements = useMemo<ApiArrangement[]>(() => {
    const list = Array.isArray(availabilitiesData?.service_arrangements)
      ? availabilitiesData.service_arrangements
      : Array.isArray(availabilitiesData?.arrangements)
      ? availabilitiesData.arrangements
      : [];
    return list.filter((a: any) => {
      const type = a.arrangement_type || a.type || '';
      return isSimilarArrangementType(type, requiredArrType);
    });
  }, [availabilitiesData, requiredArrType]);

  // Pre-select arrangement when arrangements change
  useEffect(() => {
    if (arrangements.length === 0) {
      setSelectedRoomId('');
      return;
    }
    if (selectedRoomId && arrangements.some((a) => a.id === selectedRoomId)) {
      return;
    }
    const matchOriginal = arrangements.find((a) => a.id === originalArrangementId);
    setSelectedRoomId(matchOriginal ? matchOriginal.id : arrangements[0].id);
  }, [arrangements, originalArrangementId, selectedRoomId]);

  // ── Compute Therapists from availabilitiesData ─────────────────────────
  const therapists = useMemo<ApiTherapist[]>(() => {
    return Array.isArray(availabilitiesData?.therapists)
      ? availabilitiesData.therapists
      : Array.isArray(availabilitiesData?.data?.therapists)
      ? availabilitiesData.data.therapists
      : [];
  }, [availabilitiesData]);

  // Reset timeslot and therapist when room or date changes
  useEffect(() => {
    setSelectedTimeSlot('');
    setSelectedTherapistId('');
    setSelectedTherapist(null);
  }, [selectedDate, selectedRoomId]);

  // ── Compute Available Timeslots for Selected Date & Room ───────────────
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

    // 1. Therapist slots union for the selected day
    const therapistSlotsForDay = new Set<number>();
    for (const t of therapists) {
      const tSlots: string[] = t.availabilities?.[selectedDate] || [];
      for (const s of tSlots) {
        therapistSlotsForDay.add(parseTimeToMinutes(s));
      }
    }

    // 2. Arrangement slots for the selected day
    const rawArrSlots: string[] = selArrangement.availabilities?.[selectedDate] || [];
    const arrangementSlotsForDay = new Set<number>(
      rawArrSlots.map((s) => parseTimeToMinutes(s))
    );

    // 3. Grid timeslot bounds
    const branchInfo = availabilitiesData?.branch;
    const openTime = branchInfo?.opening_time || '09:00:00';
    const closeTime = branchInfo?.closing_time || '23:00:00';
    const step = 30;

    const startMin = parseTimeToMinutes(openTime);
    let endMin = parseTimeToMinutes(closeTime);
    if (endMin <= startMin) {
      endMin = 23 * 60;
    }

    const allKnownMinutes = new Set<number>();
    for (let m = startMin; m < endMin; m += step) {
      allKnownMinutes.add(m);
    }
    therapistSlotsForDay.forEach((m) => allKnownMinutes.add(m));
    arrangementSlotsForDay.forEach((m) => allKnownMinutes.add(m));

    const sortedMinutes = Array.from(allKnownMinutes).sort((a, b) => a - b);

    const now = new Date();
    const isToday = selectedDate === todayStr;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: { time: string; available: boolean }[] = [];

    for (const m of sortedMinutes) {
      // If today, drop slots in the past
      if (isToday && m <= currentTotalMinutes) {
        continue;
      }

      const h = Math.floor(m / 60);
      const min = m % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;

      const isAvailableInTherapists = therapistSlotsForDay.has(m);
      const isAvailableInArrangement = arrangementSlotsForDay.has(m);
      const available = isAvailableInTherapists && isAvailableInArrangement;

      slots.push({ time: timeLabel, available });
    }

    setAvailableSlots(slots);
  }, [
    selectedDate,
    selectedRoomId,
    arrangements,
    therapists,
    availabilitiesData,
    todayStr,
  ]);

  // ── Available Therapists for Selected Timeslot ────────────────────────
  const availableTherapistsForSlot = useMemo<ApiTherapist[]>(() => {
    if (!selectedTimeSlot || !selectedDate || therapists.length === 0) return [];
    const slotMin = parseTimeToMinutes(selectedTimeSlot);
    return therapists.filter((t) => {
      const daySlots: string[] = t.availabilities?.[selectedDate] || [];
      return daySlots.some((s) => parseTimeToMinutes(s) === slotMin);
    });
  }, [selectedTimeSlot, selectedDate, therapists]);

  // ── Auto-Select Therapist when timeslot changes ───────────────────────
  useEffect(() => {
    if (availableTherapistsForSlot.length > 0) {
      // Keep existing selection if still available
      const exists = availableTherapistsForSlot.find(
        (t) => (t.id ?? t.therapist_id) === selectedTherapistId
      );
      if (exists) {
        setSelectedTherapist(exists);
      } else {
        const first = availableTherapistsForSlot[0];
        const tid = first.id ?? first.therapist_id ?? '';
        setSelectedTherapistId(tid);
        setSelectedTherapist(first);
      }
    } else {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
    }
  }, [availableTherapistsForSlot, selectedTherapistId]);

  // ── Available Dates list (between today and expire_date) ───────────────
  const dateOptions = useMemo<{ dateStr: string; label: string; weekday: string; dayNum: string; isToday: boolean }[]>(() => {
    const dates: { dateStr: string; label: string; weekday: string; dayNum: string; isToday: boolean }[] = [];
    const maxDate = expireDateDay || todayStr;
    const curr = new Date(todayStr);
    const end = new Date(maxDate);

    // Limit to max 60 visible quick dates
    let count = 0;
    while (curr <= end && count < 60) {
      const dStr = curr.toISOString().split('T')[0];
      const weekday = curr.toLocaleDateString('en-US', { weekday: 'short', timeZone: KUWAIT_TZ });
      const dayNum = curr.toLocaleDateString('en-US', { day: 'numeric', timeZone: KUWAIT_TZ });
      const month = curr.toLocaleDateString('en-US', { month: 'short', timeZone: KUWAIT_TZ });
      dates.push({
        dateStr: dStr,
        label: `${month} ${dayNum}`,
        weekday,
        dayNum,
        isToday: dStr === todayStr,
      });
      curr.setDate(curr.getDate() + 1);
      count++;
    }
    return dates;
  }, [todayStr, expireDateDay]);

  // ── Submit Booking & Redeem ───────────────────────────────────────────
  const handleConfirmRedeem = async () => {
    if (!selectedBranchId || !selectedRoomId || !selectedDate || !selectedTimeSlot || !selectedTherapistId) {
      setSubmitError('Please complete all selections (Branch, Room, Date, Timeslot, and Therapist)');
      return;
    }

    if (expireDateDay && selectedDate > expireDateDay) {
      setSubmitError(`Appointment date cannot be after voucher expiry date (${expireDateDay}).`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const selBranch = branches.find((b) => (b.id ?? b.branch_id) === selectedBranchId);
    const selRoom = arrangements.find((a) => a.id === selectedRoomId);
    const branchName = selBranch?.branch_name ?? selBranch?.name ?? 'Branch';
    const roomName = selRoom?.name ?? 'Room';
    const therapistName = getTherapistDisplayName(selectedTherapist);

    try {
      // 1. Create Booking in booknpay
      const bookingPayload = {
        customer_id: voucher.recipient_id || voucher.sender_id || null,
        customer_data: {
          id: voucher.recipient_id || voucher.sender_id || undefined,
          name: recipientName,
          phone_number: recipientPhone,
          email: recipientEmail,
        },
        service_id: serviceId,
        service_name: serviceName,
        service_data: voucher.service_data || {
          id: serviceId,
          name: serviceName,
          category: serviceCategory,
          duration_minutes: durationVal,
        },
        branch_id: selectedBranchId,
        branch_name: branchName,
        branch_data: {
          branch_id: selectedBranchId,
          name: branchName,
        },
        service_arrangement_id: selectedRoomId,
        arrangement_name: roomName,
        arrangement_type: selRoom?.arrangement_type || requiredArrType,
        service_arrangement_data: selRoom,
        therapist_id: selectedTherapistId,
        therapist_name: therapistName,
        therapist_data: selectedTherapist,
        appointment_date: selectedDate,
        appointment_time: toHHMM(selectedTimeSlot),
        booking_type: 'branch_service',
        payment_type: 'gift_voucher',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: resolvedPaymentMethod,
        payment_gateway: resolvedPaymentGateway,
        payment_provider: resolvedPaymentProvider,
        payment_through: resolvedPaymentThrough,
        payment_id: resolvedPaymentId,
        payment_number: resolvedPaymentNumber,
        invoice_number: resolvedInvoiceNumber,
        total_price: totalPrice,
        currency,
        total_duration: durationVal,
        payment_data: {
          ...(voucher.payment_data || {}),
          invoice_number: resolvedInvoiceNumber,
          payment_number: resolvedPaymentNumber,
          payment_gateway: resolvedPaymentGateway,
          payment_provider: resolvedPaymentProvider,
          payment_method: resolvedPaymentMethod,
          payment_through: resolvedPaymentThrough,
          payment_id: resolvedPaymentId,
          is_paid: true,
          status: 'success',
          voucher_id: voucher.id,
          voucher_number: voucher.voucher_number || voucherCode,
        },
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
        customer_notes: `Redeemed from Gift Voucher #${voucherCode}`,
        created_by_user: currentUser?.id,
        created_by_user_data: currentUser ? { id: currentUser.id, name: currentUser.name || (currentUser as any).username || '' } : undefined,
      };

      const bookingRes = await fetchJson('/booknpay/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      const newBooking = bookingRes?.data || bookingRes;
      const newBookingId = newBooking?.id || newBooking?.booking_id;

      if (!newBookingId) {
        throw new Error(bookingRes?.detail || 'Failed to create booking for voucher redemption');
      }

      // 2. Update Voucher Status to redeemed
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
          appointment_time: selectedTimeSlot,
          therapist_id: selectedTherapistId,
          therapist_name: therapistName,
          therapist_data: selectedTherapist,
          branch_id: selectedBranchId,
          branch_name: branchName,
          branch_data: { branch_id: selectedBranchId, name: branchName },
          service_arrangement_id: selectedRoomId,
          arrangement_name: roomName,
          service_arrangement_data: selRoom,
        },
        redeemed_by: currentUser?.id,
      };

      await fetchJson(`/booknpay/api/v1/vouchers/${voucher.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voucherUpdatePayload),
      }).catch(async () => {
        // Fallback to /status/ route if main patch errors
        return fetchJson(`/booknpay/api/v1/vouchers/${voucher.id}/status/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(voucherUpdatePayload),
        });
      });

      setBookingSuccess(newBooking);
      onSuccess?.();
    } catch (err) {
      console.error('Error redeeming voucher:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to redeem voucher and book appointment');
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
        {/* Header Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/50 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-foreground tracking-tight">Redeem Gift Voucher</h2>
                {voucherCode && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                    <Hash className="h-2.5 w-2.5" />
                    {voucherCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Select branch, room, date and timeslot to schedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {bookingSuccess ? (
            /* Success State */
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Voucher Successfully Redeemed!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  The appointment has been confirmed and the voucher is now marked as redeemed.
                </p>
              </div>

              <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-2 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking Number:</span>
                  <span className="font-bold text-foreground">
                    {bookingSuccess.booking_number || bookingSuccess.number || bookingSuccess.id?.slice(0, 8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time:</span>
                  <span className="font-bold text-foreground">{selectedDate} at {selectedTimeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient:</span>
                  <span className="font-bold text-foreground">{recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Therapist:</span>
                  <span className="font-bold text-foreground">{getTherapistDisplayName(selectedTherapist)}</span>
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
              {/* ── Voucher Summary Card ── */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Scissors className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Covered Service</span>
                  </div>
                  <p className="text-sm font-bold truncate text-foreground">{serviceName}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {serviceCategory && <span>{serviceCategory}</span>}
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                      • <Clock className="h-3 w-3" /> {durationVal} mins
                    </span>
                    {recipientName && (
                      <span className="inline-flex items-center gap-1">
                        • <User className="h-3 w-3" /> {recipientName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    {fmtPrice(totalPrice)} <span className="text-[10px] font-semibold">{currency}</span>
                  </p>
                  {expireDateDay && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Expires: <span className="font-semibold text-foreground/80">{expireDateDay}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ── Branch Selection ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-500" />
                    Branch
                  </label>
                  {availabilitiesLoading && (
                    <span className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                      <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                      Checking branch availability…
                    </span>
                  )}
                </div>

                {availabilitiesError && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>{availabilitiesError}</span>
                  </div>
                )}

                <div className="relative">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border/70 bg-card px-3.5 py-2.5 pr-8 text-sm font-semibold shadow-sm focus:border-primary focus:outline-none transition cursor-pointer"
                  >
                    <option value="" disabled>Select a branch</option>
                    {branches.map((b) => {
                      const bId = b.id ?? b.branch_id ?? '';
                      const bName = b.branch_name ?? b.name ?? bId;
                      return (
                        <option key={bId} value={bId}>
                          {bName}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* ── Room / Arrangement Selection ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-amber-500" />
                    Room / Arrangement
                  </label>
                  {requiredArrType && (
                    <span className="text-[11px] text-muted-foreground">
                      Required type: <strong className="capitalize text-foreground">{requiredArrType.replace(/_/g, ' ')}</strong>
                    </span>
                  )}
                </div>

                {availabilitiesLoading ? (
                  <div className="flex items-center gap-2 py-3 px-4 rounded-xl border border-border/50 bg-muted/20 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    Checking available rooms…
                  </div>
                ) : arrangements.length === 0 ? (
                  /* Similar to RescheduleBookingModal: show no room available if arrangement type is not present */
                  <div className="rounded-2xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-extrabold text-sm mb-0.5">No room available</p>
                      <p>
                        This branch does not have any room or arrangement matching the required voucher type{' '}
                        <strong>({requiredArrType.replace(/_/g, ' ')})</strong>. Please select another branch.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {arrangements.map((arr) => {
                      const isSel = arr.id === selectedRoomId;
                      const IconComp = TYPE_ICONS[arr.arrangement_type ?? arr.type ?? ''] ?? Building2;
                      return (
                        <button
                          key={arr.id}
                          type="button"
                          onClick={() => setSelectedRoomId(arr.id)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer',
                            isSel
                              ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                              : 'border-border/70 bg-card hover:bg-muted/40'
                          )}
                        >
                          <div className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                            isSel ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                          )}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{arr.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {(arr.arrangement_type ?? arr.type ?? 'Room').replace(/_/g, ' ')}
                              {arr.capacity ? ` • Cap: ${arr.capacity}` : ''}
                            </p>
                          </div>
                          {isSel && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Date & Timeslot Section ── */}
              {selectedRoomId && (
                <div className="space-y-4 pt-2 border-t border-border/40">
                  {/* Date Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                        Select Date
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Selected: <strong className="text-foreground">{selectedDate}</strong>
                      </span>
                    </div>

                    {/* Interactive Calendar View */}
                    <VoucherCalendarPicker
                      value={selectedDate}
                      onChange={(d) => setSelectedDate(d)}
                      minDate={todayStr}
                      maxDate={expireDateDay || undefined}
                    />
                  </div>

                  {/* Timeslots */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-500" />
                        Available Timeslots
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        {availableSlots.filter((s) => s.available).length} open slots
                      </span>
                    </div>

                    {availableSlots.length === 0 ? (
                      <div className="py-6 px-4 rounded-2xl border border-border/50 bg-muted/10 text-center space-y-1">
                        <Clock className="h-6 w-6 text-muted-foreground mx-auto" />
                        <p className="text-xs font-bold text-foreground">No available slots for this date</p>
                        <p className="text-[11px] text-muted-foreground">Please select another date or room arrangement</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1" style={{ scrollbarWidth: 'none' }}>
                        {availableSlots.map((slot) => {
                          const isSel = slot.time === selectedTimeSlot;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTimeSlot(slot.time)}
                              className={cn(
                                'py-2 px-2 text-center rounded-xl text-xs font-bold border transition cursor-pointer',
                                isSel
                                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                                  : slot.available
                                  ? 'border-border/70 bg-card hover:bg-emerald-500/10 hover:border-emerald-400 text-foreground'
                                  : 'border-border/30 bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through'
                              )}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Therapist Selection (when slot chosen) */}
                  {selectedTimeSlot && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-violet-500" />
                          Therapist
                        </label>
                        {availableTherapistsForSlot.length > 1 && (
                          <span className="text-[11px] text-muted-foreground">
                            {availableTherapistsForSlot.length} available
                          </span>
                        )}
                      </div>

                      {availableTherapistsForSlot.length === 0 ? (
                        <p className="text-xs text-amber-600">No therapist available at this time slot.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableTherapistsForSlot.map((t) => {
                            const tId = t.id ?? t.therapist_id ?? '';
                            const isSel = tId === selectedTherapistId;
                            const tName = getTherapistDisplayName(t);
                            const tAvatar = t.avatar || t.photo_url || t.profile_picture;
                            return (
                              <button
                                key={tId}
                                type="button"
                                onClick={() => {
                                  setSelectedTherapistId(tId);
                                  setSelectedTherapist(t);
                                }}
                                className={cn(
                                  'flex items-center gap-3 rounded-xl border p-2.5 text-left transition cursor-pointer',
                                  isSel
                                    ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-950/30 ring-1 ring-violet-500'
                                    : 'border-border/70 bg-card hover:bg-muted/40'
                                )}
                              >
                                {tAvatar ? (
                                  <img
                                    src={tAvatar}
                                    alt={tName}
                                    className="h-8 w-8 rounded-full object-cover shrink-0 border border-border/50"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-bold text-xs flex items-center justify-center shrink-0">
                                    {getInitials(tName)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold truncate text-foreground">{tName}</p>
                                  <p className="text-[10px] text-muted-foreground">Available</p>
                                </div>
                                {isSel && (
                                  <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
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

        {/* Footer Actions */}
        {!bookingSuccess && (
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border/50 px-6 py-4 bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition shadow-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                submitting ||
                !selectedBranchId ||
                !selectedRoomId ||
                !selectedDate ||
                !selectedTimeSlot ||
                !selectedTherapistId
              }
              onClick={handleConfirmRedeem}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Booking & Redeeming…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Booking & Redeem</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
