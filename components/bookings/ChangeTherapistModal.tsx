'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, CheckCircle2, AlertCircle, Loader2, X, Search,
  Sparkles, Calendar, Clock, MapPin, Home, RefreshCw, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface ChangeTherapistModalProps {
  bookingId: string;
  initialBooking?: AnyRecord | null;
  currentTherapistName?: string;
  onClose: () => void;
  onSuccess: (updatedTherapist: AnyRecord) => void;
}

export interface TherapistSpecialty {
  id: string;
  name: string;
}

export interface ApiTherapist {
  id: string;
  employee_id?: string;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  avatar?: string | null;
  can_do_home_service?: boolean;
  specialties?: TherapistSpecialty[];
  availabilities?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Computes 30-minute timeslots between appointment_start and appointment_end
 * formatted as [H:MM, H:MM] (e.g. ['9:00', '9:30'] or ['14:00', '14:30'])
 */
export function computeBookingTimeslots(
  raw: AnyRecord,
  apptStart?: string,
  apptEnd?: string
): string[] {
  // If raw already contains timeslots array
  if (Array.isArray(raw.timeslots) && raw.timeslots.length > 0) {
    return raw.timeslots.map(String);
  }
  if (Array.isArray(raw.time_slots) && raw.time_slots.length > 0) {
    return raw.time_slots.map(String);
  }

  const startStr = apptStart || raw.appointment_start || raw.appointment_datetime || '';
  const endStr = apptEnd || raw.appointment_end || '';
  const durMinutes = Number(raw.total_duration || raw.duration_minutes || raw.service_data?.duration_minutes || 60);

  let startH = 9;
  let startM = 0;
  let hasValidStart = false;

  if (startStr && typeof startStr === 'string') {
    const timeMatch = startStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      startH = parseInt(timeMatch[1], 10);
      startM = parseInt(timeMatch[2], 10);
      hasValidStart = true;
    } else {
      const directMatch = startStr.match(/^(\d{1,2}):(\d{2})/);
      if (directMatch) {
        startH = parseInt(directMatch[1], 10);
        startM = parseInt(directMatch[2], 10);
        hasValidStart = true;
      }
    }
  }

  let endH = startH;
  let endM = startM;
  let hasValidEnd = false;

  if (endStr && typeof endStr === 'string') {
    const timeMatch = endStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      endH = parseInt(timeMatch[1], 10);
      endM = parseInt(timeMatch[2], 10);
      hasValidEnd = true;
    } else {
      const directMatch = endStr.match(/^(\d{1,2}):(\d{2})/);
      if (directMatch) {
        endH = parseInt(directMatch[1], 10);
        endM = parseInt(directMatch[2], 10);
        hasValidEnd = true;
      }
    }
  }

  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = hasValidEnd
    ? endH * 60 + endM
    : startTotalMinutes + durMinutes;

  const slots: string[] = [];
  const slotStep = 30; // standard 30-min interval for timeslot availability

  for (let m = startTotalMinutes; m < endTotalMinutes; m += slotStep) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    // format as H:MM (matches example: 9:00, 9:30, 14:00, etc.)
    const slotStr = `${h}:${min < 10 ? '0' : ''}${min}`;
    slots.push(slotStr);
  }

  return slots.length > 0 ? slots : ['9:00', '9:30'];
}

