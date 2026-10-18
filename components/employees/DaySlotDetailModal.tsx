'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Clock,
  Coffee,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  User,
  MapPin,
} from 'lucide-react';
import { authedFetch } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface ExtraHoursRecord {
  id: string;
  therapist_id?: string;
  employee_id?: string;
  therapist_name?: string;
  branch_id?: string;
  branch_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: number;
  reason?: string;
  notes?: string;
  status: string;
  created_at?: string;
}

export interface WorkingHoursRecord {
  id: string;
  therapist_id?: string;
  employee_id: string;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  therapist_name?: string;
  branch_id?: string;
  branch_name?: string;
  day_of_week: number; // 0=Monday … 6=Sunday
  day_name?: string;
  is_weekend_off: boolean;
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  break_duration: number; // in minutes
  break_start_time?: string | null;
  break_end_time?: string | null;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string | null;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export const DAYS_META: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Monday',    short: 'Mon' },
  { value: 1, label: 'Tuesday',   short: 'Tue' },
  { value: 2, label: 'Wednesday', short: 'Wed' },
  { value: 3, label: 'Thursday',  short: 'Thu' },
  { value: 4, label: 'Friday',    short: 'Fri' },
  { value: 5, label: 'Saturday',  short: 'Sat' },
  { value: 6, label: 'Sunday',    short: 'Sun' },
];

export function formatTime12(t?: string | null): string {
  if (!t) return '--';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function calcShiftHours(start: string, end: string, breakMin: number = 0): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(h2)) return 0;
  const totalMin = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0)) - (breakMin || 0);
  return Math.max(0, parseFloat((totalMin / 60).toFixed(2)));
}

