'use client';

import { useMemo, useState } from 'react';
import {
  UserCheck, Phone, Mail, Building2, Briefcase,
  RefreshCw, AlertCircle, Search, ChevronDown,
  CalendarDays, Home, ShieldCheck, LayoutGrid, List,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api-list';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  employee_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  role_name: string;
  department_name: string;
  is_therapist: boolean;
  can_do_home_service: boolean;
  avatar: string | null;
  hire_date: string | null;
  status: string; // 'active' | 'inactive' | etc.
}

// ── Normalise API response → Employee ─────────────────────────────────────────
function normalise(raw: Record<string, unknown>): Employee {
  const first = String(raw.first_name ?? '');
  const last  = String(raw.last_name  ?? '');
  return {
    id:                  String(raw.id ?? ''),
    employee_code:       String(raw.employee_code ?? raw.code ?? ''),
    name:                [first, last].filter(Boolean).join(' ') || String(raw.name ?? 'Unknown'),
    phone:               (raw.phone_number ?? raw.phone ?? null) as string | null,
    email:               (raw.email ?? null) as string | null,
    role_name:           String(raw.role_name ?? raw.role ?? raw.position ?? 'Staff'),
    department_name:     String(raw.department_name ?? raw.department ?? 'General'),
    is_therapist:        raw.is_therapist === true,
    can_do_home_service: raw.can_do_home_service === true,
    avatar:              (raw.avatar ?? raw.image ?? null) as string | null,
    hire_date:           (raw.hire_date ?? null) as string | null,
    status:              String(raw.status ?? 'active').toLowerCase(),
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
function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const [search,         setSearch]         = useState('');
  const [roleFilter,     setRoleFilter]     = useState('');
  const [homeOnly,       setHomeOnly]       = useState(false);
  const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid');

  const { data: rawEmployees, loading, error, refetch } = useApiList<Record<string, unknown>>(
    '/api/v1/employees',
    [],
  );

  const employees = useMemo(() => rawEmployees.map(normalise), [rawEmployees]);

  // Unique roles from real API keys
  const roles = useMemo(
    () => employees.map((e) => e.role_name).filter((v, i, a) => a.indexOf(v) === i).sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.phone?.includes(q) || e.employee_code.toLowerCase().includes(q);
      const matchRole   = !roleFilter || e.role_name === roleFilter;
      const matchHome   = !homeOnly  || e.can_do_home_service;
      return matchSearch && matchRole && matchHome;
    });
  }, [employees, search, roleFilter, homeOnly]);

  const active   = employees.filter((e) => e.status === 'active').length;
  const hasFilter = search || roleFilter || homeOnly;

  return (
    <DashboardShell>
      <PageHeader
        title="Employees"
        subtitle={loading ? 'Loading…' : `${employees.length} employees`}
      />

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, code…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <SelectFilter label="All Roles" value={roleFilter} options={roles} onChange={setRoleFilter} />

        {/* Home service toggle */}
        <button
          onClick={() => setHomeOnly((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
            homeOnly
              ? 'border-sky-400 bg-sky-500 text-white shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:border-sky-400 hover:text-sky-600',
          )}
        >
          <Home className="h-4 w-4" />
          Home Service
        </button>

        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setHomeOnly(false); }}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition"
          >
            Clear filters
          </button>
        )}

        {/* View toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'flex h-10 w-10 items-center justify-center transition',
                viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground',
              )}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}
            >
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { label: 'Total',    count: employees.length, cls: 'bg-muted text-muted-foreground' },
            { label: 'Active',   count: active,           cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
            { label: 'Showing',  count: filtered.length,  cls: 'bg-primary/10 text-primary' },
          ].map(({ label, count, cls }) => (
            <span key={label} className={cn('rounded-full px-3 py-1 text-xs font-semibold', cls)}>
              {count} {label}
            </span>
          ))}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-60 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-xs mt-1 opacity-70">Try adjusting your filters</p>
        </div>
      )}

      {/* Cards — GRID VIEW */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((emp) => (
            <div
              key={emp.id}
              className="group relative rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up"
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
                  <img src={emp.avatar} alt={emp.name} className="h-14 w-14 rounded-2xl object-cover shrink-0" />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white shrink-0">
                    {initials(emp.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-bold text-sm leading-tight">{emp.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{emp.employee_code}</p>
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
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span className="truncate">{emp.department_name}</span>
                </p>
                {emp.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="truncate">{emp.phone}</span>
                  </p>
                )}
                {emp.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </p>
                )}
                {emp.hire_date && (
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    <span>Hired {formatDate(emp.hire_date)}</span>
                  </p>
                )}
              </div>

              {/* Capability tags */}
              {(emp.is_therapist || emp.can_do_home_service) && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
                  {emp.is_therapist && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" /> Therapist
                    </span>
                  )}
                  {emp.can_do_home_service && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                      <Home className="h-3 w-3" /> Home Service
                    </span>
                  )}
                </div>
              )}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Hire Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Capabilities</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr key={emp.id} className={cn('border-b border-border/30 transition hover:bg-muted/30', i % 2 !== 0 && 'bg-muted/10')}>

                  {/* Name + code */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {emp.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.avatar} alt={emp.name} className="h-9 w-9 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                          {initials(emp.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm leading-tight">{emp.name}</p>
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

                  {/* Contact */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {emp.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</p>}
                      {emp.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</p>}
                    </div>
                  </td>

                  {/* Hire date */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {emp.hire_date
                      ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" /> {formatDate(emp.hire_date)}</span>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </td>

                  {/* Capabilities */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex justify-center flex-wrap gap-1">
                      {emp.is_therapist && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Therapist
                        </span>
                      )}
                      {emp.can_do_home_service && (
                        <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
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
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', emp.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
