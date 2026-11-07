'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { CreateCustomerModal, type CreatedCustomer } from '@/components/bookings/CreateCustomerModal';
import {
  BookMarked,
  X,
  User,
  Search,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  CreditCard,
  Link2,
  Copy,
  CheckCircle2,
} from 'lucide-react';

export interface Customer {
  id: string;
  name: string;
  customer_name?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  phone?: string;
  email?: string;
  avatar?: string | null;
  [key: string]: unknown;
}

export interface SellCourseModalProps {
  courseId?: string;
  courses?: Record<string, any>[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (subscription: Record<string, any>) => void;
}

// Brand palette matching CreateVoucherModal (#543C30)
const B = {
  espresso: '#543C30',
  espressoHover: '#6b4f41',
  linen: '#dbcdc2',
  blush: '#daccc1',
  lineMuted: '#e8ddd7',
  bg: '#faf7f5',
  cardBg: '#ffffff',
  textMain: '#2c1a12',
  textMuted: '#8a6f63',
  pillBg: '#f2ede9',
} as const;

const ARRANGEMENT_LABELS: Record<string, string> = {
  single_room: 'Single Room',
  couple_room: 'Couple Room',
  double_room: 'Double Room',
  open_area: 'Open Area',
  vip_suite: 'VIP Suite',
  private_suite: 'Private Suite',
  thai_room: 'Thai Room',
  japanese_room: 'Japanese Room',
  other: 'Other',
};

function customerLabel(c: Customer | null | undefined): string {
  if (!c) return '';
  const combined = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return c.name || c.customer_name || combined || String(c.id);
}

function customerPhone(c: Customer | null | undefined): string {
  if (!c) return '';
  return String(c.phone_number || c.phone || '').trim();
}

function CustomerAvatar({ customer, size = 32 }: { customer: Customer; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const rawCustomer = customer as unknown as Record<string, unknown>;
  const avatarSrc =
    typeof customer.avatar === 'string' && customer.avatar.trim()
      ? customer.avatar.trim()
      : typeof rawCustomer.avatar_url === 'string' && rawCustomer.avatar_url.trim()
      ? String(rawCustomer.avatar_url).trim()
      : typeof rawCustomer.photo === 'string' && rawCustomer.photo.trim()
      ? String(rawCustomer.photo).trim()
      : typeof rawCustomer.profile_image === 'string' && rawCustomer.profile_image.trim()
      ? String(rawCustomer.profile_image).trim()
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

function CustomerPicker({
  label,
  value,
  onSelect,
  onClear,
  onCreateNew,
  authHeader,
}: {
  label: string;
  value: Customer | null;
  onSelect: (c: Customer) => void;
  onClear?: () => void;
  onCreateNew?: () => void;
  authHeader: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({ page_size: '35' });
        if (q.trim()) qs.set('search', q.trim());
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (authHeader) headers.Authorization = authHeader;

        const res = await authedFetch(`/api/v1/customers/?${qs.toString()}`, { headers });
        const data = await res.json().catch(() => ({}));
        const rawList: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : data.results ?? data.data ?? [];

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
    if (value && !list.some((c) => c.id === value.id)) {
      list = [value, ...list];
    }
    return list;
  }, [customers, value]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: B.textMuted }}
        >
          {label}
        </label>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer"
            style={{ color: B.espresso }}
          >
            + New Customer
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition cursor-pointer"
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
            {onClear && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-1 hover:bg-black/10 rounded-full transition cursor-pointer"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
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
            <div
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: B.bg }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: B.textMuted }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or phone…"
                className="flex-1 bg-transparent text-sm outline-none font-medium"
                style={{ color: B.textMain }}
              />
              {searching && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: B.textMuted }} />
              )}
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
                          <p className="text-[10px] text-muted-foreground truncate">
                            {customerPhone(c)}
                          </p>
                        )}
                      </div>
                      {active && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: B.espresso }} />
                      )}
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

