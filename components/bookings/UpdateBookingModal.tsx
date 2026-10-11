'use client';

import { buildAppointmentWindow, kuwaitDateString } from '@/lib/datetime';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays, Clock, Building2, Scissors,
  AlertCircle, CheckCircle2, Loader2, X, Hash, CreditCard,
  User, Sparkles, Crown, Heart, LayoutGrid, Layers, Store, RefreshCw,
  Package, Timer, FileText, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface UpdateBookingModalProps {
  bookingId: string;
  initialBooking?: AnyRecord | null;
  token?: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialUpdateParams?: {
    serviceId: string;
    arrangementType: string;
    branchId: string;
    appointmentDate: string;
    daysCount: number;
  };
  initialAvailabilitiesPromise?: Promise<any>;
}

interface ApiBranch {
  id?: string;
  branch_id?: string;
  name?: string;
  branch_name?: string;
}

interface ApiAddon {
  id: string;
  name: string;
  description?: string;
  price?: string | number;
  currency?: string;
  duration_minutes?: number;
  is_active?: boolean;
}

interface ApiArrangement {
  id: string;
  name: string;
  arrangement_type?: string;
  type?: string;
  capacity?: number;
  branch_id?: string;
  branch_name?: string;
  addons?: ApiAddon[];
  availabilities?: Record<string, string[]>;
}

interface ApiTherapist {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  therapist_name?: string;
  avatar?: string;
  photo_url?: string;
  profile_picture?: string;
  specialization?: string;
  availabilities?: Record<string, string[]>;
}

