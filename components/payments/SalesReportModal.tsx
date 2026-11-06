'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Printer, Loader2, TrendingUp, Receipt, Wallet, Building2, CreditCard,
  CalendarDays, CheckCircle2, Clock, AlertCircle, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import type { Payment } from '@/app/bookings/payments/page';

export type SalesReportPeriod = 'daily' | 'weekly' | 'monthly';

interface Props {
  period: SalesReportPeriod;
  /** Converts a raw API payment into the page's Payment shape */
  normalisePayment: (raw: Record<string, unknown>) => Payment;
  /** Optional assigned branch restriction when user is scoped to a single branch */
  restrictedBranchId?: string | null;
  restrictedBranchName?: string | null;
  onClose: () => void;
}

const TZ = 'Asia/Kuwait';
const PERIOD_LABEL: Record<SalesReportPeriod, string> = {
  daily: 'Daily Sales Report',
  weekly: 'Weekly Sales Report',
  monthly: 'Monthly Sales Report',
};

// ── Date helpers (YYYY-MM-DD strings, Kuwait wall-clock) ─────────────────────
const todayKw = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const rangeFor = (period: SalesReportPeriod, ref: string) => {
  if (period === 'daily') return { from: ref, to: ref };
  if (period === 'weekly') return { from: addDays(ref, -6), to: ref };
  const [y, m] = ref.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
};
const enumerate = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
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
const formatMethodLabel = (raw: string) => {
  const s = raw.trim().toLowerCase();
  if (!s) return 'Other';
  if (s === 'knet_pos') return 'KNET POS';
  if (s === 'knet' || s === 'knet_card') return 'KNET';
  if (s === 'myfatoorah') return 'MyFatoorah';
  if (s === 'deema') return 'Deema';
  if (s === 'boubyan_link' || s === 'boubyan') return 'Boubyan Link';
  if (s === 'cash') return 'Cash';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
};

interface Row { label: string; count: number; revenue: number }

