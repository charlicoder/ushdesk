'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, List, Filter, ChevronDown, MapPin, Clock, Store } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { MonthCalendar } from '@/components/dashboard/month-calendar';
import { AppointmentDialog } from '@/components/dashboard/appointment-dialog';
import { DaySlotGrid, type TimeSlot } from '@/components/dashboard/day-slot-grid';
import { BookingFormDialog } from '@/components/dashboard/booking-form-dialog';
import {
  setBranch, setStatus, setViewMode, setSelectedDate,
} from '@/store/slices/filtersSlice';
import type { Appointment, AppointmentStatus, Branch } from '@/lib/supabase';
import { formatCurrency, appointmentsOnDay } from '@/lib/helpers';
import { cn } from '@/lib/utils';

const STATUSES: (AppointmentStatus | 'all')[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const STATUS_KEY: Record<AppointmentStatus, 'statusPending' | 'statusConfirmed' | 'statusCompleted' | 'statusCancelled' | 'statusNoShow'> = {
  pending: 'statusPending', confirmed: 'statusConfirmed', completed: 'statusCompleted',
  cancelled: 'statusCancelled', no_show: 'statusNoShow',
};

export default function AppointmentsPage() {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const appointments = useAppSelector((s) => s.data.appointments);
  const branches     = useAppSelector((s) => s.data.branches);
  const filters      = useAppSelector((s) => s.filters);
  const status       = useAppSelector((s) => s.data.status);

  // Slot interval toggle: 30 or 60 min
  const [intervalMin, setIntervalMin] = useState<30 | 60>(30);

  // Appointment details dialog
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [detailOpen,   setDetailOpen]   = useState(false);

  // Booking form dialog
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  // ── derived data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (filters.branchId !== 'all' && a.branch_id !== filters.branchId) return false;
      if (filters.status !== 'all' && a.status !== filters.status) return false;
      if (filters.search) {
        const q   = filters.search.toLowerCase();
        const hay = `${a.customer?.name ?? ''} ${a.service?.name ?? ''} ${a.branch?.name ?? ''} ${a.staff?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, filters]);

  const selectedDayAppts = useMemo(() => {
    const d = new Date(filters.selectedDate + 'T00:00:00');
    return appointmentsOnDay(filtered, d).sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [filtered, filters.selectedDate]);

  // The branch to show slot grid for (null = all)
  const activeBranch = useMemo(
    () => branches.find((b) => b.id === filters.branchId) ?? null,
    [branches, filters.branchId],
  );

  // ── slot interactions ─────────────────────────────────────────────
  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.appointment) {
      // Show details for booked slot
      setSelectedAppt(slot.appointment);
      setDetailOpen(true);
    } else {
      // Open booking form for available slot
      setBookingSlot(slot);
      setBookingOpen(true);
    }
  };

  // ── loading state ─────────────────────────────────────────────────
  if (status === 'idle' || status === 'loading') {
    return (
      <DashboardShell>
        <div className="h-96 rounded-2xl shimmer" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader title={t('appointmentsTitle')} subtitle={t('appointmentsSub')}>
        {/* branch filter */}
        <div className="relative">
          <MapPin className="pointer-events-none absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={filters.branchId}
            onChange={(e) => dispatch(setBranch(e.target.value))}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-10 pr-8 text-sm font-medium outline-none focus:border-primary"
          >
            <option value="all">{t('filterByBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute ltr:right-3 rtl:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* status filter */}
        <div className="relative">
          <Filter className="pointer-events-none absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={filters.status}
            onChange={(e) => dispatch(setStatus(e.target.value))}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-10 pr-8 text-sm font-medium outline-none focus:border-primary"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? t('filterByStatus') : t(STATUS_KEY[s as AppointmentStatus])}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute ltr:right-3 rtl:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* view toggle */}
        <div className="flex h-10 items-center rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => dispatch(setViewMode('calendar'))}
            className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition',
              filters.viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <CalendarDays className="h-4 w-4" /> {t('calendar')}
          </button>
          <button
            onClick={() => dispatch(setViewMode('list'))}
            className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition',
              filters.viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <List className="h-4 w-4" /> {t('list')}
          </button>
        </div>
      </PageHeader>

      {/* ── CALENDAR VIEW ─────────────────────────────────────────── */}
      {filters.viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Month calendar */}
          <SectionCard title={t('calendar')} className="lg:col-span-2">
            <MonthCalendar
              appointments={filtered}
              selectedDate={filters.selectedDate}
              onSelectDate={(iso) => dispatch(setSelectedDate(iso))}
            />
          </SectionCard>

          {/* Right panel: branch summary (all) OR slot grid (specific branch) */}
          {!activeBranch ? (
            <SectionCard
              title={new Date(filters.selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
              subtitle={`${branches.length} ${t('branch').toLowerCase()}${branches.length !== 1 ? 'es' : ''}`}
            >
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                <BranchDaySummary
                  branches={branches}
                  appointments={selectedDayAppts}
                  intervalMin={intervalMin}
                  onBranchClick={(branchId) => dispatch(setBranch(branchId))}
                />
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title={new Date(filters.selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
              subtitle={`${selectedDayAppts.length} booked · ${t('slotInterval')}: ${intervalMin}min`}
            >
              {/* Slot interval toggle */}
              <div className="mb-3 flex items-center justify-end gap-2">
                <div className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5">
                  <button
                    onClick={() => setIntervalMin(30)}
                    className={cn('rounded-md px-2.5 text-xs font-semibold transition',
                      intervalMin === 30 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Clock className="mr-1 inline h-3 w-3" />{t('slot30min')}
                  </button>
                  <button
                    onClick={() => setIntervalMin(60)}
                    className={cn('rounded-md px-2.5 text-xs font-semibold transition',
                      intervalMin === 60 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    <Clock className="mr-1 inline h-3 w-3" />{t('slot60min')}
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto pr-1">
                <DaySlotGrid
                  date={filters.selectedDate}
                  branch={activeBranch}
                  appointments={selectedDayAppts}
                  intervalMin={intervalMin}
                  onSlotClick={handleSlotClick}
                />
              </div>
            </SectionCard>
          )}
        </div>

      ) : (
        /* ── LIST VIEW ────────────────────────────────────────────── */
        <SectionCard
          title={t('appointmentsTitle')}
          subtitle={`${t('showing')} ${filtered.length} ${t('results')}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-3 font-semibold">{t('customer')}</th>
                  <th className="px-3 py-3 font-semibold">{t('service')}</th>
                  <th className="px-3 py-3 font-semibold">{t('branch')}</th>
                  <th className="px-3 py-3 font-semibold">{t('staff')}</th>
                  <th className="px-3 py-3 font-semibold">{t('date')}</th>
                  <th className="px-3 py-3 font-semibold">{t('time')}</th>
                  <th className="px-3 py-3 font-semibold">{t('price')}</th>
                  <th className="px-3 py-3 font-semibold">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t('noAppointments')}</td></tr>
                )}
                {filtered.slice(0, 100).map((a) => {
                  const dt = new Date(a.start_time);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => { setSelectedAppt(a); setDetailOpen(true); }}
                      className="cursor-pointer border-b border-border/50 transition hover:bg-muted/40"
                    >
                      <td className="px-3 py-3 font-medium">{a.customer?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{a.service?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{a.branch?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{a.staff?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="px-3 py-3 text-muted-foreground">{dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-3 font-semibold">{formatCurrency(Number(a.price), t('currency'))}</td>
                      <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── DIALOGS ───────────────────────────────────────────────── */}

      {/* Appointment details (for booked slots & list rows) */}
      <AppointmentDialog
        appointment={selectedAppt}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {/* Booking form (for available slots) */}
      <BookingFormDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        branch={activeBranch}
        date={filters.selectedDate}
        slotTime={bookingSlot?.label ?? ''}
        slotIso={bookingSlot?.isoStart ?? ''}
        intervalMin={intervalMin}
      />
    </DashboardShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Branch Day Summary — shown in right panel when "All Branches" is selected  */
/* ─────────────────────────────────────────────────────────────────────────── */

const DEFAULT_OPEN  = '09:00';
const DEFAULT_CLOSE = '21:00';

function parseTimeMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function BranchDaySummary({
  branches,
  appointments,
  intervalMin,
  onBranchClick,
}: {
  branches: Branch[];
  appointments: Appointment[];
  intervalMin: 30 | 60;
  onBranchClick: (id: string) => void;
}) {
  const { t } = useI18n();

  if (branches.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{t('noData')}</p>
    );
  }

  return (
    <div className="space-y-2">
      {branches.map((branch) => {
        const branchAppts = appointments.filter((a) => a.branch_id === branch.id);
        const booked = branchAppts.filter(
          (a) => a.status !== 'cancelled' && a.status !== 'no_show',
        ).length;

        const openMin    = parseTimeMin(branch.open_time  ?? DEFAULT_OPEN);
        const closeMin   = parseTimeMin(branch.close_time ?? DEFAULT_CLOSE);
        const totalSlots = Math.max(1, Math.floor((closeMin - openMin) / intervalMin));
        const available  = Math.max(0, totalSlots - booked);
        const occupancy  = Math.round((booked / totalSlots) * 100);

        const statusCounts = {
          confirmed: branchAppts.filter((a) => a.status === 'confirmed').length,
          pending:   branchAppts.filter((a) => a.status === 'pending').length,
          completed: branchAppts.filter((a) => a.status === 'completed').length,
          cancelled: branchAppts.filter((a) => a.status === 'cancelled').length,
        };

        return (
          <button
            key={branch.id}
            onClick={() => onBranchClick(branch.id)}
            className="group w-full rounded-xl border border-border/60 bg-card p-3 text-left transition hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
          >
            {/* branch name */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${branch.color}22`, color: branch.color }}
                >
                  <Store className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{branch.name}</p>
                  <p className="text-[10px] text-muted-foreground">{branch.city}</p>
                </div>
              </div>
              <span className="text-[10px] text-primary opacity-0 transition group-hover:opacity-100">
                {t('slotView')} →
              </span>
            </div>

            {/* occupancy bar */}
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${occupancy}%`,
                  backgroundColor: occupancy > 80 ? '#f43f5e' : occupancy > 50 ? '#f59e0b' : '#10b981',
                }}
              />
            </div>

            {/* counts row */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-muted-foreground">{booked} {t('booked')}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{available} {t('available')}</span>
              </span>
              <span className="ml-auto font-semibold">{occupancy}%</span>
            </div>

            {/* status mini-pills */}
            {booked > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {statusCounts.confirmed > 0 && (
                  <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-300">
                    {statusCounts.confirmed} confirmed
                  </span>
                )}
                {statusCounts.pending > 0 && (
                  <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-300">
                    {statusCounts.pending} pending
                  </span>
                )}
                {statusCounts.completed > 0 && (
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                    {statusCounts.completed} completed
                  </span>
                )}
                {statusCounts.cancelled > 0 && (
                  <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-300">
                    {statusCounts.cancelled} cancelled
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
