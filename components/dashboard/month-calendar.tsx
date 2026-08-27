'use client';

import { cn } from '@/lib/utils';
import {
  startOfMonth, endOfMonth, daysInMonth, addMonths, subMonths,
  toISODate, appointmentsOnDay, isToday,
} from '@/lib/helpers';
import { useI18n } from '@/hooks/use-i18n';
import type { Appointment } from '@/lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MonthCalendarProps {
  appointments: Appointment[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;
const WEEK_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function MonthCalendar({ appointments, selectedDate, onSelectDate }: MonthCalendarProps) {
  const { t, locale } = useI18n();
  const selected = new Date(selectedDate + 'T00:00:00');
  const [viewDate, setViewDate] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthAppts = appointments.filter((a) => {
    const d = new Date(a.start_time);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="animate-fade-in-up">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">
          {t(MONTH_KEYS[month])} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="grid h-9 w-9 place-items-center rounded-lg bg-muted/60 transition hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Jump-to-today shortcut */}
          <button
            onClick={() => {
              const now = new Date();
              setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            className="h-9 rounded-lg bg-muted/60 px-3 text-xs font-semibold transition hover:bg-muted"
          >
            {t('today')}
          </button>
          <button
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="grid h-9 w-9 place-items-center rounded-lg bg-muted/60 transition hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_KEYS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(w)}
          </div>
        ))}
      </div>

      {/* cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = toISODate(day);
          const dayAppts = appointmentsOnDay(monthAppts, day);
          const isSelected = iso === selectedDate;
          const today = isToday(day);
          const booked = dayAppts.filter((a) => a.status !== 'cancelled').length;
          const available = Math.max(0, 24 - booked);
          return (
            <button
              key={i}
              onClick={() => onSelectDate(iso)}
              className={cn(
                'cal-cell relative flex min-h-[88px] flex-col rounded-xl border p-2 text-left transition',
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/40',
                today && !isSelected && 'border-accent/60',
              )}
            >
              <span className={cn('text-xs font-bold', today ? 'grid h-6 w-6 place-items-center rounded-full bg-accent text-white' : 'text-foreground')}>
                {day.getDate()}
              </span>
              {dayAppts.length > 0 && (
                <div className="mt-auto space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-semibold text-muted-foreground">{booked} {t('booked')}</span>
                  </div>
                  {available > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      <span className="text-[10px] font-semibold text-muted-foreground">{available} {t('available')}</span>
                    </div>
                  )}
                  {/* status dots */}
                  <div className="flex flex-wrap gap-0.5">
                    {dayAppts.slice(0, 5).map((a) => (
                      <span
                        key={a.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          a.status === 'completed' && 'bg-emerald-500',
                          a.status === 'confirmed' && 'bg-sky-500',
                          a.status === 'pending' && 'bg-amber-500',
                          a.status === 'cancelled' && 'bg-rose-500',
                          a.status === 'no_show' && 'bg-slate-400',
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
