'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authedFetch } from '@/lib/authedFetch';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InvoiceLine {
  id: string;
  account_id: string;
  analytic_account_id?: string | null;
  tax_id?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  product_id?: string | null;
  product_code?: string | null;
  sequence?: number;
}

export interface Invoice {
  id: string;
  company_id: string;
  name: string;
  reference?: string | null;
  invoice_type: 'invoice' | 'bill' | 'credit_note' | string;
  state: 'draft' | 'posted' | 'paid' | 'cancelled';
  partner_id?: string | null;
  partner_name?: string | null;
  journal_id?: string | null;
  journal_entry_id?: string | null;
  invoice_date: string;
  due_date: string;
  accounting_date?: string;
  payment_terms?: string;
  currency_code: string;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_paid: number;
  amount_residual: number;
  is_reversal?: boolean;
  notes?: string | null;
  lines: InvoiceLine[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  partner_id?: string | null;
  partner_name?: string | null;
  analytic_account_id?: string | null;
  name?: string | null;
  debit: number;
  credit: number;
  amount_currency?: number;
  currency_code?: string;
  reconciled?: boolean;
  sequence?: number;
}

export interface JournalItemRecord {
  id: string;
  date: string;
  entry_id: string;
  entry_number: string;
  entry_state: string;
  account_id: string;
  account_code: string;
  account_name: string;
  partner_id?: string | null;
  partner_name?: string | null;
  label?: string | null;
  debit: number;
  credit: number;
  matching_number?: string | null;
  reconciled: boolean;
  currency_code: string;
  sequence?: number;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  journal_id: string;
  journal_name?: string;
  name: string;
  reference?: string | null;
  narration?: string | null;
  entry_date: string;
  accounting_date: string;
  state: 'draft' | 'posted' | 'reversed' | 'cancelled';
  amount_total: number;
  reversed_entry_id?: string | null;
  lines?: JournalEntryLine[];
  created_at: string;
  updated_at: string;
}

export interface Journal {
  id: string;
  company_id: string;
  name: string;
  code: string;
  journal_type: 'sale' | 'purchase' | 'cash' | 'bank' | 'general';
  default_account_id?: string | null;
  suspense_account_id?: string | null;
  sequence_prefix?: string;
}

export interface Account {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  account_nature: 'debit' | 'credit';
  parent_id?: string | null;
  group_id?: string | null;
  is_reconcilable: boolean;
  is_bank_account: boolean;
  currency_code: string;
  is_active: boolean;
  deprecated: boolean;
  description?: string | null;
  sequence: number;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  account_id: string;
  code: string;
  name: string;
  currency_code: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  iban?: string | null;
  swift_code?: string | null;
  currency_code: string;
  account_id?: string | null;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatementLine {
  id: string;
  statement_id: string;
  date: string;
  payment_ref?: string | null;
  partner_name?: string | null;
  amount: number;
  is_reconciled: boolean;
}

export interface BankStatement {
  id: string;
  company_id: string;
  bank_account_id: string;
  name: string;
  date_start: string;
  date_end: string;
  balance_start: number;
  balance_end_real: number;
  balance_end_calculated: number;
  state: 'draft' | 'posted' | 'reconciled';
  lines?: BankStatementLine[];
  created_at: string;
  updated_at: string;
}

export interface AccountingPayment {
  id: string;
  company_id: string;
  name: string;
  reference?: string | null;
  payment_type: 'inbound' | 'outbound';
  state: 'draft' | 'posted' | 'reconciled' | 'cancelled';
  partner_id?: string | null;
  partner_name?: string | null;
  journal_id?: string | null;
  journal_name?: string | null;
  amount: number;
  currency_code: string;
  payment_date?: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  company_id: string;
  name: string;
  fiscal_year_id?: string | null;
  fiscal_year_name?: string | null;
  date_from: string;
  date_to: string;
  state: 'draft' | 'confirmed' | 'cancelled' | 'closed';
  total_planned: number;
  total_actual?: number;
  lines?: Array<{
    id: string;
    account_id: string;
    account_name?: string;
    planned_amount: number;
    actual_amount: number;
    variance: number;
    variance_percentage: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface Tax {
  id: string;
  company_id: string;
  name: string;
  tax_type: 'sales' | 'purchase' | 'none';
  amount_type: 'percent' | 'fixed';
  amount: number;
  is_active: boolean;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalYear {
  id: string;
  company_id: string;
  name: string;
  date_from: string;
  date_to: string;
  state: 'draft' | 'open' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface FiscalPeriod {
  id: string;
  fiscal_year_id: string;
  name: string;
  date_from: string;
  date_to: string;
  state: 'open' | 'closed';
}

export interface Partner {
  id: string;
  company_id: string;
  name: string;
  display_name?: string;
  partner_type?: string;
  is_customer: boolean;
  is_vendor: boolean;
  is_company: boolean;
  email?: string | null;
  phone?: string | null;
  vat_id?: string | null;
  country_code?: string | null;
  currency_code?: string | null;
  payment_terms_days?: number | null;
  created_at: string;
  updated_at: string;
}

// ── Reports Types ──────────────────────────────────────────────────────────────

export interface ProfitLossReport {
  date_from: string;
  date_to: string;
  revenue: {
    total: number;
    accounts: Array<{ code: string; name: string; balance: number }>;
  };
  cost_of_goods_sold: {
    total: number;
    accounts: Array<{ code: string; name: string; balance: number }>;
  };
  gross_profit: number;
  expenses: {
    total: number;
    accounts: Array<{ code: string; name: string; balance: number }>;
  };
  net_income: number;
}

export interface BalanceSheetReport {
  as_of_date: string;
  assets: {
    total: number;
    current?: { total: number; accounts: Array<{ code: string; name: string; balance: number }> };
    non_current?: { total: number; accounts: Array<{ code: string; name: string; balance: number }> };
    accounts?: Array<{ code: string; name: string; balance: number }>;
  };
  liabilities: {
    total: number;
    current?: { total: number; accounts: Array<{ code: string; name: string; balance: number }> };
    non_current?: { total: number; accounts: Array<{ code: string; name: string; balance: number }> };
    accounts?: Array<{ code: string; name: string; balance: number }>;
  };
  equity: {
    total: number;
    accounts?: Array<{ code: string; name: string; balance: number }>;
  };
  total_liabilities_and_equity: number;
  balanced: boolean;
}

export interface TrialBalanceReport {
  date_from?: string;
  date_to?: string;
  is_balanced: boolean;
  lines: Array<{
    account_id: string;
    code: string;
    name: string;
    account_type: string;
    initial_debit: number;
    initial_credit: number;
    debit: number;
    credit: number;
    ending_debit: number;
    ending_credit: number;
  }>;
  totals: {
    initial_debit: number;
    initial_credit: number;
    debit: number;
    credit: number;
    ending_debit: number;
    ending_credit: number;
  };
}

export interface CashFlowReport {
  date_from: string;
  date_to: string;
  operating: {
    net_income: number;
    adjustments: number;
    working_capital_changes: number;
    total: number;
  };
  investing?: { total: number };
  financing?: { total: number };
  net_change: number;
}

export interface AgingReport {
  as_of_date: string;
  type: 'receivable' | 'payable';
  partners: Array<{
    partner_id: string;
    partner_name: string;
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  }>;
  grand_total: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total: number;
  };
}

// ── Formatting Helpers ─────────────────────────────────────────────────────────

export function formatKwd(amount: number | string | null | undefined, decimals = 3): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'));
  if (isNaN(num)) return '0.000 KWD';
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} KWD`;
}

export function formatAccountingDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function getStateBadge(state: string | null | undefined) {
  const s = (state ?? '').toLowerCase().trim();
  switch (s) {
    case 'posted':
    case 'paid':
    case 'confirmed':
    case 'reconciled':
    case 'open':
      return {
        label: s.toUpperCase(),
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
      };
    case 'draft':
      return {
        label: 'DRAFT',
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500',
      };
    case 'reversed':
    case 'cancelled':
    case 'closed':
      return {
        label: s.toUpperCase(),
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: (state || 'UNKNOWN').toUpperCase(),
        bg: 'bg-muted text-muted-foreground border-border/40',
        dot: 'bg-muted-foreground',
      };
  }
}

// ── Hook: useAnrList ──────────────────────────────────────────────────────────

interface UseAnrListOptions {
  pageSize?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

export function useAnrList<T>(endpoint: string, options: UseAnrListOptions = {}) {
  const [items, setItems]         = useState<T[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [meta, setMeta]           = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tick, setTick]           = useState(0);

  const pageSize = options.pageSize ?? 25;
  const paramsStr = JSON.stringify(options.params ?? {});

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('page_size', String(pageSize));

    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== '' && v !== null) {
          query.set(k, String(v));
        }
      }
    }

    const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
    const queryString = query.toString();
    const url = `/uanr/api/v1/${cleanEndpoint}${queryString ? `?${queryString}` : ''}`;

    authedFetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(json?.detail ?? json?.message ?? `HTTP ${res.status}`);
        }

        // Unpack envelope: { success: true, data: { items: [...], total, page, pages } } or { items: [...] }
        const payload = json?.data ?? json;
        const list: T[] = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
          ? payload
          : Array.isArray(json?.items)
          ? json.items
          : [];

        setItems(list);
        setMeta(payload ?? json ?? {});
        setTotal(payload?.total ?? json?.total ?? list.length);
        setPages(payload?.pages ?? json?.pages ?? Math.max(1, Math.ceil((payload?.total ?? list.length) / pageSize)));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setItems([]);
        setMeta({});
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, pageSize, paramsStr, tick]);

  return {
    items,
    total,
    page,
    pages,
    pageSize,
    loading,
    error,
    refetch,
    setPage,
    meta,
  };
}

// ── Hook: useAnrReport ────────────────────────────────────────────────────────

export function useAnrReport<T>(reportPath: string, params?: Record<string, string | number | undefined>) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const paramsStr = JSON.stringify(params ?? {});
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
          query.set(k, String(v));
        }
      }
    }

    const cleanPath = reportPath.replace(/^\/+|\/+$/g, '');
    const queryString = query.toString();
    const url = `/uanr/api/v1/reports/${cleanPath}/${queryString ? `?${queryString}` : ''}`;

    authedFetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(json?.detail ?? json?.message ?? `HTTP ${res.status}`);
        }

        const reportData = (json?.data ?? json) as T;
        setData(reportData);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportPath, paramsStr, tick]);

  return { data, loading, error, refetch };
}
