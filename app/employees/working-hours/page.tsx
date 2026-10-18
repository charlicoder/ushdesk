'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Clock, Search, Building2, UserCheck, CalendarDays,
  RefreshCw, AlertCircle, ChevronDown, X, Coffee,
  LayoutGrid, List, CheckCircle2, ShieldAlert,
  Calendar, Layers, Sparkles, Filter, Check, Eye,
  ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Loader2,
  Timer,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface WorkingHoursRecord {
  id: string;
  therapist_id: string;
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  therapist_name: string;
  branch_id: string;
  branch_name: string;
  day_of_week: number; // 0 = Monday, ..., 6 = Sunday
  day_name: string;
  is_weekend_off: boolean;
  start_time: string;
  end_time: string;
  break_duration: number; // in minutes
  break_start_time?: string | null;
  break_end_time?: string | null;
  effective_from: string;
  effective_to: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExtraHoursRecord {
  id: string;
  therapist_id?: string;
  employee_id?: string;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  therapist_name?: string;
  branch_id?: string;
  branch_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: string | number;
  reason?: string;
  status: string;
  notes?: string;
  created_at?: string;
}

interface BranchOption {
  id: string;
  name: string;
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Monday',    short: 'Mon' },
  { value: '1', label: 'Tuesday',   short: 'Tue' },
  { value: '2', label: 'Wednesday', short: 'Wed' },
  { value: '3', label: 'Thursday',  short: 'Thu' },
  { value: '4', label: 'Friday',    short: 'Fri' },
  { value: '5', label: 'Saturday',  short: 'Sat' },
  { value: '6', label: 'Sunday',    short: 'Sun' },
];

const DAY_INDEX_MAP: Record<number, { label: string; short: string }> = {
  0: { label: 'Monday',    short: 'Mon' },
  1: { label: 'Tuesday',   short: 'Tue' },
  2: { label: 'Wednesday', short: 'Wed' },
  3: { label: 'Thursday',  short: 'Thu' },
  4: { label: 'Friday',    short: 'Fri' },
  5: { label: 'Saturday',  short: 'Sat' },
  6: { label: 'Sunday',    short: 'Sun' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime12(timeStr: string | null | undefined): string {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
}

function calcShiftHours(start: string, end: string, breakMin: number = 0): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(h2)) return 0;
  const totalMin = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0)) - (breakMin || 0);
  return Math.max(0, parseFloat((totalMin / 60).toFixed(1)));
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function getTodayKuwait(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

// ── Pagination Bar Component ───────────────────────────────────────────────────
function PaginationBar({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 'all'],
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number | 'all';
  totalCount: number;
  itemLabel: string;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number | 'all') => void;
  pageSizeOptions?: (number | 'all')[];
}) {
  if (totalCount === 0) return null;

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex = pageSize === 'all' ? totalCount : Math.min(startIndex + pageSize, totalCount);

  // Generate page numbers
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 mt-6 text-sm shadow-xs animate-fade-in-up">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">
          Showing <strong className="text-foreground">{startIndex + 1}</strong> to{' '}
          <strong className="text-foreground">{endIndex}</strong> of{' '}
          <strong className="text-foreground">{totalCount}</strong> {itemLabel}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
              onPageSizeChange(val);
              onPageChange(1);
            }}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pages.map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={idx}
                onClick={() => onPageChange(p)}
                className={cn(
                  'h-8 min-w-8 px-2 rounded-lg text-xs font-bold transition cursor-pointer',
                  currentPage === p
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-foreground hover:bg-muted'
                )}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-xs text-muted-foreground select-none">
                {p}
              </span>
            )
          )}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition cursor-pointer"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── DAY SLOT DETAIL POPUP MODAL ────────────────────────────────────────────────
