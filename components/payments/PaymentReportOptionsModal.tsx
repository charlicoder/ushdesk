'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, FileText, Loader2, AlertCircle, CalendarDays, Building2, CheckCircle2, Wallet, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import type { Payment } from '@/app/bookings/payments/page';

export interface ReportOptionsResult {
  payments: Payment[];
  activeFilters: {
    branch?: string;
    status?: string;
    provider?: string;
    payment_through?: string;
    dateLabel?: string;
    dateRange?: { from?: string; to?: string };
  };
}

interface Props {
  branches: string[];
  methodOptions: string[];
  normalisePayment: (raw: Record<string, unknown>) => Payment;
  /** Optional assigned branch restriction when user is scoped to a single branch */
  restrictedBranchId?: string | null;
  restrictedBranchName?: string | null;
  onGenerate: (result: ReportOptionsResult) => void;
  onClose: () => void;
}

const TZ = 'Asia/Kuwait';
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

const STATUS_OPTIONS = [
  { value: 'success', label: 'Success / Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];
const CHANNEL_OPTIONS = [
  { value: 'desk', label: 'Desk (USHDesk)' },
  { value: 'ushweb', label: 'USHWeb' },
  { value: 'ushspa', label: 'USHSpa' },
];
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
] as const;

function Chips({ options, selected, onToggle, onClear }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onClear}
        className={cn('rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer',
          selected.length === 0 ? 'border-primary bg-primary text-white' : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50')}
      >
        All
      </button>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer',
              on ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-card text-foreground hover:bg-muted/50')}
          >
            {on && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PaymentReportOptionsModal({
  branches,
  methodOptions,
  normalisePayment,
  restrictedBranchId,
  restrictedBranchName,
  onGenerate,
  onClose,
}: Props) {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['key']>('month');
  const [from, setFrom] = useState(() => todayKw().slice(0, 8) + '01');
  const [to, setTo] = useState(todayKw());
  const [selBranches, setSelBranches] = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>([]);
  const [selChannels, setSelChannels] = useState<string[]>([]);
  const [selMethods, setSelMethods] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empBranch, setEmpBranch] = useState<{ id: string | null; name: string | null }>({
    id: restrictedBranchId ?? null,
    name: restrictedBranchName ?? null,
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, busy]);

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
  const isBranchRestricted = Boolean(activeBranchId || activeBranchName);

  const applyPreset = (k: (typeof PRESETS)[number]['key']) => {
    setPreset(k);
    const t = todayKw();
    if (k === 'today') { setFrom(t); setTo(t); }
    else if (k === 'yesterday') { const y = addDays(t, -1); setFrom(y); setTo(y); }
    else if (k === 'week') { setFrom(addDays(t, -6)); setTo(t); }
    else if (k === 'month') { setFrom(t.slice(0, 8) + '01'); setTo(t); }
  };

  const branchOptions = useMemo(() => branches.map((b) => ({ value: b, label: b })), [branches]);
  const methodOpts = useMemo(() => methodOptions.map((m) => ({ value: m, label: m })), [methodOptions]);
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const generate = async () => {
    if (!from || !to || from > to) { setError('Please choose a valid date range.'); return; }
    setBusy(true);
    setError(null);
    try {
      const all: Record<string, unknown>[] = [];
      const upTo = addDays(to, 1);
      for (let page = 1; page <= 60; page++) {
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

      const lower = (v: string | null | undefined) => String(v ?? '').toLowerCase();
      const filtered = all.map((r) => normalisePayment(r)).filter((p) => {
        const k = dateKey(p.transaction_date || p.created_date || p.created_at);
        if (k && (k < from || k > to)) return false;

        if (isBranchRestricted) {
          const pBid = lower(p.branch_id);
          const pBname = lower(p.branch_name);
          const targetId = lower(activeBranchId);
          const targetName = lower(activeBranchName);
          const matchId = Boolean(targetId && pBid && pBid === targetId);
          const matchName = Boolean(targetName && pBname && pBname === targetName);
          if (!matchId && !matchName) return false;
        } else if (selBranches.length && !selBranches.some((b) => lower(b) === lower(p.branch_name))) {
          return false;
        }

        if (selStatus.length) {
          const s = lower(p.status);
          const ok = selStatus.some((t) => {
            if (t === 'success') return s === 'success' || s === 'paid' || p.is_paid;
            if (t === 'pending') return s.includes('pending') || s === 'initiated';
            return s === t;
          });
          if (!ok) return false;
        }

        if (selChannels.length) {
          const pt = lower(p.payment_through);
          const ok = selChannels.some((c) => (c === 'desk' ? pt === 'desk' || pt === 'ushdesk' : pt === c));
          if (!ok) return false;
        }

        if (selMethods.length) {
          const hay = [p.payment_method, p.payment_provider, p.provider, p.gateway_name].map(lower);
          if (!selMethods.some((m) => hay.some((h) => h && (h === lower(m) || h.includes(lower(m)))))) return false;
        }
        return true;
      });

      onGenerate({
        payments: filtered,
        activeFilters: {
          branch: isBranchRestricted ? (activeBranchName || activeBranchId || undefined) : (selBranches.join(', ') || undefined),
          status: selStatus.map((s) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s).join(', ') || undefined,
          payment_through: selChannels.map((c) => CHANNEL_OPTIONS.find((o) => o.value === c)?.label ?? c).join(', ') || undefined,
          provider: selMethods.join(', ') || undefined,
          dateLabel: from === to ? from : `${from} to ${to}`,
          dateRange: { from, to },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setBusy(false);
    }
  };

  const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-base font-extrabold text-foreground">Generate Financial Report</p>
              <p className="text-xs text-muted-foreground">Choose what to include, then generate</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Section icon={CalendarDays} title="Date range">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer',
                    preset === p.key ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-card hover:bg-muted/50')}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-semibold text-muted-foreground">From
                <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }}
                  className="mt-1 h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">To
                <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }}
                  className="mt-1 h-9 w-full rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              </label>
            </div>
          </Section>

          {!isBranchRestricted && (
            <Section icon={Building2} title="Branches">
              <Chips options={branchOptions} selected={selBranches} onToggle={toggle(setSelBranches)} onClear={() => setSelBranches([])} />
            </Section>
          )}
          <Section icon={CheckCircle2} title="Status">
            <Chips options={STATUS_OPTIONS} selected={selStatus} onToggle={toggle(setSelStatus)} onClear={() => setSelStatus([])} />
          </Section>
          <Section icon={Wallet} title="Payment through (channel)">
            <Chips options={CHANNEL_OPTIONS} selected={selChannels} onToggle={toggle(setSelChannels)} onClear={() => setSelChannels([])} />
          </Section>
          <Section icon={CreditCard} title="Payment methods">
            <Chips options={methodOpts} selected={selMethods} onToggle={toggle(setSelMethods)} onClear={() => setSelMethods([])} />
          </Section>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-muted/20 px-6 py-4">
          <p className="text-[11px] text-muted-foreground">Nothing selected in a section = include all.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy}
              className="rounded-xl border border-border/60 bg-card px-5 py-2 text-xs font-bold hover:bg-muted transition cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={generate} disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60 cursor-pointer">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {busy ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

