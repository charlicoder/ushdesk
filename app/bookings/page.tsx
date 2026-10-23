'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, Calendar, Clock, MapPin, User, Scissors,
  CreditCard, CheckCircle2, XCircle, BookOpen,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, ExternalLink, Hash, Home,
  History, Info, UserCheck, Copy, Check, Plus, Banknote, Printer, Loader2,
  FileText, Receipt, Eye, ShieldCheck, Filter,
} from 'lucide-react';

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 3, total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}
import { useBookings } from '@/hooks/use-bookings';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { checkBookingCancellationEligibility } from '@/lib/cancellation-policy';
import { RescheduleBookingModal } from '@/components/bookings/RescheduleBookingModal';
import { BookingReceiptModal } from '@/components/bookings/BookingReceiptModal';
import { InvoiceDetailModal } from '@/components/bookings/InvoiceDetailModal';
import { BookingCancellationModal } from '@/components/bookings/BookingCancellationModal';
import {
  DateRangeFilter,
  DateFilterActiveBadge,
  type DateFilterType,
  type DateRange,
  matchesDateRange,
} from '@/components/dashboard/date-range-filter';

import {
  Booking, normalise, formatDateTime, formatDate, formatTime, initials,
  STATUS_STYLES, PAYMENT_STYLES, STATUS_BAR, statusStyle, paymentStyle,
  CustomerAvatar, DRow, BookingDetailPopup,
} from "@/components/bookings/BookingDetailPopup";

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BookingListPage() {
  const [search,          setSearch]          = useState('');
  const [branchFilter,    setBranchFilter]    = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [payFilter,       setPayFilter]       = useState('');
  const [channelFilter,   setChannelFilter]   = useState('');
  const [showFilters,     setShowFilters]     = useState(false);
  const [viewMode,        setViewMode]        = useState<'grid' | 'list'>('list');
  const [page,            setPage]            = useState(1);
  const [pageSize,        setPageSize]        = useState(20);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Date filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [dateRange,  setDateRange]  = useState<DateRange>({});

  const proxyUrl = useMemo(() => {
    let url = `/api/v1/bookings?page=${page}&page_size=${pageSize}`;
    if (dateRange.from) url += `&date_from=${encodeURIComponent(dateRange.from)}`;
    if (dateRange.to) url += `&date_to=${encodeURIComponent(dateRange.to)}`;
    return url;
  }, [page, pageSize, dateRange]);

  const { data: rawBookings, loading, error, pagination, refetch } = useBookings<Record<string, unknown>>(proxyUrl, []);

  useEffect(() => { setPage(1); }, [search, branchFilter, statusFilter, payFilter, channelFilter, dateFilter, dateRange]);

  const bookings    = useMemo(() => rawBookings.map(normalise), [rawBookings]);
  const branches    = useMemo(() => Array.from(new Set(bookings.map((b) => b.branch_name))).filter(Boolean).sort(),    [bookings]);
  const statuses    = useMemo(() => Array.from(new Set(bookings.map((b) => b.status))).filter(Boolean).sort(),         [bookings]);
  const payStatuses = useMemo(() => Array.from(new Set(bookings.map((b) => b.payment_status))).filter(Boolean).sort(), [bookings]);
  const channels    = useMemo(() => Array.from(new Set(bookings.map((b) => (b.channel || b.source || b.payment_through || '').trim()))).filter(Boolean).sort(), [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanQ = q.replace(/^#/, '');
    const cleanPhoneQ = q.replace(/[\s\-+()]/g, '');

    return bookings.filter((b) => {
      const bPhoneClean = b.customer_phone ? b.customer_phone.replace(/[\s\-+()]/g, '').toLowerCase() : '';
      const bNumClean = b.booking_number ? b.booking_number.toLowerCase().replace(/^#/, '') : '';

      const matchSearch =
        !q ||
        (b.booking_number ? b.booking_number.toLowerCase().includes(q) || (cleanQ ? bNumClean.includes(cleanQ) : false) : false) ||
        b.customer_name.toLowerCase().includes(q) ||
        (b.customer_phone ? b.customer_phone.toLowerCase().includes(q) || (cleanPhoneQ ? bPhoneClean.includes(cleanPhoneQ) : false) : false) ||
        (b.channel ? b.channel.toLowerCase().includes(q) : false);

      const matchBranch  = !branchFilter  || b.branch_name.toLowerCase() === branchFilter.toLowerCase();
      const matchStatus  = !statusFilter  || b.status.toLowerCase()      === statusFilter.toLowerCase();
      const matchPay     = !payFilter     || b.payment_status.toLowerCase() === payFilter.toLowerCase();
      const matchChannel = !channelFilter || (b.channel || b.source || b.payment_through || '').trim().toLowerCase() === channelFilter.trim().toLowerCase();
      const matchDate    = matchesDateRange(b.appointment_start || b.created_at, dateRange);
      return matchSearch && matchBranch && matchStatus && matchPay && matchChannel && matchDate;
    });
  }, [bookings, search, branchFilter, statusFilter, payFilter, channelFilter, dateRange]);

  const hasDateFilter = dateFilter !== 'all';
  const activeCount   = [branchFilter, statusFilter, payFilter, channelFilter].filter(Boolean).length;
  const hasFilter     = Boolean(search || activeCount > 0 || hasDateFilter);
  const clearAll      = () => {
    setSearch('');
    setBranchFilter('');
    setStatusFilter('');
    setPayFilter('');
    setChannelFilter('');
    setDateFilter('all');
    setDateRange({});
  };
  const hasNextPage  = pagination ? page < pagination.total_pages : false;
  const hasPrevPage  = page > 1;
  const totalCount   = pagination?.count ?? rawBookings.length;
  const totalPages   = pagination?.total_pages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  const pageNumbers  = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  return (
    <DashboardShell>
      <PageHeader title="Booking List" subtitle={loading ? 'Loading…' : `${filtered.length} bookings on this page`} />

      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] sm:min-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by booking #, name, phone number…"
            className="h-10 w-full rounded-xl border border-border/60 bg-card pl-9 pr-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Range Filter */}
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

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition cursor-pointer',
            showFilters || activeCount > 0
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border/60 bg-card hover:bg-muted/60',
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {activeCount}
            </span>
          )}
        </button>

        {/* View toggle */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {(['list', 'grid'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition cursor-pointer',
                viewMode === m ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}
            >
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>

        {/* Clear */}
        {hasFilter && (
          <button
            onClick={clearAll}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-card px-4 text-sm text-muted-foreground hover:text-destructive transition cursor-pointer"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}

        <div className="ml-auto hidden sm:flex items-center">
          <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="mt-3 mb-5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Branch */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Payment Status</label>
            <select
              value={payFilter}
              onChange={(e) => setPayFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">All Payment Statuses</option>
              {payStatuses.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Channel / Source */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Channel / Source</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">All Channels / Sources</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c.toLowerCase() === 'ushdesk' ? 'USHDesk' : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Date Filter Badge */}
      <DateFilterActiveBadge
        dateFilter={dateFilter}
        dateRange={dateRange}
        onClear={() => {
          setDateFilter('all');
          setDateRange({});
          setPage(1);
        }}
      />

      {/* Skeleton */}
      {loading && (
        <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn('rounded-2xl shimmer', viewMode === 'grid' ? 'h-52' : 'h-16')} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No bookings found</p>
          <p className="text-xs mt-1 opacity-70">Try adjusting your filters or load a different page</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <div key={b.id} onClick={() => setSelectedBooking(b)}
              className="group rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md cursor-pointer animate-fade-in-up">
              <div className="flex items-center gap-3 mb-3">
                <CustomerAvatar name={b.customer_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{b.customer_name}</p>
                  {b.booking_number && <p className="text-[11px] font-mono font-bold text-primary">{b.booking_number}</p>}
                  {b.customer_phone && <p className="text-xs text-muted-foreground">{b.customer_phone}</p>}
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize shrink-0', statusStyle(b.status))}>{b.status}</span>
              </div>
              <div className="mb-2 rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold text-foreground truncate">{b.service_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {b.service_category ? `${b.service_category} · ` : ''}{b.total_duration || b.duration_minutes} min
                  {(b.addons_duration > 0 || b.extra_minutes > 0) && (
                    <span className="ml-1 text-[10px] text-primary font-medium">
                      ({b.duration_minutes}m{b.addons_duration > 0 ? `+${b.addons_duration}m` : ''}{b.extra_minutes > 0 ? `+${b.extra_minutes}m` : ''})
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3 shrink-0" />{formatDate(b.appointment_start)}<span className="ml-1">{formatTime(b.appointment_start)} – {formatTime(b.appointment_end)}</span></p>
                <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" /> {b.branch_name}</p>
                <p className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" /> {b.therapist_name}</p>
                {b.arrangement_name && <p className="flex items-center gap-1.5"><Scissors className="h-3 w-3 shrink-0" /> {b.arrangement_name}</p>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', paymentStyle(b.payment_status))}>{(b.payment_status || 'unpaid').replace(/_/g, ' ')}</span>
                  {b.payment_gateway && <span className="text-[11px] text-muted-foreground">via {b.payment_gateway}</span>}
                  {b.channel && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      b.channel.toLowerCase() === 'ushdesk'
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                    )}>
                      {b.channel}
                    </span>
                  )}
                </div>
                <p className="font-bold text-sm text-primary">{parseFloat(b.total_amount).toFixed(3)} <span className="text-[11px] font-normal text-muted-foreground">{b.currency}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {/* ── LIST VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <>
          {/* Mobile view: Beautiful responsive cards */}
          <div className="block sm:hidden space-y-3">
            {filtered.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className="group rounded-2xl border border-border/60 bg-card p-4 shadow-xs transition-all active:scale-[0.99] hover:border-primary/40 hover:shadow-md cursor-pointer"
              >
                {/* Header: Avatar, Name, Booking #, Status */}
                <div className="flex items-start justify-between gap-2.5 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CustomerAvatar name={b.customer_name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{b.customer_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {b.booking_number && (
                          <span className="font-mono text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {b.booking_number}
                          </span>
                        )}
                        {b.customer_phone && (
                          <span className="text-[11px] text-muted-foreground truncate">{b.customer_phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize shrink-0', statusStyle(b.status))}>
                    {b.status === 'confirmed' || b.status === 'completed' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {b.status}
                  </span>
                </div>

                {/* Service & Duration */}
                <div className="mb-2.5 rounded-xl bg-muted/40 p-2.5">
                  <p className="text-xs font-semibold text-foreground truncate">{b.service_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {b.service_category ? `${b.service_category} · ` : ''}{b.total_duration || b.duration_minutes} min
                    {(b.addons_duration > 0 || b.extra_minutes > 0) && (
                      <span className="ml-1 text-[10px] text-primary font-medium">
                        ({b.duration_minutes}m{b.addons_duration > 0 ? `+${b.addons_duration}m` : ''}{b.extra_minutes > 0 ? `+${b.extra_minutes}m` : ''})
                      </span>
                    )}
                  </p>
                </div>

                {/* Schedule Info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="h-3 w-3 shrink-0 text-primary/70" />
                    <span className="truncate">{formatDate(b.appointment_start)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="h-3 w-3 shrink-0 text-primary/70" />
                    <span className="truncate">{formatTime(b.appointment_start)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                    <span className="truncate">{b.branch_name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                    <span className="truncate">{b.therapist_name || '—'}</span>
                  </div>
                </div>

                {/* Footer: Payment, Channel, Amount */}
                <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', paymentStyle(b.payment_status))}>
                      {(b.payment_status || 'unpaid').replace(/_/g, ' ')}
                    </span>
                    {b.channel && (
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                        b.channel.toLowerCase() === 'ushdesk'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      )}>
                        {b.channel}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-sm text-primary">
                      {parseFloat(b.total_amount).toFixed(3)}{' '}
                      <span className="text-[10px] font-normal text-muted-foreground">{b.currency}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/Tablet view: Table with clean horizontal scrolling on smaller screens */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm scrollbar-thin">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Branch / Therapist</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date &amp; Time</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Payment</th>
                  <th className="pl-4 pr-6 sm:pr-8 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.id} onClick={() => setSelectedBooking(b)}
                    className={cn('border-b border-border/30 transition hover:bg-primary/5 cursor-pointer', i % 2 !== 0 && 'bg-muted/10')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar name={b.customer_name} size="sm" />
                        <div>
                          <p className="font-semibold text-sm leading-tight">{b.customer_name}</p>
                          {b.booking_number && <p className="text-[11px] font-mono font-bold text-primary">{b.booking_number}</p>}
                          {b.customer_phone && <p className="text-[11px] text-muted-foreground">{b.customer_phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground max-w-[160px] truncate">{b.service_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.service_category ? `${b.service_category} · ` : ''}{b.total_duration || b.duration_minutes} min
                        {(b.addons_duration > 0 || b.extra_minutes > 0) && (
                          <span className="ml-1 text-[10px] text-primary font-medium">
                            ({b.duration_minutes}m{b.addons_duration > 0 ? `+${b.addons_duration}m` : ''}{b.extra_minutes > 0 ? `+${b.extra_minutes}m` : ''})
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="max-w-[160px] truncate">{b.branch_name || '—'}</span>
                        </p>
                        <p className="flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="max-w-[160px] truncate">{b.therapist_name || '—'}</span>
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground space-y-0.5 whitespace-nowrap">
                        <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(b.appointment_start)}</p>
                        <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(b.appointment_start)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-block rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold capitalize">{b.booking_type}</span>
                        {b.channel && (
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            b.channel.toLowerCase() === 'ushdesk'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          )}>
                            {b.channel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', statusStyle(b.status))}>
                        {b.status === 'confirmed' || b.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', paymentStyle(b.payment_status))}>
                        {b.payment_status ? b.payment_status.replace(/_/g, ' ') : '—'}
                      </span>
                    </td>
                    <td className="pl-4 pr-6 sm:pr-8 py-3 text-right">
                      <p className="font-bold text-sm text-primary whitespace-nowrap">{parseFloat(b.total_amount).toFixed(3)}</p>
                      <p className="text-[11px] text-muted-foreground">{b.currency}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {/* Left: Summary & page size selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing{' '}
              <strong className="text-foreground font-semibold">
                {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>
              –
              <strong className="text-foreground font-semibold">
                {Math.min(page * pageSize, totalCount)}
              </strong>{' '}
              of <strong className="text-foreground font-semibold">{totalCount.toLocaleString()}</strong> bookings
            </span>

            <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-muted/40 px-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
              >
                {[10, 20, 50, 100].map((sz) => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Page navigation buttons and jump */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <span>Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                defaultValue={page}
                key={`jump-${page}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val >= 1 && val <= totalPages) setPage(val);
                  }
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages && val !== page) setPage(val);
                }}
                className="h-8 w-14 rounded-lg border border-border bg-card px-2 text-center text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First page"
              aria-label="First page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                page === 1
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevPage}
              title="Previous page"
              aria-label="Previous page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                !hasPrevPage
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) => {
                if (p === 'ellipsis') {
                  return (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
                  );
                }
                const isCurrent = p === page;
                return (
                  <button
                    key={`page-${p}`}
                    onClick={() => setPage(p)}
                    className={cn(
                      'flex h-8 min-w-8 px-2 items-center justify-center rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer',
                      isCurrent
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNextPage}
              title="Next page"
              aria-label="Next page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                !hasNextPage
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Last page"
              aria-label="Last page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                page === totalPages
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <BookingDetailPopup booking={selectedBooking} onClose={() => setSelectedBooking(null)} onSuccess={refetch} />
    </DashboardShell>
  );
}
