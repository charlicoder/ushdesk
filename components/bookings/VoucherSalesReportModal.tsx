'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Printer, TrendingUp, Building2, CreditCard, Wallet, UserCheck, CalendarDays,
  CheckCircle2, Clock, Gift, BarChart3, ArrowLeft, Eye, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type VoucherSalesPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
type StatusKey = 'pending' | 'active' | 'redeemed';

/** Minimal voucher shape needed by the report (compatible with the page's Voucher). */
export interface ReportVoucher {
  id: string;
  status: string;
  total_amount: string;
  currency: string;
  created_at: string;
  redeemed_at: string | null;
  branch_id?: string;
  branch_data?: { name?: string } | null;
  payment_provider?: string | null;
  payment_through?: string | null;
  payment_data?: any;
  voucher_number?: string | null;
  secret_code?: string | null;
  sender_details?: { name?: string } | null;
  sender_data?: { name?: string } | null;
  recipient_details?: { name?: string } | null;
  recipient_data?: { name?: string } | null;
  recipient_phone?: string | null;
  gift_from?: string | null;
  gift_to?: string | null;
  referenced_by_name?: string | null;
  referral_number?: string | null;
}

interface Props {
  period: VoucherSalesPeriod;
  vouchers: ReportVoucher[];
  /**
   * When provided, the report loads its vouchers for the chosen date range (page by page) instead of
   * using the `vouchers` prop — so the page never has to hold every voucher.
   */
  loadVouchers?: (from: string, to: string) => Promise<ReportVoucher[]>;
  /** Resolves the display name of the voucher creator (same logic as the page) */
  getCreatorName: (v: ReportVoucher) => string;
  restrictedBranchId?: string | null;
  restrictedBranchName?: string | null;
  onClose: () => void;
}

const TZ = 'Asia/Kuwait';
const PERIOD_LABEL: Record<VoucherSalesPeriod, string> = {
  daily: 'Daily Voucher Sales Report',
  weekly: 'Weekly Voucher Sales Report',
  monthly: 'Monthly Voucher Sales Report',
  custom: 'Custom Voucher Sales Report',
};
const STATUS_LABEL: Record<StatusKey, string> = {
  pending: 'Pending',
  active: 'Active / Scheduled',
  redeemed: 'Redeemed',
};

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

const num = (v: unknown) => { const n = parseFloat(String(v ?? 0)); return isNaN(n) ? 0 : n; };
const kwd = (n: number) => n.toFixed(3);

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
  if (s === 'cash') return 'Cash';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
};

const voucherProvider = (v: ReportVoucher) =>
  providerLabel(v.payment_provider || v.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentGateway);

const senderOf = (v: ReportVoucher) =>
  String(v.sender_data?.name || v.sender_details?.name || v.gift_from || '').trim() || '—';
const recipientOf = (v: ReportVoucher) =>
  String(v.recipient_data?.name || v.recipient_details?.name || v.gift_to || v.recipient_phone || '').trim() || '—';

/** Employee whose affiliate link generated the sale, or a "Direct" bucket when none. */
const referrerOf = (v: ReportVoucher) => {
  const name = String(v.referenced_by_name || '').trim();
  if (name) return v.referral_number ? `${name} (#${v.referral_number})` : name;
  return 'Direct (no referral)';
};

const fmtDateTime = (raw: string | null | undefined) => {
  if (!raw) return '—';
  const d = new Date(String(raw));
  return isNaN(d.getTime())
    ? String(raw)
    : d.toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
};

/** Classifies a voucher into exactly one report bucket + the date it is counted on. */
function classify(v: ReportVoucher): { key: StatusKey; date: string } | null {
  const s = String(v.status ?? '').toLowerCase().trim();
  if (s === 'pending' || s === 'payment_pending' || s === 'created' || s.includes('pending')) {
    return { key: 'pending', date: dateKey(v.created_at) };
  }
  const isRedeemed = s !== 'partially_redeemed' && (s === 'redeemed' || Boolean(v.redeemed_at));
  if (isRedeemed) return { key: 'redeemed', date: dateKey(v.redeemed_at || v.created_at) };
  if (s === 'active' || s === 'scheduled') return { key: 'active', date: dateKey(v.created_at) };
  return null;
}

