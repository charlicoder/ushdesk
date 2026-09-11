'use client';

/**
 * CreateVoucherModal — v3
 * Brand theme: #543c30 (deep espresso), #dbcdc2 / #daccc1 (warm linen/blush)
 *
 * Step 1 – Service & Room
 * Step 2 – Recipients & Message  →  POST /booknpay/api/v1/vouchers/
 * Step 3 – Confirm Payment       →  POST /booknpay/api/v1/payments/
 *                                →  PATCH /booknpay/api/v1/vouchers/<id>/status/
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  X, Search, Loader2, ChevronDown, Check, Gift,
  MapPin, Scissors, Package, Timer, User, MessageSquare,
  Sparkles, ChevronRight, ChevronLeft, AlertCircle, UserPlus,
  CreditCard, Receipt, Calendar, Hash, Fingerprint, UserCheck,
  CheckCircle2,
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
  // Extra-time pricing — one of these may be present depending on the API version
  extra_time_price?:             string | number | null;
  price_per_extra_minute?:       string | number | null;
  extra_time_price_per_minute?:  string | number | null;
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

// Payment form state
interface PaymentFormState {
  invoice_id:       string;  // Order Number
  transaction_date: string;
  total_amount:     string;  // Amount Paid
  trace_id:         string;
  reference_id:     string;  // KNET Ref ID
  received_by:      string;
}

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
const EXTRA_TIME_OPTIONS = [0, 15, 30, 45];

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
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = items.filter(i => labelFn(i).toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition focus:outline-none"
        style={{
          borderColor: open ? B.espresso : B.linen,
          background: B.cardBg,
          color: value ? B.textMain : B.textMuted,
          boxShadow: open ? `0 0 0 3px ${B.blush}` : undefined,
          opacity: (disabled || loading) ? 0.5 : 1,
          cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        }}
      >
        <span className="flex-1 text-left truncate text-sm">
          {loading ? 'Loading…' : value ? labelFn(value) : (placeholder ?? 'Select…')}
        </span>
        {loading
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: B.textMuted }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border shadow-2xl overflow-hidden"
          style={{ borderColor: B.linen, background: B.cardBg }}>
          <div className="p-2 border-b" style={{ borderColor: B.lineMuted }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: B.bg }}>
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: B.textMuted }} />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: B.textMain }}
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-center" style={{ color: B.textMuted }}>No results</li>
              : filtered.map((item, i) => {
                  const label  = labelFn(item);
                  const active = value ? labelFn(value) === label : false;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => { onSelect(item); setOpen(false); setSearch(''); }}
                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition"
                        style={{
                          background: active ? B.blush : undefined,
                          color:      active ? B.espresso : B.textMain,
                          fontWeight: active ? 700 : 400,
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = B.bg; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                      >
                        {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: B.espresso }} />}
                        <span className={cn('flex-1', !active && 'ml-5')}>{label}</span>
                      </button>
                    </li>
                  );
                })
            }
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
  const currency  = arr.currency ?? 'KWD';
  const rawArr    = arr as unknown as Record<string, unknown>;
  const name      = (arr.arrangement_name ?? rawArr.name ?? rawArr.title ?? 'Room') as string;
  const priceRaw  = arr.arrangement_price ?? arr.price ?? rawArr.base_price ?? rawArr.amount ?? rawArr.cost;
  const priceNum  = parseFloat(String(priceRaw ?? ''));
  const hasPrice  = priceRaw != null && priceRaw !== '' && !isNaN(priceNum) && priceNum > 0;
  const arrType   = (arr.arrangement_type ?? rawArr.arrangement_type ?? rawArr.type) as string | undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative shrink-0 rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.97] focus:outline-none"
      style={{
        width: 160,
        height: 210,
        border: `3px solid ${active ? B.espresso : 'transparent'}`,
        boxShadow: active
          ? `0 0 0 1px ${B.espresso}, 0 6px 24px 0 ${B.espresso}40`
          : '0 2px 8px 0 rgba(0,0,0,0.13)',
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
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)' }}
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
  const avatarSrc = typeof customer.avatar === 'string' && customer.avatar.trim()
    ? customer.avatar.trim()
    : (typeof rawCustomer.avatar_url === 'string' && rawCustomer.avatar_url.trim())
    ? rawCustomer.avatar_url.trim()
    : (typeof rawCustomer.photo === 'string' && rawCustomer.photo.trim())
    ? rawCustomer.photo.trim()
    : (typeof rawCustomer.profile_image === 'string' && rawCustomer.profile_image.trim())
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
  customers,
  loading,
  excludeId,
  onCreateNew,
}: {
  label: string;
  value: Customer | null;
  onSelect: (c: Customer) => void;
  customers: Customer[];
  loading: boolean;
  excludeId?: string;
  onCreateNew?: () => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const items = (excludeId ? customers.filter(c => c.id !== excludeId) : customers)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        customerLabel(c).toLowerCase().includes(q) ||
        (c.phone_number ?? c.phone ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    });

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-wider"
          style={{ color: B.textMuted }}>{label}</label>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            title="Create new customer"
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80 cursor-pointer"
            style={{ background: B.blush, color: B.espresso }}
          >
            <UserPlus className="h-3 w-3" />
            New
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition focus:outline-none"
        style={{
          borderColor: open ? B.espresso : B.linen,
          background: B.cardBg,
          boxShadow: open ? `0 0 0 3px ${B.blush}` : undefined,
          opacity: loading ? 0.5 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {value ? (
          <>
            <CustomerAvatar customer={value} size={28} />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-bold truncate" style={{ color: B.textMain }}>
                {customerLabel(value)}
              </p>
              {(value.phone_number || value.phone) && (
                <p className="text-[10px] truncate" style={{ color: B.textMuted }}>
                  {value.phone_number ?? value.phone}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="h-7 w-7 rounded-full grid place-items-center shrink-0"
              style={{ background: B.lineMuted }}>
              <User className="h-3.5 w-3.5" style={{ color: B.textMuted }} />
            </div>
            <span className="flex-1 text-left text-sm" style={{ color: B.textMuted }}>
              {loading ? 'Loading customers…' : `Select ${label}`}
            </span>
          </>
        )}
        {loading
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: B.textMuted }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />}
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
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: B.textMain }}
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 ? (
              <li className="px-4 py-3 text-sm text-center" style={{ color: B.textMuted }}>No results</li>
            ) : (
              items.map(c => {
                const active = value?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition"
                      style={{ background: active ? B.blush : undefined }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = B.bg; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = active ? B.blush : ''; }}
                    >
                      <CustomerAvatar customer={c} size={32} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-semibold leading-tight truncate"
                          style={{ color: active ? B.espresso : B.textMain, fontWeight: active ? 700 : 500 }}
                        >
                          {customerLabel(c)}
                        </p>
                        {(c.phone_number || c.phone) && (
                          <p className="text-[10px] truncate" style={{ color: B.textMuted }}>
                            {c.phone_number ?? c.phone}
                          </p>
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
        background:  checked ? B.blush : B.cardBg,
      }}
    >
      <div
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 grid place-items-center transition"
        style={{
          background:   checked ? B.espresso : B.cardBg,
          borderColor:  checked ? B.espresso : B.linen,
        }}
      >
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
        <input type="checkbox" className="sr-only" checked={checked}
          onChange={e => onChange(e.target.checked)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight" style={{ color: B.textMain }}>{addon.name}</p>
        {addon.description && (
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: B.textMuted }}>{addon.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {addon.duration_minutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: B.textMuted }}>
              <Timer className="h-2.5 w-2.5" />{addon.duration_minutes} min
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

// ── Step Bar (3 steps) ─────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Service & Room' },
    { n: 2, label: 'Recipients' },
    { n: 3, label: 'Payment' },
  ];
  return (
    <div className="flex items-center shrink-0 px-6 py-3 border-b"
      style={{ borderColor: B.lineMuted, background: B.bg }}>
      {steps.map((s, idx) => (
        <React.Fragment key={s.n}>
          {idx > 0 && (
            <div className="flex-1 h-px mx-3 transition-colors"
              style={{ background: step >= s.n ? B.espresso : B.linen }} />
          )}
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full grid place-items-center text-xs font-extrabold transition-all"
              style={{
                background: step >= s.n ? B.espresso : B.linen,
                color:      step >= s.n ? '#fff'     : B.textMuted,
                boxShadow:  step >= s.n ? `0 2px 8px ${B.espresso}40` : undefined,
              }}
            >
              {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </div>
            <span className="text-[11px] font-bold hidden sm:block"
              style={{ color: step >= s.n ? B.espresso : B.textMuted }}>
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
      <span className="text-[11px] font-extrabold uppercase tracking-widest"
        style={{ color: B.espresso }}>{label}</span>
    </div>
  );
}

// ── Payment Field ─────────────────────────────────────────────────────────────

function PaymentField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: B.textMuted }}>
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all"
        style={{ borderColor: B.linen, background: B.cardBg }}
        onFocus={() => {}} // handled on child
      >
        <Icon className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: B.textMain }}
          onFocus={e => {
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.style.borderColor = B.espresso;
              parent.style.boxShadow = `0 0 0 3px ${B.blush}`;
            }
          }}
          onBlur={e => {
            const parent = e.currentTarget.parentElement;
            if (parent) {
              parent.style.borderColor = B.linen;
              parent.style.boxShadow = '';
            }
          }}
        />
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

export function CreateVoucherModal({ token, onClose, onSuccess }: Props) {
  const authHeader = `Bearer ${token}`;
  const currentUser = useAppSelector((s) => s.auth.user);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1 state ──
  const [services,        setServices]        = useState<SlimService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<SlimService | null>(null);
  const [fullDetail,      setFullDetail]      = useState<ServiceFullDetail | null>(null);
  const [detailLoading,   setDetailLoading]   = useState(false);
  const [detailError,     setDetailError]     = useState<string | null>(null);
  const [selectedBranch,  setSelectedBranch]  = useState<Branch | null>(null);
  const [selectedArrangt, setSelectedArrangt] = useState<Arrangement | null>(null);
  const [selectedAddons,  setSelectedAddons]  = useState<AddonItem[]>([]);
  const [extraTime,       setExtraTime]       = useState<number>(0);

  // ── Step 2 state ──
  const [customers,        setCustomers]        = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [sender,           setSender]           = useState<Customer | null>(null);
  const [recipient,        setRecipient]        = useState<Customer | null>(null);
  const [giftMessage,      setGiftMessage]      = useState('');
  const [giftTemplate,     setGiftTemplate]     = useState(GIFT_TEMPLATES[0]);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [createForRole,      setCreateForRole]      = useState<'sender' | 'recipient'>('sender');

  // ── Create Voucher request state ──
  const [isCreatingVoucher, setIsCreatingVoucher] = useState(false);
  const [createVoucherError, setCreateVoucherError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createdVoucher, setCreatedVoucher] = useState<Record<string, any> | null>(null);

  // ── Step 3: Payment form state ──
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    invoice_id:       '',
    transaction_date: '',
    total_amount:     '',
    trace_id:         '',
    reference_id:     '',
    received_by:      '',
  });
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [confirmPaymentError, setConfirmPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // ── Totals ──
  const currency     = fullDetail?.currency ?? selectedService?.currency ?? 'KWD';
  const basePrice    = parseFloat(fullDetail?.base_price ?? fullDetail?.price ?? selectedService?.base_price ?? selectedService?.price ?? '0') || 0;
  const baseDuration = fullDetail?.duration_minutes ?? selectedService?.duration_minutes ?? 0;
  const addonPrice   = selectedAddons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const addonDur     = selectedAddons.reduce((s, a) => s + (a.duration_minutes || 0), 0);
  const arrangPriceRaw = selectedArrangt?.arrangement_price ?? selectedArrangt?.price;
  const arrangPrice    = parseFloat(String(arrangPriceRaw ?? '')) || 0;

  // Extra-time price: use a dedicated per-minute field if available, otherwise
  // derive a per-minute rate from the arrangement/base price ÷ base duration.
  const extraTimePricePerMin = (() => {
    const arr = selectedArrangt;
    if (!arr) return 0;
    // Try dedicated API fields first (various naming conventions)
    const raw =
      arr.extra_time_price_per_minute ??
      arr.price_per_extra_minute ??
      arr.extra_time_price;
    if (raw != null) {
      const parsed = parseFloat(String(raw));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    // Fallback: derive per-minute rate from arrangement/base price and base duration
    const effectivePrice    = arrangPrice || basePrice;
    const effectiveDuration = baseDuration || 60; // avoid division by zero
    return effectivePrice > 0 && effectiveDuration > 0
      ? effectivePrice / effectiveDuration
      : 0;
  })();

  const extraTimePrice = extraTime > 0 ? parseFloat((extraTimePricePerMin * extraTime).toFixed(3)) : 0;
  const totalPrice     = (arrangPrice || basePrice) + addonPrice + extraTimePrice;
  const totalDuration  = baseDuration + addonDur + extraTime;

  // ── Escape key ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Fetch services-slim ──
  useEffect(() => {
    (async () => {
      setServicesLoading(true);
      try {
        const res  = await authedFetch('/api/v1/services/slim/', {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        setServices(Array.isArray(data) ? data : (data.results ?? data.data ?? []));
      } finally {
        setServicesLoading(false);
      }
    })();
  }, [authHeader]);

  // ── Fetch full service detail ──
  const fetchFullDetail = useCallback(async (svc: SlimService) => {
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
      setFullDetail((data.data ?? data) as ServiceFullDetail);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load service details');
    } finally {
      setDetailLoading(false);
    }
  }, [authHeader]);

  const handleServiceSelect = useCallback((svc: SlimService) => {
    setSelectedService(svc);
    fetchFullDetail(svc);
  }, [fetchFullDetail]);

  // ── Fetch customers ──
  const fetchCustomers = useCallback(async () => {
    if (customers.length > 0) return;
    setCustomersLoading(true);
    try {
      const res  = await authedFetch('/api/v1/customers/', {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      setCustomers(Array.isArray(data) ? data : (data.results ?? data.data ?? []));
    } finally {
      setCustomersLoading(false);
    }
  }, [authHeader, customers.length]);

  const goToStep2 = () => { setStep(2); fetchCustomers(); };

  // ── Derived ──
  const branches: Branch[] = fullDetail?.branches ?? [];

  const arrangements: Arrangement[] = (() => {
    if (!selectedBranch) return [];
    const nested = selectedBranch.service_arrangements;
    if (nested?.length) return nested;
    return (fullDetail?.service_arrangements ?? []).filter((a: Arrangement) => {
      const raw = a as unknown as Record<string, unknown>;
      return !raw.branch_id || raw.branch_id === (selectedBranch.id ?? selectedBranch.branch_id);
    });
  })();

  const addons: AddonItem[] = selectedArrangt?.addons ?? [];

  const toggleAddon = (addon: AddonItem, checked: boolean) =>
    setSelectedAddons(prev => checked ? [...prev, addon] : prev.filter(a => a.id !== addon.id));

  const step1Valid = !!selectedService && !!selectedBranch && !!selectedArrangt && !detailLoading;
  const step2Valid = !!sender && !!recipient;

  // ── Build voucher payload ──
  const buildVoucherPayload = () => {
    const svcCategory = fullDetail?.category ?? selectedService?.category ?? '';
    const arrRaw = selectedArrangt as unknown as Record<string, unknown>;
    const arrName = selectedArrangt?.arrangement_name ?? String(arrRaw?.name ?? '');

    return {
      service_id: selectedService?.id ?? '',
      service_data: {
        category: svcCategory,
        name: selectedService?.name ?? '',
      },
      branch_id: selectedBranch?.id ?? selectedBranch?.branch_id ?? '',
      branch_data: {
        name: selectedBranch?.name ?? selectedBranch?.branch_name ?? '',
      },
      service_arrangement_id: selectedArrangt?.id ?? '',
      service_arrangement_data: {
        room:  arrName,
        image: selectedArrangt?.image ?? '',
      },
      addons: selectedAddons.map(a => ({
        addon_id: a.id,
        duration: a.duration_minutes,
        name:     a.name,
        price:    a.price,
      })),
      extra_time:            extraTime,
      price_for_extra_time:  extraTimePrice,
      total_duration:        totalDuration,
      total_amount:          totalPrice,
      currency,
      status:                'created',
      recipient_phone:       customerPhone(recipient!),
      recipient_id:          recipient?.id ?? '',
      recipient_data: {
        name:         customerLabel(recipient!),
        email:        recipient?.email ?? '',
        phone_number: customerPhone(recipient!),
      },
      sender_id: sender?.id ?? '',
      sender_data: {
        name:         customerLabel(sender!),
        email:        sender?.email ?? '',
        phone_number: customerPhone(sender!),
      },
      gift_message:      giftMessage,
      gift_template:     giftTemplate,
      booking_id:        '',
      booking_data:      {},
      payment_url:       '',
      payment_id:        '',
      payment_provider:  'directlink',
      payment_through:   'desk',
      payment_data:      {},
    };
  };

  // ── Create voucher (Step 2 → Step 3) ──
  const handleCreateVoucher = async () => {
    if (!step2Valid) return;
    setIsCreatingVoucher(true);
    setCreateVoucherError(null);
    try {
      const payload = buildVoucherPayload();
      // customer_id (= sender_id) is required by the upstream API when using an app token
      const customerId = sender?.id ?? '';
      const voucherUrl = customerId
        ? `/booknpay/api/v1/vouchers/?customer_id=${encodeURIComponent(customerId)}`
        : '/booknpay/api/v1/vouchers/';
      const res = await authedFetch(voucherUrl, {
        method:  'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof data?.detail === 'string'
          ? data.detail
          : JSON.stringify(data);
        throw new Error(detail || `Server error ${res.status}`);
      }
      // Unwrap common API envelopes: { data: {...} }, { result: {...} }, { voucher: {...} }
      // so that createdVoucher always has the ID at the top level.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const voucher: Record<string, any> =
        (data?.data    && typeof data.data    === 'object' && !Array.isArray(data.data))    ? data.data    :
        (data?.result  && typeof data.result  === 'object' && !Array.isArray(data.result))  ? data.result  :
        (data?.voucher && typeof data.voucher === 'object' && !Array.isArray(data.voucher)) ? data.voucher :
        data;
      setCreatedVoucher(voucher);
      setStep(3);
    } catch (err) {
      setCreateVoucherError(err instanceof Error ? err.message : 'Failed to create voucher');
    } finally {
      setIsCreatingVoucher(false);
    }
  };

  // ── Confirm payment (Step 3) ──
  const handleConfirmPayment = async () => {
    if (!createdVoucher) return;
    setIsConfirmingPayment(true);
    setConfirmPaymentError(null);
    try {
      // Resolve IDs
      const voucherId  = (createdVoucher.id ?? createdVoucher.voucher_id ?? createdVoucher.pk ?? '') as string;
      const customerId = (createdVoucher.sender_id ?? sender?.id ?? '') as string;

      if (!voucherId) {
        throw new Error('Voucher ID missing from create response — cannot confirm payment');
      }

      // PATCH voucher status → active with payment details
      const statusPayload = {
        status:       'active',
        payment_data: {
          reference_id:     paymentForm.reference_id,
          trace_id:         paymentForm.trace_id,
          invoice_id:       paymentForm.invoice_id,
          total_amount:     parseFloat(paymentForm.total_amount) || totalPrice,
          transaction_date: paymentForm.transaction_date,
          received_by:      paymentForm.received_by,
          created_by:       currentUser ? String(currentUser.id) : undefined,
        },
        customer_id:  customerId,
      };

      const statusUrl = customerId
        ? `/booknpay/api/v1/vouchers/${voucherId}/status/?customer_id=${encodeURIComponent(customerId)}`
        : `/booknpay/api/v1/vouchers/${voucherId}/status/`;

      const statusRes = await authedFetch(statusUrl, {
        method:  'PATCH',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(statusPayload),
      });
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) {
        const detail = typeof statusData?.detail === 'string'
          ? statusData.detail
          : JSON.stringify(statusData);
        throw new Error(detail || `Status update error ${statusRes.status}`);
      }

      // Done
      setPaymentSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } catch (err) {
      setConfirmPaymentError(err instanceof Error ? err.message : 'Payment confirmation failed');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const updatePaymentField = (field: keyof PaymentFormState) => (v: string) =>
    setPaymentForm(prev => ({ ...prev, [field]: v }));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal shell */}
      <div
        className="relative z-10 flex flex-col w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{
          height: 'min(92vh, 800px)',
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
            <div className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Create Gift Voucher</h2>
              <p className="text-[11px]" style={{ color: B.linen }}>Fill in the details to generate a voucher</p>
            </div>
          </div>
          <button onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Close">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* ── Step bar ── */}
        <StepBar step={step} />

        {/* ── Scrollable body ── */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          style={{ background: B.bg, scrollbarWidth: 'thin', scrollbarColor: `${B.linen} transparent` }}
        >

          {/* ══ STEP 1 ══ */}
          {step === 1 && (
            <>
              {/* Service */}
              <div>
                <SectionLabel icon={Scissors} label="Service" />
                <SearchableDropdown
                  items={services}
                  value={selectedService}
                  onSelect={handleServiceSelect}
                  labelFn={s => s.name}
                  placeholder="Search and select a service…"
                  loading={servicesLoading}
                />
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: B.textMuted }}>
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: B.espresso }} />
                  Loading service details…
                </div>
              )}

              {detailError && (
                <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
                  style={{ borderColor: B.errorBorder, background: B.errorBg }}>
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-xs text-red-600">{detailError}</p>
                </div>
              )}

              {/* Branch */}
              {fullDetail && branches.length > 0 && (
                <div>
                  <SectionLabel icon={MapPin} label="Branch" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {branches.map(b => {
                      const bid   = b.id ?? b.branch_id ?? '';
                      const bname = b.name ?? b.branch_name ?? bid;
                      const active = (selectedBranch?.id ?? selectedBranch?.branch_id) === bid;
                      return (
                        <button
                          key={bid}
                          type="button"
                          onClick={() => { setSelectedBranch(b); setSelectedArrangt(null); setSelectedAddons([]); }}
                          className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all"
                          style={{
                            borderColor: active ? B.espresso : B.linen,
                            background:  active ? B.blush : B.cardBg,
                          }}
                        >
                          <div className="h-4 w-4 rounded-full border-2 grid place-items-center shrink-0 transition"
                            style={{
                              borderColor: active ? B.espresso : B.linen,
                              background:  active ? B.espresso : 'transparent',
                            }}>
                            {active && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <p className="text-sm font-semibold" style={{ color: B.textMain }}>{bname}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Arrangements */}
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
                          onSelect={() => { setSelectedArrangt(arr); setSelectedAddons([]); }}
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
                    {addons.map(addon => (
                      <AddonCheckbox
                        key={addon.id}
                        addon={addon}
                        checked={selectedAddons.some(a => a.id === addon.id)}
                        onChange={checked => toggleAddon(addon, checked)}
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
                  <div className="grid grid-cols-4 gap-2">
                    {EXTRA_TIME_OPTIONS.map(t => {
                      const active = extraTime === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setExtraTime(t)}
                          className="flex flex-col items-center justify-center rounded-2xl border py-3 px-2 transition-all"
                          style={{
                            borderColor: active ? B.espresso : B.linen,
                            background:  active ? B.espresso : B.cardBg,
                            boxShadow:   active ? `0 2px 10px ${B.espresso}30` : undefined,
                          }}
                        >
                          <Timer className="h-4 w-4 mb-1"
                            style={{ color: active ? '#fff' : B.espresso }} />
                          <span className="text-sm font-extrabold"
                            style={{ color: active ? '#fff' : B.textMain }}>
                            {t === 0 ? 'None' : `+${t}`}
                          </span>
                          {t > 0 && (
                            <span className="text-[9px] font-semibold mt-0.5"
                              style={{ color: active ? B.linen : B.textMuted }}>
                              min
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ STEP 2 ══ */}
          {step === 2 && (
            <>
              <CustomerPicker label="Sender (From)" value={sender} onSelect={setSender}
                customers={customers} loading={customersLoading} excludeId={recipient?.id}
                onCreateNew={() => { setCreateForRole('sender'); setShowCreateCustomer(true); }} />

              <CustomerPicker label="Recipient (To)" value={recipient} onSelect={setRecipient}
                customers={customers} loading={customersLoading} excludeId={sender?.id}
                onCreateNew={() => { setCreateForRole('recipient'); setShowCreateCustomer(true); }} />

              {/* Gift message */}
              <div>
                <SectionLabel icon={MessageSquare} label="Gift Message" />
                <textarea
                  value={giftMessage}
                  onChange={e => setGiftMessage(e.target.value)}
                  rows={3}
                  placeholder="Write a personal message for the recipient…"
                  className="w-full rounded-xl border px-4 py-3 text-sm resize-none outline-none transition"
                  style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}
                  onFocus={e => { e.currentTarget.style.borderColor = B.espresso; e.currentTarget.style.boxShadow = `0 0 0 3px ${B.blush}`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = B.linen; e.currentTarget.style.boxShadow = ''; }}
                />
              </div>

              {/* Gift template */}
              <div>
                <SectionLabel icon={Sparkles} label="Gift Template" />
                <div className="flex flex-wrap gap-2">
                  {GIFT_TEMPLATES.map(tpl => {
                    const active = giftTemplate === tpl;
                    return (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => setGiftTemplate(tpl)}
                        className="rounded-xl border px-4 py-2 text-sm font-semibold transition-all"
                        style={{
                          borderColor: active ? B.espresso : B.linen,
                          background:  active ? B.espresso : B.cardBg,
                          color:       active ? '#fff'     : B.textMain,
                        }}
                      >
                        {tpl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Create voucher error */}
              {createVoucherError && (
                <div className="flex items-start gap-2 rounded-xl border px-4 py-3"
                  style={{ borderColor: B.errorBorder, background: B.errorBg }}>
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <p className="text-xs text-red-600">{createVoucherError}</p>
                </div>
              )}
            </>
          )}

          {/* ══ STEP 3 — Payment Confirmation ══ */}
          {step === 3 && (
            <>
              {/* Voucher created banner */}
              <div className="flex items-start gap-3 rounded-2xl border px-4 py-3.5"
                style={{ borderColor: '#a3d9c2', background: B.successBg }}>
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: B.success }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: B.success }}>Voucher Created Successfully</p>
                  {createdVoucher?.id && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#4a9e7a' }}>
                      Voucher ID: <span className="font-mono font-bold">{createdVoucher.id ?? createdVoucher.voucher_id ?? createdVoucher.pk ?? '—'}</span>
                    </p>
                  )}
                  <p className="text-[11px] mt-0.5" style={{ color: '#4a9e7a' }}>
                    Please record the payment details below to activate the voucher.
                  </p>
                </div>
              </div>

              {/* Payment fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <PaymentField
                  icon={Receipt}
                  label="Order Number (Invoice ID)"
                  value={paymentForm.invoice_id}
                  onChange={updatePaymentField('invoice_id')}
                  placeholder="e.g. ORD-00123"
                  required
                />
                <PaymentField
                  icon={Calendar}
                  label="Transaction Date"
                  value={paymentForm.transaction_date}
                  onChange={updatePaymentField('transaction_date')}
                  type="datetime-local"
                  required
                />
                <PaymentField
                  icon={CreditCard}
                  label="Amount Paid"
                  value={paymentForm.total_amount}
                  onChange={updatePaymentField('total_amount')}
                  placeholder={`e.g. ${totalPrice.toFixed(3)}`}
                  type="number"
                  required
                />
                <PaymentField
                  icon={Hash}
                  label="Trace ID"
                  value={paymentForm.trace_id}
                  onChange={updatePaymentField('trace_id')}
                  placeholder="Transaction trace ID"
                />
                <PaymentField
                  icon={Fingerprint}
                  label="KNET Ref ID"
                  value={paymentForm.reference_id}
                  onChange={updatePaymentField('reference_id')}
                  placeholder="KNET reference ID"
                />
                <PaymentField
                  icon={UserCheck}
                  label="Received By"
                  value={paymentForm.received_by}
                  onChange={updatePaymentField('received_by')}
                  placeholder="Staff name or ID"
                  required
                />
              </div>

              {/* Confirm payment error */}
              {confirmPaymentError && (
                <div className="flex items-start gap-2 rounded-xl border px-4 py-3"
                  style={{ borderColor: B.errorBorder, background: B.errorBg }}>
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <p className="text-xs text-red-600">{confirmPaymentError}</p>
                </div>
              )}

              {/* Payment success */}
              {paymentSuccess && (
                <div className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
                  style={{ borderColor: '#a3d9c2', background: B.successBg }}>
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: B.success }} />
                  <p className="text-sm font-bold" style={{ color: B.success }}>
                    Payment confirmed! Voucher is now active.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Summary + nav footer ── */}
        <div className="shrink-0" style={{ borderTop: `1px solid ${B.lineMuted}`, background: B.bg }}>

          {/* Price / duration bar */}
          {selectedService && (
            <div className="flex items-center gap-4 px-6 py-3"
              style={{ borderBottom: `1px solid ${B.lineMuted}` }}>
              <div className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" style={{ color: B.textMuted }} />
                <span className="text-[11px]" style={{ color: B.textMuted }}>Duration:</span>
                <span className="text-sm font-extrabold" style={{ color: B.textMain }}>{totalDuration} min</span>
              </div>
              <div className="h-3 w-px" style={{ background: B.linen }} />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: B.textMuted }}>Total:</span>
                <span className="text-sm font-extrabold" style={{ color: B.espresso }}>
                  {fmtPrice(totalPrice, currency)}
                </span>
              </div>
              {selectedAddons.length > 0 && (
                <>
                  <div className="h-3 w-px" style={{ background: B.linen }} />
                  <span className="text-[10px]" style={{ color: B.textMuted }}>
                    {selectedAddons.length} add-on{selectedAddons.length > 1 ? 's' : ''}
                  </span>
                </>
              )}
              {extraTime > 0 && (
                <>
                  <div className="h-3 w-px" style={{ background: B.linen }} />
                  <span className="text-[10px]" style={{ color: B.textMuted }}>+{extraTime} min extra</span>
                </>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3 px-6 py-4">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
                style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}>
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}

            {/* No back on step 3 — voucher already created */}

            {!paymentSuccess && (
              <button type="button" onClick={onClose}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
                style={{ borderColor: B.linen, background: B.cardBg, color: B.textMain }}>
                Cancel
              </button>
            )}

            <div className="flex-1" />

            {step === 1 && (
              <button
                type="button"
                disabled={!step1Valid}
                onClick={goToStep2}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
                style={{
                  background: step1Valid ? B.espresso : B.linen,
                  color:      step1Valid ? '#fff'     : B.textMuted,
                  cursor:     step1Valid ? 'pointer'  : 'not-allowed',
                  boxShadow:  step1Valid ? `0 2px 12px ${B.espresso}40` : undefined,
                }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!step2Valid || isCreatingVoucher}
                onClick={handleCreateVoucher}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
                style={{
                  background: step2Valid && !isCreatingVoucher ? B.success : B.linen,
                  color:      step2Valid && !isCreatingVoucher ? '#fff'    : B.textMuted,
                  cursor:     step2Valid && !isCreatingVoucher ? 'pointer' : 'not-allowed',
                }}
              >
                {isCreatingVoucher
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : <><Gift className="h-4 w-4" /> Create Voucher</>
                }
              </button>
            )}

            {step === 3 && !paymentSuccess && (
              <button
                type="button"
                disabled={!paymentForm.invoice_id || !paymentForm.transaction_date || !paymentForm.received_by || isConfirmingPayment}
                onClick={handleConfirmPayment}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
                style={{
                  background: (paymentForm.invoice_id && paymentForm.transaction_date && paymentForm.received_by && !isConfirmingPayment) ? B.success : B.linen,
                  color:      (paymentForm.invoice_id && paymentForm.transaction_date && paymentForm.received_by && !isConfirmingPayment) ? '#fff'    : B.textMuted,
                  cursor:     (paymentForm.invoice_id && paymentForm.transaction_date && paymentForm.received_by && !isConfirmingPayment) ? 'pointer' : 'not-allowed',
                }}
              >
                {isConfirmingPayment
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
                  : <><CreditCard className="h-4 w-4" /> Confirm Payment</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Quick-add new customer ── */}
    {showCreateCustomer && (
      <CreateCustomerModal
        authHeader={authHeader}
        onCreated={(created: CreatedCustomer) => {
          const id = String(created.id);
          const fullName = created.full_name || [created.first_name, created.last_name].filter(Boolean).join(' ');
          const asCustomer: Customer = {
            id,
            name:          fullName,
            customer_name: fullName,
            first_name:    created.first_name ?? '',
            last_name:     created.last_name  ?? '',
            phone_number:  created.phone_number,
            phone:         created.phone_number,
            email:         created.email,
            avatar:        created.avatar as string | undefined,
          };
          setCustomers(prev => [asCustomer, ...prev.filter(c => String(c.id) !== id)]);
          if (createForRole === 'sender')    setSender(asCustomer);
          if (createForRole === 'recipient') setRecipient(asCustomer);
        }}
        onClose={() => setShowCreateCustomer(false)}
      />
    )}
    </>
  );
}
