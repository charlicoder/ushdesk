/**
 * Helpers for validating the total duration of a (multi-service) booking against
 * the free time that is available on a schedule grid (therapist or room).
 *
 * The schedule pages already know, per grid slot, whether it is free
 * ('available'), booked, on a break, unavailable (outside working hours / leave)
 * etc.  A booking that starts at slot `i` can only run through the *contiguous*
 * run of free slots that starts at `i` – it can never overlap a booked slot, a
 * break, or run past the end of the working hours.
 *
 * Everything here is a single linear scan (O(k) where k = slots walked) and
 * every per-item check is O(1), so it is safe to call on every render.
 */

export interface ScheduleSlotLike {
  status?: string;
  /** Continuation cell of a multi-slot booking group (room schedule) */
  isCont?: boolean;
  /** Number of grid rows a booking group spans (room schedule head cell) */
  groupRowSpan?: number;
  /** Bookings stacked in this head cell (room schedule, capacity > 1) */
  groupBookings?: unknown[];
}

const BOOKED_STATUSES = new Set(['booking', 'scheduled', 'in_progress', 'completed']);

/**
 * Maximum number of minutes a booking can run when it starts at `startLabel`.
 *
 * @param timeSlots     Ordered slot labels of the grid.
 * @param startLabel    Label of the slot the booking starts at.
 * @param getSlot       Lookup for the slot object of a label.
 * @param slotMinutes   Length of one grid slot in minutes.
 * @param capacity      Room capacity. With capacity > 1 a slot that already holds
 *                      fewer than `capacity` bookings can still be booked.
 *                      Therapists always use 1.
 * @returns minutes, or 0 when the start slot itself is not bookable.
 */
export function computeMaxContiguousMinutes(
  timeSlots: readonly string[],
  startLabel: string,
  getSlot: (label: string) => ScheduleSlotLike | undefined,
  slotMinutes: number,
  capacity = 1,
): number {
  const start = timeSlots.indexOf(startLabel);
  if (start < 0 || slotMinutes <= 0) return 0;

  let slots = 0;
  let i = start;
  while (i < timeSlots.length) {
    const slot = getSlot(timeSlots[i]);
    if (!slot) break;

    if (slot.status === 'available') {
      slots += 1;
      i += 1;
      continue;
    }

    // Booked head cell of a room that still has spare capacity: the whole
    // booking group can be shared, so skip over every row it spans.
    if (capacity > 1 && !slot.isCont && BOOKED_STATUSES.has(slot.status ?? '')) {
      const booked = slot.groupBookings?.length ?? 1;
      if (booked < capacity) {
        const span = Math.max(1, slot.groupRowSpan ?? 1);
        slots += span;
        i += span;
        continue;
      }
    }

    break; // unavailable / break / leave / full → run ends here
  }

  return slots * slotMinutes;
}

/** True when `total` exceeds a known limit. `undefined`/`null` = no limit. */
export function exceedsMaxDuration(total: number, max: number | null | undefined): boolean {
  return typeof max === 'number' && total > max;
}

/** Human message used for disabled options / validation errors. */
export function maxDurationMessage(max: number): string {
  return `Exceeds the available time. The maximum total duration for this slot is ${max} min.`;
}
