'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ, isLeaveInPast } from '@/lib/datetime';
import { useMemo, useState, useEffect } from 'react';
import {
  CalendarOff, Search, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle2, Clock, XCircle, LayoutGrid, List,
  Calendar, UserCheck, Briefcase, Phone, Mail, Plus,
  Trash2, X, Loader2,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api-list';
import { authedFetch } from '@/lib/authedFetch';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader, PageHeaderButton } from '@/components/dashboard/page-header';
import { AddLeaveModal } from '@/components/employees/AddLeaveModal';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeaveEmployee {
  id: string;
  employee_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  department_name: string;
  role_name: string;
  avatar: string | null;
}

interface LeaveRecord {
  id: string;
  employee: LeaveEmployee;
  leave_type: string;
  leave_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  status: string;
  approved_by: string | null;
  created_at: string;
}

// ── Normalise API response ─────────────────────────────────────────────────────
function normalise(raw: Record<string, unknown>): LeaveRecord {
  const emp = (raw.employee ?? {}) as Record<string, unknown>;
  const first = String(emp.first_name ?? '');
  const last  = String(emp.last_name ?? '');

  return {
    id: String(raw.id ?? ''),
    employee: {
      id:              String(emp.id ?? raw.employee_id ?? ''),
      employee_code:   String(emp.employee_code ?? ''),
      name:            [first, last].filter(Boolean).join(' ') || String(emp.name ?? 'Unknown Employee'),
      phone:           (emp.phone_number ?? emp.phone ?? null) as string | null,
      email:           (emp.email ?? null) as string | null,
      department_name: String(emp.department_name ?? 'General'),
      role_name:       String(emp.role_name ?? 'Staff'),
      avatar:          (emp.avatar ?? null) as string | null,
    },
    leave_type:  String(raw.leave_type ?? 'full_day').toLowerCase(),
    leave_date:  String(raw.leave_date ?? ''),
    end_date:    (raw.end_date ?? null) as string | null,
    start_time:  (raw.start_time ?? null) as string | null,
    end_time:    (raw.end_time ?? null) as string | null,
    reason:      String(raw.reason ?? 'Personal leave'),
    status:      String(raw.status ?? 'pending').toLowerCase(),
    approved_by: (raw.approved_by ?? null) as string | null,
    created_at:  String(raw.created_at ?? ''),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, month: 'short', day: 'numeric', year: 'numeric' });
}

