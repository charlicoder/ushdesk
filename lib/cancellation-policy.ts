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
 * Extract the appointment start date/time as a Date object.
 * Handles ISO strings with/without timezone, date+time split fields, 12h/24h formats.
 */
export function getBookingAppointmentDateTime(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: Record<string, any> | null | undefined
): Date | null {
  if (!booking) return null;

  // 1. Direct ISO datetime fields: appointment_start, appointment_datetime, start_time
  const directCandidate =
    booking.appointment_start ??
    booking.appointment_datetime ??
    booking.start_time ??
    booking.start;

  if (directCandidate && typeof directCandidate === 'string' && directCandidate.trim()) {
    let s = directCandidate.trim();
    // Normalize format like "2026-10-01 14:00:00" -> "2026-10-01T14:00:00Z"
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Separate date and time fields
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
    const dateStr = dateCandidate.trim().split('T')[0];
    let timeStr = '00:00:00';

    if (timeCandidate && typeof timeCandidate === 'string' && timeCandidate.trim()) {
      const trimmedTime = timeCandidate.trim();
      const match12 = trimmedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
      const match24 = trimmedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

      if (match12) {
        let h = parseInt(match12[1], 10);
        const m = match12[2];
        const s = match12[3] || '00';
        const ampm = match12[4].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        timeStr = `${String(h).padStart(2, '0')}:${m}:${s}`;
      } else if (match24) {
        const h = String(parseInt(match24[1], 10)).padStart(2, '0');
        const m = match24[2];
        const s = match24[3] || '00';
        timeStr = `${h}:${m}:${s}`;
      }
    }

    const d = new Date(`${dateStr}T${timeStr}Z`);
    if (!isNaN(d.getTime())) return d;
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
