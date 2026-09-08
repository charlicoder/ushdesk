import type { Appointment, AppointmentStatus } from '@/types/appointment';

export const STATUS_COLORS: Record<AppointmentStatus, { bg: string; text: string; dot: string; soft: string }> = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', soft: 'amber' },
  confirmed: { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500', soft: 'sky' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', soft: 'emerald' },
  cancelled: { bg: 'bg-rose-500/15', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', soft: 'rose' },
  no_show: { bg: 'bg-slate-500/15', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', soft: 'slate' },
};

export function formatCurrency(value: number, currency = 'AED'): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return sameDay(date, new Date());
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function subMonths(date: Date, months: number): Date {
  return addMonths(date, -months);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function appointmentsInRange(appts: Appointment[], start: Date, end: Date): Appointment[] {
  return appts.filter((a) => {
    const d = new Date(a.start_time);
    return d >= start && d <= end;
  });
}

export function appointmentsOnDay(appts: Appointment[], day: Date): Appointment[] {
  return appts.filter((a) => sameDay(new Date(a.start_time), day));
}

export function earningsOf(appts: Appointment[]): number {
  return appts
    .filter((a) => a.status === 'completed' || a.status === 'confirmed')
    .reduce((sum, a) => sum + Number(a.price), 0);
}

export function uniqueCustomers(appts: Appointment[]): number {
  return new Set(appts.map((a) => a.customer_id).filter(Boolean)).size;
}

export function completionRate(appts: Appointment[]): number {
  if (appts.length === 0) return 0;
  const completed = appts.filter((a) => a.status === 'completed').length;
  return (completed / appts.length) * 100;
}

export function avgBookingValue(appts: Appointment[]): number {
  const valid = appts.filter((a) => a.status === 'completed' || a.status === 'confirmed');
  if (valid.length === 0) return 0;
  return valid.reduce((s, a) => s + Number(a.price), 0) / valid.length;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
