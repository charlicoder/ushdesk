import { loadUser } from './api';

/**
 * Cancellation Policy Constants & Helpers
 *
 * Rules:
 * - A user cannot cancel a booking if appointment time < current time + 12 hours
 *   UNLESS their role is Administrator, Branch Manager (or Branch Manger),
 *   Finance Manager, or Customer Support Manager.
 * - Privileged roles can cancel anytime.
 * - For other user roles, appointment time must be >= current time + 12 hours.
 */

export const MIN_HOURS_BEFORE_CANCELLATION = 12;

export interface RoleInfoLike {
  role_id?: string | null;
  role_name?: string | null;
  role_description?: string | null;
  is_superuser?: boolean;
  is_branch_manager?: boolean;
  is_therapist_role?: boolean;
}

export interface UserLike {
  user_type?: string | null;
  role?: string | null;
  role_name?: string | null;
  position?: string | null;
}

export interface CancellationEligibility {
  /** Whether the user is allowed to cancel this booking */
  canCancel: boolean;
  /** Whether the user has a privileged role allowing anytime cancellation */
  isPrivileged: boolean;
  /** Hours remaining until the appointment starts (negative if past) */
  hoursUntilAppointment: number | null;
  /** Human-readable explanation when cancellation is not permitted */
  reason: string | null;
}

/**
 * Check if the user has one of the privileged roles:
 * - Administrator (or admin, superuser)
 * - Branch Manager (or Branch Manger)
 * - Finance Manager
 * - Customer Support Manager
 */
export function canCancelBookingAnytime(
  roleInfo?: RoleInfoLike | null,
  user?: UserLike | null,
): boolean {
  // If roleInfo and user are not provided, attempt to read from localStorage
  if (!roleInfo && !user && typeof window !== 'undefined') {
    const stored = loadUser() as (UserLike & { roleInfo?: RoleInfoLike }) | null;
    if (stored) {
      roleInfo = stored.roleInfo ?? null;
      user = stored;
    }
  }

  // 1. Superuser flag
  if (roleInfo?.is_superuser === true) return true;

  // 2. Branch manager flag
  if (roleInfo?.is_branch_manager === true) return true;

  // 3. User types
  const userType = (user?.user_type ?? '').trim().toLowerCase();
  if (userType === 'admin' || userType === 'branch_manager') return true;

  // 4. Role names / descriptions
  const candidateStrings = [
    roleInfo?.role_name,
    roleInfo?.role_description,
    user?.role,
    user?.role_name,
    user?.position,
  ]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase());

  const privilegedPatterns = [
    'administrator',
    'admin',
    'branch manager',
    'branch manger',
    'finance manager',
    'customer support manager',
    'customer support',
  ];

  return candidateStrings.some((str) =>
    privilegedPatterns.some((pattern) => str.includes(pattern) || pattern.includes(str))
  );
}

/**
 * Resolves the UTC offset in milliseconds for a given IANA timezone or offset string.
 * Defaults to Kuwait (Asia/Kuwait, UTC+3, +10,800,000 ms).
 */
export function getTimezoneOffsetMs(
  timeZone: string = 'Asia/Kuwait',
  refDate: Date = new Date()
): number {
  if (!timeZone) return 3 * 60 * 60 * 1000;

  const tz = timeZone.trim();
  const offsetMatch = tz.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    const hours = parseInt(offsetMatch[2], 10);
    const mins = parseInt(offsetMatch[3] || '0', 10);
    return sign * (hours * 60 + mins) * 60 * 1000;
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(refDate);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    const match = tzPart && tzPart.value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      const hours = parseInt(match[2], 10);
      const mins = parseInt(match[3] || '0', 10);
      return sign * (hours * 60 + mins) * 60 * 1000;
    }
  } catch {
    // fallback to Kuwait UTC+3
  }

  return 3 * 60 * 60 * 1000;
}

/**
 * Extract the appointment start date/time as a Date object.
 * Correctly accounts for timezone: backend stores local branch/Kuwait wall-clock time
 * (frequently labeled with a trailing 'Z' or timezone-naive).
 * Resolves to the true point-in-time Date in UTC epoch milliseconds.
 */
