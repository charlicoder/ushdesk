'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Star, MessageSquareText, Users, Sparkles, ClipboardCheck, Search, X, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, Link2, Copy, CheckCircle2, RefreshCw,
  SlidersHorizontal, Filter, ChevronDown, Building2, UserCheck, Calendar,
  Clock, Layers, Check,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader, PageHeaderButton } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { cn } from '@/lib/utils';
import {
  DateRangeFilter,
  DateFilterActiveBadge,
  type DateFilterType,
  type DateRange,
} from '@/components/dashboard/date-range-filter';
import {
  feedbackApi,
  type FeedbackItem,
  type FeedbackList,
  type FeedbackQuery,
  type FeedbackSummary,
  type FeedbackStatus,
} from '@/lib/feedback';

// ── Small UI helpers ─────────────────────────────────────────────────────────

function Stars({ value, size = 'h-4 w-4' }: { value: number | null | undefined; size?: string }) {
  const v = value ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of 5` : 'No rating'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(size, i <= Math.round(v) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </span>
  );
}

const fmtAvg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(2));

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { timeZone: 'Asia/Kuwait', dateStyle: 'medium', timeStyle: 'short' });
};

const selectCls =
  'h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const QUESTIONS: Array<{ key: 'service_rating' | 'therapist_rating' | 'arrangement_rating'; label: string }> = [
  { key: 'service_rating', label: 'Service Quality' },
  { key: 'therapist_rating', label: 'Therapist Performance' },
  { key: 'arrangement_rating', label: 'Overall Arrangements' },
];

// ── Detail dialog ────────────────────────────────────────────────────────────

function FeedbackDetailDialog({ item, onClose }: { item: FeedbackItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const submitted = item.status === 'submitted';

  const copy = async () => {
    if (!item.feedback_url) return;
    await navigator.clipboard.writeText(item.feedback_url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rows: Array<[string, string]> = [
    ['Customer', item.customer_name || '—'],
    ['Phone', item.customer_phone || '—'],
    ['Booking', item.booking_number || '—'],
    ['Branch', item.branch_name || '—'],
    ['Service', item.service_name || '—'],
    [
      'Therapist',
      [item.therapist_name, item.secondary_therapist_name].filter(Boolean).join(' & ') || '—',
    ],
    ['Appointment', fmtDateTime(item.appointment_start)],
    ['Submitted', fmtDateTime(item.submitted_at)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-primary to-amber-400" />
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div>
            <h2 className="text-base font-extrabold">Feedback details</h2>
            <p className="text-xs text-muted-foreground">{item.customer_name || 'Customer'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          {submitted ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              {QUESTIONS.map((q) => (
                <div key={q.key} className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{q.label}</span>
                  <Stars value={item[q.key]} />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <span className="text-sm font-extrabold">Average</span>
                <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <Stars value={item.average_rating} /> {fmtAvg(item.average_rating)}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-300/50 bg-amber-50/70 p-4 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Waiting for the customer to submit feedback.
            </div>
          )}

          {item.comment && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Comment</p>
              <p className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-3 text-sm" dir="auto">
                {item.comment}
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {item.feedback_url && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2 text-xs">
              <Link2 className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 select-all truncate font-mono text-[11px]">{item.feedback_url}</span>
              <button
                type="button"
                onClick={copy}
                title="Copy link"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg hover:bg-muted"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter Modal Component (Popup Window) ─────────────────────────────────────

interface FeedbackFilterModalProps {
  status: '' | FeedbackStatus;
  branchId: string;
  therapistId: string;
  serviceId: string;
  minRating: string;
  options: FeedbackSummary | null;
  onClose: () => void;
  onApply: (filters: {
    status: '' | FeedbackStatus;
    branchId: string;
    therapistId: string;
    serviceId: string;
    minRating: string;
  }) => void;
  onReset: () => void;
}

function FeedbackFilterModal({
  status,
  branchId,
  therapistId,
  serviceId,
  minRating,
  options,
  onClose,
  onApply,
  onReset,
}: FeedbackFilterModalProps) {
  const [draftStatus, setDraftStatus] = useState<'' | FeedbackStatus>(status);
  const [draftBranchId, setDraftBranchId] = useState(branchId);
  const [draftTherapistId, setDraftTherapistId] = useState(therapistId);
  const [draftServiceId, setDraftServiceId] = useState(serviceId);
  const [draftMinRating, setDraftMinRating] = useState(minRating);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const draftActiveCount = useMemo(() => {
    let count = 0;
    if (draftStatus) count++;
    if (draftBranchId) count++;
    if (draftTherapistId) count++;
    if (draftServiceId) count++;
    if (draftMinRating) count++;
    return count;
  }, [draftStatus, draftBranchId, draftTherapistId, draftServiceId, draftMinRating]);

  const handleReset = () => {
    setDraftStatus('');
    setDraftBranchId('');
    setDraftTherapistId('');
    setDraftServiceId('');
    setDraftMinRating('');
    onReset();
  };

  const handleApply = () => {
    onApply({
      status: draftStatus,
      branchId: draftBranchId,
      therapistId: draftTherapistId,
      serviceId: draftServiceId,
      minRating: draftMinRating,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-primary to-amber-400" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground leading-tight">
                  Filter Customer Feedback
                </h3>
                {draftActiveCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary font-mono">
                    {draftActiveCount} active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select criteria to narrow down customer reviews and ratings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-6 space-y-5 text-xs">
          {/* 1. Submission Status */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Submission Status
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: '', label: 'All Statuses', desc: 'Submitted & Pending', icon: Layers },
                { id: 'submitted', label: 'Submitted', desc: 'Reviews with ratings', icon: CheckCircle2 },
                { id: 'pending', label: 'Pending', desc: 'Awaiting response', icon: Clock },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = draftStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraftStatus(opt.id as '' | FeedbackStatus)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-2xl border text-left transition cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-xs'
                        : 'border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <span className="font-bold text-xs">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Rating Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Minimum Average Rating
              </label>
              {draftMinRating && (
                <button
                  type="button"
                  onClick={() => setDraftMinRating('')}
                  className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                >
                  Clear rating
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: '', label: 'All Ratings', stars: 0 },
                { id: '5', label: '5 Stars (Excellent)', stars: 5 },
                { id: '4', label: '4+ Stars (Very Good)', stars: 4 },
                { id: '3', label: '3+ Stars (Good)', stars: 3 },
                { id: '2', label: '2+ Stars (Fair)', stars: 2 },
                { id: '1', label: '1+ Star (Poor)', stars: 1 },
              ].map((opt) => {
                const isSelected = draftMinRating === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraftMinRating(opt.id)}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer text-left',
                      isSelected
                        ? 'border-amber-500/80 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30'
                        : 'border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold block truncate text-[11px]">{opt.label}</span>
                      {opt.stars > 0 && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'h-2.5 w-2.5',
                                s <= opt.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Branch, Therapist, Service Dropdowns */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Location, Staff &amp; Treatment
            </h4>

            {/* Branch */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Branch Location</span>
              </label>
              <select
                value={draftBranchId}
                onChange={(e) => setDraftBranchId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary transition cursor-pointer"
              >
                <option value="">All Branches</option>
                {options?.by_branch.map((b) => b.id && (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.count ? `(${b.count} reviews)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Therapist */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>Therapist</span>
              </label>
              <select
                value={draftTherapistId}
                onChange={(e) => setDraftTherapistId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary transition cursor-pointer"
              >
                <option value="">All Therapists</option>
                {options?.by_therapist.map((t) => t.id && (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.count ? `(${t.count} reviews)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Service */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Spa Service / Treatment</span>
              </label>
              <select
                value={draftServiceId}
                onChange={(e) => setDraftServiceId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary transition cursor-pointer"
              >
                <option value="">All Services</option>
                {options?.by_service.map((s) => s.id && (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.count ? `(${s.count} reviews)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-6 py-4 bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={draftActiveCount === 0}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reset to Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition active:scale-[0.98] cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply Filters {draftActiveCount > 0 ? `(${draftActiveCount})` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function FeedbackPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<'' | FeedbackStatus>('');
  const [branchId, setBranchId] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [minRating, setMinRating] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [list, setList] = useState<FeedbackList | null>(null);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [options, setOptions] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (status) count++;
    if (branchId) count++;
    if (therapistId) count++;
    if (serviceId) count++;
    if (minRating) count++;
    return count;
  }, [status, branchId, therapistId, serviceId, minRating]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Filter options (unfiltered summary groups) — loaded once and on manual refresh.
  useEffect(() => {
    feedbackApi.summary().then(setOptions).catch(() => undefined);
  }, [refreshKey]);

  const filterKey = useMemo(
    () => [debouncedSearch, status, branchId, therapistId, serviceId, minRating, dateRange.from || '', dateRange.to || ''].join('|'),
    [debouncedSearch, status, branchId, therapistId, serviceId, minRating, dateRange.from, dateRange.to],
  );
  useEffect(() => setPage(1), [filterKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Date inputs are Kuwait calendar days.
    const from = dateRange.from ? `${dateRange.from}T00:00:00+03:00` : undefined;
    const to = dateRange.to ? `${dateRange.to}T23:59:59+03:00` : undefined;
    const base = {
      branch_id: branchId || undefined,
      therapist_id: therapistId || undefined,
      service_id: serviceId || undefined,
      date_from: from,
      date_to: to,
    };
    const query: FeedbackQuery = {
      ...base,
      status: status || undefined,
      min_rating: minRating ? Number(minRating) : undefined,
      search: debouncedSearch || undefined,
      page,
      page_size: PAGE_SIZE,
    };
    try {
      const [l, s] = await Promise.all([feedbackApi.list(query), feedbackApi.summary(base)]);
      setList(l);
      setSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters = Boolean(
    search || status || branchId || therapistId || serviceId || minRating || dateFilter !== 'all' || dateRange.from || dateRange.to
  );
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setBranchId('');
    setTherapistId('');
    setServiceId('');
    setMinRating('');
    setDateFilter('all');
    setDateRange({});
    setPage(1);
  };

  const items = list?.items ?? [];
  const pages = list?.pages ?? 0;

  return (
    <DashboardShell>
      <PageHeader title="Customer Feedback" subtitle="Ratings and comments submitted by customers after completed bookings.">
        <PageHeaderButton onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </PageHeaderButton>
      </PageHeader>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Overall rating"
          value={summary ? `${fmtAvg(summary.averages.overall)} / 5` : '—'}
          icon={Star}
          gradient="from-amber-400 to-orange-500"
        />
        <StatCard
          label="Service quality"
          value={summary ? fmtAvg(summary.averages.service) : '—'}
          icon={Sparkles}
          gradient="from-violet-500 to-fuchsia-500"
          delay={50}
        />
        <StatCard
          label="Therapist performance"
          value={summary ? fmtAvg(summary.averages.therapist) : '—'}
          icon={Users}
          gradient="from-sky-500 to-cyan-500"
          delay={100}
        />
        <StatCard
          label="Arrangements"
          value={summary ? fmtAvg(summary.averages.arrangement) : '—'}
          icon={ClipboardCheck}
          gradient="from-emerald-500 to-teal-500"
          delay={150}
        />
        <StatCard
          label="Responses"
          value={summary ? `${summary.submitted} / ${summary.total_links}` : '—'}
          icon={MessageSquareText}
          gradient="from-rose-500 to-pink-500"
          delay={200}
        />
      </div>

      {summary && summary.submitted > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {(['service', 'therapist', 'arrangement'] as const).map((k) => {
            const dist = summary.distribution[k] ?? {};
            const max = Math.max(1, ...Object.values(dist));
            const label = k === 'service' ? 'Service quality' : k === 'therapist' ? 'Therapist' : 'Arrangements';
            return (
              <div key={k} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="mb-3 text-sm font-bold">{label} distribution</p>
                {[5, 4, 3, 2, 1].map((n) => (
                  <div key={n} className="mb-1.5 flex items-center gap-2 text-xs">
                    <span className="flex w-6 items-center gap-0.5 font-semibold">
                      {n}
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                        style={{ width: `${((dist[String(n)] ?? 0) / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{dist[String(n)] ?? 0}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Controls: Search, Filter Popover, Date Range */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, phone, booking, therapist, comment…"
            className={cn(selectCls, 'w-full pl-9 pr-8')}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Button (Opens Popup Modal) */}
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-xs font-semibold shadow-xs transition hover:bg-muted/50 cursor-pointer shrink-0',
            activeFilterCount > 0 ? 'border-primary/50 text-primary bg-primary/5' : 'border-border text-foreground'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary text-white text-[10px] font-bold px-1.5">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Date Range Filter (matching customers page) */}
        <DateRangeFilter
          buttonLabelPrefix="Date Filters"
          dateFilter={dateFilter}
          dateRange={dateRange}
          onChange={(type, range) => {
            setDateFilter(type);
            setDateRange(range);
            setPage(1);
          }}
        />
      </div>

      {/* Active Filter Badges */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DateFilterActiveBadge
          dateFilter={dateFilter}
          dateRange={dateRange}
          onClear={() => {
            setDateFilter('all');
            setDateRange({});
            setPage(1);
          }}
        />
        {status && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <span>Status: {status === 'submitted' ? 'Submitted' : 'Pending'}</span>
            <button
              type="button"
              onClick={() => setStatus('')}
              className="hover:text-primary/70 transition-colors ml-0.5 cursor-pointer"
              title="Clear status filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {minRating && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 animate-in fade-in">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>Rating: {minRating}+ Stars</span>
            <button
              type="button"
              onClick={() => setMinRating('')}
              className="hover:opacity-70 transition-opacity ml-0.5 cursor-pointer"
              title="Clear rating filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {branchId && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <Building2 className="h-3 w-3" />
            <span>Branch: {options?.by_branch.find((b) => b.id === branchId)?.name || branchId}</span>
            <button
              type="button"
              onClick={() => setBranchId('')}
              className="hover:text-primary/70 transition-colors ml-0.5 cursor-pointer"
              title="Clear branch filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {therapistId && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <UserCheck className="h-3 w-3" />
            <span>Therapist: {options?.by_therapist.find((t) => t.id === therapistId)?.name || therapistId}</span>
            <button
              type="button"
              onClick={() => setTherapistId('')}
              className="hover:text-primary/70 transition-colors ml-0.5 cursor-pointer"
              title="Clear therapist filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {serviceId && (
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary animate-in fade-in">
            <Sparkles className="h-3 w-3" />
            <span>Service: {options?.by_service.find((s) => s.id === serviceId)?.name || serviceId}</span>
            <button
              type="button"
              onClick={() => setServiceId('')}
              className="hover:text-primary/70 transition-colors ml-0.5 cursor-pointer"
              title="Clear service filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-bold text-muted-foreground hover:text-foreground underline cursor-pointer ml-1"
          >
            Clear all filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Service / Therapist</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Comment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading && !items.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && !items.length && !error && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <MessageSquareText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p className="text-sm font-semibold text-foreground">No feedback records found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hasFilters ? 'Try adjusting or clearing your filters to see more results.' : 'Feedback links generated after completed bookings will appear here.'}
                      </p>
                      {hasFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {items.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className="cursor-pointer transition hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{f.customer_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{f.customer_phone || ''}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{f.booking_number || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{f.service_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {[f.therapist_name, f.secondary_therapist_name].filter(Boolean).join(' & ') || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">{f.branch_name || '—'}</td>
                  <td className="px-4 py-3">
                    {f.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-2">
                        <Stars value={f.average_rating} size="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{fmtAvg(f.average_rating)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[220px] px-4 py-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground" dir="auto">{f.comment || '—'}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">{fmtDateTime(f.submitted_at || f.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        f.status === 'submitted'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
                      )}
                    >
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              Page {page} of {pages} · {list?.total ?? 0} results
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-muted disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-muted disabled:opacity-50"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <FeedbackDetailDialog item={selected} onClose={() => setSelected(null)} />}

      {/* ── Filter Popup Window ── */}
      {showFilterModal && (
        <FeedbackFilterModal
          status={status}
          branchId={branchId}
          therapistId={therapistId}
          serviceId={serviceId}
          minRating={minRating}
          options={options}
          onClose={() => setShowFilterModal(false)}
          onApply={(f) => {
            setStatus(f.status);
            setBranchId(f.branchId);
            setTherapistId(f.therapistId);
            setServiceId(f.serviceId);
            setMinRating(f.minRating);
          }}
          onReset={() => {
            setStatus('');
            setBranchId('');
            setTherapistId('');
            setServiceId('');
            setMinRating('');
          }}
        />
      )}
    </DashboardShell>
  );
}

