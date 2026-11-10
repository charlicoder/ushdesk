'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, Mail, Loader2, RefreshCw, AlertCircle, ChevronDown,
  MapPin, User, Phone, Scissors, Timer, ListChecks, PlayCircle, CalendarClock,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { authedFetch } from '@/lib/authedFetch';
import { kuwaitDatePlusDays, kuwaitDateString, kuwaitTimeString, formatInKuwait } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { TherapistShell } from '@/components/therapist/TherapistShell';

// ── Types ─────────────────────────────────────────────────────────────────────

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface AddonLine {
  name: string;
  duration: number;
}

interface ServiceLine {
  name: string;
  duration: number;
  room: string;
  addons: AddonLine[];
}

interface TherapistBooking {
  id: string;
  number: string;
  status: string;
  start: string;
  end: string;
  date: string;
  time: string;
  endTime: string;
  customer: string;
  phone: string;
  email: string;
  address: string;
  isHome: boolean;
  services: string;
  serviceLines: ServiceLine[];
  room: string;
  branch: string;
  duration: number;
  baseDuration: number;
  extraMinutes: number;
  addons: AddonLine[];
  notes: string;
  raw: Obj;
}

/**
 * Statuses a therapist works with: confirmed bookings and the states that follow
 * (checked-in → in progress → completed). Cancelled, no-show, unpaid and pending
 * bookings are never shown.
 */
const VISIBLE_STATUSES = new Set(['confirmed', 'checked_in', 'in_progress', 'completed']);

/** Statuses from which a therapist may move a booking to "completed". */
const COMPLETABLE = new Set(['confirmed', 'checked_in', 'in_progress']);

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  checked_in: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  in_progress: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function addonList(list: unknown): AddonLine[] {
  return (Array.isArray(list) ? list : [])
    .map((a: Obj) => ({ name: str(a?.name), duration: Number(a?.duration_minutes ?? a?.duration ?? 0) || 0 }))
    .filter((a) => a.name);
}

function normalize(b: Obj): TherapistBooking {
  const cust = (b.customer_data ?? {}) as Obj;
  const branchData = (b.branch_data ?? {}) as Obj;
  const svcList = Array.isArray(b.services) ? b.services : [];
  const sessions = Array.isArray(b.sessions) ? b.sessions : [];

  const serviceLines: ServiceLine[] = svcList
    .map((s: Obj) => ({
      name: str(s?.service_data?.name ?? s?.name ?? s?.service_name),
      duration: Number(s?.duration_minutes ?? s?.service_data?.duration_minutes ?? 0) || 0,
      room: str(s?.service_arrangement_data?.arrangement_name ?? s?.service_arrangement_data?.name),
      addons: addonList(s?.addons),
    }))
    .filter((s: ServiceLine) => s.name);
  if (!serviceLines.length && b.service_data?.name) {
    serviceLines.push({
      name: str(b.service_data.name),
      duration: Number(b.service_data.duration_minutes ?? 0) || 0,
      room: '',
      addons: [],
    });
  }

  // Add-ons: booking level first, then session level ones (de-duplicated by name).
  const addonMap = new Map<string, AddonLine>();
  [...addonList(b.addons), ...sessions.flatMap((s: Obj) => addonList(s?.addons))].forEach((a) => {
    if (!addonMap.has(a.name)) addonMap.set(a.name, a);
  });
  const addons = Array.from(addonMap.values());

  const isHome = str(b.booking_type).toLowerCase().includes('home');
  const address = str(
    cust.address ||
      cust.home_address ||
      branchData.home_address ||
      branchData.address ||
      branchData.branch_address,
  );

  const start = str(b.appointment_start || b.appointment_date);
  const end = str(b.appointment_end);
  const fullName = [cust.first_name, cust.last_name].map(str).filter(Boolean).join(' ');
  const total = Number(b.total_duration ?? b.duration_minutes ?? 0) || 0;
  const extra = Number(b.extra_minutes ?? 0) || 0;
  const addonMinutes = addons.reduce((t, a) => t + a.duration, 0);

  return {
    id: str(b.id),
    number: str(b.booking_number),
    status: str(b.status).toLowerCase(),
    start,
    end,
    date: kuwaitDateString(start),
    time: kuwaitTimeString(start),
    endTime: kuwaitTimeString(end),
    customer: str(cust.name || cust.full_name || fullName || b.customer_name) || 'Customer',
    phone: str(cust.phone_number || cust.phone),
    email: str(cust.email),
    address,
    isHome,
    services: serviceLines.map((s) => s.name).join(', ') || '—',
    serviceLines,
    room: str(b.service_arrangement_data?.arrangement_name || b.service_arrangement_data?.room_name),
    branch: str(branchData.name || branchData.branch_name),
    duration: total,
    baseDuration: Math.max(total - extra - addonMinutes, 0),
    extraMinutes: extra,
    addons,
    notes: str(b.customer_notes || b.notes),
    raw: b,
  };
}