export function getBookingAppointmentDateTime(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any> | string | null | undefined,
  defaultTimeZone: string = 'Asia/Kuwait'
): Date | null {
  if (!booking) return null;

  let directCandidate: string | null = null;
  let timeZone = defaultTimeZone;

  if (typeof booking === 'string') {
    directCandidate = booking;
  } else if (typeof booking === 'object' && booking !== null) {
    timeZone =
      booking.timezone ||
      booking.branch_timezone ||
      booking.branch_data?.timezone ||
      booking.branch?.timezone ||
      defaultTimeZone;

    directCandidate =
      booking.appointment_start ??
      booking.appointment_datetime ??
      booking.start_time ??
      booking.start ??
      null;
  }

  const offsetMs = getTimezoneOffsetMs(timeZone);

  // 1. Direct ISO datetime fields: appointment_start, appointment_datetime, start_time
  if (directCandidate && typeof directCandidate === 'string' && directCandidate.trim()) {
    const s = directCandidate.trim();

    // If string already has a genuine non-Z timezone offset like "+03:00" or "-05:00"
    if (/[+-]\d{2}:?\d{2}$/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Match YYYY-MM-DD and HH:mm(:ss)
    // In this app, strings like "2026-10-08T21:00:00Z" or "2026-10-08 21:00:00" contain the
    // local branch/Kuwait wall-clock time (21:00 = 9:00 PM local).
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [_, y, mo, d, h, mi, sec] = m;
      const utcEpoch = Date.UTC(
        parseInt(y, 10),
        parseInt(mo, 10) - 1,
        parseInt(d, 10),
        parseInt(h, 10),
        parseInt(mi, 10),
        parseInt(sec || '0', 10)
      );
      return new Date(utcEpoch - offsetMs);
    }

    const fallbackDate = new Date(s);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;
  }

  // 2. Separate date and time fields
  if (typeof booking === 'object' && booking !== null) {
    const dateCandidate =
      booking.appointment_date ??
      booking.booking_date ??
      booking.date;

    const timeCandidate =
      booking.appointment_time ??
      booking.time_slot ??
      booking.time ??
      booking.displayTime;

    if (dateCandidate && typeof dateCandidate === 'string' && dateCandidate.trim()) {
      const datePart = dateCandidate.trim().split('T')[0];
      const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        let hour = 0;
        let minute = 0;
        let second = 0;

        if (timeCandidate && typeof timeCandidate === 'string' && timeCandidate.trim()) {
          const firstTime = timeCandidate.trim().split(/[–\-]/)[0].trim();
          const match12 = firstTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
          const match24 = firstTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

          if (match12) {
            let h = parseInt(match12[1], 10);
            minute = parseInt(match12[2], 10);
            second = parseInt(match12[3] || '0', 10);
            const ampm = match12[4].toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            hour = h;
          } else if (match24) {
            hour = parseInt(match24[1], 10);
            minute = parseInt(match24[2], 10);
            second = parseInt(match24[3] || '0', 10);
          }
        }

        const utcEpoch = Date.UTC(
          parseInt(dateMatch[1], 10),
          parseInt(dateMatch[2], 10) - 1,
          parseInt(dateMatch[3], 10),
          hour,
          minute,
          second
        );
        return new Date(utcEpoch - offsetMs);
      }
    }
  }

  return null;
}

/**
 * Validates whether the booking can be cancelled by the current user:
 * - If user has privileged role (Administrator, Branch Manager, Finance Manager, Customer Support Manager): can cancel anytime.
 * - Otherwise: appointment must be >= current time + 12 hours.
 */
export function checkBookingCancellationEligibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any> | null | undefined,
  roleInfo?: RoleInfoLike | null,
  user?: UserLike | null,
  nowMs: number = Date.now(),
): CancellationEligibility {
  const isPrivileged = canCancelBookingAnytime(roleInfo, user);
  if (isPrivileged) {
    return {
      canCancel: true,
      isPrivileged: true,
      hoursUntilAppointment: null,
      reason: null,
    };
  }

  const apptDate = getBookingAppointmentDateTime(booking);
  if (!apptDate) {
    // If appointment time cannot be determined, allow cancellation
    return {
      canCancel: true,
      isPrivileged: false,
      hoursUntilAppointment: null,
      reason: null,
    };
  }

  const diffMs = apptDate.getTime() - nowMs;
  const hoursUntilAppointment = diffMs / (1000 * 60 * 60);

  if (hoursUntilAppointment < MIN_HOURS_BEFORE_CANCELLATION) {
    const formattedHours = hoursUntilAppointment <= 0
      ? 'has already passed or started'
      : `starts in ${hoursUntilAppointment.toFixed(1)}h`;

    const reason = `This appointment ${formattedHours}. Cancellations within 12 hours of appointment time require Administrator, Branch Manager, Finance Manager, or Customer Support Manager privileges.`;

    return {
      canCancel: false,
      isPrivileged: false,
      hoursUntilAppointment,
      reason,
    };
  }

  return {
    canCancel: true,
    isPrivileged: false,
    hoursUntilAppointment,
    reason: null,
  };
}
