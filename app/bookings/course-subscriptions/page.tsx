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
  XCircle,
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
          <div className="w-10 h-10 rounded-xl bg-[#2C241D] text-[#C5A059] flex items-center justify-center shadow-sm">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2C241D]">Course Subscriptions</h1>
            <p className="text-sm text-[#6E6259]">
              Sell courses, confirm desk payments, track session balances, and book redemption sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSubscriptions}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm font-medium text-[#2C241D] hover:bg-[#FAF8F5] flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/courses"
            className="px-4 py-2.5 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#7C5E24] text-sm font-semibold hover:bg-[#C5A059]/20 flex items-center gap-2 transition-colors"
          >
            <Layers className="w-4 h-4" />
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
            className="px-4 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-semibold hover:bg-[#3F342A] flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-[#C5A059]" />
            Sell Course
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
              Total Subscriptions
            </span>
            <BookMarked className="w-4 h-4 text-[#C5A059]" />
          </div>
          <p className="text-2xl font-bold text-[#2C241D] mt-2">{stats.total}</p>
          <p className="text-xs text-[#6E6259] mt-1">All sold course packages</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
              Active Subscriptions
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.active}</p>
          <p className="text-xs text-[#6E6259] mt-1">Ready for session redemption</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
              Pending Payment
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.pending}</p>
          <p className="text-xs text-[#6E6259] mt-1">Awaiting desk POS or payment link</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
              Available Sessions
            </span>
            <Sparkles className="w-4 h-4 text-[#C5A059]" />
          </div>
          <p className="text-2xl font-bold text-[#2C241D] mt-2">{stats.totalAvailableSessions}</p>
          <p className="text-xs text-[#6E6259] mt-1">Unredeemed sessions across active packages</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-[#E5E0D8] shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8C7D70] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subscription #, course name, service, or code..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
          className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
      <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#6E6259] flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#C5A059]" />
            <span className="text-sm">Loading course subscriptions...</span>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center mx-auto text-[#8C7D70]">
              <BookMarked className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[#2C241D]">
              No course subscriptions found
            </h3>
            <p className="text-xs text-[#6E6259] max-w-md mx-auto">
              Sell a course package to a customer to start tracking prepaid sessions and booking
              zero-due course redemptions.
            </p>
            <button
              onClick={() => setSellModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-[#2C241D] text-white text-xs font-semibold hover:bg-[#3F342A] inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-[#C5A059]" />
              Sell Course Package
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E5E0D8] text-[11px] font-semibold uppercase tracking-wider text-[#8C7D70]">
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
              <tbody className="divide-y divide-[#E5E0D8] text-sm">
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
                  const canRedeem = Boolean(sub.is_redeemable) || (effStatus === 'active' && avail > 0);
                  const canRefund =
                    (sub.status === 'active' || sub.status === 'expired') &&
                    used === 0 &&
                    reserved === 0;

                  return (
                    <tr key={sub.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => openDetailModal(sub)}
                          className="font-mono text-xs font-bold text-[#2C241D] hover:text-[#C5A059] underline decoration-dotted"
                        >
                          {sub.subscription_number}
                        </button>
                        <div className="text-[11px] text-[#8C7D70] mt-0.5">
                          {sub.purchased_at
                            ? new Date(sub.purchased_at).toLocaleDateString()
                            : ''}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-semibold text-[#2C241D]">
                          {formatCustomerName(sub)}
                        </div>
                        {sub.customer_data?.phone_number && (
                          <div className="text-xs text-[#6E6259]">
                            {sub.customer_data.phone_number}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-[#2C241D]">
                          {sub.course_name}{' '}
                          <span className="font-mono text-xs text-[#8C7D70]">
                            ({sub.course_code})
                          </span>
                        </div>
                        <div className="text-xs text-[#6E6259] flex items-center gap-1.5 mt-0.5">
                          <span>{sub.service_name}</span>
                          <span>·</span>
                          <span className="text-[#7C5E24] font-medium">
                            {ARRANGEMENT_LABELS[sub.arrangement_type] || sub.arrangement_type}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-[#2C241D]">
                            {avail} / {total} left
                          </span>
                          <span className="text-[#8C7D70]">
                            {used} used{reserved > 0 ? `, ${reserved} booked` : ''}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E5E0D8] overflow-hidden">
                          <div
                            className="h-full bg-[#C5A059] transition-all"
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-[#2C241D]">
                          {Number(sub.price || 0).toFixed(3)} {sub.currency || 'KWD'}
                        </div>
                        {sub.invoice_number && (
                          <div className="text-[11px] font-mono text-[#6E6259]">
                            {sub.invoice_number}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-xs text-[#4A3F35]">
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
                          <span className="text-[#8C7D70]">Upon activation</span>
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
                              className="px-2.5 py-1.5 rounded-lg bg-[#2C241D] text-white hover:bg-[#3F342A] text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                              title="Book a session using this course"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 text-[#C5A059]" />
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
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                title="Confirm Desk Payment"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Pay
                              </button>
                              <button
                                onClick={() => {
                                  setActionError(null);
                                  setGeneratedPaymentUrl(sub.payment_url || null);
                                  setPaymentLinkSub(sub);
                                }}
                                className="p-1.5 rounded-lg border border-[#E5E0D8] text-[#2C241D] hover:bg-[#FAF8F5]"
                                title="Payment Link"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setActionError(null);
                                  setCancelReason('');
                                  setCancelSub(sub);
                                }}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                title="Cancel Unpaid Subscription"
                              >
                                <Ban className="w-4 h-4" />
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
                              className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50"
                              title="Refund Unused Course"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => openDetailModal(sub)}
                            className="p-1.5 rounded-lg text-[#6E6259] hover:text-[#2C241D] hover:bg-[#FAF8F5]"
                            title="View Details & Session History"
                          >
                            <Eye className="w-4 h-4" />
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center">
                  <BookMarked className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Sell Course Subscription</h3>
                  <p className="text-xs text-white/70">
                    Assign a course package to a customer and collect payment at desk or via link
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSellModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSellSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {sellError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sellError}</span>
                </div>
              )}

              {/* Customer Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#4A3F35]">Customer *</label>
                  <button
                    type="button"
                    onClick={() => setCreateCustomerOpen(true)}
                    className="text-xs font-semibold text-[#7C5E24] hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + New Customer
                  </button>
                </div>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Filter customer by name or phone..."
                  className="w-full px-3.5 py-2 mb-2 rounded-xl border border-[#E5E0D8] text-xs text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                />
                <select
                  value={sellForm.customer_id}
                  onChange={(e) => setSellForm((p) => ({ ...p, customer_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                  Course Package *
                </label>
                <select
                  value={sellForm.course_id}
                  onChange={(e) => setSellForm((p) => ({ ...p, course_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
                <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E5E0D8] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#6E6259]">Locked Service</span>
                    <span className="font-semibold text-[#2C241D]">
                      {selectedSellCourse.service?.name || 'Service'} (
                      {selectedSellCourse.service?.duration_minutes || 60} mins)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6259]">Room Arrangement</span>
                    <span className="font-semibold text-[#7C5E24]">
                      {ARRANGEMENT_LABELS[selectedSellCourse.arrangement_type] ||
                        selectedSellCourse.arrangement_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6259]">Sessions & Validity</span>
                    <span className="font-semibold text-[#2C241D]">
                      {selectedSellCourse.total_sessions} sessions · Valid for{' '}
                      {selectedSellCourse.validity_days} days
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#E5E0D8]">
                    <span className="text-[#6E6259] font-semibold">Total Package Price</span>
                    <span className="text-sm font-bold text-[#2C241D]">
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
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    sellForm.payment_option === 'pay_at_desk'
                      ? 'border-[#C5A059] bg-[#C5A059]/10 text-[#2C241D]'
                      : 'border-[#E5E0D8] bg-white text-[#6E6259]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <CreditCard className="w-4 h-4 text-[#C5A059]" />
                    Pay at Desk
                  </div>
                  <p className="text-[11px] text-[#6E6259] mt-1">
                    Collect via KNET POS, Cash, or Card right now
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSellForm((p) => ({ ...p, payment_option: 'payment_link' }))}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    sellForm.payment_option === 'payment_link'
                      ? 'border-[#C5A059] bg-[#C5A059]/10 text-[#2C241D]'
                      : 'border-[#E5E0D8] bg-white text-[#6E6259]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Link2 className="w-4 h-4 text-[#C5A059]" />
                    Send Payment Link
                  </div>
                  <p className="text-[11px] text-[#6E6259] mt-1">
                    Generate online payment link (MyFatoorah / Tap)
                  </p>
                </button>
              </div>

              {sellForm.payment_option === 'payment_link' && (
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D]"
                  >
                    <option value="myfatoorah">MyFatoorah</option>
                    <option value="tap">Tap Payments</option>
                    <option value="deema">Deema</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={sellForm.notes}
                  onChange={(e) => setSellForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional sale remarks..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8]">
                <button
                  type="button"
                  onClick={() => setSellModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm font-medium text-[#6E6259]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sellSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-semibold hover:bg-[#3F342A] disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-[#C5A059]" />
                <div>
                  <h3 className="text-base font-semibold">Confirm Desk Payment</h3>
                  <p className="text-xs text-white/70">
                    {confirmPaymentSub.subscription_number} ·{' '}
                    {Number(confirmPaymentSub.price || 0).toFixed(3)}{' '}
                    {confirmPaymentSub.currency || 'KWD'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmPaymentSub(null)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Payment Provider *
                </label>
                <select
                  value={confirmForm.payment_provider}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, payment_provider: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D]"
                >
                  <option value="knet_pos">KNET POS Terminal</option>
                  <option value="other">Cash / Manual</option>
                  <option value="myfatoorah">MyFatoorah</option>
                  <option value="tap">Tap</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Payment Method *
                </label>
                <select
                  value={confirmForm.payment_method}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, payment_method: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D]"
                >
                  <option value="knet">KNET</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card / Visa / MasterCard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  POS Receipt / Transaction Reference
                </label>
                <input
                  type="text"
                  value={confirmForm.transaction_reference}
                  onChange={(e) =>
                    setConfirmForm((p) => ({ ...p, transaction_reference: e.target.value }))
                  }
                  placeholder="e.g. POS-984120"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmPaymentSub(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] text-sm text-[#6E6259]"
                >
                  Later
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-5 h-5 text-[#C5A059]" />
                <div>
                  <h3 className="text-base font-semibold">Course Payment Link</h3>
                  <p className="text-xs text-white/70">{paymentLinkSub.subscription_number}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPaymentLinkSub(null);
                  setGeneratedPaymentUrl(null);
                }}
                className="p-1.5 rounded-lg text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}

              {generatedPaymentUrl ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#4A3F35]">
                    Shareable Payment Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedPaymentUrl}
                      className="flex-1 px-3 py-2 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5] text-xs font-mono text-[#2C241D]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPaymentUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-3 py-2 rounded-xl bg-[#2C241D] text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedUrl ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleGeneratePaymentLink} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Gateway
                  </label>
                  <select
                    value={paymentLinkGateway}
                    onChange={(e) => setPaymentLinkGateway(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D]"
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
                    className="px-4 py-2 rounded-xl border border-[#E5E0D8] text-sm text-[#6E6259]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-[#2C241D] text-white text-sm font-semibold flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-red-900 text-white">
              <div className="flex items-center gap-2.5">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-semibold">
                  Cancel Unpaid Subscription ({cancelSub.subscription_number})
                </h3>
              </div>
              <button onClick={() => setCancelSub(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCancelSubscription} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Cancellation Reason
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancelling..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelSub(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] text-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#2C241D] text-white">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-[#C5A059]" />
                <div>
                  <h3 className="text-base font-semibold">Full Course Refund</h3>
                  <p className="text-xs text-white/70">
                    {refundSub.subscription_number} ·{' '}
                    {Number(refundSub.price || 0).toFixed(3)} {refundSub.currency || 'KWD'}
                  </p>
                </div>
              </div>
              <button onClick={() => setRefundSub(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRefundSubscription} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {actionError}
                </div>
              )}
              <p className="text-xs text-[#6E6259]">
                Full refunds are permitted only when 0 sessions have been used or reserved.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Refund Method *
                </label>
                <select
                  value={refundForm.refund_method}
                  onChange={(e) =>
                    setRefundForm((p) => ({ ...p, refund_method: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm"
                >
                  <option value="knet">KNET</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card Reversal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                  Refund Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Enter reason for refund..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRefundSub(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    Subscription {detailSub.subscription_number}
                  </h3>
                  <p className="text-xs text-white/70">
                    {detailSub.course_name} ({detailSub.course_code}) · {formatCustomerName(detailSub)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailSub(null)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Top summary grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8]">
                  <span className="text-[11px] font-semibold uppercase text-[#8C7D70]">
                    Status
                  </span>
                  <p className="text-sm font-bold text-[#2C241D] mt-1 capitalize">
                    {(detailSub.effective_status || detailSub.status || '').replace('_', ' ')}
                  </p>
                </div>
                <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8]">
                  <span className="text-[11px] font-semibold uppercase text-[#8C7D70]">
                    Sessions Balance
                  </span>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {detailSub.available_sessions} / {detailSub.total_sessions} available
                  </p>
                </div>
                <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8]">
                  <span className="text-[11px] font-semibold uppercase text-[#8C7D70]">
                    Price & Invoice
                  </span>
                  <p className="text-sm font-bold text-[#2C241D] mt-1">
                    {Number(detailSub.price || 0).toFixed(3)} {detailSub.currency || 'KWD'}
                  </p>
                  {detailSub.invoice_number && (
                    <p className="text-[11px] font-mono text-[#6E6259]">
                      {detailSub.invoice_number}
                    </p>
                  )}
                </div>
                <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E5E0D8]">
                  <span className="text-[11px] font-semibold uppercase text-[#8C7D70]">
                    Expires At
                  </span>
                  <p className="text-sm font-bold text-[#2C241D] mt-1">
                    {detailSub.expires_at
                      ? new Date(detailSub.expires_at).toLocaleDateString()
                      : 'Pending Activation'}
                  </p>
                </div>
              </div>

              {/* Session Usages Table */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-sm font-bold text-[#2C241D]">
                    Session Redemption History
                  </h4>
                  {detailLoading && (
                    <span className="text-xs text-[#8C7D70] flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Refreshing sessions...
                    </span>
                  )}
                </div>

                {Array.isArray(detailSub.sessions) && detailSub.sessions.length > 0 ? (
                  <div className="border border-[#E5E0D8] rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#FAF8F5] border-b border-[#E5E0D8] text-[#8C7D70] uppercase">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Booking #</th>
                          <th className="py-2.5 px-3">Appointment</th>
                          <th className="py-2.5 px-3">Branch & Room</th>
                          <th className="py-2.5 px-3">Therapist</th>
                          <th className="py-2.5 px-3">Session Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E0D8]">
                        {detailSub.sessions.map((s: Record<string, any>) => (
                          <tr key={s.id}>
                            <td className="py-2.5 px-3 font-bold text-[#2C241D]">
                              #{s.session_number}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-[#2C241D]">
                              {s.booking_number || s.booking_id}
                            </td>
                            <td className="py-2.5 px-3 text-[#4A3F35]">
                              {s.appointment_start
                                ? new Date(s.appointment_start).toLocaleString()
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-[#4A3F35]">
                              {s.branch_name || '—'}
                              {s.service_arrangement_name
                                ? ` · ${s.service_arrangement_name}`
                                : ''}
                            </td>
                            <td className="py-2.5 px-3 text-[#4A3F35]">
                              {s.therapist_name || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  s.status === 'consumed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : s.status === 'reserved'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
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
                  <div className="p-6 rounded-xl border border-[#E5E0D8] bg-[#FAF8F5] text-center text-xs text-[#6E6259]">
                    No sessions have been booked or redeemed from this subscription yet.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E5E0D8]">
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
                      className="px-4 py-2 rounded-xl bg-[#2C241D] text-white text-xs font-semibold hover:bg-[#3F342A] inline-flex items-center gap-1.5"
                    >
                      <CalendarPlus className="w-4 h-4 text-[#C5A059]" />
                      Book & Redeem Session
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailSub(null)}
                  className="px-4 py-2 rounded-xl border border-[#E5E0D8] text-xs font-medium text-[#6E6259]"
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
          <div className="p-12 text-center text-[#6E6259] flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#C5A059]" />
            <span className="text-sm">Loading course subscriptions...</span>
          </div>
        }
      >
        <CourseSubscriptionsContent />
      </Suspense>
    </DashboardShell>
  );
}

