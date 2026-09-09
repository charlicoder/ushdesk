'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Clock, Search, Building2,
  LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, X, Layers, TrendingUp, Home,
  Eye, Info,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import type { TranslationKey } from '@/lib/i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { formatCurrency } from '@/lib/helpers';

import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { ServiceDetailModal, type BranchInfo } from '@/components/services/ServiceDetailModal';

// ── Category / Role Palette ──────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { badge: string; dot: string; gradient: string }> = {
  Massage: {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    dot:   'bg-emerald-500',
    gradient: 'from-emerald-800 via-emerald-700/60 to-emerald-900',
  },
  Facial: {
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
    dot:   'bg-sky-500',
    gradient: 'from-sky-800 via-sky-700/60 to-sky-900',
  },
  Body: {
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25',
    dot:   'bg-violet-500',
    gradient: 'from-violet-800 via-violet-700/60 to-violet-900',
  },
  Nails: {
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    dot:   'bg-rose-500',
    gradient: 'from-rose-800 via-rose-700/60 to-rose-900',
  },
  Hair: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    dot:   'bg-amber-500',
    gradient: 'from-amber-800 via-amber-700/60 to-amber-900',
  },
  Wellness: {
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25',
    dot:   'bg-teal-500',
    gradient: 'from-teal-800 via-teal-700/60 to-teal-900',
  },
  Package: {
    badge: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25',
    dot:   'bg-fuchsia-500',
    gradient: 'from-fuchsia-800 via-fuchsia-700/60 to-fuchsia-900',
  },
};

