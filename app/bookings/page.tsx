'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, Calendar, Clock, MapPin, User, Scissors,
  CreditCard, CheckCircle2, XCircle, BookOpen,
  ChevronLeft, ChevronRight, X, ExternalLink, Hash, Home,
  History, Info, UserCheck, Copy, Check, Plus, Banknote, Printer, Loader2,
  FileText, Receipt, Eye, ShieldCheck,
} from 'lucide-react';
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
  Booking, normalise, formatDateTime, formatDate, formatTime, initials,
  STATUS_STYLES, PAYMENT_STYLES, STATUS_BAR, statusStyle, paymentStyle,
  CustomerAvatar, DRow, BookingDetailPopup,
} from "@/components/bookings/BookingDetailPopup";

function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BookingListPage() {
  const [search,          setSearch]          = useState('');
  const [branchFilter,    setBranchFilter]    = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [payFilter,       setPayFilter]       = useState('');
  const [viewMode,        setViewMode]        = useState<'grid' | 'list'>('list');
  const [page,            setPage]            = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const proxyUrl = `/api/v1/bookings?page=${page}&page_size=20`;
  const { data: rawBookings, loading, error, pagination, refetch } = useBookings<Record<string, unknown>>(proxyUrl, []);

  useEffect(() => { setPage(1); }, [search, branchFilter, statusFilter, payFilter]);

  const bookings    = useMemo(() => rawBookings.map(normalise), [rawBookings]);
  const branches    = useMemo(() => Array.from(new Set(bookings.map((b) => b.branch_name))).filter(Boolean).sort(),    [bookings]);
  const statuses    = useMemo(() => Array.from(new Set(bookings.map((b) => b.status))).filter(Boolean).sort(),         [bookings]);
  const payStatuses = useMemo(() => Array.from(new Set(bookings.map((b) => b.payment_status))).filter(Boolean).sort(), [bookings]);

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
        (b.customer_phone ? b.customer_phone.toLowerCase().includes(q) || (cleanPhoneQ ? bPhoneClean.includes(cleanPhoneQ) : false) : false);

      const matchBranch = !branchFilter || b.branch_name    === branchFilter;
      const matchStatus = !statusFilter || b.status         === statusFilter;
      const matchPay    = !payFilter    || b.payment_status === payFilter;
      return matchSearch && matchBranch && matchStatus && matchPay;
    });
  }, [bookings, search, branchFilter, statusFilter, payFilter]);

  const hasFilter   = search || branchFilter || statusFilter || payFilter;
  const clearAll    = () => { setSearch(''); setBranchFilter(''); setStatusFilter(''); setPayFilter(''); };
  const hasNextPage = pagination ? page < pagination.total_pages : false;
  const totalCount  = pagination?.count ?? rawBookings.length;

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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px] sm:min-w-[360px] md:min-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by booking #, name, phone number…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        <SelectFilter label="All Branches"   value={branchFilter}    options={branches}    onChange={setBranchFilter} />
        <SelectFilter label="All Statuses"   value={statusFilter}    options={statuses}    onChange={setStatusFilter} />
        <SelectFilter label="Payment Status" value={payFilter}       options={payStatuses} onChange={setPayFilter} />
        {hasFilter && (
          <button onClick={clearAll} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition cursor-pointer">Clear</button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(['grid', 'list'] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={cn('flex h-10 w-10 items-center justify-center transition cursor-pointer', viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground')}
                aria-label={m === 'grid' ? 'Grid view' : 'List view'}>
                {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

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
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', paymentStyle(b.payment_status))}>{b.payment_status || 'unpaid'}</span>
                  {b.payment_gateway && <span className="text-[11px] text-muted-foreground">via {b.payment_gateway}</span>}
                </div>
                <p className="font-bold text-sm text-primary">{parseFloat(b.total_amount).toFixed(3)} <span className="text-[11px] font-normal text-muted-foreground">{b.currency}</span></p>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">Therapist</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden xl:table-cell">Date &amp; Time</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
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
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs font-semibold text-foreground max-w-[160px] truncate">{b.service_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.total_duration || b.duration_minutes} min
                      {(b.addons_duration > 0 || b.extra_minutes > 0) && (
                        <span className="ml-1 text-[10px] text-primary font-medium">
                          ({b.duration_minutes}m{b.addons_duration > 0 ? `+${b.addons_duration}m` : ''}{b.extra_minutes > 0 ? `+${b.extra_minutes}m` : ''})
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /><span className="max-w-[140px] truncate">{b.branch_name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3 shrink-0" /> {b.therapist_name}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(b.appointment_start)}</p>
                      <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatTime(b.appointment_start)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-center">
                    <span className="inline-block rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold capitalize">{b.booking_type}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', statusStyle(b.status))}>
                      {b.status === 'confirmed' || b.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-center">
                    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', paymentStyle(b.payment_status))}>
                      {b.payment_status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold text-sm text-primary whitespace-nowrap">{parseFloat(b.total_amount).toFixed(3)}</p>
                    <p className="text-[11px] text-muted-foreground">{b.currency}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {pagination ? `Page ${page} of ${pagination.total_pages} · ${totalCount} total` : `Page ${page}`}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className={cn('flex h-9 w-9 items-center justify-center rounded-xl border transition', page === 1 ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed' : 'border-border bg-card hover:bg-muted text-muted-foreground')}
              aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasNextPage}
              className={cn('flex h-9 w-9 items-center justify-center rounded-xl border transition', !hasNextPage ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed' : 'border-border bg-card hover:bg-muted text-muted-foreground')}
              aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      <BookingDetailPopup booking={selectedBooking} onClose={() => setSelectedBooking(null)} onSuccess={refetch} />
    </DashboardShell>
  );
}
