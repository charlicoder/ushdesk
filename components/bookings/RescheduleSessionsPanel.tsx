'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Clock, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildAppointmentWindow } from '@/lib/datetime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface SessionReschedulePlanItem {
  /** The original stored session (kept so every other field is preserved on save). */
  session: AnyRecord;
  appointmentStart: string;
  appointmentEnd: string;
  arrangement: { id: string; name: string; type: string };
  therapist: { id: string; name: string };
  secondary: { id: string; name: string } | null;
}

interface Props {
  /** Booking sessions, already ordered by start time. */
  sessions: AnyRecord[];
  branchId: string;
  /** Target date, YYYY-MM-DD. */
  date: string;
  fetchJson: (url: string) => Promise<AnyRecord>;
  /** Called with the complete plan (every session placed) or null while incomplete. */
  onPlanChange: (plan: SessionReschedulePlanItem[] | null) => void;
}

interface Choice {
  roomId: string;
  startMin: number | null;
  therapistIds: string[];
}

const STEP = 30;

function toMin(s: string): number {
  const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

function minToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hd = h % 12 === 0 ? 12 : h % 12;
  return `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
}

function therapistName(t: AnyRecord | null | undefined): string {
  if (!t) return 'Therapist';
  const n = t.name ?? t.therapist_name ?? [t.first_name, t.last_name].filter(Boolean).join(' ');
  return (n && String(n).trim()) || 'Therapist';
}

function fits(set: Set<number>, start: number, duration: number): boolean {
  for (let x = start; x < start + duration; x += STEP) {
    if (!set.has(x)) return false;
  }
  return true;
}

// ── Shared design pieces (room cards + therapist thumbnails) ─────────────────

const ROOM_FALLBACKS = [
  'linear-gradient(135deg,#daccc1 0%,#c4a99c 100%)',
  'linear-gradient(135deg,#d4c4b8 0%,#b89d8e 100%)',
  'linear-gradient(135deg,#e2d7d0 0%,#cbb9af 100%)',
  'linear-gradient(135deg,#c9b8ae 0%,#a8897c 100%)',
];
const ESPRESSO = '#543c30';

export interface RoomOption {
  id: string;
  name: string;
  arrangement_type?: string;
  type?: string;
  capacity?: number;
  image?: string | null;
}

/** One-row, horizontally scrolling list of room cards (same look as the Create Gift Voucher page). */
export function RoomCardRow({
  rooms,
  selectedId,
  onSelect,
}: {
  rooms: RoomOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex gap-3 pb-3" style={{ width: 'max-content' }}>
        {rooms.map((r, idx) => {
          const active = String(r.id) === selectedId;
          const type = String(r.arrangement_type ?? r.type ?? '');
          const name = String(r.name ?? 'Room');
          return (
            <button
              key={String(r.id)}
              type="button"
              onClick={() => onSelect(String(r.id))}
              className="relative shrink-0 rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer"
              style={{
                width: 150,
                height: 190,
                flexShrink: 0,
                border: `3px solid ${active ? ESPRESSO : 'transparent'}`,
                boxShadow: active
                  ? `0 0 0 1px ${ESPRESSO}, 0 6px 24px 0 ${ESPRESSO}40`
                  : '0 2px 8px 0 rgba(0,0,0,0.13)',
              }}
            >
              <div className="absolute inset-0">
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: ROOM_FALLBACKS[idx % ROOM_FALLBACKS.length] }} />
                )}
              </div>
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)' }}
              />
              {active && (
                <div
                  className="absolute top-2.5 left-2.5 h-6 w-6 rounded-full grid place-items-center"
                  style={{ background: ESPRESSO, boxShadow: `0 2px 8px ${ESPRESSO}70` }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 text-left">
                <p
                  className="text-[13px] font-extrabold leading-tight text-white mb-2"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  {name.length > 17 ? `${name.slice(0, 16)}…` : name}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {type && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.20)', color: '#fff' }}
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {r.capacity != null && (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.20)', color: '#fff' }}
                    >
                      Cap {r.capacity}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Round therapist thumbnail (photo, falling back to initials). */
export function TherapistThumb({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-emerald-500 text-white grid place-items-center font-bold"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size / 3)) }}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}

/** List of free therapists (thumbnail + name). Click to (de)select up to `required`. */
export function TherapistPickList({
  options,
  selectedIds,
  required,
  onChange,
}: {
  options: AnyRecord[];
  selectedIds: string[];
  required: number;
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else if (selectedIds.length < required) {
      onChange([...selectedIds, id]);
    } else {
      onChange([...selectedIds.slice(0, required - 1), id]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const id = String(t.id);
        const idx = selectedIds.indexOf(id);
        const active = idx >= 0;
        const name = therapistName(t);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition cursor-pointer',
              active
                ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                : 'border-border/70 bg-card hover:bg-muted/40',
            )}
          >
            <TherapistThumb name={name} src={t.avatar ?? t.photo_url ?? t.profile_picture} />
            <span className="min-w-0">
              <span className="block max-w-[140px] truncate text-xs font-bold text-foreground">{name}</span>
              {required > 1 && active && (
                <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {idx === 0 ? 'Primary' : 'Secondary'}
                </span>
              )}
            </span>
            {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
          </button>
        );
      })}
    </div>
  );
}

interface SessionMeta {
  key: string;
  serviceId: string;
  arrType: string;
  prevArrId: string;
  duration: number;
  label: string;
  currentStart: string;
  currentTherapist: string;
}

function buildMeta(s: AnyRecord, idx: number): SessionMeta {
  const firstSvc = (Array.isArray(s.services) && s.services[0] ? s.services[0] : {}) as AnyRecord;
  const serviceId = String(
    (Array.isArray(s.service_ids) && s.service_ids[0]) ||
      firstSvc.service_id ||
      firstSvc.service_data?.service_id ||
      firstSvc.service_data?.id ||
      '',
  );
  const sad = (s.service_arrangement_data ?? {}) as AnyRecord;
  const arrType = String(
    sad.arrangement_type || sad.type || firstSvc.service_arrangement_data?.arrangement_type || '',
  );
  const startMs = s.appointment_start ? new Date(s.appointment_start).getTime() : NaN;
  const endMs = s.appointment_end ? new Date(s.appointment_end).getTime() : NaN;
  const fromWindow = !isNaN(startMs) && !isNaN(endMs) ? Math.round((endMs - startMs) / 60000) : 0;
  const duration = Number(s.total_session_duration) || fromWindow || 60;
  const label = String(
    s.service_name || firstSvc.service_data?.name || firstSvc.service_data?.service_name || `Session ${idx + 1}`,
  );
  const currentStart = s.appointment_start
    ? new Date(s.appointment_start).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit',
      })
    : '';
  const th = (s.therapist_data ?? {}) as AnyRecord;
  return {
    key: `${serviceId}|${arrType}`,
    serviceId,
    arrType,
    prevArrId: String(s.service_arrangement_id || sad.id || ''),
    duration,
    label,
    currentStart,
    currentTherapist: String(th.name || th.therapist_name || th.full_name || ''),
  };
}

/**
 * Session-by-session reschedule: after the branch and date are chosen, every session is
 * placed in order. Rooms and therapists are resolved per session (any free therapist, the
 * previously attached one is NOT pinned) and each session must start after the previous
 * one ends.
 */
export function RescheduleSessionsPanel({ sessions, branchId, date, fetchJson, onPlanChange }: Props) {
  const metas = useMemo(() => sessions.map((s, i) => buildMeta(s, i)), [sessions]);
  const uniqueKeys = useMemo(() => Array.from(new Set(metas.map((m) => m.key))), [metas]);

  const [dataByKey, setDataByKey] = useState<Record<string, AnyRecord | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);

  // Availability for the chosen branch + date, once per distinct service/room-type.
  useEffect(() => {
    if (!branchId || !date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDataByKey({});
    Promise.all(
      uniqueKeys.map(async (k) => {
        const [serviceId, arrType] = k.split('|');
        if (!serviceId) return [k, null] as const;
        const qs = new URLSearchParams({
          service_id: serviceId,
          arrangement_type: arrType || 'room',
          branch_id: branchId,
          date,
          day_counts: '1',
          days_count: '1',
        });
        const data = await fetchJson(`/uauth/api/v1/find-availabilities-for-reschedule-appointment/?${qs.toString()}`);
        return [k, data] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) setDataByKey(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load availability');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [branchId, date, uniqueKeys, fetchJson]);

  // (Re)initialise the per-session selection whenever the availability changes.
  useEffect(() => {
    setChoices(
      metas.map((m) => {
        const arrs = (dataByKey[m.key]?.arrangements ?? []) as AnyRecord[];
        const room = arrs.find((a) => String(a.id) === m.prevArrId) ?? arrs[0];
        return { roomId: room ? String(room.id) : '', startMin: null, therapistIds: [] };
      }),
    );
  }, [metas, dataByKey]);

  const computed = useMemo(() => {
    return metas.map((m, i) => {
      const data = dataByKey[m.key];
      const arrs = (data?.arrangements ?? []) as AnyRecord[];
      const choice = choices[i];
      const room = arrs.find((a) => String(a.id) === choice?.roomId);
      const required = Math.max(1, Number(room?.required_therapists ?? 1) || 1);
      const arrSet = new Set<number>(((room?.availabilities?.[date] ?? []) as string[]).map(toMin));
      const therapists = ((data?.therapists ?? []) as AnyRecord[]).map((t) => ({
        t,
        set: new Set<number>(((t.availabilities?.[date] ?? []) as string[]).map(toMin)),
      }));
      const prevEnd =
        i === 0
          ? 0
          : choices[i - 1]?.startMin == null
            ? null
            : (choices[i - 1].startMin as number) + metas[i - 1].duration;

      const starts = Array.from(arrSet).sort((a, b) => a - b);
      const slots = starts.map((mnt) => {
        const eligible = therapists.filter((x) => fits(x.set, mnt, m.duration)).map((x) => x.t);
        const available =
          prevEnd != null &&
          mnt >= prevEnd &&
          fits(arrSet, mnt, m.duration) &&
          eligible.length >= required;
        return { m: mnt, available, eligible };
      });
      const chosenSlot = choice?.startMin != null ? slots.find((s) => s.m === choice.startMin) : undefined;
      return { arrs, room, required, slots, prevEnd, eligibleAtChosen: chosenSlot?.eligible ?? [] };
    });
  }, [metas, dataByKey, choices, date]);

  // Emit the complete plan (or null while any session is not yet placed).
  useEffect(() => {
    const complete =
      metas.length > 0 &&
      choices.length === metas.length &&
      choices.every(
        (c, i) =>
          c.startMin != null && c.roomId && c.therapistIds.length >= (computed[i]?.required ?? 1),
      );
    if (!complete) {
      onPlanChange(null);
      return;
    }
    const items: SessionReschedulePlanItem[] = metas.map((m, i) => {
      const c = choices[i];
      const comp = computed[i];
      const win = buildAppointmentWindow(date, minToLabel(c.startMin as number), m.duration);
      const find = (id: string) => comp.eligibleAtChosen.find((t) => String(t.id) === id);
      const t1 = find(c.therapistIds[0]);
      const t2 = c.therapistIds[1] ? find(c.therapistIds[1]) : undefined;
      return {
        session: sessions[i],
        appointmentStart: win.appointment_start,
        appointmentEnd: win.appointment_end,
        arrangement: {
          id: c.roomId,
          name: String(comp.room?.name ?? ''),
          type: String(comp.room?.arrangement_type ?? m.arrType),
        },
        therapist: { id: c.therapistIds[0], name: therapistName(t1) },
        secondary: t2 ? { id: c.therapistIds[1], name: therapistName(t2) } : null,
      };
    });
    onPlanChange(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, computed, metas, date]);

  const resetFrom = (list: Choice[], from: number): Choice[] =>
    list.map((c, i) => (i >= from ? { ...c, startMin: null, therapistIds: [] } : c));

  const pickSlot = (i: number, mnt: number) => {
    const eligible = computed[i].slots.find((s) => s.m === mnt)?.eligible ?? [];
    const need = computed[i].required;
    setChoices((prev) => {
      const next = resetFrom(prev, i + 1);
      next[i] = { ...next[i], startMin: mnt, therapistIds: eligible.slice(0, need).map((t) => String(t.id)) };
      return next;
    });
  };

  const pickRoom = (i: number, roomId: string) => {
    setChoices((prev) => {
      const next = resetFrom(prev, i);
      next[i] = { ...next[i], roomId };
      return next;
    });
  };

  const setTherapistIds = (i: number, ids: string[]) => {
    setChoices((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], therapistIds: ids };
      return next;
    });
  };

  if (!branchId) {
    return (
      <p className="text-xs text-muted-foreground">Select a branch to see session availability.</p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 rounded-xl border border-border/50 bg-muted/20 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
        Checking availability for each session…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {metas.map((m, i) => {
        const comp = computed[i];
        const choice = choices[i];
        if (!comp || !choice) return null;
        const waitingPrev = comp.prevEnd == null;
        return (
          <div key={`${i}-${m.key}`} className="rounded-2xl border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Session {i + 1} of {metas.length}
                </p>
                <p className="text-sm font-bold truncate">{m.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.duration} mins
                  {m.currentStart ? ` • currently ${m.currentStart}` : ''}
                  {m.currentTherapist ? ` with ${m.currentTherapist}` : ''}
                </p>
              </div>
              {choice.startMin != null && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> {minToLabel(choice.startMin)}
                </span>
              )}
            </div>

            {comp.arrs.length === 0 ? (
              <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  No matching room
                  {m.arrType ? ` (${m.arrType.replace(/_/g, ' ')})` : ''} is available at this branch for this session.
                </span>
              </div>
            ) : (
              <>
                {comp.arrs.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-amber-500" /> Room / Arrangement
                      <span className="ml-1 normal-case font-semibold">
                        {comp.arrs.length} options
                      </span>
                    </p>
                    <RoomCardRow
                      rooms={comp.arrs as RoomOption[]}
                      selectedId={choice.roomId}
                      onSelect={(id) => pickRoom(i, id)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-indigo-500" /> Available Timeslots
                  </p>
                  {waitingPrev ? (
                    <p className="text-xs text-muted-foreground py-1">
                      Select the time of session {i} first.
                    </p>
                  ) : comp.slots.filter((s) => s.available).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No timeslot with a free room and therapist fits this session after{' '}
                      {i === 0 ? 'opening' : minToLabel(comp.prevEnd as number)}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
                      {comp.slots.map((s) => {
                        const isSel = choice.startMin === s.m;
                        return (
                          <button
                            key={s.m}
                            type="button"
                            disabled={!s.available}
                            onClick={() => pickSlot(i, s.m)}
                            className={cn(
                              'rounded-xl py-2 px-1 text-center text-xs font-bold transition cursor-pointer border',
                              isSel
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm'
                                : s.available
                                  ? 'bg-card text-foreground border-border/80 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20'
                                  : 'bg-muted/30 text-muted-foreground/40 border-border/30 cursor-not-allowed line-through',
                            )}
                          >
                            {minToLabel(s.m)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {choice.startMin != null && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 text-emerald-500" />
                      {comp.required > 1 ? 'Assigned Therapists' : 'Assigned Therapist'}
                      <span className="ml-1 normal-case font-semibold text-emerald-600 dark:text-emerald-400">
                        (any free therapist, change if needed)
                      </span>
                    </p>
                    <TherapistPickList
                      options={comp.eligibleAtChosen}
                      selectedIds={choice.therapistIds}
                      required={comp.required}
                      onChange={(ids) => setTherapistIds(i, ids)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