export function getTodayKuwait(): string {
  try {
    const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuwait' });
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch {
    // fallback
  }
  return new Date().toISOString().slice(0, 10);
}

// ── DAY SLOT DETAIL POPUP MODAL ────────────────────────────────────────────────
export function DaySlotDetailModal({
  record,
  onClose,
  onRecordUpdated,
  token,
  specificDateLabel,
}: {
  record: WorkingHoursRecord;
  onClose: () => void;
  onRecordUpdated?: () => void;
  token?: string | null;
  specificDateLabel?: string;
}) {
  const [currentRecord, setCurrentRecord] = useState<WorkingHoursRecord>(record);
  const [extraHours, setExtraHours] = useState<ExtraHoursRecord[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  // Sub-forms toggles
  const [showBreakForm, setShowBreakForm] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);

  // Loading & status alerts
  const [savingBreak, setSavingBreak] = useState(false);
  const [savingExtra, setSavingExtra] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Break form fields
  const [breakStart, setBreakStart] = useState(
    currentRecord.break_start_time ? currentRecord.break_start_time.slice(0, 5) : '13:00'
  );
  const [breakEnd, setBreakEnd] = useState(
    currentRecord.break_end_time ? currentRecord.break_end_time.slice(0, 5) : '14:00'
  );
  const [breakDuration, setBreakDuration] = useState<number>(currentRecord.break_duration || 60);
  const [applyAllDays, setApplyAllDays] = useState(false);

  // Extra hours form fields
  const [extraDate, setExtraDate] = useState(getTodayKuwait());
  const [extraStart, setExtraStart] = useState('18:00');
  const [extraEnd, setExtraEnd] = useState('20:00');
  const [extraReason, setExtraReason] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [extraStatus, setExtraStatus] = useState('approved');

  // Load extra hours for therapist
  const fetchExtraHours = useCallback(() => {
    if (!currentRecord.therapist_id) {
      setLoadingExtra(false);
      return;
    }
    setLoadingExtra(true);

    authedFetch(`/uauth/api/v1/therapists/extra-hours/?therapist_id=${currentRecord.therapist_id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        let list: ExtraHoursRecord[] = [];
        if (Array.isArray(json?.data)) list = json.data;
        else if (Array.isArray(json?.results)) list = json.results;
        else if (Array.isArray(json)) list = json;
        setExtraHours(list);
      })
      .catch((err) => {
        console.warn('Failed to load extra hours:', err);
        setExtraHours([]);
      })
      .finally(() => setLoadingExtra(false));
  }, [currentRecord.therapist_id]);

  useEffect(() => {
    fetchExtraHours();
  }, [fetchExtraHours]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Save break time
  const handleSaveBreak = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (breakStart && breakEnd && breakStart >= breakEnd) {
      setActionError('Break start time must be before break end time.');
      return;
    }

    setSavingBreak(true);
    try {
      const payload: Record<string, unknown> = {
        therapist_id: currentRecord.therapist_id,
        employee_id: currentRecord.employee_id,
        break_start_time: breakStart || null,
        break_end_time: breakEnd || null,
        break_duration: breakDuration ? Number(breakDuration) : null,
      };
      if (!applyAllDays) {
        payload.day_of_week = currentRecord.day_of_week;
      }

      const res = await authedFetch('/uauth/api/v1/therapists/break-time/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update break time');
      }

      setCurrentRecord((prev) => ({
        ...prev,
        break_start_time: breakStart || null,
        break_end_time: breakEnd || null,
        break_duration: Number(breakDuration) || prev.break_duration,
      }));
      setActionSuccess('Break time updated successfully!');
      setShowBreakForm(false);
      onRecordUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error updating break time');
    } finally {
      setSavingBreak(false);
    }
  };

  // Clear break time
  const handleClearBreak = async () => {
    setActionError(null);
    setActionSuccess(null);
    setSavingBreak(true);
    try {
      const payload: Record<string, unknown> = {
        therapist_id: currentRecord.therapist_id,
        employee_id: currentRecord.employee_id,
        break_start_time: null,
        break_end_time: null,
        break_duration: null,
      };
      if (!applyAllDays) {
        payload.day_of_week = currentRecord.day_of_week;
      }

      const res = await authedFetch('/uauth/api/v1/therapists/break-time/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to clear break time');
      }

      setBreakStart('');
      setBreakEnd('');
      setBreakDuration(0);
      setCurrentRecord((prev) => ({
        ...prev,
        break_start_time: null,
        break_end_time: null,
        break_duration: 0,
      }));
      setActionSuccess('Break time cleared successfully!');
      setShowBreakForm(false);
      onRecordUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error clearing break time');
    } finally {
      setSavingBreak(false);
    }
  };

  // Save extra hours
  const handleSaveExtraHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!extraDate) {
      setActionError('Please select a valid date for extra hours.');
      return;
    }
    if (extraStart && extraEnd && extraStart >= extraEnd) {
      setActionError('Start time must be before end time for extra hours.');
      return;
    }

    setSavingExtra(true);
    try {
      const payload = {
        therapist_id: currentRecord.therapist_id,
        employee_id: currentRecord.employee_id,
        date: extraDate,
        start_time: extraStart,
        end_time: extraEnd,
        reason: extraReason || 'Overtime Shift',
        notes: extraNotes || '',
        status: extraStatus || 'approved',
      };

      const res = await authedFetch('/uauth/api/v1/therapists/extra-hours/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to add extra hours');
      }

      setActionSuccess('Extra working hours added successfully!');
      setShowExtraForm(false);
      setExtraReason('');
      setExtraNotes('');
      fetchExtraHours();
      onRecordUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error adding extra hours');
    } finally {
      setSavingExtra(false);
    }
  };

  // Delete extra hours
  const handleDeleteExtraHours = async (id: string) => {
    if (!confirm('Are you sure you want to remove this extra working hours entry?')) return;
    try {
      const res = await authedFetch(`/uauth/api/v1/therapists/extra-hours/${id}/`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete extra hours');
      }
      setExtraHours((prev) => prev.filter((item) => item.id !== id));
      setActionSuccess('Extra hours removed.');
      onRecordUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete extra hours');
    }
  };

  const dayMeta = DAYS_META.find((d) => d.value === currentRecord.day_of_week) ?? {
    label: currentRecord.day_name || 'Day',
    short: 'Day',
  };

  const name =
    currentRecord.therapist_name ||
    [currentRecord.first_name, currentRecord.last_name].filter(Boolean).join(' ') ||
    'Therapist';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{name}</h3>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  {dayMeta.label}
                </span>
                {specificDateLabel && (
                  <span className="rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 text-[11px] font-semibold">
                    {specificDateLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentRecord.branch_name || 'All Branches'} • Working Hours & Break Details
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl border border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Alerts */}
          {actionSuccess && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* ── SECTION 1: SHIFT DETAILS ── */}
          <div className="rounded-2xl border border-border/70 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Day Schedule Overview
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-bold uppercase',
                  currentRecord.is_weekend_off
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                )}
              >
                {currentRecord.is_weekend_off ? 'Weekend Off' : 'Active Shift'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Shift Start
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {formatTime12(currentRecord.start_time)}
                </span>
                <span className="block text-[10px] text-muted-foreground font-mono">
                  {currentRecord.start_time ? currentRecord.start_time.slice(0, 5) : '--'}
                </span>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Shift End
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {formatTime12(currentRecord.end_time)}
                </span>
                <span className="block text-[10px] text-muted-foreground font-mono">
                  {currentRecord.end_time ? currentRecord.end_time.slice(0, 5) : '--'}
                </span>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Gross Hours
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {calcShiftHours(currentRecord.start_time, currentRecord.end_time, 0)} hrs
                </span>
                <span className="block text-[10px] text-muted-foreground">Without breaks</span>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Net Working
                </span>
                <span className="text-sm font-extrabold text-primary">
                  {calcShiftHours(
                    currentRecord.start_time,
                    currentRecord.end_time,
                    currentRecord.break_duration
                  )}{' '}
                  hrs
                </span>
                <span className="block text-[10px] text-muted-foreground">Excl. breaks</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground">
              <span>
                Effective:{' '}
                <strong className="text-foreground">{currentRecord.effective_from}</strong>{' '}
                {currentRecord.effective_to ? `to ${currentRecord.effective_to}` : '(ongoing)'}
              </span>
              <span>
                Timezone: <strong className="text-foreground">{currentRecord.timezone || 'Asia/Kuwait'}</strong>
              </span>
            </div>
          </div>

          {/* ── SECTION 2: BREAK TIMES ── */}
          <div className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-300/40 dark:border-amber-700/40">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <Coffee className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Break Times
                  </h4>
                  <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                    Scheduled pauses & meal intervals
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentRecord.break_start_time && (
                  <button
                    type="button"
                    onClick={handleClearBreak}
                    disabled={savingBreak}
                    className="rounded-xl border border-amber-400/50 bg-amber-100/60 dark:bg-amber-900/40 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition cursor-pointer disabled:opacity-50"
                  >
                    Clear Break
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowBreakForm((prev) => !prev);
                    setShowExtraForm(false);
                    setActionError(null);
                    setActionSuccess(null);
                  }}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  {showBreakForm ? 'Cancel' : 'Update Break Time'}
                </button>
              </div>
            </div>

            {/* Break display summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-background/60 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Break Window
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {currentRecord.break_start_time && currentRecord.break_end_time
                    ? `${formatTime12(currentRecord.break_start_time)} – ${formatTime12(
                        currentRecord.break_end_time
                      )}`
                    : 'None Set'}
                </span>
              </div>

              <div className="rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-background/60 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Break Duration
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {currentRecord.break_duration ? `${currentRecord.break_duration} minutes` : '0 min'}
                </span>
              </div>

              <div className="rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-background/60 p-3">
                <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                  Break Status
                </span>
                <span className="text-sm font-extrabold text-foreground">
                  {currentRecord.break_start_time ? 'Scheduled' : 'Flexible Break'}
                </span>
              </div>
            </div>

            {/* Update Break Form */}
            {showBreakForm && (
              <form
                onSubmit={handleSaveBreak}
                className="rounded-2xl border border-amber-400/60 bg-card p-4 space-y-3 mt-2"
              >
                <div className="font-bold text-xs text-foreground">
                  Configure Break Time for {dayMeta.label}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Break Start Time
                    </label>
                    <input
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Break End Time
                    </label>
                    <input
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={breakDuration}
                      onChange={(e) => setBreakDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyAllDays}
                      onChange={(e) => setApplyAllDays(e.target.checked)}
                      className="rounded border-border text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>Apply break time to all 7 days for this therapist</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBreakForm(false)}
                      className="rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBreak}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {savingBreak && <Loader2 className="h-3 w-3 animate-spin" />}
                      Save Break Time
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* ── SECTION 3: EXTRA WORKING HOURS ── */}
          <div className="rounded-2xl border border-sky-300/60 dark:border-sky-700/40 bg-sky-50/50 dark:bg-sky-950/20 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-sky-300/40 dark:border-sky-700/40">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-200">
                    Extra Working Hours
                  </h4>
                  <span className="text-[11px] text-sky-800/70 dark:text-sky-300/70">
                    Overtime & additional shifts
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowExtraForm((prev) => !prev);
                  setShowBreakForm(false);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-xs transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                {showExtraForm ? 'Cancel' : 'Add Extra Time'}
              </button>
            </div>

            {/* Extra Hours Form */}
            {showExtraForm && (
              <form
                onSubmit={handleSaveExtraHours}
                className="rounded-2xl border border-sky-400/60 bg-card p-4 space-y-3 mt-3"
              >
                <div className="font-bold text-xs text-foreground">
                  Record Extra Hours for {name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={extraDate}
                      onChange={(e) => setExtraDate(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={extraStart}
                      onChange={(e) => setExtraStart(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={extraEnd}
                      onChange={(e) => setExtraEnd(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Reason / Overtime Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. VIP appointment extension, evening rush"
                      value={extraReason}
                      onChange={(e) => setExtraReason(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Status
                    </label>
                    <select
                      value={extraStatus}
                      onChange={(e) => setExtraStatus(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Additional context or notes for payroll..."
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowExtraForm(false)}
                    className="rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingExtra}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {savingExtra && <Loader2 className="h-3 w-3 animate-spin" />}
                    Submit Extra Time
                  </button>
                </div>
              </form>
            )}

            {/* Extra Hours List */}
            <div className="pt-2 space-y-2">
              {loadingExtra ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading extra working hours…</span>
                </div>
              ) : extraHours.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-card/60 p-4 text-center">
                  <p className="text-xs text-muted-foreground italic">
                    No extra working hours recorded for this therapist.
                  </p>
                </div>
              ) : (
                extraHours.map((eh) => {
                  const isApproved = eh.status === 'approved';
                  return (
                    <div
                      key={eh.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 text-xs shadow-2xs hover:border-primary/40 transition"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {eh.date}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatTime12(eh.start_time)} – {formatTime12(eh.end_time)}
                          </span>
                          <span className="font-bold text-primary">
                            ({eh.hours_worked} hrs)
                          </span>
                        </div>
                        {eh.reason && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {eh.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          )}
                        >
                          {eh.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExtraHours(eh.id)}
                          className="h-7 w-7 grid place-items-center rounded-lg border border-border/60 text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                          title="Delete extra hours"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/60 bg-card px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-muted/60 px-5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WRAPPER COMPONENT: LOADS WORKING HOURS RECORD FOR A THERAPIST BY DATE ──
export function TherapistDayWorkingHoursModal({
  therapistId,
  therapistName,
  branchId,
  branchName,
  date,
  onClose,
  onUpdated,
  token,
}: {
  therapistId: string;
  therapistName: string;
  branchId?: string;
  branchName?: string;
  date: string; // YYYY-MM-DD
  onClose: () => void;
  onUpdated?: () => void;
  token?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<WorkingHoursRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const d = new Date(date + 'T00:00:00');
    // JS: 0=Sun, 1=Mon, ..., 6=Sat -> Django: 0=Mon, ..., 6=Sun
    const djangoDay = (d.getDay() + 6) % 7;

    const endpoint = `/uauth/api/v1/therapists/working-hours/?therapist_id=${therapistId}&day_of_week=${djangoDay}`;

    authedFetch(endpoint)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        let matchedRecord: WorkingHoursRecord | null = null;
        const list: WorkingHoursRecord[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.results)
          ? json.results
          : Array.isArray(json)
          ? json
          : [];

        if (list.length > 0) {
          matchedRecord = list.find((r) => r.day_of_week === djangoDay) || list[0];
        }

        if (matchedRecord) {
          setRecord(matchedRecord);
        } else {
          // Fallback record for that therapist and day
          const dayMeta = DAYS_META.find((dm) => dm.value === djangoDay);
          setRecord({
            id: `temp-${therapistId}-${djangoDay}`,
            therapist_id: therapistId,
            employee_id: '',
            therapist_name: therapistName,
            branch_id: branchId,
            branch_name: branchName,
            day_of_week: djangoDay,
            day_name: dayMeta?.label || 'Day',
            is_weekend_off: false,
            start_time: '10:00:00',
            end_time: '22:00:00',
            break_duration: 60,
            break_start_time: '14:00:00',
            break_end_time: '15:00:00',
            effective_from: date,
          });
        }
      })
      .catch((err) => {
        console.warn('Error fetching working hours for therapist:', err);
        if (cancelled) return;
        const dayMeta = DAYS_META.find((dm) => dm.value === djangoDay);
        setRecord({
          id: `temp-${therapistId}-${djangoDay}`,
          therapist_id: therapistId,
          employee_id: '',
          therapist_name: therapistName,
          branch_id: branchId,
          branch_name: branchName,
          day_of_week: djangoDay,
          day_name: dayMeta?.label || 'Day',
          is_weekend_off: false,
          start_time: '10:00:00',
          end_time: '22:00:00',
          break_duration: 60,
          break_start_time: '14:00:00',
          break_end_time: '15:00:00',
          effective_from: date,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [therapistId, therapistName, branchId, branchName, date]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background px-6 py-4 shadow-xl text-foreground text-xs font-semibold">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Loading working hours details for {therapistName}…</span>
        </div>
      </div>
    );
  }

  if (!record) return null;

  return (
    <DaySlotDetailModal
      record={record}
      onClose={onClose}
      onRecordUpdated={onUpdated}
      token={token}
      specificDateLabel={date}
    />
  );
}
