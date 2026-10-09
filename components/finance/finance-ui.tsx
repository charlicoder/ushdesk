'use client';

/**
 * Shared helpers for the ushanr-backed Finance pages added under /finance/*
 * (Fixed Assets, Journals, General Ledger, Fiscal Periods, Companies, Profit Analysis).
 *
 * Styling intentionally mirrors the existing Finance pages (taxes, partners, …).
 */

import { useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

// ── Form styling tokens ────────────────────────────────────────────────────────

export const inputCls =
  'h-9 w-full rounded-lg border border-border/60 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
export const labelCls =
  'block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1';

// ── Request helpers (ushanr via the /uanr proxy) ───────────────────────────────

/** Extract a readable message from an ushanr / FastAPI error body. */
export function anrErrorMessage(json: unknown, status: number): string {
  const j = (json ?? {}) as Record<string, any>;
  const d = j.detail ?? j.message ?? j.error?.message;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg ?? JSON.stringify(x)).join('; ');
  if (d) return JSON.stringify(d);
  return `HTTP ${status}`;
}

/**
 * Perform an authenticated request against `/uanr/api/v1/<path>` and return the
 * unwrapped `data` payload. Throws an Error with a readable message on failure.
 */
export async function anrRequest<T = any>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const res = await authedFetch(`/uanr/api/v1/${path.replace(/^\/+/, '')}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(anrErrorMessage(json, res.status));
  return ((json as any)?.data ?? json) as T;
}

let cachedCompanyId: string | null = null;

/** Resolve the active company id (same rule the /uanr proxy uses: first active company). */
export async function getCompanyId(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;
  const data = await anrRequest<any>('companies/');
  const items: any[] = data?.items ?? (Array.isArray(data) ? data : []);
  const company = items.find((c) => c?.is_active) ?? items[0];
  if (!company?.id) throw new Error('No company is configured in the accounting service.');
  cachedCompanyId = company.id as string;
  return cachedCompanyId;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

export function money(value: number | string | null | undefined, decimals = 3): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  if (Number.isNaN(n)) return '0.000';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── UI building blocks ─────────────────────────────────────────────────────────

export type Tone = 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'zinc';

const TONE_CLS: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  zinc: 'bg-muted text-muted-foreground',
};

export function StatusPill({ label, tone = 'zinc' }: { label: string; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        TONE_CLS[tone],
      )}
    >
      {label}
    </span>
  );
}

export interface StatItem {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={cn(
              'group rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5',
              c.color,
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 dark:bg-black/30">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 truncate text-xl font-extrabold text-foreground">{c.value}</p>
            {c.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-base font-bold text-foreground">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{text}</p>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, height = 'h-14' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn(height, 'rounded-2xl shimmer')} />
      ))}
    </div>
  );
}

export function ErrorBanner({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600',
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" /> <span className="break-words">{message}</span>
    </div>
  );
}

export function FormModal({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-3xl border border-border/60 bg-card shadow-2xl',
          maxWidth,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">{title}</h3>
              {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

/** Standard Cancel / Submit footer for FormModal bodies. */
export function FormFooter({
  onCancel,
  onSubmit,
  submitting,
  submitLabel,
  submitIcon: SubmitIcon,
  disabled,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  submitIcon: React.ElementType;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
      <button
        onClick={onCancel}
        className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold transition hover:bg-muted"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={submitting || disabled}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60"
      >
        <SubmitIcon className={cn('h-3.5 w-3.5', submitting && 'animate-spin')} />
        {submitLabel}
      </button>
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'mt-1 flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-60',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground transition hover:text-foreground"
      title="Refresh"
      aria-label="Refresh"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')}
      >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </svg>
    </button>
  );
}
