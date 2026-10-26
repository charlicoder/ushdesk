'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CalendarOff,
  User,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Search,
} from 'lucide-react';
import { authedFetch } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';
import { getCurrentKuwaitDateTime, parseClockToMinutes } from '@/lib/datetime';

export interface EmployeeOption {
  id: string;
  name: string;
  employee_code?: string;
  department_name?: string;
  role_name?: string;
  is_therapist?: boolean;
  avatar?: string | null;
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

export function getDefaultTimesForToday(): { start: string; end: string } {
  const { minutes } = getCurrentKuwaitDateTime();
  const nextHour = Math.min(23, Math.floor(minutes / 60) + 1);
  const endHour = Math.min(23, Math.max(nextHour + 1, nextHour + 2));
  const startStr = `${String(nextHour).padStart(2, '0')}:00`;
  const endStr = `${String(endHour).padStart(2, '0')}:00`;
  return { start: startStr, end: endStr };
}


function dedupeEmployees(list: EmployeeOption[]): EmployeeOption[] {
  const seen = new Set<string>();
  const res: EmployeeOption[] = [];
  for (const emp of list) {
    const id = String(emp?.id ?? '').trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      res.push({ ...emp, id });
    }
  }
  return res;
}

const COMMON_REASONS = [
  'Annual Leave',
  'Sick Leave',
  'Personal Time Off',
  'Emergency',
  'Casual Leave',
  'Unpaid Leave',
];

interface AddLeaveModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  token?: string | null;
  initialEmployeeId?: string;
  fallbackEmployees?: EmployeeOption[];
}

