'use client';

import { useEffect, useState } from 'react';
import {
  X, Phone, Mail, Building2, Briefcase, CalendarDays,
  Home, ShieldCheck, UserCheck, AlertCircle, RefreshCw,
  MapPin, Clock, Copy, Check, Sparkles, HeartHandshake,
  BadgePercent, FileText,
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
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EmployeeDetailModal({ employeeId, initialEmployee, onClose }: Props) {
  const token = useAppSelector((s) => s.auth.token);

  const [detail, setDetail]   = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [avatarErr, setAvatarErr] = useState(false);

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

  // Fetch from /uauth/api/v1/employees/<employee_id>/
  const fetchDetail = async () => {
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await authedFetch(`/uauth/api/v1/employees/${employeeId}/`, { headers });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (json as Record<string, string>)?.detail ??
          (json as Record<string, string>)?.message ??
          `Failed to load employee details (${res.status})`
        );
      }

      const raw = ((json?.data ?? json?.employee ?? json) as Record<string, unknown>);

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
        services:               Array.isArray(raw.services) ? raw.services as any[] : undefined,
        working_hours:          Array.isArray(raw.working_hours) ? raw.working_hours as any[] : undefined,
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

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const current = detail ?? (initialEmployee as EmployeeDetailData | null);
  const roleStyle = getRoleStyle(current?.role_name ?? 'staff');
  const isActive = current?.status === 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[92vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up">

        {/* ── Top Cover Header with Avatar ── */}
        <div className="relative pt-6 pb-6 px-6 bg-gradient-to-br from-primary/25 via-slate-900 to-slate-950 border-b border-border/50 text-white shrink-0">
          {/* Top Actions */}
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
            </div>

            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/70 transition backdrop-blur-md cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Profile overview with Avatar */}
          <div className="mt-5 flex items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              {current?.avatar && !avatarErr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.avatar}
                  alt={current.name}
                  onError={() => setAvatarErr(true)}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl object-cover ring-4 ring-white/15 shadow-xl"
                />
              ) : (
                <div className="grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary to-accent text-2xl sm:text-3xl font-black text-white ring-4 ring-white/15 shadow-xl">
                  {initials(current?.name ?? 'Employee')}
                </div>
              )}
              {/* Online/Active status badge */}
              <span className={cn(
                'absolute -bottom-1 -right-1 h-5 w-5 rounded-full ring-4 ring-slate-950 flex items-center justify-center',
                isActive ? 'bg-emerald-500' : 'bg-muted-foreground'
              )}>
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate drop-shadow-sm">
                {current?.name ?? 'Loading…'}
              </h2>

              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm', roleStyle.bg, roleStyle.text, roleStyle.border)}>
                  <Briefcase className="h-3 w-3" />
                  {current?.role_name}
                </span>

                <span className="text-xs text-white/75 font-medium">
                  {current?.department_name}
                </span>
              </div>

              {/* Badges for Therapist & Home Service */}
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                {current?.is_therapist && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    Therapist Specialist
                  </span>
                )}
                {current?.can_do_home_service && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                    <Home className="h-3 w-3 text-sky-400" />
                    Home Service Eligible
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={fetchDetail}
                className="flex items-center gap-1 font-bold underline hover:opacity-80 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

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

          {/* ── Contact Information ── */}
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

          {/* ── Assigned Branches ── */}
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

          {/* ── Personal & Identification Details (if available) ── */}
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

          {/* ── Emergency Contact (if available) ── */}
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

          {/* ── Assigned Services / Skills (if available) ── */}
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
                    className="inline-flex items-center gap-1 rounded-xl bg-card border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    {svc.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes / Bio if available */}
          {current?.notes && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</h4>
              <p className="text-xs text-muted-foreground rounded-2xl bg-muted/20 border border-border/50 p-3 leading-relaxed">
                {current.notes}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
