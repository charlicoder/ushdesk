'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Phone, Mail, Building2, Briefcase,
  RefreshCw, AlertCircle, Search, ChevronDown,
  CalendarDays, Home, ShieldCheck, LayoutGrid, List,
  Eye, X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import {
  EmployeeDetailModal,
  type BranchInfo,
  type EmployeeDetailData,
} from '@/components/employees/EmployeeDetailModal';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  employee_code: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string | null;
  email: string | null;
  role_name: string;
  department_name: string;
  is_therapist: boolean;
  can_do_home_service: boolean;
  avatar: string | null;
  hire_date: string | null;
  status: string; // 'active' | 'inactive' | etc.
  branch_ids: string[];
  branches: BranchInfo[];
  raw: Record<string, unknown>;
}

// ── Normalise API response → Employee ─────────────────────────────────────────
function normalise(raw: Record<string, unknown>): Employee {
  const first = String(raw.first_name ?? '');
  const last  = String(raw.last_name  ?? '');

  let branchIds: string[] = [];
  const branchList: BranchInfo[] = [];

  // Parse branches from employee record
  if (Array.isArray(raw.branches)) {
    raw.branches.forEach((b) => {
      if (typeof b === 'object' && b !== null) {
        const bObj = b as Record<string, unknown>;
        const bId = String(bObj.id ?? bObj.branch_id ?? '');
        const bName = String(bObj.name ?? bObj.branch_name ?? bObj.title ?? bId);
        if (bId) {
          branchIds.push(bId);
          branchList.push({ id: bId, name: bName, city: (bObj.city ?? bObj.location ?? '') as string });
        }
      } else if (typeof b === 'string' || typeof b === 'number') {
        const bId = String(b);
        if (bId) {
          branchIds.push(bId);
          branchList.push({ id: bId, name: bId });
        }
      }
    });
  } else if (typeof raw.branch === 'object' && raw.branch !== null) {
    const bObj = raw.branch as Record<string, unknown>;
    const bId = String(bObj.id ?? bObj.branch_id ?? '');
    const bName = String(bObj.name ?? bObj.branch_name ?? bId);
    if (bId) {
      branchIds.push(bId);
      branchList.push({ id: bId, name: bName, city: (bObj.city ?? bObj.location ?? '') as string });
    }
  } else if (raw.branch_id) {
    branchIds = [String(raw.branch_id)];
  } else if (typeof raw.branch === 'string') {
    branchIds = [raw.branch];
  } else if (Array.isArray(raw.branch_ids)) {
    branchIds = raw.branch_ids.map(String);
  }

  return {
    id:                  String(raw.id ?? ''),
    employee_code:       String(raw.employee_code ?? raw.code ?? ''),
    name:                [first, last].filter(Boolean).join(' ') || String(raw.name ?? 'Unknown'),
    first_name:          first || undefined,
    last_name:           last  || undefined,
    phone:               (raw.phone_number ?? raw.phone ?? raw.mobile ?? null) as string | null,
    email:               (raw.email ?? null) as string | null,
    role_name:           String(raw.role_name ?? raw.role ?? raw.position ?? 'Staff'),
    department_name:     String(raw.department_name ?? raw.department ?? 'General'),
    is_therapist:        raw.is_therapist === true,
    can_do_home_service: raw.can_do_home_service === true,
    avatar:              (raw.avatar ?? raw.image ?? raw.photo ?? raw.profile_picture ?? null) as string | null,
    hire_date:           (raw.hire_date ?? raw.hired_at ?? null) as string | null,
    status:              String(raw.status ?? 'active').toLowerCase(),
    branch_ids:          branchIds,
    branches:            branchList,
    raw,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  'branch manager':   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'manager':          'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'therapist':        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'receptionist':     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'admin':            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'staff':            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function roleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? ROLE_COLORS['staff'];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Filter Select ──────────────────────────────────────────────────────────────
function SelectFilter({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex items-center">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground z-10" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 appearance-none rounded-xl border border-border bg-card pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground',
          Icon ? 'pl-9' : 'pl-3',
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const token = useAppSelector((s) => s.auth.token);
  const reduxBranches = useAppSelector((s) => s.data.branches);

  // API State
  const [rawEmployees,      setRawEmployees]      = useState<Record<string, unknown>[]>([]);
  const [responseBranches,  setResponseBranches]  = useState<BranchInfo[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [tick,              setTick]              = useState(0);

  // UI state
  const [search,           setSearch]           = useState('');
  const [roleFilter,       setRoleFilter]       = useState('');
  const [branchFilter,     setBranchFilter]     = useState('');
  const [homeOnly,         setHomeOnly]         = useState(false);
  const [viewMode,         setViewMode]         = useState<'grid' | 'list'>('grid');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Fetch /api/v1/employees and extract both employees and response-level `branches`
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    authedFetch('/api/v1/employees', { headers })
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
        const foundBranches: BranchInfo[] = [];
        const rawBranches = (json?.branches ?? json?.data?.branches) as unknown;
        if (Array.isArray(rawBranches)) {
          rawBranches.forEach((b) => {
            if (typeof b === 'object' && b !== null) {
              const bObj = b as Record<string, unknown>;
              const bId = String(bObj.id ?? bObj.branch_id ?? '');
              const bName = String(bObj.name ?? bObj.branch_name ?? bObj.title ?? bId);
              if (bId) foundBranches.push({ id: bId, name: bName, city: (bObj.city ?? bObj.location ?? '') as string });
            } else if (typeof b === 'string' || typeof b === 'number') {
              foundBranches.push({ id: String(b), name: String(b) });
            }
          });
        }
        setResponseBranches(foundBranches);

        // 2. Unwrap employee list
        let list: Record<string, unknown>[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (json?.success && Array.isArray(json?.data)) {
          list = json.data;
        } else if (json?.success && json?.data && typeof json.data === 'object') {
          const inner = json.data as Record<string, unknown>;
          list = (Array.isArray(inner.results)
            ? inner.results
            : Array.isArray(inner.employees)
            ? inner.employees
            : Object.values(inner)) as Record<string, unknown>[];
        } else if (Array.isArray(json?.results)) {
          list = json.results;
        } else if (Array.isArray(json?.data)) {
          list = json.data;
        } else if (Array.isArray(json?.employees)) {
          list = json.employees;
        }

        setRawEmployees(list);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn('[EmployeesPage] fetch error:', err.message);
        setError(err.message);
        setRawEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, tick]);

  const employees = useMemo(() => rawEmployees.map(normalise), [rawEmployees]);

  // Unified list of branches from response key `branches` + each employee item's branches
  const allBranches = useMemo(() => {
    const map = new Map<string, string>();

    // 1. From response key `branches`
    responseBranches.forEach((b) => {
      if (b.id) map.set(b.id, b.name);
    });

    // 2. From each employee's branch data
    employees.forEach((e) => {
      e.branches.forEach((b) => {
        if (b.id) map.set(b.id, b.name);
      });
    });

    // Fallback to redux branches only if API had no branch data at all
    if (map.size === 0 && reduxBranches.length > 0) {
      reduxBranches.forEach((b) => map.set(b.id, b.name));
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [responseBranches, employees, reduxBranches]);

  const branchMap = useMemo(() => {
    const m = new Map<string, string>();
    allBranches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [allBranches]);

  const branchOptions = useMemo(() =>
    allBranches.map((b) => ({ value: b.id, label: b.name })),
  [allBranches]);

  // Unique roles from real API keys
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.role_name) set.add(e.role_name);
    });
    return Array.from(set).sort().map((r) => ({ value: r, label: r }));
  }, [employees]);

  // Branch summary helper for card/table
  const getBranchSummary = (emp: Employee) => {
    if (emp.branches.length > 0) {
      if (emp.branches.length === 1) return emp.branches[0].name;
      return `${emp.branches.length} branches`;
    }
    if (emp.branch_ids.length > 0) {
      const names = emp.branch_ids.map((id) => branchMap.get(id)).filter(Boolean) as string[];
      if (names.length === 1) return names[0];
      if (names.length > 1) return `${names.length} branches`;
    }
    return 'All branches';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const branchNames = e.branch_ids.map((id) => branchMap.get(id) ?? '').join(' ').toLowerCase();
      const matchSearch = !q ||
        e.name.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        branchNames.includes(q);
      const matchRole   = !roleFilter   || e.role_name === roleFilter;
      const matchBranch = !branchFilter || e.branch_ids.length === 0 || e.branch_ids.includes(branchFilter);
      const matchHome   = !homeOnly     || e.can_do_home_service;
      return matchSearch && matchRole && matchBranch && matchHome;
    });
  }, [employees, search, roleFilter, branchFilter, homeOnly, branchMap]);

  const active   = employees.filter((e) => e.status === 'active').length;
  const hasFilter = Boolean(search || roleFilter || branchFilter || homeOnly);

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setBranchFilter('');
    setHomeOnly(false);
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Employees"
        subtitle={loading ? 'Loading…' : `${employees.length} employees · ${allBranches.length} branches`}
      />

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, code, branch…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-8 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Branch filter */}
        <SelectFilter
          icon={Building2}
          label="All Branches"
          value={branchFilter}
          options={branchOptions}
          onChange={setBranchFilter}
        />

        {/* Role filter */}
        <SelectFilter
          label="All Roles"
          value={roleFilter}
          options={roleOptions}
          onChange={setRoleFilter}
        />

        {/* Home service toggle */}
        <button
          onClick={() => setHomeOnly((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition cursor-pointer',
            homeOnly
              ? 'border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300 shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:border-sky-400/40 hover:text-sky-600',
          )}
        >
          <Home className="h-4 w-4" />
          Home Service
          {homeOnly && <X className="h-3 w-3 ml-0.5 opacity-70" />}
        </button>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="h-10 rounded-xl border border-border bg-card px-3.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition cursor-pointer"
          >
            Clear filters
          </button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex rounded-xl border border-border bg-card p-0.5 gap-0.5">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer',
                viewMode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-muted-foreground',
              )}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}
              title={m === 'grid' ? 'Grid view' : 'List view'}
            >
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="mb-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">
            {employees.length} Total
          </span>
          <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-3 py-1 font-semibold">
            {active} Active
          </span>
          {hasFilter && (
            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 font-semibold">
              {filtered.length} Showing
            </span>
          )}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-60 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-xs mt-1 opacity-70">Try adjusting your filters</p>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* Cards — GRID VIEW */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployee(emp)}
              className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 cursor-pointer animate-fade-in-up"
            >
              {/* Status dot */}
              <span className={cn(
                'absolute right-4 top-4 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                emp.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground/30',
              )} title={emp.status} />

              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                {emp.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emp.avatar}
                    alt={emp.name}
                    className="h-14 w-14 rounded-2xl object-cover shrink-0 ring-2 ring-border/50 group-hover:ring-primary/40 transition"
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shrink-0 shadow-sm">
                    {initials(emp.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
                    {emp.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    {emp.employee_code}
                  </p>
                  {/* Role badge */}
                  <span className={cn(
                    'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    roleColor(emp.role_name),
                  )}>
                    {emp.role_name}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                  <span className="truncate">{emp.department_name}</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                  <span className="truncate">{getBranchSummary(emp)}</span>
                </p>
                {emp.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                    <span className="truncate">{emp.phone}</span>
                  </p>
                )}
                {emp.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                    <span className="truncate">{emp.email}</span>
                  </p>
                )}
              </div>

              {/* Capability tags + Details button */}
              <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {emp.is_therapist && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" /> Therapist
                    </span>
                  )}
                  {emp.can_do_home_service && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                      <Home className="h-3 w-3 text-sky-500" /> Home
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEmployee(emp);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-muted/60 hover:bg-primary hover:text-primary-foreground text-foreground px-2.5 py-1 text-[11px] font-semibold transition ml-auto"
                >
                  <Eye className="h-3 w-3" />
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Capabilities</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp)}
                  className={cn(
                    'border-b border-border/30 transition hover:bg-muted/30 cursor-pointer',
                    i % 2 !== 0 && 'bg-muted/10'
                  )}
                >
                  {/* Name + code */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.avatar} alt={emp.name} className="h-9 w-9 rounded-xl object-cover shrink-0 ring-1 ring-border/50" />
                      ) : (
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                          {initials(emp.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm leading-tight text-foreground">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{emp.employee_code}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', roleColor(emp.role_name))}>
                      {emp.role_name}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" /> {emp.department_name}
                    </span>
                  </td>

                  {/* Branch */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {getBranchSummary(emp)}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {emp.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</p>}
                      {emp.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</p>}
                    </div>
                  </td>

                  {/* Capabilities */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex justify-center flex-wrap gap-1">
                      {emp.is_therapist && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Therapist
                        </span>
                      )}
                      {emp.can_do_home_service && (
                        <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          <Home className="h-3 w-3" /> Home
                        </span>
                      )}
                      {!emp.is_therapist && !emp.can_do_home_service && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                      emp.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', emp.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                      {emp.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployee(emp);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Employee Details Popup Modal ── */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employeeId={selectedEmployee.id}
          initialEmployee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </DashboardShell>
  );
}
