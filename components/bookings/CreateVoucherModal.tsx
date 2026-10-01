'use client';

/**
 * CreateVoucherModal — v4
 * Brand theme: #543c30 (deep espresso), #dbcdc2 / #daccc1 (warm linen/blush)
 *
 * Flow:
 *  Step 1: Choose Gift Category (GET /uauth/api/v1/gifts/categories/)
 *  Step 2 (if PHYSICAL): Choose Product (GET /uauth/api/v1/products/)
 *  Step 2/3: Choose Service, Branch, Room/Arrangement, Addons, Extra Time
 *  Step 3/4: Recipient Details (Name, Phone, optional message) → "Make Payment"
 *  Payment Popup: Select Payment Provider (MyFatoorah, PaymentLink, Deema, KNET Card, Other)
 *                 → POST /booknpay/api/v1/vouchers/
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  X, Search, Loader2, ChevronDown, Check, Gift,
  MapPin, Scissors, Package, Timer, User, MessageSquare,
  Sparkles, ChevronRight, ChevronLeft, AlertCircle,
  CreditCard, Calendar, Hash, Banknote,
  CheckCircle2, ShoppingBag, Phone, Mail, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { CreateCustomerModal, type CreatedCustomer } from './CreateCustomerModal';

// ── Brand palette ──────────────────────────────────────────────────────────────
const B = {
  espresso:   '#543c30',
  espressoLt: '#6b4f41',
  linen:      '#dbcdc2',
  blush:      '#daccc1',
  lineMuted:  '#e8ddd7',
  bg:         '#faf7f5',
  cardBg:     '#ffffff',
  textMain:   '#2c1a12',
  textMuted:  '#8a6f63',
  pillBg:     '#f2ede9',
  success:    '#2e7d5e',
  successBg:  '#edf7f3',
  errorBg:    '#fff0f0',
  errorBorder:'#f5c6c6',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GiftCategory {
  id: string;
  code: 'DIGITAL' | 'PHYSICAL' | string;
  title: string;
  description: string;
  image: string;
  display_order: number;
  is_active: boolean;
}

export interface ProductItem {
  id: string;
  name: string;
  category?: string;
  price: number | string;
  currency?: string;
  stock?: number | null;
  image?: string | null;
  description?: string | null;
  sku?: string | null;
}

interface SlimService {
  id: string;
  name: string;
  base_price?: string;
  price?: string;
  duration_minutes?: number;
  currency?: string;
  category?: string;
}

interface AddonItem {
  id: string;
  name: string;
  price: string;
  currency: string;
  duration_minutes: number;
  description?: string;
}

interface Arrangement {
  id: string;
  arrangement_name: string;
  arrangement_type?: string;
  image?: string | null;
  arrangement_price?: string | number | null;
  price?: string | number | null;
  currency?: string;
  capacity?: number | null;
  addons?: AddonItem[];
  extra_time_options?: number[];
  extra_time_price?: string | number | null;
  price_per_extra_minute?: string | number | null;
  extra_time_price_per_minute?: string | number | null;
}

interface Branch {
  id: string;
  branch_id?: string;
  name: string;
  branch_name?: string;
  service_arrangements?: Arrangement[];
}

interface ServiceFullDetail {
  id: string;
  name: string;
  base_price?: string;
  price?: string;
  duration_minutes?: number;
  currency?: string;
  category?: string;
  branches?: Branch[];
  service_arrangements?: Arrangement[];
}

interface Customer {
  id: string;
  name?: string;
  customer_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  phone?: string;
  email?: string;
  avatar?: string | null;
}

export interface PaymentProviderConfig {
  id: string;
  name: string;
  description: string;
  tag: string;
  tagColor: string;
  borderColor: string;
  checkColor: string;
}

export const PAYMENT_PROVIDERS: PaymentProviderConfig[] = [
  {
    id: 'MyFatoorah',
    name: 'MyFatoorah',
    description: 'KNET / Visa / Master',
    tag: 'Gateway',
    tagColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    borderColor: 'border-emerald-500 ring-2 ring-emerald-500/20',
    checkColor: 'text-emerald-500',
  },
  {
    id: 'PaymentLink',
    name: 'PaymentLink',
    description: 'SMS / WhatsApp link',
    tag: 'Direct Link',
    tagColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    borderColor: 'border-blue-500 ring-2 ring-blue-500/20',
    checkColor: 'text-blue-500',
  },
  {
    id: 'Deema',
    name: 'Deema',
    description: 'BNPL payment split',
    tag: 'Installments',
    tagColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    borderColor: 'border-amber-500 ring-2 ring-amber-500/20',
    checkColor: 'text-amber-500',
  },
  {
    id: 'KNET Card',
    name: 'KNET Card',
    description: 'In-branch card machine',
    tag: 'POS Terminal',
    tagColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    borderColor: 'border-violet-500 ring-2 ring-violet-500/20',
    checkColor: 'text-violet-500',
  },
  {
    id: 'Other',
    name: 'Other',
    description: 'Cash or other method',
    tag: 'Alternative',
    tagColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    borderColor: 'border-slate-500 ring-2 ring-slate-500/20',
    checkColor: 'text-slate-500',
  },
];

interface Props {
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function customerLabel(c: Customer): string {
  if (c.name) return c.name;
  if (c.customer_name) return c.customer_name;
  const fl = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return fl || c.phone_number || c.phone || c.id;
}

function customerPhone(c: Customer): string {
  return c.phone_number ?? c.phone ?? '';
}

function fmtPrice(val: string | number | null | undefined, currency = 'KWD'): string {
  const n = parseFloat(String(val ?? 0));
  return `${isNaN(n) ? '0.000' : n.toFixed(3)} ${currency}`;
}

const GIFT_TEMPLATES = ['Classic Gold', 'Elegant Rose', 'Midnight Blue', 'Floral Bliss', 'Luxury Black', 'Spring Breeze'];

const ARR_FALLBACKS = [
  'linear-gradient(135deg,#daccc1 0%,#c4a99c 100%)',
  'linear-gradient(135deg,#d4c4b8 0%,#b89d8e 100%)',
  'linear-gradient(135deg,#e2d7d0 0%,#cbb9af 100%)',
  'linear-gradient(135deg,#c9b8ae 0%,#a8897c 100%)',
];

// ── Searchable Dropdown ────────────────────────────────────────────────────────

function SearchableDropdown<T>({
  items,
  value,
  onSelect,
  labelFn,
  placeholder,
  loading,
  disabled,
}: {
  items: T[];
  value: T | null;
  onSelect: (item: T) => void;
  labelFn: (item: T) => string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = items.filter((i) => labelFn(i).toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none"
        style={{
          borderColor: open ? B.espresso : B.linen,
          background: B.cardBg,
          color: value ? B.textMain : B.textMuted,
          boxShadow: open ? `0 0 0 3px ${B.blush}` : undefined,
          opacity: disabled || loading ? 0.5 : 1,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="flex-1 text-left truncate text-sm">
          {loading ? 'Loading…' : value ? labelFn(value) : placeholder ?? 'Select…'}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: B.textMuted }} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border shadow-2xl overflow-hidden"
          style={{ borderColor: B.linen, background: B.cardBg }}
        >
          <div className="p-2 border-b" style={{ borderColor: B.lineMuted }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: B.bg }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: B.textMuted }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: B.textMain }}
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-center" style={{ color: B.textMuted }}>
                No results
              </li>
            ) : (
              filtered.map((item, i) => {
                const label = labelFn(item);
                const active = value ? labelFn(value) === label : false;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setOpen(false);
                        setSearch('');
                      }}
                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition"
                      style={{
                        background: active ? B.blush : undefined,
                        color: active ? B.espresso : B.textMain,
                        fontWeight: active ? 700 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = B.bg;
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLButtonElement).style.background = '';
                      }}
                    >
                      {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: B.espresso }} />}
                      <span className={cn('flex-1', !active && 'ml-5')}>{label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Arrangement Card ──────────────────────────────────────────────────────────

function ArrangementCard({
  arr,
  active,
  onSelect,
  index,
}: {
  arr: Arrangement;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  const fallback = ARR_FALLBACKS[index % ARR_FALLBACKS.length];
  const currency = arr.currency ?? 'KWD';
  const rawArr = arr as unknown as Record<string, unknown>;
  const name = (arr.arrangement_name ?? rawArr.name ?? rawArr.title ?? 'Room') as string;
  const priceRaw = arr.arrangement_price ?? arr.price ?? rawArr.base_price ?? rawArr.amount ?? rawArr.cost;
  const priceNum = parseFloat(String(priceRaw ?? ''));
  const hasPrice = priceRaw != null && priceRaw !== '' && !isNaN(priceNum) && priceNum > 0;
  const arrType = (arr.arrangement_type ?? rawArr.arrangement_type ?? rawArr.type) as string | undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative shrink-0 rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer"
      style={{
        width: 160,
        height: 210,
        border: `3px solid ${active ? B.espresso : 'transparent'}`,
        boxShadow: active ? `0 0 0 1px ${B.espresso}, 0 6px 24px 0 ${B.espresso}40` : '0 2px 8px 0 rgba(0,0,0,0.13)',
        flexShrink: 0,
      }}
    >
      <div className="absolute inset-0">
        {arr.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arr.image} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: fallback }} />
        )}
      </div>

      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)',
        }}
      />

      {hasPrice && (
        <div
          className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 leading-none"
          style={{
            background: B.espresso,
            color: B.linen,
            fontSize: 11,
            fontWeight: 800,
            boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          {fmtPrice(priceNum, currency)}
        </div>
      )}

      {active && (
        <div
          className="absolute top-2.5 left-2.5 h-6 w-6 rounded-full grid place-items-center"
          style={{ background: B.espresso, boxShadow: `0 2px 8px ${B.espresso}70` }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 text-left">
        <p
          className="text-[13px] font-extrabold leading-tight text-white mb-2"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        >
          {name.length > 17 ? name.slice(0, 16) + '…' : name}
        </p>

        <div className="flex items-center gap-1 flex-wrap">
          {arrType && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(4px)', color: '#fff' }}
            >
              {arrType.replace(/_/g, ' ')}
            </span>
          )}
          {arr.capacity != null && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(4px)', color: '#fff' }}
            >
              Cap {arr.capacity}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Customer Avatar ──────────────────────────────────────────────────────────

function CustomerAvatar({ customer, size = 32 }: { customer: Customer; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const rawCustomer = customer as unknown as Record<string, unknown>;
  const avatarSrc =
    typeof customer.avatar === 'string' && customer.avatar.trim()
      ? customer.avatar.trim()
      : typeof rawCustomer.avatar_url === 'string' && rawCustomer.avatar_url.trim()
      ? rawCustomer.avatar_url.trim()
      : typeof rawCustomer.photo === 'string' && rawCustomer.photo.trim()
      ? rawCustomer.photo.trim()
      : typeof rawCustomer.profile_image === 'string' && rawCustomer.profile_image.trim()
      ? rawCustomer.profile_image.trim()
      : null;

  const iconSize = Math.max(13, Math.round(size * 0.52));

  if (avatarSrc && !imgErr) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarSrc}
        alt={customerLabel(customer)}
        onError={() => setImgErr(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `1.5px solid ${B.linen}`,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: B.pillBg,
        color: B.espresso,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: `1.5px solid ${B.linen}`,
      }}
    >
      <User style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}

// ── Customer Picker ─────────────────────────────────────────────────────────────

function CustomerPicker({
  label,
  value,
  onSelect,
  excludeId,
  onCreateNew,
  authHeader,
  injectedCustomer,
}: {
  label: string;
  value: Customer | null;
  onSelect: (c: Customer) => void;
  excludeId?: string;
  onCreateNew?: () => void;
  authHeader: string;
  injectedCustomer?: Customer | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ page_size: '30' });
        if (q.trim()) qs.set('search', q.trim());
        const res = await authedFetch(`/api/v1/customers/?${qs.toString()}`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        const rawList: Record<string, unknown>[] = Array.isArray(data) ? data : data.results ?? data.data ?? [];
        const norm: Customer[] = rawList.map((r) => {
          const fn = String(r.first_name ?? '');
          const ln = String(r.last_name ?? '');
          const combined = [fn, ln].filter(Boolean).join(' ');
          const name = String(r.customer_name ?? r.name ?? combined ?? '');
          return {
            id: String(r.id ?? r.customer_id ?? ''),
            name,
            customer_name: name,
            first_name: fn,
            last_name: ln,
            phone_number: (r.phone_number ?? r.phone ?? '') as string,
            phone: (r.phone_number ?? r.phone ?? '') as string,
            email: (r.email ?? '') as string,
            avatar: (r.avatar ?? r.photo ?? null) as string | null,
          };
        });
        setCustomers(norm);
      } catch {
        setCustomers([]);
      } finally {
        setSearching(false);
      }
    },
    [authHeader]
  );

  useEffect(() => {
    if (open) doSearch('');
  }, [open, doSearch]);

  const handleSearchChange = (q: string) => {
    setSearch(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => doSearch(q), 280);
  };

  const items = useMemo(() => {
    let list = customers;
    if (injectedCustomer && !list.some((c) => c.id === injectedCustomer.id)) {
      list = [injectedCustomer, ...list];
    }
    if (value && !list.some((c) => c.id === value.id)) {
      list = [value, ...list];
    }
    if (excludeId) list = list.filter((c) => c.id !== excludeId);
    return list;
  }, [customers, injectedCustomer, value, excludeId]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>
          {label}
        </label>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline"
            style={{ color: B.espresso }}
          >
            + New Customer
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition"
        style={{
          borderColor: open ? B.espresso : B.linen,
          background: B.cardBg,
          boxShadow: open ? `0 0 0 3px ${B.blush}` : undefined,
        }}
      >
        {value ? (
          <>
            <CustomerAvatar customer={value} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: B.textMain }}>
                {customerLabel(value)}
              </p>
              {customerPhone(value) && (
                <p className="text-[10px] text-muted-foreground">{customerPhone(value)}</p>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground flex-1">Search / select customer…</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border shadow-2xl overflow-hidden"
          style={{ borderColor: B.linen, background: B.cardBg }}
        >
          <div className="p-2 border-b" style={{ borderColor: B.lineMuted }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: B.bg }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: B.textMuted }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or phone…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: B.textMain }}
              />
              {searching && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: B.textMuted }} />}
            </div>
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {items.length === 0 ? (
              <li className="px-4 py-3 text-xs text-center text-muted-foreground">
                {searching ? 'Searching…' : 'No customers found'}
              </li>
            ) : (
              items.map((c) => {
                const active = value?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(c);
                        setOpen(false);
                        setSearch('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/40 cursor-pointer"
                      style={{ background: active ? B.blush : undefined }}
                    >
                      <CustomerAvatar customer={c} size={30} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: B.textMain }}>
                          {customerLabel(c)}
                        </p>
                        {customerPhone(c) && (
                          <p className="text-[10px] text-muted-foreground truncate">{customerPhone(c)}</p>
                        )}
                      </div>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: B.espresso }} />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Addon Checkbox ─────────────────────────────────────────────────────────────

function AddonCheckbox({
  addon,
  checked,
  onChange,
  currency,
}: {
  addon: AddonItem;
  checked: boolean;
  onChange: (v: boolean) => void;
  currency: string;
}) {
  return (
    <label
      className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all"
      style={{
        borderColor: checked ? B.espresso : B.lineMuted,
        background: checked ? B.blush : B.cardBg,
      }}
    >
      <div
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 grid place-items-center transition"
        style={{
          background: checked ? B.espresso : B.cardBg,
          borderColor: checked ? B.espresso : B.linen,
        }}
      >
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight" style={{ color: B.textMain }}>
          {addon.name}
        </p>
        {addon.description && (
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: B.textMuted }}>
            {addon.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {addon.duration_minutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: B.textMuted }}>
              <Timer className="h-2.5 w-2.5" />
              {addon.duration_minutes} min
            </span>
          )}
          <span className="text-[10px] font-bold" style={{ color: B.espresso }}>
            +{fmtPrice(addon.price, addon.currency ?? currency)}
          </span>
        </div>
      </div>
    </label>
  );
}

// ── Step Bar ───────────────────────────────────────────────────────────────────

function StepBar({
  step,
  isPhysical,
}: {
  step: number;
  isPhysical: boolean;
}) {
  const steps = isPhysical
    ? [
        { n: 1, label: 'Gift Category' },
        { n: 2, label: 'Choose Product' },
        { n: 3, label: 'Service & Room' },
        { n: 4, label: 'Recipients' },
      ]
    : [
        { n: 1, label: 'Gift Category' },
        { n: 2, label: 'Service & Room' },
        { n: 3, label: 'Recipients' },
      ];

  return (
    <div
      className="flex items-center shrink-0 px-6 py-3 border-b"
      style={{ borderColor: B.lineMuted, background: B.bg }}
    >
      {steps.map((s, idx) => (
        <React.Fragment key={s.n}>
          {idx > 0 && (
            <div
              className="flex-1 h-px mx-3 transition-colors"
              style={{ background: step >= s.n ? B.espresso : B.linen }}
            />
          )}
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full grid place-items-center text-xs font-extrabold transition-all"
              style={{
                background: step >= s.n ? B.espresso : B.linen,
                color: step >= s.n ? '#fff' : B.textMuted,
                boxShadow: step >= s.n ? `0 2px 8px ${B.espresso}40` : undefined,
              }}
            >
              {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span
              className="text-[11px] font-bold hidden sm:block"
              style={{ color: step >= s.n ? B.espresso : B.textMuted }}
            >
              {s.label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="h-3.5 w-3.5" style={{ color: B.espresso }} />
      <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: B.espresso }}>
        {label}
      </span>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function CreateVoucherModal({ token, onClose, onSuccess }: Props) {
  const authHeader = `Bearer ${token}`;
  const currentUser = useAppSelector((s) => s.auth.user);

  // ── Categories State (Step 1) ──
  const [categories, setCategories] = useState<GiftCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory | null>(null);

  const isPhysical = selectedCategory?.code?.toUpperCase() === 'PHYSICAL';

  // Current logical step number:
  // Step 1: Category
  // If Physical: Step 2 = Product, Step 3 = Service, Step 4 = Recipient
  // If Digital:  Step 2 = Service, Step 3 = Recipient
  const [step, setStep] = useState<number>(1);

  // ── Products State (Step 2 if Physical) ──
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // ── Service & Arrangement State ──
  const [services, setServices] = useState<SlimService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<SlimService | null>(null);
  const [fullDetail, setFullDetail] = useState<ServiceFullDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedArrangt, setSelectedArrangt] = useState<Arrangement | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<AddonItem[]>([]);
  const [extraTime, setExtraTime] = useState<number>(0);

  // ── Recipient & Sender State ──
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftTemplate, setGiftTemplate] = useState(GIFT_TEMPLATES[0]);

  const [injectedCustomer, setInjectedCustomer] = useState<Customer | null>(null);
  const [sender, setSender] = useState<Customer | null>(null);
  const [recipient, setRecipient] = useState<Customer | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [createForRole, setCreateForRole] = useState<'sender' | 'recipient'>('sender');

  // ── Payment Provider Popup State (Requirement 1.v & 1.vi) ──
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('MyFatoorah');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPaymentModal) setShowPaymentModal(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, showPaymentModal]);

  // ── 1. Fetch Categories ──
  useEffect(() => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    authedFetch('/uauth/api/v1/gifts/categories/', {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        let list: GiftCategory[] = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.data)) list = data.data;
        else if (Array.isArray(data.results)) list = data.results;

        list = list.filter((c) => c.is_active !== false).sort((a, b) => a.display_order - b.display_order);
        setCategories(list);
        if (list.length > 0 && !selectedCategory) {
          setSelectedCategory(list[0]);
        }
      })
      .catch((err) => {
        setCategoriesError(err instanceof Error ? err.message : 'Failed to load categories');
      })
      .finally(() => setCategoriesLoading(false));
  }, [authHeader]);

  // ── 2. Fetch Products if Physical ──
  useEffect(() => {
    if (!isPhysical) return;
    setProductsLoading(true);
    setProductsError(null);
    authedFetch('/uauth/api/v1/products/', {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => ({}));
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.data)) list = data.data;
        else if (Array.isArray(data.results)) list = data.results;

        const norm: ProductItem[] = list.map((p) => ({
          id: String(p.id ?? ''),
          name: String(p.name ?? p.product_name ?? ''),
          category: String(p.category ?? p.product_category ?? 'Wellness'),
          price: parseFloat(String(p.price ?? p.base_price ?? 0)) || 0,
          currency: String(p.currency ?? 'KWD'),
          stock: p.stock != null ? Number(p.stock) : null,
          image: p.image ?? p.image1 ?? p.thumbnail ?? null,
          description: p.description ?? null,
          sku: p.sku ?? p.code ?? null,
        }));
        setProducts(norm);
        if (norm.length > 0 && !selectedProduct) {
          setSelectedProduct(norm[0]);
        }
      })
      .catch((err) => {
        setProductsError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => setProductsLoading(false));
  }, [isPhysical, authHeader]);

  // ── 3. Fetch Services (slim) ──
  useEffect(() => {
    setServicesLoading(true);
    authedFetch('/api/v1/services/slim/', {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setServices(Array.isArray(data) ? data : data.results ?? data.data ?? []);
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [authHeader]);

  // ── 4. Fetch Full Service Detail ──
  const fetchFullDetail = useCallback(
    async (svc: SlimService) => {
      setDetailLoading(true);
      setDetailError(null);
      setFullDetail(null);
      setSelectedBranch(null);
      setSelectedArrangt(null);
      setSelectedAddons([]);
      setExtraTime(0);
      try {
        const res = await authedFetch(`/api/v1/services/${svc.id}/full-detail/`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json().catch(() => ({}));
        const detail = (data.data ?? data) as ServiceFullDetail;
        setFullDetail(detail);

        // Pre-select first branch & arrangement if available
        if (detail.branches && detail.branches.length > 0) {
          const firstB = detail.branches[0];
          setSelectedBranch(firstB);
          const arrs = firstB.service_arrangements ?? detail.service_arrangements ?? [];
          if (arrs.length > 0) {
            setSelectedArrangt(arrs[0]);
          }
        }
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'Failed to load service details');
      } finally {
        setDetailLoading(false);
      }
    },
    [authHeader]
  );

  const handleServiceSelect = useCallback(
    (svc: SlimService) => {
      setSelectedService(svc);
      fetchFullDetail(svc);
    },
    [fetchFullDetail]
  );

  // Sync recipient picker to text inputs
  const handleSelectRecipient = (c: Customer) => {
    setRecipient(c);
    setRecipientName(customerLabel(c));
    setRecipientPhone(customerPhone(c));
    if (c.email) setRecipientEmail(c.email);
  };

  // ── Totals Calculation ──
  const currency = fullDetail?.currency ?? selectedService?.currency ?? 'KWD';
  const productPrice = isPhysical && selectedProduct ? parseFloat(String(selectedProduct.price)) || 0 : 0;
  const basePrice =
    parseFloat(
      fullDetail?.base_price ?? fullDetail?.price ?? selectedService?.base_price ?? selectedService?.price ?? '0'
    ) || 0;
  const baseDuration = fullDetail?.duration_minutes ?? selectedService?.duration_minutes ?? 60;
  const addonPrice = selectedAddons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const addonDur = selectedAddons.reduce((s, a) => s + (a.duration_minutes || 0), 0);
  const arrangPriceRaw = selectedArrangt?.arrangement_price ?? selectedArrangt?.price;
  const arrangPrice = parseFloat(String(arrangPriceRaw ?? '')) || 0;

  // Extra time calculation
  const extraTimePricePerMin = useMemo(() => {
    const arr = selectedArrangt;
    if (arr) {
      const raw = arr.extra_time_price_per_minute ?? arr.price_per_extra_minute ?? arr.extra_time_price;
      if (raw != null) {
        const parsed = parseFloat(String(raw));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    const effectivePrice = arrangPrice || basePrice;
    const effectiveDuration = baseDuration || 60;
    return effectivePrice > 0 && effectiveDuration > 0 ? effectivePrice / effectiveDuration : 0;
  }, [selectedArrangt, arrangPrice, basePrice, baseDuration]);

  const calcExtraPrice = (mins: number) => {
    return mins > 0 ? parseFloat((extraTimePricePerMin * mins).toFixed(3)) : 0;
  };

  const extraTimePrice = calcExtraPrice(extraTime);
  const totalPrice = productPrice + (arrangPrice || basePrice) + addonPrice + extraTimePrice;
  const totalDuration = (baseDuration || 60) + addonDur + extraTime;

  // Branches & Arrangements lists
  const branches: Branch[] = fullDetail?.branches ?? [];
  const arrangements: Arrangement[] = useMemo(() => {
    if (!selectedBranch) return [];
    const nested = selectedBranch.service_arrangements;
    if (nested?.length) return nested;
    return (fullDetail?.service_arrangements ?? []).filter((a: Arrangement) => {
      const raw = a as unknown as Record<string, unknown>;
      return !raw.branch_id || raw.branch_id === (selectedBranch.id ?? selectedBranch.branch_id);
    });
  }, [selectedBranch, fullDetail]);

  const addons: AddonItem[] = selectedArrangt?.addons ?? [];

  const toggleAddon = (addon: AddonItem, checked: boolean) =>
    setSelectedAddons((prev) => (checked ? [...prev, addon] : prev.filter((a) => a.id !== addon.id)));

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
  }, [products, productSearch]);

  // Validation
  const stepCategoryValid = !!selectedCategory;
  const stepProductValid = !isPhysical || !!selectedProduct;
  const stepServiceValid = !!selectedService && !!selectedBranch && !!selectedArrangt && !detailLoading;
  const stepRecipientValid = recipientName.trim().length > 0 && recipientPhone.trim().length > 0;

  // ── Navigation Logic ──
  const serviceStepNumber = isPhysical ? 3 : 2;
  const recipientStepNumber = isPhysical ? 4 : 3;

  const handleNextFromCategory = () => {
    if (!selectedCategory) return;
    if (isPhysical) {
      setStep(2); // Go to Product
    } else {
      setStep(2); // Go directly to Service
    }
  };

  const handleNextFromProduct = () => {
    if (!selectedProduct) return;
    setStep(3); // Go to Service
  };

  const handleNextFromService = () => {
    if (!stepServiceValid) return;
    setStep(recipientStepNumber); // Go to Recipient
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      if (isPhysical) setStep(2);
      else setStep(1);
    } else if (step === 4) {
      setStep(3);
    }
  };

  // ── Build Voucher Payload & Submit (Requirement 1.vi) ──
  const handleConfirmPaymentAndCreateVoucher = async () => {
    setPaymentSubmitLoading(true);
    setPaymentSubmitError(null);

    const svcCategory = fullDetail?.category ?? selectedService?.category ?? '';
    const arrRaw = selectedArrangt as unknown as Record<string, unknown>;
    const arrName = selectedArrangt?.arrangement_name ?? String(arrRaw?.name ?? 'Room');

    const customerId = sender?.id ?? currentUser?.id ?? '';

    const payload = {
      gift_category: (selectedCategory?.code ?? 'DIGITAL').toLowerCase(),
      gift_category_id: selectedCategory?.id ?? '',
      gift_category_code: selectedCategory?.code ?? 'DIGITAL',
      category_data: {
        id: selectedCategory?.id ?? '',
        code: selectedCategory?.code ?? '',
        title: selectedCategory?.title ?? '',
        description: selectedCategory?.description ?? '',
        image: selectedCategory?.image ?? '',
      },
      ...(isPhysical && selectedProduct
        ? {
            product_id: selectedProduct.id,
            product_data: {
              id: selectedProduct.id,
              name: selectedProduct.name,
              price: selectedProduct.price,
              image: selectedProduct.image,
              category: selectedProduct.category,
            },
            ordered_items: [
              {
                product_id: selectedProduct.id,
                sku: selectedProduct.sku ?? '',
                name: selectedProduct.name,
                price: selectedProduct.price,
                quantity: 1,
                image: selectedProduct.image,
                total_price: selectedProduct.price,
                currency,
              },
            ],
            digital_product_data: null,
          }
        : {
            digital_product_data: {
              id: selectedCategory?.id ?? '',
              title: selectedCategory?.title ?? '',
              name: selectedService?.name ?? '',
              category_code: selectedCategory?.code ?? 'DIGITAL',
            },
            ordered_items: null,
          }),
      service_id: selectedService?.id ?? '',
      service_data: {
        name: selectedService?.name ?? '',
        category: svcCategory,
        base_price: basePrice,
        duration_minutes: baseDuration,
      },
      branch_id: selectedBranch?.id ?? selectedBranch?.branch_id ?? '',
      branch_data: {
        name: selectedBranch?.name ?? selectedBranch?.branch_name ?? '',
        branch_id: selectedBranch?.id ?? selectedBranch?.branch_id ?? '',
      },
      service_arrangement_id: selectedArrangt?.id ?? '',
      service_arrangement_data: {
        room: arrName,
        arrangement_name: arrName,
        arrangement_type: selectedArrangt?.arrangement_type ?? 'room',
        image: selectedArrangt?.image ?? '',
      },
      addons: selectedAddons.map((a) => ({
        addon_id: a.id,
        id: a.id,
        name: a.name,
        price: a.price,
        duration: a.duration_minutes,
      })),
      extra_time: extraTime,
      price_for_extra_time: extraTimePrice,
      total_duration: totalDuration,
      total_amount: totalPrice,
      currency,
      recipient_phone: recipientPhone,
      recipient_id: recipient?.id ?? '',
      recipient_data: {
        name: recipientName,
        phone_number: recipientPhone,
        email: recipientEmail,
      },
      sender_id: customerId,
      sender_data: {
        name: sender ? customerLabel(sender) : currentUser?.name ?? 'Desk Staff',
        phone_number: sender ? customerPhone(sender) : '',
        email: sender?.email ?? currentUser?.email ?? '',
      },
      gift_message: giftMessage,
      gift_template: giftTemplate,
      payment_provider: ({
        MyFatoorah: 'MyFatoorah',
        PaymentLink: 'DirectLink',
        Deema: 'Deema',
        'KNET Card': 'Other',
        Other: 'Other',
      } as Record<string, string>)[selectedProvider] ?? 'Other',
      payment_method: selectedProvider === 'PaymentLink' ? 'DirectLink' : selectedProvider,
      payment_through: 'desk',
      source: 'desk',
      payment_status: selectedProvider === 'PaymentLink' || selectedProvider === 'Deema' ? 'pending' : 'success',
      status: selectedProvider === 'PaymentLink' || selectedProvider === 'Deema' ? 'payment_pending' : 'active',
    };

    try {
      const voucherUrl = customerId
        ? `/booknpay/api/v1/vouchers/?customer_id=${encodeURIComponent(customerId)}`
        : '/booknpay/api/v1/vouchers/';

      const res = await authedFetch(voucherUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let detail = '';
        if (typeof data?.detail === 'string') {
          detail = data.detail;
        } else if (Array.isArray(data?.detail)) {
          detail = data.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ');
        } else if (data?.error) {
          if (typeof data.error === 'string') {
            detail = data.error;
          } else if (Array.isArray(data.error.detail)) {
            detail = data.error.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join('; ');
          } else {
            detail = data.error.message || JSON.stringify(data.error);
          }
        } else if (data?.message) {
          detail = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
        } else {
          detail = JSON.stringify(data);
        }
        throw new Error(detail || `Server error ${res.status}`);
      }

      setPaymentSuccess(true);
      setTimeout(() => {
        setShowPaymentModal(false);
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setPaymentSubmitError(err instanceof Error ? err.message : 'Failed to create gift voucher');
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal shell */}
        <div
          className="relative z-10 flex flex-col w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl transition-all duration-200"
          style={{
            height: 'min(92vh, 820px)',
            background: B.cardBg,
            border: `1.5px solid ${B.linen}`,
          }}
        >
          {/* ── Header ── */}
          <div
            className="shrink-0 flex items-center justify-between gap-4 px-6 py-4"
            style={{ background: B.espresso }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Create Gift Voucher</h2>
                <p className="text-[11px]" style={{ color: B.linen }}>
                  {selectedCategory?.title ?? 'Personalized Luxury Spa Gifts & Wellness Products'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition cursor-pointer hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,0.12)' }}
              aria-label="Close"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* ── Dynamic Step bar ── */}
          <StepBar step={step} isPhysical={isPhysical} />

          {/* ── Scrollable body ── */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
            style={{ background: B.bg, scrollbarWidth: 'thin', scrollbarColor: `${B.linen} transparent` }}
          >
            {/* ══ STEP 1: CHOOSE GIFT CATEGORY (Requirement 1.i) ══ */}
            {step === 1 && (
              <div className="space-y-4">
                <SectionLabel icon={Gift} label="Choose Gift Category" />

                {categoriesLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: B.espresso }} />
                    <p className="text-xs text-muted-foreground">Loading gift categories…</p>
                  </div>
                )}

                {categoriesError && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{categoriesError}</p>
                  </div>
                )}

                {!categoriesLoading && categories.length === 0 && !categoriesError && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No gift categories available.</p>
                )}

                {!categoriesLoading && categories.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map((cat) => {
                      const isSel = selectedCategory?.id === cat.id;
                      const isDig = cat.code === 'DIGITAL';
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            'group relative flex flex-col rounded-2xl border-2 text-left overflow-hidden transition-all duration-200 cursor-pointer p-4',
                            isSel ? 'shadow-md' : 'hover:border-border hover:shadow-sm'
                          )}
                          style={{
                            borderColor: isSel ? B.espresso : B.linen,
                            background: isSel ? '#ffffff' : B.cardBg,
                          }}
                        >
                          {/* Image preview banner */}
                          <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3 bg-muted">
                            {cat.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cat.image}
                                alt={cat.title}
                                className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{ background: B.pillBg }}
                              >
                                {isDig ? (
                                  <Sparkles className="h-10 w-10" style={{ color: B.espresso }} />
                                ) : (
                                  <Package className="h-10 w-10" style={{ color: B.espresso }} />
                                )}
                              </div>
                            )}

                            {/* Badge */}
                            <span
                              className="absolute top-2.5 left-2.5 rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-sm"
                              style={{
                                background: isDig ? 'rgba(76,29,149,0.85)' : 'rgba(84,60,48,0.85)',
                                color: '#ffffff',
                              }}
                            >
                              {cat.code}
                            </span>

                            {/* Selected Checkmark */}
                            {isSel && (
                              <div
                                className="absolute top-2.5 right-2.5 h-6 w-6 rounded-full grid place-items-center shadow-md"
                                style={{ background: B.espresso }}
                              >
                                <Check className="h-3.5 w-3.5 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <h3 className="text-sm font-extrabold leading-snug mb-1" style={{ color: B.textMain }}>
                            {cat.title}
                          </h3>
                          <p className="text-[11px] leading-relaxed line-clamp-2 text-muted-foreground">
                            {cat.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ STEP 2 (PHYSICAL ONLY): CHOOSE PRODUCT (Requirement 1.ii) ══ */}
            {step === 2 && isPhysical && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionLabel icon={ShoppingBag} label="Choose Wellness Product" />
                  <span className="text-[11px] text-muted-foreground">{products.length} products available</span>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products by title or SKU…"
                    className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-xs outline-none transition focus:border-primary"
                  />
                </div>

                {productsLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: B.espresso }} />
                    <p className="text-xs text-muted-foreground">Loading products…</p>
                  </div>
                )}

                {productsError && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">{productsError}</p>
                  </div>
                )}

                {!productsLoading && filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">No products matching your search.</p>
                )}

                {!productsLoading && filteredProducts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {filteredProducts.map((p) => {
                      const isSel = selectedProduct?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProduct(p)}
                          className={cn(
                            'group flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition cursor-pointer',
                            isSel ? 'shadow-sm' : 'hover:border-border hover:bg-card/90'
                          )}
                          style={{
                            borderColor: isSel ? B.espresso : B.linen,
                            background: isSel ? B.cardBg : B.cardBg,
                          }}
                        >
                          <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-muted">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                <Package className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-bold truncate" style={{ color: B.textMain }}>
                                {p.name}
                              </p>
                              {isSel && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                            </div>
                            {p.category && (
                              <span className="inline-block text-[10px] text-muted-foreground truncate mb-1">
                                {p.category}
                              </span>
                            )}
                            <p className="text-xs font-extrabold" style={{ color: B.espresso }}>
                              {fmtPrice(p.price, p.currency || 'KWD')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ STEP (SERVICE & ROOM): Requirement 1.iii ══ */}
            {step === serviceStepNumber && (
              <div className="space-y-6">
                {/* Service Selection */}
                <div>
                  <SectionLabel icon={Scissors} label="Service" />
                  <SearchableDropdown
                    items={services}
                    value={selectedService}
                    onSelect={handleServiceSelect}
                    labelFn={(s) => s.name}
                    placeholder="Search and select a spa service…"
                    loading={servicesLoading}
                  />
                </div>

                {detailLoading && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: B.textMuted }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: B.espresso }} />
                    Loading service details & arrangements…
                  </div>
                )}

                {detailError && (
                  <div
                    className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
                    style={{ borderColor: B.errorBorder, background: B.errorBg }}
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs text-red-600">{detailError}</p>
                  </div>
                )}

                {/* Branch Selection */}
                {fullDetail && branches.length > 0 && (
                  <div>
                    <SectionLabel icon={MapPin} label="Branch" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {branches.map((b) => {
                        const bid = b.id ?? b.branch_id ?? '';
                        const bname = b.name ?? b.branch_name ?? bid;
                        const active = (selectedBranch?.id ?? selectedBranch?.branch_id) === bid;
                        return (
                          <button
                            key={bid}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(b);
                              setSelectedArrangt(null);
                              setSelectedAddons([]);
                            }}
                            className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all cursor-pointer"
                            style={{
                              borderColor: active ? B.espresso : B.linen,
                              background: active ? B.blush : B.cardBg,
                            }}
                          >
                            <div
                              className="h-4 w-4 rounded-full border-2 grid place-items-center shrink-0 transition"
                              style={{
                                borderColor: active ? B.espresso : B.linen,
                                background: active ? B.espresso : 'transparent',
                              }}
                            >
                              {active && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <p className="text-sm font-semibold" style={{ color: B.textMain }}>
                              {bname}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Room / Arrangements */}
                {selectedBranch && arrangements.length > 0 && (
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <SectionLabel icon={Gift} label="Room / Arrangement" />
                      <span className="text-[10px]" style={{ color: B.textMuted }}>
                        {arrangements.length} option{arrangements.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div
                      className="overflow-x-auto"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: `${B.linen} transparent` }}
                    >
                      <div className="flex gap-3 pb-3" style={{ width: 'max-content' }}>
                        {arrangements.map((arr, idx) => (
                          <ArrangementCard
                            key={arr.id ?? idx}
                            arr={arr}
                            active={selectedArrangt?.id === arr.id}
                            onSelect={() => {
                              setSelectedArrangt(arr);
                              setSelectedAddons([]);
                            }}
                            index={idx}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {selectedArrangt && addons.length > 0 && (
                  <div>
                    <SectionLabel icon={Package} label="Add-ons (optional)" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {addons.map((addon) => (
                        <AddonCheckbox
                          key={addon.id}
                          addon={addon}
                          checked={selectedAddons.some((a) => a.id === addon.id)}
                          onChange={(checked) => toggleAddon(addon, checked)}
                          currency={currency}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra time */}
                {selectedArrangt && (
                  <div>
                    <SectionLabel icon={Timer} label="Extra Time (optional)" />
                    <div className="flex flex-wrap gap-2">
                      {[0, 15, 30, 45, 60].map((mins) => {
                        const active = extraTime === mins;
                        const price = calcExtraPrice(mins);
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setExtraTime(mins)}
                            className="rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer"
                            style={{
                              borderColor: active ? B.espresso : B.lineMuted,
                              background: active ? B.espresso : B.cardBg,
                              color: active ? '#fff' : B.textMain,
                            }}
                          >
                            {mins === 0 ? 'No extra time' : `+${mins} mins`}
                            {price > 0 && ` (${fmtPrice(price, currency)})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ STEP (RECIPIENTS): Requirement 1.iv ══ */}
            {step === recipientStepNumber && (
              <div className="space-y-5">
                <SectionLabel icon={User} label="Recipient Details" />

                {/* Recipient Input Fields */}
                <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: B.linen, background: B.cardBg }}>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: B.textMuted }}>
                      Recipient Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5" style={{ borderColor: B.linen }}>
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Recipient full name"
                        className="flex-1 bg-transparent text-sm outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: B.textMuted }}>
                      Recipient Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5" style={{ borderColor: B.linen }}>
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="+965 9000 0000"
                        className="flex-1 bg-transparent text-sm outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: B.textMuted }}>
                      Recipient Email (Optional)
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5" style={{ borderColor: B.linen }}>
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="recipient@example.com"
                        className="flex-1 bg-transparent text-sm outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Or pick from customer DB */}
                  <div className="pt-2 border-t" style={{ borderColor: B.lineMuted }}>
                    <CustomerPicker
                      label="Or pick from customer database"
                      value={recipient}
                      onSelect={handleSelectRecipient}
                      onCreateNew={() => {
                        setCreateForRole('recipient');
                        setShowCreateCustomer(true);
                      }}
                      authHeader={authHeader}
                      injectedCustomer={injectedCustomer}
                    />
                  </div>
                </div>

                {/* Personal Message */}
                <div>
                  <SectionLabel icon={MessageSquare} label="Personal Message (Optional)" />
                  <textarea
                    rows={3}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Write a warm, personalized greeting for the recipient…"
                    className="w-full rounded-2xl border p-3.5 text-sm outline-none transition focus:border-primary"
                    style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}
                  />
                </div>

                {/* Gift Template */}
                <div>
                  <SectionLabel icon={Sparkles} label="Voucher Design Theme" />
                  <div className="flex flex-wrap gap-2">
                    {GIFT_TEMPLATES.map((tmpl) => {
                      const active = giftTemplate === tmpl;
                      return (
                        <button
                          key={tmpl}
                          type="button"
                          onClick={() => setGiftTemplate(tmpl)}
                          className="rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                          style={{
                            borderColor: active ? B.espresso : B.lineMuted,
                            background: active ? B.blush : B.cardBg,
                            color: active ? B.espresso : B.textMuted,
                          }}
                        >
                          {tmpl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Order Summary Review Card */}
                <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: B.lineMuted, background: B.pillBg }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: B.textMuted }}>
                    Voucher Summary
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-bold">{selectedCategory?.title}</span>
                    </div>
                    {isPhysical && selectedProduct && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wellness Product:</span>
                        <span className="font-bold">{selectedProduct.name} ({fmtPrice(selectedProduct.price, currency)})</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Spa Service:</span>
                      <span className="font-bold">{selectedService?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Branch & Room:</span>
                      <span className="font-bold">
                        {selectedBranch?.name} • {selectedArrangt?.arrangement_name}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t" style={{ borderColor: B.lineMuted }}>
                      <span className="font-extrabold text-sm" style={{ color: B.textMain }}>
                        Total Amount Due:
                      </span>
                      <span className="font-extrabold text-sm" style={{ color: B.espresso }}>
                        {fmtPrice(totalPrice, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer Navigation ── */}
          <div className="shrink-0" style={{ borderTop: `1px solid ${B.lineMuted}`, background: B.bg }}>
            {/* Price bar if service chosen */}
            {selectedService && (
              <div className="flex items-center gap-4 px-6 py-2.5" style={{ borderBottom: `1px solid ${B.lineMuted}` }}>
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5" style={{ color: B.textMuted }} />
                  <span className="text-[11px]" style={{ color: B.textMuted }}>Duration:</span>
                  <span className="text-xs font-extrabold" style={{ color: B.textMain }}>{totalDuration} min</span>
                </div>
                <div className="h-3 w-px" style={{ background: B.linen }} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: B.textMuted }}>Total:</span>
                  <span className="text-xs font-extrabold" style={{ color: B.espresso }}>
                    {fmtPrice(totalPrice, currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-3 px-6 py-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition cursor-pointer"
                  style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2 text-xs font-semibold transition cursor-pointer"
                style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}
              >
                Cancel
              </button>

              <div className="flex-1" />

              {/* Step 1 button */}
              {step === 1 && (
                <button
                  type="button"
                  disabled={!stepCategoryValid}
                  onClick={handleNextFromCategory}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] cursor-pointer"
                  style={{
                    background: stepCategoryValid ? B.espresso : B.linen,
                    color: stepCategoryValid ? '#fff' : B.textMuted,
                  }}
                >
                  Next: {isPhysical ? 'Choose Product' : 'Choose Service'} <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Step 2 (Product) button */}
              {step === 2 && isPhysical && (
                <button
                  type="button"
                  disabled={!stepProductValid}
                  onClick={handleNextFromProduct}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] cursor-pointer"
                  style={{
                    background: stepProductValid ? B.espresso : B.linen,
                    color: stepProductValid ? '#fff' : B.textMuted,
                  }}
                >
                  Next: Choose Service <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Service Step button */}
              {step === serviceStepNumber && (
                <button
                  type="button"
                  disabled={!stepServiceValid}
                  onClick={handleNextFromService}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] cursor-pointer"
                  style={{
                    background: stepServiceValid ? B.espresso : B.linen,
                    color: stepServiceValid ? '#fff' : B.textMuted,
                  }}
                >
                  Next: Recipients <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Recipient Step button: MAKE PAYMENT (Requirement 1.iv & 1.v) */}
              {step === recipientStepNumber && (
                <button
                  type="button"
                  disabled={!stepRecipientValid}
                  onClick={() => {
                    setPaymentSubmitError(null);
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.98] cursor-pointer"
                  style={{
                    background: stepRecipientValid ? B.success : B.linen,
                    color: stepRecipientValid ? '#fff' : B.textMuted,
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  Make Payment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Provider Popup (Requirement 1.v: exactly similar to Booking Details) ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !paymentSubmitLoading && setShowPaymentModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden transition-all duration-200">
            {/* Accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 shrink-0" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/40">
              <div>
                <h3 className="text-base font-extrabold text-foreground">Select Payment Provider</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose a payment gateway or payment method to issue the voucher.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={paymentSubmitLoading}
                className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Voucher amount banner */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Voucher Total
                  </p>
                  <p className="text-sm font-bold truncate text-foreground">{recipientName || 'Gift Voucher'}</p>
                </div>
                <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {fmtPrice(totalPrice, currency)}
                </p>
              </div>

              {/* Provider Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PAYMENT_PROVIDERS.map((provider) => {
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={cn(
                        'relative flex flex-col items-start p-3 rounded-2xl border-2 text-left transition cursor-pointer select-none',
                        isSelected
                          ? `${provider.borderColor} bg-white dark:bg-card shadow-sm`
                          : 'border-border/50 bg-card/60 hover:border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span
                          className={cn(
                            'text-xs font-extrabold',
                            isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'
                          )}
                        >
                          {provider.name}
                        </span>
                        {isSelected && (
                          <span className={provider.checkColor}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                        {provider.description}
                      </span>
                      <span
                        className={cn(
                          'mt-2 inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-bold',
                          provider.tagColor
                        )}
                      >
                        {provider.tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {paymentSubmitError && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{paymentSubmitError}</span>
                </div>
              )}

              {paymentSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="font-bold">Gift voucher created and payment recorded successfully!</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4 bg-muted/10">
              <p className="text-xs text-muted-foreground">
                Payment mode:{' '}
                <span className="font-bold text-foreground">{selectedProvider}</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentSubmitLoading}
                  className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPaymentAndCreateVoucher}
                  disabled={paymentSubmitLoading || paymentSuccess}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {paymentSubmitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Voucher…
                    </>
                  ) : paymentSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      Voucher Created!
                    </>
                  ) : (
                    <>
                      <Banknote className="h-4 w-4" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add Customer Modal */}
      {showCreateCustomer && (
        <CreateCustomerModal
          authHeader={authHeader}
          onCreated={(created: CreatedCustomer) => {
            const id = String(created.id);
            const fullName = created.full_name || [created.first_name, created.last_name].filter(Boolean).join(' ');
            const asCustomer: Customer = {
              id,
              name: fullName,
              customer_name: fullName,
              first_name: created.first_name ?? '',
              last_name: created.last_name ?? '',
              phone_number: created.phone_number,
              phone: created.phone_number,
              email: created.email,
              avatar: created.avatar as string | undefined,
            };
            setInjectedCustomer(asCustomer);
            if (createForRole === 'sender') setSender(asCustomer);
            if (createForRole === 'recipient') handleSelectRecipient(asCustomer);
          }}
          onClose={() => setShowCreateCustomer(false)}
        />
      )}
    </>
  );
}
