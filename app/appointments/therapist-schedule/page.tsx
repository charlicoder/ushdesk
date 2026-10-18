'use client';
// v2 – live API, calendar picker, dynamic branch/date
import { kuwaitWallClockDate } from '@/lib/datetime';
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Search, Plus, ChevronDown, Store, CalendarDays,
  CheckCircle2, Clock, AlertCircle, X, User, Scissors,
  Timer, Hash, MapPin, ChevronLeft, ChevronRight, Loader2,
  CalendarOff, Coffee, GripVertical,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import {
  TherapistScheduleBookingModal,
} from '@/components/bookings/TherapistScheduleBookingModal';
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal';
import { TherapistDayWorkingHoursModal } from '@/components/employees/DaySlotDetailModal';

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
  bookings_id?: string;
  payment_status?: string;
  customer?: {
    name?: string;
    phone?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  service?: {
    name?: string;
    service_name?: string;
  } | null;
  service_name?: string;
  customer_name?: string;
  client_name?: string;
}

interface ApiGrid {
  start: string;
  end: string;
  slot_duration_minutes: 30 | 60;
}

interface ApiBranch {
  branch_id: string;
  branch_name: string;
  opening_time?: string | null;
  closing_time?: string | null;
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
  therapists: ApiTherapist[];
  availability: ApiAvailability[];
  bookings: ApiBooking[];
}

// ── Slot model ─────────────────────────────────────────────────────────────────

type SlotStatus = 'unavailable' | 'available' | 'booking' | 'scheduled' | 'in_progress' | 'completed' | 'on_leave' | 'break_time';

interface Slot {
  status: SlotStatus;
  booking_status?: string;
  payment_status?: string;
  client?: string;
  service?: string;
  start?: string;
  end?: string;
  duration?: string;
  reference?: string;
  booking_type?: string;
}

// ── Therapist model used in UI ─────────────────────────────────────────────────

