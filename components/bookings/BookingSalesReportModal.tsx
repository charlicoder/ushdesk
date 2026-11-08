'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Printer, TrendingUp, Building2, CreditCard, Wallet, UserCheck, CheckCircle2, Clock,
  BarChart3, ArrowLeft, Eye, Loader2, AlertCircle, BookOpen, Banknote, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { normalise, type Booking } from '@/components/bookings/BookingDetailPopup';

export type BookingSalesPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
type StatusGroup = 'confirmed' | 'in_progress' | 'completed' | 'pending' | 'cancelled' | 'no_show' | 'parked';
type PayGroup = 'paid' | 'rewarded' | 'pending' | 'failed' | 'refunded';

interface Props {
  period: BookingSalesPeriod;
  restrictedBranchId?: string | null;
  restrictedBranchName?: string | null;
  onClose: () => void;
}

const TZ = 'Asia/Kuwait';
const PERIOD_LABEL: Record<BookingSalesPeriod, string> = {
  daily: 'Daily Booking Sales Report',
  weekly: 'Weekly Booking Sales Report',
  monthly: 'Monthly Booking Sales Report',
  custom: 'Custom Booking Sales Report',
};

const STATUS_OPTIONS: { key: StatusGroup; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'Checked-in / In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending / Requested' },
  { key: 'cancelled', label: 'Cancelled / Refunded' },
  { key: 'no_show', label: 'No show' },
  { key: 'parked', label: 'Parked' },
];
const PAY_OPTIONS: { key: PayGroup; label: string }[] = [
  { key: 'paid', label: 'Paid' },
  { key: 'rewarded', label: 'Rewarded (loyalty)' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];

// ── Date helpers (YYYY-MM-DD strings, Kuwait wall-clock) ─────────────────────
const todayKw = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateKey = (raw: string | null | undefined): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !/[TZ+]/.test(s.slice(10))) return s.slice(0, 10);
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString('en-CA', { timeZone: TZ });
};
const prettyDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (raw: string | null | undefined) => {
  if (!raw) return '—';
  const d = new Date(String(raw));
  return isNaN(d.getTime())
    ? String(raw)
    : d.toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
};

const num = (v: unknown) => { const n = parseFloat(String(v ?? 0)); return isNaN(n) ? 0 : n; };
const kwd = (n: number) => n.toFixed(3);
const norm = (s: unknown) => String(s ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');

// ── Labels ───────────────────────────────────────────────────────────────────
const throughLabel = (raw: string | null | undefined) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Unknown';
  if (s === 'ushweb' || s === 'web' || s === 'online') return 'USHWEB';
  if (s === 'ushdesk' || s === 'desk') return 'USHDESK';
  if (s === 'ushspa' || s === 'spa' || s === 'app') return 'USHSPA';
  return s.toUpperCase();
};
const providerLabel = (raw: string | null | undefined) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Not specified';
  if (s === 'knet_pos') return 'KNET POS';
  if (s === 'knet' || s === 'knet_card') return 'KNET';
  if (s === 'myfatoorah') return 'MyFatoorah';
  if (s === 'tap' || s === 'deema') return 'Deema';
  if (s === 'boubyan_link' || s === 'boubyan') return 'Boubyan';
  if (s === 'gift_voucher') return 'Gift Voucher';
  if (s === 'loyalty') return 'Loyalty Points';
  if (s === 'course') return 'Course';
  if (s === 'cash') return 'Cash';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
};
const methodLabel = (raw: string | null | undefined) => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Not specified';
  if (s === 'knet_card' || s === 'knet') return 'KNET Card';
  if (s === 'apple_pay') return 'Apple Pay';
  if (s === 'deema_link') return 'Deema Link';
  if (s === 'boubyan_link') return 'Boubyan Link';
  if (s === 'gift_voucher') return 'Gift Voucher';
  if (s === 'loyalty') return 'Loyalty Points';
  if (s === 'course') return 'Course';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
};
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