function DaySlotDetailModal({
  record,
  onClose,
  onRecordUpdated,
  token,
}: {
  record: WorkingHoursRecord;
  onClose: () => void;
  onRecordUpdated: () => void;
  token?: string | null;
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
    if (breakStart && breakEnd && breakStart >= breakEnd) {
      setActionError('Break start time must be strictly before end time.');
      return;
    }
    setSavingBreak(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        therapist_id: currentRecord.therapist_id,
        break_start_time: breakStart || null,
        break_end_time: breakEnd || null,
        break_duration: breakDuration ? Number(breakDuration) : null,
      };
      if (!applyAllDays) {
        payload.day_of_week = currentRecord.day_of_week;
      }
      const res = await authedFetch('/uauth/api/v1/therapists/break-time/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to update break time');
      }
      setActionSuccess('Break time updated successfully!');
      setCurrentRecord((prev) => ({
        ...prev,
        break_start_time: breakStart || null,
        break_end_time: breakEnd || null,
        break_duration: Number(breakDuration) || prev.break_duration,
      }));
      setShowBreakForm(false);
      onRecordUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error updating break time');
    } finally {
      setSavingBreak(false);
    }
  };

  // Clear break time
  const handleClearBreak = async () => {
    setSavingBreak(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        therapist_id: currentRecord.therapist_id,
        break_start_time: null,
        break_end_time: null,
        break_duration: null,
      };
      if (!applyAllDays) {
        payload.day_of_week = currentRecord.day_of_week;
      }
      const res = await authedFetch('/uauth/api/v1/therapists/break-time/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to clear break time');
      }
      setActionSuccess('Break time cleared.');
      setCurrentRecord((prev) => ({
        ...prev,
        break_start_time: null,
        break_end_time: null,
      }));
      setShowBreakForm(false);
      onRecordUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error clearing break time');
    } finally {
      setSavingBreak(false);
    }
  };

  // Save extra hours
  const handleSaveExtraHours = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!extraDate) {
      setActionError('Please select a date.');
      return;
    }
    if (!extraStart || !extraEnd) {
      setActionError('Please specify start and end times.');
      return;
    }
    if (extraStart >= extraEnd) {
      setActionError('Extra start time must be strictly before end time.');
      return;
    }
    setSavingExtra(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const payload = {
        therapist_id: currentRecord.therapist_id,
        date: extraDate,
        start_time: extraStart,
        end_time: extraEnd,
        reason: extraReason.trim() || undefined,
        notes: extraNotes.trim() || undefined,
        status: extraStatus,
      };
      const res = await authedFetch('/uauth/api/v1/therapists/extra-hours/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
      onRecordUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error adding extra hours');
    } finally {
      setSavingExtra(false);
    }
  };

  // Delete extra hours
  const handleDeleteExtraHours = async (id: string) => {
    if (!confirm('Are you sure you want to remove this extra hours record?')) return;
    try {
      const res = await authedFetch(`/uauth/api/v1/therapists/extra-hours/${id}/`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || 'Failed to delete extra hours');
      }
      setActionSuccess('Extra hours record deleted.');
      setExtraHours((prev) => prev.filter((x) => x.id !== id));
      onRecordUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error deleting extra hours');
    }
  };

  const dayLabel = DAY_INDEX_MAP[currentRecord.day_of_week]?.label ?? currentRecord.day_name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[92vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-primary/30 via-slate-900 to-slate-950 border-b border-border/50 text-white shrink-0">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              {dayLabel} Shift Details
            </span>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/70 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shadow-lg shrink-0">
              {initials(currentRecord.therapist_name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-white truncate">
                {currentRecord.therapist_name}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/80 flex-wrap">
                <span className="font-mono bg-black/40 border border-white/15 px-2 py-0.5 rounded-full">
                  {currentRecord.employee_code}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary/90" />
                  {currentRecord.branch_name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Action Alerts */}
          {actionSuccess && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
              <button
                onClick={() => setActionSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {actionError && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs font-medium text-destructive animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                onClick={() => setActionError(null)}
                className="hover:opacity-75 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── SECTION 1: WORKING HOURS & SHIFT DETAILS ── */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duty Status</span>
              {currentRecord.is_weekend_off ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs px-2.5 py-0.5">
                  Weekend Off / Rest Day
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs px-2.5 py-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Active Scheduled Shift
                </span>
              )}
            </div>

            {!currentRecord.is_weekend_off && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shift Start</span>
                  <span className="mt-1 font-mono text-sm font-bold text-foreground block">
                    {formatTime12(currentRecord.start_time)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {currentRecord.start_time?.slice(0, 5)}
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shift End</span>
                  <span className="mt-1 font-mono text-sm font-bold text-foreground block">
                    {formatTime12(currentRecord.end_time)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {currentRecord.end_time?.slice(0, 5)}
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shift Duration</span>
                  <span className="mt-1 text-sm font-bold text-foreground block">
                    {calcShiftHours(currentRecord.start_time, currentRecord.end_time, 0)} hrs
                  </span>
                  <span className="text-[10px] text-muted-foreground">Gross working time</span>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Working</span>
                  <span className="mt-1 text-sm font-bold text-primary flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {calcShiftHours(currentRecord.start_time, currentRecord.end_time, currentRecord.break_duration)} hrs
                  </span>
                  <span className="text-[10px] text-muted-foreground">Excl. breaks</span>
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-muted-foreground">Effective Range:</span>
                <span className="font-semibold text-foreground">
                  {currentRecord.effective_from || 'Always'} → {currentRecord.effective_to || 'Ongoing'}
                </span>
              </div>
              {currentRecord.timezone && (
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-muted-foreground">Timezone:</span>
                  <span className="font-mono text-foreground">{currentRecord.timezone}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 2: BREAK TIMES ── */}
          <div className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-300/40 dark:border-amber-700/40">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <Coffee className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Break Times
                  </h4>
                  <span className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                    Rest window & duration
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowBreakForm((prev) => !prev);
                  setShowExtraForm(false);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100 hover:bg-amber-500/30 transition cursor-pointer"
              >
                <Edit2 className="h-3 w-3" />
                {showBreakForm ? 'Cancel' : 'Update Break Time'}
              </button>
            </div>

            {!showBreakForm ? (
              <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Break Window</span>
                  <span className="mt-1 font-mono text-sm font-bold text-foreground block">
                    {currentRecord.break_start_time && currentRecord.break_end_time
                      ? `${formatTime12(currentRecord.break_start_time)} – ${formatTime12(currentRecord.break_end_time)}`
                      : 'Not scheduled'}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-card p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Allowed Duration</span>
                  <span className="mt-1 text-sm font-bold text-foreground block">
                    {currentRecord.break_duration ? `${currentRecord.break_duration} minutes` : '0 min'}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-card p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Status</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <Check className="h-3.5 w-3.5" />
                    {currentRecord.break_start_time ? 'Scheduled' : 'Flexible Break'}
                  </span>
                </div>
              </div>
            ) : (
              /* Inline Break Time Form */
              <form onSubmit={handleSaveBreak} className="pt-3 space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Break Start Time
                    </label>
                    <input
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Break End Time
                    </label>
                    <input
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={breakDuration}
                      onChange={(e) => setBreakDuration(Number(e.target.value))}
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyAllDays}
                      onChange={(e) => setApplyAllDays(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <span>Apply break time to all 7 days for this therapist</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearBreak}
                      disabled={savingBreak}
                      className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition cursor-pointer"
                    >
                      Clear Break
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
                <Plus className="h-3 w-3" />
                {showExtraForm ? 'Cancel' : 'Add Extra Time'}
              </button>
            </div>

            {/* Inline Extra Time Form */}
            {showExtraForm && (
              <form onSubmit={handleSaveExtraHours} className="pt-3 pb-3 mb-3 border-b border-sky-300/30 space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={extraDate}
                      onChange={(e) => setExtraDate(e.target.value)}
                      required
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={extraStart}
                      onChange={(e) => setExtraStart(e.target.value)}
                      required
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={extraEnd}
                      onChange={(e) => setExtraEnd(e.target.value)}
                      required
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Reason / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Covering busy evening shift"
                      value={extraReason}
                      onChange={(e) => setExtraReason(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-foreground block mb-1">
                      Approval Status
                    </label>
                    <select
                      value={extraStatus}
                      onChange={(e) => setExtraStatus(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-foreground block mb-1">
                    Internal Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Additional context or notes…"
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20"
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

// ── Main Page Component ────────────────────────────────────────────────────────
export default function WorkingHoursPage() {
  const token       = useAppSelector((s) => s.auth.token);
  const initialized = useAppSelector((s) => s.auth.initialized);

  // Data states
  const [schedules,        setSchedules]        = useState<WorkingHoursRecord[]>([]);
  const [apiBranches,      setApiBranches]      = useState<BranchOption[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [tick,             setTick]             = useState(0);

  // Filter states
  const [search,           setSearch]           = useState('');
  const [branchFilter,     setBranchFilter]     = useState('');
  const [dayFilter,        setDayFilter]        = useState('');
  const [statusFilter,     setStatusFilter]     = useState('active');
  const [weekendOffFilter, setWeekendOffFilter] = useState('');
  const [viewMode,         setViewMode]         = useState<'grouped' | 'list'>('grouped');

  // Selected schedule for detail popup
  const [selectedRecord,   setSelectedRecord]   = useState<WorkingHoursRecord | null>(null);

  // Pagination states
  const [therapistPage, setTherapistPage] = useState(1);
  const [therapistPageSize, setTherapistPageSize] = useState<number | 'all'>(10);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<number | 'all'>(20);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Fetch from /uauth/api/v1/therapists/working-hours/
  // Passing no_pagination=true & page_size=1000 so that ALL working hours across all days are returned
  useEffect(() => {
    if (!initialized) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const qs = new URLSearchParams();
    if (search.trim()) qs.set('search', search.trim());
    if (branchFilter) qs.set('branch_id', branchFilter);
    if (dayFilter !== '') qs.set('day_of_week', dayFilter);
    if (statusFilter && statusFilter !== 'all') qs.set('status', statusFilter);
    if (weekendOffFilter !== '') qs.set('is_weekend_off', weekendOffFilter);
    qs.set('no_pagination', 'true');
    qs.set('page_size', '1000');

    const endpoint = `/uauth/api/v1/therapists/working-hours/${qs.toString() ? `?${qs.toString()}` : ''}`;

    authedFetch(endpoint, { headers })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(
            (json as Record<string, string>)?.detail ??
            (json as Record<string, string>)?.message ??
            `Request failed (${res.status})`
          );
        }

        // 1. Extract branches list from response key `branches`
        const extractedBranches: BranchOption[] = [];
        const rawBranches = (json?.branches ?? json?.data?.branches) as unknown;
        if (Array.isArray(rawBranches)) {
          rawBranches.forEach((b) => {
            if (typeof b === 'object' && b !== null) {
              const bObj = b as Record<string, unknown>;
              const bId = String(bObj.id ?? bObj.branch_id ?? '');
              const bName = String(bObj.name ?? bObj.branch_name ?? bId);
              if (bId) extractedBranches.push({ id: bId, name: bName });
            } else if (typeof b === 'string' || typeof b === 'number') {
              extractedBranches.push({ id: String(b), name: String(b) });
            }
          });
        }
        setApiBranches(extractedBranches);

        // 2. Extract working hours data
        let list: WorkingHoursRecord[] = [];
        if (Array.isArray(json?.data)) {
          list = json.data as WorkingHoursRecord[];
        } else if (Array.isArray(json)) {
          list = json as WorkingHoursRecord[];
        } else if (Array.isArray(json?.results)) {
          list = json.results as WorkingHoursRecord[];
        }

        setSchedules(list);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn('[WorkingHoursPage] fetch error:', err.message);
        setError(err.message);
        setSchedules([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, initialized, tick, search, branchFilter, dayFilter, statusFilter, weekendOffFilter]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setTherapistPage(1);
    setListPage(1);
  }, [search, branchFilter, dayFilter, statusFilter, weekendOffFilter]);

  // Unified branches list from API response + records
  const allBranches = useMemo(() => {
    const map = new Map<string, string>();

    // From response.branches
    apiBranches.forEach((b) => {
      if (b.id) map.set(b.id, b.name);
    });

    // From records
    schedules.forEach((s) => {
      if (s.branch_id && s.branch_name) {
        map.set(s.branch_id, s.branch_name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [apiBranches, schedules]);

  // Client-side filtering & search (supplements backend filtering)
  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter((item) => {
      const matchSearch = !q ||
        (item.therapist_name?.toLowerCase().includes(q)) ||
        (item.first_name?.toLowerCase().includes(q)) ||
        (item.last_name?.toLowerCase().includes(q)) ||
        (item.employee_code?.toLowerCase().includes(q)) ||
        (item.branch_name?.toLowerCase().includes(q));

      const matchBranch = !branchFilter || item.branch_id === branchFilter;
      const matchDay = dayFilter === '' || String(item.day_of_week) === String(dayFilter);
      const matchWeekendOff = weekendOffFilter === '' || String(item.is_weekend_off) === weekendOffFilter;

      return matchSearch && matchBranch && matchDay && matchWeekendOff;
    });
  }, [schedules, search, branchFilter, dayFilter, weekendOffFilter]);

  // Group schedules by therapist for the visual weekly grid view
  const groupedByTherapist = useMemo(() => {
    const map = new Map<string, {
      therapist_id: string;
      therapist_name: string;
      employee_code: string;
      branch_name: string;
      branch_id: string;
      shifts: Record<number, WorkingHoursRecord>;
      totalHours: number;
      workingDays: number;
    }>();

    filteredSchedules.forEach((item) => {
      const key = item.therapist_id || item.employee_id || item.therapist_name;
      if (!map.has(key)) {
        map.set(key, {
          therapist_id:   item.therapist_id,
          therapist_name: item.therapist_name || `${item.first_name} ${item.last_name}`.trim(),
          employee_code:  item.employee_code,
          branch_name:    item.branch_name,
          branch_id:      item.branch_id,
          shifts:         {},
          totalHours:     0,
          workingDays:    0,
        });
      }

      const group = map.get(key)!;
      group.shifts[item.day_of_week] = item;

      if (!item.is_weekend_off && item.start_time && item.end_time) {
        group.totalHours += calcShiftHours(item.start_time, item.end_time, item.break_duration);
        group.workingDays += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.therapist_name.localeCompare(b.therapist_name));
  }, [filteredSchedules]);

  // Paginated therapists (grouped view)
  const paginatedTherapists = useMemo(() => {
    if (therapistPageSize === 'all') return groupedByTherapist;
    const start = (therapistPage - 1) * therapistPageSize;
    return groupedByTherapist.slice(start, start + therapistPageSize);
  }, [groupedByTherapist, therapistPage, therapistPageSize]);

  const therapistTotalPages = useMemo(() => {
    if (therapistPageSize === 'all') return 1;
    return Math.max(1, Math.ceil(groupedByTherapist.length / therapistPageSize));
  }, [groupedByTherapist.length, therapistPageSize]);

  // Paginated shifts (list view)
  const paginatedList = useMemo(() => {
    if (listPageSize === 'all') return filteredSchedules;
    const start = (listPage - 1) * listPageSize;
    return filteredSchedules.slice(start, start + listPageSize);
  }, [filteredSchedules, listPage, listPageSize]);

  const listTotalPages = useMemo(() => {
    if (listPageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredSchedules.length / listPageSize));
  }, [filteredSchedules.length, listPageSize]);

  // Stats calculation
  const stats = useMemo(() => {
    const uniqueTherapists = new Set(filteredSchedules.map((s) => s.therapist_id || s.employee_code)).size;
    const workingShifts = filteredSchedules.filter((s) => !s.is_weekend_off).length;
    const weekendOffs = filteredSchedules.filter((s) => s.is_weekend_off).length;
    const totalWeeklyHours = filteredSchedules
      .filter((s) => !s.is_weekend_off)
      .reduce((acc, curr) => acc + calcShiftHours(curr.start_time, curr.end_time, curr.break_duration), 0);

    return {
      uniqueTherapists,
      workingShifts,
      weekendOffs,
      totalWeeklyHours: totalWeeklyHours.toFixed(0),
    };
  }, [filteredSchedules]);

  const hasFilters = Boolean(search || branchFilter || dayFilter !== '' || weekendOffFilter !== '' || statusFilter !== 'active');

  const clearFilters = () => {
    setSearch('');
    setBranchFilter('');
    setDayFilter('');
    setStatusFilter('active');
    setWeekendOffFilter('');
  };

  return (
    <DashboardShell>
      {/* ── Page Header ── */}
      <PageHeader
        title="Working Hours & Shifts"
        subtitle={loading ? 'Loading working hours…' : `${stats.uniqueTherapists} therapists · ${allBranches.length} branches · ${stats.workingShifts} active shifts`}
      />

      {/* ── Error Banner ── */}
      {error && !loading && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in-up">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error} — showing scheduled overview</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Overview Metric Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-4 animate-fade-in-up">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Therapists</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{stats.uniqueTherapists}</p>
          <span className="mt-0.5 text-xs text-muted-foreground">Staff on duty</span>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duty Shifts</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{stats.workingShifts}</p>
          <span className="mt-0.5 text-xs text-muted-foreground">Weekly active shifts</span>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Hours</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{stats.totalWeeklyHours} <span className="text-xs font-semibold text-muted-foreground">hrs</span></p>
          <span className="mt-0.5 text-xs text-muted-foreground">Combined weekly coverage</span>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Off Days</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{stats.weekendOffs}</p>
          <span className="mt-0.5 text-xs text-muted-foreground">Weekend / rest slots</span>
        </div>
      </div>

      {/* ── Toolbar: Search & All Query Filters ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 animate-fade-in-up">
        {/* Search */}
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search therapist, code, or branch…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Branch Filter (branches from API response key `branches`) */}
        <div className="relative flex items-center">
          <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground z-10" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-9 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground"
          >
            <option value="">All Branches</option>
            {allBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Day of Week Filter */}
        <div className="relative flex items-center">
          <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground z-10" />
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-9 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground"
          >
            <option value="">All Days</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Status Filter */}
        <div className="relative flex items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
            <option value="all">All Statuses</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Shift Type (On Duty vs Weekend Off) */}
        <div className="relative flex items-center">
          <select
            value={weekendOffFilter}
            onChange={(e) => setWeekendOffFilter(e.target.value)}
            className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground"
          >
            <option value="">All Shifts</option>
            <option value="false">On Duty Only</option>
            <option value="true">Weekend Off / Rest Only</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-10 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition cursor-pointer"
          >
            Reset filters
          </button>
        )}

        {/* View Toggle */}
        <div className="ml-auto flex items-center rounded-xl border border-border bg-card p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={cn(
              'flex h-9 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer',
              viewMode === 'grouped'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
            title="Weekly therapist schedule view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Therapists
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex h-9 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer',
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
            title="Individual shifts list table"
          >
            <List className="h-3.5 w-3.5" />
            Roster Table
          </button>
        </div>
      </div>

      {/* ── Skeletons ── */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl shimmer" />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filteredSchedules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 py-20 text-center animate-fade-in-up">
          <div className="rounded-2xl bg-muted/50 p-4 text-muted-foreground mb-4">
            <Clock className="h-10 w-10 opacity-30" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No working hours found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {hasFilters
              ? 'No schedules match your selected filters. Try resetting the criteria.'
              : 'No therapist working hours have been registered in the system.'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── VIEW 1: GROUPED BY THERAPIST (WEEKLY SCHEDULE CARDS) ── */}
      {!loading && filteredSchedules.length > 0 && viewMode === 'grouped' && (
        <div className="space-y-4">
          {paginatedTherapists.map((tGroup) => (
            <div
              key={tGroup.therapist_id}
              className="rounded-3xl border border-border/60 bg-card p-5 shadow-xs transition hover:shadow-md hover:border-primary/30 animate-fade-in-up"
            >
              {/* Header: Therapist & Overview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
                <div className="flex items-center gap-3.5">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-base font-bold text-white shadow-sm shrink-0">
                    {initials(tGroup.therapist_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground tracking-tight">
                        {tGroup.therapist_name}
                      </h3>
                      <span className="rounded-full bg-muted border border-border/50 px-2 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground">
                        {tGroup.employee_code}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-primary/70" />
                        {tGroup.branch_name || 'Assigned Branch'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/30 border border-border/50 px-3.5 py-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {tGroup.workingDays} working days
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="font-bold text-primary">
                      {tGroup.totalHours} hrs/wk
                    </span>
                  </div>
                </div>
              </div>

              {/* 7-Day Weekly Grid (Mon - Sun) */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                {[0, 1, 2, 3, 4, 5, 6].map((dayNum) => {
                  const shift = tGroup.shifts[dayNum];
                  const dayMeta = DAY_INDEX_MAP[dayNum];
                  const isOff = !shift || shift.is_weekend_off;

                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        const rec: WorkingHoursRecord = shift || {
                          id: '',
                          therapist_id: tGroup.therapist_id,
                          employee_id: '',
                          employee_code: tGroup.employee_code,
                          first_name: '',
                          last_name: '',
                          therapist_name: tGroup.therapist_name,
                          branch_id: tGroup.branch_id,
                          branch_name: tGroup.branch_name,
                          day_of_week: dayNum,
                          day_name: dayMeta.label,
                          is_weekend_off: true,
                          start_time: '',
                          end_time: '',
                          break_duration: 0,
                          break_start_time: null,
                          break_end_time: null,
                          effective_from: '',
                          effective_to: '',
                        };
                        setSelectedRecord(rec);
                      }}
                      className={cn(
                        'flex flex-col rounded-2xl p-3 border transition text-xs select-none',
                        isOff
                          ? 'bg-muted/15 border-border/40 text-muted-foreground/80 hover:border-primary/40 hover:bg-muted/30 cursor-pointer opacity-80'
                          : 'bg-muted/40 border-border/60 hover:border-primary/60 hover:bg-muted/70 hover:shadow-sm cursor-pointer shadow-xs'
                      )}
                      title={`Click to view details, update break time, or add extra time for ${dayMeta.label}`}
                    >
                      <div className="flex items-center justify-between font-bold pb-1.5 mb-1.5 border-b border-border/30">
                        <span className={cn(isOff ? 'text-muted-foreground' : 'text-foreground')}>
                          {dayMeta.short}
                        </span>
                        {isOff ? (
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Off</span>
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>

                      {isOff ? (
                        <div className="py-2 text-center text-[11px] text-muted-foreground/70 italic">
                          Weekend Off
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground text-[11px] leading-tight">
                            {formatTime12(shift.start_time)} – {formatTime12(shift.end_time)}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                            <span>{calcShiftHours(shift.start_time, shift.end_time, shift.break_duration)} hrs</span>
                            {shift.break_duration > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300" title={`${shift.break_duration} min break`}>
                                <Coffee className="h-2.5 w-2.5" />
                                {shift.break_duration}m
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Grouped View Pagination Controls */}
          <PaginationBar
            currentPage={therapistPage}
            totalPages={therapistTotalPages}
            pageSize={therapistPageSize}
            totalCount={groupedByTherapist.length}
            itemLabel="therapists"
            onPageChange={setTherapistPage}
            onPageSizeChange={setTherapistPageSize}
            pageSizeOptions={[10, 20, 50, 'all']}
          />
        </div>
      )}

      {/* ── VIEW 2: SHIFT ROSTER LIST TABLE ── */}
      {!loading && filteredSchedules.length > 0 && viewMode === 'list' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-xs animate-fade-in-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground">Therapist</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground">Day</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground">Hours</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell">Duration</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Break</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Branch</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((item, idx) => {
                  const dayMeta = DAY_INDEX_MAP[item.day_of_week] ?? { label: item.day_name, short: item.day_name };
                  const shiftHours = calcShiftHours(item.start_time, item.end_time, item.break_duration);

                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => setSelectedRecord(item)}
                      className={cn(
                        'border-b border-border/30 transition hover:bg-muted/30 cursor-pointer',
                        idx % 2 !== 0 && 'bg-muted/10'
                      )}
                    >
                      {/* Therapist */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shrink-0">
                            {initials(item.therapist_name)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm leading-tight">{item.therapist_name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{item.employee_code}</p>
                          </div>
                        </div>
                      </td>

                      {/* Day of Week */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{dayMeta.label}</span>
                      </td>

                      {/* Working Hours */}
                      <td className="px-4 py-3">
                        {item.is_weekend_off ? (
                          <span className="text-xs text-muted-foreground italic">Weekend Off</span>
                        ) : (
                          <span className="font-mono text-xs font-medium text-foreground">
                            {formatTime12(item.start_time)} – {formatTime12(item.end_time)}
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {item.is_weekend_off ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-xs font-semibold text-foreground">{shiftHours} hrs</span>
                        )}
                      </td>

                      {/* Break */}
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {item.break_duration > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                            <Coffee className="h-3 w-3 text-amber-500" />
                            {item.break_duration}m
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 text-primary/70 shrink-0" />
                          <span className="truncate max-w-[140px]">{item.branch_name}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {item.is_weekend_off ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            Day Off
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            On Duty
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(item);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* List View Pagination Controls */}
          <PaginationBar
            currentPage={listPage}
            totalPages={listTotalPages}
            pageSize={listPageSize}
            totalCount={filteredSchedules.length}
            itemLabel="shifts"
            onPageChange={setListPage}
            onPageSizeChange={setListPageSize}
            pageSizeOptions={[20, 50, 100, 'all']}
          />
        </div>
      )}

      {/* ── DAY SLOT DETAIL POPUP MODAL ── */}
      {selectedRecord && (
        <DaySlotDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onRecordUpdated={refetch}
          token={token}
        />
      )}
    </DashboardShell>
  );
}
