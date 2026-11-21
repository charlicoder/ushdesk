'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Filter, X, Search, RefreshCw, Download, Printer, CalendarDays, Building2,
  CheckCircle2, CreditCard, Wallet, Link2, Gift, Package, Scissors,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Check, RotateCcw,
  User, Phone, MessageSquare, Copy, MapPin, Clock, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { voucherBranchName, normalizeBranchName } from '@/lib/branches';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderedItem {
  sku?: string;
  name?: string;
  name_en?: string;
  name_ar?: string;
  image?: string;
  price?: number | string;
  total_price?: number | string;
  quantity?: number;
  currency?: string;
}

interface VoucherServiceEntry {
  service_id?: string | null;
  service_data?: {
    name?: string;
    price?: number | string;
    base_price?: number | string;
    duration?: number;
    duration_minutes?: number;
  };
  addons?: Array<{ name?: string; price?: number | string; duration_minutes?: number }>;
  extra_time?: number | string | null;
  price_for_extra_time?: number | string | null;
  base_price?: number | string | null;
  price?: number | string | null;
}

interface PersonInfo {
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
}

interface FullVoucher {
  id: string;
  voucher_number?: string | null;
  secret_code?: string | null;
  invoice_number?: string | null;
  payment_number?: string | null;
  status: string;
  total_amount: string | number;
  discount?: string | number | null;
  currency?: string | null;
  total_duration?: number | null;
  extra_time?: number | null;
  expire_date?: string | null;
  created_at?: string | null;
  activation_datetime?: string | null;
  redeemed_at?: string | null;
  scheduled_delivery_at?: string | null;
  delivery_mode?: string | null;
  delivery_status?: string | null;
  delivery_status_label?: string | null;
  delivery_address?: {
    area?: string;
    city?: string;
    block?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    notes?: string;
    formatted?: string;
  } | null;
  branch_id?: string | null;
  branch_data?: { id?: string; name?: string; name_en?: string; branch_name?: string } | null;
  service_arrangement_data?: { name?: string; arrangement_name?: string } | null;
  service_data?: {
    name?: string;
    price?: number | string;
    base_price?: number | string;
    duration?: number;
    duration_minutes?: number;
  } | null;
  services?: VoucherServiceEntry[] | null;
  addons?: Array<{ name?: string; price?: number | string; duration_minutes?: number }> | null;
  price_for_extra_time?: number | string | null;
  ordered_items?: OrderedItem[] | null;
  gift_category?: string | null;
  gift_from?: string | null;
  gift_to?: string | null;
  gift_message?: string | null;
  gift_template?: string | null;
  sender_data?: PersonInfo | null;
  sender_details?: PersonInfo | null;
  recipient_data?: PersonInfo | null;
  recipient_details?: PersonInfo | null;
  recipient_phone?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
  created_by_user_data?: { name?: string; role?: string } | null;
  redemptions?: Array<{
    booking_id?: string | null;
    booking_number?: string | null;
    redeemed_at?: string | null;
    services?: Array<{ service_id?: string; service_name?: string | null }>;
  }> | null;
  payment_through?: string | null;
  payment_provider?: string | null;
  payment_data?: {
    invoice_number?: string;
    payment_number?: string;
    data?: {
      InvoiceId?: number | string;
      InvoiceStatus?: string;
      InvoiceTransactions?: Array<{ PaymentGateway?: string; TransactionId?: string }>;
    };
  } | null;
  referenced_by?: string | null;
  referenced_by_name?: string | null;
  referral_number?: string | null;
}

interface BranchOption {
  id: string;
  name: string;
}

type VoucherStatusKey = 'active' | 'redeemed' | 'partial_redeemed' | 'scheduled' | 'pending';
type VoucherCategoryKey = 'physical' | 'digital';
type PaymentThroughKey = 'ushspa' | 'ushweb' | 'ushdesk';
type PaymentProviderKey = 'myfatoorah' | 'knet_pos';

interface VoucherReportFilters {
  activationFrom: string;
  activationTo: string;
  redeemedFrom: string;
  redeemedTo: string;
  categories: VoucherCategoryKey[];
  branches: string[]; // normalized branch names or IDs
  statuses: VoucherStatusKey[];
  paymentThrough: PaymentThroughKey[];
  paymentProviders: PaymentProviderKey[];
  referredBy: string; // '' = all, '__direct__' = no referral, else referrer label
}

const DEFAULT_CATEGORIES: VoucherCategoryKey[] = ['physical', 'digital'];

const EMPTY_FILTERS: VoucherReportFilters = {
  activationFrom: '',
  activationTo: '',
  redeemedFrom: '',
  redeemedTo: '',
  categories: [...DEFAULT_CATEGORIES],
  branches: [],
  statuses: [],
  paymentThrough: [],
  paymentProviders: [],
  referredBy: '',
};

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