export function AddLeaveModal({
  onClose,
  onSuccess,
  initialEmployeeId,
  fallbackEmployees = [],
}: AddLeaveModalProps) {
  const [employees, setEmployees] = useState<EmployeeOption[]>(() => dedupeEmployees(fallbackEmployees));
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState('');

  const currentKuwait = getCurrentKuwaitDateTime();
  const initialTimes = useMemo(() => getDefaultTimesForToday(), []);

  // Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [leaveType, setLeaveType] = useState<'full_day' | 'half_day'>('full_day');
  const [leaveDate, setLeaveDate] = useState(currentKuwait.dateStr);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState(currentKuwait.dateStr);
  const [startTime, setStartTime] = useState(initialTimes.start);
  const [endTime, setEndTime] = useState(initialTimes.end);
  const [reason, setReason] = useState('Personal Time Off');
  const [status, setStatus] = useState<'approved' | 'pending'>('approved');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived validation checks for past date/time
  const isToday = leaveDate === currentKuwait.dateStr;
  const isLeaveDateInPast = Boolean(leaveDate && leaveDate < currentKuwait.dateStr);
  const isEndDateInPast = Boolean(isMultiDay && endDate && endDate < currentKuwait.dateStr);
  const isStartTimeInPast = Boolean(leaveType === 'half_day' && isToday && startTime && parseClockToMinutes(startTime) <= currentKuwait.minutes);
  const isTimeOrderInvalid = Boolean(leaveType === 'half_day' && startTime && endTime && startTime >= endTime);
  const hasPastError = isLeaveDateInPast || isEndDateInPast || isStartTimeInPast;

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Load employees list on mount
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingEmployees(true);
      try {
        const res = await authedFetch('/api/v1/employees');
        if (!res.ok) throw new Error('Failed to load employees list');
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        const rawList: Record<string, unknown>[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.results)
          ? json.results
          : [];

        if (rawList.length > 0) {
          const mapped: EmployeeOption[] = rawList.map((emp) => {
            const first = String(emp.first_name ?? '');
            const last = String(emp.last_name ?? '');
            const fullName = [first, last].filter(Boolean).join(' ') || String(emp.name ?? 'Unknown');
            const role = (emp.role as Record<string, unknown>)?.name ?? emp.role_name;
            const dept = (emp.department as Record<string, unknown>)?.name ?? emp.department_name;
            return {
              id: String(emp.id ?? ''),
              name: fullName,
              employee_code: String(emp.employee_code ?? ''),
              department_name: typeof dept === 'string' ? dept : 'Staff',
              role_name: typeof role === 'string' ? role : 'Employee',
              is_therapist: Boolean(emp.is_therapist || String(role).toLowerCase().includes('therapist')),
              avatar: (emp.avatar ?? null) as string | null,
            };
          });
          const uniqueMapped = dedupeEmployees(mapped);
          setEmployees(uniqueMapped);
          if (!selectedEmployeeId && uniqueMapped.length > 0) {
            setSelectedEmployeeId(uniqueMapped[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      } finally {
        if (active) setLoadingEmployees(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const unique = dedupeEmployees(employees);
    const q = employeeSearch.toLowerCase().trim();
    if (!q) return unique;
    return unique.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.role_name?.toLowerCase().includes(q) ||
        e.department_name?.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const now = getCurrentKuwaitDateTime();

    if (!selectedEmployeeId) {
      setError('Please select an employee or therapist.');
      return;
    }

    if (!leaveDate) {
      setError('Please specify a leave date.');
      return;
    }

    if (leaveDate < now.dateStr) {
      setError('Cannot add leave for a past date.');
      return;
    }

    if (leaveType === 'full_day' && isMultiDay) {
      if (!endDate) {
        setError('Please specify an end date for multi-day leave.');
        return;
      }
      if (endDate < leaveDate) {
        setError('End date cannot be earlier than start date.');
        return;
      }
      if (endDate < now.dateStr) {
        setError('End date cannot be in the past.');
        return;
      }
    }

    if (leaveType === 'half_day') {
      if (!startTime || !endTime) {
        setError('Please specify start and end times for half-day leave.');
        return;
      }
      if (startTime >= endTime) {
        setError('End time must be strictly after start time.');
        return;
      }
      if (leaveDate === now.dateStr) {
        const startMin = parseClockToMinutes(startTime);
        if (startMin <= now.minutes) {
          setError(`Cannot add leave for past date and time. Start time must be after ${now.timeStr}.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        employee_id: selectedEmployeeId,
        leave_type: leaveType,
        leave_date: leaveDate,
        reason: reason.trim() || 'Leave',
        status: status,
      };

      if (leaveType === 'full_day') {
        payload.end_date = isMultiDay && endDate !== leaveDate ? endDate : null;
      } else {
        payload.start_time = startTime.length === 5 ? `${startTime}:00` : startTime;
        payload.end_time = endTime.length === 5 ? `${endTime}:00` : endTime;
      }

      const res = await authedFetch('/api/v1/employees/leaves/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.detail || data.message || Object.values(data)[0] || 'Failed to create leave record';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating leave record');
    } finally {
      setSaving(false);
    }
  };

  const selectedEmpObj = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Accent top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground">Add Employee Leave</h2>
              <p className="text-xs text-muted-foreground">
                Schedule leave for staff & therapists to update live roster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-300 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Employee / Therapist selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Employee / Therapist *</span>
              {selectedEmpObj?.is_therapist && (
                <span className="text-[10px] font-extrabold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950/60 px-2 py-0.5 rounded-full">
                  Therapist
                </span>
              )}
            </label>

            {employees.length > 8 && (
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Quick search employee by name, code or role…"
                  className="h-8.5 w-full rounded-xl border border-border/80 bg-muted/30 pl-8 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            )}

            <div className="relative">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
                className="w-full h-11 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="" disabled>
                  {loadingEmployees ? 'Loading staff list…' : '— Select Employee or Therapist —'}
                </option>
                {filteredEmployees.map((emp, idx) => (
                  <option key={`${emp.id}-${idx}`} value={emp.id}>
                    {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''} — {emp.role_name || emp.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Leave Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Leave Duration Type</label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/40 border border-border/60">
              <button
                type="button"
                onClick={() => setLeaveType('full_day')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer',
                  leaveType === 'full_day'
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Full Day
              </button>
              <button
                type="button"
                onClick={() => setLeaveType('half_day')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer',
                  leaveType === 'half_day'
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Half Day / Specific Time
              </button>
            </div>
          </div>

          {/* 3. Dates & Times */}
          {leaveType === 'full_day' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">
                    {isMultiDay ? 'Start Date *' : 'Leave Date *'}
                  </label>
                  <input
                    type="date"
                    min={currentKuwait.dateStr}
                    value={leaveDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLeaveDate(val);
                      if (endDate < val) setEndDate(val);
                    }}
                    required
                    className={cn(
                      "w-full h-10 rounded-xl border bg-card px-3 text-sm font-semibold outline-none focus:ring-2",
                      isLeaveDateInPast
                        ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-600"
                        : "border-border focus:border-primary focus:ring-primary/20"
                    )}
                  />
                  {isLeaveDateInPast && (
                    <p className="text-[11px] font-semibold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Leave date cannot be in the past.
                    </p>
                  )}
                </div>

                {isMultiDay && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">End Date *</label>
                    <input
                      type="date"
                      min={leaveDate && leaveDate > currentKuwait.dateStr ? leaveDate : currentKuwait.dateStr}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className={cn(
                        "w-full h-10 rounded-xl border bg-card px-3 text-sm font-semibold outline-none focus:ring-2",
                        isEndDateInPast
                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-600"
                          : "border-border focus:border-primary focus:ring-primary/20"
                      )}
                    />
                    {isEndDateInPast && (
                      <p className="text-[11px] font-semibold text-rose-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        End date cannot be in the past.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="multi-day-toggle"
                  checked={isMultiDay}
                  onChange={(e) => {
                    setIsMultiDay(e.target.checked);
                    if (e.target.checked && endDate < leaveDate) {
                      setEndDate(leaveDate);
                    }
                  }}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                />
                <label htmlFor="multi-day-toggle" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                  Multiple consecutive days (date range)
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Date *</label>
                <input
                  type="date"
                  min={currentKuwait.dateStr}
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  required
                  className={cn(
                    "w-full h-10 rounded-xl border bg-card px-3 text-sm font-semibold outline-none focus:ring-2",
                    isLeaveDateInPast
                      ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-600"
                      : "border-border focus:border-primary focus:ring-primary/20"
                  )}
                />
                {isLeaveDateInPast && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Leave date cannot be in the past.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Start Time *</label>
                  <input
                    type="time"
                    min={isToday ? currentKuwait.timeStr : undefined}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className={cn(
                      "w-full h-10 rounded-xl border bg-card px-3 text-sm font-semibold outline-none focus:ring-2",
                      isStartTimeInPast
                        ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-600"
                        : "border-border focus:border-primary focus:ring-primary/20"
                    )}
                  />
                  {isStartTimeInPast && (
                    <p className="text-[11px] font-semibold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Cannot be in the past (after {currentKuwait.timeStr}).
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">End Time *</label>
                  <input
                    type="time"
                    min={isToday ? (startTime || currentKuwait.timeStr) : (startTime || undefined)}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  {isTimeOrderInvalid && (
                    <p className="text-[11px] font-semibold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      End time must be after start time.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Reason with quick pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Reason & Notes</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer',
                    reason === r
                      ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Doctor appointment, annual family leave…"
              className="w-full rounded-xl border border-border bg-card p-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 5. Status selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Status</label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer select-none',
                  status === 'approved'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                )}
              >
                <input
                  type="radio"
                  name="leave-status"
                  value="approved"
                  checked={status === 'approved'}
                  onChange={() => setStatus('approved')}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-xs font-bold">Approved</p>
                  <p className="text-[10px] text-muted-foreground">Blocks schedule immediately</p>
                </div>
              </label>

              <label
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer select-none',
                  status === 'pending'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                )}
              >
                <input
                  type="radio"
                  name="leave-status"
                  value="pending"
                  checked={status === 'pending'}
                  onChange={() => setStatus('pending')}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="text-xs font-bold">Pending</p>
                  <p className="text-[10px] text-muted-foreground">Awaiting manager approval</p>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || hasPastError || isTimeOrderInvalid}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-orange-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Submit Leave</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
