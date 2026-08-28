'use client';

import { useMemo, useState } from 'react';
import {
  MapPin, Phone, Store, Users, RefreshCw, AlertCircle,
  Clock, Globe, LayoutGrid, List, Image as ImageIcon,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { useApiList } from '@/hooks/use-api-list';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { formatCurrency, earningsOf, startOfMonth, endOfMonth, appointmentsInRange } from '@/lib/helpers';
import { DEMO_BRANCHES } from '@/data/mockData';
import { cn } from '@/lib/utils';

// ── Extended internal type (covers new API shape) ──────────────────────────────
interface BranchRow {
  id: string;
  name: string;
  description: string | null;
  city: string;
  country: string | null;
  address: string | null;
  phone: string | null;
  color: string;
  open_time: string | null;
  close_time: string | null;
  status: string;
  image1: string | null;
  image2: string | null;
  image3: string | null;
  latitude: string | null;
  longitude: string | null;
}

// ── Normalise: handles both old mock shape and new API shape ───────────────────
function normalise(raw: Record<string, unknown>): BranchRow {
  return {
    id:          String(raw.id ?? raw.branch_id ?? ''),
    name:        String(raw.name ?? raw.branch_name ?? ''),
    description: (raw.description ?? null) as string | null,
    city:        String(raw.city ?? raw.location ?? ''),
    country:     (raw.country ?? null) as string | null,
    address:     (raw.address ?? null) as string | null,
    phone:       (raw.phone ?? raw.phone_number ?? null) as string | null,
    color:       String(raw.color ?? raw.brand_color ?? '#C4656A'),
    // API sends opening_time / closing_time; mock uses open_time / close_time
    open_time:   (raw.opening_time ?? raw.open_time ?? null) as string | null,
    close_time:  (raw.closing_time ?? raw.close_time ?? null) as string | null,
    status:      String(raw.status ?? 'active').toLowerCase(),
    image1:      (raw.image1 ?? null) as string | null,
    image2:      (raw.image2 ?? null) as string | null,
    image3:      (raw.image3 ?? null) as string | null,
    latitude:    (raw.latitude ?? null) as string | null,
    longitude:   (raw.longitude ?? null) as string | null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(t: string | null) {
  if (!t) return null;
  // strip seconds if present (HH:MM:SS → HH:MM)
  const [hh, mm] = t.split(':');
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function locationLabel(b: BranchRow) {
  const parts: string[] = [];
  if (b.address) parts.push(b.address);
  if (b.city)    parts.push(b.city);
  if (b.country) parts.push(b.country);
  return parts.join(', ') || '—';
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
      active
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-muted text-muted-foreground',
    )}>
      {active
        ? <CheckCircle2 className="h-3 w-3" />
        : <XCircle className="h-3 w-3" />
      }
      {status}
    </span>
  );
}

// ── Branch image header (card) ─────────────────────────────────────────────────
function BranchImageHeader({ branch }: { branch: BranchRow }) {
  if (branch.image1) {
    return (
      <div className="relative h-40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branch.image1}
          alt={branch.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <p className="font-bold text-white text-base leading-tight drop-shadow">{branch.name}</p>
          <StatusBadge status={branch.status} />
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative h-28 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${branch.color}, ${branch.color}99)` }}
    >
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white, transparent 40%)' }} />
      <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
        <div className="flex items-center gap-2 text-white">
          <Store className="h-5 w-5 shrink-0" />
          <p className="font-bold text-base leading-tight">{branch.name}</p>
        </div>
        <StatusBadge status={branch.status} />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BranchesPage() {
  const { t } = useI18n();
  const appointments = useAppSelector((s) => s.data.appointments);
  const staff        = useAppSelector((s) => s.data.staff);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: rawBranches, loading, error, refetch } = useApiList<Record<string, unknown>>(
    '/api/v1/branches',
    DEMO_BRANCHES as unknown as Record<string, unknown>[],
  );

  const branches = useMemo(() => rawBranches.map(normalise), [rawBranches]);

  const now = new Date();
  const monthAppts = useMemo(
    () => appointmentsInRange(appointments, startOfMonth(now), endOfMonth(now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments],
  );

  return (
    <DashboardShell>
      <PageHeader
        title={t('navBranches')}
        subtitle={loading ? 'Loading…' : `${branches.length} ${t('navBranches').toLowerCase()}`}
      />

      {/* Error banner */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error} — showing demo data</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      {!loading && (
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{branches.length} branches</span>
          {/* View toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(['grid', 'list'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center transition',
                  viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground',
                )}
                aria-label={m === 'grid' ? 'Grid view' : 'List view'}
              >
                {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl shimmer" />
          ))}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => {
            const appts      = monthAppts.filter((a) => a.branch_id === b.id);
            const earnings   = earningsOf(appts);
            const staffCount = staff.filter((s) => s.branch_id === b.id).length;
            const openFmt    = formatTime(b.open_time);
            const closeFmt   = formatTime(b.close_time);

            return (
              <div key={b.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:shadow-lg animate-fade-in-up">
                {/* Image / color header */}
                <BranchImageHeader branch={b} />

                <div className="p-4">
                  {/* Description */}
                  {b.description && (
                    <p className="mb-3 text-xs text-muted-foreground leading-relaxed line-clamp-2">{b.description}</p>
                  )}

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {/* Location */}
                    <p className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="leading-snug">{locationLabel(b)}</span>
                    </p>

                    {/* Phone */}
                    {b.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" /> {b.phone}
                      </p>
                    )}

                    {/* Hours */}
                    {(openFmt || closeFmt) && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 shrink-0" />
                        {openFmt ?? '?'} – {closeFmt ?? '?'}
                      </p>
                    )}

                    {/* Coordinates */}
                    {b.latitude && b.longitude && (
                      <p className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 shrink-0" />
                        {parseFloat(b.latitude).toFixed(4)}, {parseFloat(b.longitude).toFixed(4)}
                      </p>
                    )}

                    {/* Staff count */}
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 shrink-0" /> {staffCount} {t('staff').toLowerCase()}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('reportBookings')}</p>
                      <p className="text-lg font-bold">{appts.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('reportEarnings')}</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(earnings, t('currency'))}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && viewMode === 'list' && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-10"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Location</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Hours</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden lg:table-cell">Staff</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Bookings</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground hidden sm:table-cell">Earnings</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b, i) => {
                const appts      = monthAppts.filter((a) => a.branch_id === b.id);
                const earnings   = earningsOf(appts);
                const staffCount = staff.filter((s) => s.branch_id === b.id).length;
                const openFmt    = formatTime(b.open_time);
                const closeFmt   = formatTime(b.close_time);

                return (
                  <tr
                    key={b.id}
                    className={cn(
                      'border-b border-border/30 transition hover:bg-muted/30',
                      i % 2 !== 0 && 'bg-muted/10',
                    )}
                  >
                    {/* Thumbnail */}
                    <td className="px-3 py-3 w-14">
                      {b.image1 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.image1}
                          alt={b.name}
                          className="h-10 w-10 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${b.color}, ${b.color}88)` }}
                        >
                          <Store className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </td>

                    {/* Name + description */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm">{b.name}</p>
                      {b.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 max-w-[220px]">{b.description}</p>
                      )}
                      {b.phone && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
                          <Phone className="h-3 w-3" /> {b.phone}
                        </p>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="leading-snug max-w-[200px]">{locationLabel(b)}</span>
                      </p>
                      {b.latitude && b.longitude && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          <Globe className="h-2.5 w-2.5 shrink-0" />
                          {parseFloat(b.latitude).toFixed(4)}, {parseFloat(b.longitude).toFixed(4)}
                        </p>
                      )}
                    </td>

                    {/* Hours */}
                    <td className="px-4 py-3 hidden md:table-cell text-center">
                      {openFmt && closeFmt ? (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {openFmt} – {closeFmt}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Staff */}
                    <td className="px-4 py-3 hidden lg:table-cell text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        <Users className="h-3 w-3 text-muted-foreground" /> {staffCount}
                      </span>
                    </td>

                    {/* Bookings */}
                    <td className="px-4 py-3 hidden md:table-cell text-center">
                      <span className="text-sm font-bold">{appts.length}</span>
                    </td>

                    {/* Earnings */}
                    <td className="px-4 py-3 hidden sm:table-cell text-right">
                      <span className="text-sm font-bold text-primary">{formatCurrency(earnings, t('currency'))}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}

