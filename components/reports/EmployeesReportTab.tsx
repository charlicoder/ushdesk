'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UserCheck, Scissors, CalendarDays, Clock, Wallet, Search, RefreshCw,
  Download, Printer, ChevronDown, ChevronRight, Building2, Loader2,
  AlertCircle, X, Layers, List, CheckCircle2, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { normalise, extractTherapistName, type Booking } from '@/components/bookings/BookingDetailPopup';
import { normalizeBranchName } from '@/lib/branches';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompletedServiceRecord {
  key: string;
  bookingId: string;
  bookingNumber: string;
  therapistKey: string;
  therapistName: string;
  branchName: string;
  serviceName: string;
  completedAtRaw: string;
  completedDate: string;
  completedTime: string;
  price: number;
  currency: string;
  isCoTherapist?: boolean;
}

interface TherapistSummary {
  therapistKey: string;
  therapistName: string;
  branches: string[];
  serviceCount: number;
  bookingCount: number;
  totalPrice: number;
  currency: string;
  records: CompletedServiceRecord[];
}

const TZ = 'Asia/Kuwait';

// ── Helpers ────────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
};

const kwd = (n: number): string => n.toFixed(3);

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

const fmtDate = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  const d = new Date(String(raw));
  return isNaN(d.getTime())
    ? String(raw).slice(0, 10)
    : d.toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  const d = new Date(String(raw));
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });
};