const fmtDateTime = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  const d = new Date(String(raw));
  return isNaN(d.getTime())
    ? String(raw)
    : d.toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function normalizeStatus(v: FullVoucher): VoucherStatusKey | string {
  const raw = String(v.status ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (raw === 'partially_redeemed' || raw === 'partial_redeemed') return 'partial_redeemed';
  if (raw === 'redeemed') return 'redeemed';
  if (raw === 'pending' || raw === 'payment_pending' || raw === 'created' || raw.includes('pending')) return 'pending';
  if (raw === 'scheduled') return 'scheduled';
  if (raw === 'active') {
    if (String(v.delivery_mode ?? '').toLowerCase() === 'scheduled' && v.scheduled_delivery_at) {
      const sched = new Date(v.scheduled_delivery_at);
      if (!isNaN(sched.getTime()) && sched.getTime() > Date.now()) {
        return 'scheduled';
      }
    }
    return 'active';
  }
  return raw || 'unknown';
}

function normalizeThrough(raw: string | null | undefined): string {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'ushweb' || s === 'web' || s === 'online') return 'ushweb';
  if (s === 'ushdesk' || s === 'desk') return 'ushdesk';
  if (s === 'ushspa' || s === 'spa' || s === 'app') return 'ushspa';
  return s;
}

function normalizeProvider(v: FullVoucher): string {
  const raw = String(
    v.payment_provider ||
      v.payment_data?.data?.InvoiceTransactions?.[0]?.PaymentGateway ||
      '',
  )
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (raw.includes('myfatoorah') || raw === 'fatoorah' || raw === 'mf') return 'myfatoorah';
  if (raw === 'knet_pos' || raw === 'knet_card' || raw === 'pos' || raw === 'knet_machine') return 'knet_pos';
  return raw;
}

function getReferrerLabel(v: FullVoucher): string {
  const name = String(v.referenced_by_name ?? '').trim();
  if (!name) return '';
  return v.referral_number ? `${name} (#${v.referral_number})` : name;
}

function extractProductInfo(v: FullVoucher): { name: string; price: number } {
  const items = Array.isArray(v.ordered_items) ? v.ordered_items : [];
  if (items.length === 0) return { name: '—', price: 0 };
  const names: string[] = [];
  let price = 0;
  for (const item of items) {
    const label = String(item.name || item.name_en || item.name_ar || '').trim();
    const qty = Number(item.quantity ?? 1) || 1;
    if (label) names.push(qty > 1 ? `${label} ×${qty}` : label);
    const lineTotal =
      item.total_price !== undefined && item.total_price !== null
        ? num(item.total_price)
        : num(item.price) * qty;
    price += lineTotal;
  }
  return { name: names.length > 0 ? names.join(', ') : '—', price };
}

function normalizeCategory(v: FullVoucher): VoucherCategoryKey {
  const raw = String(v.gift_category ?? '').toLowerCase().trim();
  if (raw === 'physical') return 'physical';
  if (raw === 'digital') return 'digital';
  return Array.isArray(v.ordered_items) && v.ordered_items.length > 0 ? 'physical' : 'digital';
}

function extractServiceInfo(v: FullVoucher, productPrice: number): { list: string[]; names: string; price: number } {
  const entries = Array.isArray(v.services) && v.services.length > 0 ? v.services : [];
  const names: string[] = [];
  let explicitSum = 0;

  if (entries.length > 0) {
    for (const e of entries) {
      const n = String(e.service_data?.name ?? '').trim();
      if (n) names.push(n);
      const base = num(e.price ?? e.base_price ?? e.service_data?.price ?? e.service_data?.base_price);
      const addonSum = (Array.isArray(e.addons) ? e.addons : []).reduce((s, a) => s + num(a.price), 0);
      const extra = num(e.price_for_extra_time);
      explicitSum += base + addonSum + extra;
    }
  } else if (v.service_data?.name) {
    names.push(String(v.service_data.name).trim());
    const base = num(v.service_data.price ?? v.service_data.base_price);
    const addonSum = (Array.isArray(v.addons) ? v.addons : []).reduce((s, a) => s + num(a.price), 0);
    const extra = num(v.price_for_extra_time);
    explicitSum = base + addonSum + extra;
  }

  const total = num(v.total_amount);
  const derived = Math.max(0, total - productPrice);
  const price = explicitSum > 0 ? explicitSum : derived;

  return {
    list: names,
    names: names.length > 0 ? names.join(', ') : '—',
    price,
  };
}

const CATEGORY_OPTIONS: { key: VoucherCategoryKey; label: string }[] = [
  { key: 'physical', label: 'Physical' },
  { key: 'digital', label: 'Digital' },
];

