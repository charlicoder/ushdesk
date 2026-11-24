'use client';

import { useMemo, useState } from 'react';
import {
  Sparkles, Clock, Search, Building2,
  LayoutGrid, List, RefreshCw, AlertCircle,
  ChevronDown, X, Layers, TrendingUp, Home,
  Eye, Tag, Printer, CheckSquare, Square,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import type { TranslationKey } from '@/lib/i18n';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { formatCurrency } from '@/lib/helpers';
import { useApiList } from '@/hooks/use-api-list';
import { cn } from '@/lib/utils';
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
  home_service_price: number | null;
  currency: string;
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
  fallbackCategory = 'General',
): ServiceRow {
  let branchIds: string[] = [];
  const branchList: BranchInfo[] = [];

  // Parse branches from service item (supports [{ branch_id, name }], [{ id, name }], string IDs)
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

  // Duration
  const duration = Number(
    raw.duration_minutes ??
    raw.duration_min ??
    raw.duration ??
    60,
  );

  // Extract category from service_types array or fallback
  const rawTypes = raw.service_types;
  let parsedCat = '';
  if (Array.isArray(rawTypes) && rawTypes.length > 0) {
    const first = rawTypes[0];
    if (typeof first === 'object' && first !== null) {
      parsedCat = String((first as Record<string, unknown>).name ?? '');
    } else if (typeof first === 'string') {
      parsedCat = first;
    }
  } else if (raw.service_type && typeof raw.service_type === 'object') {
    parsedCat = String((raw.service_type as Record<string, unknown>).name ?? '');
  }
  if (!parsedCat) {
    parsedCat = String(raw.category ?? raw.service_category ?? '');
  }
  if (!parsedCat) {
    parsedCat = fallbackCategory;
  }

  const rawHomePrice = raw.home_service_price ?? raw.home_price;
  const parsedHomePrice =
    rawHomePrice !== null && rawHomePrice !== undefined && String(rawHomePrice).trim() !== '' && Number.isFinite(Number(rawHomePrice))
      ? Number(rawHomePrice)
      : null;

  return {
    id:                  String(raw.id ?? raw.service_id ?? ''),
    name:                String(raw.name ?? raw.service_name ?? 'Unnamed Service'),
    category:            parsedCat,
    duration_minutes:    duration,
    price:               Number(raw.price ?? raw.base_price ?? raw.cost ?? 0),
    home_service_price:  parsedHomePrice,
    currency:            String(raw.currency ?? raw.price_currency ?? ''),
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
  currency,
  locale,
  t,
  onSelect,
}: {
  s: ServiceRow;
  branchSummary: string;
  currency: string;
  locale: string;
  t: (k: TranslationKey) => string;
  onSelect: (s: ServiceRow) => void;
}) {
  const catStyle = getCatStyle(s.category);
  const showCategoryBadge = Boolean(s.category && s.category !== 'General' && s.category !== 'عام');

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
        {/* Category badge (non-General only) & Price overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          {showCategoryBadge ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 border border-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <span className={cn('h-1.5 w-1.5 rounded-full', catStyle.dot)} />
              {s.category}
            </span>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="rounded-full bg-black/55 border border-white/15 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {formatCurrency(Number(s.price), s.currency || currency, locale)}
            </span>
            {s.home_service_price !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-600/85 border border-sky-300/30 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                <Home className="h-3 w-3 shrink-0" />
                {formatCurrency(s.home_service_price, s.currency || currency, locale)}
              </span>
            )}
          </div>
        </div>

        {/* Hover Quick View pill */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
            <Eye className="h-3 w-3 text-primary" />
            {t('view')}
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

        {/* Pricing strip: Spa Price & Home Service Price */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 border border-border/40 px-3 py-2">
          <div className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t('price')}
            </span>
            <span className="text-xs font-extrabold text-primary whitespace-nowrap">
              {formatCurrency(Number(s.price), s.currency || currency, locale)}
            </span>
          </div>
          <div className="min-w-0 text-right">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {locale === 'ar' ? 'سعر المنزل' : 'Home Price'}
            </span>
            {s.home_service_price !== null ? (
              <span className="inline-flex items-center justify-end gap-1 text-xs font-extrabold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                <Home className="h-3 w-3 shrink-0" />
                {formatCurrency(s.home_service_price, s.currency || currency, locale)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground/60">—</span>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-y-1.5 text-xs text-muted-foreground border-t border-border/40 pt-3">
          <span className="inline-flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {s.duration_minutes} {t('min')}
          </span>
          <span className="inline-flex items-center gap-1 font-medium truncate max-w-[160px]">
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
  currency,
  locale,
  t,
  selected,
  onToggleSelect,
  onSelect,
}: {
  s: ServiceRow;
  branchSummary: string;
  currency: string;
  locale: string;
  t: (k: TranslationKey) => string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onSelect: (s: ServiceRow) => void;
}) {
  const catStyle = getCatStyle(s.category);
  const showCategoryBadge = Boolean(s.category && s.category !== 'General' && s.category !== 'عام');

  return (
    <div
      onClick={() => onSelect(s)}
      className={cn(
        'group grid grid-cols-[28px_56px_1fr_96px_144px_112px_128px_80px] items-center gap-4 rounded-2xl border bg-card px-4 py-3 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:bg-card/80 cursor-pointer animate-fade-in-up',
        selected ? 'border-primary/50 bg-primary/[0.03]' : 'border-border/60',
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(s.id);
        }}
        aria-label={selected ? `Deselect ${s.name}` : `Select ${s.name}`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition cursor-pointer"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      {/* Thumbnail — small, fixed */}
      <ServiceThumb
        image={s.image}
        name={s.name}
        category={s.category}
        className="h-14 w-14 rounded-xl border border-border/50"
        iconSize="sm"
      />

      {/* Name (+ non-General category badge only) */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {s.name}
          </span>
          {showCategoryBadge && (
            <span className={cn('inline-flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', catStyle.badge)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', catStyle.dot)} />
              {s.category}
            </span>
          )}
        </div>
      </div>

      {/* Duration */}
      <div className="flex flex-col items-center gap-0.5 text-center shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('duration')}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {s.duration_minutes} {t('min')}
        </span>
      </div>

      {/* Branch */}
      <div className="flex flex-col items-center gap-0.5 text-center shrink-0 max-w-[144px]">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('branch')}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground truncate max-w-full">
          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate">{branchSummary}</span>
        </span>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t('price')}</span>
        <span className="text-sm font-extrabold text-primary whitespace-nowrap">
          {formatCurrency(Number(s.price), s.currency || currency, locale)}
        </span>
      </div>

      {/* Home Service Price */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
          {locale === 'ar' ? 'سعر المنزل' : 'Home Price'}
        </span>
        {s.home_service_price !== null ? (
          <span className="inline-flex items-center gap-1 text-sm font-extrabold text-sky-600 dark:text-sky-400 whitespace-nowrap">
            <Home className="h-3.5 w-3.5 shrink-0" />
            {formatCurrency(s.home_service_price, s.currency || currency, locale)}
          </span>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground/60">—</span>
        )}
      </div>

      {/* View Details action */}
      <div className="shrink-0 pl-1 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(s);
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
        >
          <Eye className="h-3.5 w-3.5" />
          {t('view')}
        </button>
      </div>
    </div>
  );
}

// ── List Column Headers ───────────────────────────────────────────────────────
function ListHeader({
  t,
  locale,
  allSelected,
  onToggleAll,
}: {
  t: (k: TranslationKey) => string;
  locale: string;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div className="grid grid-cols-[28px_56px_1fr_96px_144px_112px_128px_80px] items-center gap-4 px-4 py-2 mb-1">
      <button
        type="button"
        onClick={onToggleAll}
        aria-label={allSelected ? 'Deselect all services' : 'Select all services'}
        title={allSelected ? 'Deselect all' : 'Select all'}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition cursor-pointer"
      >
        {allSelected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>
      <div />
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{t('service')}</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-center">{t('duration')}</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-center">{t('branch')}</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">{t('price')}</span>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right whitespace-nowrap">
        {locale === 'ar' ? 'سعر المنزل' : 'Home Price'}
      </span>
      <span />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { t } = useI18n();
  const locale = useAppSelector((s) => s.ui.locale);

  // UI filters & view
  const [search,         setSearch]         = useState('');
  const [catFilter,      setCatFilter]      = useState('');
  const [branchFilter,   setBranchFilter]   = useState('');
  const [homeFilter,     setHomeFilter]     = useState(false);
  const [viewMode,       setViewMode]       = useState<'grid' | 'list'>('grid');
  const [selectedService, setSelectedService] = useState<ServiceRow | null>(null);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());

  // Fetch /api/v1/services via useApiList — auto re-fetches when locale changes!
  const { data: rawServices, loading, error, refetch, rawResponse } = useApiList<Record<string, unknown>>(
    '/api/v1/services',
    [],
  );

  // Extract response-level branches if present in the payload
  const responseBranches = useMemo(() => {
    const foundBranches: Array<{ id: string; name: string }> = [];
    const rawBranches = (rawResponse?.branches ?? (rawResponse?.data as Record<string, unknown> | undefined)?.branches) as unknown;
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
    return foundBranches;
  }, [rawResponse]);

  // Appointment analytics per service (reserved for future appointment counts)
  const { appointmentCounts, appointmentBranches } = useMemo(() => {
    const counts: Record<string, number> = {};
    const brArrayMap: Record<string, string[]> = {};
    return { appointmentCounts: counts, appointmentBranches: brArrayMap };
  }, []);

  const fallbackCategory = locale === 'ar' ? 'عام' : 'General';

  // Normalised rows
  const services: ServiceRow[] = useMemo(() =>
    rawServices.map((raw) => {
      const id = String(raw.id ?? raw.service_id ?? '');
      return normaliseService(raw, appointmentCounts[id] ?? 0, appointmentBranches[id] ?? [], fallbackCategory);
    }),
  [rawServices, appointmentCounts, appointmentBranches, fallbackCategory]);

  // Dynamic currency from API response or i18n
  const apiCurrency = useMemo(() => services.find((s) => s.currency)?.currency ?? '', [services]);
  const currency    = apiCurrency || t('currency');

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

  // Category filter dropdown options
  const categories = useMemo(() =>
    services
      .map((s) => s.category)
      .filter((v, i, a) => a.indexOf(v) === i && v !== 'General' && v !== 'عام')
      .sort(),
  [services]);

  const categoryOptions = useMemo(() =>
    categories.map((c) => ({ value: c, label: c })),
  [categories]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const branchNames = s.branch_ids.map((id) => branchMap.get(id) ?? '').join(' ').toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || branchNames.includes(q) || (s.description?.toLowerCase().includes(q));
      const matchCat    = !catFilter    || s.category === catFilter;
      const matchBranch = !branchFilter || s.branch_ids.length === 0 || s.branch_ids.includes(branchFilter);
      const matchHome   = !homeFilter   || s.can_do_home_service;
      return matchSearch && matchCat && matchBranch && matchHome;
    }).sort((a, b) => b.bookings - a.bookings);
  }, [services, search, catFilter, branchFilter, homeFilter, branchMap]);

  const hasFilters = Boolean(search || catFilter || branchFilter || homeFilter);

  const clearFilters = () => { setSearch(''); setCatFilter(''); setBranchFilter(''); setHomeFilter(false); };

  const isLoading = loading && services.length === 0;

  // Helper to compose branch summary string
  const getBranchSummary = (s: ServiceRow) => {
    const isAr = locale === 'ar';
    const allBranchesLabel = isAr ? 'كل الفروع' : 'All branches';
    const branchesLabel = (cnt: number) => isAr ? `${cnt} فروع` : `${cnt} branches`;

    if (s.branches && s.branches.length > 0) {
      if (s.branches.length === 1) return s.branches[0].name;
      if (allBranches.length > 0 && s.branches.length >= allBranches.length) return allBranchesLabel;
      return branchesLabel(s.branches.length);
    }
    if (s.branch_ids.length === 0 || (allBranches.length > 0 && s.branch_ids.length >= allBranches.length)) {
      return allBranchesLabel;
    }
    const names = s.branch_ids.map((id) => branchMap.get(id)).filter(Boolean) as string[];
    if (names.length === 1) return names[0];
    if (names.length > 1) return branchesLabel(names.length);
    return allBranchesLabel;
  };

  // Selection helpers (list view)
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const selectedFilteredServices = useMemo(
    () => filtered.filter((s) => selectedIds.has(s.id)),
    [filtered, selectedIds],
  );

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((s) => next.delete(s.id));
      } else {
        filtered.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handlePrintPdf = () => {
    const rowsToPrint = selectedFilteredServices.length > 0 ? selectedFilteredServices : filtered;
    if (rowsToPrint.length === 0) return;

    const isAr = locale === 'ar';
    const esc = (v: string) =>
      v
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const nowLabel = new Date().toLocaleString(isAr ? 'ar-KW' : 'en-GB', {
      timeZone: 'Asia/Kuwait',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const tableRows = rowsToPrint
      .map((s, idx) => {
        const cur = s.currency || currency;
        const priceStr = formatCurrency(Number(s.price), cur, locale);
        const homePriceStr =
          s.home_service_price !== null
            ? formatCurrency(s.home_service_price, cur, locale)
            : '—';
        const branchStr = getBranchSummary(s);
        return `
          <tr>
            <td class="num">${idx + 1}</td>
            <td class="svc">${esc(s.name)}</td>
            <td class="center">${s.duration_minutes} ${esc(t('min'))}</td>
            <td>${esc(branchStr)}</td>
            <td class="price">${esc(priceStr)}</td>
            <td class="home-price">${esc(homePriceStr)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${isAr ? 'قائمة أسعار خدمات USH Spa' : 'USH Spa — Services Price List'}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header .sub {
      font-size: 11px;
      color: #6b7280;
      margin-top: 3px;
    }
    .meta {
      text-align: ${isAr ? 'left' : 'right'};
      font-size: 11px;
      color: #4b5563;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: #f3f4f6;
      color: #374151;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      padding: 8px 10px;
      border-top: 1px solid #d1d5db;
      border-bottom: 1.5px solid #9ca3af;
      text-align: ${isAr ? 'right' : 'left'};
    }
    thead th.center, tbody td.center { text-align: center; }
    thead th.right, tbody td.price, tbody td.home-price { text-align: ${isAr ? 'left' : 'right'}; }
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    tbody tr:nth-child(even) { background: #fafafa; }
    tbody td {
      padding: 8px 10px;
      vertical-align: middle;
    }
    td.num {
      width: 34px;
      color: #6b7280;
      font-variant-numeric: tabular-nums;
    }
    td.svc { font-weight: 600; color: #111827; }
    td.price {
      font-weight: 700;
      color: #111827;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    td.home-price {
      font-weight: 700;
      color: #0369a1;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${isAr ? 'USH Spa — قائمة الخدمات والأسعار' : 'USH Spa — Services Price List'}</h1>
      <div class="sub">${isAr ? `عدد الخدمات: ${rowsToPrint.length}` : `Total Services: ${rowsToPrint.length}`}</div>
    </div>
    <div class="meta">
      <div>${isAr ? 'تاريخ الطباعة' : 'Printed'}: ${esc(nowLabel)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${esc(t('service'))}</th>
        <th class="center">${esc(t('duration'))}</th>
        <th>${esc(t('branch'))}</th>
        <th class="right">${esc(t('price'))}</th>
        <th class="right">${isAr ? 'سعر المنزل' : 'Home Price'}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">
    <span>USH Spa</span>
    <span>${esc(nowLabel)}</span>
  </div>
  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <DashboardShell>
      {/* ── Header ── */}
      <PageHeader
        title={t('navServices')}
        subtitle={
          loading
            ? t('loading')
            : locale === 'ar'
            ? `${services.length} خدمة · ${allBranches.length} فروع`
            : `${services.length} services · ${allBranches.length} branches`
        }
      />

      {/* ── Error banner ── */}
      {error && !loading && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in-up">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline cursor-pointer">
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
            placeholder={locale === 'ar' ? 'بحث عن خدمة…' : 'Search services…'}
            className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        {categoryOptions.length > 0 && (
          <SelectFilter
            icon={Tag}
            label={locale === 'ar' ? 'كل الفئات' : 'All Categories'}
            value={catFilter}
            options={categoryOptions}
            onChange={setCatFilter}
          />
        )}

        {/* Branch filter */}
        <SelectFilter
          icon={Building2}
          label={t('filterByBranch')}
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
          {t('homeService')}
          {homeFilter && <X className="h-3 w-3 ml-0.5 opacity-70" />}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-10 rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive transition cursor-pointer"
          >
            {locale === 'ar' ? 'مسح' : 'Clear'}
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

      {/* ── Summary chips & List Print actions ── */}
      {!isLoading && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted/70 px-3 py-1 font-semibold text-muted-foreground">
              {services.length} {locale === 'ar' ? 'الإجمالي' : 'Total'}
            </span>
            {hasFilters && (
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary border border-primary/20">
                {filtered.length} {locale === 'ar' ? 'معروض' : 'shown'}
              </span>
            )}
            {viewMode === 'list' && selectedFilteredServices.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                {selectedFilteredServices.length} {locale === 'ar' ? 'محدد' : 'selected'}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-0.5 hover:opacity-75 cursor-pointer"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {viewMode === 'list' && filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleAllFiltered}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>
                  {allFilteredSelected
                    ? (locale === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                    : (locale === 'ar' ? `تحديد الكل (${filtered.length})` : `Select All (${filtered.length})`)}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer active:scale-[0.98]"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>
                  {selectedFilteredServices.length > 0
                    ? (locale === 'ar'
                        ? `طباعة PDF (${selectedFilteredServices.length})`
                        : `Print PDF (${selectedFilteredServices.length})`)
                    : (locale === 'ar'
                        ? `طباعة الكل PDF (${filtered.length})`
                        : `Print All PDF (${filtered.length})`)}
                </span>
              </button>
            </div>
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
          <h3 className="text-sm font-bold">
            {locale === 'ar' ? 'لم يتم العثور على أي خدمات' : 'No services found'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {hasFilters
              ? (locale === 'ar' ? 'لا توجد خدمات تطابق معايير البحث أو التصفية.' : 'No services match your filters. Try broadening your criteria.')
              : (locale === 'ar' ? 'لا توجد خدمات مسجلة في النظام.' : 'No services are registered in the system.')}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              {locale === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
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
              currency={currency}
              locale={locale}
              t={t}
              onSelect={setSelectedService}
            />
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!isLoading && filtered.length > 0 && viewMode === 'list' && (
        <div>
          <ListHeader
            t={t}
            locale={locale}
            allSelected={allFilteredSelected}
            onToggleAll={handleToggleAllFiltered}
          />
          <div className="space-y-2">
            {filtered.map((s) => (
              <ListRow
                key={s.id}
                s={s}
                branchSummary={getBranchSummary(s)}
                currency={currency}
                locale={locale}
                t={t}
                selected={selectedIds.has(s.id)}
                onToggleSelect={handleToggleSelect}
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
