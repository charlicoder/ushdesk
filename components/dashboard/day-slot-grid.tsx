'use client';

import React, { useMemo } from 'react';
import { Clock, User, Sparkles, CheckCircle2, Circle } from 'lucide-react';
import type { Appointment, Branch } from '@/lib/supabase';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useI18n } from '@/hooks/use-i18n';
import { cn } from '@/lib/utils';

/** Default branch hours when none specified in DB */
const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '21:00';

export interface TimeSlot {
  label: string;       // "09:00 AM"
  isoStart: string;    // ISO datetime string
  minuteOffset: number; // minutes from midnight
  appointment: Appointment | null;
  isContinuation: boolean; // slot is occupied by an appt that started earlier
}

/** Parses "HH:MM" and returns total minutes from midnight */
function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fmtTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

interface Props {
  date: string;   // ISO yyyy-mm-dd
  branch: Branch | null;
  appointments: Appointment[];
  intervalMin: 30 | 60;
  onSlotClick: (slot: TimeSlot) => void;
}

export function DaySlotGrid({ date, branch, appointments, intervalMin, onSlotClick }: Props) {
  const { t } = useI18n();

  const slots = useMemo<TimeSlot[]>(() => {
    if (!branch) return [];

    const openMin  = parseTime(branch.open_time  ?? DEFAULT_OPEN);
    const closeMin = parseTime(branch.close_time ?? DEFAULT_CLOSE);

    const result: TimeSlot[] = [];
    for (let min = openMin; min < closeMin; min += intervalMin) {
      const isoStart = `${date}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
      const slotEnd = min + intervalMin;

      // Find the appointment that covers this slot
      const appt = appointments.find((a) => {
        const aStart  = new Date(a.start_time);
        const aEnd    = new Date(aStart.getTime() + a.duration_min * 60_000);
        const slotStartMs = new Date(isoStart).getTime();
        const slotEndMs   = slotStartMs + intervalMin * 60_000;
        return aStart < new Date(slotEndMs) && aEnd > new Date(slotStartMs);
      }) ?? null;

      const isContinuation = appt
        ? new Date(appt.start_time).getTime() < new Date(isoStart).getTime()
        : false;

      result.push({
        label: fmtTime(min),
        isoStart,
        minuteOffset: min,
        appointment: appt,
        isContinuation,
      });
      void slotEnd;
    }
    return result;
  }, [date, branch, appointments, intervalMin]);

  if (!branch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('filterByBranch')}</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('noSlots')}</p>
      </div>
    );
  }

  const openLabel  = fmtTime(parseTime(branch.open_time  ?? DEFAULT_OPEN));
  const closeLabel = fmtTime(parseTime(branch.close_time ?? DEFAULT_CLOSE));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{t('openingHours')}: {openLabel} – {closeLabel}</span>
      </div>

      {/*
        Flex layout: time column is a fixed-width sibling OUTSIDE the slot card
        area so it can never scroll out of view horizontally.
      */}
      <div className="flex">
        {/* Time labels: fixed width, always visible */}
        <div className="w-14 shrink-0 flex flex-col border-r border-border/20">
          {slots.map((sl, idx) => (
            <div
              key={`lbl-${idx}`}
              className="flex items-start pt-2 border-b border-border/20"
              style={{ height: 52 }}
            >
              {!sl.isContinuation && (
                <span className="text-[10px] font-semibold leading-tight text-muted-foreground whitespace-nowrap">
                  {sl.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Slot cards: look-ahead merge by appointment.id */}
        <div className="flex-1 flex flex-col pl-2">
          {(() => {
            const rows: React.ReactNode[] = [];
            let idx = 0;
            while (idx < slots.length) {
              const sl = slots[idx];
              let span = 1;
              if (sl.appointment) {
                while (
                  idx + span < slots.length &&
                  slots[idx + span].appointment?.id === sl.appointment.id
                ) {
                  span++;
                }
              }
              rows.push(
                <div key={`card-${idx}`} style={{ minHeight: 52 * span - 4 }} className="py-0.5">
                  <SlotCard slot={sl} spanCount={span} onClick={() => onSlotClick(sl)} />
                </div>,
              );
              idx += span;
            }
            return rows;
          })()}
        </div>
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  spanCount,
  onClick,
}: {
  slot: TimeSlot;
  spanCount: number;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const a = slot.appointment;

  if (!a) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'group flex h-full min-h-[36px] w-full items-center gap-3 rounded-xl',
          'border border-dashed border-emerald-400/40 bg-emerald-500/5 px-3 py-1.5 text-left transition-all',
          'hover:border-emerald-400/70 hover:bg-emerald-500/10 hover:shadow-sm',
        )}
      >
        <Circle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span className="text-xs text-emerald-700 dark:text-emerald-300">{t('slotAvailable')}</span>
        <span className="ml-auto text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
          {t('bookSlot')} →
        </span>
      </button>
    );
  }

  const apptStart  = new Date(a.start_time);
  const apptEnd    = new Date(apptStart.getTime() + a.duration_min * 60_000);
  const startLabel = apptStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endLabel   = apptEnd.toLocaleTimeString('en-US',   { hour: '2-digit', minute: '2-digit' });
  const isSpanning = spanCount > 1;

  const statusColors: Record<string, string> = {
    confirmed: 'border-sky-400/60 bg-sky-500/10 hover:bg-sky-500/15',
    pending:   'border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/15',
    completed: 'border-emerald-400/60 bg-emerald-500/10 hover:emerald-500/15',
    cancelled: 'border-rose-400/60 bg-rose-500/10 hover:bg-rose-500/15 opacity-60',
    no_show:   'border-slate-400/60 bg-slate-500/10 hover:bg-slate-500/15 opacity-60',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-full min-h-[36px] w-full rounded-xl border px-3 py-2 text-left transition-all hover:shadow-sm',
        isSpanning ? 'items-start' : 'items-center',
        statusColors[a.status] ?? statusColors.pending,
      )}
    >
      <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-sky-500" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs font-semibold">{a.customer?.name ?? '—'}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="truncate text-[11px] text-muted-foreground">{a.service?.name ?? '—'}</p>
        </div>
        {isSpanning && (
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
            {startLabel} – {endLabel} · {a.duration_min}m
          </p>
        )}
      </div>

      <StatusBadge status={a.status} />
    </button>
  );
}