export function SellCourseModal({
  courseId = '',
  courses: initialCourses,
  isOpen,
  onClose,
  onSuccess,
}: SellCourseModalProps) {
  const [courses, setCourses] = useState<Record<string, any>[]>(initialCourses || []);
  const [loadingCourses, setLoadingCourses] = useState(!initialCourses || initialCourses.length === 0);

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [sellForm, setSellForm] = useState({
    customer_id: '',
    course_id: courseId,
    payment_option: 'pay_at_desk' as 'pay_at_desk' | 'payment_link',
    payment_gateway: 'myfatoorah' as 'myfatoorah' | 'tap' | 'deema',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success sub-modals (pay at desk confirmation / payment link)
  const [confirmPaymentSub, setConfirmPaymentSub] = useState<Record<string, any> | null>(null);
  const [paymentLinkSub, setPaymentLinkSub] = useState<Record<string, any> | null>(null);
  const [paymentProvider, setPaymentProvider] = useState('knet_pos');
  const [paymentMethod, setPaymentMethod] = useState('knet');
  const [txRef, setTxRef] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const authHeader = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const t =
      localStorage.getItem('ush_access_token') ||
      localStorage.getItem('access_token') ||
      '';
    return t ? `Bearer ${t}` : '';
  }, []);

  // Update selected course if courseId prop changes
  useEffect(() => {
    if (courseId) {
      setSellForm((prev) => ({ ...prev, course_id: courseId }));
    }
  }, [courseId]);

  // Load active courses if not provided
  useEffect(() => {
    if (initialCourses && initialCourses.length > 0) {
      setCourses(initialCourses);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingCourses(true);
      try {
        const res = await authedFetch('/api/v1/courses?status=active');
        const json = await res.json().catch(() => ({}));
        const raw = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.results)
          ? json.results
          : Array.isArray(json)
          ? json
          : [];
        if (mounted) setCourses(raw);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingCourses(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initialCourses]);

  const activeCourses = useMemo(() => {
    return courses.filter((c) => c.status === 'active' || !c.status);
  }, [courses]);

  const selectedSellCourse = useMemo(() => {
    return courses.find((c) => String(c.id) === String(sellForm.course_id)) || null;
  }, [courses, sellForm.course_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const effectiveCustomerId = selectedCustomer?.id || sellForm.customer_id;
    if (!effectiveCustomerId) {
      setError('Please select or create a customer.');
      return;
    }
    if (!sellForm.course_id) {
      setError('Please select a course package.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        customer_id: effectiveCustomerId,
        course_id: sellForm.course_id,
        payment_option: sellForm.payment_option,
        notes: sellForm.notes.trim() || null,
      };
      if (sellForm.payment_option === 'payment_link') {
        payload.payment_gateway = sellForm.payment_gateway;
      }

      const res = await authedFetch('/booknpay/api/v1/course-subscriptions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json?.error?.message ||
          json?.detail ||
          json?.message ||
          'Failed to create course subscription.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        return;
      }

      const created = json?.data || json;
      if (onSuccess) onSuccess(created);

      if (sellForm.payment_option === 'pay_at_desk') {
        setConfirmPaymentSub(created);
      } else if (created?.payment_url) {
        setPaymentLinkSub(created);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error selling course.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeskPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPaymentSub) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${confirmPaymentSub.id}/confirm-payment/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_provider: paymentProvider,
            payment_method: paymentMethod,
            transaction_reference: txRef.trim() || undefined,
            payment_through: 'ushdesk',
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.detail || json?.message || 'Failed to confirm payment.'
        );
      }
      if (onSuccess) onSuccess(json?.data || json);
      setConfirmPaymentSub(null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment confirmation failed.');
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div
          className="relative z-10 flex flex-col w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl transition-all duration-200"
          style={{
            maxHeight: 'min(92vh, 860px)',
            background: B.cardBg,
            border: `1.5px solid ${B.linen}`,
          }}
        >
          {/* Header with #543C30 */}
          <div
            className="shrink-0 flex items-center justify-between gap-4 px-6 py-4"
            style={{ background: B.espresso }}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <BookMarked className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Sell Course Subscription</h3>
                <p className="text-[11px]" style={{ color: B.linen }}>
                  Assign a course package to a customer and collect payment at desk or via link
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

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 overflow-y-auto"
            style={{ background: B.bg }}
          >
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Customer Section — Exactly matching Gift Voucher To & From */}
            <div
              className="rounded-2xl p-4 border space-y-3"
              style={{ background: B.cardBg, borderColor: B.linen }}
            >
              <div className="space-y-1">
                <label
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Customer *
                </label>
                <div
                  className="flex items-center gap-2.5 rounded-xl border p-2.5 transition"
                  style={{ borderColor: B.linen, background: B.cardBg }}
                >
                  <User className="h-4 w-4 shrink-0" style={{ color: B.textMuted }} />
                  <input
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedCustomer(null);
                        setSellForm((p) => ({ ...p, customer_id: '' }));
                      }
                    }}
                    placeholder="Customer full name"
                    className="flex-1 bg-transparent text-sm outline-none font-medium"
                    style={{ color: B.textMain }}
                    required
                  />
                </div>
              </div>

              {/* Or Pick from Customer Database */}
              <div className="pt-2 border-t" style={{ borderColor: B.lineMuted }}>
                <CustomerPicker
                  label="Or pick from customer database"
                  value={selectedCustomer}
                  onSelect={(c) => {
                    setSelectedCustomer(c);
                    setCustomerName(customerLabel(c));
                    setSellForm((prev) => ({ ...prev, customer_id: c.id }));
                  }}
                  onClear={() => {
                    setSelectedCustomer(null);
                    setCustomerName('');
                    setSellForm((prev) => ({ ...prev, customer_id: '' }));
                  }}
                  onCreateNew={() => setShowCreateCustomer(true)}
                  authHeader={authHeader}
                />
              </div>
            </div>

            {/* Course Package Picker */}
            <div>
              <label
                className="block text-xs font-extrabold uppercase tracking-wider mb-1.5"
                style={{ color: B.espresso }}
              >
                Course Package *
              </label>
              <select
                value={sellForm.course_id}
                onChange={(e) => setSellForm((p) => ({ ...p, course_id: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm focus:outline-none"
                style={{ borderColor: B.linen, color: B.textMain }}
                required
              >
                <option value="">
                  {loadingCourses ? 'Loading courses...' : 'Select Active Course...'}
                </option>
                {activeCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name_en || c.name} — {c.total_sessions} sessions ·{' '}
                    {Number(c.price || 0).toFixed(3)} {c.currency || 'KWD'}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Course Snapshot */}
            {selectedSellCourse && (
              <div
                className="rounded-xl p-4 border text-xs space-y-1.5"
                style={{ background: B.cardBg, borderColor: B.linen }}
              >
                <div className="flex justify-between">
                  <span style={{ color: B.textMuted }}>Locked Service</span>
                  <span className="font-semibold" style={{ color: B.textMain }}>
                    {selectedSellCourse.service?.name || 'Service'} (
                    {selectedSellCourse.service?.duration_minutes || 60} mins)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: B.textMuted }}>Room Arrangement</span>
                  <span className="font-semibold" style={{ color: B.espresso }}>
                    {ARRANGEMENT_LABELS[selectedSellCourse.arrangement_type] ||
                      selectedSellCourse.arrangement_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: B.textMuted }}>Sessions & Validity</span>
                  <span className="font-semibold" style={{ color: B.textMain }}>
                    {selectedSellCourse.total_sessions} sessions · Valid for{' '}
                    {selectedSellCourse.validity_days} days
                  </span>
                </div>
                <div
                  className="flex justify-between pt-1 border-t"
                  style={{ borderColor: B.linen }}
                >
                  <span className="font-semibold" style={{ color: B.textMuted }}>
                    Total Package Price
                  </span>
                  <span className="text-sm font-bold" style={{ color: B.espresso }}>
                    {Number(selectedSellCourse.price || 0).toFixed(3)}{' '}
                    {selectedSellCourse.currency || 'KWD'}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Option */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSellForm((p) => ({ ...p, payment_option: 'pay_at_desk' }))}
                className="p-3.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor: sellForm.payment_option === 'pay_at_desk' ? B.espresso : B.linen,
                  background: sellForm.payment_option === 'pay_at_desk' ? B.blush : B.cardBg,
                  color: B.textMain,
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CreditCard className="w-4 h-4" style={{ color: B.espresso }} />
                  Pay at Desk
                </div>
                <p className="text-[11px] mt-1" style={{ color: B.textMuted }}>
                  Collect via KNET POS, Cash, or Card right now
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSellForm((p) => ({ ...p, payment_option: 'payment_link' }))}
                className="p-3.5 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor: sellForm.payment_option === 'payment_link' ? B.espresso : B.linen,
                  background: sellForm.payment_option === 'payment_link' ? B.blush : B.cardBg,
                  color: B.textMain,
                }}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Link2 className="w-4 h-4" style={{ color: B.espresso }} />
                  Send Payment Link
                </div>
                <p className="text-[11px] mt-1" style={{ color: B.textMuted }}>
                  Generate online payment link (MyFatoorah / Tap)
                </p>
              </button>
            </div>

            {sellForm.payment_option === 'payment_link' && (
              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Payment Gateway
                </label>
                <select
                  value={sellForm.payment_gateway}
                  onChange={(e) =>
                    setSellForm((p) => ({
                      ...p,
                      payment_gateway: e.target.value as 'myfatoorah' | 'tap' | 'deema',
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm focus:outline-none"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  <option value="myfatoorah">MyFatoorah</option>
                  <option value="tap">Tap Payments</option>
                  <option value="deema">Deema</option>
                </select>
              </div>
            )}

            <div>
              <label
                className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                style={{ color: B.espresso }}
              >
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={sellForm.notes}
                onChange={(e) => setSellForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional sale remarks..."
                className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm focus:outline-none"
                style={{ borderColor: B.linen, color: B.textMain }}
              />
            </div>

            <div
              className="flex items-center justify-end gap-3 pt-3 border-t"
              style={{ borderColor: B.linen }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                style={{ borderColor: B.linen, color: B.textMain }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                style={{ background: B.espresso }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                {sellForm.payment_option === 'pay_at_desk'
                  ? 'Create & Proceed to Desk Payment'
                  : 'Create & Generate Link'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      {showCreateCustomer && (
        <CreateCustomerModal
          authHeader={authHeader}
          onClose={() => setShowCreateCustomer(false)}
          onCreated={(newCustomer: CreatedCustomer) => {
            setShowCreateCustomer(false);
            if (newCustomer?.id) {
              const fullName =
                newCustomer.full_name ||
                [newCustomer.first_name, newCustomer.last_name].filter(Boolean).join(' ') ||
                'New Customer';
              const asCust: Customer = {
                id: String(newCustomer.id),
                name: fullName,
                customer_name: fullName,
                first_name: newCustomer.first_name,
                last_name: newCustomer.last_name,
                phone_number: newCustomer.phone_number,
                phone: newCustomer.phone_number,
                email: newCustomer.email,
                avatar: newCustomer.avatar,
              };
              setSelectedCustomer(asCust);
              setCustomerName(fullName);
              setSellForm((prev) => ({ ...prev, customer_id: asCust.id }));
            }
          }}
        />
      )}

      {/* CONFIRM DESK PAYMENT MODAL */}
      {confirmPaymentSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-md overflow-hidden"
            style={{ borderColor: B.linen }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Confirm Desk Payment</h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    {confirmPaymentSub.subscription_number} ·{' '}
                    {Number(confirmPaymentSub.price || 0).toFixed(3)}{' '}
                    {confirmPaymentSub.currency || 'KWD'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmPaymentSub(null);
                  onClose();
                }}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmDeskPayment}
              className="p-6 space-y-4"
              style={{ background: B.bg }}
            >
              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Payment Provider *
                </label>
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  <option value="knet_pos">KNET POS Terminal</option>
                  <option value="other">Cash / Manual</option>
                  <option value="myfatoorah">MyFatoorah</option>
                  <option value="tap">Tap</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  <option value="knet">KNET</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit Card (Visa/Mastercard)</option>
                  <option value="apple_pay">Apple Pay</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  POS / Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="e.g. POS-AUTH-982134"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm font-mono"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
              </div>

              <div
                className="flex items-center justify-end gap-3 pt-3 border-t"
                style={{ borderColor: B.linen }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setConfirmPaymentSub(null);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  disabled={confirming}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                  style={{ background: B.espresso }}
                >
                  {confirming && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT LINK MODAL */}
      {paymentLinkSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-md overflow-hidden"
            style={{ borderColor: B.linen }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Payment Link Ready</h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    {paymentLinkSub.subscription_number} ·{' '}
                    {Number(paymentLinkSub.price || 0).toFixed(3)}{' '}
                    {paymentLinkSub.currency || 'KWD'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPaymentLinkSub(null);
                  onClose();
                }}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4" style={{ background: B.bg }}>
              <p className="text-xs" style={{ color: B.textMuted }}>
                Share this link with the customer to collect payment online. The subscription will
                automatically activate once payment succeeds.
              </p>

              <div
                className="flex items-center gap-2 p-3 rounded-xl border bg-white"
                style={{ borderColor: B.linen }}
              >
                <input
                  type="text"
                  readOnly
                  value={paymentLinkSub.payment_url || ''}
                  className="flex-1 bg-transparent text-xs font-mono outline-none truncate"
                  style={{ color: B.textMain }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (paymentLinkSub.payment_url) {
                      navigator.clipboard.writeText(paymentLinkSub.payment_url);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  style={{ background: B.pillBg, color: B.espresso }}
                >
                  {copiedLink ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentLinkSub(null);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 cursor-pointer shadow-sm"
                  style={{ background: B.espresso }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