export function SalesReportModal({
  period,
  normalisePayment,
  restrictedBranchId,
  restrictedBranchName,
  onClose,
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [refDate, setRefDate] = useState(todayKw());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empBranch, setEmpBranch] = useState<{ id: string | null; name: string | null }>({
    id: restrictedBranchId ?? null,
    name: restrictedBranchName ?? null,
  });

  const { from, to } = useMemo(() => rangeFor(period, refDate), [period, refDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Resolve current employee's assigned branch if not explicitly provided
  useEffect(() => {
    if (restrictedBranchId || restrictedBranchName) {
      setEmpBranch({ id: restrictedBranchId ?? null, name: restrictedBranchName ?? null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch('/api/v1/employees/me');
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        const emp = (json?.data ?? json?.employee ?? json) as Record<string, any>;
        if (!cancelled && emp) {
          const bId = emp.branch_id ?? emp.branch?.id ?? emp.branch?.branch_id ?? (Array.isArray(emp.branches) && emp.branches[0]?.id ? emp.branches[0].id : null);
          const bName = emp.branch_name ?? emp.branch?.name ?? emp.branch?.branch_name ?? (Array.isArray(emp.branches) && emp.branches[0]?.name ? emp.branches[0].name : null);
          if (bId || bName) {
            setEmpBranch({
              id: bId ? String(bId).trim() : null,
              name: bName ? String(bName).trim() : null,
            });
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [restrictedBranchId, restrictedBranchName]);

  const activeBranchId = restrictedBranchId ?? empBranch.id;
  const activeBranchName = restrictedBranchName ?? empBranch.name;

  // Fetch every payment of the period (all pages)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const all: Record<string, unknown>[] = [];
        const upTo = addDays(to, 1);
        for (let page = 1; page <= 40; page++) {
          let url = `/api/v1/payments?page=${page}&page_size=100&date_from=${from}&from_date=${from}&date_to=${upTo}&to_date=${upTo}`;
          if (activeBranchId) url += `&branch_id=${encodeURIComponent(activeBranchId)}`;
          if (activeBranchName) url += `&branch_name=${encodeURIComponent(activeBranchName)}`;
          const res = await authedFetch(url);
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.detail ?? json?.message ?? `Failed to load payments (${res.status})`);
          const list: Record<string, unknown>[] = Array.isArray(json) ? json : (json?.data ?? json?.results ?? []);
          all.push(...list);
          if (!Array.isArray(list) || list.length < 100) break;
        }
        if (!cancelled) setPayments(all.map((r) => normalisePayment(r)));
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load payments'); setPayments([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, activeBranchId, activeBranchName]);

  // Only payments inside the range (and matching assigned branch when restricted)
  const inRange = useMemo(
    () => payments.filter((p) => {
      const k = dateKey(p.transaction_date || p.created_date || p.created_at);
      if (k < from || k > to) return false;
      if (activeBranchId || activeBranchName) {
        const pBid = String(p.branch_id ?? '').trim().toLowerCase();
        const pBname = String(p.branch_name ?? '').trim().toLowerCase();
        const targetId = String(activeBranchId ?? '').trim().toLowerCase();
        const targetName = String(activeBranchName ?? '').trim().toLowerCase();
        const matchId = Boolean(targetId && pBid && pBid === targetId);
        const matchName = Boolean(targetName && pBname && pBname === targetName);
        if (!matchId && !matchName) return false;
      }
      return true;
    }),
    [payments, from, to, activeBranchId, activeBranchName],
  );

  const stats = useMemo(() => {
    const isPaid = (p: Payment) => p.is_paid || ['success', 'paid', 'completed'].includes(String(p.status).toLowerCase());
    const paid = inRange.filter(isPaid);
    const pending = inRange.filter((p) => !isPaid(p) && ['pending', 'initiated', 'not_initiated'].includes(String(p.status).toLowerCase()));
    const failed = inRange.filter((p) => !isPaid(p) && !pending.includes(p));
    const revenue = paid.reduce((s, p) => s + num(p.amount || p.total_amount), 0);
    const vat = paid.reduce((s, p) => s + num(p.vat_amount), 0);
    const service = paid.reduce((s, p) => s + num(p.service_charge), 0);
    const pendingValue = pending.reduce((s, p) => s + num(p.amount || p.total_amount), 0);

    const group = (keyFn: (p: Payment) => string): Row[] => {
      const m = new Map<string, Row>();
      for (const p of paid) {
        const k = keyFn(p) || 'Other';
        const r = m.get(k) ?? { label: k, count: 0, revenue: 0 };
        r.count += 1; r.revenue += num(p.amount || p.total_amount);
        m.set(k, r);
      }
      return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
    };
    const byBranch = group((p) => p.branch_name || 'Unassigned');
    const byMethod = group((p) => formatMethodLabel(p.payment_provider || p.payment_method || p.provider || p.gateway_name || 'Other'));
    const byChannel = group((p) => formatMethodLabel(p.payment_through || 'Other'));

    const days = enumerate(from, to).map((d) => {
      const ds = paid.filter((p) => dateKey(p.transaction_date || p.created_date) === d);
      return { label: d, count: ds.length, revenue: ds.reduce((s, p) => s + num(p.amount || p.total_amount), 0) };
    });
    return { paid, pending, failed, revenue, vat, service, pendingValue, byBranch, byMethod, byChannel, days };
  }, [inRange, from, to]);

  const currency = inRange[0]?.currency || 'KWD';
  const avg = stats.paid.length ? stats.revenue / stats.paid.length : 0;
  const maxDay = Math.max(1, ...stats.days.map((d) => d.revenue));
  const best = [...stats.days].sort((a, b) => b.revenue - a.revenue)[0];
  const rangeLabel = from === to ? prettyDate(from) : `${prettyDate(from)}  –  ${prettyDate(to)}`;
  const generated = new Date().toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });

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
        <p className="px-4 py-5 text-xs text-muted-foreground">No paid sales in this period.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right">Txns</th>
              <th className="px-2 py-2 text-right">Revenue ({currency})</th>
              <th className="px-4 py-2 text-left w-[34%]">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => {
              const pct = stats.revenue > 0 ? (r.revenue / stats.revenue) * 100 : 0;
              return (
                <tr key={r.label}>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.count}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold tabular-nums">{kwd(r.revenue)}</td>
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
              <td className="px-4 py-2">Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{rows.reduce((s, r) => s + r.count, 0)}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">{kwd(rows.reduce((s, r) => s + r.revenue, 0))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-card px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-4.5 w-4.5" /></div>
            <div>
              <p className="text-sm font-extrabold text-foreground">{PERIOD_LABEL[period]}</p>
              <p className="text-[11px] text-muted-foreground">
                {activeBranchName ? `${activeBranchName} · ` : 'All Branches · '}
                Revenue by branch and payment method
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {period === 'daily' ? 'Date' : period === 'weekly' ? 'Week ending' : 'Month of'}
              <input
                type="date"
                value={refDate}
                max={todayKw()}
                onChange={(e) => e.target.value && setRefDate(e.target.value)}
                className="bg-transparent text-foreground outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-50 cursor-pointer"
            >
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
            {/* Letterhead */}
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-primary pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-wider text-primary">USH SPA</h1>
                <p className="text-[11px] text-muted-foreground">
                  Spa &amp; Wellness Center · {activeBranchName || 'All Branches'}
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black tracking-wide text-foreground uppercase">{PERIOD_LABEL[period]}</h2>
                <p className="text-xs font-semibold text-foreground mt-0.5">{rangeLabel}</p>
                {activeBranchName && (
                  <p className="text-[11px] font-bold text-primary mt-0.5">{activeBranchName}</p>
                )}
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
                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Revenue', value: `${kwd(stats.revenue)}`, sub: currency, icon: Wallet, tone: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/70' },
                    { label: 'Paid Transactions', value: String(stats.paid.length), sub: `of ${inRange.length} total`, icon: Receipt, tone: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200/70' },
                    { label: 'Average Sale', value: kwd(avg), sub: currency, icon: TrendingUp, tone: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/70' },
                    { label: 'Pending Value', value: kwd(stats.pendingValue), sub: `${stats.pending.length} pending`, icon: Clock, tone: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/70' },
                  ].map((k) => (
                    <div key={k.label} className={cn('avoid-break rounded-2xl border p-3.5', k.bg)}>
                      <k.icon className={cn('h-4 w-4 mb-1.5', k.tone)} />
                      <p className={cn('text-lg font-black tabular-nums leading-none', k.tone)}>{k.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 mt-1">{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Summary strip */}
                <div className="avoid-break grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-xs">
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">Net of VAT</p><p className="font-mono font-bold">{kwd(stats.revenue - stats.vat)}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">VAT Collected</p><p className="font-mono font-bold">{kwd(stats.vat)}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">Service Charge</p><p className="font-mono font-bold">{kwd(stats.service)}</p></div>
                  <div><p className="text-[10px] uppercase text-muted-foreground font-bold">Failed / Other</p><p className="font-mono font-bold">{stats.failed.length}</p></div>
                </div>

                {/* Trend */}
                {stats.days.length > 1 && (
                  <div className="avoid-break rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><h4 className="text-xs font-extrabold uppercase tracking-wider">Daily Revenue Trend</h4></div>
                      {best && best.revenue > 0 && <span className="text-[11px] text-muted-foreground">Best day: <strong className="text-foreground">{prettyDate(best.label)}</strong> ({kwd(best.revenue)})</span>}
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {stats.days.map((d) => (
                        <div key={d.label} className="flex items-center gap-3 text-[11px]">
                          <span className="w-28 shrink-0 text-muted-foreground">{prettyDate(d.label)}</span>
                          <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${(d.revenue / maxDay) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right tabular-nums text-muted-foreground">{d.count}</span>
                          <span className="w-20 text-right font-mono font-bold tabular-nums">{kwd(d.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Table title="Revenue by Branch" icon={Building2} rows={stats.byBranch} />
                <Table title="Revenue by Payment Method" icon={CreditCard} rows={stats.byMethod} />
                <Table title="Revenue by Payment Channel" icon={Wallet} rows={stats.byChannel} />

                {/* Status summary */}
                <div className="avoid-break grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 dark:bg-emerald-950/30 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-600 mb-1" /><p className="font-black text-emerald-700">{stats.paid.length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Paid</p></div>
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50 dark:bg-amber-950/30 p-3"><Clock className="h-4 w-4 text-amber-600 mb-1" /><p className="font-black text-amber-700">{stats.pending.length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Pending</p></div>
                  <div className="rounded-xl border border-rose-200/70 bg-rose-50 dark:bg-rose-950/30 p-3"><AlertCircle className="h-4 w-4 text-rose-600 mb-1" /><p className="font-black text-rose-700">{stats.failed.length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Failed / Other</p></div>
                </div>

                <p className="text-center text-[10px] text-muted-foreground border-t border-border/50 pt-3">
                  Revenue includes paid transactions only. Amounts in {currency}. Dates in Kuwait time. — USH Spa
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

