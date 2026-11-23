'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Filter, Download, Printer, RefreshCw, Search, X,
  Building2, Check, RotateCcw, Loader2, AlertCircle, ChevronLeft,
  ChevronRight, CreditCard, Layers,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { normalise, type Booking } from '@/components/bookings/BookingDetailPopup';
import { normalizeBranchName } from '@/lib/branches';

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemCategoryKey = 'spa' | 'voucher' | 'course';
type PaymentTypeKey = 'gift_voucher' | 'service';

interface SalesLineRow {
  key: string;
  bookingId: string;
  dateIso: string;         // YYYY-MM-DD (Kuwait)
  dateDisplay: string;     // DD/MM/YYYY
  document: string;        // Booking # / Invoice #
  client: string;          // Customer name
  branchName: string;      // Normalized branch name
  itemCategory: ItemCategoryKey;
  itemLabel: 'Spa' | 'Voucher' | 'Course';
  paymentType: PaymentTypeKey;
  description: string;
  qty: number;
  cost: number;
  disc: number;
  profitPct: number;
  total: number;
  currency: string;
}

interface ReportFilters {
  categories: ItemCategoryKey[];   // [] = all; subset = filter to selected
  paymentTypes: PaymentTypeKey[];  // [] = all; subset = filter to selected
  branches: string[];              // [] = all; subset = filter to selected branch names
}

const EMPTY_FILTERS: ReportFilters = {
  categories: [],
  paymentTypes: [],
  branches: [],
};

const TZ = 'Asia/Kuwait';

// ── Helpers ────────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

const fmtAmt = (n: number): string => n.toFixed(3);
const fmtQty = (n: number): string => n.toFixed(2);

const todayKw = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

const addDays = (iso: string, delta: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

const dateKey = (raw: string | null | undefined): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !/[TZ+]/.test(s.slice(10))) return s.slice(0, 10);
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('en-CA', { timeZone: TZ });
};

/** Formats YYYY-MM-DD as "DD/MM/YYYY" (matches old report) */
const fmtSlashDate = (iso: string): string => {
  if (!iso || iso.length < 10) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** Formats YYYY-MM-DD as "1 October 2026" (matches Start/End header in old report) */
const fmtLongDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Formats current Kuwait timestamp as "DD/MM/YYYY HH:mm" (matches footer in old report) */
const fmtGeneratedAt = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
};

function classifyBooking(b: Booking): { itemCategory: ItemCategoryKey; itemLabel: 'Spa' | 'Voucher' | 'Course'; paymentType: PaymentTypeKey } {
  const raw = (b.raw ?? {}) as Record<string, any>;
  const provider = String(b.payment_provider || b.payment_gateway || '').toLowerCase().trim();
  const method = String(b.payment_method || '').toLowerCase().trim();
  const payTypeRaw = String(raw.payment_type || '').toLowerCase().trim();

  const isCourse =
    Boolean(b.course_data) ||
    Boolean(raw.course_subscription_id) ||
    provider === 'course' ||
    method === 'course';

  const isVoucher =
    provider === 'gift_voucher' ||
    method === 'gift_voucher' ||
    payTypeRaw === 'gift_voucher' ||
    Boolean(raw.voucher_id) ||
    Boolean(raw.gift_voucher_id) ||
    Boolean(raw.redeemed_from_voucher_id);

  const paymentType: PaymentTypeKey = isVoucher ? 'gift_voucher' : 'service';

  if (isCourse) {
    return { itemCategory: 'course', itemLabel: 'Course', paymentType };
  }
  if (isVoucher) {
    return { itemCategory: 'voucher', itemLabel: 'Voucher', paymentType: 'gift_voucher' };
  }
  return { itemCategory: 'spa', itemLabel: 'Spa', paymentType };
}

