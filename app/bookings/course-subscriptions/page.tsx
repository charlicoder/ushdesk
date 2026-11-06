'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/shell';
import { authedFetch } from '@/lib/authedFetch';
import { RedeemCourseModal } from '@/components/bookings/RedeemCourseModal';
import { CreateCustomerModal, type CreatedCustomer } from '@/components/bookings/CreateCustomerModal';
import {
  BookMarked,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Link2,
  Copy,
  Eye,
  RotateCcw,
  Ban,
  CalendarPlus,
  Layers,
  UserPlus,
  Loader2,
  X,
  Sparkles,
  Receipt,
} from 'lucide-react';

// Brand palette (#543C30)
const B = {
  espresso: '#543C30',
  espressoHover: '#6b4f41',
  linen: '#dbcdc2',
  blush: '#daccc1',
  bg: '#faf7f5',
  cardBg: '#ffffff',
  textMain: '#2c1a12',
  textMuted: '#8a6f63',
  pillBg: '#f2ede9',
} as const;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  payment_pending: {
    label: 'Payment Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  payment_failed: {
    label: 'Payment Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  exhausted: {
    label: 'Exhausted',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  expired: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-stone-100 text-stone-600 border-stone-200',
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

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

function CourseSubscriptionsContent() {
  const searchParams = useSearchParams();
  const initialSellCourseId = searchParams.get('sell_course_id') || '';

  const [subscriptions, setSubscriptions] = useState<Record<string, any>[]>([]);
  const [courses, setCourses] = useState<Record<string, any>[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');

  // Modals
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [detailSub, setDetailSub] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmPaymentSub, setConfirmPaymentSub] = useState<Record<string, any> | null>(null);
  const [paymentLinkSub, setPaymentLinkSub] = useState<Record<string, any> | null>(null);
  const [cancelSub, setCancelSub] = useState<Record<string, any> | null>(null);
  const [refundSub, setRefundSub] = useState<Record<string, any> | null>(null);
  const [redeemSub, setRedeemSub] = useState<Record<string, any> | null>(null);

  // Sell form state
  const [sellForm, setSellForm] = useState({
    customer_id: '',
    course_id: initialSellCourseId,
    payment_option: 'pay_at_desk' as 'pay_at_desk' | 'payment_link',
    payment_gateway: 'myfatoorah' as 'myfatoorah' | 'tap' | 'deema',
    notes: '',
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  // Action modal form state
  const [confirmForm, setConfirmForm] = useState({
    payment_provider: 'knet_pos',
    payment_method: 'knet',
    transaction_reference: '',
  });
  const [paymentLinkGateway, setPaymentLinkGateway] = useState('myfatoorah');
  const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundForm, setRefundForm] = useState({
    reason: '',
    refund_method: 'knet',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page_size', '100');
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (courseFilter !== 'all') qs.set('course_id', courseFilter);
      if (search.trim()) qs.set('search', search.trim());

      const res = await authedFetch(`/booknpay/api/v1/course-subscriptions/?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.detail || json?.message || 'Failed to load subscriptions'
        );
      }
      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.results)
        ? json.results
        : Array.isArray(json)
        ? json
        : [];
      setSubscriptions(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load course subscriptions.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, courseFilter, search]);

  const loadCatalogAndCustomers = useCallback(async () => {
    try {
      const [crsRes, custRes] = await Promise.all([
        authedFetch('/api/v1/courses?all=true'),
        authedFetch('/api/v1/customers?page_size=200'),
      ]);
      const crsJson = await crsRes.json().catch(() => ({}));
      const custJson = await custRes.json().catch(() => ({}));

      const crsList = Array.isArray(crsJson?.data)
        ? crsJson.data
        : Array.isArray(crsJson?.results)
        ? crsJson.results
        : Array.isArray(crsJson)
        ? crsJson
        : [];
      const custList = Array.isArray(custJson?.data)
        ? custJson.data
        : Array.isArray(custJson?.results)
        ? custJson.results
        : Array.isArray(custJson)
        ? custJson
        : [];

      setCourses(crsList);
      setCustomers(custList);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    loadCatalogAndCustomers();
  }, [loadCatalogAndCustomers]);

  useEffect(() => {
    if (initialSellCourseId) {
      setSellForm((prev) => ({ ...prev, course_id: initialSellCourseId }));
      setSellModalOpen(true);
    }
  }, [initialSellCourseId]);

  const openDetailModal = async (sub: Record<string, any>) => {
    setDetailSub(sub);
    setDetailLoading(true);
    try {
      const res = await authedFetch(`/booknpay/api/v1/course-subscriptions/${sub.id}/`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.data) {
        setDetailSub(json.data);
      }
    } catch {
      // keep initial snapshot
    } finally {
      setDetailLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = subscriptions.length;
    const active = subscriptions.filter(
      (s) => (s.effective_status || s.status) === 'active'
    ).length;
    const pending = subscriptions.filter((s) => s.status === 'payment_pending').length;
    const totalAvailableSessions = subscriptions
      .filter((s) => (s.effective_status || s.status) === 'active')
      .reduce((acc, s) => acc + (Number(s.available_sessions) || 0), 0);
    return { total, active, pending, totalAvailableSessions };
  }, [subscriptions]);

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''} ${c.name || ''}`.toLowerCase();
      const phone = String(c.phone_number || c.phone || '').toLowerCase();
      return fullName.includes(q) || phone.includes(q);
    });
  }, [customers, customerSearch]);

  const selectedSellCourse = useMemo(
    () => courses.find((c) => String(c.id) === String(sellForm.course_id)),
    [courses, sellForm.course_id]
  );

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);

    if (!sellForm.customer_id) {
      setSellError('Please select a customer.');
      return;
    }
    if (!sellForm.course_id) {
      setSellError('Please select a course package.');
      return;
    }

    setSellSubmitting(true);
    try {
      const payload: Record<string, any> = {
        customer_id: sellForm.customer_id,
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
        setSellError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        return;
      }

      const created = json?.data || json;
      setSellModalOpen(false);
      await loadSubscriptions();

      if (sellForm.payment_option === 'pay_at_desk') {
        setConfirmForm({
          payment_provider: 'knet_pos',
          payment_method: 'knet',
          transaction_reference: '',
        });
        setActionError(null);
        setConfirmPaymentSub(created);
      } else if (created?.payment_url) {
        setGeneratedPaymentUrl(created.payment_url);
        setPaymentLinkSub(created);
      }
    } catch (err: unknown) {
      setSellError(err instanceof Error ? err.message : 'Network error selling course.');
    } finally {
      setSellSubmitting(false);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPaymentSub) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${confirmPaymentSub.id}/confirm-payment/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_provider: confirmForm.payment_provider,
            payment_method: confirmForm.payment_method,
            transaction_reference: confirmForm.transaction_reference.trim() || undefined,
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
      setConfirmPaymentSub(null);
      await loadSubscriptions();
      if (detailSub && detailSub.id === confirmPaymentSub.id && json?.data) {
        setDetailSub(json.data);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error confirming payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGeneratePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentLinkSub) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${paymentLinkSub.id}/payment-link/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_gateway: paymentLinkGateway }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.detail || json?.message || 'Failed to generate payment link.'
        );
      }
      const updated = json?.data || json;
      setGeneratedPaymentUrl(updated?.payment_url || null);
      setPaymentLinkSub(updated);
      await loadSubscriptions();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error generating payment link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelSub) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${cancelSub.id}/cancel/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cancelReason.trim() || 'Cancelled at desk' }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.detail || json?.message || 'Failed to cancel subscription.'
        );
      }
      setCancelSub(null);
      setCancelReason('');
      await loadSubscriptions();
      if (detailSub && detailSub.id === cancelSub.id) {
        openDetailModal(cancelSub);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error cancelling subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundSub) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/${refundSub.id}/refund/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: refundForm.reason.trim() || 'Customer requested full refund',
            refund_method: refundForm.refund_method,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.error?.message || json?.detail || json?.message || 'Failed to refund subscription.'
        );
      }
      setRefundSub(null);
      setRefundForm({ reason: '', refund_method: 'knet' });
      await loadSubscriptions();
      if (detailSub && detailSub.id === refundSub.id) {
        openDetailModal(refundSub);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error refunding subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCustomerName = (sub: Record<string, any>) => {
    const cd = sub.customer_data;
    if (cd?.name) return cd.name;
    if (cd?.first_name || cd?.last_name) {
      return `${cd.first_name || ''} ${cd.last_name || ''}`.trim();
    }
    return sub.customer_id;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-sm"
            style={{ background: B.espresso }}
          >
            <BookMarked className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: B.textMain }}>
              Course Subscriptions
            </h1>
            <p className="text-sm" style={{ color: B.textMuted }}>
              Sell courses, confirm desk payments, track session balances, and book redemption sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSubscriptions}
            className="px-3.5 py-2.5 rounded-xl border bg-white text-sm font-medium hover:bg-[#faf7f5] flex items-center gap-2 transition-colors cursor-pointer"
            style={{ borderColor: B.linen, color: B.espresso }}
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              style={{ color: B.espresso }}
            />
            Refresh
          </button>
          <Link
            href="/courses"
            className="px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors"
            style={{
              borderColor: B.linen,
              background: B.pillBg,
              color: B.espresso,
            }}
          >
            <Layers className="w-4 h-4" style={{ color: B.espresso }} />
            Course Catalog
          </Link>
          <button
            onClick={() => {
              setSellError(null);
              if (!sellForm.course_id && activeCourses[0]?.id) {
                setSellForm((p) => ({ ...p, course_id: String(activeCourses[0].id) }));
              }
              setSellModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            style={{ background: B.espresso }}
          >
            <Plus className="w-4 h-4 text-white" />
            Sell Course
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="bg-white rounded-2xl p-5 border shadow-sm"
          style={{ borderColor: B.linen }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: B.textMuted }}
            >
              Total Subscriptions
            </span>
            <BookMarked className="w-4 h-4" style={{ color: B.espresso }} />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: B.textMain }}>
            {stats.total}
          </p>
          <p className="text-xs mt-1" style={{ color: B.textMuted }}>
            All sold course packages
          </p>
        </div>

        <div
          className="bg-white rounded-2xl p-5 border shadow-sm"
          style={{ borderColor: B.linen }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: B.textMuted }}
            >
              Active Subscriptions
            </span>
            <CheckCircle2 className="w-4 h-4" style={{ color: B.espresso }} />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: B.espresso }}>
            {stats.active}
          </p>
          <p className="text-xs mt-1" style={{ color: B.textMuted }}>
            Ready for session redemption
          </p>
        </div>

        <div
          className="bg-white rounded-2xl p-5 border shadow-sm"
          style={{ borderColor: B.linen }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: B.textMuted }}
            >
              Pending Payment
            </span>
            <Clock className="w-4 h-4" style={{ color: B.espresso }} />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: B.textMain }}>
            {stats.pending}
          </p>
          <p className="text-xs mt-1" style={{ color: B.textMuted }}>
            Awaiting desk POS or payment link
          </p>
        </div>

        <div
          className="bg-white rounded-2xl p-5 border shadow-sm"
          style={{ borderColor: B.linen }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: B.textMuted }}
            >
              Available Sessions
            </span>
            <Sparkles className="w-4 h-4" style={{ color: B.espresso }} />
          </div>
          <p className="text-2xl font-bold mt-2" style={{ color: B.textMain }}>
            {stats.totalAvailableSessions}
          </p>
          <p className="text-xs mt-1" style={{ color: B.textMuted }}>
            Unredeemed sessions across active packages
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-4 border shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3"
        style={{ borderColor: B.linen }}
      >
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: B.espresso }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subscription #, course name, service, or code..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none"
            style={{ borderColor: B.linen, color: B.textMain }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border bg-white text-sm focus:outline-none"
          style={{ borderColor: B.linen, color: B.textMain }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="payment_pending">Payment Pending</option>
          <option value="payment_failed">Payment Failed</option>
          <option value="exhausted">Exhausted</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border bg-white text-sm focus:outline-none"
          style={{ borderColor: B.linen, color: B.textMain }}
        >
          <option value="all">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name_en || c.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: B.linen }}
      >
        {loading ? (
          <div
            className="p-12 text-center flex flex-col items-center gap-3"
            style={{ color: B.textMuted }}
          >
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: B.espresso }} />
            <span className="text-sm">Loading course subscriptions...</span>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div
              className="w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto"
              style={{ background: B.bg, borderColor: B.linen, color: B.espresso }}
            >
              <BookMarked className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold" style={{ color: B.textMain }}>
              No course subscriptions found
            </h3>
            <p className="text-xs max-w-md mx-auto" style={{ color: B.textMuted }}>
              Sell a course package to a customer to start tracking prepaid sessions and booking
              zero-due course redemptions.
            </p>
            <button
              onClick={() => setSellModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer"
              style={{ background: B.espresso }}
            >
              <Plus className="w-4 h-4 text-white" />
              Sell Course Package
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    background: B.bg,
                    borderColor: B.linen,
                    color: B.textMuted,
                  }}
                >
                  <th className="py-3.5 px-4">Subscription #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Course & Service</th>
                  <th className="py-3.5 px-4">Session Balance</th>
                  <th className="py-3.5 px-4">Price & Invoice</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm" style={{ borderColor: B.linen }}>
                {subscriptions.map((sub) => {
                  const effStatus = sub.effective_status || sub.status;
                  const badge = STATUS_BADGES[effStatus] || {
                    label: effStatus,
                    className: 'bg-gray-100 text-gray-700 border-gray-200',
                  };
                  const total = Number(sub.total_sessions) || 1;
                  const used = Number(sub.used_sessions) || 0;
                  const reserved = Number(sub.reserved_sessions) || 0;
                  const avail = Number(sub.available_sessions) || 0;
                  const usedPct = Math.min(100, Math.round(((used + reserved) / total) * 100));

                  const canConfirm =
                    sub.status === 'payment_pending' || sub.status === 'payment_failed';
                  const canRedeem =
                    Boolean(sub.is_redeemable) || (effStatus === 'active' && avail > 0);
                  const canRefund =
                    (sub.status === 'active' || sub.status === 'expired') &&
                    used === 0 &&
                    reserved === 0;

                  return (
                    <tr key={sub.id} className="hover:bg-[#faf7f5]/80 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => openDetailModal(sub)}
                          className="font-mono text-xs font-bold underline decoration-dotted cursor-pointer"
                          style={{ color: B.espresso }}
                        >
                          {sub.subscription_number}
                        </button>
                        <div className="text-[11px] mt-0.5" style={{ color: B.textMuted }}>
                          {sub.purchased_at
                            ? new Date(sub.purchased_at).toLocaleDateString()
                            : ''}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-semibold" style={{ color: B.textMain }}>
                          {formatCustomerName(sub)}
                        </div>
                        {sub.customer_data?.phone_number && (
                          <div className="text-xs" style={{ color: B.textMuted }}>
                            {sub.customer_data.phone_number}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium" style={{ color: B.textMain }}>
                          {sub.course_name}{' '}
                          <span className="font-mono text-xs" style={{ color: B.textMuted }}>
                            ({sub.course_code})
                          </span>
                        </div>
                        <div
                          className="text-xs flex items-center gap-1.5 mt-0.5"
                          style={{ color: B.textMuted }}
                        >
                          <span>{sub.service_name}</span>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: B.espresso }}>
                            {ARRANGEMENT_LABELS[sub.arrangement_type] || sub.arrangement_type}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold" style={{ color: B.textMain }}>
                            {avail} / {total} left
                          </span>
                          <span style={{ color: B.textMuted }}>
                            {used} used{reserved > 0 ? `, ${reserved} booked` : ''}
                          </span>
                        </div>
                        <div
                          className="w-full h-2 rounded-full overflow-hidden"
                          style={{ background: B.linen }}
                        >
                          <div
                            className="h-full transition-all"
                            style={{ width: `${usedPct}%`, background: B.espresso }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold" style={{ color: B.textMain }}>
                          {Number(sub.price || 0).toFixed(3)} {sub.currency || 'KWD'}
                        </div>
                        {sub.invoice_number && (
                          <div className="text-[11px] font-mono" style={{ color: B.textMuted }}>
                            {sub.invoice_number}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs" style={{ color: B.textMain }}>
                        {sub.expires_at ? (
                          <div>
                            <div>Exp: {new Date(sub.expires_at).toLocaleDateString()}</div>
                            {sub.is_expired && (
                              <span className="text-[11px] text-red-600 font-semibold">
                                Expired
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: B.textMuted }}>Upon activation</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canRedeem && (
                            <button
                              onClick={() => setRedeemSub(sub)}
                              className="px-2.5 py-1.5 rounded-lg text-white hover:opacity-95 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              style={{ background: B.espresso }}
                              title="Book a session using this course"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 text-white" />
                              Book Session
                            </button>
                          )}

                          {canConfirm && (
                            <>
                              <button
                                onClick={() => {
                                  setConfirmForm({
                                    payment_provider: 'knet_pos',
                                    payment_method: 'knet',
                                    transaction_reference: '',
                                  });
                                  setActionError(null);
                                  setConfirmPaymentSub(sub);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-white hover:opacity-95 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                style={{ background: B.espresso }}
                                title="Confirm Desk Payment"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-white" />
                                Pay
                              </button>
                              <button
                                onClick={() => {
                                  setActionError(null);
                                  setGeneratedPaymentUrl(sub.payment_url || null);
                                  setPaymentLinkSub(sub);
                                }}
                                className="p-1.5 rounded-lg border hover:bg-[#faf7f5] cursor-pointer"
                                style={{ borderColor: B.linen, color: B.espresso }}
                                title="Payment Link"
                              >
                                <Link2 className="w-4 h-4" style={{ color: B.espresso }} />
                              </button>
                              <button
                                onClick={() => {
                                  setActionError(null);
                                  setCancelReason('');
                                  setCancelSub(sub);
                                }}
                                className="p-1.5 rounded-lg border hover:bg-[#faf7f5] cursor-pointer"
                                style={{ borderColor: B.linen, color: B.espresso }}
                                title="Cancel Unpaid Subscription"
                              >
                                <Ban className="w-4 h-4" style={{ color: B.espresso }} />
                              </button>
                            </>
                          )}

                          {canRefund && (
                            <button
                              onClick={() => {
                                setActionError(null);
                                setRefundForm({ reason: '', refund_method: 'knet' });
                                setRefundSub(sub);
                              }}
                              className="p-1.5 rounded-lg border hover:bg-[#faf7f5] cursor-pointer"
                              style={{ borderColor: B.linen, color: B.espresso }}
                              title="Refund Unused Course"
                            >
                              <RotateCcw className="w-4 h-4" style={{ color: B.espresso }} />
                            </button>
                          )}

                          <button
                            onClick={() => openDetailModal(sub)}
                            className="p-1.5 rounded-lg border hover:bg-[#faf7f5] cursor-pointer"
                            style={{ borderColor: B.linen, color: B.espresso }}
                            title="View Details & Session History"
                          >
                            <Eye className="w-4 h-4" style={{ color: B.espresso }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SELL COURSE MODAL */}
      {sellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-xl overflow-hidden"
            style={{ borderColor: B.linen }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <BookMarked className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Sell Course Subscription</h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    Assign a course package to a customer and collect payment at desk or via link
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSellModalOpen(false)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSellSubmit}
              className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
              style={{ background: B.bg }}
            >
              {sellError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sellError}</span>
                </div>
              )}

              {/* Customer Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-extrabold uppercase tracking-wider"
                    style={{ color: B.espresso }}
                  >
                    Customer *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateCustomerOpen(true)}
                    className="text-xs font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    style={{ color: B.espresso }}
                  >
                    <UserPlus className="w-3.5 h-3.5" style={{ color: B.espresso }} />
                    + New Customer
                  </button>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Filter customer by name or phone..."
                  className="w-full px-3.5 py-2 mb-2 rounded-xl border bg-white text-xs focus:outline-none"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
                <select
                  value={sellForm.customer_id}
                  onChange={(e) => setSellForm((p) => ({ ...p, customer_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm focus:outline-none"
                  style={{ borderColor: B.linen, color: B.textMain }}
                  required
                >
                  <option value="">Select Customer...</option>
                  {filteredCustomers.map((c) => {
                    const name =
                      c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.id;
                    const phone = c.phone_number || c.phone || '';
                    return (
                      <option key={c.id} value={c.id}>
                        {name} {phone ? `— ${phone}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Course Picker */}
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
                  <option value="">Select Active Course...</option>
                  {activeCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.name_en || c.name} — {c.total_sessions} sessions ·{' '}
                      {Number(c.price || 0).toFixed(3)} {c.currency || 'KWD'}
                    </option>
                  ))}
                </select>
              </div>

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
                    borderColor:
                      sellForm.payment_option === 'pay_at_desk' ? B.espresso : B.linen,
                    background:
                      sellForm.payment_option === 'pay_at_desk' ? B.blush : B.cardBg,
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
                    borderColor:
                      sellForm.payment_option === 'payment_link' ? B.espresso : B.linen,
                    background:
                      sellForm.payment_option === 'payment_link' ? B.blush : B.cardBg,
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
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
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
                  className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
              </div>

              <div
                className="flex items-center justify-end gap-3 pt-3 border-t"
                style={{ borderColor: B.linen }}
              >
                <button
                  type="button"
                  onClick={() => setSellModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sellSubmitting}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  style={{ background: B.espresso }}
                >
                  {sellSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {sellForm.payment_option === 'pay_at_desk'
                    ? 'Create & Proceed to Desk Payment'
                    : 'Create & Generate Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                onClick={() => setConfirmPaymentSub(null)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmPayment}
              className="p-6 space-y-4"
              style={{ background: B.bg }}
            >
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}

              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Payment Provider *
                </label>
                <select
                  value={confirmForm.payment_provider}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, payment_provider: e.target.value }))
                  }
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
                  value={confirmForm.payment_method}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, payment_method: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  <option value="knet">KNET</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card / Visa / MasterCard</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  POS Receipt / Transaction Reference
                </label>
                <input
                  type="text"
                  value={confirmForm.transaction_reference}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, transaction_reference: e.target.value }))
                  }
                  placeholder="e.g. POS-984120"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmPaymentSub(null)}
                  className="px-4 py-2 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Later
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  style={{ background: B.espresso }}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm & Activate Course
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
                  <h3 className="text-base font-extrabold text-white">Course Payment Link</h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    {paymentLinkSub.subscription_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPaymentLinkSub(null);
                  setGeneratedPaymentUrl(null);
                }}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4" style={{ background: B.bg }}>
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}

              {generatedPaymentUrl ? (
                <div className="space-y-3">
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider"
                    style={{ color: B.espresso }}
                  >
                    Shareable Payment Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedPaymentUrl}
                      className="flex-1 px-3 py-2 rounded-xl border bg-white text-xs font-mono"
                      style={{ borderColor: B.linen, color: B.textMain }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPaymentUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-3 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      style={{ background: B.espresso }}
                    >
                      <Copy className="w-3.5 h-3.5 text-white" />
                      {copiedUrl ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleGeneratePaymentLink} className="space-y-3 pt-2">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Gateway
                  </label>
                  <select
                    value={paymentLinkGateway}
                    onChange={(e) => setPaymentLinkGateway(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                    style={{ borderColor: B.linen, color: B.textMain }}
                  >
                    <option value="myfatoorah">MyFatoorah</option>
                    <option value="tap">Tap Payments</option>
                    <option value="deema">Deema</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentLinkSub(null);
                      setGeneratedPaymentUrl(null);
                    }}
                    className="px-4 py-2 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                    style={{ borderColor: B.linen, color: B.textMain }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                    style={{ background: B.espresso }}
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {generatedPaymentUrl ? 'Regenerate Link' : 'Generate Payment Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SUBSCRIPTION MODAL */}
      {cancelSub && (
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
                  <Ban className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-extrabold text-white">
                  Cancel Subscription ({cancelSub.subscription_number})
                </h3>
              </div>
              <button
                onClick={() => setCancelSub(null)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleCancelSubscription}
              className="p-6 space-y-4"
              style={{ background: B.bg }}
            >
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}
              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Cancellation Reason
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancelling..."
                  className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelSub(null)}
                  className="px-4 py-2 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-95 flex items-center gap-2 cursor-pointer"
                  style={{ background: B.espresso }}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REFUND SUBSCRIPTION MODAL */}
      {refundSub && (
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
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Full Course Refund</h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    {refundSub.subscription_number} ·{' '}
                    {Number(refundSub.price || 0).toFixed(3)} {refundSub.currency || 'KWD'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRefundSub(null)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleRefundSubscription}
              className="p-6 space-y-4"
              style={{ background: B.bg }}
            >
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}
              <p className="text-xs" style={{ color: B.textMuted }}>
                Full refunds are permitted only when 0 sessions have been used or reserved.
              </p>
              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Refund Method *
                </label>
                <select
                  value={refundForm.refund_method}
                  onChange={(e) =>
                    setRefundForm((p) => ({ ...p, refund_method: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  <option value="knet">KNET</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card Reversal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                  style={{ color: B.espresso }}
                >
                  Refund Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Enter reason for refund..."
                  className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm"
                  style={{ borderColor: B.linen, color: B.textMain }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRefundSub(null)}
                  className="px-4 py-2 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-95 flex items-center gap-2 cursor-pointer"
                  style={{ background: B.espresso }}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Process Full Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & SESSION USAGES MODAL */}
      {detailSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-3xl overflow-hidden"
            style={{ borderColor: B.linen }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Subscription {detailSub.subscription_number}
                  </h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    {detailSub.course_name} ({detailSub.course_code}) ·{' '}
                    {formatCustomerName(detailSub)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailSub(null)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
              style={{ background: B.bg }}
            >
              {/* Top summary grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className="bg-white p-3.5 rounded-xl border"
                  style={{ borderColor: B.linen }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: B.textMuted }}
                  >
                    Status
                  </span>
                  <p
                    className="text-sm font-bold mt-1 capitalize"
                    style={{ color: B.textMain }}
                  >
                    {(detailSub.effective_status || detailSub.status || '').replace('_', ' ')}
                  </p>
                </div>
                <div
                  className="bg-white p-3.5 rounded-xl border"
                  style={{ borderColor: B.linen }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: B.textMuted }}
                  >
                    Sessions Balance
                  </span>
                  <p className="text-sm font-bold mt-1" style={{ color: B.espresso }}>
                    {detailSub.available_sessions} / {detailSub.total_sessions} available
                  </p>
                </div>
                <div
                  className="bg-white p-3.5 rounded-xl border"
                  style={{ borderColor: B.linen }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: B.textMuted }}
                  >
                    Price & Invoice
                  </span>
                  <p className="text-sm font-bold mt-1" style={{ color: B.textMain }}>
                    {Number(detailSub.price || 0).toFixed(3)} {detailSub.currency || 'KWD'}
                  </p>
                  {detailSub.invoice_number && (
                    <p className="text-[11px] font-mono" style={{ color: B.textMuted }}>
                      {detailSub.invoice_number}
                    </p>
                  )}
                </div>
                <div
                  className="bg-white p-3.5 rounded-xl border"
                  style={{ borderColor: B.linen }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: B.textMuted }}
                  >
                    Expires At
                  </span>
                  <p className="text-sm font-bold mt-1" style={{ color: B.textMain }}>
                    {detailSub.expires_at
                      ? new Date(detailSub.expires_at).toLocaleDateString()
                      : 'Pending Activation'}
                  </p>
                </div>
              </div>

              {/* Session Usages Table */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-sm font-bold" style={{ color: B.textMain }}>
                    Session Redemption History
                  </h4>
                  {detailLoading && (
                    <span
                      className="text-xs flex items-center gap-1"
                      style={{ color: B.textMuted }}
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: B.espresso }} />
                      Refreshing sessions...
                    </span>
                  )}
                </div>

                {Array.isArray(detailSub.sessions) && detailSub.sessions.length > 0 ? (
                  <div
                    className="bg-white border rounded-xl overflow-hidden"
                    style={{ borderColor: B.linen }}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className="border-b uppercase"
                          style={{
                            background: B.bg,
                            borderColor: B.linen,
                            color: B.textMuted,
                          }}
                        >
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Booking #</th>
                          <th className="py-2.5 px-3">Appointment</th>
                          <th className="py-2.5 px-3">Branch & Room</th>
                          <th className="py-2.5 px-3">Therapist</th>
                          <th className="py-2.5 px-3">Session Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: B.linen }}>
                        {detailSub.sessions.map((s: Record<string, any>) => (
                          <tr key={s.id}>
                            <td className="py-2.5 px-3 font-bold" style={{ color: B.textMain }}>
                              #{s.session_number}
                            </td>
                            <td
                              className="py-2.5 px-3 font-mono font-semibold"
                              style={{ color: B.espresso }}
                            >
                              {s.booking_number || s.booking_id}
                            </td>
                            <td className="py-2.5 px-3" style={{ color: B.textMain }}>
                              {s.appointment_start
                                ? new Date(s.appointment_start).toLocaleString()
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3" style={{ color: B.textMain }}>
                              {s.branch_name || '—'}
                              {s.service_arrangement_name
                                ? ` · ${s.service_arrangement_name}`
                                : ''}
                            </td>
                            <td className="py-2.5 px-3" style={{ color: B.textMain }}>
                              {s.therapist_name || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                style={{
                                  background: B.pillBg,
                                  color: B.espresso,
                                }}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className="p-6 rounded-xl border bg-white text-center text-xs"
                    style={{ borderColor: B.linen, color: B.textMuted }}
                  >
                    No sessions have been booked or redeemed from this subscription yet.
                  </div>
                )}
              </div>

              <div
                className="flex items-center justify-between pt-3 border-t"
                style={{ borderColor: B.linen }}
              >
                <div className="flex items-center gap-2">
                  {(detailSub.is_redeemable ||
                    ((detailSub.effective_status || detailSub.status) === 'active' &&
                      Number(detailSub.available_sessions) > 0)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailSub;
                        setDetailSub(null);
                        setRedeemSub(target);
                      }}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer"
                      style={{ background: B.espresso }}
                    >
                      <CalendarPlus className="w-4 h-4 text-white" />
                      Book & Redeem Session
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailSub(null)}
                  className="px-4 py-2 rounded-xl border bg-white text-xs font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REDEEM COURSE SESSION MODAL */}
      {redeemSub && (
        <RedeemCourseModal
          subscription={redeemSub}
          onClose={() => setRedeemSub(null)}
          onSuccess={() => {
            loadSubscriptions();
          }}
        />
      )}

      {/* CREATE CUSTOMER MODAL */}
      {createCustomerOpen && (
        <CreateCustomerModal
          authHeader={
            typeof window !== 'undefined' && localStorage.getItem('ush_access_token')
              ? `Bearer ${localStorage.getItem('ush_access_token')}`
              : ''
          }
          onClose={() => setCreateCustomerOpen(false)}
          onCreated={(newCustomer: CreatedCustomer) => {
            setCreateCustomerOpen(false);
            if (newCustomer?.id) {
              setCustomers((prev) => [newCustomer as Record<string, any>, ...prev]);
              setSellForm((prev) => ({ ...prev, customer_id: String(newCustomer.id) }));
            } else {
              loadCatalogAndCustomers();
            }
          }}
        />
      )}
    </div>
  );
}

export default function CourseSubscriptionsPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="p-12 text-center text-[#8a6f63] flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#543C30]" />
            <span className="text-sm">Loading course subscriptions...</span>
          </div>
        }
      >
        <CourseSubscriptionsContent />
      </Suspense>
    </DashboardShell>
  );
}