interface Therapist {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  color: string;
  branchId: string;
  branchName: string;
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
  completed: {
    label:    'Completed',
    badge:    'COMPLETED',
    dot:      'bg-[#2D241E]',
    cardCls:  'border-2 border-[#B8A394] bg-[#D3C0B2] text-[#2D241E] shadow-sm hover:shadow-md hover:border-[#9E8776]',
    badgeCls: 'text-[#2D241E] font-extrabold',
    pillCls:  'bg-[#2D241E]/15 text-[#2D241E] border border-[#2D241E]/20',
    iconCls:  'text-[#2D241E]',
    btnCls:   'bg-[#7D6453] hover:bg-[#685243]',
    btnLabel: 'Completed',
    Icon:     CheckCircle2,
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
  on_leave: {
    label:    'On Leave',
    badge:    'ON LEAVE',
    dot:      'bg-amber-500',
    cardCls:  'border-2 border-amber-300 dark:border-amber-700/60 bg-amber-100/90 dark:bg-amber-950/60 shadow-sm',
    badgeCls: 'text-amber-800 dark:text-amber-200 font-extrabold',
    pillCls:  'bg-amber-200 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    iconCls:  'text-amber-700 dark:text-amber-400',
    btnCls:   'bg-amber-500 hover:bg-amber-600',
    btnLabel: 'On Leave',
    Icon:     CalendarOff,
  },
} as const;

type ActiveStatus = keyof typeof STATUS_CFG;

// ── Slot Detail Modal ──────────────────────────────────────────────────────────
interface ModalPayload {
  slot:      Slot;
  therapist: Therapist;
  timeSlot:  string;
  branch:    string;
  date:      string;
}

function SlotDetailModal({
  payload,
  onClose,
  onSuccess,
  token,
}: {
  payload: ModalPayload;
  onClose: () => void;
  onSuccess?: () => void;
  token?: string;
}) {
  const { slot, therapist, timeSlot, branch, date } = payload;
  const cfg = STATUS_CFG[slot.status as ActiveStatus];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const refNo = slot.reference ?? `USH-${therapist.id.slice(0, 6).toUpperCase()}`;

  const handlePaymentDone = async () => {
    if (!slot.reference) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/booknpay/api/v1/bookings/${slot.reference}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          payment_status: 'success',
          reason:         'Paid on desk',
          source:         'ushdesk',
          status:         'confirmed',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setLoading(false);
    }
  };

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
              <div className={cn('absolute inset-0 rounded-full blur-md opacity-40 bg-gradient-to-br', therapist.color)} />
              <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-background shadow-md">
                {therapist.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={therapist.photoUrl} alt={therapist.name} className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
                <div className={cn('absolute inset-0 grid place-items-center text-white text-sm font-bold bg-gradient-to-br -z-10', therapist.color)}>
                  {therapist.initials}
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Therapist</p>
              <p className="text-base font-extrabold">{therapist.name}</p>
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
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Client</p>
              <p className="text-sm font-bold">{slot.client ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Service</p>
              <p className="text-sm font-bold">{slot.service ?? '—'}</p>
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
                <p className="text-sm font-bold truncate">{branch}</p>
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
        {error && (
          <div className="mx-6 mb-2 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2 border-t border-border/40 px-6 py-4">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          {(() => {
            const pStatus = (slot.payment_status ?? '').toLowerCase().trim();
            const isPaid = pStatus === 'success' || pStatus === 'paid' || pStatus === 'completed';
            const isPending = pStatus === 'pending' || pStatus === 'unpaid';

            if (isPaid) return null;
            if (isPending) {
              return (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handlePaymentDone}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer active:scale-[0.98]",
                    loading
                      ? "bg-emerald-400 cursor-wait opacity-80"
                      : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Payment done
                    </>
                  )}
                </button>
              );
            }
            return (
              <button className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition', cfg.btnCls)}>
                {cfg.btnLabel}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Slot Cell ──────────────────────────────────────────────────────────────────
function SlotCell({
  slot,
  onClick,
  onContextMenu,
  isSelected,
  isDraggable,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  slot: Slot;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}) {
  if (slot.status === 'unavailable') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={cn(
          "flex h-full min-h-[82px] flex-col items-center justify-center rounded-xl border transition-all select-none cursor-pointer p-1 text-center relative",
          isSelected
            ? "border-emerald-500 bg-emerald-500/20 dark:bg-emerald-500/30 ring-2 ring-emerald-500 shadow-md scale-[0.98]"
            : "border-border/60 dark:border-white/10 bg-[#707070]/25 dark:bg-white/5 hover:bg-[#707070]/40 hover:border-emerald-500/50"
        )}
        title={isSelected ? "Selected slot. Right-click to add as extra time" : "Unavailable slot — Click to select for extra hours, or right-click to add"}
      >
        {isSelected && (
          <div className="flex flex-col items-center justify-center gap-0.5 animate-in fade-in zoom-in-90">
            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" /> Selected
            </span>
          </div>
        )}
      </div>
    );
  }

  if (slot.status === 'on_leave') {
    return (
      <div className="flex h-full min-h-[82px] flex-col items-center justify-center rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-100/90 dark:bg-amber-950/60 p-1 text-center select-none cursor-not-allowed">
        <div className="flex flex-col items-center justify-center gap-1 w-full">
          <CalendarOff className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-200 leading-tight">
            On Leave
          </span>
          {slot.start && slot.end && (
            <span className="text-[8px] font-semibold text-amber-800/80 dark:text-amber-300/80 tabular-nums leading-tight">
              {slot.start}
              <br />
              {slot.end}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (slot.status === 'break_time') {
    return (
      <div
        role="button"
        tabIndex={0}
        draggable={isDraggable ?? true}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
        className={cn(
          "flex h-full min-h-[82px] flex-col items-center justify-between rounded-xl border border-teal-300 dark:border-teal-700/60 bg-teal-50/90 dark:bg-teal-950/50 p-1.5 text-center select-none transition group shadow-xs cursor-grab active:cursor-grabbing hover:border-teal-500 hover:bg-teal-100 dark:hover:bg-teal-900/60 hover:shadow-md",
          isDragging && "opacity-40 border-dashed border-teal-500 scale-95"
        )}
        title="Break Time — Drag vertically to move, or click to view working hours"
      >
        <div className="w-full flex items-center justify-between text-teal-600/70 dark:text-teal-400/70 px-0.5">
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab active:cursor-grabbing text-teal-600 dark:text-teal-400" />
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-teal-900 dark:text-teal-200">
            Break
          </span>
          <Coffee className="h-3.5 w-3.5 shrink-0 group-hover:scale-110 transition-transform text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 w-full my-auto">
          {slot.start && slot.end && (
            <span className="text-[8px] font-bold text-teal-900 dark:text-teal-100 tabular-nums leading-tight">
              {slot.start}
              <br />
              {slot.end}
            </span>
          )}
          {slot.duration && (
            <span className="text-[8px] font-medium text-teal-700/80 dark:text-teal-300/80">
              ({slot.duration})
            </span>
          )}
        </div>
        <div className="text-[7.5px] text-teal-600/80 dark:text-teal-400/80 font-bold uppercase tracking-tight">
          Drag to move
        </div>
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
        className="flex h-full min-h-[82px] items-center justify-center rounded-xl border border-dashed border-border/90 dark:border-white/15 bg-card/70 transition hover:border-primary hover:bg-primary/5 hover:shadow-sm cursor-pointer group px-1 text-center">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground/70 group-hover:text-primary transition rotate-90 whitespace-nowrap select-none">
          <Plus className="h-3 w-3 shrink-0" /> Available
        </span>
      </div>
    );
  }

  const cfg  = STATUS_CFG[slot.status as ActiveStatus] ?? STATUS_CFG.scheduled;
  const st   = (slot.status as ActiveStatus) in STATUS_CFG ? (slot.status as ActiveStatus) : 'scheduled';

  const bookingStatus = ((slot as any).booking_status ?? slot.status ?? '').toLowerCase().trim();
  const isCompleted = slot.status === 'completed' || bookingStatus === 'completed';
  const pStatus = (slot.payment_status ?? '').toLowerCase().trim();
  const isPaid = (pStatus === 'success' || pStatus === 'paid' || pStatus === 'completed') && !isCompleted;
  const isPending = (pStatus === 'pending' || pStatus === 'unpaid') && !isCompleted;

  // Background and border styling: #D3C0B2 if completed, green if success, red if pending, fallback to status
  const cardBorderBg = isCompleted
    ? 'border-[#B8A394] bg-[#D3C0B2] text-[#2D241E] shadow-sm hover:shadow-md hover:border-[#9E8776]'
    : isPaid
    ? 'border-emerald-400/80 dark:border-emerald-600/70 bg-gradient-to-br from-emerald-50 to-emerald-100/70 dark:from-emerald-950/70 dark:to-emerald-900/40 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-500'
    : isPending
    ? 'border-rose-400/80 dark:border-rose-600/70 bg-gradient-to-br from-rose-50 to-rose-100/70 dark:from-rose-950/70 dark:to-rose-900/40 shadow-sm shadow-rose-500/10 hover:shadow-rose-500/20 hover:border-rose-500'
    : st === 'in_progress'
    ? 'border-emerald-300/70 dark:border-emerald-600/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/60 dark:to-emerald-900/30 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-400'
    : st === 'booking'
    ? 'border-blue-300/70 dark:border-blue-600/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-400'
    : 'border-violet-300/70 dark:border-violet-600/50 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/60 dark:to-violet-900/30 shadow-sm shadow-violet-500/10 hover:shadow-violet-500/20 hover:border-violet-400';

  const accentBarColor = isCompleted
    ? 'bg-[#7D6453]'
    : isPaid
    ? 'bg-emerald-500'
    : isPending
    ? 'bg-rose-500'
    : st === 'in_progress'
    ? 'bg-emerald-500'
    : st === 'booking'
    ? 'bg-blue-500'
    : 'bg-violet-500';

  const pillCls = isCompleted
    ? 'bg-[#2D241E]/15 text-[#2D241E] font-extrabold border border-[#2D241E]/20'
    : isPaid
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
    : isPending
    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
    : cfg.pillCls;

  const dotCls = isCompleted
    ? 'bg-[#2D241E]'
    : isPaid
    ? 'bg-emerald-600'
    : isPending
    ? 'bg-rose-600'
    : cfg.dot;

  const iconBgCls = isCompleted
    ? 'bg-[#2D241E]/15'
    : isPaid
    ? 'bg-emerald-500/15'
    : isPending
    ? 'bg-rose-500/15'
    : st === 'in_progress'
    ? 'bg-emerald-500/15'
    : st === 'booking'
    ? 'bg-blue-500/15'
    : 'bg-violet-500/15';

  const iconCls = isCompleted
    ? 'text-[#2D241E]'
    : isPaid
    ? 'text-emerald-600 dark:text-emerald-400'
    : isPending
    ? 'text-rose-600 dark:text-rose-400'
    : cfg.iconCls;

  const durationCls = isCompleted
    ? 'bg-[#2D241E]/15 text-[#2D241E]'
    : isPaid
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : isPending
    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    : st === 'in_progress'
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : st === 'booking'
    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    : 'bg-violet-500/15 text-violet-700 dark:text-violet-300';

  const badgeLabel = isCompleted ? 'COMPLETED' : isPaid ? 'PAID' : isPending ? 'PENDING' : cfg.label;
  const Icon = isCompleted ? CheckCircle2 : isPaid ? CheckCircle2 : isPending ? Clock : cfg.Icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      style={isCompleted ? { backgroundColor: '#D3C0B2', borderColor: '#B8A394', color: '#2D241E' } : undefined}
      className={cn(
        'group relative h-full min-h-[82px] w-full flex rounded-xl overflow-hidden cursor-pointer select-none',
        'border transition-all duration-200 active:scale-[0.98]',
        cardBorderBg,
      )}
    >
      {/* Left accent bar */}
      <div className={cn('w-[3px] shrink-0', accentBarColor)} />

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between p-2 gap-1">

        {/* Row 1: status badge + icon */}
        <div className="flex items-center justify-between gap-1">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[8px] font-extrabold uppercase tracking-wider leading-none truncate max-w-[65px]',
            pillCls,
          )}>
            <span className={cn('h-[4px] w-[4px] rounded-full shrink-0', dotCls)} />
            <span className="truncate">{badgeLabel}</span>
          </span>
          <div className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-md', iconBgCls)}>
            <Icon className={cn('h-2.5 w-2.5', iconCls)} />
          </div>
        </div>

        {/* Row 2: Customer full name and Service full name */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {slot.client && (
            <p className={cn("text-xs font-bold leading-tight truncate", isCompleted ? "text-[#2D241E]" : "text-foreground")} title={slot.client}>
              {slot.client}
            </p>
          )}
          {slot.service && (
            <p className={cn("text-[10px] font-semibold leading-tight truncate", isCompleted ? "text-[#5C4A3E]" : "text-muted-foreground")} title={slot.service}>
              {slot.service}
            </p>
          )}
          {!slot.client && !slot.service && (
            <p className={cn("text-xs font-bold leading-tight", isCompleted ? "text-[#2D241E]" : "text-foreground")}>
              Booked
            </p>
          )}
        </div>

        {/* Row 3: duration pill + time range */}
        <div className={cn("flex items-center justify-between gap-1 pt-1 border-t text-[10px]", isCompleted ? "border-[#B8A394]/50" : "border-border/20")}>
          {slot.duration && (
            <span className={cn(
              'inline-flex items-center gap-[2px] rounded-md px-1 py-[2px] text-[9px] font-bold leading-none shrink-0',
              durationCls,
            )}>
              <Timer className="h-2.5 w-2.5 shrink-0" />
              {slot.duration}
            </span>
          )}
          {slot.start && slot.end && (
            <span className={cn("text-[9px] font-semibold leading-none tabular-nums truncate", isCompleted ? "text-[#5C4A3E]" : "text-muted-foreground")}>
              {slot.start}–{slot.end}
            </span>
          )}
        </div>
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

// ── Time slot generation from grid ────────────────────────────────────────────
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

// ── Timezone & Past Slot Helpers ──────────────────────────────────────────────
function getCurrentKuwaitDateTime(): { dateStr: string; minutes: number } {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    let h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    if (h === 24) h = 0;
    const min = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    if (y && m && d) {
      return {
        dateStr: `${y}-${m}-${d}`,
        minutes: h * 60 + min,
      };
    }
  } catch {
    // fallback to local time
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    dateStr: `${y}-${m}-${d}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

function slotToMinutes(label: string): number {
  if (!label) return 0;
  const parts = label.trim().split(/\s+/);
  const [hStr, mStr] = (parts[0] || '0:0').split(':');
  let h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const period = parts[1]?.toUpperCase();
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return h * 60 + m;
}

function minutesToTime24(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function getBreakDurationMinutes(slot: Slot): number {
  if (slot.start && slot.end) {
    const diff = slotToMinutes(slot.end) - slotToMinutes(slot.start);
    if (diff > 0) return diff;
  }
  if (slot.duration) {
    const num = parseInt(slot.duration, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return 60;
}

function isSlotInPast(selectedDate: string, slotLabel: string): boolean {
  if (!selectedDate || !slotLabel) return false;
  const current = getCurrentKuwaitDateTime();
  if (selectedDate < current.dateStr) return true;
  if (selectedDate > current.dateStr) return false;
  const slotMin = slotToMinutes(slotLabel);
  return slotMin <= current.minutes;
}

// ── Build schedule map from API data ──────────────────────────────────────────
function buildScheduleFromApi(
  therapists: ApiTherapist[],
  availability: ApiAvailability[],
  bookings: ApiBooking[],
  timeSlots: string[],
  slotDurationMinutes: number,
  selectedDate?: string,
): Record<string, Record<string, Slot>> {
  const sched: Record<string, Record<string, Slot>> = {};

  const availMap: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const av of availability) {
    availMap[av.therapist_id] = av.intervals.map(iv => {
      const s = new Date(iv.start);
      const e = new Date(iv.end);
      return { startMin: s.getHours() * 60 + s.getMinutes(), endMin: e.getHours() * 60 + e.getMinutes() };
    });
  }

  type BkEntry = {
    startMin: number;
    endMin: number;
    client?: string;
    service?: string;
    startLabel: string;
    endLabel: string;
    duration: string;
    reference?: string;
    status: string;
    payment_status?: string;
    booking_type?: string;
  };
  const bookingMap: Record<string, BkEntry[]> = {};
  for (const bk of bookings) {
    const rawStatus = String(bk.status ?? (bk as any).booking_status ?? '').toLowerCase().trim();
    if (rawStatus === 'cancelled' || rawStatus === 'refunded') {
      continue;
    }
    if (!bookingMap[bk.therapist_id]) bookingMap[bk.therapist_id] = [];
    const s = kuwaitWallClockDate(bk.start);
    const e = kuwaitWallClockDate(bk.end);
    const sm = s.getUTCHours() * 60 + s.getUTCMinutes();
    const em = e.getUTCHours() * 60 + e.getUTCMinutes();
    const fmt = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd   = h % 12 === 0 ? 12 : h % 12;
      return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    const durationMin = bk.duration_minutes ?? (em - sm);
    const clientName = bk.customer?.name ||
      (bk.customer?.first_name ? `${bk.customer.first_name} ${bk.customer.last_name ?? ''}`.trim() : undefined) ||
      (bk.customer as any)?.full_name ||
      bk.customer_name ||
      bk.client_name ||
      undefined;
    const serviceName = bk.service?.name ||
      (bk.service as any)?.service_name ||
      bk.service_name ||
      undefined;
    const paymentStatus = (bk.payment_status ?? (bk as any).paymentStatus ?? '').toString().toLowerCase().trim();
    const bookingType = String(bk.booking_type ?? (bk as any).type ?? '').toLowerCase().trim();

    bookingMap[bk.therapist_id].push({
      startMin:   sm,
      endMin:     em,
      client:     clientName,
      service:    serviceName,
      startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()),
      endLabel:   fmt(e.getUTCHours(), e.getUTCMinutes()),
      duration:   `${durationMin}m`,
      reference:  bk.booking_id ?? bk.bookings_id ?? bk.id,
      status:     bk.status ?? (bk as any).booking_status ?? 'scheduled',
      payment_status: paymentStatus || undefined,
      booking_type: bookingType || undefined,
    });
  }

  const therapistBreakMap: Record<string, { startMin: number; endMin: number; startLabel: string; endLabel: string }[]> = {};
  for (const av of availability) {
    const rawBreaks = (av as any).break_intervals ?? (av as any).break_times;
    if (Array.isArray(rawBreaks)) {
      if (!therapistBreakMap[av.therapist_id]) therapistBreakMap[av.therapist_id] = [];
      for (const brk of rawBreaks) {
        if (brk.start && brk.end) {
          const s = kuwaitWallClockDate(brk.start);
          const e = kuwaitWallClockDate(brk.end);
          const sm = s.getUTCHours() * 60 + s.getUTCMinutes();
          const em = e.getUTCHours() * 60 + e.getUTCMinutes();
          const fmt = (h: number, m: number) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hd = h % 12 === 0 ? 12 : h % 12;
            return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
          };
          therapistBreakMap[av.therapist_id].push({
            startMin: sm,
            endMin: em,
            startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()),
            endLabel: fmt(e.getUTCHours(), e.getUTCMinutes()),
          });
        } else if (brk.start_time && brk.end_time) {
          const sm = slotToMinutes(brk.start_time);
          const em = slotToMinutes(brk.end_time);
          therapistBreakMap[av.therapist_id].push({
            startMin: sm,
            endMin: em,
            startLabel: brk.start_time,
            endLabel: brk.end_time,
          });
        }
      }
    }
  }

  for (const t of therapists) {
    const rawBreaks = (t as any).break_intervals ?? (t as any).break_times;
    if (Array.isArray(rawBreaks)) {
      if (!therapistBreakMap[t.id]) therapistBreakMap[t.id] = [];
      for (const brk of rawBreaks) {
        if (brk.start && brk.end) {
          const s = kuwaitWallClockDate(brk.start);
          const e = kuwaitWallClockDate(brk.end);
          const sm = s.getUTCHours() * 60 + s.getUTCMinutes();
          const em = e.getUTCHours() * 60 + e.getUTCMinutes();
          const fmt = (h: number, m: number) => {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hd = h % 12 === 0 ? 12 : h % 12;
            return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
          };
          therapistBreakMap[t.id].push({
            startMin: sm,
            endMin: em,
            startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()),
            endLabel: fmt(e.getUTCHours(), e.getUTCMinutes()),
          });
        } else if (brk.start_time && brk.end_time) {
          const sm = slotToMinutes(brk.start_time);
          const em = slotToMinutes(brk.end_time);
          therapistBreakMap[t.id].push({
            startMin: sm,
            endMin: em,
            startLabel: brk.start_time,
            endLabel: brk.end_time,
          });
        }
      }
    }
  }

  for (const therapist of therapists) {
    sched[therapist.id] = {};
    const avIntervals = availMap[therapist.id]  ?? [];
    const bkSlots     = bookingMap[therapist.id] ?? [];

    for (const slotLabel of timeSlots) {
      const slotStart = slotToMinutes(slotLabel);
      const slotEnd   = slotStart + slotDurationMinutes;

      const bk = bkSlots.find(b => b.startMin < slotEnd && b.endMin > slotStart);
      if (bk) {
        const isLeave =
          bk.booking_type === 'leave' ||
          bk.booking_type === 'on_leave' ||
          bk.status.toLowerCase() === 'leave' ||
          bk.status.toLowerCase() === 'on_leave' ||
          (bk.service ?? '').toLowerCase() === 'leave' ||
          (bk.service ?? '').toLowerCase() === 'on leave';

        if (isLeave) {
          sched[therapist.id][slotLabel] = {
            status: 'on_leave',
            booking_status: bk.status,
            service: 'On Leave',
            start: bk.startLabel,
            end: bk.endLabel,
            duration: bk.duration,
            reference: bk.reference,
            booking_type: 'leave',
          };
          continue;
        }

        const isBreak =
          bk.booking_type === 'break_time' ||
          bk.status.toLowerCase() === 'break_time' ||
          bk.status.toLowerCase() === 'break' ||
          (bk as any).is_break ||
          (bk.service ?? '').toLowerCase() === 'break time' ||
          (bk.service ?? '').toLowerCase() === 'break';

        if (isBreak) {
          sched[therapist.id][slotLabel] = {
            status: 'break_time',
            booking_status: 'break_time',
            service: 'Break Time',
            start: bk.startLabel,
            end: bk.endLabel,
            duration: bk.duration,
            reference: bk.reference,
            booking_type: 'break_time',
          };
          continue;
        }

        let st: SlotStatus = 'scheduled';
        const bkStatusLower = (bk.status ?? '').toLowerCase();
        if (bkStatusLower === 'completed') st = 'completed';
        else if (bkStatusLower === 'in_progress') st = 'in_progress';
        else if (bkStatusLower === 'booking' || bkStatusLower === 'pending') st = 'booking';
        // Store full booking info on every overlapping slot.
        // The render layer handles span merging via look-ahead.
        sched[therapist.id][slotLabel] = {
          status: st,
          booking_status: bk.status,
          client:    bk.client,
          service:   bk.service,
          start:     bk.startLabel,
          end:       bk.endLabel,
          duration:  bk.duration,
          reference: bk.reference,
          payment_status: bk.payment_status,
          booking_type: bk.booking_type,
        };
        continue;
      }

      // Check if slot falls in break intervals
      const brk = therapistBreakMap[therapist.id]?.find(b => b.startMin < slotEnd && b.endMin > slotStart);
      if (brk) {
        sched[therapist.id][slotLabel] = {
          status: 'break_time',
          booking_status: 'break_time',
          service: 'Break Time',
          start: brk.startLabel,
          end: brk.endLabel,
          duration: `${brk.endMin - brk.startMin}m`,
          booking_type: 'break_time',
        };
        continue;
      }

      const isAvail = avIntervals.some(av => av.startMin <= slotStart && av.endMin >= slotEnd);
      const isPast = selectedDate ? isSlotInPast(selectedDate, slotLabel) : false;
      sched[therapist.id][slotLabel] = { status: (isAvail && !isPast) ? 'available' : 'unavailable' };
    }
  }
  return sched;
}

function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatHeaderDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TherapistSchedulePage() {
  // Auth token from Redux store
  const token  = useAppSelector((s) => s.auth.token);
  const locale = useAppSelector((s) => s.ui.locale);

  // Today's date as YYYY-MM-DD (Kuwait wall-clock date)
  const todayStr = getCurrentKuwaitDateTime().dateStr;

  // Selected branch — defaults to first available branch once branch list is loaded
  const [branchList,       setBranchList]        = useState<ApiBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId]  = useState<string>('');
  const [selectedDate,     setSelectedDate]      = useState<string>(todayStr);
  const [search,           setSearch]            = useState('');
  const [modal,            setModal]             = useState<ModalPayload | null>(null);
  const [detailBookingId,  setDetailBookingId]   = useState<string | null>(null);
  const [bookingModal,     setBookingModal]      = useState<{ therapist: Therapist; timeSlot: string } | null>(null);
  const [selectedBreakTherapist, setSelectedBreakTherapist] = useState<{ therapist: Therapist; slot: Slot; date: string } | null>(null);

  // Drag-and-drop state for break times
  const [draggedBreak, setDraggedBreak] = useState<{
    therapistId: string;
    therapistName: string;
    originalTimeSlot: string;
    durationMinutes: number;
  } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ therapistId: string; time: string } | null>(null);
  const [updatingBreak, setUpdatingBreak] = useState(false);
  const [breakToast, setBreakToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const dragJustEndedRef = useRef(false);

  // State for selecting contiguous unavailable slots & adding extra hours
  const [selectedUnavailable, setSelectedUnavailable] = useState<{
    therapistId: string;
    therapistName: string;
    slotTimes: string[];
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    therapist: Therapist;
    slotTimes: string[];
  } | null>(null);
  const [addingExtraHours, setAddingExtraHours] = useState(false);

  const [showBranchDrop,   setShowBranchDrop]    = useState(false);
  const [showCalendar,     setShowCalendar]      = useState(false);

  const [scheduleData, setScheduleData] = useState<ApiScheduleRecord | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);

  // Preserve both vertical window scroll and horizontal therapist schedule scroll
  const preserveScroll = useCallback(() => {
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    const scrollX = bodyScrollRef.current ? bodyScrollRef.current.scrollLeft : 0;
    return () => {
      requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && window.scrollY !== scrollY) {
          window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
        }
        if (bodyScrollRef.current && bodyScrollRef.current.scrollLeft !== scrollX) {
          bodyScrollRef.current.scrollLeft = scrollX;
        }
      });
    };
  }, []);

  const onBodyScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  // Load branches list on mount and set first available branch as default
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/branches', {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': locale,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          if (active) setLoading(false);
          return;
        }
        const json = await res.json().catch(() => ({}));
        const rawList = Array.isArray(json)
          ? json
          : (json?.data ?? json?.results ?? json?.branches ?? []);
        if (Array.isArray(rawList)) {
          const list: ApiBranch[] = rawList
            .map((b: any) => ({
              branch_id:    String(b.id ?? b.branch_id ?? ''),
              branch_name:  String(b.name ?? b.branch_name ?? ''),
              opening_time: b.opening_time ?? null,
              closing_time: b.closing_time ?? null,
            }))
            .filter((b: ApiBranch) => Boolean(b.branch_id));

          if (active) {
            if (list.length > 0) {
              setBranchList(list);
              setSelectedBranchId((prev) => (prev && list.some(b => b.branch_id === prev) ? prev : list[0].branch_id));
            } else {
              setLoading(false);
            }
          }
        } else if (active) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token, locale]);

  // Fetch schedule when branch, date, or locale changes
  useEffect(() => {
    if (!selectedBranchId) return;

    const controller = new AbortController();

    (async () => {
      // Only set loading to true on initial load (when scheduleData is not yet loaded)
      // This prevents unmounting the schedule grid on refreshes and prevents scrolling to top
      if (!scheduleData) {
        setLoading(true);
      }
      setError(null);
      const restoreScroll = preserveScroll();
      try {
        const url = `/api/v1/therapists/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`;
        const res = await fetch(url, {
          signal:  controller.signal,
          headers: {
            'Content-Type':    'application/json',
            'Accept':          'application/json',
            'Accept-Language': locale,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as Record<string, string>).detail ?? `Error ${res.status}`);
        }
        const data: ApiScheduleRecord[] = await res.json();
        const record = data?.[0] ?? null;

        // ── Secondary fetch: enrich bookings with status and payment_status from booknpay ──
        if (record?.bookings?.length) {
          try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBranchId);
            const branchParam = isUuid ? `&branch_id=${selectedBranchId}` : '';
            const bpUrl = selectedDate
              ? `/booknpay/api/v1/bookings?date=${selectedDate}${branchParam}&page_size=100`
              : `/booknpay/api/v1/bookings?page_size=100`;

            const headers: Record<string, string> = {
              'Content-Type':    'application/json',
              'Accept':          'application/json',
              'Accept-Language': locale,
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            };

            const fetchTasks: Promise<any>[] = [
              fetch(bpUrl, { signal: controller.signal, headers })
                .then(res => (res.ok ? res.json() : null))
                .catch(() => null),
            ];

            if (isUuid && selectedDate) {
              fetchTasks.push(
                fetch(`/api/v1/service-arrangements/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`, {
                  signal: controller.signal,
                  headers,
                })
                  .then(res => (res.ok ? res.json() : null))
                  .catch(() => null)
              );
            }

            const [bpResult, saResult] = await Promise.all(fetchTasks);

            const payMap: Record<string, string> = {};
            const statusMap: Record<string, string> = {};

            // Process booknpay bookings
            if (bpResult) {
              const bkList: Record<string, unknown>[] = Array.isArray(bpResult)
                ? bpResult
                : (bpResult?.data ?? bpResult?.results ?? []);
              for (const bk of bkList) {
                const ps = String(bk.payment_status ?? (bk.payment_data as any)?.status ?? '').toLowerCase().trim();
                const st = String(bk.status ?? (bk as any).booking_status ?? '').toLowerCase().trim();
                const ids = [bk.id, bk.booking_id, bk.bookings_id].filter(Boolean).map(String);
                for (const id of ids) {
                  if (ps) payMap[id] = ps;
                  if (st) statusMap[id] = st;
                }
              }
            }

            // Process service-arrangements schedule
            if (saResult) {
              const records = Array.isArray(saResult) ? saResult : [saResult];
              for (const rec of records) {
                const bks = Array.isArray(rec?.bookings) ? rec.bookings : [];
                for (const bk of bks) {
                  const ps = String(bk?.payment_status ?? '').toLowerCase().trim();
                  const st = String(bk?.status ?? (bk as any)?.booking_status ?? '').toLowerCase().trim();
                  const ids = [bk.id, bk.booking_id, bk.bookings_id].filter(Boolean).map(String);
                  for (const id of ids) {
                    if (ps) payMap[id] = ps;
                    if (st) statusMap[id] = st;
                  }
                }
              }
            }

            if (Object.keys(payMap).length > 0 || Object.keys(statusMap).length > 0) {
              record.bookings = record.bookings.map(bk => {
                const matchId = [
                  String(bk.booking_id ?? ''),
                  String(bk.bookings_id ?? ''),
                  String(bk.id ?? ''),
                ].find(id => id && (payMap[id] || statusMap[id]));
                if (!matchId) return bk;
                return {
                  ...bk,
                  ...(payMap[matchId] ? { payment_status: payMap[matchId] } : {}),
                  ...(statusMap[matchId] ? { status: statusMap[matchId] } : {}),
                };
              });
            }
          } catch {
            // Secondary fetch failure is non-fatal — schedule still shows
          }
        }

        if (record?.bookings?.length) {
          record.bookings = record.bookings.filter(bk => {
            const st = String(bk.status ?? (bk as any)?.booking_status ?? '').toLowerCase().trim();
            return st !== 'cancelled' && st !== 'refunded';
          });
        }

        setScheduleData(record);
        restoreScroll();
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
        if (!scheduleData) {
          setScheduleData(null);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedBranchId, selectedDate, token, locale, scheduleRefreshKey, preserveScroll]);

  // Derived data — use branch opening/closing as authoritative grid bounds
  const selectedBranchInfo = useMemo(
    () => branchList.find(b => b.branch_id === selectedBranchId) ?? null,
    [branchList, selectedBranchId],
  );
  const grid = useMemo((): ApiGrid => {
    const apiGrid = scheduleData?.grid;
    // Branch hours take priority over therapist-shift-derived grid
    const openT  = selectedBranchInfo?.opening_time ?? apiGrid?.start  ?? '09:00';
    const closeT = selectedBranchInfo?.closing_time ?? apiGrid?.end    ?? '22:00';
    // Normalise to HH:MM (strip seconds if present)
    const trim = (t: string) => t.substring(0, 5);
    return {
      start:                trim(openT),
      end:                  trim(closeT),
      slot_duration_minutes: (apiGrid?.slot_duration_minutes ?? 30) as 30 | 60,
    };
  }, [selectedBranchInfo, scheduleData]);
  const timeSlots = generateTimeSlots(grid);
  const therapists: Therapist[] = (scheduleData?.therapists ?? []).map((t, i) => ({
    id:         t.id,
    name:       t.name,
    initials:   getInitials(t.name),
    photoUrl:   t.photo_url,
    color:      THERAPIST_COLORS[i % THERAPIST_COLORS.length],
    branchId:   t.branch_id,
    branchName: t.branch_name,
  }));

  // Auto-refresh minute tick to keep past-time checks up to date
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick(t => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const schedule = scheduleData
    ? buildScheduleFromApi(scheduleData.therapists, scheduleData.availability, scheduleData.bookings, timeSlots, grid.slot_duration_minutes, selectedDate)
    : {};

  const filteredTherapists = search
    ? therapists.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : therapists;

  const allSlots    = therapists.flatMap(t => Object.values(schedule[t.id] ?? {}));
  const bookedCount = allSlots.filter(s => s.status !== 'unavailable' && s.status !== 'available' && s.status !== 'on_leave').length;
  const availCount  = allSlots.filter(s => s.status === 'available').length;
  const occupancy   = Math.round((bookedCount / (bookedCount + availCount)) * 100) || 0;

  // Branch list combines /api/v1/branches with schedule response
  const apiBranches: ApiBranch[] = useMemo(() => {
    const map = new Map<string, string>();
    branchList.forEach(b => map.set(b.branch_id, b.branch_name));
    (scheduleData?.branch?.branches ?? []).forEach(b => {
      if (b.branch_id && !map.has(b.branch_id)) {
        map.set(b.branch_id, b.branch_name);
      }
    });
    if (scheduleData?.branch?.id && scheduleData.branch.id !== 'all' && !map.has(scheduleData.branch.id)) {
      map.set(scheduleData.branch.id, scheduleData.branch.name ?? scheduleData.branch.id);
    }
    return Array.from(map.entries()).map(([branch_id, branch_name]) => ({ branch_id, branch_name }));
  }, [branchList, scheduleData]);

  useEffect(() => {
    if (!selectedBranchId && apiBranches.length > 0) {
      setSelectedBranchId(apiBranches[0].branch_id);
    }
  }, [selectedBranchId, apiBranches]);

  const branchLabel = apiBranches.find(b => b.branch_id === selectedBranchId)?.branch_name ?? 'Select Branch';

  const dateDisplay = formatDateDisplay(selectedDate);

  const openModal = useCallback((slot: Slot, therapist: Therapist, timeSlot: string) => {
    // Prefer full API fetch when we have a booking reference ID
    if (slot.reference && slot.reference.length > 10) {
      setDetailBookingId(slot.reference);
    } else {
      setModal({ slot, therapist, timeSlot, branch: branchLabel, date: dateDisplay });
    }
  }, [branchLabel, dateDisplay]);

  const openBookingModal = useCallback((therapist: Therapist, timeSlot: string) => {
    if (isSlotInPast(selectedDate, timeSlot)) return;
    setBookingModal({ therapist, timeSlot });
  }, [selectedDate]);

  const handleDropBreak = useCallback(async (
    therapist: Therapist,
    targetTimeSlot: string,
    breakData: {
      therapistId: string;
      therapistName: string;
      originalTimeSlot: string;
      durationMinutes: number;
    }
  ) => {
    setDraggedBreak(null);
    setDragOverSlot(null);

    // If dropped on the same starting slot, do nothing
    if (breakData.originalTimeSlot === targetTimeSlot) {
      return;
    }

    const restoreScroll = preserveScroll();

    const startMin = slotToMinutes(targetTimeSlot);
    const endMin = startMin + breakData.durationMinutes;

    const breakStartStr = minutesToTime24(startMin);
    const breakEndStr = minutesToTime24(endMin);

    const format12h = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    const newStartLabel = format12h(startMin);
    const newEndLabel = format12h(endMin);

    // Save previous schedule data for potential rollback
    const previousScheduleData = scheduleData;

    // 1. Optimistic Local Update — move break immediately with 0ms delay
    const newBreakObj = {
      start_time: newStartLabel,
      end_time: newEndLabel,
      start: `${selectedDate}T${breakStartStr}`,
      end: `${selectedDate}T${breakEndStr}`,
    };

    setScheduleData(prev => {
      if (!prev) return prev;

      const newTherapists: ApiTherapist[] = prev.therapists.map(t => {
        if (t.id !== therapist.id) return t;
        return {
          ...t,
          break_times: [newBreakObj],
          break_intervals: [newBreakObj],
        } as unknown as ApiTherapist;
      });

      let foundAv = false;
      const newAvailability: ApiAvailability[] = prev.availability.map(av => {
        if (av.therapist_id !== therapist.id) return av;
        foundAv = true;
        return {
          ...av,
          break_times: [newBreakObj],
          break_intervals: [newBreakObj],
        } as unknown as ApiAvailability;
      });
      if (!foundAv) {
        newAvailability.push({
          therapist_id: therapist.id,
          intervals: [],
          break_times: [newBreakObj],
          break_intervals: [newBreakObj],
        } as unknown as ApiAvailability);
      }

      const newBookings: ApiBooking[] = prev.bookings.map(bk => {
        if (bk.therapist_id !== therapist.id) return bk;
        const svcName = (typeof bk.service === 'string' ? bk.service : (bk.service?.name ?? bk.service?.service_name ?? bk.service_name ?? '')).toLowerCase();
        const isBkBreak =
          bk.booking_type === 'break_time' ||
          (bk.status ?? '').toLowerCase() === 'break_time' ||
          (bk.status ?? '').toLowerCase() === 'break' ||
          (bk as any).is_break ||
          svcName.includes('break');
        if (!isBkBreak) return bk;
        return {
          ...bk,
          start: `${selectedDate}T${breakStartStr}`,
          end: `${selectedDate}T${breakEndStr}`,
          booking_type: 'break_time',
          status: 'break_time',
          service: { name: 'Break Time', service_name: 'Break Time' },
          service_name: 'Break Time',
        };
      });

      return {
        ...prev,
        therapists: newTherapists,
        availability: newAvailability,
        bookings: newBookings,
      };
    });

    restoreScroll();

    // 2. Send backend API request in background
    const d = new Date(selectedDate + 'T00:00:00');
    const djangoDay = (d.getDay() + 6) % 7;

    setUpdatingBreak(true);
    try {
      const payload: Record<string, unknown> = {
        therapist_id: therapist.id,
        break_start_time: breakStartStr,
        break_end_time: breakEndStr,
        break_duration: breakData.durationMinutes,
        day_of_week: djangoDay,
      };

      const res = await authedFetch('/uauth/api/v1/therapists/break-time/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update break time on server');
      }

      setBreakToast({
        type: 'success',
        message: `Break for ${therapist.name} moved to ${targetTimeSlot} (${breakData.durationMinutes}m)`,
      });

      // 3. Silent refresh in background without unmounting grid or scrolling
      setScheduleRefreshKey((k) => k + 1);
      restoreScroll();
    } catch (err) {
      // Rollback optimistic update on error
      if (previousScheduleData) {
        setScheduleData(previousScheduleData);
      }
      setBreakToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update break time',
      });
      restoreScroll();
    } finally {
      setUpdatingBreak(false);
      setTimeout(() => setBreakToast(null), 4000);
    }
  }, [selectedDate, scheduleData, preserveScroll]);

  // Handle clicking an unavailable slot (supports selecting multiple contiguous slots)
  const handleUnavailableClick = useCallback((therapist: Therapist, time: string) => {
    setContextMenu(null);
    const timeIdx = timeSlots.indexOf(time);
    if (timeIdx === -1) return;

    setSelectedUnavailable((prev) => {
      // If switching therapists or starting fresh, select this slot
      if (!prev || prev.therapistId !== therapist.id || prev.slotTimes.length === 0) {
        return {
          therapistId: therapist.id,
          therapistName: therapist.name,
          slotTimes: [time],
        };
      }

      // If clicking the only selected slot, toggle off (deselect)
      if (prev.slotTimes.length === 1 && prev.slotTimes[0] === time) {
        return null;
      }

      const prevIndices = prev.slotTimes
        .map((t) => timeSlots.indexOf(t))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b);

      const minIdx = prevIndices[0];
      const maxIdx = prevIndices[prevIndices.length - 1];

      // If clicking the start boundary of a multi-slot selection, shrink by one
      if (timeIdx === minIdx) {
        const remaining = prev.slotTimes.filter((t) => t !== time);
        return { ...prev, slotTimes: remaining };
      }

      // If clicking the end boundary of a multi-slot selection, shrink by one
      if (timeIdx === maxIdx) {
        const remaining = prev.slotTimes.filter((t) => t !== time);
        return { ...prev, slotTimes: remaining };
      }

      // Contiguous range extension
      const rangeStart = Math.min(minIdx, timeIdx);
      const rangeEnd = Math.max(maxIdx, timeIdx);

      // Verify all slots in the range are unavailable for this therapist
      const allUnavailable = timeSlots
        .slice(rangeStart, rangeEnd + 1)
        .every((t) => (schedule[therapist.id]?.[t]?.status ?? 'unavailable') === 'unavailable');

      if (allUnavailable) {
        const newSlots = timeSlots.slice(rangeStart, rangeEnd + 1);
        return {
          therapistId: therapist.id,
          therapistName: therapist.name,
          slotTimes: newSlots,
        };
      }

      // If not contiguous or crosses booked/break slots, start fresh with clicked slot
      return {
        therapistId: therapist.id,
        therapistName: therapist.name,
        slotTimes: [time],
      };
    });
  }, [timeSlots, schedule]);

  // Handle right-click context menu on an unavailable slot
  const handleUnavailableContextMenu = useCallback((
    e: React.MouseEvent,
    therapist: Therapist,
    time: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let targetSlots: string[];
    if (
      selectedUnavailable &&
      selectedUnavailable.therapistId === therapist.id &&
      selectedUnavailable.slotTimes.includes(time)
    ) {
      targetSlots = selectedUnavailable.slotTimes;
    } else {
      targetSlots = [time];
      setSelectedUnavailable({
        therapistId: therapist.id,
        therapistName: therapist.name,
        slotTimes: [time],
      });
    }

    const x = Math.min(e.clientX, typeof window !== 'undefined' ? window.innerWidth - 270 : e.clientX);
    const y = Math.min(e.clientY, typeof window !== 'undefined' ? window.innerHeight - 200 : e.clientY);

    setContextMenu({
      x,
      y,
      therapist,
      slotTimes: targetSlots,
    });
  }, [selectedUnavailable]);

  // Add extra working hours for selected contiguous slots
  const handleAddExtraTime = useCallback(async (therapist: Therapist, slotTimes: string[]) => {
    if (slotTimes.length === 0) return;
    setContextMenu(null);

    const sorted = [...slotTimes].sort((a, b) => timeSlots.indexOf(a) - timeSlots.indexOf(b));
    const firstSlot = sorted[0];
    const lastSlot = sorted[sorted.length - 1];

    const startMin = slotToMinutes(firstSlot);
    const endMin = slotToMinutes(lastSlot) + grid.slot_duration_minutes;

    const startStr = minutesToTime24(startMin);
    const endStr = minutesToTime24(endMin);

    const format12h = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const timeRangeLabel = `${format12h(startMin)} – ${format12h(endMin)}`;
    const restoreScroll = preserveScroll();

    // Snapshot current schedule data for potential rollback
    const previousScheduleData = scheduleData;

    // 1. Optimistic update: immediately add working interval so slots turn available with 0ms delay
    setScheduleData((prev) => {
      if (!prev) return prev;
      const newInterval = {
        start: `${selectedDate}T${startStr}`,
        end: `${selectedDate}T${endStr}`,
      };

      let found = false;
      const newAvailability = prev.availability.map((av) => {
        if (av.therapist_id !== therapist.id) return av;
        found = true;
        return {
          ...av,
          intervals: [...(av.intervals ?? []), newInterval],
        };
      });

      if (!found) {
        newAvailability.push({
          therapist_id: therapist.id,
          intervals: [newInterval],
        });
      }

      return {
        ...prev,
        availability: newAvailability,
      };
    });

    restoreScroll();
    setSelectedUnavailable(null);
    setAddingExtraHours(true);

    try {
      const payload: Record<string, unknown> = {
        therapist_id: therapist.id,
        date: selectedDate,
        start_time: startStr,
        end_time: endStr,
        status: 'approved',
        reason: 'Extra working hours',
        notes: `Added from schedule: ${timeRangeLabel}`,
      };
      if (therapist.branchId) {
        payload.branch_id = therapist.branchId;
      }

      const res = await authedFetch('/uauth/api/v1/therapists/extra-hours/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to add extra hours');
      }

      setBreakToast({
        type: 'success',
        message: `Extra time added for ${therapist.name}: ${timeRangeLabel} (${endMin - startMin}m)`,
      });

      // Silently refresh schedule in background to confirm server record
      setScheduleRefreshKey((k) => k + 1);
      restoreScroll();
    } catch (err) {
      if (previousScheduleData) {
        setScheduleData(previousScheduleData);
      }
      setBreakToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error adding extra hours',
      });
      restoreScroll();
    } finally {
      setAddingExtraHours(false);
      setTimeout(() => setBreakToast(null), 4000);
    }
  }, [timeSlots, grid.slot_duration_minutes, preserveScroll, scheduleData, selectedDate]);

  // Close context menu on outside click or Escape key
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setSelectedUnavailable(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Therapist Schedule</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live session board · <span className="font-semibold text-foreground">{dateDisplay}</span>
          {branchLabel && branchLabel !== 'Select Branch' && (
            <> · <span className="font-semibold text-foreground">{branchLabel}</span></>
          )}
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
            placeholder="Search therapist or client…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Daily Occupancy',   value: `${occupancy}%`,           sub: 'booked slots',      icon: <CheckCircle2 className="h-5 w-5" />, grad: 'from-primary to-accent',       bg: 'bg-rose-50 dark:bg-rose-950/30',     border: 'border-rose-200/80 dark:border-rose-800/40' },
          { label: 'Active Therapists', value: String(therapists.length), sub: 'on duty today',     icon: <AlertCircle className="h-5 w-5" />,  grad: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200/80 dark:border-violet-800/40' },
          { label: 'Total Bookings',    value: String(bookedCount),       sub: 'slots scheduled',   icon: <CalendarDays className="h-5 w-5" />, grad: 'from-rose-500 to-pink-600',     bg: 'bg-pink-50 dark:bg-pink-950/30',     border: 'border-pink-200/80 dark:border-pink-800/40' },
          { label: 'Available Slots',   value: String(availCount),        sub: 'open for booking',  icon: <Store className="h-5 w-5" />,        grad: 'from-amber-500 to-orange-600',  bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200/80 dark:border-amber-800/40' },

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

      {/* ── Loading (only shown on initial load when no schedule data exists) ── */}
      {loading && !scheduleData && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading schedule…</span>
        </div>
      )}

      {/* ── Error (only shown when no schedule data exists) ── */}
      {!loading && !scheduleData && error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {/* ── Main schedule grid (stays mounted whenever scheduleData exists) ── */}
      {scheduleData && (
        <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
          {/* Legend */}
          <div className="flex items-center justify-end gap-4 border-b border-border/40 px-4 py-3 bg-muted/20 rounded-t-2xl overflow-hidden">
            {[
              { label: 'Paid (Success)',  color: 'bg-emerald-500' },
              { label: 'Pending Payment', color: 'bg-rose-500' },
              { label: 'Available',       color: 'bg-card border border-dashed border-border' },
              { label: 'On Leave',        color: 'bg-amber-400' },
              { label: 'Unavailable',     color: 'bg-[#707070]/30 border border-border/40' },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <span className={cn('h-2.5 w-2.5 rounded-full', l.color)} />
                {l.label}
              </span>
            ))}
          </div>

          {filteredTherapists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                {search ? 'No therapists match your search' : 'No therapists scheduled for this date'}
              </p>
            </div>
          ) : (
            <>
              {/* ── Sticky header — OUTSIDE the scroll container so sticky works ── */}
              <div className="sticky top-16 z-20 flex items-stretch border-b-2 border-border/60 bg-card/95 backdrop-blur-md shadow-sm">
                {/* Time corner */}
                <div className="shrink-0 flex flex-col justify-center items-center py-3 font-bold text-xs text-muted-foreground uppercase tracking-wider border-r border-border/30 bg-card/95" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                  <span>Time</span>
                  <span className="text-[10px] text-muted-foreground/60 normal-case font-medium mt-0.5">Slots</span>
                </div>
                {/* Therapist header columns — overflow-hidden, synced with body scroll */}
                <div ref={headerScrollRef} className="flex-1 overflow-hidden" style={{ scrollbarGutter: 'stable' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${filteredTherapists.length}, 80px)`, width: `${filteredTherapists.length * 80}px` }}>
                    {filteredTherapists.map((t, tIdx) => (
                      <div key={t.id} className={cn('flex flex-col items-center justify-center gap-1 py-2 px-1 border-l border-border/30 first:border-l-0 min-w-0 h-[108px]', COL_TINTS[tIdx % COL_TINTS.length])}>
                        <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums text-center leading-none">{formatHeaderDate(selectedDate)}</p>
                        <div className="relative flex items-center justify-center p-0.5 rounded-full bg-gradient-to-b from-card to-muted/70 shadow-sm ring-1 ring-border/50 shrink-0">
                          <div className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-background shrink-0">
                            {t.photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.photoUrl} alt={t.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            )}
                            <div className={cn('absolute inset-0 grid place-items-center text-white text-[10px] font-bold bg-gradient-to-br -z-10', t.color)}>{t.initials}</div>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-foreground select-none text-center leading-tight truncate w-full px-0.5" title={t.name}>{t.name.split(' ')[0]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex rounded-b-2xl">
                {/* Fixed time column */}
                <div className="shrink-0 flex flex-col border-r border-border/30 bg-muted/10" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
                  {timeSlots.map((time) => (
                    <div key={`tcol-${time}`} className="flex flex-col justify-center items-center text-center px-1 py-2.5 border-t border-border/30" style={{ height: 98 }}>
                      <p className="text-xs font-bold text-foreground tabular-nums">{time}</p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-0.5 whitespace-nowrap">{grid.slot_duration_minutes} min slots</p>
                    </div>
                  ))}
                </div>

                {/* Therapist body grid — scroll synced with header */}
                <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-x-auto" style={{ scrollbarGutter: 'stable' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${filteredTherapists.length}, 80px)`,
                      gridTemplateRows: `repeat(${timeSlots.length}, 98px)`,
                      width: `${filteredTherapists.length * 80}px`,
                    }}
                  >
                    {filteredTherapists.map((t, tIdx) => {
                      const cells: React.ReactNode[] = [];
                      let rowIdx = 0;
                      while (rowIdx < timeSlots.length) {
                        const time = timeSlots[rowIdx];
                        const slot = schedule[t.id]?.[time] ?? { status: 'unavailable' as SlotStatus };
                        const isBooked = slot.status === 'booking' || slot.status === 'scheduled' || slot.status === 'in_progress' || slot.status === 'completed';
                        const isOnLeave = slot.status === 'on_leave';
                        const isBreak = slot.status === 'break_time';
                        let span = 1;
                        if (isBooked && slot.reference) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (nextSlot && (nextSlot.status === 'booking' || nextSlot.status === 'scheduled' || nextSlot.status === 'in_progress' || nextSlot.status === 'completed') && nextSlot.reference === slot.reference) { span++; } else { break; }
                          }
                        } else if (isBooked && slot.start && slot.end) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (nextSlot && (nextSlot.status === 'booking' || nextSlot.status === 'scheduled' || nextSlot.status === 'in_progress' || nextSlot.status === 'completed') && nextSlot.start === slot.start && nextSlot.end === slot.end) { span++; } else { break; }
                          }
                        } else if (isOnLeave) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (nextSlot && nextSlot.status === 'on_leave' &&
                              ((slot.reference && nextSlot.reference === slot.reference) ||
                               (slot.start && slot.end && nextSlot.start === slot.start && nextSlot.end === slot.end) ||
                               (!slot.reference && !slot.start))) {
                              span++;
                            } else {
                              break;
                            }
                          }
                        } else if (isBreak) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (nextSlot && nextSlot.status === 'break_time' &&
                                ((slot.start && slot.end && nextSlot.start === slot.start && nextSlot.end === slot.end) ||
                                 (!slot.start && !slot.end))) {
                              span++;
                            } else {
                              break;
                            }
                          }
                        }
                        const isThisSlotDragging =
                          draggedBreak?.therapistId === t.id &&
                          draggedBreak?.originalTimeSlot === time;
                        const isThisSlotDragOver =
                          dragOverSlot?.therapistId === t.id &&
                          dragOverSlot?.time === time;
                        const isSameTherapistCol =
                          Boolean(draggedBreak && draggedBreak.therapistId === t.id);

                        const isThisSlotUnavailable = slot.status === 'unavailable';
                        const isSlotSelected = Boolean(
                          isThisSlotUnavailable &&
                          selectedUnavailable?.therapistId === t.id &&
                          selectedUnavailable.slotTimes.includes(time)
                        );

                        cells.push(
                          <div
                            key={`${t.id}-${time}`}
                            style={{
                              gridColumn: tIdx + 1,
                              gridRow: span > 1 ? `${rowIdx + 1} / span ${span}` : rowIdx + 1,
                            }}
                            onContextMenu={
                              isThisSlotUnavailable
                                ? (e) => handleUnavailableContextMenu(e, t, time)
                                : undefined
                            }
                            onDragOver={(e) => {
                              if (isSameTherapistCol) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverSlot?.therapistId !== t.id || dragOverSlot?.time !== time) {
                                  setDragOverSlot({ therapistId: t.id, time });
                                }
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverSlot?.therapistId === t.id && dragOverSlot?.time === time) {
                                setDragOverSlot(null);
                              }
                            }}
                            onDrop={(e) => {
                              if (isSameTherapistCol && draggedBreak) {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOverSlot(null);
                                handleDropBreak(t, time, draggedBreak);
                              }
                            }}
                            className={cn(
                              'p-2 border-t border-l border-border/30 transition-all first:border-l-0 relative',
                              COL_TINTS[tIdx % COL_TINTS.length],
                              isThisSlotDragOver && !isThisSlotDragging && 'ring-2 ring-teal-500 ring-inset bg-teal-100/70 dark:bg-teal-900/50',
                              isSlotSelected && 'ring-2 ring-emerald-500 ring-inset bg-emerald-100/50 dark:bg-emerald-950/40'
                            )}
                          >
                            {isThisSlotDragOver && !isThisSlotDragging && (
                              <div className="absolute inset-1 pointer-events-none rounded-lg border-2 border-dashed border-teal-500 bg-teal-500/10 flex items-center justify-center z-10">
                                <span className="text-[10px] font-extrabold text-teal-800 dark:text-teal-200 bg-white/95 dark:bg-slate-900/95 px-2 py-0.5 rounded shadow-sm border border-teal-300">
                                  Move break to {time}
                                </span>
                              </div>
                            )}
                            <SlotCell
                              slot={slot}
                              isDraggable={isBreak}
                              isDragging={isThisSlotDragging}
                              isSelected={isSlotSelected}
                              onDragStart={(e) => {
                                if (isBreak) {
                                  const dur = getBreakDurationMinutes(slot);
                                  setDraggedBreak({
                                    therapistId: t.id,
                                    therapistName: t.name,
                                    originalTimeSlot: time,
                                    durationMinutes: dur,
                                  });
                                  e.dataTransfer.setData('text/plain', t.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }
                              }}
                              onDragEnd={() => {
                                dragJustEndedRef.current = true;
                                setTimeout(() => {
                                  dragJustEndedRef.current = false;
                                }, 150);
                                setDraggedBreak(null);
                                setDragOverSlot(null);
                              }}
                              onClick={
                                isBreak
                                  ? () => {
                                      if (dragJustEndedRef.current) {
                                        dragJustEndedRef.current = false;
                                        return;
                                      }
                                      setSelectedBreakTherapist({ therapist: t, slot, date: selectedDate });
                                    }
                                  : isBooked
                                  ? () => openModal(slot, t, time)
                                  : slot.status === 'available'
                                  ? () => openBookingModal(t, time)
                                  : isThisSlotUnavailable
                                  ? () => handleUnavailableClick(t, time)
                                  : undefined
                              }
                              onContextMenu={
                                isThisSlotUnavailable
                                  ? (e) => handleUnavailableContextMenu(e, t, time)
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






      {/* ── Booking Detail Modal (fetches full data from API) ── */}
      {detailBookingId && token && (
        <BookingDetailModal
          bookingId={detailBookingId}
          token={token}
          onClose={() => setDetailBookingId(null)}
          onSuccess={() => setScheduleRefreshKey(k => k + 1)}
        />
      )}

      {/* ── Slot Detail Modal (fallback: local slot data only) ── */}
      {modal && !detailBookingId && (
        <SlotDetailModal
          payload={modal}
          token={token ?? undefined}
          onClose={() => setModal(null)}
          onSuccess={() => setScheduleRefreshKey(k => k + 1)}
        />
      )}

      {/* ── New Therapist Schedule Booking Modal ── */}
      {bookingModal && token && (
        <TherapistScheduleBookingModal
          token={token}
          timeSlot={bookingModal.timeSlot}
          date={selectedDate}
          branchId={bookingModal.therapist.branchId || selectedBranchId}
          branchName={bookingModal.therapist.branchName || branchLabel}
          therapistId={bookingModal.therapist.id}
          therapistName={bookingModal.therapist.name}
          therapistPhoto={bookingModal.therapist.photoUrl ?? null}
          onClose={() => {
            setBookingModal(null);
            setScheduleRefreshKey(k => k + 1);
          }}
          onSuccess={() => {
            setScheduleRefreshKey(k => k + 1);
          }}
        />
      )}

      {/* ── Working Hours & Break Details Modal for Break Slots ── */}
      {selectedBreakTherapist && (
        <TherapistDayWorkingHoursModal
          therapistId={selectedBreakTherapist.therapist.id}
          therapistName={selectedBreakTherapist.therapist.name}
          branchId={selectedBreakTherapist.therapist.branchId || selectedBranchId}
          branchName={selectedBreakTherapist.therapist.branchName || branchLabel}
          date={selectedBreakTherapist.date}
          onClose={() => setSelectedBreakTherapist(null)}
          onUpdated={() => {
            setScheduleRefreshKey((k) => k + 1);
          }}
          token={token}
        />
      )}

      {/* ── Context Menu for Unavailable Slots to Add Extra Time ── */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-64 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-border/50 pb-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Extra Hours
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                {contextMenu.slotTimes.length * grid.slot_duration_minutes}m
              </span>
            </div>
            <p className="text-sm font-extrabold text-foreground truncate mt-0.5">
              {contextMenu.therapist.name}
            </p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mt-1">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {(() => {
                  const sorted = [...contextMenu.slotTimes].sort((a, b) => timeSlots.indexOf(a) - timeSlots.indexOf(b));
                  const startMin = slotToMinutes(sorted[0]);
                  const endMin = slotToMinutes(sorted[sorted.length - 1]) + grid.slot_duration_minutes;
                  const format12h = (min: number) => {
                    const h = Math.floor(min / 60);
                    const m = min % 60;
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const hd = h % 12 === 0 ? 12 : h % 12;
                    return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
                  };
                  return `${format12h(startMin)} – ${format12h(endMin)}`;
                })()}
              </span>
            </div>
          </div>
          <div className="pt-2.5">
            <button
              type="button"
              disabled={addingExtraHours}
              onClick={() => handleAddExtraTime(contextMenu.therapist, contextMenu.slotTimes)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-2 px-3 text-xs font-bold shadow transition cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              {addingExtraHours ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding Extra Time…</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Extra Time</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bar for Selected Unavailable Slots ── */}
      {selectedUnavailable && selectedUnavailable.slotTimes.length > 0 && !contextMenu && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-900/95 dark:bg-card/95 text-white dark:text-foreground px-5 py-3 shadow-2xl border border-white/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400">
                {selectedUnavailable.slotTimes.length} slot{selectedUnavailable.slotTimes.length > 1 ? 's' : ''} selected
              </span>
              <span className="text-xs text-white/50">·</span>
              <span className="text-xs font-semibold text-white/90 truncate max-w-[140px]">
                {selectedUnavailable.therapistName}
              </span>
            </div>
            <span className="text-[11px] text-white/70 tabular-nums">
              {(() => {
                const sorted = [...selectedUnavailable.slotTimes].sort((a, b) => timeSlots.indexOf(a) - timeSlots.indexOf(b));
                const startMin = slotToMinutes(sorted[0]);
                const endMin = slotToMinutes(sorted[sorted.length - 1]) + grid.slot_duration_minutes;
                const format12h = (min: number) => {
                  const h = Math.floor(min / 60);
                  const m = min % 60;
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const hd = h % 12 === 0 ? 12 : h % 12;
                  return `${String(hd).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
                };
                return `${format12h(startMin)} – ${format12h(endMin)} (${endMin - startMin}m)`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              type="button"
              disabled={addingExtraHours}
              onClick={() => {
                const t = filteredTherapists.find(th => th.id === selectedUnavailable.therapistId);
                if (t) handleAddExtraTime(t, selectedUnavailable.slotTimes);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-3.5 py-2 text-xs font-bold shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {addingExtraHours ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding…</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Extra Time</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedUnavailable(null);
                setContextMenu(null);
              }}
              className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Deselect"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Break Moving Indicator & Toast ── */}
      {updatingBreak && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-teal-600 text-white px-4 py-2.5 shadow-xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Updating break time on server...</span>
        </div>
      )}

      {breakToast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2',
            breakToast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          )}
        >
          {breakToast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{breakToast.message}</span>
          <button
            onClick={() => setBreakToast(null)}
            className="ml-2 hover:opacity-80 rounded p-0.5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </DashboardShell>
  );
}