function expandCompletedBookings(bookings: Booking[]): SalesLineRow[] {
  const rows: SalesLineRow[] = [];

  for (const b of bookings) {
    if (String(b.status ?? '').toLowerCase().trim() !== 'completed') continue;

    const raw = (b.raw ?? {}) as Record<string, any>;
    const dIso = dateKey(b.appointment_start || b.created_at);
    const dateDisplay = fmtSlashDate(dIso);
    const docNo = String(b.booking_number || b.payment_number || b.id.slice(0, 8));
    const client = String(b.customer_name || 'Guest').trim();
    const branchName = normalizeBranchName(b.branch_name || 'Other Branch') || 'Other Branch';
    const currency = b.currency || 'KWD';
    const bookingTotal = num(b.total_amount || b.total_price || b.service_price);
    const bookingDisc = num(b.discount);

    const { itemCategory, itemLabel, paymentType } = classifyBooking(b);

    // Expand multi-service bookings into one ledger row per service (like the old POS report)
    const svcList = Array.isArray(b.services) && b.services.length > 0 ? b.services : [];

    if (svcList.length > 0) {
      const explicitPrices = svcList.map((sv: any) =>
        num(sv.total_price ?? sv.price ?? sv.base_price ?? sv.service_data?.price ?? sv.service_data?.base_price),
      );
      const sumExplicit = explicitPrices.reduce((a, c) => a + c, 0);

      svcList.forEach((sv: any, idx: number) => {
        const desc = String(
          sv.service_data?.name || sv.service_name || sv.name || b.service_name || 'Spa Service',
        ).trim();
        const lineTotal =
          sumExplicit > 0
            ? (bookingTotal > 0 ? (explicitPrices[idx] / sumExplicit) * bookingTotal : explicitPrices[idx])
            : bookingTotal / svcList.length;
        const lineDisc = idx === 0 ? bookingDisc : 0;

        rows.push({
          key: `${b.id}-svc-${idx}`,
          bookingId: b.id,
          dateIso: dIso,
          dateDisplay,
          document: docNo,
          client,
          branchName,
          itemCategory,
          itemLabel,
          paymentType,
          description: desc,
          qty: 1,
          cost: 0,
          disc: lineDisc,
          profitPct: 0,
          total: lineTotal,
          currency,
        });
      });
    } else {
      const voucherRef = String(raw.voucher_number || raw.gift_voucher_number || '').trim();
      const courseName = String((b.course_data as any)?.course_name || (b.course_data as any)?.name || '').trim();
      const desc =
        itemCategory === 'voucher' && voucherRef
          ? `Gift Voucher ${voucherRef} — ${b.service_name || 'Spa Service'}`
          : itemCategory === 'course' && courseName
          ? `${courseName} — ${b.service_name || 'Session'}`
          : String(b.service_name || 'Spa Service').trim();

      rows.push({
        key: `${b.id}-main`,
        bookingId: b.id,
        dateIso: dIso,
        dateDisplay,
        document: docNo,
        client,
        branchName,
        itemCategory,
        itemLabel,
        paymentType,
        description: desc,
        qty: 1,
        cost: 0,
        disc: bookingDisc,
        profitPct: 0,
        total: bookingTotal,
        currency,
      });
    }
  }

  // Sort by branch, then date ascending, then document ascending (just like the old ledger report)
  rows.sort((a, b) =>
    a.branchName.localeCompare(b.branchName) ||
    a.dateIso.localeCompare(b.dateIso) ||
    a.document.localeCompare(b.document),
  );

  return rows;
}

const CATEGORY_OPTIONS: { key: ItemCategoryKey; label: string }[] = [
  { key: 'spa',     label: 'Spa Services' },
  { key: 'voucher', label: 'Voucher' },
  { key: 'course',  label: 'Courses' },
];

