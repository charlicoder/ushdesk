'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { useEffect, useState } from 'react';
import {
  X, Phone, Mail, Building2, Briefcase, CalendarDays,
  Home, ShieldCheck, AlertCircle, RefreshCw,
  MapPin, Clock, Copy, Check, Sparkles, HeartHandshake,
  FileText, TrendingUp, BarChart3, DollarSign, Users,
  Award, Activity, CheckCircle2, XCircle, ArrowUpRight,
  PieChart, Calendar, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';

export interface BranchInfo {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
}

export interface EmployeeDetailData {
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
  status: string;
  gender?: string | null;
  nationality?: string | null;
  national_id?: string | null;
  dob?: string | null;
  employment_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  branches?: BranchInfo[];
  branch_ids?: string[];
  services?: Array<{ id: string; name: string; category?: string }>;
  working_hours?: Array<{ day: string; start_time?: string; end_time?: string; is_working?: boolean }>;
  notes?: string | null;
  raw?: Record<string, unknown>;
}

// ── Therapist Analytics Interfaces ──────────────────────────────────────────

export interface TopServiceItem {
  service_id?: string;
  service_name: string;
  booking_count: number;
  total_hours: number;
  total_revenue: number;
  share_pct: number;
}

export interface BranchPerformanceItem {
  branch_id?: string;
  branch_name: string;
  booking_count: number;
  total_revenue: number;
}

export interface DayDistributionItem {
  day: string;
  booking_count: number;
  revenue: number;
}

export interface TimeSlotItem {
  slot: string;
  booking_count: number;
  percentage: number;
}

export interface TopClientItem {
  customer_id?: string;
  customer_name: string;
  customer_phone?: string | null;
  visit_count: number;
  total_spent: number;
  last_visit?: string | null;
}

export interface MonthlyTrendItem {
  month: string;
  booking_count: number;
  completed_count: number;
  revenue: number;
}

export interface TherapistBookingItem {
  id: string;
  booking_number?: string | null;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  service_name?: string | null;
  branch_name?: string | null;
  appointment_date?: string | null;
  appointment_start?: string | null;
  duration_minutes: number;
  extra_minutes: number;
  total_amount: number;
  status: string;
  payment_status: string;
  booking_type?: string | null;
}

export interface TherapistAnalytics {
  success: boolean;
  therapist_id: string;
  therapist_name?: string | null;
  employee?: any;
  sales: {
    total_bookings: number;
    completed_bookings: number;
    upcoming_bookings: number;
    in_progress_bookings: number;
    cancelled_bookings: number;
    no_show_bookings: number;
    completion_rate_pct: number;
    cancellation_rate_pct: number;
    no_show_rate_pct: number;
    gross_sales: number;
    completed_sales: number;
    discount_total: number;
    net_sales: number;
    average_booking_value: number;
    currency: string;
    monthly_trends: MonthlyTrendItem[];
  };
  marketing: {
    total_unique_clients: number;
    repeat_clients_count: number;
    repeat_client_rate_pct: number;
    single_visit_clients: number;
    top_services: TopServiceItem[];
    top_branches: BranchPerformanceItem[];
    client_time_preferences: TimeSlotItem[];
    home_service_count: number;
    spa_branch_count: number;
    top_clients: TopClientItem[];
  };
  financials: {
    total_gross_revenue: number;
    completed_revenue: number;
    pending_revenue: number;
    addon_revenue: number;
    extra_minutes_revenue: number;
    refunded_amount: number;
    net_revenue: number;
    estimated_commission: number;
    commission_rate_pct: number;
    avg_revenue_per_hour: number;
    currency: string;
    total_transactions: number;
  };
  performance: {
    total_treatment_hours: number;
    total_treatment_minutes: number;
    extra_treatment_minutes: number;
    addons_treatment_minutes: number;
    average_service_duration_minutes: number;
    completion_rate_pct: number;
    reliability_score_pct: number;
    busiest_day?: string | null;
    busiest_time_slot?: string | null;
    day_distribution: DayDistributionItem[];
    first_appointment_date?: string | null;
    latest_appointment_date?: string | null;
  };
  recent_bookings: TherapistBookingItem[];
}

interface Props {
  employeeId: string;
  initialEmployee?: Partial<EmployeeDetailData> | null;
  onClose: () => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'branch manager': { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/25' },
  'manager':        { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/25' },
  'therapist':      { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/25' },
  'receptionist':   { bg: 'bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/25' },
  'admin':          { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/25' },
  'staff':          { bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/25' },
};

function getRoleStyle(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? ROLE_COLORS['staff'];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function formatDate(date: string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-US', {
    timeZone: KUWAIT_TZ,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TabKey = 'overview' | 'sales' | 'marketing' | 'financials' | 'performance';

export function EmployeeDetailModal({ employeeId, initialEmployee, onClose }: Props) {
  const token = useAppSelector((s) => s.auth.token);

  const [detail, setDetail]   = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState(false);

  // Analytics states
  const [analytics, setAnalytics] = useState<TherapistAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Check if employee is therapist
  const isTherapistRole = Boolean(
    initialEmployee?.is_therapist ||
    detail?.is_therapist ||
    (initialEmployee?.role_name && initialEmployee.role_name.toLowerCase().includes('therapist')) ||
    (detail?.role_name && detail.role_name.toLowerCase().includes('therapist'))
  );

  // Fetch from unified endpoint /api/v1/therapists/<id>/analytics or uauth
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // 1. Fetch employee details from /uauth/api/v1/employees/<employee_id>/
      const empRes = await authedFetch(`/uauth/api/v1/employees/${employeeId}/`, { headers });
      const empJson = await empRes.json().catch(() => ({}));

      if (!empRes.ok) {
        throw new Error(
          (empJson as Record<string, string>)?.detail ??
          (empJson as Record<string, string>)?.message ??
          `Failed to load employee details (${empRes.status})`
        );
      }

      const raw = ((empJson?.data ?? empJson?.employee ?? empJson) as Record<string, unknown>);

      // Extract branch list
      const branchList: BranchInfo[] = [];
      if (Array.isArray(raw.branches)) {
        raw.branches.forEach((b) => {
          if (typeof b === 'object' && b !== null) {
            const bObj = b as Record<string, unknown>;
            branchList.push({
              id:      String(bObj.id ?? bObj.branch_id ?? ''),
              name:    String(bObj.name ?? bObj.branch_name ?? 'Branch'),
              city:    (bObj.city ?? bObj.location ?? '') as string,
              address: (bObj.address ?? '') as string,
              phone:   (bObj.phone ?? bObj.phone_number ?? '') as string,
            });
          } else if (typeof b === 'string' || typeof b === 'number') {
            branchList.push({ id: String(b), name: String(b) });
          }
        });
      } else if (typeof raw.branch === 'object' && raw.branch !== null) {
        const bObj = raw.branch as Record<string, unknown>;
        branchList.push({
          id:      String(bObj.id ?? bObj.branch_id ?? ''),
          name:    String(bObj.name ?? bObj.branch_name ?? 'Branch'),
          city:    (bObj.city ?? bObj.location ?? '') as string,
          address: (bObj.address ?? '') as string,
          phone:   (bObj.phone ?? bObj.phone_number ?? '') as string,
        });
      }

      const first = String(raw.first_name ?? initialEmployee?.first_name ?? '');
      const last  = String(raw.last_name ?? initialEmployee?.last_name ?? '');
      const fullName = [first, last].filter(Boolean).join(' ') ||
        String(raw.name ?? initialEmployee?.name ?? 'Employee Details');

      const parsed: EmployeeDetailData = {
        id:                     String(raw.id ?? raw.employee_id ?? employeeId),
        employee_code:          String(raw.employee_code ?? raw.code ?? initialEmployee?.employee_code ?? ''),
        name:                   fullName,
        first_name:             first || undefined,
        last_name:              last || undefined,
        phone:                  (raw.phone_number ?? raw.phone ?? raw.mobile ?? initialEmployee?.phone ?? null) as string | null,
        email:                  (raw.email ?? initialEmployee?.email ?? null) as string | null,
        role_name:              String(raw.role_name ?? raw.role ?? raw.position ?? initialEmployee?.role_name ?? 'Staff'),
        department_name:        String(raw.department_name ?? raw.department ?? initialEmployee?.department_name ?? 'General'),
        is_therapist:           raw.is_therapist === true || initialEmployee?.is_therapist === true,
        can_do_home_service:    raw.can_do_home_service === true || initialEmployee?.can_do_home_service === true,
        avatar:                 (raw.avatar ?? raw.image ?? raw.photo ?? raw.profile_picture ?? initialEmployee?.avatar ?? null) as string | null,
        hire_date:              (raw.hire_date ?? raw.hired_at ?? initialEmployee?.hire_date ?? null) as string | null,
        status:                 String(raw.status ?? initialEmployee?.status ?? 'active').toLowerCase(),
        gender:                 (raw.gender ?? null) as string | null,
        nationality:            (raw.nationality ?? null) as string | null,
        national_id:            (raw.national_id ?? raw.id_number ?? null) as string | null,
        dob:                    (raw.dob ?? raw.date_of_birth ?? null) as string | null,
        employment_type:        (raw.employment_type ?? raw.type ?? null) as string | null,
        emergency_contact_name: (raw.emergency_contact_name ?? raw.emergency_contact ?? null) as string | null,
        emergency_contact_phone:(raw.emergency_contact_phone ?? raw.emergency_phone ?? null) as string | null,
        branches:               branchList.length > 0 ? branchList : initialEmployee?.branches ?? [],
        services:               Array.isArray(raw.services) ? (raw.services as any[]) : undefined,
        working_hours:          Array.isArray(raw.working_hours) ? (raw.working_hours as any[]) : undefined,
        notes:                  (raw.notes ?? raw.bio ?? null) as string | null,
        raw,
      };

      setDetail(parsed);
    } catch (err) {
      console.warn('Failed to load employee detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch therapist analytics
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/v1/therapists/${encodeURIComponent(employeeId)}/analytics`);
      if (!res.ok) {
        throw new Error(`Analytics service responded with status ${res.status}`);
      }
      const data = await res.json();
      if (data && data.success) {
        setAnalytics(data);
      } else {
        throw new Error(data?.detail || 'Failed to load therapist analytics');
      }
    } catch (err) {
      console.warn('Failed to load therapist analytics:', err);
      setAnalyticsError(err instanceof Error ? err.message : 'Unable to load therapist analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (isTherapistRole) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, isTherapistRole]);

  const current = detail ?? (initialEmployee as EmployeeDetailData | null);
  const roleStyle = getRoleStyle(current?.role_name ?? 'staff');
  const isActive = current?.status === 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'relative flex flex-col w-full max-h-[94vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up',
          isTherapistRole ? 'max-w-4xl' : 'max-w-2xl'
        )}
      >
        {/* ── Top Cover Header with Avatar ── */}
        <div className="relative pt-5 pb-5 px-5 sm:px-6 bg-gradient-to-br from-primary/25 via-slate-900 to-slate-950 border-b border-border/50 text-white shrink-0">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md border',
                isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-muted/40 text-muted-foreground border-white/15'
              )}>
                <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-emerald-400' : 'bg-muted-foreground/60')} />
                {current?.status ? current.status.toUpperCase() : 'ACTIVE'}
              </span>

              {current?.employee_code && (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/40 border border-white/15 px-2.5 py-1 text-xs font-mono font-medium text-white/90 backdrop-blur-md">
                  {current.employee_code}
                </span>
              )}

              {isTherapistRole && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-1 text-xs font-bold text-emerald-300 backdrop-blur-md">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Therapist Analytics Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isTherapistRole && (
                <button
                  onClick={() => {
                    fetchAllData();
                    fetchAnalytics();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/70 transition backdrop-blur-md cursor-pointer"
                  title="Refresh analytics & details"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', (loading || loadingAnalytics) && 'animate-spin')} />
                </button>
              )}

              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/70 transition backdrop-blur-md cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Profile Overview Card */}
          <div className="mt-4 flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              {current?.avatar && !avatarErr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.avatar}
                  alt={current.name}
                  onError={() => setAvatarErr(true)}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover ring-4 ring-white/15 shadow-xl"
                />
              ) : (
                <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl sm:text-2xl font-black text-white ring-4 ring-white/15 shadow-xl">
                  {initials(current?.name ?? 'Employee')}
                </div>
              )}
              <span className={cn(
                'absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-3 ring-slate-950 flex items-center justify-center',
                isActive ? 'bg-emerald-500' : 'bg-muted-foreground'
              )}>
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate drop-shadow-sm">
                {current?.name ?? 'Loading…'}
              </h2>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm', roleStyle.bg, roleStyle.text, roleStyle.border)}>
                  <Briefcase className="h-3 w-3" />
                  {current?.role_name}
                </span>

                <span className="text-xs text-white/75 font-medium">
                  {current?.department_name}
                </span>

                {current?.can_do_home_service && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                    <Home className="h-3 w-3 text-sky-400" />
                    Home Service
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Therapist KPI Highlights Strip */}
          {isTherapistRole && (
            <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-white">
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60 flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-400" /> Total Revenue
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {loadingAnalytics ? (
                    <span className="inline-block h-4 w-16 bg-white/20 animate-pulse rounded" />
                  ) : (
                    `${(analytics?.sales?.completed_sales ?? 0).toFixed(3)} KWD`
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-sky-400" /> Completed
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {loadingAnalytics ? (
                    <span className="inline-block h-4 w-12 bg-white/20 animate-pulse rounded" />
                  ) : (
                    `${analytics?.sales?.completed_bookings ?? 0} of ${analytics?.sales?.total_bookings ?? 0}`
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60 flex items-center gap-1">
                  <Users className="h-3 w-3 text-amber-400" /> Retention Rate
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {loadingAnalytics ? (
                    <span className="inline-block h-4 w-12 bg-white/20 animate-pulse rounded" />
                  ) : (
                    `${analytics?.marketing?.repeat_client_rate_pct ?? 0}%`
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-purple-400" /> Treatment Hours
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {loadingAnalytics ? (
                    <span className="inline-block h-4 w-12 bg-white/20 animate-pulse rounded" />
                  ) : (
                    `${analytics?.performance?.total_treatment_hours ?? 0} hrs`
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs for Therapists */}
          {isTherapistRole && (
            <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer',
                  activeTab === 'overview'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Profile & Details
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sales')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer',
                  activeTab === 'sales'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Sales Analytics
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('marketing')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer',
                  activeTab === 'marketing'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Marketing & Clients
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('financials')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer',
                  activeTab === 'financials'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Finance Analytics
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('performance')}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer',
                  activeTab === 'performance'
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                Performance & Log
              </button>
            </div>
          )}
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>

          {/* Error Banner */}
          {(error || analyticsError) && (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error || analyticsError}</span>
              <button
                onClick={() => {
                  fetchAllData();
                  if (isTherapistRole) fetchAnalytics();
                }}
                className="flex items-center gap-1 font-bold underline hover:opacity-80 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 1: OVERVIEW & PROFILE                                    */}
          {/* ──────────────────────────────────────────────────────────── */}
          {(!isTherapistRole || activeTab === 'overview') && (
            <div className="space-y-5 animate-fade-in">
              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Department</span>
                  <span className="mt-1 text-sm font-bold text-foreground truncate">
                    {current?.department_name || 'General'}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Hired On</span>
                  <span className="mt-1 text-sm font-bold text-foreground">
                    {formatDate(current?.hire_date) || '—'}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Type</span>
                  <span className="mt-1 text-sm font-bold text-foreground capitalize">
                    {current?.employment_type || 'Full Time'}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Branches</span>
                  <span className="mt-1 text-sm font-bold text-foreground">
                    {current?.branches && current.branches.length > 0 ? `${current.branches.length} Assigned` : 'All'}
                  </span>
                </div>
              </div>

              {/* Contact Information */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  Contact Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone */}
                  <div className="flex items-center justify-between rounded-xl bg-card border border-border/50 p-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Phone Number</p>
                        {current?.phone ? (
                          <a href={`tel:${current.phone}`} className="text-xs font-bold text-foreground hover:text-primary transition truncate block">
                            {current.phone}
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not provided</p>
                        )}
                      </div>
                    </div>

                    {current?.phone && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(current.phone!, 'phone')}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                        title="Copy phone"
                      >
                        {copiedField === 'phone' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center justify-between rounded-xl bg-card border border-border/50 p-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/10 text-sky-500 shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Email Address</p>
                        {current?.email ? (
                          <a href={`mailto:${current.email}`} className="text-xs font-bold text-foreground hover:text-primary transition truncate block">
                            {current.email}
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not provided</p>
                        )}
                      </div>
                    </div>

                    {current?.email && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(current.email!, 'email')}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                        title="Copy email"
                      >
                        {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned Branches */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Assigned Branches
                  </h4>
                  {current?.branches && current.branches.length > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {current.branches.length} locations
                    </span>
                  )}
                </div>

                {current?.branches && current.branches.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {current.branches.map((b, idx) => (
                      <div
                        key={b.id || idx}
                        className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition hover:border-primary/40 hover:bg-muted/40"
                      >
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{b.name}</p>
                          {b.city && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                              <span className="truncate">{b.city}</span>
                            </p>
                          )}
                          {b.phone && (
                            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                              {b.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-center">
                    <p className="text-xs font-semibold text-foreground">Assigned across all spa branches</p>
                  </div>
                )}
              </div>

              {/* Assigned Services / Skills */}
              {current?.services && current.services.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Services & Specializations ({current.services.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {current.services.map((svc, idx) => (
                      <span
                        key={svc.id || idx}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground"
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        {svc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Details */}
              {(current?.gender || current?.nationality || current?.national_id || current?.dob) && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Personal Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {current.gender && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Gender</span>
                        <span className="font-semibold capitalize text-foreground">{current.gender}</span>
                      </div>
                    )}
                    {current.nationality && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Nationality</span>
                        <span className="font-semibold text-foreground">{current.nationality}</span>
                      </div>
                    )}
                    {current.dob && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Date of Birth</span>
                        <span className="font-semibold text-foreground">{formatDate(current.dob)}</span>
                      </div>
                    )}
                    {current.national_id && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">National ID</span>
                        <span className="font-mono text-foreground">{current.national_id}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {(current?.emergency_contact_name || current?.emergency_contact_phone) && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <HeartHandshake className="h-3.5 w-3.5 text-rose-500" />
                    Emergency Contact
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{current.emergency_contact_name || 'Contact'}</span>
                    {current.emergency_contact_phone && (
                      <a href={`tel:${current.emergency_contact_phone}`} className="font-mono font-bold text-primary hover:underline">
                        {current.emergency_contact_phone}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {current?.notes && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</h4>
                  <p className="text-xs text-muted-foreground rounded-2xl bg-muted/20 border border-border/50 p-3 leading-relaxed">
                    {current.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 2: SALES ANALYTICS                                       */}
          {/* ──────────────────────────────────────────────────────────── */}
          {isTherapistRole && activeTab === 'sales' && (
            <div className="space-y-5 animate-fade-in">
              {/* Sales KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Completed Sales
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {(analytics?.sales?.completed_sales ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    From {analytics?.sales?.completed_bookings ?? 0} treatments
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Gross Sales
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {(analytics?.sales?.gross_sales ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Across {analytics?.sales?.total_bookings ?? 0} total bookings
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5 text-sky-500" /> Avg Ticket Size
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {(analytics?.sales?.average_booking_value ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Per appointment</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-500" /> Completion Rate
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.sales?.completion_rate_pct ?? 0}%
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {analytics?.sales?.cancelled_bookings ?? 0} cancelled · {analytics?.sales?.no_show_bookings ?? 0} no-shows
                  </p>
                </div>
              </div>

              {/* Status Breakdown Bar */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <PieChart className="h-3.5 w-3.5 text-primary" />
                  Appointment Pipeline & Status Breakdown
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="rounded-xl bg-card border border-border/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Completed</span>
                    <div className="text-lg font-black text-foreground mt-0.5">{analytics?.sales?.completed_bookings ?? 0}</div>
                  </div>

                  <div className="rounded-xl bg-card border border-border/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Upcoming</span>
                    <div className="text-lg font-black text-foreground mt-0.5">{analytics?.sales?.upcoming_bookings ?? 0}</div>
                  </div>

                  <div className="rounded-xl bg-card border border-border/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">In Progress</span>
                    <div className="text-lg font-black text-foreground mt-0.5">{analytics?.sales?.in_progress_bookings ?? 0}</div>
                  </div>

                  <div className="rounded-xl bg-card border border-border/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Cancelled</span>
                    <div className="text-lg font-black text-foreground mt-0.5">{analytics?.sales?.cancelled_bookings ?? 0}</div>
                    <span className="text-[10px] text-muted-foreground">{analytics?.sales?.cancellation_rate_pct ?? 0}% rate</span>
                  </div>

                  <div className="rounded-xl bg-card border border-border/50 p-3">
                    <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">No Show</span>
                    <div className="text-lg font-black text-foreground mt-0.5">{analytics?.sales?.no_show_bookings ?? 0}</div>
                    <span className="text-[10px] text-muted-foreground">{analytics?.sales?.no_show_rate_pct ?? 0}% rate</span>
                  </div>
                </div>
              </div>

              {/* Monthly Sales Trend */}
              {analytics?.sales?.monthly_trends && analytics.sales.monthly_trends.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Monthly Sales & Activity Trends
                  </h4>

                  <div className="space-y-2">
                    {analytics.sales.monthly_trends.map((m) => {
                      const maxRev = Math.max(...analytics.sales.monthly_trends.map((t) => t.revenue), 1);
                      const pct = Math.min(100, Math.round((m.revenue / maxRev) * 100));
                      return (
                        <div key={m.month} className="rounded-xl bg-card border border-border/50 p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="font-mono text-foreground font-bold">{m.month}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground font-normal">
                                {m.completed_count} completed / {m.booking_count} bookings
                              </span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {m.revenue.toFixed(3)} KWD
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 3: MARKETING & CLIENTS                                   */}
          {/* ──────────────────────────────────────────────────────────── */}
          {isTherapistRole && activeTab === 'marketing' && (
            <div className="space-y-5 animate-fade-in">
              {/* Marketing KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" /> Total Clients
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.marketing?.total_unique_clients ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Unique individuals</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-emerald-500" /> Repeat Clients
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.marketing?.repeat_clients_count ?? 0}
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                    {analytics?.marketing?.repeat_client_rate_pct ?? 0}% Retention Rate
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Home className="h-3.5 w-3.5 text-sky-500" /> Home vs Spa
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.marketing?.home_service_count ?? 0} <span className="text-xs text-muted-foreground">Home</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {analytics?.marketing?.spa_branch_count ?? 0} Branch Visits
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500" /> Peak Hours
                  </div>
                  <div className="text-sm font-black text-foreground mt-1 truncate">
                    {analytics?.marketing?.client_time_preferences?.[0]?.slot?.split(' ')[0] || 'Afternoon'}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {analytics?.marketing?.client_time_preferences?.[0]?.percentage ?? 0}% of client visits
                  </p>
                </div>
              </div>

              {/* Top Services Performed */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Most Requested Services by Clients
                </h4>

                {analytics?.marketing?.top_services && analytics.marketing.top_services.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.marketing.top_services.map((svc, idx) => (
                      <div key={svc.service_id || idx} className="rounded-xl bg-card border border-border/50 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-foreground truncate">{svc.service_name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted-foreground">
                              {svc.booking_count} times ({svc.total_hours}h)
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {svc.total_revenue.toFixed(3)} KWD
                            </span>
                          </div>
                        </div>

                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(svc.share_pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No services recorded yet.</p>
                )}
              </div>

              {/* Top Regular Clients */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Top Loyal & Repeat Clients
                </h4>

                {analytics?.marketing?.top_clients && analytics.marketing.top_clients.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {analytics.marketing.top_clients.map((c, idx) => (
                      <div key={idx} className="rounded-xl bg-card border border-border/50 p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">{c.customer_name}</div>
                          {c.customer_phone && (
                            <div className="text-[11px] font-mono text-muted-foreground truncate">{c.customer_phone}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Last visit: {formatDate(c.last_visit) || 'Recent'}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                            {c.visit_count} visits
                          </span>
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {c.total_spent.toFixed(3)} KWD
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No repeat clients logged yet.</p>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 4: FINANCE ANALYTICS                                     */}
          {/* ──────────────────────────────────────────────────────────── */}
          {isTherapistRole && activeTab === 'financials' && (
            <div className="space-y-5 animate-fade-in">
              {/* Financial Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Collected Net Revenue
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {(analytics?.financials?.net_revenue ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Total revenue generated</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sky-500" /> Revenue Per Hour
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {(analytics?.financials?.avg_revenue_per_hour ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD/hr</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Treatment hourly yield</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-amber-500" /> Est. Commission ({analytics?.financials?.commission_rate_pct ?? 10}%)
                  </div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {(analytics?.financials?.estimated_commission ?? 0).toFixed(3)}
                    <span className="text-xs font-bold text-muted-foreground ml-1">KWD</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Standard therapist incentive</p>
                </div>
              </div>

              {/* Detailed Financial Breakdown */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  Financial Sources & Deductions
                </h4>

                <div className="divide-y divide-border/40 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Gross Booking Value</span>
                    <span className="font-mono font-bold text-foreground">
                      {(analytics?.financials?.total_gross_revenue ?? 0).toFixed(3)} KWD
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Add-on Treatments Revenue</span>
                    <span className="font-mono font-bold text-foreground">
                      +{(analytics?.financials?.addon_revenue ?? 0).toFixed(3)} KWD
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Extra Treatment Minutes Revenue</span>
                    <span className="font-mono font-bold text-foreground">
                      +{(analytics?.financials?.extra_minutes_revenue ?? 0).toFixed(3)} KWD
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Pending / Unsettled Bookings</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {(analytics?.financials?.pending_revenue ?? 0).toFixed(3)} KWD
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">Refunds Deducted</span>
                    <span className="font-mono font-bold text-rose-500">
                      -{(analytics?.financials?.refunded_amount ?? 0).toFixed(3)} KWD
                    </span>
                  </div>

                  <div className="pt-3 pb-1 flex items-center justify-between text-sm font-bold">
                    <span className="text-foreground">Net Spa Revenue Contribution</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {(analytics?.financials?.net_revenue ?? 0).toFixed(3)} KWD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 5: PERFORMANCE & LOG                                     */}
          {/* ──────────────────────────────────────────────────────────── */}
          {isTherapistRole && activeTab === 'performance' && (
            <div className="space-y-5 animate-fade-in">
              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Treatment Hours
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.performance?.total_treatment_hours ?? 0}
                    <span className="text-xs font-bold text-muted-foreground ml-1">hrs</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {analytics?.performance?.extra_treatment_minutes ?? 0}m extra overtime
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Reliability Score
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.performance?.reliability_score_pct ?? 0}%
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                    High attendance rate
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sky-500" /> Avg Session Time
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground mt-1">
                    {analytics?.performance?.average_service_duration_minutes ?? 0}
                    <span className="text-xs font-bold text-muted-foreground ml-1">mins</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Per appointment</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-500" /> Busiest Day
                  </div>
                  <div className="text-sm font-black text-foreground mt-1 truncate">
                    {analytics?.performance?.busiest_day || 'Weekend'}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Peak customer traffic</p>
                </div>
              </div>

              {/* Day of Week Workload Distribution */}
              {analytics?.performance?.day_distribution && analytics.performance.day_distribution.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Weekly Workload & Booking Schedule
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    {analytics.performance.day_distribution.map((d) => (
                      <div key={d.day} className="rounded-xl bg-card border border-border/50 p-2.5 text-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{d.day.slice(0, 3)}</span>
                        <div className="text-base font-black text-foreground mt-0.5">{d.booking_count}</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          {d.revenue.toFixed(1)} KWD
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Appointments Log Table */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    Recent Treatment Appointments Log ({analytics?.recent_bookings?.length ?? 0})
                  </h4>
                </div>

                {analytics?.recent_bookings && analytics.recent_bookings.length > 0 ? (
                  <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border/50 text-[10px] font-bold uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2.5">Date & Time</th>
                            <th className="px-3 py-2.5">Client</th>
                            <th className="px-3 py-2.5">Service</th>
                            <th className="px-3 py-2.5">Branch</th>
                            <th className="px-3 py-2.5">Amount</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {analytics.recent_bookings.map((b) => (
                            <tr key={b.id} className="hover:bg-muted/20 transition">
                              <td className="px-3 py-2.5 whitespace-nowrap font-mono text-muted-foreground">
                                {formatDateTime(b.appointment_start || b.appointment_date)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-foreground block truncate max-w-[120px]">
                                  {b.customer_name || 'Client'}
                                </span>
                                {b.customer_phone && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {b.customer_phone}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-foreground block truncate max-w-[130px]">
                                  {b.service_name || 'Treatment'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {b.duration_minutes + b.extra_minutes} mins
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                                {b.branch_name || 'Spa Branch'}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap font-mono font-bold text-foreground">
                                {b.total_amount.toFixed(3)} KWD
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                                    b.status.toLowerCase() === 'completed'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      : b.status.toLowerCase() === 'cancelled'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                  )}
                                >
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No recent treatment sessions logged.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border/60 bg-card px-5 sm:px-6 py-3.5">
          <div className="text-[11px] text-muted-foreground">
            {isTherapistRole && (
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Comprehensive Therapist Performance Suite
              </span>
            )}
          </div>

          <button
            type="button"
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
