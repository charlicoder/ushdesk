'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MessageCircle, CheckCircle2, CheckCheck, Send, XCircle, Clock,
  RefreshCw, Search, X, ChevronLeft, ChevronRight, Loader2,
  AlertCircle, ShieldAlert, Copy, Check, CalendarDays, Activity,
  ArrowRight, AlertTriangle,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { usePermissions } from '@/hooks/use-permissions';
import { authedFetch } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WhatsAppNotificationItem {
  id: string;
  event_id: string;
  customer_id: string | null;
  booking_id: string | null;
  channel: string;
  recipient: string;
  recipient_name: string | null;
  template_name: string | null;
  subject: string | null;
  status: string;
  provider: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  correlation_id: string | null;
}

interface AttemptRecord {
  id: string;
  provider: string;
  attempt_number: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  is_retryable: boolean;
  latency_ms: number | null;
}

interface StatusHistoryRecord {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

interface WhatsAppNotificationDetail extends WhatsAppNotificationItem {
  attempts: AttemptRecord[];
  status_history: StatusHistoryRecord[];
}

interface StatusCounts {
  total: number;
  delivered: number;
  read: number;
  sent: number;
  failed: number;
}

const TZ = 'Asia/Kuwait';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function prettyTemplate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw
    .replace(/\//g, ' · ')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_STYLE: Record<string, { label: string; badge: string; Icon: React.ElementType }> = {
  DELIVERED:  { label: 'Delivered',  badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', Icon: CheckCheck },
  READ:       { label: 'Read',       badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',             Icon: CheckCheck },
  SENT:       { label: 'Sent (API)', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',             Icon: Send },
  FAILED:     { label: 'Failed',     badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',             Icon: XCircle },
  PROCESSING: { label: 'Processing', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',         Icon: Clock },
  CREATED:    { label: 'Created',    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',         Icon: Clock },
  QUEUED:     { label: 'Queued',     badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',     Icon: Clock },
};

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'READ', label: 'Read' },
  { key: 'SENT', label: 'Sent (API)' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'PROCESSING', label: 'Processing' },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WhatsAppStatusPage() {
  const { isAdmin } = usePermissions();

  const [items, setItems] = useState<WhatsAppNotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [counts, setCounts] = useState<StatusCounts>({ total: 0, delivered: 0, read: 0, sent: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WhatsAppNotificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;
    const base = (st?: string) => {
      const p = new URLSearchParams({ channel: 'whatsapp', page: '1', page_size: '1' });
      if (st) p.set('status', st);
      if (dateFrom) p.set('date_from', `${dateFrom}T00:00:00+03:00`);
      if (dateTo) p.set('date_to', `${dateTo}T23:59:59+03:00`);
      return authedFetch(`/api/v1/whatsapp-status?${p.toString()}`)
        .then((r) => (r.ok ? r.json() : { total: 0 }))
        .then((j) => Number(j?.total ?? 0))
        .catch(() => 0);
    };
    const [allCnt, delCnt, readCnt, sentCnt, failCnt] = await Promise.all([
      base(),
      base('DELIVERED'),
      base('READ'),
      base('SENT'),
      base('FAILED'),
    ]);
    setCounts({ total: allCnt, delivered: delCnt, read: readCnt, sent: sentCnt, failed: failCnt });
  }, [isAdmin, dateFrom, dateTo]);

  const loadList = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        channel: 'whatsapp',
        page: String(page),
        page_size: String(pageSize),
      });
      if (statusFilter) p.set('status', statusFilter);
      if (dateFrom) p.set('date_from', `${dateFrom}T00:00:00+03:00`);
      if (dateTo) p.set('date_to', `${dateTo}T23:59:59+03:00`);

      const res = await authedFetch(`/api/v1/whatsapp-status?${p.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.detail ?? json?.message ?? `Failed to load WhatsApp statuses (${res.status})`);
      }

      const rows: WhatsAppNotificationItem[] = Array.isArray(json?.items) ? json.items : [];
      const tot = Number(json?.total ?? rows.length);
      const pgs = Math.max(1, Number(json?.total_pages ?? Math.ceil(tot / pageSize)));
      setItems(rows);
      setTotal(tot);
      setTotalPages(pgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load WhatsApp delivery statuses');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, pageSize, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo, pageSize]);

  // Fetch notification details when a row is clicked
  useEffect(() => {
    if (!selectedId || !isAdmin) return;
    let active = true;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    authedFetch(`/api/v1/whatsapp-status/${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.detail ?? json?.message ?? `Error ${res.status}`);
        if (active) setDetail(json as WhatsAppNotificationDetail);
      })
      .catch((e) => {
        if (active) setDetailError(e instanceof Error ? e.message : 'Failed to load delivery details');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId, isAdmin]);

  // Escape closes detail modal
  useEffect(() => {
    if (!selectedId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedId]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => {
      const hay = `${n.recipient} ${n.recipient_name ?? ''} ${n.template_name ?? ''} ${n.booking_id ?? ''} ${n.status} ${n.provider ?? ''} ${n.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const copyText = (text: string) => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      setTimeout(() => setCopiedText((cur) => (cur === text ? null : cur)), 1600);
    });
  };

  // ── Non-Admin Guard ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <DashboardShell>
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-extrabold text-foreground">Admin Access Required</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            The WhatsApp Delivery Status monitor is restricted to administrators only.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="WhatsApp Delivery Status"
          subtitle="Real-time Meta Cloud API dispatch, delivery webhooks, read receipts, and failure diagnostics"
        />
        <button
          type="button"
          onClick={() => {
            void loadList();
            void fetchCounts();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Messages</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {counts.total.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">All WhatsApp dispatches</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Delivered / Read</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
            {(counts.delivered + counts.read).toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {counts.delivered.toLocaleString()} delivered · {counts.read.toLocaleString()} read
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Sent (Awaiting Webhook)</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-blue-700 dark:text-blue-400">
            {counts.sent.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Accepted by Meta API</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Failed</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-rose-700 dark:text-rose-400">
            {counts.failed.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Click a row to inspect error code</p>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="mt-5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.key || 'all'}
                type="button"
                onClick={() => setStatusFilter(sf.key)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                  statusFilter === sf.key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {sf.label}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 py-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter page by recipient name, phone, template, booking/voucher ID…"
            className="h-9 w-full rounded-xl border border-border/70 bg-background pl-9 pr-8 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void loadList()} className="underline font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── Data Table ── */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 whitespace-nowrap">Recipient</th>
                <th className="px-4 py-3 whitespace-nowrap">Template / Event</th>
                <th className="px-4 py-3 whitespace-nowrap">Provider</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Retries</th>
                <th className="px-4 py-3 whitespace-nowrap">Created At</th>
                <th className="px-4 py-3 whitespace-nowrap">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading WhatsApp delivery logs…</span>
                    </div>
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                    No WhatsApp notifications found for the selected filters.
                  </td>
                </tr>
              ) : (
                visibleItems.map((n) => {
                  const key = String(n.status || '').toUpperCase();
                  const st = STATUS_STYLE[key] ?? {
                    label: key || 'Unknown',
                    badge: 'bg-muted text-muted-foreground border-border',
                    Icon: Clock,
                  };
                  const StIcon = st.Icon;
                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className="hover:bg-primary/5 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {n.recipient_name || 'Unknown Recipient'}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {n.recipient}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {prettyTemplate(n.template_name)}
                        </div>
                        {n.booking_id && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            Ref: {n.booking_id.slice(0, 8)}…
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">
                          {n.provider || 'meta'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            st.badge,
                          )}
                        >
                          <StIcon className="h-3 w-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-muted-foreground">
                        {n.retry_count}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(n.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(n.updated_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none"
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{' '}
                {total.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-semibold text-foreground">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delivery Detail Popup Modal ── */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">
                    WhatsApp Delivery Details
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    ID: {selectedId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {detailLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading attempts &amp; status history…</span>
                  </div>
                </div>
              ) : detailError ? (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              ) : detail ? (
                <>
                  {/* Top Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Recipient
                      </span>
                      <p className="mt-1 font-bold text-foreground">{detail.recipient_name || '—'}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{detail.recipient}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Template
                      </span>
                      <p className="mt-1 font-bold text-foreground">{prettyTemplate(detail.template_name)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{detail.template_name}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Current Status
                      </span>
                      <div className="mt-1.5">
                        {(() => {
                          const key = String(detail.status || '').toUpperCase();
                          const st = STATUS_STYLE[key] ?? {
                            label: key,
                            badge: 'bg-muted text-muted-foreground border-border',
                            Icon: Clock,
                          };
                          const StIcon = st.Icon;
                          return (
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase', st.badge)}>
                              <StIcon className="h-3 w-3" />
                              {st.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Attempts */}
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-muted/40 px-3.5 py-2 border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Delivery Attempts ({detail.attempts.length})
                    </div>
                    {detail.attempts.length === 0 ? (
                      <div className="p-4 text-muted-foreground">No delivery attempts recorded yet.</div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {detail.attempts.map((att) => (
                          <div key={att.id} className="p-3.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">Attempt #{att.attempt_number}</span>
                                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-foreground">
                                  {att.provider}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                                    att.status === 'SUCCESS'
                                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300',
                                  )}
                                >
                                  {att.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {fmtDateTime(att.started_at)}
                                {att.latency_ms != null && (
                                  <span className="ml-2 font-mono font-semibold text-foreground">
                                    ({att.latency_ms} ms)
                                  </span>
                                )}
                              </div>
                            </div>

                            {att.provider_message_id && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="font-semibold">WAMID:</span>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground break-all">
                                  {att.provider_message_id}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyText(att.provider_message_id!)}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 shrink-0 cursor-pointer"
                                >
                                  {copiedText === att.provider_message_id ? (
                                    <>
                                      <Check className="h-3 w-3" /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {(att.error_code || att.error_message) && (
                              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  {att.error_code && (
                                    <p className="font-mono font-bold text-[11px]">
                                      Meta Error Code: {att.error_code}
                                    </p>
                                  )}
                                  {att.error_message && (
                                    <p className="mt-0.5 text-xs leading-relaxed break-words">
                                      {att.error_message}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status History Timeline */}
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-muted/40 px-3.5 py-2 border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      Status History Timeline ({detail.status_history.length})
                    </div>
                    {detail.status_history.length === 0 ? (
                      <div className="p-4 text-muted-foreground">No status transitions recorded.</div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {detail.status_history.map((h) => (
                          <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-foreground">
                                {h.from_status && (
                                  <>
                                    <span className="text-muted-foreground">{h.from_status}</span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  </>
                                )}
                                <span
                                  className={cn(
                                    h.to_status === 'DELIVERED' || h.to_status === 'READ'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : h.to_status === 'FAILED'
                                      ? 'text-rose-700 dark:text-rose-400'
                                      : 'text-foreground',
                                  )}
                                >
                                  {h.to_status}
                                </span>
                              </div>
                              {h.reason && (
                                <p className="text-[11px] text-muted-foreground">{h.reason}</p>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {fmtDateTime(h.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-border/60 bg-muted/20 px-5 py-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
