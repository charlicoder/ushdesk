'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, ChevronDown, Store, CalendarDays,
  CheckCircle2, Clock, AlertCircle, X, User, Scissors,
  Timer, Hash, MapPin,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { cn } from '@/lib/utils';

// ── Demo data ──────────────────────────────────────────────────────────────────

interface Therapist {
  id: string;
  name: string;
  date: string;
  initials: string;
  image: string;
  color: string;
}

const THERAPISTS: Therapist[] = [
  { id: '1',  name: 'Zeina',  date: '28/08', initials: 'ZE', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', color: 'from-rose-400 to-pink-500' },
  { id: '2',  name: 'Mona',   date: '28/08', initials: 'MO', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', color: 'from-violet-400 to-purple-500' },
  { id: '3',  name: 'Lara',   date: '28/08', initials: 'LA', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', color: 'from-sky-400 to-blue-500' },
  { id: '4',  name: 'Fatima', date: '28/08', initials: 'FA', image: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80', color: 'from-emerald-400 to-teal-500' },
  { id: '5',  name: 'Noura',  date: '28/08', initials: 'NO', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', color: 'from-amber-400 to-orange-500' },
  { id: '6',  name: 'Layla',  date: '28/08', initials: 'LA', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', color: 'from-pink-400 to-rose-500' },
  { id: '7',  name: 'Reem',   date: '28/08', initials: 'RE', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80', color: 'from-cyan-400 to-blue-500' },
  { id: '8',  name: 'Sara',   date: '28/08', initials: 'SA', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80', color: 'from-indigo-400 to-purple-500' },
  { id: '9',  name: 'Dania',  date: '28/08', initials: 'DA', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80', color: 'from-teal-400 to-emerald-500' },
  { id: '10', name: 'Huda',   date: '28/08', initials: 'HU', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', color: 'from-fuchsia-400 to-pink-500' },
];

const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
  '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM',
];

type SlotStatus = 'unavailable' | 'available' | 'booking' | 'scheduled' | 'in_progress';

interface Slot {
  status: SlotStatus;
  client?: string;
  service?: string;
  start?: string;
  end?: string;
  duration?: string;
}

const CLIENTS = [
  'Maha Alajmi', 'Sara Al-Rashid', 'Dana Hassan', 'Nadia Al-Mutairi',
  'Hessa Al-Sabah', 'Rima Al-Salem', 'Haya Al-Ajmi', 'Mariam Al-Kandari',
  'Lulu Fahad', 'Fatma Al-Ali', 'Noor Al-Otaibi', 'Aisha Al-Harbi',
  'Dalal Al-Ghanim', 'Zainab Al-Bader', 'Shaikha Al-Duaij', 'Reem Al-Fadhli',
];

const SERVICES = [
  'Stress Release Massage', '24K Gold Facial', 'Hot Stone Massage',
  'Vichy Rain Shower', 'Aromatherapy Bliss', 'Deep Tissue Recovery',
  'Rejuvenating Facial', 'Swedish Relax Massage', 'Hydrotherapy Lounge',
  'Foot Reflexology', 'Body Polish & Wrap', 'Organic Herbal Detox',
];

function buildSchedule(): Record<string, Record<string, Slot>> {
  const sched: Record<string, Record<string, Slot>> = {};
  THERAPISTS.forEach((therapist, tIdx) => {
    sched[therapist.id] = {};
    TIME_SLOTS.forEach((time, slotIdx) => {
      const seed = (tIdx * 7 + slotIdx * 13) % 100;
      if (slotIdx < 2 && tIdx % 3 !== 0) {
        sched[therapist.id][time] = { status: 'unavailable' };
      } else if (slotIdx >= 28 && (tIdx + slotIdx) % 2 === 0) {
        sched[therapist.id][time] = { status: 'unavailable' };
      } else if (seed < 18) {
        sched[therapist.id][time] = { status: 'unavailable' };
      } else if (seed < 48) {
        sched[therapist.id][time] = { status: 'available' };
      } else if (seed < 68) {
        const client  = CLIENTS[(tIdx + slotIdx) % CLIENTS.length];
        const service = SERVICES[(tIdx * 2 + slotIdx) % SERVICES.length];
        const [timePart] = time.split(' ');
        const [hr, min]  = timePart.split(':');
        const endMin = min === '00' ? '30' : '00';
        const endHr  = min === '30' ? (parseInt(hr) % 12 + 1).toString().padStart(2, '0') : hr;
        sched[therapist.id][time] = { status: 'booking', client, service, start: `${hr}:${min}`, end: `${endHr}:${endMin}`, duration: '30m' };
      } else if (seed < 88) {
        const client  = CLIENTS[(tIdx * 3 + slotIdx) % CLIENTS.length];
        const service = SERVICES[(tIdx + slotIdx * 3) % SERVICES.length];
        const [timePart] = time.split(' ');
        const [hr, min]  = timePart.split(':');
        sched[therapist.id][time] = {
          status: 'scheduled', client, service, start: `${hr}:${min}`,
          end: min === '00' ? `${hr}:50` : `${(parseInt(hr) % 12 + 1).toString().padStart(2, '0')}:20`,
          duration: '50m',
        };
      } else {
        const client  = CLIENTS[(tIdx * 5 + slotIdx) % CLIENTS.length];
        const service = SERVICES[(tIdx * 4 + slotIdx) % SERVICES.length];
        const [timePart] = time.split(' ');
        const [hr, min]  = timePart.split(':');
        sched[therapist.id][time] = {
          status: 'in_progress', client, service, start: `${hr}:${min}`,
          end: `${(parseInt(hr) % 12 + 1).toString().padStart(2, '0')}:${min}`,
          duration: '60m',
        };
      }
    });
  });
  return sched;
}

const SCHEDULE = buildSchedule();

// ── Column tints ───────────────────────────────────────────────────────────────
const COL_TINTS = [
  'bg-rose-50/60    dark:bg-rose-950/20',
  'bg-violet-50/60  dark:bg-violet-950/20',
  'bg-sky-50/60     dark:bg-sky-950/20',
  'bg-emerald-50/60 dark:bg-emerald-950/20',
  'bg-amber-50/60   dark:bg-amber-950/20',
  'bg-pink-50/60    dark:bg-pink-950/20',
];

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

  const refNo = `USH-${therapist.id.padStart(3, '0')}-${String((slot.client ?? '').length).padStart(4, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">

        {/* Coloured accent stripe */}
        <div className={cn('h-1.5 w-full', {
          'bg-emerald-400': slot.status === 'in_progress',
          'bg-blue-400':    slot.status === 'booking',
          'bg-violet-400':  slot.status === 'scheduled',
        })} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className={cn('absolute inset-0 rounded-full blur-md opacity-40 bg-gradient-to-br', therapist.color)} />
              <div className="relative h-12 w-12 rounded-full overflow-hidden ring-2 ring-background shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={therapist.image} alt={therapist.name} className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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

        {/* Body */}
        <div className="px-6 py-5 space-y-3">

          {/* Client */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Client</p>
              <p className="text-sm font-bold">{slot.client ?? '—'}</p>
            </div>
          </div>

          {/* Service */}
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
            <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', cfg.pillCls)}>
              <Scissors className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Service</p>
              <p className="text-sm font-bold">{slot.service ?? '—'}</p>
            </div>
          </div>

          {/* Time + Duration */}
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

          {/* Branch + Date */}
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

          {/* Reference */}
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

        {/* Footer */}
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
      <div className="flex h-full min-h-[82px] items-center justify-center rounded-xl border border-dashed border-border/90 dark:border-white/15 bg-card/70 transition hover:border-primary hover:bg-primary/5 hover:shadow-sm cursor-pointer group">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/70 group-hover:text-primary transition">
          <Plus className="h-3.5 w-3.5" /> Available
        </span>
      </div>
    );
  }

  const cfg  = STATUS_CFG[slot.status as ActiveStatus];
  const Icon = cfg.Icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
      className={cn(
        'relative h-full min-h-[82px] rounded-xl p-3 transition-all duration-200 cursor-pointer select-none active:scale-[0.98]',
        cfg.cardCls,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className={cn('text-[10px] uppercase tracking-wider', cfg.badgeCls)}>{cfg.badge}</span>
        <div className="flex items-center gap-1">
          <Icon className={cn('h-3.5 w-3.5', cfg.iconCls)} />
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
        </div>
      </div>
      <p className="text-sm font-bold leading-tight text-foreground truncate">{slot.client}</p>
      {slot.service && (
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight line-clamp-1">{slot.service}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
          {slot.duration}
        </span>
        {slot.start && slot.end && (
          <span className="text-[10px] font-medium text-muted-foreground">{slot.start} – {slot.end}</span>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
const BRANCHES = ['Al Khiran Coastal Retreat', 'Salmiya Branch', 'Kuwait City Spa'];

export default function TherapistSchedulePage() {
  const [branch]            = useState(BRANCHES[0]);
  const [date]              = useState('28 Aug 2026');
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState<ModalPayload | null>(null);

  // Scroll sync refs
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef   = useRef<HTMLDivElement>(null);
  const onBodyScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  // KPI derived values
  const allSlots    = THERAPISTS.flatMap((t) => Object.values(SCHEDULE[t.id] ?? {}));
  const bookedCount = allSlots.filter((s) => s.status !== 'unavailable' && s.status !== 'available').length;
  const availCount  = allSlots.filter((s) => s.status === 'available').length;
  const occupancy   = Math.round((bookedCount / (bookedCount + availCount)) * 100) || 0;

  const filteredTherapists = search
    ? THERAPISTS.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : THERAPISTS;

  const openModal = useCallback((slot: Slot, therapist: Therapist, timeSlot: string) => {
    setModal({ slot, therapist, timeSlot, branch, date });
  }, [branch, date]);

  return (
    <DashboardShell>
      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Therapist Schedule</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live session board ·{' '}
          <span className="font-semibold text-foreground">{date}</span>
        </p>
      </div>

      {/* ── Top controls ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <button className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition">
            <Store className="h-4 w-4 text-muted-foreground" />
            {branch}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          </button>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted/50 transition">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {date}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
        </button>
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
          { label: 'Daily Occupancy',   value: `${occupancy}%`,          sub: 'booked slots',       icon: <CheckCircle2 className="h-5 w-5" />, grad: 'from-primary to-accent',       bg: 'bg-rose-50 dark:bg-rose-950/30',     border: 'border-rose-200/80 dark:border-rose-800/40' },
          { label: 'Active Therapists', value: String(THERAPISTS.length), sub: 'on duty today',      icon: <AlertCircle className="h-5 w-5" />,  grad: 'from-violet-500 to-purple-600', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200/80 dark:border-violet-800/40' },
          { label: 'Total Bookings',    value: String(bookedCount),       sub: 'slots scheduled',    icon: <CalendarDays className="h-5 w-5" />, grad: 'from-rose-500 to-pink-600',     bg: 'bg-pink-50 dark:bg-pink-950/30',     border: 'border-pink-200/80 dark:border-pink-800/40' },
          { label: 'Projected Revenue', value: '1,420 KWD',               sub: 'estimated earnings', icon: <Store className="h-5 w-5" />,        grad: 'from-amber-500 to-orange-600',  bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200/80 dark:border-amber-800/40' },
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

      {/* ── Main schedule grid ── */}
      {/* NO overflow-hidden — would trap position:sticky */}
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

        {/* ── Sticky header panel ── */}
        <div
          ref={headerScrollRef}
          className="sticky top-16 z-20 overflow-x-hidden border-b-2 border-border/60 bg-card/95 backdrop-blur-md shadow-sm"
        >
          <div style={{ minWidth: `${120 + filteredTherapists.length * 175}px` }} className="flex">
            <div className="w-28 shrink-0 flex items-center pl-4 py-3 font-bold text-xs text-muted-foreground uppercase tracking-wider">
              Time
            </div>
            {filteredTherapists.map((t, tIdx) => (
              <div key={t.id} className={cn(
                'flex-1 flex flex-col items-center py-4 border-l border-border/30 first:border-l-0 px-2',
                COL_TINTS[tIdx % COL_TINTS.length],
              )}>
                <div className="relative flex items-center justify-center p-1 rounded-full bg-gradient-to-b from-card to-muted/70 shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-border/50">
                  <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-background shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.image} alt={t.name} className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className={cn('absolute inset-0 grid place-items-center text-white text-xs font-bold bg-gradient-to-br -z-10', t.color)}>
                      {t.initials}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm font-bold text-foreground text-center truncate max-w-[130px]">{t.name}</p>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{t.date}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body panel ── */}
        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="overflow-x-auto rounded-b-2xl">
          <div style={{ minWidth: `${120 + filteredTherapists.length * 175}px` }}>
            {TIME_SLOTS.map((time) => (
              <div key={time} className="flex border-t border-border/30">
                <div className="w-28 shrink-0 flex flex-col justify-center pl-4 py-2.5 border-r border-border/30 bg-muted/10">
                  <p className="text-xs font-bold text-foreground">{time}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">30 min slots</p>
                </div>
                {filteredTherapists.map((t, tIdx) => {
                  const slot        = SCHEDULE[t.id]?.[time] ?? { status: 'unavailable' as SlotStatus };
                  const isClickable = slot.status === 'booking' || slot.status === 'scheduled' || slot.status === 'in_progress';
                  return (
                    <div key={t.id} className={cn('flex-1 p-2 border-l border-border/30 transition-colors', COL_TINTS[tIdx % COL_TINTS.length])}>
                      <SlotCell
                        slot={slot}
                        onClick={isClickable ? () => openModal(slot, t, time) : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {modal && <SlotDetailModal payload={modal} onClose={() => setModal(null)} />}
    </DashboardShell>
  );
}
