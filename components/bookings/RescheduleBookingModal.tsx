'use client';

import { buildAppointmentWindow, kuwaitDateString } from '@/lib/datetime';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays, Clock, Building2, MapPin, Scissors,
  AlertCircle, CheckCircle2, Loader2, X, Hash, CreditCard,
  User, Sparkles, Crown, Heart, LayoutGrid, Layers, Store, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface RescheduleBookingModalProps {
  bookingId: string;
  initialBooking?: AnyRecord | null;
  token?: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialRescheduleParams?: {
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

interface ApiGrid {
  start: string;
  end: string;
  slot_duration_minutes: number;
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
  scheduled:   { bar: 'from-violet-500 to-indigo-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500' },
  booking:     { bar: 'from-blue-500 to-sky-500',      pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',         dot: 'bg-blue-500' },
  pending:     { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500' },
  confirmed:   { bar: 'from-emerald-500 to-teal-400',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500' },
  in_progress: { bar: 'from-emerald-400 to-green-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  completed:   { bar: 'from-slate-400 to-slate-500',   pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',    dot: 'bg-slate-400' },
  cancelled:   { bar: 'from-rose-500 to-red-500',      pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',       dot: 'bg-rose-500' },
  no_show:     { bar: 'from-orange-500 to-amber-500',  pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-500' },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES['scheduled'];
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

function getTherapistDisplayName(t: ApiTherapist | null | undefined): string {
  if (!t) return 'Therapist';
  const name = t.name ?? t.therapist_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
  return (name && String(name).trim()) || 'Therapist';
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

export function RescheduleBookingModal({
  bookingId,
  initialBooking,
  token,
  onClose,
  onSuccess,
  initialRescheduleParams,
  initialAvailabilitiesPromise,
}: RescheduleBookingModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  // ── States ───────────────────────────────────────────────────────────
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
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialRescheduleParams?.branchId || '');

  // Arrangements & Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Date & Timeslots
  const todayStr = useMemo(() => kuwaitDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  // Therapists Selection
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);

  // Sync virtual loading states for existing UI indicators
  const arrangementsLoading = availabilitiesLoading;
  const scheduleLoading = availabilitiesLoading;
  const therapistsLoading = availabilitiesLoading;

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
  const status = (bk?.status ?? 'scheduled').toLowerCase();
  const ss = statusStyle(status);
  const bookingNum = firstTruthy(bk?.booking_number, bk?.number);

  const svcObj = bk?.service as AnyRecord | undefined;
  const svcName = firstTruthy(svcObj?.service_name, svcObj?.name, bk?.service_name, 'Spa Service');
  const svcCategory = firstTruthy(svcObj?.service_category, svcObj?.category, bk?.service_category);
  const durationVal = parseInt(String(bk?.total_duration ?? bk?.duration_minutes ?? bk?.duration ?? 60), 10) || 60;
  const pricing = bk?.pricing_details as AnyRecord | undefined;
  const totalPrice = pricing?.total_price ?? pricing?.total ?? bk?.total_price ?? bk?.price ?? '';
  const currency = firstTruthy(bk?.currency, 'KWD');

  // Previously booked arrangement type
  const prevArrObj = (bk?.service_arrangement_data ?? bk?.arrangement ?? bk?.service_arrangement) as AnyRecord | undefined;
  const prevArrType = firstTruthy(
    initialRescheduleParams?.arrangementType,
    prevArrObj?.arrangement_type,
    prevArrObj?.type,
    bk?.arrangement_type,
    bk?.room_type,
    'room'
  );

  // Service ID
  const serviceId = firstTruthy(
    initialRescheduleParams?.serviceId,
    svcObj?.id,
    svcObj?.service_id,
    bk?.service_id
  );

  // Appointment date
  const isoStart = bk?.appointment_start ?? bk?.appointment_datetime ?? '';
  const appointmentDate = useMemo(() => {
    return firstTruthy(
      initialRescheduleParams?.appointmentDate,
      bk?.date,
      bk?.booking_date,
      bk?.appointment_date,
      isoStart ? (isoStart.includes('T') ? isoStart.split('T')[0] : isoStart.split(' ')[0]) : '',
      todayStr
    );
  }, [initialRescheduleParams?.appointmentDate, bk, isoStart, todayStr]);

  const daysCount = initialRescheduleParams?.daysCount ?? 30;

  // Initialize selected branch and date from booking
  useEffect(() => {
    if (!bk) return;
    const initialBranchId = firstTruthy(
      initialRescheduleParams?.branchId,
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
  }, [bk, todayStr, initialRescheduleParams?.branchId, isoStart]);

  // ── Handle initial availabilities promise ───────────────────────────
  useEffect(() => {
    if (!initialAvailabilitiesPromise || !initialRescheduleParams?.branchId) return;
    const bId = initialRescheduleParams.branchId;
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
  }, [initialAvailabilitiesPromise, initialRescheduleParams?.branchId]);

  // ── With change of branch: check cache or send request ──────────────
  const fetchAvailabilitiesForBranch = useCallback(async (branchIdToFetch: string) => {
    if (!branchIdToFetch) return;

    // 1. Check in-memory cache first!
    if (availabilitiesCache.current[branchIdToFetch]) {
      setAvailabilitiesData(availabilitiesCache.current[branchIdToFetch]);
      setAvailabilitiesError(null);
      setAvailabilitiesLoading(false);
      return;
    }

    // 2. Check if already in-flight
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

    // 3. Fetch from endpoint and cache
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
      selectedBranchId === initialRescheduleParams?.branchId &&
      (initialAvailabilitiesPromise || availabilitiesCache.current[selectedBranchId] || initialInFlight)
    ) {
      if (availabilitiesCache.current[selectedBranchId]) {
        setAvailabilitiesData(availabilitiesCache.current[selectedBranchId]);
      }
      return;
    }

    fetchAvailabilitiesForBranch(selectedBranchId);
  }, [selectedBranchId, fetchAvailabilitiesForBranch, initialRescheduleParams?.branchId, initialAvailabilitiesPromise]);

  // ── Fetch Branches (for branch dropdown only) ───────────────────────
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

  // ── Max allowed reschedule date: original appointment date + daysCount (10 or 30 days) ─
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

  // ── Compute Arrangements from availabilitiesData ────────────────────
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
    // If selected room is already in filtered arrangements, keep it
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

  // ── Compute Therapists from availabilitiesData ──────────────────────
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

  // ── Timeslot Calculation: Merge therapist availabilities by day, then intersect with arrangement ──
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

    // 1. Merge all therapist availabilities for the selected day
    const therapistSlotsForDay = new Set<number>();
    for (const t of therapists) {
      const tSlots: string[] = t.availabilities?.[selectedDate] || [];
      for (const s of tSlots) {
        therapistSlotsForDay.add(parseTimeToMinutes(s));
      }
    }

    // 2. Arrangement availabilities for the selected day
    const rawArrSlots: string[] = selArrangement.availabilities?.[selectedDate] || [];
    const arrangementSlotsForDay = new Set<number>(
      rawArrSlots.map((s) => parseTimeToMinutes(s))
    );

    // 3. Grid timeslot bounds: from branch opening/closing or explicit slots
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
    therapistSlotsForDay.forEach((m) => {
      allKnownMinutes.add(m);
    });
    arrangementSlotsForDay.forEach((m) => {
      allKnownMinutes.add(m);
    });

    const sortedMinutes: number[] = [];
    allKnownMinutes.forEach((m) => {
      sortedMinutes.push(m);
    });
    sortedMinutes.sort((a, b) => a - b);

    const now = new Date();
    const isToday = selectedDate === todayStr;
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const slots: { time: string; available: boolean }[] = [];

    for (const m of sortedMinutes) {
      // Per requirement: If today, do not show timeslots smaller than or equal to current datetime
      if (isToday && m <= currentTotalMinutes) {
        continue;
      }

      const h = Math.floor(m / 60);
      const min = m % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;

      // Intersection: must be in therapist union AND arrangement availability
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

  // ── Auto-Select Therapist when timeslot changes ───────────────────────
  useEffect(() => {
    if (!selectedTimeSlot || therapists.length === 0 || !selectedDate) {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
      return;
    }

    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);

    // Find the first therapist who is available at this timeslot on this date
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

  // ── Handle Submit Reschedule ──────────────────────────────────────────
  const handleUpdateBooking = async () => {
    if (!selectedBranchId || !selectedRoomId || !selectedDate || !selectedTimeSlot || !selectedTherapistId) {
      setSubmitError('Please complete all fields (Branch, Room, Date, Timeslot, and Therapist)');
      return;
    }

    if (selectedDate > maxDateStr) {
      setSubmitError(`Reschedule is allowed only max 30 days from current appointment start datetime (${maxDateStr}).`);
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
    // Selected date/slot are Asia/Kuwait wall-clock: send offset-aware ISO (+03:00).
    // Never suffix wall-clock with "Z" — that labels it UTC and shifts it by +3h.
    const apptWindow = buildAppointmentWindow(selectedDate, selectedTimeSlot, durationVal);
    const appointmentStartIso = apptWindow.appointment_start;
    const appointmentEndIso = apptWindow.appointment_end;

    const buildPayload = (therapist: ApiTherapist | null, therapistId: string) => {
      const therapistName = getTherapistDisplayName(therapist);
      return {
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
        therapist_id: therapistId,
        therapist_data: {
          id: therapistId,
          therapist_id: therapistId,
          therapist_name: therapistName,
          name: therapistName,
        },
        source: 'ushdesk',
        reason: 'Rescheduled by desk staff',
      };
    };

    // Candidates: the auto-selected therapist first, then every other therapist in the
    // list who is available at this slot (availability data can be stale, so the backend
    // may still reject a therapist as already booked).
    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);
    const isFreeAtSlot = (t: ApiTherapist) =>
      (t.availabilities?.[selectedDate] || []).some((s: string) => parseTimeToMinutes(s) === slotStartMin);
    const candidates: { id: string; therapist: ApiTherapist | null }[] = [
      { id: selectedTherapistId, therapist: selectedTherapist },
      ...therapists
        .filter((t) => t.id && t.id !== selectedTherapistId && isFreeAtSlot(t))
        .map((t) => ({ id: t.id, therapist: t })),
    ];

    // Errors that mean "this therapist cannot take the slot" → try the next one.
    const isTherapistConflict = (status: number, msg: string) =>
      /therapist/i.test(msg) && /(already booked|not available|unavailable|conflict|overlap|busy)/i.test(msg)
      || (status === 409 && /therapist/i.test(msg));

    try {
      for (const cand of candidates) {
        const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify(buildPayload(cand.therapist, cand.id)),
        });

        if (res.ok) {
          if (cand.id !== selectedTherapistId) {
            // Reflect the therapist that was actually assigned.
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
        // Conflict for this therapist → continue with the next available one.
      }

      // Every therapist in the list is booked for this slot.
      throw new Error(
        `No therapist is available at ${selectedTimeSlot} on ${selectedDate}. Please choose a different time slot.`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedArrangement = arrangements.find((a) => a.id === selectedRoomId);
  const RoomTypeIcon = TYPE_ICONS[selectedArrangement?.arrangement_type ?? selectedArrangement?.type ?? ''] ?? Building2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-h-[92vh] max-w-2xl flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden transition-all duration-200">
        {/* Status accent bar */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r shrink-0', ss.bar)} />

        {/* ── Header (Requirement 1.i.a: Booking number, status not change) ── */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold leading-tight">Reschedule Booking</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                Reschedule
              </span>
            </div>
            {bk && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold', ss.pill)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', ss.dot)} />
                  {status.replace(/_/g, ' ')}
                </span>
                {bk?.payment_status && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-muted text-muted-foreground">
                    <CreditCard className="h-2.5 w-2.5" />
                    {String(bk.payment_status).replace(/_/g, ' ')}
                  </span>
                )}
                {bookingNum && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">
                    <Hash className="h-2.5 w-2.5" />
                    {bookingNum}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {fetchingBooking && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading booking details…</p>
            </div>
          )}

          {bookingError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{bookingError}</p>
            </div>
          )}

          {!fetchingBooking && bk && (
            <>
              {/* ── Service Name Section (Requirement 1.i.b: same, no change) ── */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10">
                  <Scissors className="h-4 w-4 text-violet-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service (No Change)</p>
                  <p className="text-sm font-bold truncate">{svcName}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {svcCategory && <span>{svcCategory}</span>}
                    {durationVal && (
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                        • <Clock className="h-3 w-3" /> {durationVal} mins
                      </span>
                    )}
                  </div>
                </div>
                {totalPrice && (
                  <p className="shrink-0 text-sm font-extrabold text-violet-600 dark:text-violet-400">
                    {fmtPrice(totalPrice)} <span className="text-[10px] font-semibold">{currency}</span>
                  </p>
                )}
              </div>

              {/* ── Branch Selection (Requirement 1.i.c: below service name, changeable) ── */}
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
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
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
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ▼
                  </div>
                </div>
              </div>

              {/* ── Room / Arrangement Selection (Requirement 1.i.d & 1.i.e) ── */}
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
                  /* Requirement 1.i.e: If newly selected branch does not have room/arrangement with similar type/category show no room available */
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
                          {isSel && (
                            <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Date & Timeslot Section (Requirement 1.i.f) ── */}
              {selectedRoomId && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  {/* Date Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                      Select Date
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        min={todayStr}
                        max={maxDateStr}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rounded-xl border border-border/70 bg-card px-3.5 py-2 text-sm font-semibold shadow-sm focus:border-primary focus:outline-none transition cursor-pointer"
                      />
                      {/* Quick date chips */}
                      <button
                        type="button"
                        onClick={() => setSelectedDate(todayStr)}
                        className={cn(
                          'rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer border',
                          selectedDate === todayStr
                            ? 'bg-primary text-white border-primary'
                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          const tomorrowStr = kuwaitDateString(d);
                          setSelectedDate(tomorrowStr <= maxDateStr ? tomorrowStr : maxDateStr);
                        }}
                        className={cn(
                          'rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer border',
                          (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            return selectedDate === kuwaitDateString(d);
                          })()
                            ? 'bg-primary text-white border-primary'
                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>

                  {/* Timeslots */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      Available Timeslots
                    </label>

                    {scheduleLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        Loading available timeslots…
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No timeslots found for this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1">
                        {availableSlots.map(({ time, available }) => {
                          const isSel = selectedTimeSlot === time;
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={!available}
                              onClick={() => setSelectedTimeSlot(time)}
                              className={cn(
                                'rounded-xl py-2 px-1 text-center text-xs font-bold transition cursor-pointer border',
                                isSel
                                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm'
                                  : available
                                    ? 'bg-card text-foreground border-border/80 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20'
                                    : 'bg-muted/30 text-muted-foreground/40 border-border/30 cursor-not-allowed line-through'
                              )}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Auto-Selected Therapist (Requirement 1.i.g) ── */}
              {selectedTimeSlot && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-emerald-500" />
                      Assigned Therapist
                    </label>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Auto-Selected by Availability
                    </span>
                  </div>

                  {therapistsLoading ? (
                    <div className="flex items-center gap-2 py-3 px-4 rounded-xl border border-border/50 bg-muted/20 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                      Checking therapist availability for {selectedTimeSlot}…
                    </div>
                  ) : selectedTherapist ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-sm">
                        {getInitials(getTherapistDisplayName(selectedTherapist))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground">
                          {getTherapistDisplayName(selectedTherapist)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedTherapist.specialization || 'Spa Specialist'} • Available at {selectedTimeSlot}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Available
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">No therapist available</p>
                        <p>No therapist is available for this timeslot. Please select another timeslot above.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Error */}
              {submitError && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">{submitError}</p>
                </div>
              )}

              {/* Submit Success */}
              {submitSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                    Booking rescheduled successfully! Updating cache…
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
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
            disabled={
              submitting ||
              submitSuccess ||
              !selectedBranchId ||
              !selectedRoomId ||
              !selectedDate ||
              selectedDate > maxDateStr ||
              !selectedTimeSlot ||
              !selectedTherapistId
            }
            onClick={handleUpdateBooking}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer',
              submitting || submitSuccess || !selectedBranchId || !selectedRoomId || !selectedDate || !selectedTimeSlot || !selectedTherapistId
                ? 'bg-muted/70 text-muted-foreground/50 border border-border/60 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98]'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating Booking…
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Rescheduled!
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4" />
                Update Booking
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
