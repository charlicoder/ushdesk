import { getTimezoneOffsetMs } from '@/lib/cancellation-policy';

/**
 * Shared, timezone-aware datetime strategy for every booking / payment payload.
 *
 * Rule: every datetime sent to a backend service is an ISO-8601 string that
 * carries an explicit UTC offset (e.g. "2026-10-10T13:00:00+03:00"), expressed
 * in the BRANCH timezone (default Asia/Kuwait). Never send naive datetimes and
 * never send wall-clock time labelled with a trailing "Z".
 */
export const DEFAULT_TIMEZONE = 'Asia/Kuwait';

const pad = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');

/** "+03:00" style offset for a timezone at a given instant. */
export function formatOffset(timeZone: string = DEFAULT_TIMEZONE, refDate: Date = new Date()): string {
  const offsetMin = Math.round(getTimezoneOffsetMs(timeZone, refDate) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  return `${sign}${pad(offsetMin / 60)}:${pad(offsetMin % 60)}`;
}

/** Format an instant as branch-local ISO string with offset. */
export function toZonedIso(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const offsetMs = getTimezoneOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + offsetMs); // shifted so UTC getters read local wall-clock
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    formatOffset(timeZone, date)
  );
}

/** Current instant with timezone info, e.g. "2026-10-10T05:16:50+03:00". */
export function nowWithTimezone(timeZone: string = DEFAULT_TIMEZONE): string {
  return toZonedIso(new Date(), timeZone);
}

/**
 * Convert a naive local value ("2026-10-10T05:16", "2026-10-10 05:16:00" from
 * <input type="datetime-local">) into an offset-aware ISO string. Values that
 * already carry an offset / "Z" are normalised to the branch timezone.
 * Empty / invalid input falls back to the current datetime (never null).
 */
export function toZonedIsoFromLocal(value: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  const v = (value ?? '').trim();
  if (!v) return nowWithTimezone(timeZone);
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? nowWithTimezone(timeZone) : toZonedIso(d, timeZone);
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return nowWithTimezone(timeZone);
  const [, y, mo, d, h, mi, s] = m;
  const naiveUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  const offsetMs = getTimezoneOffsetMs(timeZone, new Date(naiveUtc));
  return toZonedIso(new Date(naiveUtc - offsetMs), timeZone);
}

/** Accepts "HH:MM", "H:MM", "HH:MM:SS" or "h:mm AM/PM" and returns minutes since midnight. */
export function parseClockToMinutes(label: string): number {
  const s = (label ?? '').trim();
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const min = parseInt(ampm[2], 10);
    const p = ampm[3].toUpperCase();
    if (p === 'AM' && h === 12) h = 0;
    if (p === 'PM' && h !== 12) h += 12;
    return h * 60 + min;
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

export interface AppointmentWindow {
  /** Midnight of the appointment day in branch tz, with offset. */
  appointment_date: string;
  /** Customer-chosen start instant, with offset. */
  appointment_start: string;
  /** start + total duration, with offset. */
  appointment_end: string;
  timezone: string;
}

/**
 * Build appointment_date / appointment_start / appointment_end from the
 * customer-chosen date ("YYYY-MM-DD"), time slot and duration (minutes).
 */
export function buildAppointmentWindow(
  date: string,
  timeSlot: string,
  durationMinutes: number,
  timeZone: string = DEFAULT_TIMEZONE,
): AppointmentWindow {
  const day = (date ?? '').split('T')[0].split(' ')[0];
  const [y, mo, d] = day.split('-').map(Number);
  const startMin = parseClockToMinutes(timeSlot);
  const dur = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60;

  const instantFor = (minutesFromMidnight: number) => {
    const naiveUtc = Date.UTC(y, (mo || 1) - 1, d || 1, 0, minutesFromMidnight, 0);
    const offsetMs = getTimezoneOffsetMs(timeZone, new Date(naiveUtc));
    return new Date(naiveUtc - offsetMs);
  };

  return {
    appointment_date: toZonedIso(instantFor(0), timeZone),
    appointment_start: toZonedIso(instantFor(startMin), timeZone),
    appointment_end: toZonedIso(instantFor(startMin + dur), timeZone),
    timezone: timeZone,
  };
}

// ── Display / business-date helpers ──────────────────────────────────────────
// Backends return instants as ISO-8601 with an offset (rendered in +03:00).
// Always DISPLAY them in the business timezone, never in the browser timezone,
// and never derive "today" from toISOString() (that is the UTC date).

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM-DD" of an instant in the business timezone (default: today). */
export function kuwaitDateString(value: DateInput = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const d = toDate(value) ?? new Date();
  return toZonedIso(d, timeZone).slice(0, 10);
}

/** "HH:MM" (24h) of an instant in the business timezone. */
export function kuwaitTimeString(value: DateInput, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = toDate(value);
  return d ? toZonedIso(d, timeZone).slice(11, 16) : '';
}

/** Business-timezone date `days` from today, as "YYYY-MM-DD". */
export function kuwaitDatePlusDays(days: number, timeZone: string = DEFAULT_TIMEZONE): string {
  const [y, m, d] = kuwaitDateString(new Date(), timeZone).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Intl formatting of an instant in the business timezone. Returns '' for invalid input. */
export function formatInKuwait(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  locale: string = 'en-GB',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(value);
  return d ? new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d) : '';
}

/**
 * Date whose UTC getters (getUTCHours/getUTCMinutes/getUTCDate...) read the
 * business-timezone wall-clock of the given instant. Use for schedule grids
 * that position bookings by hour/minute.
 */
export function kuwaitWallClockDate(value: DateInput, timeZone: string = DEFAULT_TIMEZONE): Date {
  const d = toDate(value) ?? new Date(NaN);
  if (isNaN(d.getTime())) return d;
  return new Date(d.getTime() + getTimezoneOffsetMs(timeZone, d));
}