function extractCompletedRecords(bookings: Booking[]): CompletedServiceRecord[] {
  const out: CompletedServiceRecord[] = [];

  for (const b of bookings) {
    if (String(b.status ?? '').toLowerCase().trim() !== 'completed') continue;

    const bookingNumber = b.booking_number || b.id.slice(0, 8);
    const branchName = normalizeBranchName(b.branch_name || '—') || '—';
    const currency = b.currency || 'KWD';
    const raw = (b.raw ?? {}) as Record<string, any>;
    const bookingCompletedAt =
      String(raw.completed_at || b.appointment_end || b.appointment_start || raw.updated_at || b.created_at || '');
    const bookingTotal = num(b.total_amount || b.total_price || b.service_price);

    const sessions = Array.isArray(b.sessions) && b.sessions.length > 0 ? b.sessions : [];

    if (sessions.length > 0) {
      const sessFallbackShare = bookingTotal / sessions.length;
      sessions.forEach((sess: any, sIdx: number) => {
        const thName =
          extractTherapistName(sess.therapist_data, sess.therapist_name, sess.therapist) ||
          b.therapist_name ||
          'Unassigned Therapist';
        const thId = String(sess.therapist_id || sess.therapist_data?.id || b.therapist_id || thName).toLowerCase();
        const completedRaw = String(
          sess.completed_at || sess.end_time || sess.session_end || sess.start_time || bookingCompletedAt,
        );
        const sessServices: any[] = Array.isArray(sess.services) && sess.services.length > 0 ? sess.services : [];
        const sessTotal = num(sess.total_amount ?? sess.session_price ?? sess.price);

        if (sessServices.length > 0) {
          const explicitPrices = sessServices.map((sv) =>
            num(sv.total_price ?? sv.price ?? sv.base_price ?? sv.service_data?.price ?? sv.service_data?.base_price),
          );
          const sumExplicit = explicitPrices.reduce((a, c) => a + c, 0);
          const pool = sessTotal > 0 ? sessTotal : sessFallbackShare;

          sessServices.forEach((sv, idx) => {
            const svcName =
              String(sv.service_data?.name || sv.service_name || sv.name || b.service_name || 'Service').trim();
            const price = sumExplicit > 0 ? explicitPrices[idx] : pool / sessServices.length;
            out.push({
              key: `${b.id}-s${sIdx}-v${idx}`,
              bookingId: b.id,
              bookingNumber,
              therapistKey: thId,
              therapistName: thName,
              branchName,
              serviceName: svcName,
              completedAtRaw: completedRaw,
              completedDate: fmtDate(completedRaw),
              completedTime: fmtTime(completedRaw),
              price,
              currency,
            });
          });
        } else {
          const svcName = String(
            sess.service_data?.name || sess.service_name || b.service_name || 'Service',
          ).trim();
          out.push({
            key: `${b.id}-s${sIdx}`,
            bookingId: b.id,
            bookingNumber,
            therapistKey: thId,
            therapistName: thName,
            branchName,
            serviceName: svcName,
            completedAtRaw: completedRaw,
            completedDate: fmtDate(completedRaw),
            completedTime: fmtTime(completedRaw),
            price: sessTotal > 0 ? sessTotal : sessFallbackShare,
            currency,
          });
        }
      });
      continue;
    }

    // No sessions array: use booking-level therapist + services array (or single service_name)
    const thName = b.therapist_name && b.therapist_name !== '—' ? b.therapist_name : 'Unassigned Therapist';
    const thKey = String(b.therapist_id || thName).toLowerCase();
    const svcList = Array.isArray(b.services) && b.services.length > 0 ? b.services : [];

    if (svcList.length > 0) {
      const explicitPrices = svcList.map((sv: any) =>
        num(sv.total_price ?? sv.price ?? sv.base_price ?? sv.service_data?.price ?? sv.service_data?.base_price),
      );
      const sumExplicit = explicitPrices.reduce((a, c) => a + c, 0);

      svcList.forEach((sv: any, idx: number) => {
        const svcName = String(sv.service_data?.name || sv.service_name || sv.name || b.service_name || 'Service').trim();
        const price = sumExplicit > 0 ? explicitPrices[idx] : bookingTotal / svcList.length;
        out.push({
          key: `${b.id}-v${idx}`,
          bookingId: b.id,
          bookingNumber,
          therapistKey: thKey,
          therapistName: thName,
          branchName,
          serviceName: svcName,
          completedAtRaw: bookingCompletedAt,
          completedDate: fmtDate(bookingCompletedAt),
          completedTime: fmtTime(bookingCompletedAt),
          price,
          currency,
        });
      });
    } else {
      out.push({
        key: `${b.id}-main`,
        bookingId: b.id,
        bookingNumber,
        therapistKey: thKey,
        therapistName: thName,
        branchName,
        serviceName: b.service_name || 'Service',
        completedAtRaw: bookingCompletedAt,
        completedDate: fmtDate(bookingCompletedAt),
        completedTime: fmtTime(bookingCompletedAt),
        price: bookingTotal,
        currency,
      });
    }

    // Secondary therapist (e.g., 4-hands / dual-therapist treatment)
    if (b.secondary_therapist_name && b.secondary_therapist_name !== '—') {
      const secKey = String(b.secondary_therapist_id || b.secondary_therapist_name).toLowerCase();
      out.push({
        key: `${b.id}-sec`,
        bookingId: b.id,
        bookingNumber,
        therapistKey: secKey,
        therapistName: b.secondary_therapist_name,
        branchName,
        serviceName: `${b.service_name || 'Service'} (Co-therapist)`,
        completedAtRaw: bookingCompletedAt,
        completedDate: fmtDate(bookingCompletedAt),
        completedTime: fmtTime(bookingCompletedAt),
        price: bookingTotal,
        currency,
        isCoTherapist: true,
      });
    }
  }

  // Most recent first
  out.sort((a, b) => String(b.completedAtRaw).localeCompare(String(a.completedAtRaw)));
  return out;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EmployeesReportTab() {
  const today = todayKw();
  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [toDate, setToDate] = useState(today);
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedTherapists, setExpandedTherapists] = useState<Record<string, boolean>>({});
  const [flatPage, setFlatPage] = useState(1);
  const flatPageSize = 25;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load branches once
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

      // Fetch all completed bookings in date window (paginated)
      const all: Record<string, unknown>[] = [];
      for (let page = 1; page <= 40; page++) {
        const params = new URLSearchParams({
          page: String(page),
          page_size: '100',
          status: 'completed',
        });
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employees report');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Extract all completed service records and filter by date/branch/search
  const allRecords = useMemo(() => extractCompletedRecords(bookings), [bookings]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const brNorm = branchFilter.trim().toLowerCase();

    return allRecords.filter((r) => {
      const k = dateKey(r.completedAtRaw);
      if (fromDate && k && k < fromDate) return false;
      if (toDate && k && k > toDate) return false;
      if (brNorm && r.branchName.toLowerCase() !== brNorm) return false;
      if (q) {
        const hay = `${r.therapistName} ${r.serviceName} ${r.branchName} ${r.bookingNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRecords, fromDate, toDate, branchFilter, search]);

  useEffect(() => {
    setFlatPage(1);
  }, [fromDate, toDate, branchFilter, search]);

  // Group by therapist
  const therapistSummaries = useMemo<TherapistSummary[]>(() => {
    const map = new Map<string, {
      therapistKey: string;
      therapistName: string;
      branches: Set<string>;
      bookingIds: Set<string>;
      totalPrice: number;
      currency: string;
      records: CompletedServiceRecord[];
    }>();

    for (const r of filteredRecords) {
      let bucket = map.get(r.therapistKey);
      if (!bucket) {
        bucket = {
          therapistKey: r.therapistKey,
          therapistName: r.therapistName,
          branches: new Set<string>(),
          bookingIds: new Set<string>(),
          totalPrice: 0,
          currency: r.currency,
          records: [],
        };
        map.set(r.therapistKey, bucket);
      }
      if (r.branchName && r.branchName !== '—') bucket.branches.add(r.branchName);
      bucket.bookingIds.add(r.bookingId);
      bucket.totalPrice += r.price;
      bucket.records.push(r);
    }

    return Array.from(map.values())
      .map((b) => ({
        therapistKey: b.therapistKey,
        therapistName: b.therapistName,
        branches: Array.from(b.branches).sort(),
        serviceCount: b.records.length,
        bookingCount: b.bookingIds.size,
        totalPrice: b.totalPrice,
        currency: b.currency,
        records: b.records,
      }))
      .sort((a, b) => b.serviceCount - a.serviceCount || b.totalPrice - a.totalPrice);
  }, [filteredRecords]);

  // KPI totals (avoid double counting co-therapist revenue in grand total)
  const kpis = useMemo(() => {
    const uniqueBookings = new Set<string>();
    let revenue = 0;
    for (const r of filteredRecords) {
      uniqueBookings.add(r.bookingId);
      if (!r.isCoTherapist) revenue += r.price;
    }
    return {
      therapists: therapistSummaries.length,
      services: filteredRecords.length,
      bookings: uniqueBookings.size,
      revenue,
    };
  }, [filteredRecords, therapistSummaries]);

  const allExpanded =
    therapistSummaries.length > 0 &&
    therapistSummaries.every((t) => expandedTherapists[t.therapistKey]);

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedTherapists({});
    } else {
      const next: Record<string, boolean> = {};
      for (const t of therapistSummaries) next[t.therapistKey] = true;
      setExpandedTherapists(next);
    }
  };

  const toggleTherapist = (key: string) => {
    setExpandedTherapists((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const flatTotalPages = Math.max(1, Math.ceil(filteredRecords.length / flatPageSize));
  const paginatedFlat = useMemo(() => {
    const start = (flatPage - 1) * flatPageSize;
    return filteredRecords.slice(start, start + flatPageSize);
  }, [filteredRecords, flatPage]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Therapist Name',
      'Booking #',
      'Branch',
      'Service Name',
      'Completed Date',
      'Completed Time',
      'Price (KWD)',
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.map(esc).join(','),
      ...filteredRecords.map((r) =>
        [
          r.therapistName,
          r.bookingNumber,
          r.branchName,
          r.serviceName,
          r.completedDate,
          r.completedTime,
          kwd(r.price),
        ]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-completed-services-report-${fromDate || 'all'}-to-${toDate || today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Last month helper
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
    <div className="space-y-5">
      {/* ── KPI Summary Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Active Therapists</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {kpis.therapists.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">With completed services</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Completed Services</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Scissors className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {kpis.services.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Individual treatments completed</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Completed Bookings</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {kpis.bookings.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Unique completed appointments</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Service Revenue</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
            {kwd(kpis.revenue)} <span className="text-xs font-semibold text-muted-foreground">KWD</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">From completed bookings</p>
        </div>
      </div>

      {/* ── Filters & View Switcher Bar ── */}
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Range + Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
              />
            </div>

            <div className="flex items-center gap-1">
              {[
                { label: 'Today', from: today, to: today },
                { label: '7d', from: addDays(today, -6), to: today },
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
                    fromDate === p.from && toDate === p.to
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold transition cursor-pointer',
                  viewMode === 'grouped' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>By Therapist</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold transition cursor-pointer',
                  viewMode === 'flat' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List className="h-3.5 w-3.5" />
                <span>Detailed Log</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 disabled:opacity-40 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              title="Refresh"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
            </button>
          </div>
        </div>

        {/* Second row: Search + Branch + Expand All */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search therapist, service, booking #…"
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

            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 h-9">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-foreground outline-none pr-2"
              >
                <option value="">All Branches</option>
                {branchOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {viewMode === 'grouped' && therapistSummaries.length > 0 && (
            <button
              type="button"
              onClick={toggleAllExpanded}
              className="rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/60 transition cursor-pointer"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void loadData()} className="underline font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-14 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading completed bookings & therapist performance…</span>
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-14 text-center text-xs text-muted-foreground">
          No completed bookings found for the selected date range and filters.
        </div>
      ) : viewMode === 'grouped' ? (
        /* ── Grouped by Therapist View ── */
        <div className="space-y-3">
          {therapistSummaries.map((th) => {
            const isOpen = Boolean(expandedTherapists[th.therapistKey]);
            return (
              <div
                key={th.therapistKey}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition"
              >
                <button
                  type="button"
                  onClick={() => toggleTherapist(th.therapistKey)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                      {th.therapistName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{th.therapistName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {th.branches.length > 0 ? th.branches.join(' · ') : 'All Branches'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Services Completed
                      </p>
                      <p className="text-sm font-extrabold text-foreground">
                        {th.serviceCount}{' '}
                        <span className="text-[11px] font-medium text-muted-foreground">
                          ({th.bookingCount} {th.bookingCount === 1 ? 'booking' : 'bookings'})
                        </span>
                      </p>
                    </div>

                    <div className="text-right min-w-[110px]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total Pricing
                      </p>
                      <p className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                        {kwd(th.totalPrice)} {th.currency}
                      </p>
                    </div>

                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border/60 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                          <th className="px-4 py-2.5 whitespace-nowrap">Booking #</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Service Name</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Branch</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Completed Date</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Completed Time</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {th.records.map((rec) => (
                          <tr key={rec.key} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono font-semibold text-foreground whitespace-nowrap">
                              {rec.bookingNumber}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-foreground">
                              {rec.serviceName}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                              {rec.branchName}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                              {rec.completedDate}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 opacity-70" />
                                {rec.completedTime}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-foreground whitespace-nowrap">
                              {kwd(rec.price)} {rec.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat Detailed Service Log View ── */
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 whitespace-nowrap">Therapist</th>
                  <th className="px-4 py-3 whitespace-nowrap">Booking #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Service Name</th>
                  <th className="px-4 py-3 whitespace-nowrap">Branch</th>
                  <th className="px-4 py-3 whitespace-nowrap">Completed Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Completed Time</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedFlat.map((rec) => (
                  <tr key={rec.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                      {rec.therapistName}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {rec.bookingNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {rec.serviceName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {rec.branchName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {rec.completedDate}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {rec.completedTime}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-foreground whitespace-nowrap">
                      {kwd(rec.price)} {rec.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <td colSpan={6} className="px-4 py-3 text-xs uppercase tracking-wider">
                    Total ({filteredRecords.length.toLocaleString()} completed services)
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {kwd(kpis.revenue)} KWD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              Showing {(flatPage - 1) * flatPageSize + 1}–{Math.min(flatPage * flatPageSize, filteredRecords.length)} of{' '}
              {filteredRecords.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={flatPage <= 1}
                onClick={() => setFlatPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-semibold text-foreground">
                Page {flatPage} / {flatTotalPages}
              </span>
              <button
                type="button"
                disabled={flatPage >= flatTotalPages}
                onClick={() => setFlatPage((p) => Math.min(flatTotalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