const providerOf = (b: Booking) => providerLabel(b.payment_provider || b.payment_gateway);
const creatorOf = (b: Booking): string => {
  const d = (b.created_by_user_data ?? {}) as Record<string, unknown>;
  const name =
    String(d.name ?? d.full_name ?? '').trim() ||
    [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  const through = norm(b.payment_through || b.channel);
  return through === 'ushweb' || through === 'ushspa' ? 'Customer (online)' : 'Staff';
};

function statusGroup(b: Booking): StatusGroup | null {
  const s = norm(b.status);
  if (['confirmed', 'approved', 'reschedule_approved', 'scheduled'].includes(s)) return 'confirmed';
  if (['checked_in', 'in_progress'].includes(s)) return 'in_progress';
  if (s === 'completed') return 'completed';
  if (['pending', 'payment_pending', 'requested', 'reschedule_requested'].includes(s)) return 'pending';
  if (['cancelled', 'refunded', 'payment_failed'].includes(s)) return 'cancelled';
  if (s === 'no_show') return 'no_show';
  if (s === 'parked') return 'parked';
  return null;
}
function payGroup(b: Booking): PayGroup {
  const s = norm(b.payment_status);
  if (['success', 'paid', 'completed'].includes(s)) return 'paid';
  if (s === 'rewarded') return 'rewarded';
  if (['refunded', 'refunded_with_points', 'partially_refunded'].includes(s)) return 'refunded';
  if (['failed', 'cancelled', 'expired'].includes(s)) return 'failed';
  return b.is_paid ? 'paid' : 'pending';
}

interface Row { label: string; count: number; total: number; items: Booking[] }

export function BookingSalesReportModal({ period, restrictedBranchId, restrictedBranchName, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const today = todayKw();

  const [stage, setStage] = useState<'configure' | 'report'>('configure');
  const [statuses, setStatuses] = useState<Set<StatusGroup>>(new Set<StatusGroup>(['confirmed', 'in_progress', 'completed']));
  const [payStatuses, setPayStatuses] = useState<Set<PayGroup>>(new Set<PayGroup>(['paid', 'rewarded']));
  const [dailyDate, setDailyDate] = useState(today);
  const [weekEnding, setWeekEnding] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [customFrom, setCustomFrom] = useState(addDays(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [detail, setDetail] = useState<{ title: string; items: Booking[] } | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const { from, to } = useMemo(() => {
    if (period === 'daily') return { from: dailyDate, to: dailyDate };
    if (period === 'weekly') return { from: addDays(weekEnding, -6), to: weekEnding };
    if (period === 'monthly') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
    }
    return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
  }, [period, dailyDate, weekEnding, month, customFrom, customTo]);

  const dailyChoices = useMemo(() => {
    // Today, Yesterday and the last 10 days
    const out: { value: string; label: string }[] = [
      { value: today, label: 'Today' },
      { value: addDays(today, -1), label: 'Yesterday' },
    ];
    for (let i = 2; i <= 10; i++) out.push({ value: addDays(today, -i), label: prettyDate(addDays(today, -i)) });
    return out;
  }, [today]);

  const toggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, k: T) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  // Fetch every booking of the chosen period (all pages) once the report is generated
  useEffect(() => {
    if (stage !== 'report') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const all: Record<string, unknown>[] = [];
        for (let page = 1; page <= 40; page++) {
          let url = `/api/v1/bookings?page=${page}&page_size=100&from_date=${from}&to_date=${to}`;
          if (restrictedBranchId) url += `&branch_id=${encodeURIComponent(restrictedBranchId)}`;
          const res = await authedFetch(url);
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.detail ?? json?.message ?? `Failed to load bookings (${res.status})`);
          const list: Record<string, unknown>[] = Array.isArray(json) ? json : (json?.data ?? json?.results ?? json?.items ?? []);
          all.push(...list);
          if (!Array.isArray(list) || list.length < 100) break;
        }
        if (!cancelled) setBookings(all.map((r) => normalise(r)));
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load bookings'); setBookings([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stage, from, to, restrictedBranchId]);

  // Bookings matching the date range (appointment date), branch scope and chosen statuses
  const scoped = useMemo(() => {
    const tId = String(restrictedBranchId ?? '').trim().toLowerCase();
    const tName = String(restrictedBranchName ?? '').trim().toLowerCase();
    return bookings.filter((b) => {
      const k = dateKey(b.appointment_start || b.created_at);
      if (!k || k < from || k > to) return false;
      const sg = statusGroup(b);
      if (!sg || !statuses.has(sg)) return false;
      if (!payStatuses.has(payGroup(b))) return false;
      if (tId || tName) {
        const raw = (b.raw ?? {}) as Record<string, unknown>;
        const bId = String(raw.branch_id ?? '').trim().toLowerCase();
        const bName = String(b.branch_name ?? '').trim().toLowerCase();
        if (!((tId && bId && bId === tId) || (tName && bName && bName === tName))) return false;
      }
      return true;
    });
  }, [bookings, from, to, statuses, payStatuses, restrictedBranchId, restrictedBranchName]);

  const stats = useMemo(() => {
    const sum = (list: Booking[]) => list.reduce((s, b) => s + num(b.total_amount), 0);
    const paid = scoped.filter((b) => ['paid', 'rewarded'].includes(payGroup(b)));
    const pending = scoped.filter((b) => payGroup(b) === 'pending');
    const group = (keyFn: (b: Booking) => string): Row[] => {
      const m = new Map<string, Row>();
      for (const b of scoped) {
        const k = keyFn(b) || 'Other';
        const r = m.get(k) ?? { label: k, count: 0, total: 0, items: [] };
        r.count += 1; r.total += num(b.total_amount); r.items.push(b);
        m.set(k, r);
      }
      return Array.from(m.values()).sort((a, b) => b.total - a.total);
    };
    return {
      total: sum(scoped), paidTotal: sum(paid), pendingTotal: sum(pending),
      paidCount: paid.length, pendingCount: pending.length,
      tables: [
        { title: 'By Branch', icon: Building2, rows: group((b) => b.branch_name || 'Unassigned') },
        { title: 'By Payment Through', icon: Wallet, rows: group((b) => throughLabel(b.payment_through)) },
        { title: 'By Payment Provider', icon: CreditCard, rows: group(providerOf) },
        { title: 'By Payment Method', icon: Banknote, rows: group((b) => methodLabel(b.payment_method)) },
        { title: 'By Booking Status', icon: ListChecks, rows: group((b) => titleCase(norm(b.status))) },
        { title: 'By Payment Status', icon: CheckCircle2, rows: group((b) => titleCase(norm(b.payment_status) || 'pending')) },
        { title: 'By Created By', icon: UserCheck, rows: group(creatorOf) },
      ],
    };
  }, [scoped]);

  const currency = scoped[0]?.currency || bookings[0]?.currency || 'KWD';
  const rangeLabel = from === to ? prettyDate(from) : `${prettyDate(from)}  –  ${prettyDate(to)}`;
  const generated = new Date().toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
  const statusSummary = STATUS_OPTIONS.filter((o) => statuses.has(o.key)).map((o) => o.label).join(', ');
  const paySummary = PAY_OPTIONS.filter((o) => payStatuses.has(o.key)).map((o) => o.label).join(', ');

  const handlePrint = () => {
    const node = reportRef.current;
    if (!node) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join('\n');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    const win = frame.contentWindow;
    if (!doc || !win) { document.body.removeChild(frame); return; }
    doc.open();
    doc.write(`<!doctype html><html class="${document.documentElement.className.replace(/\bdark\b/g, '')}"><head><meta charset="utf-8"><title>${PERIOD_LABEL[period]}</title>${styles}
<style>@page{size:A4;margin:12mm} body{background:#fff !important;color:#2d241e;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .no-print{display:none !important} .avoid-break{break-inside:avoid}</style></head><body>${node.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 1500);
    }, 700);
  };

  const Table = ({ title, icon: Icon, rows }: { title: string; icon: React.ElementType; rows: Row[] }) => (
    <div className="avoid-break rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">{title}</h4>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-xs text-muted-foreground">No bookings in this period.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right">Bookings</th>
              <th className="px-2 py-2 text-right">Sub Total ({currency})</th>
              <th className="px-4 py-2 text-left w-[30%]">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const pct = stats.total > 0 ? (r.total / stats.total) * 100 : 0;
              return (
                <tr key={r.label}>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {r.count}
                      <button
                        type="button"
                        onClick={() => setDetail({ title: `${title} · ${r.label}`, items: r.items })}
                        title={`View ${r.count} booking${r.count !== 1 ? 's' : ''}`}
                        className="no-print grid h-6 w-6 place-items-center rounded-lg text-primary hover:bg-primary/10 transition cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-bold tabular-nums">{kwd(r.total)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border/60 bg-muted/30 font-extrabold">
            <tr>
              <td className="px-4 py-2">Sub Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{rows.reduce((s, r) => s + r.count, 0)}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">{kwd(rows.reduce((s, r) => s + r.total, 0))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  // ── Stage 1: choose date + statuses ─────────────────────────────────────────
  if (stage === 'configure') {
    const checkbox = <T extends string>(
      key: T, label: string, checked: boolean, onToggle: () => void,
    ) => (
      <label key={key} className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
        checked ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card hover:bg-muted/50',
      )}>
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </label>
    );
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-extrabold text-foreground">{PERIOD_LABEL[period]}</p>
                <p className="text-[11px] text-muted-foreground">Choose the date, booking status and payment status</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5 max-h-[70vh] overflow-y-auto">
            {period === 'daily' && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Date (appointment date)</p>
                <div className="grid grid-cols-2 gap-2">
                  {dailyChoices.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setDailyDate(c.value)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-xs font-semibold transition cursor-pointer',
                        dailyDate === c.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 bg-card text-foreground hover:bg-muted/60',
                      )}
                    >
                      <span className="block">{c.label}</span>
                      {(c.label === 'Today' || c.label === 'Yesterday') && (
                        <span className="block text-[10px] font-normal text-muted-foreground">{prettyDate(c.value)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {period === 'weekly' && (
              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Week ending (7 days)</span>
                <input type="date" value={weekEnding} max={today} onChange={(e) => e.target.value && setWeekEnding(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                <span className="mt-1 block text-[11px] text-muted-foreground">{prettyDate(from)} – {prettyDate(to)}</span>
              </label>
            )}

            {period === 'monthly' && (
              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Month</span>
                <input type="month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
            )}

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">From</span>
                  <input type="date" value={customFrom} onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                  <input type="date" value={customTo} onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Booking Status</p>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((o) => checkbox(o.key, o.label, statuses.has(o.key), () => toggle(setStatuses, o.key)))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment Status</p>
              <div className="space-y-2">
                {PAY_OPTIONS.map((o) => checkbox(o.key, o.label, payStatuses.has(o.key), () => toggle(setPayStatuses, o.key)))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/50 px-5 py-3.5">
            <button type="button" onClick={onClose} className="rounded-xl border border-border/60 bg-card px-4 py-2 text-xs font-semibold hover:bg-muted/60 transition cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={statuses.size === 0 || payStatuses.size === 0}
              onClick={() => setStage('report')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Generate Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stage 2: report ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-card px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-extrabold text-foreground">{PERIOD_LABEL[period]}</p>
              <p className="text-[11px] text-muted-foreground">
                {restrictedBranchName ? `${restrictedBranchName} · ` : 'All Branches · '}{statusSummary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStage('configure')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-semibold hover:bg-muted/60 transition cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" /> Change
            </button>
            <button type="button" onClick={handlePrint} disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/10 p-5">
          <div ref={reportRef} className="mx-auto max-w-[820px] rounded-2xl bg-card p-7 space-y-6 border border-border/40">
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-primary pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-wider text-primary">USH SPA</h1>
                <p className="text-[11px] text-muted-foreground">Spa &amp; Wellness Center · {restrictedBranchName || 'All Branches'}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black tracking-wide text-foreground uppercase">{PERIOD_LABEL[period]}</h2>
                <p className="text-xs font-semibold text-foreground mt-0.5">{rangeLabel}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Booking status: {statusSummary}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Payment status: {paySummary}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Generated {generated}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Preparing report…
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Bookings', value: String(scoped.length), sub: 'matching your selection', icon: BookOpen, tone: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200/70' },
                    { label: 'Total Amount', value: kwd(stats.total), sub: currency, icon: TrendingUp, tone: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/70' },
                    { label: 'Paid / Rewarded', value: kwd(stats.paidTotal), sub: `${stats.paidCount} bookings`, icon: CheckCircle2, tone: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/70' },
                    { label: 'Pending Payment', value: kwd(stats.pendingTotal), sub: `${stats.pendingCount} bookings`, icon: Clock, tone: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/70' },
                  ].map((k) => (
                    <div key={k.label} className={cn('avoid-break rounded-2xl border p-3.5', k.bg)}>
                      <k.icon className={cn('h-4 w-4 mb-1.5', k.tone)} />
                      <p className={cn('text-lg font-black tabular-nums leading-none', k.tone)}>{k.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 mt-1">{k.label}</p>
                    </div>
                  ))}
                </div>

                {stats.tables.map((t) => (
                  <Table key={t.title} title={t.title} icon={t.icon} rows={t.rows} />
                ))}

                <p className="text-center text-[10px] text-muted-foreground border-t border-border/50 pt-3">
                  Bookings counted by appointment date. Amounts in {currency}. Dates in Kuwait time. — USH Spa
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bookings of the clicked breakdown row ── */}
      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetail(null)} />
          <div className="relative z-10 w-full max-w-6xl max-h-[85vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-foreground truncate">{detail.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {detail.items.length} booking{detail.items.length !== 1 ? 's' : ''} ·{' '}
                  {kwd(detail.items.reduce((s, b) => s + num(b.total_amount), 0))} {currency}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Booking No.</th>
                    <th className="px-2 py-2 text-left">Customer</th>
                    <th className="px-2 py-2 text-left">Service</th>
                    <th className="px-2 py-2 text-left">Branch</th>
                    <th className="px-2 py-2 text-left">Appointment</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Payment Status</th>
                    <th className="px-2 py-2 text-left">Payment Provider</th>
                    <th className="px-4 py-2 text-right">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {detail.items.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono font-bold text-foreground whitespace-nowrap">{b.booking_number || b.id.slice(0, 8)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{b.customer_name}</td>
                      <td className="px-2 py-2 max-w-[220px] truncate" title={b.service_name}>{b.service_name || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{b.branch_name || '—'}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmtDateTime(b.appointment_start)}</td>
                      <td className="px-2 py-2 capitalize whitespace-nowrap">{titleCase(norm(b.status))}</td>
                      <td className="px-2 py-2 capitalize whitespace-nowrap">{titleCase(norm(b.payment_status) || 'pending')}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{providerOf(b)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold tabular-nums">{kwd(num(b.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border/60 bg-muted/30 font-extrabold">
                  <tr>
                    <td className="px-4 py-2" colSpan={8}>Total</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {kwd(detail.items.reduce((s, b) => s + num(b.total_amount), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