const PAYMENT_TYPE_OPTIONS: { key: PaymentTypeKey; label: string }[] = [
  { key: 'service',      label: 'Service' },
  { key: 'gift_voucher', label: 'Gift Voucher' },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BookingSalesReportPage() {
  const today = todayKw();

  // Default to current date (today)
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState('');

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date>(() => new Date());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const startIso = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate || toDate || today;
  const endIso = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : toDate || fromDate || today;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load branches
      const branchRes = await authedFetch('/api/v1/branches/?page_size=200').catch(() => null);
      if (branchRes && branchRes.ok) {
        const bJson = await branchRes.json().catch(() => ({}));
        const bList: any[] = Array.isArray(bJson) ? bJson : (bJson?.data ?? bJson?.results ?? []);
        const names = Array.from(
          new Set(
            bList
              .map((b) => normalizeBranchName(String(b.name ?? b.branch_name ?? '')))
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setBranchOptions(names);
      }

      // Fetch all completed bookings across pages for the date range
      const all: Record<string, unknown>[] = [];
      for (let p = 1; p <= 40; p++) {
        const params = new URLSearchParams({
          page: String(p),
          page_size: '100',
          status: 'completed',
          from_date: startIso,
          to_date: endIso,
        });
        const res = await authedFetch(`/api/v1/bookings?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.detail ?? json?.message ?? `Failed to load completed bookings (${res.status})`);
        }
        const list: Record<string, unknown>[] = Array.isArray(json)
          ? json
          : (json?.data ?? json?.results ?? json?.items ?? []);
        all.push(...list);
        if (!Array.isArray(list) || list.length < 100) break;
      }

      setBookings(all.map((r) => normalise(r)));
      setGeneratedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load booking sales report');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Close popup on Escape
  useEffect(() => {
    if (!filterOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [filterOpen]);

  // Expand completed bookings into ledger line items
  const allRows = useMemo(() => expandCompletedBookings(bookings), [bookings]);

  // Distinct branches (API + rows)
  const branchChoices = useMemo(() => {
    const set = new Set<string>(branchOptions);
    allRows.forEach((r) => {
      if (r.branchName) set.add(r.branchName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [branchOptions, allRows]);

  // Apply filters & search
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const catSet = new Set<string>(filters.categories);
    const paySet = new Set<string>(filters.paymentTypes);
    const brSet = new Set(filters.branches.map((b) => b.toLowerCase()));

    return allRows.filter((r) => {
      if (r.dateIso && (r.dateIso < startIso || r.dateIso > endIso)) return false;
      if (catSet.size > 0 && !catSet.has(r.itemCategory)) return false;
      if (paySet.size > 0 && !paySet.has(r.paymentType)) return false;
      if (brSet.size > 0 && !brSet.has(r.branchName.toLowerCase())) return false;
      if (q) {
        const hay = `${r.document} ${r.client} ${r.itemLabel} ${r.description} ${r.branchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, filters, search, startIso, endIso]);

  useEffect(() => {
    setPage(1);
  }, [filters, search, startIso, endIso, pageSize]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Group paginated rows by branch (preserving order, matching old report)
  const groupedPage = useMemo(() => {
    const groups: Array<{ branch: string; rows: SalesLineRow[]; discSum: number; totalSum: number }> = [];
    const map = new Map<string, { branch: string; rows: SalesLineRow[]; discSum: number; totalSum: number }>();
    for (const r of paginatedRows) {
      let g = map.get(r.branchName);
      if (!g) {
        g = { branch: r.branchName, rows: [], discSum: 0, totalSum: 0 };
        map.set(r.branchName, g);
        groups.push(g);
      }
      g.rows.push(r);
      g.discSum += r.disc;
      g.totalSum += r.total;
    }
    return groups;
  }, [paginatedRows]);

  // Grand totals across all filtered rows
  const grandTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.qty += r.qty;
        acc.cost += r.cost;
        acc.disc += r.disc;
        acc.total += r.total;
        return acc;
      },
      { qty: 0, cost: 0, disc: 0, total: 0 },
    );
  }, [filteredRows]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.categories.length > 0) n++;
    if (filters.paymentTypes.length > 0) n++;
    if (filters.branches.length > 0) n++;
    return n;
  }, [filters]);

  const toggleInDraft = <K extends keyof ReportFilters>(field: K, val: ReportFilters[K][number]) => {
    setDraftFilters((prev) => {
      const list = prev[field] as unknown[];
      const next = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
      return { ...prev, [field]: next };
    });
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['Branch', 'Date', 'Document', 'Client', 'Item', 'Description', 'Qty', 'Cost', 'Disc', 'Profit', 'Total'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.map(esc).join(','),
      ...filteredRows.map((r) =>
        [
          r.branchName,
          r.dateDisplay,
          r.document,
          r.client,
          r.itemLabel,
          r.description,
          fmtQty(r.qty),
          fmtAmt(r.cost),
          fmtAmt(r.disc),
          `${r.profitPct}%`,
          fmtAmt(r.total),
        ]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-sales-report-${startIso}-to-${endIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Last month preset
  const lastMonthRange = () => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      from: `${y}-${String(m).padStart(2, '0')}-01`,
      to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  return (
    <DashboardShell>
      {/* Print-only styling so printed output looks identical to the classic Sales sheet */}
      <style jsx global>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .sales-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Top Page Header (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Booking Sales Report"
          subtitle="Completed booking sales ledger grouped by branch with voucher, course, payment type, and branch filters"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 disabled:opacity-40 transition shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            title="Refresh"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* Controls Bar (hidden on print) */}
      <div className="no-print mt-5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Range + Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Start date"
                className="bg-transparent text-xs font-medium outline-none"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="End date"
                className="bg-transparent text-xs font-medium outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: 'Today', from: today, to: today },
                { label: 'Yesterday', from: addDays(today, -1), to: addDays(today, -1) },
                { label: 'Last 7d', from: addDays(today, -6), to: today },
                { label: 'This Month', from: `${today.slice(0, 7)}-01`, to: today },
                { label: 'Last Month', ...lastMonthRange() },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFromDate(p.from);
                    setToDate(p.to);
                  }}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer',
                    startIso === p.from && endIso === p.to
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Filters Popup Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search document, client, item…"
                className="h-9 w-full rounded-xl border border-border/70 bg-background pl-8 pr-8 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setDraftFilters(filters);
                setFilterOpen(true);
              }}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-xs',
                activeFilterCount > 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-background text-foreground hover:bg-muted/60',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/20 px-1.5 text-[10px] font-extrabold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setDraftFilters(EMPTY_FILTERS);
                }}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            {filters.categories.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                Category: {filters.categories.map((c) => CATEGORY_OPTIONS.find((o) => o.key === c)?.label ?? c).join(', ')}
                <button onClick={() => setFilters((f) => ({ ...f, categories: [] }))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.paymentTypes.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                Payment Type: {filters.paymentTypes.map((p) => (p === 'gift_voucher' ? 'Gift Voucher' : 'Service')).join(', ')}
                <button onClick={() => setFilters((f) => ({ ...f, paymentTypes: [] }))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.branches.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                Branches: {filters.branches.join(', ')}
                <button onClick={() => setFilters((f) => ({ ...f, branches: [] }))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="no-print mt-4 flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void loadData()} className="underline font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── Classic Paper Sales Ledger Sheet (matches old system screenshot) ── */}
      <div className="sales-sheet mt-5 rounded-2xl border border-border/60 bg-white text-[#1A1A1A] shadow-sm p-5 sm:p-8">
        {/* Report Title & Start/End Block */}
        <div className="mb-6">
          <h1 className="text-[28px] font-normal tracking-tight text-[#222222] leading-tight">
            Sales
          </h1>
          <div className="mt-4 grid grid-cols-[64px_1fr] gap-y-1 text-[13px]">
            <span className="text-[#777777]">Start</span>
            <span className="font-medium text-[#222222]">{fmtLongDate(startIso)}</span>
            <span className="text-[#777777]">End</span>
            <span className="font-medium text-[#222222]">{fmtLongDate(endIso)}</span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="bg-[#F6F6F6] border-b-2 border-[#333333] text-[#222222] font-bold">
                <th className="py-2 px-2.5 whitespace-nowrap">Date</th>
                <th className="py-2 px-2.5 whitespace-nowrap">Document</th>
                <th className="py-2 px-2.5 whitespace-nowrap">Client</th>
                <th className="py-2 px-2.5 whitespace-nowrap">Item</th>
                <th className="py-2 px-2.5 whitespace-nowrap">Description</th>
                <th className="py-2 px-2.5 whitespace-nowrap text-right">Qty</th>
                <th className="py-2 px-2.5 whitespace-nowrap text-right">Cost</th>
                <th className="py-2 px-2.5 whitespace-nowrap text-right">Disc</th>
                <th className="py-2 px-2.5 whitespace-nowrap text-right">Profit</th>
                <th className="py-2 px-2.5 whitespace-nowrap text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#666666]">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#543C30]" />
                      <span>Loading completed booking sales…</span>
                    </div>
                  </td>
                </tr>
              ) : groupedPage.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-[#777777]">
                    No completed bookings found for the selected date range and filters.
                  </td>
                </tr>
              ) : (
                groupedPage.map((group) => (
                  <React.Fragment key={group.branch}>
                    {/* Branch Section Header */}
                    <tr>
                      <td
                        colSpan={10}
                        className="pt-5 pb-2 px-2.5 text-[14px] font-bold text-[#1A1A1A]"
                      >
                        {group.branch}
                      </td>
                    </tr>

                    {/* Line Items */}
                    {group.rows.map((r) => (
                      <tr
                        key={r.key}
                        className="hover:bg-[#FAF7F5] transition-colors text-[#333333]"
                      >
                        <td className="py-1.5 px-2.5 whitespace-nowrap tabular-nums">{r.dateDisplay}</td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap font-mono text-[12px]">{r.document}</td>
                        <td className="py-1.5 px-2.5 max-w-[165px] truncate" title={r.client}>
                          {r.client}
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">{r.itemLabel}</td>
                        <td className="py-1.5 px-2.5 max-w-[280px] truncate" title={r.description}>
                          {r.description}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                          {fmtQty(r.qty)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                          {fmtAmt(r.cost)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                          {fmtAmt(r.disc)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap tabular-nums">
                          {r.profitPct}%
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap tabular-nums font-medium text-[#111111]">
                          {fmtAmt(r.total)}
                        </td>
                      </tr>
                    ))}

                    {/* Branch Subtotal */}
                    <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA] text-[12px] font-semibold text-[#222222]">
                      <td colSpan={5} className="py-1.5 px-2.5 text-right text-[#555555]">
                        Subtotal — {group.branch} ({group.rows.length})
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">
                        {fmtQty(group.rows.length)}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">0.000</td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">
                        {fmtAmt(group.discSum)}
                      </td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">0%</td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums font-bold">
                        {fmtAmt(group.totalSum)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>

            {/* Grand Total Footer */}
            {!loading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#333333] bg-[#F6F6F6] text-[13px] font-bold text-[#111111]">
                  <td colSpan={5} className="py-2.5 px-2.5">
                    Grand Total ({filteredRows.length.toLocaleString()} items)
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums">
                    {fmtQty(grandTotals.qty)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums">
                    {fmtAmt(grandTotals.cost)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums">
                    {fmtAmt(grandTotals.disc)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums">0%</td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums">
                    {fmtAmt(grandTotals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Classic Bottom Bar: Generated Timestamp (left) + Page X/Y (right) */}
        <div className="mt-6 pt-3 border-t border-[#EAEAEA] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#555555]">
          <span className="tabular-nums">{fmtGeneratedAt(generatedAt)}</span>

          <div className="flex items-center gap-3">
            <div className="no-print flex items-center gap-2">
              <span>Rows/page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-[#D4D4D4] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#222222] outline-none"
              >
                {[25, 50, 100, 250].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-7 w-7 place-items-center rounded border border-[#D4D4D4] bg-white text-[#222222] hover:bg-[#F5F5F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-7 w-7 place-items-center rounded border border-[#D4D4D4] bg-white text-[#222222] hover:bg-[#F5F5F5] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <span className="font-medium text-[#222222] tabular-nums">
              Page {page}/{totalPages}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filters Popup Modal ── */}
      {filterOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Filter Booking Sales Report</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Filter by voucher, courses, payment type, and branches
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* 1. Category (Voucher / Courses / Spa) */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Booking Category (Voucher / Courses / Spa)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const checked = draftFilters.categories.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3.5 py-2 cursor-pointer transition select-none',
                          checked
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border/70 bg-background text-foreground hover:bg-muted/40',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-4 w-4 shrink-0 place-items-center rounded border transition',
                            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleInDraft('categories', opt.key)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Payment Type (gift_voucher, service) */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Payment Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_TYPE_OPTIONS.map((opt) => {
                    const checked = draftFilters.paymentTypes.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3.5 py-2 cursor-pointer transition select-none',
                          checked
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border/70 bg-background text-foreground hover:bg-muted/40',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-4 w-4 shrink-0 place-items-center rounded border transition',
                            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleInDraft('paymentTypes', opt.key)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 3. Branches (Multi-Select) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Branches (Multiple Selection)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDraftFilters((d) => ({ ...d, branches: [...branchChoices] }))}
                      className="font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setDraftFilters((d) => ({ ...d, branches: [] }))}
                      className="font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {branchChoices.map((br) => {
                    const checked = draftFilters.branches.includes(br);
                    return (
                      <label
                        key={br}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition select-none',
                          checked
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border/70 bg-background text-foreground hover:bg-muted/40',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-4 w-4 shrink-0 place-items-center rounded border transition',
                            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleInDraft('branches', br)}
                        />
                        <span className="truncate">{br}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDraftFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset All</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters(draftFilters);
                    setFilterOpen(false);
                  }}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