const STATUS_STYLES: Record<string, { bar: string; pill: string; dot: string }> = {
  payment_pending: { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500' },
  scheduled:       { bar: 'from-violet-500 to-indigo-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500' },
  booking:         { bar: 'from-blue-500 to-sky-500',      pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',         dot: 'bg-blue-500' },
  pending:         { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500' },
  confirmed:       { bar: 'from-emerald-500 to-teal-400',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500' },
  in_progress:     { bar: 'from-emerald-400 to-green-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  completed:       { bar: 'from-slate-400 to-slate-500',   pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',    dot: 'bg-slate-400' },
  cancelled:       { bar: 'from-rose-500 to-red-500',      pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',       dot: 'bg-rose-500' },
  no_show:         { bar: 'from-orange-500 to-amber-500',  pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-500' },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES['payment_pending'];
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function toHHMM(slotStr: string): string {
  if (!slotStr) return '09:00';
  const match = slotStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return slotStr;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function isSimilarArrangementType(typeA: string, typeB: string): boolean {
  if (!typeA || !typeB) return true;
  const normA = typeA.toLowerCase().replace(/[\s_-]+/g, '');
  const normB = typeB.toLowerCase().replace(/[\s_-]+/g, '');
  if (normA === normB) return true;
  const roomSynonyms = ['room', 'treatmentroom', 'privateroom', 'standardroom', 'singleroom', 'suite'];
  if (roomSynonyms.includes(normA) && roomSynonyms.includes(normB)) return true;
  const chairSynonyms = ['chair', 'pedicurechair', 'manicurechair', 'hairchair', 'station'];
  if (chairSynonyms.includes(normA) && chairSynonyms.includes(normB)) return true;
  return false;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  room: Building2,
  treatment_room: Building2,
  suite: Sparkles,
  vip_room: Crown,
  couple_room: Heart,
  chair: LayoutGrid,
  station: Layers,
  outdoor: Store,
};

function getTherapistDisplayName(t: ApiTherapist | null | undefined): string {
  if (!t) return 'Therapist';
  return firstTruthy(
    t.therapist_name,
    t.name,
    [t.first_name, t.last_name].filter(Boolean).join(' '),
    'Therapist'
  );
}

export function UpdateBookingModal({
  bookingId,
  initialBooking,
  token,
  onClose,
  onSuccess,
  initialUpdateParams,
  initialAvailabilitiesPromise,
}: UpdateBookingModalProps) {
  const authHeader = token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : undefined;

  // Booking details state
  const [booking, setBooking] = useState<AnyRecord | null>(initialBooking ?? null);
  const [fetchingBooking, setFetchingBooking] = useState(!initialBooking);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Availabilities Cache (keyed by branch_id) & In-Flight Tracking
  const availabilitiesCache = React.useRef<Record<string, any>>({});
  const inFlightRequests = React.useRef<Record<string, Promise<any> | undefined>>({});
  const [availabilitiesData, setAvailabilitiesData] = useState<any>(null);
  const [availabilitiesLoading, setAvailabilitiesLoading] = useState(false);
  const [availabilitiesError, setAvailabilitiesError] = useState<string | null>(null);

  // Branches
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialUpdateParams?.branchId || '');

  // Arrangements & Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Addons Selection (Requirement 3.i)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [addonsInitialized, setAddonsInitialized] = useState(false);

  // Extra Time Selection (Requirement 3.ii)
  const [selectedExtraMinutes, setSelectedExtraMinutes] = useState<number>(0);
  const [extraMinutesInitialized, setExtraMinutesInitialized] = useState(false);

  // Date & Timeslots
  const todayStr = useMemo(() => kuwaitDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  // Therapists Selection
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);

  // Customer Notes
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Sync virtual loading states
  const arrangementsLoading = availabilitiesLoading;

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  // ── 1. Fetch Booking if needed ────────────────────────────────────────
  useEffect(() => {
    if (booking || !bookingId) return;
    setFetchingBooking(true);
    setBookingError(null);
    fetchJson(`/booknpay/api/v1/bookings/${bookingId}/`)
      .then((data) => {
        setBooking(data);
      })
      .catch((err) => {
        setBookingError(err instanceof Error ? err.message : 'Failed to load booking details');
      })
      .finally(() => setFetchingBooking(false));
  }, [booking, bookingId, fetchJson]);

  // Derived booking info
  const bk = booking;
  const status = (bk?.status ?? 'payment_pending').toLowerCase();
  const ss = statusStyle(status);
  const bookingNum = firstTruthy(bk?.booking_number, bk?.number, bk?.id?.slice(0, 8));

  // Service details (Requirement 3.iii)
  const svcData = (bk?.service_data || bk?.service || {}) as AnyRecord;
  const svcName = firstTruthy(
    availabilitiesData?.service?.name,
    svcData?.service_name,
    svcData?.name,
    bk?.service_name,
    bk?.service?.name,
    'Spa Service'
  );
  const svcCategory = firstTruthy(svcData?.service_category, svcData?.category, bk?.service_category);
  const durationVal = parseInt(String(svcData?.duration_minutes ?? svcData?.duration ?? bk?.duration_minutes ?? bk?.duration ?? 60), 10) || 60;
  const pricing = bk?.pricing_details as AnyRecord | undefined;
  const totalPrice = pricing?.total_price ?? pricing?.total ?? bk?.total_price ?? bk?.price ?? bk?.total_amount ?? '';
  const currency = firstTruthy(bk?.currency, svcData?.currency, 'KWD');

  // Service price (Requirement 3.iii)
  const svcPrice = firstTruthy(
    svcData?.price,
    svcData?.base_price,
    bk?.base_price,
    pricing?.service_price,
    pricing?.base_price,
    pricing?.base,
    bk?.price,
    totalPrice
  );

  // Previously booked arrangement type
  const prevArrObj = (bk?.service_arrangement_data ?? bk?.arrangement ?? bk?.service_arrangement) as AnyRecord | undefined;
  const prevArrType = firstTruthy(
    initialUpdateParams?.arrangementType,
    prevArrObj?.arrangement_type,
    prevArrObj?.type,
    bk?.arrangement_type,
    bk?.room_type,
    'room'
  );

  // Service ID
  const serviceId = firstTruthy(
    initialUpdateParams?.serviceId,
    svcData?.id,
    svcData?.service_id,
    bk?.service_id
  );

  // Appointment date
  const isoStart = bk?.appointment_start ?? bk?.appointment_datetime ?? '';
  const appointmentDate = useMemo(() => {
    return firstTruthy(
      initialUpdateParams?.appointmentDate,
      bk?.date,
      bk?.booking_date,
      bk?.appointment_date,
      isoStart ? (isoStart.includes('T') ? isoStart.split('T')[0] : isoStart.split(' ')[0]) : '',
      todayStr
    );
  }, [initialUpdateParams?.appointmentDate, bk, isoStart, todayStr]);

  const daysCount = initialUpdateParams?.daysCount ?? 30;

  // Initialize selected branch, date, extra minutes, and notes from booking
  useEffect(() => {
    if (!bk) return;

    const initialBranchId = firstTruthy(
      initialUpdateParams?.branchId,
      bk?.branch_id,
      bk?.branch_data?.branch_id,
      bk?.branch_data?.id,
      bk?.branch?.id
    );
    setSelectedBranchId((prev) => prev || initialBranchId);

    const dateRaw = firstTruthy(bk?.date, bk?.booking_date, bk?.appointment_date, isoStart ? isoStart.split('T')[0] : '');
    if (dateRaw && dateRaw >= todayStr) {
      setSelectedDate(dateRaw);
    } else {
      setSelectedDate(todayStr);
    }

    if (!extraMinutesInitialized) {
      const existingExtra = Number(bk?.extra_minutes ?? 0);
      setSelectedExtraMinutes(existingExtra);
      setExtraMinutesInitialized(true);
    }

    if (customerNotes === '' && bk?.customer_notes) {
      setCustomerNotes(bk.customer_notes);
    }
  }, [bk, todayStr, initialUpdateParams?.branchId, isoStart, extraMinutesInitialized, customerNotes]);

  // ── Handle initial availabilities promise ───────────────────────────
  useEffect(() => {
    if (!initialAvailabilitiesPromise || !initialUpdateParams?.branchId) return;
    const bId = initialUpdateParams.branchId;
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
        setAvailabilitiesError(err instanceof Error ? err.message : 'Failed to load availability');
      })
      .finally(() => {
        delete inFlightRequests.current[bId];
        if (active) setAvailabilitiesLoading(false);
      });

    return () => { active = false; };
  }, [initialAvailabilitiesPromise, initialUpdateParams?.branchId]);

  // ── With change of branch: check cache or send request ──────────────
  const fetchAvailabilitiesForBranch = useCallback(async (branchIdToFetch: string) => {
    if (!branchIdToFetch) return;

    if (availabilitiesCache.current[branchIdToFetch]) {
      setAvailabilitiesData(availabilitiesCache.current[branchIdToFetch]);
      setAvailabilitiesError(null);
      setAvailabilitiesLoading(false);
      return;
    }

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

    setAvailabilitiesLoading(true);
    setAvailabilitiesError(null);

    const qs = new URLSearchParams({
      service_id: serviceId || '',
      arrangement_type: prevArrType || 'room',
      branch_id: branchIdToFetch,
      date: appointmentDate || todayStr,
      days_count: String(daysCount),
    });
    const endpoint = `/uauth/api/v1/find-availabilities-for-reschedule-appointment/?${qs.toString()}`;

    const promise = fetchJson(endpoint)
      .then((data) => {
        availabilitiesCache.current[branchIdToFetch] = data;
        setAvailabilitiesData(data);
        return data;
      })
      .catch((err) => {
        console.error('Failed to fetch availabilities on branch change:', err);
        setAvailabilitiesError(err instanceof Error ? err.message : 'Failed to load branch availability');
        throw err;
      })
      .finally(() => {
        delete inFlightRequests.current[branchIdToFetch];
        setAvailabilitiesLoading(false);
      });

    inFlightRequests.current[branchIdToFetch] = promise;
  }, [serviceId, prevArrType, appointmentDate, todayStr, daysCount, fetchJson]);

  useEffect(() => {
    if (!selectedBranchId) return;

    const initialInFlight = inFlightRequests.current[selectedBranchId];
    if (
      selectedBranchId === initialUpdateParams?.branchId &&
      (initialAvailabilitiesPromise || availabilitiesCache.current[selectedBranchId] || initialInFlight)
    ) {
      if (availabilitiesCache.current[selectedBranchId]) {
        setAvailabilitiesData(availabilitiesCache.current[selectedBranchId]);
      }
      return;
    }

    fetchAvailabilitiesForBranch(selectedBranchId);
  }, [selectedBranchId, fetchAvailabilitiesForBranch, initialUpdateParams?.branchId, initialAvailabilitiesPromise]);

  // Fetch Branches
  useEffect(() => {
    fetchJson('/api/v1/branches/')
      .then((data) => {
        const list: ApiBranch[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        setBranches(list);
      })
      .catch(() => setBranches([]));
  }, [fetchJson]);

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

  // Max allowed date
  const maxDateStr = useMemo(() => {
    const daysAllowed = daysCount || 30;
    const dateRaw = appointmentDate;
    if (dateRaw && typeof dateRaw === 'string' && dateRaw.trim()) {
      const base = new Date(`${dateRaw.trim().split('T')[0]}T00:00:00Z`);
      if (!isNaN(base.getTime())) {
        base.setUTCDate(base.getUTCDate() + daysAllowed);
        return base.toISOString().split('T')[0];
      }
    }
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + daysAllowed);
    return kuwaitDateString(fallback);
  }, [appointmentDate, daysCount]);

  // Compute Arrangements from availabilitiesData
  const arrangements = useMemo<ApiArrangement[]>(() => {
    const list = Array.isArray(availabilitiesData?.arrangements)
      ? availabilitiesData.arrangements
      : Array.isArray(availabilitiesData?.data?.arrangements)
      ? availabilitiesData.data.arrangements
      : [];
    return list.filter((a: any) => {
      const type = a.arrangement_type || a.type || '';
      return isSimilarArrangementType(type, prevArrType);
    });
  }, [availabilitiesData, prevArrType]);

  // Pre-select arrangement when arrangements change
  useEffect(() => {
    if (arrangements.length === 0) {
      setSelectedRoomId('');
      return;
    }
    if (selectedRoomId && arrangements.some((a) => a.id === selectedRoomId)) {
      return;
    }
    const prevArrId = firstTruthy(
      bk?.service_arrangement_id,
      bk?.service_arrangement_data?.id,
      bk?.service_arrangement_data?.arrangement_id,
      bk?.arrangement_id
    );
    const matchPrev = arrangements.find((a) => a.id === prevArrId);
    setSelectedRoomId(matchPrev ? matchPrev.id : arrangements[0].id);
  }, [arrangements, bk, selectedRoomId]);

  // Currently selected room object and its available addons (Requirement 3.i)
  const currentRoom = useMemo(() => {
    return arrangements.find((a) => a.id === selectedRoomId) || null;
  }, [arrangements, selectedRoomId]);

  const currentRoomAddons = useMemo<ApiAddon[]>(() => {
    if (!currentRoom?.addons || !Array.isArray(currentRoom.addons)) return [];
    return currentRoom.addons.filter((a) => a && (a.is_active !== false));
  }, [currentRoom]);

  // Pre-select booking's existing addons on initial load
  useEffect(() => {
    if (addonsInitialized || !bk) return;
    const existing = bk.addons || bk.selected_addons || [];
    if (Array.isArray(existing) && existing.length > 0) {
      const ids = existing
        .map((a: any) => String(a.id || a.addon_id || ''))
        .filter(Boolean);
      setSelectedAddonIds(ids);
      setAddonsInitialized(true);
    }
  }, [bk, addonsInitialized]);

  // Toggle addon checkbox
  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  // Compute Therapists from availabilitiesData
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

  // Timeslot Calculation
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
    for (const t of therapists) {
      const tSlots: string[] = t.availabilities?.[selectedDate] || [];
      for (const s of tSlots) {
        therapistSlotsForDay.add(parseTimeToMinutes(s));
      }
    }

    const rawArrSlots: string[] = selArrangement.availabilities?.[selectedDate] || [];
    const arrangementSlotsForDay = new Set<number>(
      rawArrSlots.map((s) => parseTimeToMinutes(s))
    );

    const branchInfo = availabilitiesData?.branch;
    const openTime = branchInfo?.opening_time || '09:00:00';
    const closeTime = branchInfo?.closing_time || '23:00:00';
    const step = Number(availabilitiesData?.slot_duration_minutes || 30) || 30;

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

    const sortedMinutes: number[] = Array.from(allKnownMinutes).sort((a, b) => a - b);

    const now = new Date();
    const isToday = selectedDate === todayStr;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: { time: string; available: boolean }[] = [];

    for (const m of sortedMinutes) {
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

  // Auto-Select Therapist when timeslot changes
  useEffect(() => {
    if (!selectedTimeSlot || therapists.length === 0 || !selectedDate) {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
      return;
    }

    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);
    const autoAssigned = therapists.find((t) => {
      const daySlots: string[] = t.availabilities?.[selectedDate] || [];
      return daySlots.some((s) => parseTimeToMinutes(s) === slotStartMin);
    });

    if (autoAssigned) {
      setSelectedTherapistId(autoAssigned.id);
      setSelectedTherapist(autoAssigned);
    } else {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
    }
  }, [selectedTimeSlot, therapists, selectedDate]);

  // ── Extra Time Price Calculation (Requirement 3.ii) ────────────────────
  const extraMinutesUnit = Number(svcData?.extra_minutes ?? 0);
  const extraPricePerUnit = parseFloat(String(svcData?.price_for_extra_minutes ?? '0')) || 0;
  const baseServicePriceNum = parseFloat(String(svcPrice || '0')) || 0;

  const calcExtraPrice = useCallback((mins: number) => {
    if (mins <= 0) return 0;
    if (extraPricePerUnit > 0 && extraMinutesUnit > 0) {
      return (mins / extraMinutesUnit) * extraPricePerUnit;
    }
    if (extraPricePerUnit > 0) {
      return (mins / 30) * extraPricePerUnit;
    }
    const effDur = durationVal > 0 ? durationVal : 60;
    return (baseServicePriceNum / effDur) * mins;
  }, [extraPricePerUnit, extraMinutesUnit, baseServicePriceNum, durationVal]);

  const extraOptions = useMemo(() => {
    const defaultOpts = [0, 30, 60];
    const initialExtra = Number(bk?.extra_minutes ?? 0);
    if (initialExtra > 0 && !defaultOpts.includes(initialExtra)) {
      return [...defaultOpts, initialExtra].sort((a, b) => a - b);
    }
    return defaultOpts;
  }, [bk?.extra_minutes]);

  // ── Total Pricing Calculation (Requirement 3.iv) ──────────────────────
  const selectedAddonObjs = useMemo(() => {
    return currentRoomAddons.filter((a) => selectedAddonIds.includes(String(a.id)));
  }, [currentRoomAddons, selectedAddonIds]);

  const addonsTotalPrice = useMemo(() => {
    return selectedAddonObjs.reduce((acc, a) => acc + (parseFloat(String(a.price || '0')) || 0), 0);
  }, [selectedAddonObjs]);

  const addonsTotalDuration = useMemo(() => {
    return selectedAddonObjs.reduce((acc, a) => acc + Number(a.duration_minutes || 0), 0);
  }, [selectedAddonObjs]);

  const extraTimePrice = useMemo(() => {
    return calcExtraPrice(selectedExtraMinutes);
  }, [calcExtraPrice, selectedExtraMinutes]);

  const totalCalculatedPrice = useMemo(() => {
    return baseServicePriceNum + addonsTotalPrice + extraTimePrice;
  }, [baseServicePriceNum, addonsTotalPrice, extraTimePrice]);

  const totalCalculatedDuration = useMemo(() => {
    return durationVal + selectedExtraMinutes + addonsTotalDuration;
  }, [durationVal, selectedExtraMinutes, addonsTotalDuration]);

  // ── Handle Submit Update Booking (Requirement 3.v) ────────────────────
  const handleUpdateBooking = async () => {
    if (!selectedBranchId || !selectedRoomId || !selectedDate || !selectedTimeSlot || !selectedTherapistId) {
      setSubmitError('Please complete all fields (Branch, Room, Date, Timeslot, and Therapist)');
      return;
    }

    if (selectedDate > maxDateStr) {
      setSubmitError(`Update appointment date is allowed only up to max 30 days from current date (${maxDateStr}).`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const selBranch = branches.find((b) => (b.id ?? b.branch_id) === selectedBranchId);
    const selRoom = arrangements.find((a) => a.id === selectedRoomId);
    const branchName = selBranch?.branch_name ?? selBranch?.name ?? 'Branch';
    const roomName = selRoom?.name ?? 'Room';
    const roomType = selRoom?.arrangement_type ?? selRoom?.type ?? prevArrType;

    const formattedTime = toHHMM(selectedTimeSlot);
    const apptWindow = buildAppointmentWindow(selectedDate, selectedTimeSlot, totalCalculatedDuration);
    const appointmentStartIso = apptWindow.appointment_start;
    const appointmentEndIso = apptWindow.appointment_end;

    const buildPayload = (therapist: ApiTherapist | null, therapistId: string) => {
      const therapistName = getTherapistDisplayName(therapist);
      return {
        ...(bk || {}),
        branch_id: selectedBranchId,
        branch_data: {
          id: selectedBranchId,
          branch_id: selectedBranchId,
          branch_name: branchName,
          name: branchName,
        },
        service_arrangement_id: selectedRoomId,
        service_arrangement_data: {
          id: selectedRoomId,
          arrangement_id: selectedRoomId,
          arrangement_name: roomName,
          name: roomName,
          arrangement_type: roomType,
        },
        appointment_date: selectedDate,
        appointment_time: formattedTime,
        appointment_start: appointmentStartIso,
        appointment_end: appointmentEndIso,
        duration: durationVal,
        duration_minutes: durationVal,
        total_duration: totalCalculatedDuration,
        therapist_id: therapistId,
        therapist_data: {
          id: therapistId,
          therapist_id: therapistId,
          therapist_name: therapistName,
          name: therapistName,
        },
        // Selected Addons (Requirement 3.i)
        addons: selectedAddonObjs.map((a) => ({
          id: a.id,
          addon_id: a.id,
          name: a.name,
          price: fmtPrice(a.price),
        })),
        selected_addons: selectedAddonObjs.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
          price: fmtPrice(a.price),
          currency: a.currency || currency,
          is_active: true,
        })),
        addon_price: fmtPrice(addonsTotalPrice),
        addons_price: fmtPrice(addonsTotalPrice),
        addons_duration: addonsTotalDuration,
        // Extra Time (Requirement 3.ii)
        extra_minutes: selectedExtraMinutes,
        price_for_extra_minutes: fmtPrice(extraTimePrice),
        extra_price: fmtPrice(extraTimePrice),
        // Pricing breakdown (Requirement 3.iv)
        pricing_details: {
          ...(bk?.pricing_details || {}),
          base: fmtPrice(baseServicePriceNum),
          base_price: fmtPrice(baseServicePriceNum),
          service_price: fmtPrice(baseServicePriceNum),
          arrangement: fmtPrice(baseServicePriceNum),
          arrangement_price: fmtPrice(baseServicePriceNum),
          addons: fmtPrice(addonsTotalPrice),
          addons_price: fmtPrice(addonsTotalPrice),
          extratime: fmtPrice(extraTimePrice),
          extra_time: fmtPrice(extraTimePrice),
          extra_time_price: fmtPrice(extraTimePrice),
          subtotal: fmtPrice(totalCalculatedPrice),
          total: fmtPrice(totalCalculatedPrice),
          total_price: fmtPrice(totalCalculatedPrice),
          currency,
        },
        total_price: fmtPrice(totalCalculatedPrice),
        total_amount: fmtPrice(totalCalculatedPrice),
        customer_notes: customerNotes,
        source: 'ushdesk',
        reason: 'Service booking updated by desk staff',
      };
    };

    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);
    const isFreeAtSlot = (t: ApiTherapist) =>
      (t.availabilities?.[selectedDate] || []).some((s: string) => parseTimeToMinutes(s) === slotStartMin);
    const candidates: { id: string; therapist: ApiTherapist | null }[] = [
      { id: selectedTherapistId, therapist: selectedTherapist },
      ...therapists
        .filter((t) => t.id && t.id !== selectedTherapistId && isFreeAtSlot(t))
        .map((t) => ({ id: t.id, therapist: t })),
    ];

    const isTherapistConflict = (status: number, msg: string) =>
      /therapist/i.test(msg) && /(already booked|not available|unavailable|conflict|overlap|busy)/i.test(msg)
      || (status === 409 && /therapist/i.test(msg));

    try {
      for (const cand of candidates) {
        // Requirement 3.v: PUT /booknpay/api/v1/bookings/{booking_id}/
        const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(buildPayload(cand.therapist, cand.id)),
        });

        if (res.ok) {
          if (cand.id !== selectedTherapistId) {
            setSelectedTherapistId(cand.id);
            setSelectedTherapist(cand.therapist);
          }
          setSubmitSuccess(true);
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 900);
          return;
        }

        const errData = await res.json().catch(() => ({}));
        const msg = String(
          errData.detail || errData.message ||
          (typeof errData.error === 'string' ? errData.error : errData.error?.message) ||
          `Error ${res.status}`,
        );
        if (!isTherapistConflict(res.status, msg)) {
          throw new Error(msg);
        }
      }

      throw new Error(
        `No therapist is available at ${selectedTimeSlot} on ${selectedDate}. Please choose a different time slot.`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* ── Top Bar ── */}
        <div className="shrink-0 relative overflow-hidden border-b border-border/60 bg-muted/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">Update Service Booking</h2>
                <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize', ss.pill)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', ss.dot)} />
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update room arrangement, add-ons, extra duration, and schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bookingNum && (
              <div className="hidden sm:flex items-center gap-1 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span>{bookingNum}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Loading or Error for booking */}
          {fetchingBooking && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm font-semibold">Loading booking details…</p>
            </div>
          )}

          {bookingError && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-4 text-rose-700 dark:text-rose-400 text-sm flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{bookingError}</p>
            </div>
          )}

          {!fetchingBooking && bk && (
            <>
              {/* ── Service Section (Requirement 3.iii: show service name also price) ── */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-start justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 mt-0.5">
                    <Scissors className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                    <p className="text-sm font-bold text-foreground truncate mt-0.5">{svcName}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      {svcCategory && <span>{svcCategory}</span>}
                      {durationVal && (
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                          {svcCategory && '• '}
                          <Clock className="h-3 w-3" /> {durationVal} mins
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service Price</p>
                  <p className="text-base font-black text-violet-600 dark:text-violet-400 mt-0.5">
                    {fmtPrice(svcPrice)} <span className="text-[10px] font-semibold">{currency}</span>
                  </p>
                </div>
              </div>

              {/* ── Branch Selection ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-amber-500" />
                  Branch
                </label>
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
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                  {prevArrType && (
                    <span className="text-[11px] text-muted-foreground">
                      Required type: <strong className="capitalize text-foreground">{prevArrType.replace(/_/g, ' ')}</strong>
                    </span>
                  )}
                </div>

                {arrangementsLoading ? (
                  <div className="flex items-center gap-2 py-3 px-4 rounded-xl border border-border/50 bg-muted/20 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    Checking available rooms…
                  </div>
                ) : arrangements.length === 0 ? (
                  <div className="rounded-2xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-extrabold text-sm mb-0.5">No room available</p>
                      <p>
                        This branch does not have any room or arrangement matching the previously booked type{' '}
                        <strong>({prevArrType.replace(/_/g, ' ')})</strong>. Please select another branch.
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
                              ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-950/30 ring-1 ring-violet-500'
                              : 'border-border/70 bg-card hover:bg-muted/40'
                          )}
                        >
                          <div className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                            isSel ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'
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
                          {isSel && <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Add-on Services (Requirement 3.i: after room section show addons for selected room) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    Add-on Services
                  </label>
                  {selectedAddonObjs.length > 0 && (
                    <span className="text-[11px] font-bold text-primary">
                      {selectedAddonObjs.length} selected (+{fmtPrice(addonsTotalPrice)} {currency})
                    </span>
                  )}
                </div>

                {currentRoomAddons.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground italic">
                    No add-ons available for the selected room.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentRoomAddons.map((addon) => {
                      const checked = selectedAddonIds.includes(String(addon.id));
                      return (
                        <label
                          key={addon.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition select-none',
                            checked
                              ? 'border-primary/50 bg-primary/5 text-primary ring-1 ring-primary/20'
                              : 'border-border/70 bg-card hover:bg-muted/30'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(String(addon.id))}
                            className="mt-0.5 h-3.5 w-3.5 accent-primary shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold leading-tight text-foreground truncate">{addon.name}</p>
                            {addon.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{addon.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-primary">
                                +{fmtPrice(addon.price)} {addon.currency || currency}
                              </span>
                              {addon.duration_minutes && addon.duration_minutes > 0 && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" /> +{addon.duration_minutes}m
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

              {/* ── Extra Time Option (Requirement 3.ii: after addons show option to choose extratime) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-amber-500" />
                    Extra Time
                  </label>
                  {selectedExtraMinutes > 0 && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      +{selectedExtraMinutes} min (+{fmtPrice(extraTimePrice)} {currency})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                  {extraOptions.map((mins) => {
                    const active = selectedExtraMinutes === mins;
                    const price = calcExtraPrice(mins);
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSelectedExtraMinutes(mins)}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-center transition cursor-pointer',
                          active
                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-sm ring-1 ring-amber-500/30'
                            : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                      >
                        <p className="text-xs font-extrabold">{mins === 0 ? 'None' : `${mins} min`}</p>
                        <p className="text-[10px] font-semibold mt-0.5 opacity-85">
                          {mins === 0 ? '+0.000 KWD' : `+${fmtPrice(price)} ${currency}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Date Selection ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    Appointment Date
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Available until: <strong className="text-foreground">{maxDateStr}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    min={todayStr}
                    max={maxDateStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-card px-3.5 py-2 text-sm font-semibold shadow-sm focus:border-primary focus:outline-none transition cursor-pointer"
                  />
                </div>
              </div>

              {/* ── Timeslot Selection ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  Time Slot
                </label>

                {availableSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No time slots available for this date and room.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableSlots.map(({ time, available }) => {
                      const isSel = selectedTimeSlot === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={!available}
                          onClick={() => setSelectedTimeSlot(time)}
                          className={cn(
                            'rounded-xl border py-2 text-center text-xs font-bold transition whitespace-nowrap',
                            !available
                              ? 'border-border/40 bg-muted/20 text-muted-foreground/40 cursor-not-allowed'
                              : isSel
                              ? 'border-violet-500 bg-violet-500 text-white shadow-md'
                              : 'border-border/70 bg-card hover:bg-muted/50 text-foreground cursor-pointer'
                          )}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Therapist Selection ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-500" />
                  Assigned Therapist
                </label>

                {selectedTherapist ? (
                  <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white font-bold text-xs grid place-items-center overflow-hidden">
                      {selectedTherapist.avatar || selectedTherapist.photo_url ? (
                        <img
                          src={selectedTherapist.avatar || selectedTherapist.photo_url}
                          alt={getTherapistDisplayName(selectedTherapist)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(getTherapistDisplayName(selectedTherapist))
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">
                        {getTherapistDisplayName(selectedTherapist)}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        Available at {selectedTimeSlot}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground italic">
                    {selectedTimeSlot
                      ? 'No available therapist for this slot'
                      : 'Please select a timeslot first'}
                  </div>
                )}
              </div>

              {/* ── Customer Notes ── */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Notes / Instructions
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Optional customer notes or instructions…"
                  rows={2}
                  className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              {/* ── Total Pricing Breakdown Card (Requirement 3.iv) ── */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Pricing Summary
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Total Duration: <strong className="text-foreground">{totalCalculatedDuration} mins</strong>
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Service ({svcName}):</span>
                    <span className="font-semibold text-foreground">{fmtPrice(baseServicePriceNum)} {currency}</span>
                  </div>

                  {selectedAddonObjs.length > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Add-on Services ({selectedAddonObjs.length}):</span>
                      <span className="font-semibold text-primary">+{fmtPrice(addonsTotalPrice)} {currency}</span>
                    </div>
                  )}

                  {selectedExtraMinutes > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Extra Time (+{selectedExtraMinutes} mins):</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">+{fmtPrice(extraTimePrice)} {currency}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-primary/10 text-sm font-extrabold text-foreground">
                    <span>Total Amount:</span>
                    <span className="text-base text-primary font-black">
                      {fmtPrice(totalCalculatedPrice)} {currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Error */}
              {submitError && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{submitError}</p>
                </div>
              )}

              {/* Submit Success */}
              {submitSuccess && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p className="font-bold">Booking updated successfully!</p>
                </div>
              )}
            </>
          )}

        </div>

        {/* ── Footer Actions (Requirement 3.v) ── */}
        <div className="shrink-0 border-t border-border/60 bg-muted/20 px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUpdateBooking}
            disabled={submitting || fetchingBooking || submitSuccess || !selectedTimeSlot || !selectedTherapistId}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition',
              submitting || fetchingBooking || submitSuccess || !selectedTimeSlot || !selectedTherapistId
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60 shadow-none'
                : 'bg-primary hover:bg-primary/90 cursor-pointer active:scale-[0.98]'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating Booking…
              </>
            ) : submitSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Updated!
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Update Booking
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