function calculateDays(startDate: string, endDate: string | null, type: string) {
  if (type === 'half_day') return '0.5 day';
  if (type === 'hours') return 'Hourly';
  if (!endDate || startDate === endDate) return '1 day';

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return `${diffDays} days`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const STATUS_CONFIG: Record<string, { label: string; badgeCls: string; icon: React.ElementType }> = {
  approved: {
    label: 'Approved',
    badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-500/20',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Pending',
    badgeCls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-500/20',
    icon: Clock,
  },
  rejected: {
    label: 'Rejected',
    badgeCls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-500/20',
    icon: XCircle,
  },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  full_day: 'Full Day',
  half_day: 'Half Day',
  hours:    'Hourly',
  annual:   'Annual Leave',
  sick:     'Sick Leave',
  unpaid:   'Unpaid Leave',
};

// ── Subcomponents ──────────────────────────────────────────────────────────────
function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── Cancel Leave Modal ─────────────────────────────────────────────────────────
function CancelLeaveModal({
  leave,
  onClose,
  onSuccess,
}: {
  leave: LeaveRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPast = isLeaveInPast(leave);

  const handleConfirm = async () => {
    if (isPast) {
      setError('Cannot cancel a leave whose date and time has already passed.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authedFetch(`/uauth/api/v1/employees/leaves/${leave.id}/`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || j.message || 'Failed to cancel leave request.');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancelling leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Cancel Leave</h3>
              <p className="text-xs text-muted-foreground">Confirm cancellation of leave record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Leave details summary */}
        <div className="rounded-2xl bg-muted/40 p-4 space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Employee:</span>
            <span className="font-bold text-foreground">{leave.employee.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Code:</span>
            <span className="font-mono text-muted-foreground">{leave.employee.employee_code}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Leave Type:</span>
            <span className="font-semibold text-primary">
              {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Dates:</span>
            <span className="font-bold text-foreground">
              {formatDate(leave.leave_date)}
              {leave.end_date && leave.end_date !== leave.leave_date && ` – ${formatDate(leave.end_date)}`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-semibold text-foreground">
              {calculateDays(leave.leave_date, leave.end_date, leave.leave_type)}
            </span>
          </div>
          {leave.reason && (
            <div className="pt-2 border-t border-border/40">
              <span className="text-muted-foreground block mb-0.5">Reason:</span>
              <p className="text-foreground/90 italic">{leave.reason}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 text-xs text-rose-900 dark:text-rose-200">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            Are you sure you want to cancel this leave?
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            This will delete the leave record and restore the employee&apos;s regular working schedule.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
          >
            Keep Leave
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || isPast}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Cancelling…</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Yes, Cancel Leave</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────────
export default function EmployeeLeavesPage() {
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [typeFilter,    setTypeFilter]    = useState('');
  const [deptFilter,    setDeptFilter]    = useState('');
  const [viewMode,      setViewMode]      = useState<'list' | 'grid'>('list');
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [leaveToCancel, setLeaveToCancel] = useState<LeaveRecord | null>(null);

  const { data: rawLeaves, loading, error, refetch } = useApiList<Record<string, unknown>>(
    '/api/v1/employees/leaves',
    [],
  );

  const leaves = useMemo(() => rawLeaves.map(normalise), [rawLeaves]);

  // Derived unique filter options
  const departments = useMemo(() => {
    const set = new Set(leaves.map((l) => l.employee.department_name).filter(Boolean));
    return Array.from(set).sort().map((d) => ({ label: d, value: d }));
  }, [leaves]);

  const leaveTypes = useMemo(() => {
    const set = new Set(leaves.map((l) => l.leave_type).filter(Boolean));
    return Array.from(set).sort().map((t) => ({
      label: LEAVE_TYPE_LABELS[t] || t.replace('_', ' ').toUpperCase(),
      value: t,
    }));
  }, [leaves]);

  const statuses = [
    { label: 'Approved', value: 'approved' },
    { label: 'Pending',  value: 'pending' },
    { label: 'Rejected', value: 'rejected' },
  ];

  // Filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leaves.filter((l) => {
      const matchSearch =
        !q ||
        l.employee.name.toLowerCase().includes(q) ||
        l.employee.employee_code.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q) ||
        l.employee.email?.toLowerCase().includes(q);

      const matchStatus = !statusFilter || l.status === statusFilter;
      const matchType   = !typeFilter   || l.leave_type === typeFilter;
      const matchDept   = !deptFilter   || l.employee.department_name === deptFilter;

      return matchSearch && matchStatus && matchType && matchDept;
    });
  }, [leaves, search, statusFilter, typeFilter, deptFilter]);

  // KPIs
  const totalCount    = leaves.length;
  const approvedCount = leaves.filter((l) => l.status === 'approved').length;
  const pendingCount  = leaves.filter((l) => l.status === 'pending').length;
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;

  const hasFilter = search || statusFilter || typeFilter || deptFilter;
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setDeptFilter('');
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Employee Leaves"
        subtitle={loading ? 'Loading…' : `${leaves.length} total leave records`}
      >
        <PageHeaderButton onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" /> Add Leave
        </PageHeaderButton>
      </PageHeader>

      {/* Error banner */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Requests',
            count: totalCount,
            icon: CalendarOff,
            cls: 'text-foreground',
            grad: 'from-slate-500 to-slate-700',
          },
          {
            label: 'Approved',
            count: approvedCount,
            icon: CheckCircle2,
            cls: 'text-emerald-600 dark:text-emerald-400',
            grad: 'from-emerald-500 to-teal-600',
          },
          {
            label: 'Pending Review',
            count: pendingCount,
            icon: Clock,
            cls: 'text-amber-600 dark:text-amber-400',
            grad: 'from-amber-500 to-orange-600',
          },
          {
            label: 'Rejected',
            count: rejectedCount,
            icon: XCircle,
            cls: 'text-rose-600 dark:text-rose-400',
            grad: 'from-rose-500 to-pink-600',
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight">{k.count}</p>
                </div>
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', k.grad)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className={cn('absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br opacity-10', k.grad)} />
            </div>
          );
        })}
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, code, reason…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <SelectFilter label="All Statuses"    value={statusFilter} options={statuses}    onChange={setStatusFilter} />
        <SelectFilter label="All Leave Types" value={typeFilter}   options={leaveTypes}  onChange={setTypeFilter} />
        {departments.length > 0 && (
          <SelectFilter label="All Departments" value={deptFilter} options={departments} onChange={setDeptFilter} />
        )}

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition"
          >
            Clear filters
          </button>
        )}

        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>

        {/* View mode toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['list', 'grid'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'flex h-10 w-10 items-center justify-center transition',
                viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground',
              )}
              aria-label={m === 'list' ? 'List view' : 'Grid view'}
            >
              {m === 'list' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton loader */}
      {loading && (
        <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('rounded-2xl shimmer', viewMode === 'grid' ? 'h-52' : 'h-16')} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CalendarOff className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No leave requests found</p>
          <p className="text-xs mt-1 opacity-70">Try adjusting your filters</p>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm scrollbar-thin">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Leave Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Duration & Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Approved By</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((leave, i) => {
                const statusCfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;

                return (
                  <tr
                    key={leave.id}
                    className={cn('border-b border-border/30 transition hover:bg-muted/30', i % 2 !== 0 && 'bg-muted/10')}
                  >
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {leave.employee.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={leave.employee.avatar}
                            alt={leave.employee.name}
                            className="h-10 w-10 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-sm font-bold text-white shadow-xs">
                            {initials(leave.employee.name)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-sm leading-tight text-foreground">{leave.employee.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{leave.employee.employee_code}</p>
                          <span className="inline-block sm:hidden text-[10px] font-semibold text-primary mt-0.5">
                            {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Leave Type */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                        {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                      </span>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-foreground font-medium space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatDate(leave.leave_date)}</span>
                          {leave.end_date && leave.end_date !== leave.leave_date && (
                            <span>– {formatDate(leave.end_date)}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {calculateDays(leave.leave_date, leave.end_date, leave.leave_type)}
                          {leave.start_time && leave.end_time && ` (${leave.start_time} - ${leave.end_time})`}
                        </span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3 hidden md:table-cell max-w-[220px]">
                      <p className="text-xs text-foreground/90 truncate font-medium">{leave.reason}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Requested {formatDate(leave.created_at)}</p>
                    </td>

                    {/* Approved By */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-muted-foreground">
                        {leave.approved_by ? (
                          <span className="flex items-center gap-1 text-foreground font-medium">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{leave.approved_by}</span>
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground/60">Awaiting review</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', statusCfg.badgeCls)}>
                        <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!isLeaveInPast(leave) ? (
                        <button
                          type="button"
                          onClick={() => setLeaveToCancel(leave)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 hover:border-rose-500/30 transition cursor-pointer"
                          title="Cancel Leave"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((leave) => {
            const statusCfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;

            return (
              <div
                key={leave.id}
                className="group relative rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:shadow-md hover:border-primary/40 animate-fade-in-up flex flex-col justify-between"
              >
                <div>
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-block rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                      {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold', statusCfg.badgeCls)}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Employee Info */}
                  <div className="flex items-center gap-3 mb-4">
                    {leave.employee.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={leave.employee.avatar}
                        alt={leave.employee.name}
                        className="h-12 w-12 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-sm font-bold text-white shadow-xs">
                        {initials(leave.employee.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm leading-tight text-foreground truncate">{leave.employee.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{leave.employee.employee_code}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{leave.employee.department_name} · {leave.employee.role_name}</p>
                    </div>
                  </div>

                  {/* Leave Date Range */}
                  <div className="mb-3 rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(leave.leave_date)}
                        {leave.end_date && leave.end_date !== leave.leave_date && (
                          <span> – {formatDate(leave.end_date)}</span>
                        )}
                      </span>
                      <span className="text-[11px] font-bold text-primary">
                        {calculateDays(leave.leave_date, leave.end_date, leave.leave_type)}
                      </span>
                    </div>
                    {leave.start_time && leave.end_time && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Time: {leave.start_time} – {leave.end_time}
                      </p>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-foreground/90 font-medium mb-3 line-clamp-2">
                    <span className="font-bold text-muted-foreground">Reason: </span>
                    {leave.reason}
                  </p>
                </div>

                {/* Footer Info & Cancel Action */}
                <div className="border-t border-border/40 pt-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground space-y-0.5 min-w-0">
                    {leave.approved_by && (
                      <p className="flex items-center gap-1 truncate text-foreground font-medium">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        Approved by: {leave.approved_by}
                      </p>
                    )}
                    <p>Requested: {formatDate(leave.created_at)}</p>
                  </div>
                  {!isLeaveInPast(leave) && (
                    <button
                      type="button"
                      onClick={() => setLeaveToCancel(leave)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 transition cursor-pointer shrink-0"
                      title="Cancel Leave"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddLeaveModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            refetch();
          }}
          fallbackEmployees={Array.from(
            new Map(
              leaves
                .filter((l) => l.employee?.id)
                .map((l) => [
                  l.employee.id,
                  {
                    id: l.employee.id,
                    name: l.employee.name,
                    employee_code: l.employee.employee_code,
                    role_name: l.employee.role_name,
                    department_name: l.employee.department_name,
                    avatar: l.employee.avatar,
                  },
                ])
            ).values()
          )}
        />
      )}

      {leaveToCancel && (
        <CancelLeaveModal
          leave={leaveToCancel}
          onClose={() => setLeaveToCancel(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </DashboardShell>
  );
}