const STATUS_META: Record<string, { label: string; badge: string }> = {
  active:           { label: 'Active',             badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  redeemed:         { label: 'Redeemed',           badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  partial_redeemed: { label: 'Partially Redeemed', badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
  scheduled:        { label: 'Scheduled',          badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  pending:          { label: 'Pending',            badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  expired:          { label: 'Expired',            badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30' },
  cancelled:        { label: 'Cancelled',          badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
};

const STATUS_OPTIONS: { key: VoucherStatusKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'partial_redeemed', label: 'Partially Redeemed' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'pending', label: 'Pending' },
];

const PAYMENT_THROUGH_OPTIONS: { key: PaymentThroughKey; label: string }[] = [
  { key: 'ushspa', label: 'USHSPA (App)' },
  { key: 'ushweb', label: 'USHWEB (Website)' },
  { key: 'ushdesk', label: 'USHDESK (Desk)' },
];

const PAYMENT_PROVIDER_OPTIONS: { key: PaymentProviderKey; label: string }[] = [
  { key: 'myfatoorah', label: 'MyFatoorah' },
  { key: 'knet_pos', label: 'KNET POS' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function VoucherSalesReportTab() {
  const [vouchers, setVouchers] = useState<FullVoucher[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<VoucherReportFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<VoucherReportFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Load all vouchers & branches
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [branchRes, firstVoucherRes] = await Promise.all([
        authedFetch('/api/v1/branches/?page_size=200').catch(() => null),
        authedFetch('/booknpay/api/v1/vouchers/?page=1&page_size=1000'),
      ]);

      // Parse branches
      if (branchRes && branchRes.ok) {
        const bJson = await branchRes.json().catch(() => ({}));
        const bList: any[] = Array.isArray(bJson) ? bJson : (bJson?.data ?? bJson?.results ?? []);
        setBranches(
          bList
            .map((b) => ({
              id: String(b.id ?? b.branch_id ?? ''),
              name: normalizeBranchName(String(b.name ?? b.branch_name ?? '')),
            }))
            .filter((b) => b.name),
        );
      }

      if (!firstVoucherRes.ok) {
        const body = await firstVoucherRes.json().catch(() => ({}));
        throw new Error(body?.detail ?? body?.message ?? `Failed to load vouchers (${firstVoucherRes.status})`);
      }

      const firstJson = await firstVoucherRes.json().catch(() => ({}));
      const firstItems: FullVoucher[] = Array.isArray(firstJson)
        ? firstJson
        : (firstJson?.data ?? firstJson?.results ?? []);
      const totalPages = Number(firstJson?.meta?.pagination?.total_pages ?? 1) || 1;

      const allItems: FullVoucher[] = [...firstItems];
      if (totalPages > 1) {
        const restPromises: Promise<FullVoucher[]>[] = [];
        for (let p = 2; p <= Math.min(totalPages, 20); p++) {
          restPromises.push(
            authedFetch(`/booknpay/api/v1/vouchers/?page=${p}&page_size=1000`)
              .then((r) => (r.ok ? r.json() : { data: [] }))
              .then((j) => (Array.isArray(j) ? j : (j?.data ?? j?.results ?? [])))
              .catch(() => []),
          );
        }
        const restPages = await Promise.all(restPromises);
        for (const items of restPages) allItems.push(...items);
      }

      setVouchers(allItems);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load voucher report');
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Close active popup on Escape
  useEffect(() => {
    if (!filterOpen && !selectedVoucherId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedVoucherId) setSelectedVoucherId(null);
        else if (filterOpen) setFilterOpen(false);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [filterOpen, selectedVoucherId]);

  // Distinct branch options (API branches + any found in vouchers)
  const branchChoices = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) {
      const key = b.name.toLowerCase();
      if (key && !map.has(key)) map.set(key, b.name);
    }
    for (const v of vouchers) {
      const name = voucherBranchName(v);
      const key = name.toLowerCase();
      if (key && key !== '—' && !map.has(key)) map.set(key, name);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [branches, vouchers]);

  // Distinct referrers
  const referrerChoices = useMemo(() => {
    const set = new Set<string>();
    for (const v of vouchers) {
      const r = getReferrerLabel(v);
      if (r) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vouchers]);

  // Pre-computed enriched rows
  const enrichedRows = useMemo(() => {
    return vouchers.map((v) => {
      const voucherNumber = String(v.voucher_number || '').trim();
      const secretCode = String(v.secret_code || '').trim();
      const code = voucherNumber || secretCode || v.id.slice(0, 8);
      const category = normalizeCategory(v);
      const normStatus = normalizeStatus(v);
      const activationRaw = v.activation_datetime || (normStatus !== 'pending' ? v.created_at : null);
      const activationKey = dateKey(activationRaw);
      const redeemedKey = dateKey(v.redeemed_at);
      const branchName = voucherBranchName(v);
      const product = extractProductInfo(v);
      const service = extractServiceInfo(v, product.price);
      const total = num(v.total_amount);
      const currency = String(v.currency || 'KWD');
      const through = normalizeThrough(v.payment_through);
      const provider = normalizeProvider(v);
      const referrer = getReferrerLabel(v);

      return {
        raw: v,
        id: v.id,
        voucherNumber: voucherNumber || code,
        secretCode,
        code,
        category,
        activationRaw,
        activationKey,
        redeemedKey,
        branchName,
        productName: product.name,
        productPrice: product.price,
        serviceList: service.list,
        serviceNames: service.names,
        servicePrice: service.price,
        totalPrice: total,
        currency,
        status: normStatus,
        through,
        provider,
        referrer,
      };
    });
  }, [vouchers]);

  // Apply all filters + search
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categorySet = new Set<string>(filters.categories);
    const branchSet = new Set(filters.branches.map((b) => b.toLowerCase()));
    const statusSet = new Set<string>(filters.statuses);
    const throughSet = new Set<string>(filters.paymentThrough);
    const providerSet = new Set<string>(filters.paymentProviders);

    return enrichedRows.filter((r) => {
      // Voucher category (physical / digital)
      if (!categorySet.has(r.category)) {
        return false;
      }
      // Activation date range
      if (filters.activationFrom) {
        if (!r.activationKey || r.activationKey < filters.activationFrom) return false;
      }
      if (filters.activationTo) {
        if (!r.activationKey || r.activationKey > filters.activationTo) return false;
      }
      // Redeemed date range
      if (filters.redeemedFrom) {
        if (!r.redeemedKey || r.redeemedKey < filters.redeemedFrom) return false;
      }
      if (filters.redeemedTo) {
        if (!r.redeemedKey || r.redeemedKey > filters.redeemedTo) return false;
      }
      // Branch multi-select
      if (branchSet.size > 0 && !branchSet.has(r.branchName.toLowerCase())) {
        return false;
      }
      // Status multi-select
      if (statusSet.size > 0 && !statusSet.has(r.status)) {
        return false;
      }
      // Payment Through multi-select
      if (throughSet.size > 0 && !throughSet.has(r.through)) {
        return false;
      }
      // Payment Provider multi-select
      if (providerSet.size > 0 && !providerSet.has(r.provider)) {
        return false;
      }
      // Referred By
      if (filters.referredBy === '__direct__') {
        if (r.referrer) return false;
      } else if (filters.referredBy) {
        if (r.referrer !== filters.referredBy) return false;
      }
      // Quick search (voucher number, voucher code, branch, product, service, referrer, status)
      if (q) {
        const hay = `${r.voucherNumber} ${r.secretCode} ${r.code} ${r.branchName} ${r.productName} ${r.serviceNames} ${r.referrer} ${r.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedRows, filters, search]);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [filters, search, pageSize]);

  // Totals
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.product += r.productPrice;
        acc.service += r.servicePrice;
        acc.total += r.totalPrice;
        return acc;
      },
      { product: 0, service: 0, total: 0 },
    );
  }, [filteredRows]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.categories.length !== DEFAULT_CATEGORIES.length) n++;
    if (filters.activationFrom || filters.activationTo) n++;
    if (filters.redeemedFrom || filters.redeemedTo) n++;
    if (filters.branches.length > 0) n++;
    if (filters.statuses.length > 0) n++;
    if (filters.paymentThrough.length > 0) n++;
    if (filters.paymentProviders.length > 0) n++;
    if (filters.referredBy) n++;
    return n;
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const selectedRow = useMemo(
    () => (selectedVoucherId ? enrichedRows.find((r) => r.id === selectedVoucherId) ?? null : null),
    [selectedVoucherId, enrichedRows],
  );

  const copyToClipboard = (text: string) => {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      setTimeout(() => setCopiedText((cur) => (cur === text ? null : cur)), 1600);
    });
  };

  const openFilterModal = () => {
    setDraftFilters(filters);
    setFilterOpen(true);
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setFilterOpen(false);
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
  };

  const toggleInDraft = <K extends 'categories' | 'branches' | 'statuses' | 'paymentThrough' | 'paymentProviders'>(
    field: K,
    val: VoucherReportFilters[K][number],
  ) => {
    setDraftFilters((prev) => {
      const list = prev[field] as unknown[];
      const next = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
      return { ...prev, [field]: next };
    });
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Voucher Number',
      'Voucher Code',
      'Category',
      'Activation Date',
      'Branch Name',
      'Product Name',
      'Product Price (KWD)',
      'Service Names',
      'Service Price (KWD)',
      'Total Price (KWD)',
      'Status',
      'Payment Through',
      'Payment Provider',
      'Referred By',
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.map(esc).join(','),
      ...filteredRows.map((r) =>
        [
          r.voucherNumber,
          r.secretCode || '—',
          r.category === 'physical' ? 'Physical' : 'Digital',
          fmtDateTime(r.activationRaw),
          r.branchName,
          r.productName,
          kwd(r.productPrice),
          r.serviceNames,
          kwd(r.servicePrice),
          kwd(r.totalPrice),
          STATUS_META[r.status]?.label ?? r.status,
          r.through.toUpperCase(),
          r.provider,
          r.referrer || 'Direct',
        ]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-sales-report-${todayKw()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = todayKw();

  return (
    <div className="space-y-5">
      {/* ── KPI Summary Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Vouchers</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {filteredRows.length.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            of {vouchers.length.toLocaleString()} total records
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Product Sales</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {kwd(totals.product)} <span className="text-xs font-semibold text-muted-foreground">KWD</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Gift boxes & physical products</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Service Sales</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Scissors className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
            {kwd(totals.service)} <span className="text-xs font-semibold text-muted-foreground">KWD</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Spa services & add-ons</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Voucher Value</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
            {kwd(totals.total)} <span className="text-xs font-semibold text-muted-foreground">KWD</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Combined filtered total</p>
        </div>
      </div>

      {/* ── Toolbar: Search + Filter Popup Trigger + Actions ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher number, voucher code, branch, product, service…"
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

          <button
            type="button"
            onClick={openFilterModal}
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
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
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

      {/* ── Active Filter Chips ── */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.categories.length !== DEFAULT_CATEGORIES.length && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Category: {filters.categories.length === 0 ? 'None' : filters.categories.map((c) => (c === 'physical' ? 'Physical' : 'Digital')).join(', ')}
              <button onClick={() => setFilters((f) => ({ ...f, categories: [...DEFAULT_CATEGORIES] }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(filters.activationFrom || filters.activationTo) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Activation: {filters.activationFrom || '…'} → {filters.activationTo || '…'}
              <button onClick={() => setFilters((f) => ({ ...f, activationFrom: '', activationTo: '' }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(filters.redeemedFrom || filters.redeemedTo) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Redeemed: {filters.redeemedFrom || '…'} → {filters.redeemedTo || '…'}
              <button onClick={() => setFilters((f) => ({ ...f, redeemedFrom: '', redeemedTo: '' }))}>
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
          {filters.statuses.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Status: {filters.statuses.map((s) => STATUS_META[s]?.label ?? s).join(', ')}
              <button onClick={() => setFilters((f) => ({ ...f, statuses: [] }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.paymentThrough.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Through: {filters.paymentThrough.map((t) => t.toUpperCase()).join(', ')}
              <button onClick={() => setFilters((f) => ({ ...f, paymentThrough: [] }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.paymentProviders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Provider: {filters.paymentProviders.map((p) => (p === 'knet_pos' ? 'KNET POS' : 'MyFatoorah')).join(', ')}
              <button onClick={() => setFilters((f) => ({ ...f, paymentProviders: [] }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.referredBy && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
              Referred By: {filters.referredBy === '__direct__' ? 'Direct (No Referral)' : filters.referredBy}
              <button onClick={() => setFilters((f) => ({ ...f, referredBy: '' }))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

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

      {/* ── Data Table ── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 whitespace-nowrap">Voucher Code</th>
                <th className="px-4 py-3 whitespace-nowrap">Activation Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Branch Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Product Name</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Product Price</th>
                <th className="px-4 py-3 whitespace-nowrap">Service Names</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Service Price</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Price</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading voucher sales report…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                    No vouchers match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const st = STATUS_META[r.status] ?? {
                    label: r.status,
                    badge: 'bg-muted text-muted-foreground border-border',
                  };
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedVoucherId(r.id)}
                      className="hover:bg-primary/5 transition-colors align-top cursor-pointer group"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                          {r.voucherNumber}
                        </div>
                        {r.secretCode && r.secretCode !== r.voucherNumber && (
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {r.secretCode}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(r.activationRaw)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {r.branchName}
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[200px] truncate" title={r.productName}>
                        {r.productName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {r.productPrice > 0 ? `${kwd(r.productPrice)} ${r.currency}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground min-w-[180px]">
                        {r.serviceList.length > 0 ? (
                          <div className="space-y-1">
                            {r.serviceList.map((svcName, idx) => (
                              <div key={idx} className="leading-snug">
                                {svcName}
                              </div>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {`${kwd(r.servicePrice)} ${r.currency}`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-foreground whitespace-nowrap">
                        {`${kwd(r.totalPrice)} ${r.currency}`}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            st.badge,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold text-foreground">
                  <td colSpan={4} className="px-4 py-3 text-xs uppercase tracking-wider">
                    Total ({filteredRows.length.toLocaleString()} vouchers)
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {kwd(totals.product)} KWD
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {kwd(totals.service)} KWD
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {kwd(totals.total)} KWD
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredRows.length > 0 && (
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
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of{' '}
                {filteredRows.length.toLocaleString()}
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

      {/* ── Filters Popup Modal ── */}
      {filterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Filter Voucher Sales Report</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Narrow vouchers by date, branches, status, payment channel, provider, or referrer
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
              {/* 0. Voucher Category */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <Gift className="h-3.5 w-3.5 text-primary" />
                  Voucher Category
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

              {/* 1. Date Filters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    Date Filters
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Today', from: today, to: today },
                      { label: 'Last 7d', from: addDays(today, -6), to: today },
                      { label: 'This Month', from: `${today.slice(0, 7)}-01`, to: today },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setDraftFilters((d) => ({
                            ...d,
                            activationFrom: preset.from,
                            activationTo: preset.to,
                          }))
                        }
                        className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Activation Date */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                    <span className="text-[11px] font-bold text-foreground">Activation Date</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] text-muted-foreground mb-1">From</span>
                        <input
                          type="date"
                          value={draftFilters.activationFrom}
                          onChange={(e) => setDraftFilters((d) => ({ ...d, activationFrom: e.target.value }))}
                          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-muted-foreground mb-1">To</span>
                        <input
                          type="date"
                          value={draftFilters.activationTo}
                          onChange={(e) => setDraftFilters((d) => ({ ...d, activationTo: e.target.value }))}
                          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Redeemed Date */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                    <span className="text-[11px] font-bold text-foreground">Redeemed Date</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] text-muted-foreground mb-1">From</span>
                        <input
                          type="date"
                          value={draftFilters.redeemedFrom}
                          onChange={(e) => setDraftFilters((d) => ({ ...d, redeemedFrom: e.target.value }))}
                          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-muted-foreground mb-1">To</span>
                        <input
                          type="date"
                          value={draftFilters.redeemedTo}
                          onChange={(e) => setDraftFilters((d) => ({ ...d, redeemedTo: e.target.value }))}
                          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Branch Multi-Select Checkboxes */}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

              {/* 3. Status Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const checked = draftFilters.statuses.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
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
                          onChange={() => toggleInDraft('statuses', opt.key)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Payment Through & Payment Provider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    Payment Through
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_THROUGH_OPTIONS.map((opt) => {
                      const checked = draftFilters.paymentThrough.includes(opt.key);
                      return (
                        <label
                          key={opt.key}
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
                            onChange={() => toggleInDraft('paymentThrough', opt.key)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                    Payment Provider
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_PROVIDER_OPTIONS.map((opt) => {
                      const checked = draftFilters.paymentProviders.includes(opt.key);
                      return (
                        <label
                          key={opt.key}
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
                            onChange={() => toggleInDraft('paymentProviders', opt.key)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 5. Referred By */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-bold text-foreground uppercase tracking-wider text-[11px]">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  By Referred By
                </label>
                <select
                  value={draftFilters.referredBy}
                  onChange={(e) => setDraftFilters((d) => ({ ...d, referredBy: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  <option value="">All Referrers</option>
                  <option value="__direct__">Direct (No Referral)</option>
                  {referrerChoices.map((ref) => (
                    <option key={ref} value={ref}>
                      {ref}
                    </option>
                  ))}
                </select>
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
                  onClick={applyDraftFilters}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Voucher Details Popup Modal ── */}
      {selectedRow && (() => {
        const v = selectedRow.raw;
        const st = STATUS_META[selectedRow.status] ?? {
          label: selectedRow.status,
          badge: 'bg-muted text-muted-foreground border-border',
        };
        const senderName = String(
          v.sender_data?.name ||
            v.sender_details?.name ||
            v.sender_data?.full_name ||
            [v.sender_data?.first_name, v.sender_data?.last_name].filter(Boolean).join(' ') ||
            v.gift_from ||
            '',
        ).trim() || '—';
        const senderPhone = String(
          v.sender_data?.phone_number || v.sender_data?.phone || v.sender_details?.phone_number || v.sender_details?.phone || '',
        ).trim();
        const recipientName = String(
          v.recipient_data?.name ||
            v.recipient_details?.name ||
            v.recipient_data?.full_name ||
            [v.recipient_data?.first_name, v.recipient_data?.last_name].filter(Boolean).join(' ') ||
            v.gift_to ||
            '',
        ).trim() || '—';
        const recipientPhone = String(
          v.recipient_phone ||
            v.recipient_data?.phone_number ||
            v.recipient_data?.phone ||
            v.recipient_details?.phone_number ||
            v.recipient_details?.phone ||
            '',
        ).trim();
        const arrangementName = String(
          v.service_arrangement_data?.arrangement_name || v.service_arrangement_data?.name || '',
        ).trim();
        const orderedItems = Array.isArray(v.ordered_items) ? v.ordered_items : [];
        const serviceEntries = Array.isArray(v.services) && v.services.length > 0 ? v.services : [];
        const redemptions = Array.isArray(v.redemptions) ? v.redemptions : [];
        const discountAmt = num(v.discount);
        const invoiceNo = String(
          v.invoice_number || v.payment_data?.invoice_number || v.payment_data?.data?.InvoiceId || '',
        ).trim();
        const paymentNo = String(v.payment_number || v.payment_data?.payment_number || '').trim();
        const createdBy = String(v.created_by_name || v.created_by_user_data?.name || '').trim();
        const addr = v.delivery_address;
        const formattedAddr =
          addr?.formatted ||
          [addr?.area, addr?.block ? `Block ${addr.block}` : '', addr?.street ? `St ${addr.street}` : '', addr?.building ? `Bldg ${addr.building}` : '', addr?.city]
            .filter(Boolean)
            .join(', ');
        const providerDisplay =
          selectedRow.provider === 'knet_pos'
            ? 'KNET POS'
            : selectedRow.provider === 'myfatoorah'
            ? 'MyFatoorah'
            : selectedRow.provider
            ? selectedRow.provider.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : '—';
        const throughDisplay = selectedRow.through ? selectedRow.through.toUpperCase() : '—';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setSelectedVoucherId(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-muted/30 px-5 py-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold font-mono text-foreground">
                        {selectedRow.voucherNumber}
                      </h3>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          st.badge,
                        )}
                      >
                        {st.label}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {selectedRow.category === 'physical' ? 'Physical' : 'Digital'}
                      </span>
                    </div>
                    {selectedRow.secretCode && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Voucher Code:</span>
                        <span className="font-mono font-bold text-foreground">{selectedRow.secretCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedRow.secretCode)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                          title="Copy voucher code"
                        >
                          {copiedText === selectedRow.secretCode ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherId(null)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Key Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-primary" /> Branch
                    </span>
                    <p className="mt-1 font-bold text-foreground">{selectedRow.branchName}</p>
                    {arrangementName && (
                      <p className="text-[11px] text-muted-foreground">{arrangementName}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3 text-primary" /> Activation Date
                    </span>
                    <p className="mt-1 font-semibold text-foreground">{fmtDateTime(selectedRow.activationRaw)}</p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 text-primary" /> Created / Expires
                    </span>
                    <p className="mt-1 font-semibold text-foreground">{fmtDateTime(v.created_at)}</p>
                    {v.expire_date && (
                      <p className="text-[11px] text-muted-foreground">Exp: {fmtDateTime(v.expire_date)}</p>
                    )}
                  </div>

                  {v.redeemed_at && (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                        Redeemed At
                      </span>
                      <p className="mt-1 font-semibold text-foreground">{fmtDateTime(v.redeemed_at)}</p>
                    </div>
                  )}

                  {v.scheduled_delivery_at && (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                        Scheduled Delivery
                      </span>
                      <p className="mt-1 font-semibold text-foreground">{fmtDateTime(v.scheduled_delivery_at)}</p>
                    </div>
                  )}
                </div>

                {/* Sender & Recipient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-background p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" /> Sender
                    </span>
                    <p className="font-bold text-foreground text-sm">{senderName}</p>
                    {senderPhone && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {senderPhone}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" /> Recipient
                    </span>
                    <p className="font-bold text-foreground text-sm">{recipientName}</p>
                    {recipientPhone && (
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {recipientPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Gift Message */}
                {v.gift_message && (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <MessageSquare className="h-3 w-3 text-primary" /> Gift Message
                    </span>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{v.gift_message}</p>
                  </div>
                )}

                {/* Products (if Physical) */}
                {orderedItems.length > 0 && (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between bg-muted/40 px-3.5 py-2 border-b border-border/50">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        Products ({orderedItems.length})
                      </span>
                      {v.delivery_status_label || v.delivery_status ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Delivery: {v.delivery_status_label || v.delivery_status}
                        </span>
                      ) : null}
                    </div>
                    <div className="divide-y divide-border/40">
                      {orderedItems.map((item, idx) => {
                        const qty = Number(item.quantity ?? 1) || 1;
                        const lineTotal =
                          item.total_price !== undefined && item.total_price !== null
                            ? num(item.total_price)
                            : num(item.price) * qty;
                        return (
                          <div key={idx} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {item.name || item.name_en || item.name_ar || 'Product'}
                                {qty > 1 && <span className="ml-1.5 text-muted-foreground">×{qty}</span>}
                              </p>
                              {item.sku && <p className="text-[10px] font-mono text-muted-foreground">SKU: {item.sku}</p>}
                            </div>
                            <span className="font-mono font-bold text-foreground whitespace-nowrap">
                              {kwd(lineTotal)} {item.currency || selectedRow.currency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {formattedAddr && (
                      <div className="border-t border-border/50 bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                        <span>{formattedAddr}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Services */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center justify-between bg-muted/40 px-3.5 py-2 border-b border-border/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Scissors className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Services ({selectedRow.serviceList.length})
                    </span>
                    {v.total_duration ? (
                      <span className="text-[11px] text-muted-foreground">{v.total_duration} min</span>
                    ) : null}
                  </div>
                  <div className="divide-y divide-border/40">
                    {serviceEntries.length > 0 ? (
                      serviceEntries.map((entry, idx) => {
                        const name = entry.service_data?.name || 'Service';
                        const dur = entry.service_data?.duration_minutes ?? entry.service_data?.duration;
                        const entryPrice = num(
                          entry.price ?? entry.base_price ?? entry.service_data?.price ?? entry.service_data?.base_price,
                        );
                        const entryAddons = Array.isArray(entry.addons) ? entry.addons : [];
                        const extraMin = Number(entry.extra_time ?? 0) || 0;
                        const extraPrice = num(entry.price_for_extra_time);
                        return (
                          <div key={idx} className="px-3.5 py-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-foreground">
                                {name}
                                {dur ? <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">({dur} min)</span> : null}
                              </div>
                              {entryPrice > 0 && (
                                <span className="font-mono font-bold text-foreground whitespace-nowrap">
                                  {kwd(entryPrice)} {selectedRow.currency}
                                </span>
                              )}
                            </div>
                            {entryAddons.length > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Add-ons: {entryAddons.map((a) => a.name).filter(Boolean).join(', ')}
                              </p>
                            )}
                            {extraMin > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                Extra time: +{extraMin} min {extraPrice > 0 ? `(${kwd(extraPrice)} ${selectedRow.currency})` : ''}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : selectedRow.serviceList.length > 0 ? (
                      selectedRow.serviceList.map((svcName, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3.5 py-2.5">
                          <span className="font-semibold text-foreground">{svcName}</span>
                          {idx === 0 && (
                            <span className="font-mono font-bold text-foreground whitespace-nowrap">
                              {kwd(selectedRow.servicePrice)} {selectedRow.currency}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-3.5 py-2.5 text-muted-foreground">—</div>
                    )}
                  </div>
                </div>

                {/* Payment, Attribution & Price Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-background p-3.5 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <Receipt className="h-3 w-3 text-primary" /> Payment & Attribution
                    </span>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Payment Through</span>
                      <span className="font-semibold text-foreground">{throughDisplay}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Payment Provider</span>
                      <span className="font-semibold text-foreground">{providerDisplay}</span>
                    </div>
                    {invoiceNo && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Invoice #</span>
                        <span className="font-mono font-semibold text-foreground">{invoiceNo}</span>
                      </div>
                    )}
                    {paymentNo && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Payment #</span>
                        <span className="font-mono font-semibold text-foreground">{paymentNo}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Referred By</span>
                      <span className="font-semibold text-foreground">{selectedRow.referrer || 'Direct'}</span>
                    </div>
                    {createdBy && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Created By</span>
                        <span className="font-semibold text-foreground">{createdBy}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <Wallet className="h-3 w-3 text-primary" /> Price Summary
                    </span>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Product Price</span>
                      <span className="font-mono font-semibold text-foreground">
                        {kwd(selectedRow.productPrice)} {selectedRow.currency}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Service Price</span>
                      <span className="font-mono font-semibold text-foreground">
                        {kwd(selectedRow.servicePrice)} {selectedRow.currency}
                      </span>
                    </div>
                    {discountAmt > 0 && (
                      <div className="flex justify-between gap-2 text-rose-600 dark:text-rose-400">
                        <span>Discount</span>
                        <span className="font-mono font-semibold">
                          -{kwd(discountAmt)} {selectedRow.currency}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 border-t border-border pt-2 mt-2 text-sm font-extrabold">
                      <span className="text-foreground">Total Price</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">
                        {kwd(selectedRow.totalPrice)} {selectedRow.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Redemption History */}
                {redemptions.length > 0 && (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="bg-muted/40 px-3.5 py-2 border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Redemption History ({redemptions.length})
                    </div>
                    <div className="divide-y divide-border/40">
                      {redemptions.map((red, idx) => (
                        <div key={idx} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                          <div>
                            <span className="font-mono font-bold text-foreground">
                              {red.booking_number || red.booking_id || `Redemption #${idx + 1}`}
                            </span>
                            {Array.isArray(red.services) && red.services.length > 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                {red.services.map((s) => s.service_name).filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(red.redeemed_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherId(null)}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
