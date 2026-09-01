'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Search, LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, Calendar, Clock, MapPin, User, Scissors,
  CreditCard, CheckCircle2, XCircle, BookOpen,
  ChevronLeft, ChevronRight, X, ExternalLink, Hash, Home,
} from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  branch_name: string;
  service_name: string;
  service_category: string;
  service_price: string;
  arrangement_name: string | null;
  therapist_name: string;
  appointment_start: string;
  appointment_end: string;
  duration_minutes: number;
  booking_type: string;
  status: string;
  payment_status: string;
  payment_gateway: string | null;
  payment_url: string | null;
  is_paid: boolean;
  total_amount: string;
  currency: string;
  created_at: string;
}

// ── Normalise ──────────────────────────────────────────────────────────────────
function normalise(raw: Record<string, unknown>): Booking {
  const cd  = (raw.customer_data            ?? {}) as Record<string, unknown>;
  const bd  = (raw.branch_data              ?? {}) as Record<string, unknown>;
  const sd  = (raw.service_data             ?? {}) as Record<string, unknown>;
  const sad = (raw.service_arrangement_data ?? {}) as Record<string, unknown>;
  const td  = (raw.therapist_data           ?? {}) as Record<string, unknown>;
  const pm  = (raw.payments_meta            ?? {}) as Record<string, unknown>;
  const pd  = (raw.payment_data             ?? {}) as Record<string, unknown>;
  const firstName = String(cd.first_name ?? '');
  const lastName  = String(cd.last_name  ?? '');
  return {
    id:                String(raw.id ?? ''),
    customer_name:     [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Customer',
    customer_phone:    (cd.phone_number ?? null) as string | null,
    customer_email:    (cd.email        ?? null) as string | null,
    branch_name:       String(bd.branch_name ?? bd.name ?? raw.branch_id ?? ''),
    service_name:      String(sd.name ?? ''),
    service_category:  String(sd.category ?? ''),
    service_price:     String(sd.base_price ?? '0'),
    arrangement_name:  (sad.arrangement_name ?? sad.room_name ?? null) as string | null,
    therapist_name:    String(td.therapist_name ?? td.name ?? '—'),
    appointment_start: String(raw.appointment_start ?? ''),
    appointment_end:   String(raw.appointment_end   ?? ''),
    duration_minutes:  Number(raw.duration_minutes  ?? 0),
    booking_type:      String(raw.booking_type      ?? 'branch'),
    status:            String(raw.status            ?? 'pending').toLowerCase(),
    payment_status:    String(raw.payment_status    ?? '').toLowerCase(),
    payment_gateway:   (pm.payment_gateway ?? pd.payment_gateway ?? null) as string | null,
    payment_url:       (pd.payment_url     ?? pm.payment_url     ?? null) as string | null,
    is_paid:           pm.is_paid === true || pd.is_paid === true,
    total_amount:      String(raw.total_amount ?? '0'),
    currency:          String(raw.currency     ?? 'KWD'),
    created_at:        String(raw.created_at   ?? ''),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// ── Style maps ─────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  no_show:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const PAYMENT_STYLES: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  failed:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const STATUS_BAR: Record<string, string> = {
  confirmed: 'bg-blue-400', completed: 'bg-emerald-400',
  cancelled: 'bg-red-400',  pending:   'bg-amber-400', no_show: 'bg-slate-400',
};
const statusStyle  = (s: string) => STATUS_STYLES[s]  ?? 'bg-muted text-muted-foreground';
const paymentStyle = (s: string) => PAYMENT_STYLES[s] ?? 'bg-muted text-muted-foreground';

// ── Sub-components ─────────────────────────────────────────────────────────────
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

function CustomerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['from-sky-400 to-blue-500','from-violet-400 to-purple-500','from-rose-400 to-pink-500','from-emerald-400 to-teal-500','from-amber-400 to-orange-500'];
  const idx = name.charCodeAt(0) % colors.length;
  const sz = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={cn('shrink-0 rounded-xl bg-gradient-to-br font-bold text-white grid place-items-center', sz, colors[idx])}>
      {initials(name)}
    </div>
  );
}

function DRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/30 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-bold text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

// ── Booking Detail Modal ───────────────────────────────────────────────────────
function BookingDetailModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  useEffect(() => {
    if (!booking) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [booking, onClose]);

  if (!booking) return null;
  const accentBar = STATUS_BAR[booking.status] ?? 'bg-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className={cn('h-1.5 w-full rounded-t-3xl', accentBar)} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <CustomerAvatar name={booking.customer_name} size="lg" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</p>
              <p className="text-base font-extrabold leading-tight">{booking.customer_name}</p>
              {booking.customer_phone && <p className="text-xs text-muted-foreground mt-0.5">{booking.customer_phone}</p>}
              {booking.customer_email && <p className="text-xs text-muted-foreground">{booking.customer_email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize', statusStyle(booking.status))}>
              {booking.status === 'confirmed' || booking.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {booking.status}
            </span>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <DRow icon={Hash} label="Booking ID"><span className="font-mono tracking-wide">{booking.id}</span></DRow>
          <DRow icon={Scissors} label="Service">
            {booking.service_name}
            {booking.service_category && <span className="ml-2 text-[11px] font-normal text-muted-foreground">({booking.service_category})</span>}
          </DRow>
          {booking.arrangement_name && <DRow icon={Home} label="Arrangement / Room">{booking.arrangement_name}</DRow>}
          <div className="grid grid-cols-2 gap-3">
            <DRow icon={Calendar} label="Date">{formatDate(booking.appointment_start)}</DRow>
            <DRow icon={Clock} label="Time">
              {formatTime(booking.appointment_start)} – {formatTime(booking.appointment_end)}
              <span className="block text-[11px] font-normal text-muted-foreground">{booking.duration_minutes} min</span>
            </DRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DRow icon={MapPin} label="Branch">{booking.branch_name || '—'}</DRow>
            <DRow icon={User} label="Therapist">{booking.therapist_name}</DRow>
          </div>
          <DRow icon={BookOpen} label="Booking Type"><span className="capitalize">{booking.booking_type}</span></DRow>
          <DRow icon={Calendar} label="Booked On">{formatDateTime(booking.created_at)}</DRow>

          {/* Payment block */}
          <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/20 to-muted/5 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Payment Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-card border border-border/50 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Status</p>
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-bold capitalize', paymentStyle(booking.payment_status))}>
                  {booking.payment_status || '—'}
                </span>
              </div>
              <div className="rounded-xl bg-card border border-border/50 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Amount</p>
                <p className="text-base font-extrabold text-primary leading-tight">
                  {parseFloat(booking.total_amount).toFixed(3)}{' '}
                  <span className="text-[11px] font-normal text-muted-foreground">{booking.currency}</span>
                </p>
              </div>
            </div>
            {booking.payment_gateway && (
              <div className="rounded-xl bg-card border border-border/50 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Gateway</p>
                <p className="text-sm font-semibold capitalize">{booking.payment_gateway}</p>
              </div>
            )}
            {booking.payment_url && (
              <div className="rounded-xl bg-card border border-border/50 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">Payment Link</p>
                <a href={booking.payment_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline break-all">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {booking.payment_url}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border/40 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border/60 bg-muted/40 py-2.5 text-sm font-semibold hover:bg-muted transition">
            Close
          </button>
          {booking.payment_url && (
            <a href={booking.payment_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 transition">
              <ExternalLink className="h-4 w-4" /> Open Payment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BookingListPage() {
  const [search,          setSearch]          = useState('');
  const [branchFilter,    setBranchFilter]    = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');
  const [typeFilter,      setTypeFilter]      = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [payFilter,       setPayFilter]       = useState('');
  const [viewMode,        setViewMode]        = useState<'grid' | 'list'>('list');
  const [page,            setPage]            = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const proxyUrl = `/api/v1/bookings?page=${page}&page_size=20`;
  const { data: rawBookings, loading, error, pagination, refetch } = useBookings<Record<string, unknown>>(proxyUrl, []);

  useEffect(() => { setPage(1); }, [search, branchFilter, therapistFilter, typeFilter, statusFilter, payFilter]);

  const bookings    = useMemo(() => rawBookings.map(normalise), [rawBookings]);
  const branches    = useMemo(() => Array.from(new Set(bookings.map((b) => b.branch_name))).filter(Boolean).sort(),    [bookings]);
  const therapists  = useMemo(() => Array.from(new Set(bookings.map((b) => b.therapist_name))).filter(Boolean).sort(), [bookings]);
  const types       = useMemo(() => Array.from(new Set(bookings.map((b) => b.booking_type))).filter(Boolean).sort(),   [bookings]);
  const statuses    = useMemo(() => Array.from(new Set(bookings.map((b) => b.status))).filter(Boolean).sort(),         [bookings]);
  const payStatuses = useMemo(() => Array.from(new Set(bookings.map((b) => b.payment_status))).filter(Boolean).sort(), [bookings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter((b) => {
      const matchSearch    = !q || b.customer_name.toLowerCase().includes(q) || b.customer_phone?.includes(q) || b.service_name.toLowerCase().includes(q);
      const matchBranch    = !branchFilter    || b.branch_name    === branchFilter;
      const matchTherapist = !therapistFilter || b.therapist_name === therapistFilter;
      const matchType      = !typeFilter      || b.booking_type   === typeFilter;
      const matchStatus    = !statusFilter    || b.status         === statusFilter;
      const matchPay       = !payFilter       || b.payment_status === payFilter;
      return matchSearch && matchBranch && matchTherapist && matchType && matchStatus && matchPay;
    });
  }, [bookings, search, branchFilter, therapistFilter, typeFilter, statusFilter, payFilter]);

  const hasFilter   = search || branchFilter || therapistFilter || typeFilter || statusFilter || payFilter;
  const clearAll    = () => { setSearch(''); setBranchFilter(''); setTherapistFilter(''); setTypeFilter(''); setStatusFilter(''); setPayFilter(''); };
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
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone, service…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <SelectFilter label="All Branches"   value={branchFilter}    options={branches}    onChange={setBranchFilter} />
        <SelectFilter label="All Therapists" value={therapistFilter} options={therapists}  onChange={setTherapistFilter} />
        <SelectFilter label="All Types"      value={typeFilter}      options={types}       onChange={setTypeFilter} />
        <SelectFilter label="All Statuses"   value={statusFilter}    options={statuses}    onChange={setStatusFilter} />
        <SelectFilter label="Payment Status" value={payFilter}       options={payStatuses} onChange={setPayFilter} />
        {hasFilter && (
          <button onClick={clearAll} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition">Clear</button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['grid', 'list'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn('flex h-10 w-10 items-center justify-center transition', viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground')}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}>
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
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
                  {b.customer_phone && <p className="text-xs text-muted-foreground">{b.customer_phone}</p>}
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize shrink-0', statusStyle(b.status))}>{b.status}</span>
              </div>
              <div className="mb-2 rounded-xl bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold text-foreground truncate">{b.service_name}</p>
                <p className="text-[11px] text-muted-foreground">{b.service_category} · {b.duration_minutes} min</p>
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
                        {b.customer_phone && <p className="text-[11px] text-muted-foreground">{b.customer_phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-xs font-semibold text-foreground max-w-[160px] truncate">{b.service_name}</p>
                    <p className="text-[11px] text-muted-foreground">{b.duration_minutes} min</p>
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
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </DashboardShell>
  );
}