export function ChangeTherapistModal({
  bookingId,
  initialBooking,
  currentTherapistName,
  onClose,
  onSuccess,
}: ChangeTherapistModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [therapists, setTherapists] = useState<ApiTherapist[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Extract raw booking and related fields
  const raw = useMemo(() => {
    return (initialBooking?.raw ?? initialBooking ?? {}) as AnyRecord;
  }, [initialBooking]);

  const sd = (raw.service_data ?? {}) as AnyRecord;
  const sad = (raw.service_arrangement_data ?? {}) as AnyRecord;
  const td = (raw.therapist_data ?? {}) as AnyRecord;

  const serviceId = useMemo(() => {
    return (
      raw.service_id ||
      sd.id ||
      sd.service_id ||
      (raw.service as AnyRecord)?.id ||
      initialBooking?.service_id ||
      ''
    );
  }, [raw, sd, initialBooking]);

  const serviceArrangementId = useMemo(() => {
    return (
      raw.service_arrangement_id ||
      sad.id ||
      sad.arrangement_id ||
      (raw.service_arrangement as AnyRecord)?.id ||
      raw.arrangement_id ||
      initialBooking?.arrangement_id ||
      initialBooking?.service_arrangement_id ||
      ''
    );
  }, [raw, sad, initialBooking]);

  const appointmentDate = useMemo(() => {
    const apptStart = raw.appointment_start || initialBooking?.appointment_start;
    if (apptStart && typeof apptStart === 'string') {
      if (apptStart.includes('T')) return apptStart.split('T')[0];
      if (apptStart.includes(' ')) return apptStart.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(apptStart)) return apptStart;
    }
    return String(raw.date || raw.booking_date || raw.appointment_date || new Date().toISOString().split('T')[0]);
  }, [raw, initialBooking]);

  const timeslots = useMemo(() => {
    return computeBookingTimeslots(
      raw,
      initialBooking?.appointment_start,
      initialBooking?.appointment_end
    );
  }, [raw, initialBooking]);

  const timeslotsQueryParam = useMemo(() => {
    return `[${timeslots.join(', ')}]`;
  }, [timeslots]);

  // Current therapist ID for comparison
  const currentTherapistId = useMemo(() => {
    return String(
      raw.therapist_id ||
      td.id ||
      td.therapist_id ||
      td.employee_id ||
      (raw.therapist as AnyRecord)?.id ||
      ''
    );
  }, [raw, td]);

  const resolvedCurrentName = useMemo(() => {
    return (
      currentTherapistName ||
      td.therapist_name ||
      td.name ||
      td.full_name ||
      (raw.therapist as AnyRecord)?.name ||
      '—'
    );
  }, [currentTherapistName, td, raw]);

  // Fetch available therapists from availability-for-arragement endpoint
  const fetchTherapists = useCallback(async () => {
    if (!serviceId || !serviceArrangementId) {
      setError('Service ID or Service Arrangement ID not found for this booking.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSubmitError(null);

    try {
      const qs = new URLSearchParams({
        service_arrangement_id: serviceArrangementId,
        date: appointmentDate,
        timeslots: timeslotsQueryParam,
      });

      const endpoint = `/uauth/api/v1/services/${serviceId}/availability-for-arragement/?${qs.toString()}`;
      const res = await authedFetch(endpoint);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || `Failed to fetch availability (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));
      const list: ApiTherapist[] = Array.isArray(data.therapists)
        ? data.therapists
        : Array.isArray(data.data?.therapists)
        ? data.data.therapists
        : [];

      setTherapists(list);

      // Pre-select current therapist if present in the available list
      if (currentTherapistId) {
        const match = list.find((t) => t.id === currentTherapistId || t.employee_id === currentTherapistId);
        if (match) setSelectedTherapistId(match.id);
      }
    } catch (err: unknown) {
      console.error('[ChangeTherapistModal] Error fetching available therapists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch available therapists');
    } finally {
      setLoading(false);
    }
  }, [serviceId, serviceArrangementId, appointmentDate, timeslotsQueryParam, currentTherapistId]);

  useEffect(() => {
    fetchTherapists();
  }, [fetchTherapists]);

  // Filter therapists by search query
  const filteredTherapists = useMemo(() => {
    if (!searchQuery.trim()) return therapists;
    const q = searchQuery.toLowerCase().trim();
    return therapists.filter((t) => {
      const fullName = (t.full_name || `${t.first_name || ''} ${t.last_name || ''}` || t.name || '').toLowerCase();
      const code = (t.employee_code || '').toLowerCase();
      const specs = (t.specialties || []).map((s) => s.name.toLowerCase()).join(' ');
      return fullName.includes(q) || code.includes(q) || specs.includes(q);
    });
  }, [therapists, searchQuery]);

  const selectedTherapist = useMemo(() => {
    return therapists.find((t) => t.id === selectedTherapistId) || null;
  }, [therapists, selectedTherapistId]);

  // Handle update therapist
  const handleUpdate = async () => {
    if (!selectedTherapist) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const therapistId = String(
        selectedTherapist.id ||
        selectedTherapist.employee_id ||
        ''
      );

      const therapistName = (
        selectedTherapist.full_name ||
        `${selectedTherapist.first_name || ''} ${selectedTherapist.last_name || ''}`.trim() ||
        selectedTherapist.name ||
        'Therapist'
      );

      // Pass all available therapist data inside therapist_data
      const therapistData: AnyRecord = {
        ...selectedTherapist,
        id: therapistId,
        therapist_id: therapistId,
        therapist_name: therapistName,
        name: therapistName,
      };

      const payload = {
        therapist_id: therapistId,
        therapist_data: therapistData,
      };

      const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || `Failed to update therapist (${res.status})`);
      }

      const resData = await res.json().catch(() => ({}));
      onSuccess(resData?.data || therapistData);
      onClose();
    } catch (err: unknown) {
      console.error('[ChangeTherapistModal] Error updating therapist:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to update therapist');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Change Therapist</h2>
              <p className="text-xs text-muted-foreground">Select an available therapist for this booking</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-muted/30 border-b border-border/40 px-6 py-3 text-xs space-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              {appointmentDate}
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Slots: {timeslots.join(', ')}
            </span>
            {raw.branch_data?.name && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {raw.branch_data.name}
              </span>
            )}
            {raw.service_arrangement_data?.name && (
              <span className="flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-muted-foreground" />
                {raw.service_arrangement_data.name}
              </span>
            )}
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Currently Assigned:</span>
            <span className="font-semibold text-foreground">{resolvedCurrentName}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Checking available therapists for this timeslot…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Error fetching therapists</span>
              </div>
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchTherapists}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-background px-3 py-1.5 font-medium hover:bg-destructive/10 transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : therapists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
              <User className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No Available Therapists Found</p>
              <p className="text-xs max-w-sm">
                No therapists are available for the selected service arrangement on {appointmentDate} during timeslots {timeslots.join(', ')}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search box if multiple therapists */}
              {therapists.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, specialties, or code…"
                    className="w-full rounded-2xl border border-border/60 bg-muted/20 pl-10 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                </div>
              )}

              {/* Therapist Cards List */}
              <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredTherapists.map((t) => {
                  const tId = t.id;
                  const isSelected = selectedTherapistId === tId;
                  const isCurrent = tId === currentTherapistId || (t.employee_id && t.employee_id === currentTherapistId);
                  const fullName = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.name || 'Therapist';

                  return (
                    <div
                      key={tId}
                      onClick={() => setSelectedTherapistId(tId)}
                      className={cn(
                        'group relative flex items-start gap-3.5 rounded-2xl border p-3.5 transition-all cursor-pointer select-none',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                          : 'border-border/60 bg-card hover:bg-muted/30 hover:border-border'
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted">
                        {t.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.avatar}
                            alt={fullName}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // Fallback on image load error
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-primary/10 text-primary font-bold text-xs">
                            {fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground leading-tight">{fullName}</h4>
                          {isCurrent && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              Current
                            </span>
                          )}
                          {t.employee_code && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {t.employee_code}
                            </span>
                          )}
                        </div>

                        {/* Specialties */}
                        {t.specialties && t.specialties.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.specialties.slice(0, 3).map((sp) => (
                              <span
                                key={sp.id || sp.name}
                                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                <Sparkles className="h-2.5 w-2.5 text-primary/70" />
                                {sp.name}
                              </span>
                            ))}
                            {t.specialties.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{t.specialties.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Radio / Selection Indicator */}
                      <div className="shrink-0 pt-0.5">
                        <div
                          className={cn(
                            'h-5 w-5 rounded-full border flex items-center justify-center transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'
                          )}
                        >
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submission error callout */}
          {submitError && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-border/50 px-6 py-4 bg-muted/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-background px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            Cancel
          </button>

          {/* Update Button appears when a therapist is selected */}
          {selectedTherapist && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleUpdate}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer',
                submitting
                  ? 'bg-muted/70 text-muted-foreground/50 border border-border/60 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90 active:scale-[0.98]'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating Therapist…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Update Therapist
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