interface Row { label: string; count: number; total: number; items: ReportVoucher[] }

export function VoucherSalesReportModal({
  period,
  vouchers: vouchersProp,
  loadVouchers,
  getCreatorName,
  restrictedBranchId,
  restrictedBranchName,
  onClose,
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const today = todayKw();

  const [stage, setStage] = useState<'configure' | 'report'>('configure');
  const [statuses, setStatuses] = useState<Set<StatusKey>>(new Set<StatusKey>(['pending', 'active', 'redeemed']));
  const [dailyDate, setDailyDate] = useState(today);
  const [weekEnding, setWeekEnding] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [customFrom, setCustomFrom] = useState(addDays(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [detail, setDetail] = useState<{ title: string; items: ReportVoucher[] } | null>(null);

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

  const toggleStatus = (k: StatusKey) =>
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  // Vouchers of the selected range, loaded on demand (when `loadVouchers` is given)
  const [remote, setRemote] = useState<ReportVoucher[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!loadVouchers) return;
    let active = true;
    setLoadingData(true);
    setLoadError(null);
    loadVouchers(from, to)
      .then((rows) => active && setRemote(rows))
      .catch((err) => active && setLoadError(err instanceof Error ? err.message : 'Failed to load vouchers'))
      .finally(() => active && setLoadingData(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  const vouchers = loadVouchers ? remote : vouchersProp;

  // Voucher set for the selected range / statuses / branch scope
  const scoped = useMemo(() => {
    const out: { v: ReportVoucher; key: StatusKey }[] = [];
    const tId = String(restrictedBranchId ?? '').trim().toLowerCase();
    const tName = String(restrictedBranchName ?? '').trim().toLowerCase();
    for (const v of vouchers) {
      const c = classify(v);
      if (!c || !statuses.has(c.key)) continue;
      if (!c.date || c.date < from || c.date > to) continue;
      if (tId || tName) {
        const vId = String(v.branch_id ?? '').trim().toLowerCase();
        const vName = String(v.branch_data?.name ?? '').trim().toLowerCase();
        const match = Boolean((tId && vId && vId === tId) || (tName && vName && vName === tName));
        if (!match) continue;
      }
      out.push({ v, key: c.key });
    }
    return out;
  }, [vouchers, statuses, from, to, restrictedBranchId, restrictedBranchName]);

  const stats = useMemo(() => {
    const sales = scoped.filter((x) => x.key !== 'pending').map((x) => x.v);
    const pending = scoped.filter((x) => x.key === 'pending').map((x) => x.v);
    const sum = (list: ReportVoucher[]) => list.reduce((s, v) => s + num(v.total_amount), 0);
    const active = scoped.filter((x) => x.key === 'active').map((x) => x.v);
    const redeemed = scoped.filter((x) => x.key === 'redeemed').map((x) => x.v);

    const group = (list: ReportVoucher[], keyFn: (v: ReportVoucher) => string): Row[] => {
      const m = new Map<string, Row>();
      for (const v of list) {
        const k = keyFn(v) || 'Other';
        const r = m.get(k) ?? { label: k, count: 0, total: 0, items: [] };
        r.count += 1; r.total += num(v.total_amount); r.items.push(v);
        m.set(k, r);
      }
      return Array.from(m.values()).sort((a, b) => b.total - a.total);
    };
    const providerOf = voucherProvider;
    const build = (list: ReportVoucher[]) => ({
      byBranch: group(list, (v) => v.branch_data?.name || 'Unassigned'),
      byThrough: group(list, (v) => throughLabel(v.payment_through)),
      byProvider: group(list, providerOf),
      byCreator: group(list, (v) => getCreatorName(v)),
      byReferrer: group(list, referrerOf),
    });
    return {
      sales, pending, active, redeemed,
      salesTotal: sum(sales), pendingTotal: sum(pending),
      activeTotal: sum(active), redeemedTotal: sum(redeemed),
      salesTables: build(sales), pendingTables: build(pending),
    };
  }, [scoped, getCreatorName]);

  const currency = scoped[0]?.v.currency || vouchers[0]?.currency || 'KWD';
  const rangeLabel = from === to ? prettyDate(from) : `${prettyDate(from)}  –  ${prettyDate(to)}`;
  const generated = new Date().toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
  const statusSummary = (Object.keys(STATUS_LABEL) as StatusKey[]).filter((k) => statuses.has(k)).map((k) => STATUS_LABEL[k]).join(', ');

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

  const Table = ({ title, icon: Icon, rows, grand }: { title: string; icon: React.ElementType; rows: Row[]; grand: number }) => (
    <div className="avoid-break rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-foreground">{title}</h4>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-xs text-muted-foreground">No vouchers in this period.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right">Vouchers</th>
              <th className="px-2 py-2 text-right">Sub Total ({currency})</th>
              <th className="px-4 py-2 text-left w-[30%]">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const pct = grand > 0 ? (r.total / grand) * 100 : 0;
              return (
                <tr key={r.label}>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {r.count}
                      <button
                        type="button"
                        onClick={() => setDetail({ title: `${title} · ${r.label}`, items: r.items })}
                        title={`View ${r.count} voucher${r.count !== 1 ? 's' : ''}`}
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

  const Section = ({ heading, note, tables, grand, tone }: {
    heading: string; note: string; grand: number; tone: string;
    tables: { byBranch: Row[]; byThrough: Row[]; byProvider: Row[]; byCreator: Row[]; byReferrer: Row[] };
  }) => (
    <div className="space-y-4">
      <div className={cn('avoid-break rounded-xl border px-4 py-2.5', tone)}>
        <p className="text-xs font-black uppercase tracking-wider">{heading}</p>
        <p className="text-[10px] text-muted-foreground">{note}</p>
      </div>
      <Table title="By Branch" icon={Building2} rows={tables.byBranch} grand={grand} />
      <Table title="By Payment Through" icon={Wallet} rows={tables.byThrough} grand={grand} />
      <Table title="By Payment Provider" icon={CreditCard} rows={tables.byProvider} grand={grand} />
      <Table title="By Created By" icon={UserCheck} rows={tables.byCreator} grand={grand} />
      <Table title="By Referred By" icon={Link2} rows={tables.byReferrer} grand={grand} />
    </div>
  );

  // ── Stage 1: choose date + statuses ─────────────────────────────────────────
  if (stage === 'configure') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-extrabold text-foreground">{PERIOD_LABEL[period]}</p>
                <p className="text-[11px] text-muted-foreground">Choose the date and voucher status</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5 max-h-[70vh] overflow-y-auto">
            {period === 'daily' && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Date</p>
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
                  <input type="date" value={customFrom} max={today} onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To</span>
                  <input type="date" value={customTo} max={today} onChange={(e) => e.target.value && setCustomTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </label>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Voucher Status</p>
              <div className="space-y-2">
                {([
                  ['pending', 'Pending', 'Awaiting payment · by created date'],
                  ['active', 'Active (incl. Scheduled)', 'By created date'],
                  ['redeemed', 'Redeemed', 'By redeemed date'],
                ] as [StatusKey, string, string][]).map(([k, label, hint]) => (
                  <label key={k} className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                    statuses.has(k) ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card hover:bg-muted/50',
                  )}>
                    <input type="checkbox" checked={statuses.has(k)} onChange={() => toggleStatus(k)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-foreground">{label}</span>
                      <span className="block text-[10px] text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {loadError && <p className="px-5 pb-2 text-xs font-semibold text-destructive">{loadError}</p>}
          <div className="flex items-center justify-end gap-2 border-t border-border/50 px-5 py-3.5">
            <button type="button" onClick={onClose} className="rounded-xl border border-border/60 bg-card px-4 py-2 text-xs font-semibold hover:bg-muted/60 transition cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={statuses.size === 0 || loadingData}
              onClick={() => setStage('report')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5" /> {loadingData ? 'Loading vouchers…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stage 2: report ─────────────────────────────────────────────────────────
  const showSales = statuses.has('active') || statuses.has('redeemed');
  const showPending = statuses.has('pending');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Toolbar */}
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
            <button type="button" onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Report */}
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
                <p className="text-[10px] text-muted-foreground mt-0.5">Status: {statusSummary}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Generated {generated}</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Sales', value: kwd(stats.salesTotal), sub: `${stats.sales.length} vouchers`, icon: Gift, tone: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/70' },
                { label: 'Active / Scheduled', value: kwd(stats.activeTotal), sub: `${stats.active.length} vouchers`, icon: CheckCircle2, tone: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/70' },
                { label: 'Redeemed', value: kwd(stats.redeemedTotal), sub: `${stats.redeemed.length} vouchers`, icon: TrendingUp, tone: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200/70' },
                { label: 'Pending (unpaid)', value: kwd(stats.pendingTotal), sub: `${stats.pending.length} vouchers`, icon: Clock, tone: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/70' },
              ].map((k) => (
                <div key={k.label} className={cn('avoid-break rounded-2xl border p-3.5', k.bg)}>
                  <k.icon className={cn('h-4 w-4 mb-1.5', k.tone)} />
                  <p className={cn('text-lg font-black tabular-nums leading-none', k.tone)}>{k.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{currency} · {k.sub}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {showSales && (
              <Section
                heading="Voucher Sales (Active, Scheduled & Redeemed)"
                note="Active/Scheduled counted on created date · Redeemed counted on redeemed date"
                tables={stats.salesTables}
                grand={stats.salesTotal}
                tone="border-emerald-200/70 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
              />
            )}

            {showPending && (
              <Section
                heading="Pending Vouchers (Unpaid — not included in sales)"
                note="Counted on created date"
                tables={stats.pendingTables}
                grand={stats.pendingTotal}
                tone="border-amber-200/70 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
              />
            )}

            <p className="text-center text-[10px] text-muted-foreground border-t border-border/50 pt-3">
              Amounts in {currency}. Dates in Kuwait time. — USH Spa
            </p>
          </div>
        </div>
      </div>

      {/* ── Vouchers of the clicked breakdown row ── */}
      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetail(null)} />
          <div className="relative z-10 w-full max-w-5xl max-h-[85vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-foreground truncate">{detail.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {detail.items.length} voucher{detail.items.length !== 1 ? 's' : ''} ·{' '}
                  {kwd(detail.items.reduce((s, v) => s + num(v.total_amount), 0))} {currency}
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
                    <th className="px-4 py-2 text-left">Voucher Code</th>
                    <th className="px-2 py-2 text-left">Created At</th>
                    <th className="px-2 py-2 text-left">Redeemed At</th>
                    <th className="px-2 py-2 text-left">Sender</th>
                    <th className="px-2 py-2 text-left">Recipient</th>
                    <th className="px-2 py-2 text-left">Payment Provider</th>
                    <th className="px-2 py-2 text-left">Referred By</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Amount ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {detail.items.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono font-bold text-foreground whitespace-nowrap">{v.secret_code || v.voucher_number || v.id.slice(0, 8)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmtDateTime(v.created_at)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{fmtDateTime(v.redeemed_at)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{senderOf(v)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{recipientOf(v)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{voucherProvider(v)}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{String(v.referenced_by_name || '').trim() ? referrerOf(v) : '—'}</td>
                      <td className="px-2 py-2 capitalize whitespace-nowrap">{String(v.status ?? '').replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold tabular-nums">{kwd(num(v.total_amount))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border/60 bg-muted/30 font-extrabold">
                  <tr>
                    <td className="px-4 py-2" colSpan={8}>Total</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {kwd(detail.items.reduce((s, v) => s + num(v.total_amount), 0))}
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
