'use client';
// v2 – live API, calendar picker, dynamic branch/date
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, ChevronDown, Store, CalendarDays,
  CheckCircle2, Clock, AlertCircle, X, User, Scissors,
  Timer, Hash, MapPin, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import {
  TherapistScheduleBookingModal,
} from '@/components/bookings/TherapistScheduleBookingModal';
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal';

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

// ── Slot Detail Modal ──────────────────────────────────────────────────────────
interface ModalPayload {
  slot:      Slot;
  therapist: Therapist;
  timeSlot:  string;
  branch:    string;
  date:      string;
}

function SlotDetailModal({ payload, onClose }: { payload: ModalPayload; onClose: () => void }) {
  const { slot, therapist, timeSlot, branch, date } = payload;
  const cfg = STATUS_CFG[slot.status as ActiveStatus];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const refNo = slot.reference ?? `USH-${therapist.id.slice(0, 6).toUpperCase()}`;

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
        className="flex h-full min-h-[82px] items-center justify-center rounded-xl border border-dashed border-border/90 dark:border-white/15 bg-card/70 transition hover:border-primary hover:bg-primary/5 hover:shadow-sm cursor-pointer group">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/70 group-hover:text-primary transition">
          <Plus className="h-3.5 w-3.5" /> Available
        </span>
      </div>
    );
  }

  const cfg  = STATUS_CFG[slot.status as ActiveStatus] ?? STATUS_CFG.scheduled;
  const Icon = cfg.Icon;
  const st   = (slot.status as ActiveStatus) in STATUS_CFG ? (slot.status as ActiveStatus) : 'scheduled';

  const accentBar: Record<ActiveStatus, string> = {
    in_progress: 'bg-emerald-500',
    booking:     'bg-blue-500',
    scheduled:   'bg-violet-500',
  };
  const iconBg: Record<ActiveStatus, string> = {
    in_progress: 'bg-emerald-500/15',
    booking:     'bg-blue-500/15',
    scheduled:   'bg-violet-500/15',
  };
  const durationCls: Record<ActiveStatus, string> = {
    in_progress: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    booking:     'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    scheduled:   'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  };
  const borderHover: Record<ActiveStatus, string> = {
    in_progress: 'border-emerald-300/70 dark:border-emerald-600/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/60 dark:to-emerald-900/30 shadow-sm shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-400',
    booking:     'border-blue-300/70 dark:border-blue-600/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30 shadow-sm shadow-blue-500/10 hover:shadow-blue-500/20 hover:border-blue-400',
    scheduled:   'border-violet-300/70 dark:border-violet-600/50 bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/60 dark:to-violet-900/30 shadow-sm shadow-violet-500/10 hover:shadow-violet-500/20 hover:border-violet-400',
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={cn(
        'group relative h-full min-h-[82px] w-full flex rounded-xl overflow-hidden cursor-pointer select-none',
        'border transition-all duration-200 active:scale-[0.98]',
        borderHover[st],
      )}
    >
      {/* Left accent bar */}
      <div className={cn('w-[3px] shrink-0', accentBar[st])} />

      {/* Main content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between p-2.5 gap-1.5">

        {/* Row 1: status badge + icon */}
        <div className="flex items-center justify-between gap-1">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[8px] font-extrabold uppercase tracking-widest leading-none',
            cfg.pillCls,
          )}>
            <span className={cn('h-[5px] w-[5px] rounded-full shrink-0', cfg.dot)} />
            {cfg.label}
          </span>
          <div className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md', iconBg[st])}>
            <Icon className={cn('h-[10px] w-[10px]', cfg.iconCls)} />
          </div>
        </div>

        {/* Row 2: Customer full name and Service full name */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {slot.client && (
            <p className="text-xs font-bold leading-tight text-foreground break-words whitespace-normal line-clamp-2">
              {slot.client}
            </p>
          )}
          {slot.service && (
            <p className="text-[11px] font-semibold leading-tight text-muted-foreground break-words whitespace-normal line-clamp-2">
              {slot.service}
            </p>
          )}
          {!slot.client && !slot.service && (
            <p className="text-xs font-bold leading-tight text-foreground">
              Booked
            </p>
          )}
        </div>

        {/* Row 3: duration pill + time range */}
        <div className="flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-border/20">
          {slot.duration && (
            <span className={cn(
              'inline-flex items-center gap-[3px] rounded-md px-1.5 py-[3px] text-[11px] font-bold leading-none',
              durationCls[st],
            )}>
              <Timer className="h-3 w-3 shrink-0" />
              {slot.duration}
            </span>
          )}
          {slot.start && slot.end && (
            <span className="text-[11px] font-semibold text-muted-foreground leading-none tabular-nums">
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

// ── Build schedule map from API data ──────────────────────────────────────────
function buildScheduleFromApi(
  therapists: ApiTherapist[],
  availability: ApiAvailability[],
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

  const availMap: Record<string, { startMin: number; endMin: number }[]> = {};
  for (const av of availability) {
    availMap[av.therapist_id] = av.intervals.map(iv => {
      const s = new Date(iv.start);
      const e = new Date(iv.end);
      return { startMin: s.getHours() * 60 + s.getMinutes(), endMin: e.getHours() * 60 + e.getMinutes() };
    });
  }

  type BkEntry = { startMin: number; endMin: number; client?: string; service?: string; startLabel: string; endLabel: string; duration: string; reference?: string; status: string };
  const bookingMap: Record<string, BkEntry[]> = {};
  for (const bk of bookings) {
    if (!bookingMap[bk.therapist_id]) bookingMap[bk.therapist_id] = [];
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

    bookingMap[bk.therapist_id].push({
      startMin:   sm,
      endMin:     em,
      client:     clientName,
      service:    serviceName,
      startLabel: fmt(s.getUTCHours(), s.getUTCMinutes()),
      endLabel:   fmt(e.getUTCHours(), e.getUTCMinutes()),
      duration:   `${durationMin}m`,
      reference:  bk.booking_id ?? bk.bookings_id ?? bk.id,
      status:     bk.status ?? 'scheduled',
    });
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
        let st: SlotStatus = 'scheduled';
        if (bk.status === 'in_progress') st = 'in_progress';
        else if (bk.status === 'booking' || bk.status === 'pending') st = 'booking';
        // Store full booking info on every overlapping slot.
        // The render layer handles span merging via look-ahead.
        sched[therapist.id][slotLabel] = {
          status: st,
          client:    bk.client,
          service:   bk.service,
          start:     bk.startLabel,
          end:       bk.endLabel,
          duration:  bk.duration,
          reference: bk.reference,
        };
        continue;
      }

      const isAvail = avIntervals.some(av => av.startMin <= slotStart && av.endMin >= slotEnd);
      sched[therapist.id][slotLabel] = { status: isAvail ? 'available' : 'unavailable' };
    }
  }
  return sched;
}

function formatDateDisplay(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TherapistSchedulePage() {
  // Auth token from Redux store
  const token = useAppSelector((s) => s.auth.token);

  // Today's date as YYYY-MM-DD
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 'all' on first load — switches to a specific branch_id when user selects one
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedDate,     setSelectedDate]      = useState<string>(todayStr);
  const [search,           setSearch]            = useState('');
  const [modal,            setModal]             = useState<ModalPayload | null>(null);
  const [detailBookingId,  setDetailBookingId]   = useState<string | null>(null);
  const [bookingModal,     setBookingModal]      = useState<{ therapist: Therapist; timeSlot: string } | null>(null);
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
        const url = `/api/v1/therapists/schedule/?branch_id=${selectedBranchId}&date=${selectedDate}`;
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
  const therapists: Therapist[] = (scheduleData?.therapists ?? []).map((t, i) => ({
    id:         t.id,
    name:       t.name,
    initials:   getInitials(t.name),
    photoUrl:   t.photo_url,
    color:      THERAPIST_COLORS[i % THERAPIST_COLORS.length],
    branchId:   t.branch_id,
    branchName: t.branch_name,
  }));

  const schedule = scheduleData
    ? buildScheduleFromApi(scheduleData.therapists, scheduleData.availability, scheduleData.bookings, timeSlots, grid.slot_duration_minutes)
    : {};

  const filteredTherapists = search
    ? therapists.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : therapists;

  const allSlots    = therapists.flatMap(t => Object.values(schedule[t.id] ?? {}));
  const bookedCount = allSlots.filter(s => s.status !== 'unavailable' && s.status !== 'available').length;
  const availCount  = allSlots.filter(s => s.status === 'available').length;
  const occupancy   = Math.round((bookedCount / (bookedCount + availCount)) * 100) || 0;

  // Branch list comes from the API response (branch.branches[])
  // Falls back to a single entry when viewing a specific branch
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

  const openModal = useCallback((slot: Slot, therapist: Therapist, timeSlot: string) => {
    // Prefer full API fetch when we have a booking reference ID
    if (slot.reference && slot.reference.length > 10) {
      setDetailBookingId(slot.reference);
    } else {
      setModal({ slot, therapist, timeSlot, branch: branchLabel, date: dateDisplay });
    }
  }, [branchLabel, dateDisplay]);

  const openBookingModal = useCallback((therapist: Therapist, timeSlot: string) => {
    setBookingModal({ therapist, timeSlot });
  }, []);

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Therapist Schedule</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live session board · <span className="font-semibold text-foreground">{dateDisplay}</span>
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
                {/* All Branches option */}
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
            placeholder="Search therapist or client…"
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
          <div className="flex items-center justify-end gap-4 border-b border-border/40 px-4 py-3 bg-muted/20 rounded-t-2xl overflow-hidden">
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

          {filteredTherapists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <User className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">
                {search ? 'No therapists match your search' : 'No therapists scheduled for this date'}
              </p>
            </div>
          ) : (
            <>
              {/* ── Sticky header panel ─────────────────────────────────────────────
                  The “TIME” corner cell is a flex sibling OUTSIDE the horizontally
                  scrollable div so it never moves when the user scrolls right.
              ── */}
              <div className="sticky top-16 z-20 flex border-b-2 border-border/60 bg-card/95 backdrop-blur-md shadow-sm">
                {/* Corner: always-visible TIME label */}
                <div className="w-28 shrink-0 flex items-center pl-4 py-3 font-bold text-xs text-muted-foreground uppercase tracking-wider border-r border-border/30 bg-card/95">
                  Time
                </div>
                {/* Therapist name headers — scroll horizontally in sync with body */}
                <div
                  ref={headerScrollRef}
                  className="flex-1 overflow-x-hidden"
                >
                  <div style={{ width: `${filteredTherapists.length * 175}px`, minWidth: '100%' }} className="flex">
                    {filteredTherapists.map((t, tIdx) => (
                      <div key={t.id} style={{ width: 175, minWidth: 175 }} className={cn(
                        'flex flex-col items-center py-4 border-l border-border/30 first:border-l-0 px-2',
                        COL_TINTS[tIdx % COL_TINTS.length],
                      )}>
                        <div className="relative flex items-center justify-center p-1 rounded-full bg-gradient-to-b from-card to-muted/70 shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-border/50">
                          <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-background shrink-0">
                            {t.photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.photoUrl} alt={t.name} className="h-full w-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            )}
                            <div className={cn('absolute inset-0 grid place-items-center text-white text-xs font-bold bg-gradient-to-br -z-10', t.color)}>
                              {t.initials}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground text-center truncate max-w-[130px]">{t.name}</p>
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{dateDisplay}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Scrollable body panel ─────────────────────────────────────────────
                  The time-label column is a flex sibling OUTSIDE the overflow-x-auto
                  container, so it is always visible regardless of scroll position.
                  The therapist CSS Grid only contains therapist columns (col 1…N).
              ── */}
              <div className="flex rounded-b-2xl">
                {/* ── Time column: fixed-width, never scrolls ── */}
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

                {/* ── Therapist columns: CSS Grid inside overflow-x-auto ── */}
                <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-x-auto">
                  <div
                    style={{
                      width: `${filteredTherapists.length * 175}px`,
                      minWidth: '100%',
                      display: 'grid',
                      // Each therapist gets a fixed 175px column
                      gridTemplateColumns: `repeat(${filteredTherapists.length}, 175px)`,
                      // Fixed 98px rows to stay aligned with the time column
                      gridTemplateRows: `repeat(${timeSlots.length}, 98px)`,
                    }}
                  >
                    {filteredTherapists.map((t, tIdx) => {
                      const cells: React.ReactNode[] = [];
                      let rowIdx = 0;

                      while (rowIdx < timeSlots.length) {
                        const time = timeSlots[rowIdx];
                        const slot = schedule[t.id]?.[time] ?? { status: 'unavailable' as SlotStatus };

                        const isBooked = slot.status === 'booking' || slot.status === 'scheduled' || slot.status === 'in_progress';

                        // Look-ahead: count how many consecutive rows share the same booking
                        let span = 1;
                        if (isBooked && slot.reference) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (
                              nextSlot &&
                              (nextSlot.status === 'booking' || nextSlot.status === 'scheduled' || nextSlot.status === 'in_progress') &&
                              nextSlot.reference === slot.reference
                            ) { span++; } else { break; }
                          }
                        } else if (isBooked && slot.start && slot.end) {
                          while (rowIdx + span < timeSlots.length) {
                            const nextSlot = schedule[t.id]?.[timeSlots[rowIdx + span]];
                            if (
                              nextSlot &&
                              (nextSlot.status === 'booking' || nextSlot.status === 'scheduled' || nextSlot.status === 'in_progress') &&
                              nextSlot.start === slot.start && nextSlot.end === slot.end
                            ) { span++; } else { break; }
                          }
                        }

                        cells.push(
                          <div
                            key={`${t.id}-${time}`}
                            style={{
                              // Time column is now external — therapist columns start at 1
                              gridColumn: tIdx + 1,
                              gridRow: span > 1 ? `${rowIdx + 1} / span ${span}` : rowIdx + 1,
                            }}
                            className={cn(
                              'p-2 border-t border-l border-border/30 transition-colors first:border-l-0',
                              COL_TINTS[tIdx % COL_TINTS.length],
                            )}
                          >
                            <SlotCell
                              slot={slot}
                              onClick={
                                isBooked
                                  ? () => openModal(slot, t, time)
                                  : slot.status === 'available'
                                  ? () => openBookingModal(t, time)
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
        />
      )}

      {/* ── Slot Detail Modal (fallback: local slot data only) ── */}
      {modal && !detailBookingId && <SlotDetailModal payload={modal} onClose={() => setModal(null)} />}

      {/* ── New Therapist Schedule Booking Modal ── */}
      {bookingModal && token && (
        <TherapistScheduleBookingModal
          token={token}
          timeSlot={bookingModal.timeSlot}
          date={selectedDate}
          branchId={bookingModal.therapist.branchId || (selectedBranchId !== 'all' ? selectedBranchId : '')}
          branchName={bookingModal.therapist.branchName || branchLabel}
          therapistId={bookingModal.therapist.id}
          therapistName={bookingModal.therapist.name}
          therapistPhoto={bookingModal.therapist.photoUrl ?? null}
          onClose={() => setBookingModal(null)}
          onSuccess={() => { /* step 3 shows in-modal — no close needed */ }}
        />
      )}
    </DashboardShell>
  );
}
