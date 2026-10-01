'use client';

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
}: RescheduleBookingModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  // ── States ───────────────────────────────────────────────────────────
  const [booking, setBooking] = useState<AnyRecord | null>(initialBooking ?? null);
  const [fetchingBooking, setFetchingBooking] = useState(!initialBooking);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Branches
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Arrangements
  const [arrangements, setArrangements] = useState<ApiArrangement[]>([]);
  const [arrangementsLoading, setArrangementsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Date & Timeslots
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  // Therapists
  const [therapists, setTherapists] = useState<ApiTherapist[]>([]);
  const [therapistSchedule, setTherapistSchedule] = useState<AnyRecord | null>(null);
  const [therapistsLoading, setTherapistsLoading] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [selectedTherapist, setSelectedTherapist] = useState<ApiTherapist | null>(null);

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
  const ref = firstTruthy(bk?.booking_reference, bk?.reference, bk?.id, bookingId);
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
  const prevArrType = firstTruthy(prevArrObj?.arrangement_type, prevArrObj?.type, bk?.arrangement_type, bk?.room_type, 'room');

  // Service ID
  const serviceId = firstTruthy(svcObj?.id, svcObj?.service_id, bk?.service_id);

  // Initialize selected branch and date from booking
  useEffect(() => {
    if (!bk) return;
    const initialBranchId = firstTruthy(
      bk?.branch_id,
      bk?.branch_data?.branch_id,
      bk?.branch_data?.id,
      bk?.branch?.id
    );
    if (initialBranchId && !selectedBranchId) {
      setSelectedBranchId(initialBranchId);
    }

    const isoStart = bk?.appointment_start ?? bk?.appointment_datetime ?? '';
    const dateRaw = firstTruthy(bk?.date, bk?.booking_date, bk?.appointment_date, isoStart ? isoStart.split('T')[0] : '');
    if (dateRaw && dateRaw >= todayStr) {
      setSelectedDate(dateRaw);
    } else {
      setSelectedDate(todayStr);
    }
  }, [bk, selectedBranchId, todayStr]);

  // ── 2. Fetch Branches ────────────────────────────────────────────────
  useEffect(() => {
    fetchJson('/api/v1/branches/')
      .then((data) => {
        const list: ApiBranch[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        setBranches(list);
      })
      .catch(() => setBranches([]));
  }, [fetchJson]);

  // ── 3. Fetch Arrangements when branch changes ───────────────────────
  useEffect(() => {
    if (!selectedBranchId) {
      setArrangements([]);
      setSelectedRoomId('');
      return;
    }

    setArrangementsLoading(true);
    setSelectedRoomId('');
    setSelectedTimeSlot('');
    setSelectedTherapistId('');
    setSelectedTherapist(null);

    const branchArrUrl = `/api/v1/service-arrangements/?branch_id=${selectedBranchId}`;
    const svcArrUrl = serviceId ? `/api/v1/services/${serviceId}/arrangements/?branch_id=${selectedBranchId}` : null;

    const fetchPromise = svcArrUrl
      ? fetchJson(svcArrUrl)
          .then((d) => (Array.isArray(d) && d.length > 0 ? d : fetchJson(branchArrUrl)))
          .catch(() => fetchJson(branchArrUrl))
      : fetchJson(branchArrUrl);

    fetchPromise
      .then((data) => {
        const list: ApiArrangement[] = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
        // Requirement 1.i.e: Only show rooms which is similar type of previously booked room/arrangement type
        const filtered = list.filter((a) => {
          const type = a.arrangement_type || a.type || '';
          return isSimilarArrangementType(type, prevArrType);
        });
        setArrangements(filtered);

        // Pre-select room if matches current booking or pick first
        const prevArrId = firstTruthy(
          bk?.service_arrangement_id,
          bk?.service_arrangement_data?.id,
          bk?.service_arrangement_data?.arrangement_id,
          bk?.arrangement_id
        );
        const matchPrev = filtered.find((a) => a.id === prevArrId);
        if (matchPrev) {
          setSelectedRoomId(matchPrev.id);
        } else if (filtered.length > 0) {
          setSelectedRoomId(filtered[0].id);
        }
      })
      .catch(() => setArrangements([]))
      .finally(() => setArrangementsLoading(false));
  }, [selectedBranchId, serviceId, prevArrType, fetchJson, bk]);

  // ── 4. Fetch Branch Schedule & Compute Slots when Room/Date changes ─
  useEffect(() => {
    if (!selectedBranchId || !selectedRoomId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    setScheduleLoading(true);
    const scheduleUrl = `/api/v1/service-arrangements/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`;

    fetchJson(scheduleUrl)
      .then((data) => {
        const rec = Array.isArray(data) ? data[0] : data;
        const grid: ApiGrid = rec?.grid ?? { start: '09:00', end: '22:00', slot_duration_minutes: 30 };
        const rawBookings: AnyRecord[] = rec?.bookings ?? [];

        // Filter bookings for the selected room
        const roomBookings = rawBookings.filter((b) => {
          const arrId = b.arrangement_id || b.service_arrangement_id;
          const bkId = b.id || b.booking_id || b.bookings_id;
          // Ignore current booking being rescheduled
          if (bkId && bkId === bookingId) return false;
          return arrId === selectedRoomId && b.status !== 'cancelled';
        });

        // Generate time slots
        const [startH, startM] = (grid.start || '09:00').split(':').map(Number);
        const [endH, endM] = (grid.end || '22:00').split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        const step = grid.slot_duration_minutes || 30;

        const now = new Date();
        const isToday = selectedDate === todayStr;
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const slots: { time: string; available: boolean }[] = [];

        for (let m = startMin; m < endMin; m += step) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hd = h % 12 === 0 ? 12 : h % 12;
          const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;

          // Check if slot has already passed today
          if (isToday && m <= currentTotalMinutes) {
            slots.push({ time: timeLabel, available: false });
            continue;
          }

          // Check if slot overlaps with any room booking
          const slotStart = m;
          const slotEnd = m + durationVal;

          let hasConflict = false;
          for (const b of roomBookings) {
            const bStart = new Date(b.start);
            const bEnd = new Date(b.end);
            const bStartMin = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
            const bEndMin = bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes();

            if (Math.max(slotStart, bStartMin) < Math.min(slotEnd, bEndMin)) {
              hasConflict = true;
              break;
            }
          }

          slots.push({ time: timeLabel, available: !hasConflict });
        }

        setAvailableSlots(slots);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setScheduleLoading(false));
  }, [selectedBranchId, selectedRoomId, selectedDate, durationVal, todayStr, bookingId, authHeader]);

  // ── 5. Fetch Therapists & Schedule for Auto-Selection ─────────────────
  useEffect(() => {
    if (!selectedBranchId || !selectedDate) {
      setTherapists([]);
      setTherapistSchedule(null);
      return;
    }

    setTherapistsLoading(true);
    const thUrl = serviceId
      ? `/api/v1/services/${serviceId}/therapists?branch_id=${selectedBranchId}`
      : `/api/v1/therapists/?branch_id=${selectedBranchId}`;
    const thSchedUrl = `/api/v1/therapists/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`;

    Promise.all([
      fetchJson(thUrl).catch(() => []),
      fetchJson(thSchedUrl).catch(() => null),
    ])
      .then(([thData, schedData]) => {
        const list: ApiTherapist[] = Array.isArray(thData) ? thData : (thData.data ?? thData.results ?? []);
        setTherapists(list);
        setTherapistSchedule(Array.isArray(schedData) ? schedData[0] : schedData);
      })
      .finally(() => setTherapistsLoading(false));
  }, [selectedBranchId, selectedDate, serviceId, fetchJson]);

  // ── 6. Auto-select available therapist when timeslot changes ─────────
  useEffect(() => {
    if (!selectedTimeSlot || therapists.length === 0) {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
      return;
    }

    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);
    const slotEndMin = slotStartMin + durationVal;

    const thBookings: AnyRecord[] = therapistSchedule?.bookings ?? [];
    const thAvailability: AnyRecord[] = therapistSchedule?.availability ?? [];

    // Find first available therapist
    let autoAssigned: ApiTherapist | null = null;

    for (const t of therapists) {
      // 1. Check existing bookings
      const bookingsForT = thBookings.filter((b) => {
        const tId = b.therapist_id || b.therapist?.id;
        const bkId = b.id || b.booking_id || b.bookings_id;
        if (bkId && bkId === bookingId) return false;
        return tId === t.id && b.status !== 'cancelled';
      });

      let hasBookingConflict = false;
      for (const b of bookingsForT) {
        const bStart = new Date(b.start);
        const bEnd = new Date(b.end);
        const bStartMin = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
        const bEndMin = bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes();

        if (Math.max(slotStartMin, bStartMin) < Math.min(slotEndMin, bEndMin)) {
          hasBookingConflict = true;
          break;
        }
      }

      if (hasBookingConflict) continue;

      // 2. Check working intervals if provided
      const tAvail = thAvailability.find((a) => a.therapist_id === t.id);
      if (tAvail && Array.isArray(tAvail.intervals) && tAvail.intervals.length > 0) {
        const isWithinInterval = tAvail.intervals.some((iv: { start: string; end: string }) => {
          const ivStartMin = parseTimeToMinutes(iv.start);
          const ivEndMin = parseTimeToMinutes(iv.end);
          return slotStartMin >= ivStartMin && slotEndMin <= ivEndMin;
        });
        if (!isWithinInterval) continue;
      }

      // If passed both, therapist is free!
      autoAssigned = t;
      break;
    }

    if (autoAssigned) {
      setSelectedTherapistId(autoAssigned.id);
      setSelectedTherapist(autoAssigned);
    } else {
      setSelectedTherapistId('');
      setSelectedTherapist(null);
    }
  }, [selectedTimeSlot, durationVal, therapists, therapistSchedule, bookingId]);

  // ── Handle Submit Reschedule ──────────────────────────────────────────
  const handleUpdateBooking = async () => {
    if (!selectedBranchId || !selectedRoomId || !selectedDate || !selectedTimeSlot || !selectedTherapistId) {
      setSubmitError('Please complete all fields (Branch, Room, Date, Timeslot, and Therapist)');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const selBranch = branches.find((b) => (b.id ?? b.branch_id) === selectedBranchId);
    const selRoom = arrangements.find((a) => a.id === selectedRoomId);
    const branchName = selBranch?.branch_name ?? selBranch?.name ?? 'Branch';
    const roomName = selRoom?.name ?? 'Room';
    const roomType = selRoom?.arrangement_type ?? selRoom?.type ?? prevArrType;

    const therapistName = getTherapistDisplayName(selectedTherapist);

    const formattedTime = toHHMM(selectedTimeSlot);
    const appointmentStartIso = `${selectedDate}T${formattedTime}Z`;
    const slotStartMin = parseTimeToMinutes(selectedTimeSlot);
    const slotEndMin = slotStartMin + durationVal;
    const endH = Math.floor(slotEndMin / 60);
    const endM = slotEndMin % 60;
    const endFormattedTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
    const appointmentEndIso = `${selectedDate}T${endFormattedTime}Z`;

    const payload = {
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
      therapist_id: selectedTherapistId,
      therapist_data: {
        id: selectedTherapistId,
        therapist_id: selectedTherapistId,
        therapist_name: therapistName,
        name: therapistName,
      },
      source: 'ushdesk',
      reason: 'Rescheduled by desk staff',
    };

    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || errData.message || (typeof errData.error === 'string' ? errData.error : errData.error?.message) || `Error ${res.status}`;
        throw new Error(msg);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 900);
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
            <div className="flex items-center gap-2 mb-1">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] font-mono font-semibold text-muted-foreground truncate">{ref}</p>
            </div>
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
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-sky-500" />
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
                          setSelectedDate(d.toISOString().split('T')[0]);
                        }}
                        className={cn(
                          'rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer border',
                          (() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 1);
                            return selectedDate === d.toISOString().split('T')[0];
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