function extractList(json: Obj): Obj[] {
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.data?.results)) return json.data.results;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TherapistPage() {
  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);
  const userId = user?.id ? String(user.id) : '';

  // Bookings reference the Therapist *profile* id, which differs from the login user id.
  const [therapistId, setTherapistId] = useState<string>(roleInfo?.therapist_id ?? '');
  const [idReady, setIdReady] = useState<boolean>(!!roleInfo?.therapist_id);

  useEffect(() => {
    if (roleInfo?.therapist_id) {
      setTherapistId(roleInfo.therapist_id);
      setIdReady(true);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/v1/employees/me', { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as Obj;
        const emp = (json?.data ?? json) as Obj;
        const tid = str(emp?.permissions?.therapist_id || emp?.therapist_id);
        if (!cancelled && tid) setTherapistId(tid);
      } catch {
        // fall back to server-side resolution
      } finally {
        if (!cancelled) setIdReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [roleInfo?.therapist_id, userId]);

  const [bookings, setBookings] = useState<TherapistBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'week'>('today');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = kuwaitDateString();
  const weekEnd = kuwaitDatePlusDays(7);

  const load = useCallback(
    async (silent = false) => {
      if (!userId || !idReady) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        // The API itself restricts the result to the logged-in therapist; therapist_id is sent as a hint.
        const qs = new URLSearchParams({
          from_date: today,
          to_date: weekEnd,
          page_size: '100',
        });
        if (therapistId) qs.set('therapist_id', therapistId);
        const res = await authedFetch(`/booknpay/api/v1/bookings/?${qs.toString()}`, {
          headers: { 'X-Skip-Branch-Scope': '1' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Failed to load appointments (${res.status})`);
        const json = (await res.json().catch(() => ({}))) as Obj;
        const mine = extractList(json)
          .map(normalize)
          // only confirmed bookings (and the states after confirmation) — never cancelled, no-show, unpaid, etc.
          .filter((b) => VISIBLE_STATUSES.has(b.status))
          // second safety net when we know the therapist profile id
          .filter((b) => {
            if (!therapistId) return true;
            const r = b.raw;
            const ids = [r.therapist_id, r.secondary_therapist_id, ...(Array.isArray(r.therapist_ids) ? r.therapist_ids : [])]
              .map((x) => str(x).toLowerCase());
            return ids.includes(therapistId.toLowerCase()) || ids.includes(userId.toLowerCase());
          })
          .sort((a, b) => a.start.localeCompare(b.start));
        setBookings(mine);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    },
    [userId, therapistId, idReady, today, weekEnd],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const todayList = useMemo(() => bookings.filter((b) => b.date === today), [bookings, today]);
  const weekList = useMemo(() => bookings.filter((b) => b.date > today && b.date <= weekEnd), [bookings, weekEnd, today]);
  const weekGroups = useMemo(() => {
    const m = new Map<string, TherapistBooking[]>();
    weekList.forEach((b) => m.set(b.date, [...(m.get(b.date) ?? []), b]));
    return Array.from(m.entries());
  }, [weekList]);

  const summary = useMemo(() => {
    const active = todayList;
    return {
      total: active.length,
      upcoming: active.filter((b) => ['confirmed', 'checked_in'].includes(b.status)).length,
      inProgress: active.filter((b) => b.status === 'in_progress').length,
      completed: active.filter((b) => b.status === 'completed').length,
    };
  }, [todayList]);

  const complete = async (b: TherapistBooking) => {
    setCompleting(b.id);
    setActionError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${b.id}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          reason: 'Marked completed by therapist',
          source: 'ushdesk',
          changed_by: user?.name || userId,
          change_by_user: user?.name || userId,
          change_by_user_data: user
            ? { id: user.id, name: user.name, full_name: user.name, phone_number: user.phone_number, role: 'Therapist' }
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Obj;
        const d = err?.detail;
        throw new Error(
          (typeof d === 'string' ? d : d?.message) || err?.message || `Failed to update status (${res.status})`,
        );
      }
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: 'completed' } : x)));
      setConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setCompleting(null);
    }
  };

  const Row = ({ b, canComplete }: { b: TherapistBooking; canComplete: boolean }) => {
    const open = expanded === b.id;
    const showComplete = canComplete && COMPLETABLE.has(b.status);
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 transition hover:border-primary/30">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-[88px] text-center">
            <p className="text-lg font-bold text-foreground leading-none">{b.time || '--:--'}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{b.endTime ? `to ${b.endTime}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(open ? null : b.id)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-semibold text-foreground">{b.customer}</p>
            <p className="truncate text-xs text-muted-foreground">{b.services}</p>
          </button>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[b.status] ?? 'bg-muted text-foreground')}>
            {label(b.status || 'unknown')}
          </span>
          {showComplete && (
            <button
              type="button"
              disabled={completing === b.id}
              onClick={() => { setActionError(null); setConfirmId(b.id); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Completed
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(open ? null : b.id)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Details"
          >
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
          </button>
        </div>

        {confirmId === b.id && (
          <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <span>Mark <strong>{b.customer}</strong>&apos;s appointment as completed?</span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="h-8 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing === b.id}
                onClick={() => complete(b)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {completing === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Yes, complete
              </button>
            </span>
          </div>
        )}

        {open && (
          <div className="space-y-4 border-t border-border/60 px-4 py-4 text-xs text-muted-foreground">
            {/* Customer */}
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary" /><span className="font-semibold text-foreground">{b.customer}</span></p>
              {b.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /><span dir="ltr">{b.phone}</span></p>}
              {b.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" /><span dir="ltr">{b.email}</span></p>}
              <p className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  <span className="font-semibold text-foreground">{b.isHome ? 'Customer address (home service)' : 'Location'}: </span>
                  {b.isHome
                    ? b.address || 'Address not provided'
                    : [b.branch, b.room, b.address].filter(Boolean).join(' · ') || '—'}
                </span>
              </p>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold text-foreground"><Scissors className="h-3.5 w-3.5 text-primary" />Service details</p>
              {b.serviceLines.length === 0 ? (
                <p>{b.services}</p>
              ) : (
                b.serviceLines.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="rounded-xl bg-muted/40 p-3">
                    <p className="font-semibold text-foreground">
                      {s.name}
                      {s.duration > 0 && <span className="ml-2 font-normal text-muted-foreground">{s.duration} min</span>}
                    </p>
                    {s.room && <p>Room: {s.room}</p>}
                    {s.addons.length > 0 && (
                      <p>Add-ons: {s.addons.map((a) => (a.duration ? `${a.name} (+${a.duration} min)` : a.name)).join(', ')}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add-ons / extra time / durations */}
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="sm:col-span-2">
                <span className="font-semibold text-foreground">Add-ons: </span>
                {b.addons.length ? b.addons.map((a) => (a.duration ? `${a.name} (+${a.duration} min)` : a.name)).join(', ') : 'None'}
              </p>
              <p className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5 text-primary" />
                <span><span className="font-semibold text-foreground">Extra time: </span>{b.extraMinutes > 0 ? `+${b.extraMinutes} min` : 'None'}</span>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span><span className="font-semibold text-foreground">Total duration: </span>{b.duration > 0 ? `${b.duration} min` : '—'}</span>
              </p>
              {b.duration > 0 && (
                <p className="sm:col-span-2">
                  Breakdown: service {b.baseDuration} min
                  {b.addons.some((a) => a.duration > 0) ? ` + add-ons ${b.addons.reduce((t, a) => t + a.duration, 0)} min` : ''}
                  {b.extraMinutes > 0 ? ` + extra ${b.extraMinutes} min` : ''}
                </p>
              )}
              {b.number && <p className="flex items-center gap-2"><ListChecks className="h-3.5 w-3.5 text-primary" />Booking #{b.number}</p>}
              {b.notes && <p className="sm:col-span-2"><span className="font-semibold text-foreground">Customer notes: </span>{b.notes}</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  const cards = [
    { title: 'Total today', value: summary.total, icon: CalendarDays, tone: 'text-primary bg-primary/10' },
    { title: 'Upcoming', value: summary.upcoming, icon: Clock, tone: 'text-sky-600 bg-sky-500/10' },
    { title: 'In progress', value: summary.inProgress, icon: PlayCircle, tone: 'text-amber-600 bg-amber-500/10' },
    { title: 'Completed', value: summary.completed, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-500/10' },
  ];

  return (
    <TherapistShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {user?.name || 'Therapist'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatInKuwait(new Date(), { dateStyle: 'full' }, 'en-GB')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border/70 bg-card/70 p-4">
              <span className={cn('grid h-9 w-9 place-items-center rounded-xl', c.tone)}>
                <c.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-3xl font-bold text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.title}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 text-sm font-semibold">
          {([
            ['today', `Today (${todayList.length})`],
            ['week', `Next 7 days (${weekList.length})`],
          ] as const).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'rounded-lg px-4 py-1.5 transition',
                tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {text}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {actionError}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : tab === 'today' ? (
          todayList.length === 0 ? (
            <Empty text="No appointments today." />
          ) : (
            <div className="space-y-3">
              {todayList.map((b) => <Row key={b.id} b={b} canComplete />)}
            </div>
          )
        ) : weekGroups.length === 0 ? (
          <Empty text="No appointments in the next 7 days." />
        ) : (
          <div className="space-y-6">
            {weekGroups.map(([date, list]) => (
              <section key={date} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  {formatInKuwait(`${date}T12:00:00+03:00`, { weekday: 'long', day: 'numeric', month: 'long' }, 'en-GB')}
                  <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
                </h2>
                {list.map((b) => <Row key={b.id} b={b} canComplete={false} />)}
              </section>
            ))}
          </div>
        )}
      </div>
    </TherapistShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 py-14 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

