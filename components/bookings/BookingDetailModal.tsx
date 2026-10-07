'use client';

/**
 * BookingDetailModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin loader used by "Therapist Schedule", "Branch Appointment" and other
 * pages. It fetches the booking by id and renders the SAME popup used by the
 * Booking List page (BookingDetailPopup) so the UI is identical everywhere.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { authedFetch } from '@/lib/authedFetch';
import { BookingDetailPopup, Booking, normalise } from '@/components/bookings/BookingDetailPopup';

export interface BookingDetailModalProps {
  /** The booking_id / id to fetch */
  bookingId: string;
  /** Bearer token for Authorization header */
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BookingDetailModal({ bookingId, token, onClose, onSuccess }: BookingDetailModalProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setError(null);
    try {
      const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
      const clean = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
      const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
        headers: clean ? { Authorization: `Bearer ${clean}`, Accept: 'application/json' } : { Accept: 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = json.detail ?? json.message ?? json.error ?? `Error ${res.status}`;
        throw new Error(typeof d === 'string' ? d : JSON.stringify(d));
      }
      setBooking(normalise((json.data ?? json) as Record<string, unknown>));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    }
  }, [bookingId, token]);

  useEffect(() => { setBooking(null); load(); }, [load]);

  useEffect(() => {
    if (booking) return; // popup handles Escape itself
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [booking, onClose]);

  if (booking) {
    return (
      <BookingDetailPopup
        booking={booking}
        onClose={onClose}
        onSuccess={() => { onSuccess?.(); load(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card p-8 shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition hover:bg-muted cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
        {error ? (
          <>
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-center text-sm text-rose-600">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading booking details…</p>
          </>
        )}
      </div>
    </div>
  );
}