function getCatStyle(cat: string) {
  return CATEGORY_STYLES[cat] ?? {
    badge: 'bg-primary/10 text-primary border-primary/20',
    dot:   'bg-primary',
    gradient: 'from-slate-800 via-slate-700/60 to-slate-900',
  };
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ServiceRow {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
  description: string | null;
  image: string | null;
  can_do_home_service: boolean;
  branch_ids: string[];
  branches: BranchInfo[];
  bookings: number;
  raw: Record<string, unknown>;
}

// ── Normalise ─────────────────────────────────────────────────────────────────
function normaliseService(
  raw: Record<string, unknown>,
  appointmentCount: number,
  appointmentBranches: string[],
): ServiceRow {
  let branchIds: string[] = [];
  const branchList: BranchInfo[] = [];

  // Parse branches from service item (supports [{ id, name }], string IDs, etc.)
  if (Array.isArray(raw.branches)) {
    raw.branches.forEach((b) => {
      if (typeof b === 'object' && b !== null) {
        const bObj = b as Record<string, unknown>;
        const bId = String(bObj.id ?? bObj.branch_id ?? bObj.uuid ?? '');
        const bName = String(bObj.name ?? bObj.branch_name ?? bObj.title ?? bId);
        if (bId) {
          branchIds.push(bId);
          branchList.push({ id: bId, name: bName });
        }
      } else if (typeof b === 'string' || typeof b === 'number') {
        const bId = String(b);
        if (bId) {
          branchIds.push(bId);
          branchList.push({ id: bId, name: bId });
        }
      }
    });
  } else if (Array.isArray(raw.branch_ids)) {
    branchIds = raw.branch_ids.map(String);
  } else if (raw.branch_id) {
    branchIds = [String(raw.branch_id)];
  }

  if (branchIds.length === 0 && appointmentBranches.length > 0) {
    branchIds = appointmentBranches;
  }

  // Use duration_minutes as requested
  const duration = Number(
    raw.duration_minutes ??
    raw.duration_min ??
    raw.duration ??
    60,
  );

  return {
    id:                  String(raw.id ?? raw.service_id ?? ''),
    name:                String(raw.name ?? raw.service_name ?? 'Unnamed Service'),
    category:            String(raw.category ?? raw.service_category ?? 'General'),
    duration_minutes:    duration,
    price:               Number(raw.price ?? raw.base_price ?? raw.cost ?? 0),
    description:         (raw.description ?? raw.desc ?? null) as string | null,
    image:               (raw.image ?? raw.image_url ?? raw.image1 ?? raw.photo ?? raw.thumbnail ?? null) as string | null,
    can_do_home_service: raw.is_home_service_eligible === true || raw.can_do_home_service === true || raw.home_service === true,
    branch_ids:          branchIds,
    branches:            branchList,
    bookings:            appointmentCount,
    raw,
  };
}

// ── Select Filter ─────────────────────────────────────────────────────────────
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

// ── Thumbnail (shared by both views) ─────────────────────────────────────────
function ServiceThumb({
  image,
  name,
  category,
  className = '',
  iconSize = 'md',
}: {
  image: string | null;
  name: string;
  category: string;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}) {
  const catStyle = getCatStyle(category);
  const [err, setErr] = useState(false);
  const iconCls = iconSize === 'sm' ? 'h-4 w-4' : iconSize === 'lg' ? 'h-8 w-8' : 'h-6 w-6';

  return (
    <div className={cn('relative overflow-hidden shrink-0', className)}>
      {image && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          onError={() => setErr(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', catStyle.gradient)}>
          <Sparkles className={cn(iconCls, 'text-white/80')} />
        </div>
      )}
    </div>
  );
}

// ── Grid Card ────────────────────────────────────────────────────────────────
function GridCard({
  s,
  branchSummary,
  t,
  onSelect,
}: {
  s: ServiceRow;
  branchSummary: string;
  t: (k: TranslationKey) => string;
  onSelect: (s: ServiceRow) => void;
}) {
  const catStyle = getCatStyle(s.category);

  return (
    <div
      onClick={() => onSelect(s)}
      className="group flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/40 cursor-pointer animate-fade-in-up"
    >
      {/* Large image header */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <ServiceThumb image={s.image} name={s.name} category={s.category} className="h-full w-full" iconSize="lg" />
        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {/* Category badge overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 border border-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <span className={cn('h-1.5 w-1.5 rounded-full', catStyle.dot)} />
            {s.category}
          </span>
          <span className="rounded-full bg-black/50 border border-white/15 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {formatCurrency(Number(s.price), t('currency'))}
          </span>
        </div>

        {/* Hover Quick View pill */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
            <Eye className="h-3 w-3 text-primary" />
            Details
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
            {s.name}
          </h3>
          {s.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {s.description}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-muted-foreground border-t border-border/40 pt-3">
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {s.duration_minutes} {t('min')}
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <TrendingUp className="h-3 w-3 text-primary/70" />
            {s.bookings} {t('reportBookings').toLowerCase()}
          </span>
          <span className="inline-flex items-center gap-1 font-medium truncate max-w-[130px]">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{branchSummary}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── List Row ─────────────────────────────────────────────────────────────────
function ListRow({
  s,
  branchSummary,
  t,
  onSelect,
}: {
  s: ServiceRow;
  branchSummary: string;
  t: (k: TranslationKey) => string;
  onSelect: (s: ServiceRow) => void;
}) {
  const catStyle = getCatStyle(s.category);

  return (
    <div
      onClick={() => onSelect(s)}
      className="group grid grid-cols-[56px_1fr_auto_auto_auto_auto_auto] items-center gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:bg-card/80 cursor-pointer animate-fade-in-up"
    >
      {/* Thumbnail — small, fixed */}
      <ServiceThumb
        image={s.image}
        name={s.name}
        category={s.category}
        className="h-14 w-14 rounded-xl border border-border/50"
        iconSize="sm"
      />

      {/* Name + description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {s.name}
          </span>
          <span className={cn('inline-flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', catStyle.badge)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', catStyle.dot)} />
            {s.category}
          </span>
        </div>
        {s.description && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{s.description}</p>
        )}
      </div>

      {/* Duration */}
      <div className="flex flex-col items-center gap-0.5 text-center shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duration</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {s.duration_minutes} {t('min')}
        </span>
      </div>

      {/* Bookings */}
      <div className="flex flex-col items-center gap-0.5 text-center shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bookings</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
          {s.bookings}
        </span>
      </div>

      {/* Branch */}
      <div className="flex flex-col items-center gap-0.5 text-center shrink-0 max-w-[140px]">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Branch</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground truncate max-w-full">
          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{branchSummary}</span>
        </span>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Price</span>
        <span className="text-base font-extrabold text-primary">
          {formatCurrency(Number(s.price), t('currency'))}
        </span>
      </div>

      {/* View Details action */}
      <div className="shrink-0 pl-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(s);
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
        >
          <Eye className="h-3.5 w-3.5" />
          Details
        </button>
      </div>
    </div>
  );
}

// ── List Column Headers ───────────────────────────────────────────────────────
function ListHeader() {
  return (
    <div className="grid grid-cols-[56px_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-2 mb-1">
      <div />
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Service</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-center w-24">Duration</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-center w-20">Bookings</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-center w-36">Branch</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right w-24">Price</span>
      <span className="w-16" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { t } = useI18n();
  const token       = useAppSelector((s) => s.auth.token);
  const initialized = useAppSelector((s) => s.auth.initialized);


  // API State
  const [rawServices, setRawServices] = useState<Record<string, unknown>[]>([]);
  const [responseBranches, setResponseBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // UI state
  const [search,         setSearch]         = useState('');
  const [branchFilter,   setBranchFilter]   = useState('');
  const [homeFilter,     setHomeFilter]     = useState(false);
  const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid');
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Fetch /api/v1/services and extract both services and response-level `branches`
  useEffect(() => {
    if (!initialized) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    authedFetch('/api/v1/services', { headers })
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

        // 1. Extract branches from response key `branches` (top-level or nested)
        const foundBranches: Array<{ id: string; name: string }> = [];
        const rawBranches = (json?.branches ?? json?.data?.branches) as unknown;
        if (Array.isArray(rawBranches)) {
          rawBranches.forEach((b) => {
            if (typeof b === 'object' && b !== null) {
              const bObj = b as Record<string, unknown>;
              const bId = String(bObj.id ?? bObj.branch_id ?? '');
              const bName = String(bObj.name ?? bObj.branch_name ?? bObj.title ?? bId);
              if (bId) foundBranches.push({ id: bId, name: bName });
            } else if (typeof b === 'string' || typeof b === 'number') {
              foundBranches.push({ id: String(b), name: String(b) });
            }
          });
        }
        setResponseBranches(foundBranches);

        // 2. Unwrap services list
        let list: Record<string, unknown>[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (json?.success && Array.isArray(json?.data)) {
          list = json.data;
        } else if (json?.success && json?.data && typeof json.data === 'object') {
          const inner = json.data as Record<string, unknown>;
          list = (Array.isArray(inner.results)
            ? inner.results
            : Array.isArray(inner.services)
            ? inner.services
            : Object.values(inner)) as Record<string, unknown>[];
        } else if (Array.isArray(json?.results)) {
          list = json.results;
        } else if (Array.isArray(json?.data)) {
          list = json.data;
        } else if (Array.isArray(json?.services)) {
          list = json.services;
        }

        setRawServices(list);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn('[ServicesPage] fetch failed:', err.message);
        setError(err.message);
        setRawServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialized, tick]);

  // Appointment analytics per service (no appointments in Redux — reserved for future real API)
  const { appointmentCounts, appointmentBranches } = useMemo(() => {
    const counts: Record<string, number> = {};
    const brArrayMap: Record<string, string[]> = {};
    return { appointmentCounts: counts, appointmentBranches: brArrayMap };
  }, []);

  // Normalised rows
  const services: ServiceRow[] = useMemo(() =>
    rawServices.map((raw) => {
      const id = String(raw.id ?? raw.service_id ?? '');
      return normaliseService(raw, appointmentCounts[id] ?? 0, appointmentBranches[id] ?? []);
    }),
  [rawServices, appointmentCounts, appointmentBranches]);

  // Aggregate branches from BOTH response.branches and each item.branches
  const allBranches = useMemo(() => {
    const map = new Map<string, string>();

    // 1. From response key `branches`
    responseBranches.forEach((b) => {
      if (b.id) map.set(b.id, b.name);
    });

    // 2. From each service's `branches` array
    rawServices.forEach((s) => {
      const bList = (s as Record<string, unknown>).branches;
      if (Array.isArray(bList)) {
        bList.forEach((b) => {
          if (typeof b === 'object' && b !== null) {
            const bObj = b as Record<string, unknown>;
            const bId = String(bObj.id ?? bObj.branch_id ?? '');
            const bName = String(bObj.name ?? bObj.branch_name ?? bObj.title ?? bId);
            if (bId) map.set(bId, bName);
          } else if (typeof b === 'string' || typeof b === 'number') {
            const bId = String(b);
            if (bId && !map.has(bId)) map.set(bId, bId);
          }
        });
      }
    });

    // No Redux fallback — only use what the API returns

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [responseBranches, rawServices]);

  // Branch map for quick lookup
  const branchMap = useMemo(() => {
    const m = new Map<string, string>();
    allBranches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [allBranches]);

  // Branch filter dropdown options
  const branchOptions = useMemo(() =>
    allBranches.map((b) => ({ value: b.id, label: b.name })),
  [allBranches]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const branchNames = s.branch_ids.map((id) => branchMap.get(id) ?? '').join(' ').toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || branchNames.includes(q) || (s.description?.toLowerCase().includes(q));
      const matchBranch = !branchFilter || s.branch_ids.length === 0 || s.branch_ids.includes(branchFilter);
      const matchHome   = !homeFilter   || s.can_do_home_service;
      return matchSearch && matchBranch && matchHome;
    }).sort((a, b) => b.bookings - a.bookings);
  }, [services, search, branchFilter, homeFilter, branchMap]);

  const hasFilters = Boolean(search || branchFilter || homeFilter);

  const clearFilters = () => { setSearch(''); setBranchFilter(''); setHomeFilter(false); };

  const isLoading = loading && services.length === 0;

  // Helper to compose branch summary string
  const getBranchSummary = (s: ServiceRow) => {
    if (s.branches && s.branches.length > 0) {
      if (s.branches.length === 1) return s.branches[0].name;
      if (allBranches.length > 0 && s.branches.length >= allBranches.length) return 'All branches';
      return `${s.branches.length} branches`;
    }
    if (s.branch_ids.length === 0 || (allBranches.length > 0 && s.branch_ids.length >= allBranches.length)) {
      return 'All branches';
    }
    const names = s.branch_ids.map((id) => branchMap.get(id)).filter(Boolean) as string[];
    if (names.length === 1) return names[0];
    if (names.length > 1) return `${names.length} branches`;
    return 'All branches';
  };

  return (
    <DashboardShell>
      {/* ── Header ── */}
      <PageHeader
        title={t('navServices')}
        subtitle={loading ? 'Loading…' : `${services.length} services · ${allBranches.length} branches`}
      />

      {/* ── Error banner ── */}
      {error && !loading && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in-up">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error} — showing demo data</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3 animate-fade-in-up">
        {/* Search */}
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
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

        {/* Home Service filter */}
        <button
          onClick={() => setHomeFilter((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition cursor-pointer',
            homeFilter
              ? 'border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-400 shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:border-sky-400/40 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20',
          )}
        >
          <Home className={cn('h-4 w-4 transition', homeFilter ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground')} />
          Home Service
          {homeFilter && <X className="h-3 w-3 ml-0.5 opacity-70" />}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-10 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition cursor-pointer"
          >
            Clear
          </button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center rounded-xl border border-border bg-card p-0.5 gap-0.5">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}
              title={m === 'grid' ? 'Grid view' : 'List view'}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer',
                viewMode === m
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary chips ── */}
      {!isLoading && (
        <div className="mb-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted/70 px-3 py-1 font-semibold text-muted-foreground">
            {services.length} Total
          </span>
          {hasFilters && (
            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary border border-primary/20">
              {filtered.length} shown
            </span>
          )}
        </div>
      )}

      {/* ── Skeleton ── */}
      {isLoading && (
        <div className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'space-y-3',
        )}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn('rounded-2xl shimmer', viewMode === 'grid' ? 'h-72' : 'h-20')} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 py-20 text-center animate-fade-in-up">
          <div className="rounded-2xl bg-muted/50 p-4 text-muted-foreground mb-4">
            <Layers className="h-10 w-10 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-bold">No services found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {hasFilters
              ? 'No services match your filters. Try broadening your criteria.'
              : 'No services are registered in the system.'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!isLoading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <GridCard
              key={s.id}
              s={s}
              branchSummary={getBranchSummary(s)}
              t={t}
              onSelect={setSelectedService}
            />
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!isLoading && filtered.length > 0 && viewMode === 'list' && (
        <div>
          <ListHeader />
          <div className="space-y-2">
            {filtered.map((s) => (
              <ListRow
                key={s.id}
                s={s}
                branchSummary={getBranchSummary(s)}
                t={t}
                onSelect={setSelectedService}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Service Details Popup Modal ── */}
      {selectedService && (
        <ServiceDetailModal
          serviceId={selectedService.id}
          initialService={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </DashboardShell>
  );
}
