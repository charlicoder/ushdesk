'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Clock, Search, Building2, UserCheck, CalendarDays,
  RefreshCw, AlertCircle, ChevronDown, X, Coffee,
  LayoutGrid, List, CheckCircle2, ShieldAlert,
  Calendar, Layers, Sparkles, Filter, Check, Eye,
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
  effective_from: string;
  effective_to: string;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
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

// ── Fallback Demo Schedules ───────────────────────────────────────────────────
const FALLBACK_SCHEDULES: WorkingHoursRecord[] = [
  // Sarah Connor
  {
    id: 'wh-1',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 0,
    day_name: 'Monday',
    is_weekend_off: false,
    start_time: '09:00:00',
    end_time: '17:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-2',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 1,
    day_name: 'Tuesday',
    is_weekend_off: false,
    start_time: '09:00:00',
    end_time: '17:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-3',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 2,
    day_name: 'Wednesday',
    is_weekend_off: false,
    start_time: '09:00:00',
    end_time: '17:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-4',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 3,
    day_name: 'Thursday',
    is_weekend_off: false,
    start_time: '09:00:00',
    end_time: '17:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-5',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 4,
    day_name: 'Friday',
    is_weekend_off: true,
    start_time: '00:00:00',
    end_time: '00:00:00',
    break_duration: 0,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-6',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 5,
    day_name: 'Saturday',
    is_weekend_off: false,
    start_time: '10:00:00',
    end_time: '18:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-7',
    therapist_id: 'th-101',
    employee_id: 'emp-201',
    employee_code: 'TH001',
    first_name: 'Sarah',
    last_name: 'Connor',
    therapist_name: 'Sarah Connor',
    branch_id: 'br-salmiya',
    branch_name: 'Salmiya Spa',
    day_of_week: 6,
    day_name: 'Sunday',
    is_weekend_off: true,
    start_time: '00:00:00',
    end_time: '00:00:00',
    break_duration: 0,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },

  // Elena Rostova
  {
    id: 'wh-8',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 0,
    day_name: 'Monday',
    is_weekend_off: false,
    start_time: '12:00:00',
    end_time: '20:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-9',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 1,
    day_name: 'Tuesday',
    is_weekend_off: false,
    start_time: '12:00:00',
    end_time: '20:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-10',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 2,
    day_name: 'Wednesday',
    is_weekend_off: true,
    start_time: '00:00:00',
    end_time: '00:00:00',
    break_duration: 0,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-11',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 3,
    day_name: 'Thursday',
    is_weekend_off: false,
    start_time: '12:00:00',
    end_time: '20:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-12',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 4,
    day_name: 'Friday',
    is_weekend_off: false,
    start_time: '14:00:00',
    end_time: '22:00:00',
    break_duration: 45,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-13',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 5,
    day_name: 'Saturday',
    is_weekend_off: false,
    start_time: '10:00:00',
    end_time: '18:00:00',
    break_duration: 60,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
  {
    id: 'wh-14',
    therapist_id: 'th-102',
    employee_id: 'emp-202',
    employee_code: 'TH002',
    first_name: 'Elena',
    last_name: 'Rostova',
    therapist_name: 'Elena Rostova',
    branch_id: 'br-downtown',
    branch_name: 'Downtown Wellness Club',
    day_of_week: 6,
    day_name: 'Sunday',
    is_weekend_off: true,
    start_time: '00:00:00',
    end_time: '00:00:00',
    break_duration: 0,
    effective_from: '2024-01-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kuwait',
  },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function WorkingHoursPage() {
  const token = useAppSelector((s) => s.auth.token);

  // Data states
  const [schedules,        setSchedules]        = useState<WorkingHoursRecord[]>(FALLBACK_SCHEDULES);
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

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Fetch from /uauth/api/v1/therapists/working-hours/
  useEffect(() => {
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

        setSchedules(list.length > 0 ? list : FALLBACK_SCHEDULES);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn('[WorkingHoursPage] fetch error:', err.message);
        setError(err.message);
        setSchedules(FALLBACK_SCHEDULES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, tick, search, branchFilter, dayFilter, statusFilter, weekendOffFilter]);

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
          {groupedByTherapist.map((tGroup) => (
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
                      onClick={() => shift && setSelectedRecord(shift)}
                      className={cn(
                        'flex flex-col rounded-2xl p-3 border transition text-xs',
                        isOff
                          ? 'bg-muted/15 border-border/40 text-muted-foreground/80 opacity-75'
                          : 'bg-muted/40 border-border/60 hover:border-primary/50 hover:bg-muted/60 cursor-pointer shadow-xs'
                      )}
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
                              <span className="inline-flex items-center gap-0.5" title={`${shift.break_duration} min break`}>
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
        </div>
      )}

      {/* ── VIEW 2: SHIFT ROSTER LIST TABLE ── */}
      {!loading && filteredSchedules.length > 0 && viewMode === 'list' && (
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
              {filteredSchedules.map((item, idx) => {
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
                          <Coffee className="h-3 w-3" />
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
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SHIFT DETAIL POPUP MODAL ── */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRecord(null);
          }}
        >
          <div className="relative flex flex-col w-full max-w-lg rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-br from-primary/25 via-slate-900 to-slate-950 border-b border-border/50 text-white shrink-0">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  <Clock className="h-3 w-3 text-primary" />
                  Shift Schedule Detail
                </span>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/70 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shadow-lg shrink-0">
                  {initials(selectedRecord.therapist_name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-white truncate">
                    {selectedRecord.therapist_name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
                    <span className="font-mono bg-black/40 border border-white/15 px-2 py-0.5 rounded-full">
                      {selectedRecord.employee_code}
                    </span>
                    <span>•</span>
                    <span>{selectedRecord.branch_name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              {/* Day & Hours Card */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Day of Week</span>
                  <span className="text-base font-black text-foreground">
                    {DAY_INDEX_MAP[selectedRecord.day_of_week]?.label ?? selectedRecord.day_name}
                  </span>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duty Status</span>
                  {selectedRecord.is_weekend_off ? (
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
              </div>

              {/* Working Hours Grid */}
              {!selectedRecord.is_weekend_off && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shift Start</span>
                    <span className="mt-1 font-mono text-base font-bold text-foreground">
                      {formatTime12(selectedRecord.start_time)}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shift End</span>
                    <span className="mt-1 font-mono text-base font-bold text-foreground">
                      {formatTime12(selectedRecord.end_time)}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Break Time</span>
                    <span className="mt-1 text-sm font-bold text-foreground flex items-center gap-1">
                      <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedRecord.break_duration} minutes
                    </span>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Working Hours</span>
                    <span className="mt-1 text-sm font-bold text-primary flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {calcShiftHours(selectedRecord.start_time, selectedRecord.end_time, selectedRecord.break_duration)} hours
                    </span>
                  </div>
                </div>
              )}

              {/* Validity & Timezone */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-semibold text-foreground">{selectedRecord.branch_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Effective Date Range:</span>
                  <span className="font-semibold text-foreground">
                    {selectedRecord.effective_from} → {selectedRecord.effective_to}
                  </span>
                </div>
                {selectedRecord.timezone && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Timezone:</span>
                    <span className="font-mono text-foreground">{selectedRecord.timezone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border/60 bg-card px-6 py-4">
              <button
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl border border-border bg-muted/60 px-5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
