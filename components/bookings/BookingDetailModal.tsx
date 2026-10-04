'use client';

/**
 * BookingDetailModal
 * Fetches a booking by ID from /booknpay/api/v1/bookings/<id>/
 * and renders a rich detail popup. Used on both Therapist Schedule
 * and Branch Appointments pages.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  X, Loader2, AlertCircle, CheckCircle2, User, Scissors, MapPin,
  CalendarDays, Clock, Timer, Package, DollarSign, StickyNote,
  Hash, RefreshCw, CreditCard, Building2, Ban, Banknote, Printer,
  Receipt, FileText, History, ExternalLink, Copy, Check, Eye, UserCheck, ShieldCheck, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';
import { checkBookingCancellationEligibility } from '@/lib/cancellation-policy';
import { RescheduleBookingModal } from './RescheduleBookingModal';
import { BookingReceiptModal } from './BookingReceiptModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { BookingCancellationModal } from './BookingCancellationModal';

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

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt(val: unknown): string {
  const n = parseFloat(String(val ?? '0'));
  return isNaN(n) ? '0.000' : n.toFixed(3);
}

function fmtDate(raw: string | undefined | null): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtDateTime(raw: string | undefined | null): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  let dateStr = s;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z');
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const STATUS_STYLES: Record<string, { bar: string; pill: string; dot: string }> = {
  scheduled:   { bar: 'from-violet-500 to-indigo-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500' },
  booking:     { bar: 'from-blue-500 to-sky-500',      pill: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',         dot: 'bg-blue-500' },
  pending:     { bar: 'from-amber-500 to-yellow-400',  pill: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',     dot: 'bg-amber-500' },
  confirmed:   { bar: 'from-emerald-500 to-teal-400',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500' },
  in_progress: { bar: 'from-emerald-400 to-green-400', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-400 animate-pulse' },
  completed:   { bar: 'from-slate-400 to-slate-500',   pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',    dot: 'bg-slate-400' },
  cancelled:   { bar: 'from-rose-500 to-red-500',      pill: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',       dot: 'bg-rose-500' },
  no_show:     { bar: 'from-orange-500 to-amber-500',  pill: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', dot: 'bg-orange-500' },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES['scheduled'];
}

// ── types ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export interface BookingDetailModalProps {
  /** The booking_id / id to fetch */
  bookingId: string;
  /** Bearer token for Authorization header */
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── component ──────────────────────────────────────────────────────────────────

export function BookingDetailModal({ bookingId, token, onClose, onSuccess }: BookingDetailModalProps) {
  const rawToken = token || (typeof window !== 'undefined' ? localStorage.getItem('ush_access_token') ?? '' : '');
  const cleanToken = rawToken.replace(/^(Bearer\s+)+/i, '').trim();
  const authHeader = cleanToken ? `Bearer ${cleanToken}` : '';

  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);

  const [booking,            setBooking]            = useState<AnyRecord | null>(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState<string | null>(null);
  const [paymentLoading,     setPaymentLoading]     = useState(false);
  const [paymentSuccess,     setPaymentSuccess]     = useState(false);
  const [paymentError,       setPaymentError]       = useState<string | null>(null);
  const [paymentDoneLoading, setPaymentDoneLoading] = useState(false);
  const [paymentDoneError,   setPaymentDoneError]   = useState<string | null>(null);
  const [cancelLoading,      setCancelLoading]      = useState(false);
  const [cancelError,        setCancelError]        = useState<string | null>(null);
  const [cancelDone,         setCancelDone]         = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showPaymentModal,   setShowPaymentModal]   = useState(false);
  const [selectedProvider,   setSelectedProvider]   = useState<string>('MyFatoorah');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState<string | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completingStatus, setCompletingStatus] = useState(false);
  const [completeStatusError, setCompleteStatusError] = useState<string | null>(null);

  // Tab & Payment view states
  const [activeTab, setActiveTab] = useState<'details' | 'payment'>('details');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [receiptZoom, setReceiptZoom] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState<AnyRecord | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Fetch booking detail
  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true); setError(null);
    try {
      const res  = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/`, {
        headers: authHeader ? { Authorization: authHeader, Accept: 'application/json' } : { Accept: 'application/json' },
      });
      const json = await res.json().catch(() => ({}));
      console.log('[BookingDetailModal] GET', res.status, json);
      if (!res.ok) {
        const detail = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? json.error ?? JSON.stringify(json);
        throw new Error(`${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      }
      // Handle both flat and wrapped responses
      setBooking((json.data ?? json) as AnyRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId, authHeader]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  // Create payment link
  const handlePaymentLink = async () => {
    setPaymentLoading(true); setPaymentError(null);
    try {
      const res  = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/status`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body:    JSON.stringify({ status: 'confirmed', payment_status: 'pending', reason: 'Payment Link Sent to Customer' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setPaymentSuccess(true);
      fetchBooking(); // Refresh to reflect new status
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Confirm payment done with selected provider
  const handleConfirmPayment = async () => {
    setPaymentSubmitLoading(true);
    setPaymentSubmitError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/status/`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          status:           'confirmed',
          payment_status:   'success',
          payment_provider: selectedProvider,
          payment_method:   selectedProvider,
          reason:           'Paid on desk',
          source:           'ushdesk',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.detail ?? json.message ?? (json.error as Record<string, unknown>)?.message ?? `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setShowPaymentModal(false);
      await fetchBooking();
      onSuccess?.();
    } catch (err) {
      setPaymentSubmitError(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  // Print receipt — only opens receipt modal without sending API request to update status
  const handlePrintReceipt = () => {
    setShowReceiptModal(true);
  };

  // Update status to completed
  const handleCompleteBooking = async () => {
    if (status === 'completed') return;
    setCompletingStatus(true);
    setCompleteStatusError(null);
    try {
      const res = await authedFetch(`/booknpay/api/v1/bookings/${bookingId}/status/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          status: 'completed',
          reason: 'Service Completed',
          source: 'ushdesk',
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.detail || `Failed to update status (${res.status})`);
      }
      await fetchBooking();
      onSuccess?.();
    } catch (err) {
      console.error('[BookingDetailModal] Error completing booking:', err);
      setCompleteStatusError(err instanceof Error ? err.message : 'Failed to update status to completed');
    } finally {
      setCompletingStatus(false);
    }
  };

  // Validate cancellation policy (Administrator, Branch Manager, Finance Manager, Customer Support Manager can cancel anytime; others require >= 12h)
  const cancellationEligibility = checkBookingCancellationEligibility(booking, roleInfo, user);
  const canCancel = cancellationEligibility.canCancel;

  // Cancel booking — opens BookingCancellationModal which handles all accounting steps
  const handleCancelBooking = () => {
    if (!canCancel) {
      setCancelError(cancellationEligibility.reason || 'Cancellations within 12 hours of appointment time require Administrator, Branch Manager, Finance Manager, or Customer Support Manager privileges.');
      return;
    }
    setShowCancellationModal(true);
  };

  // ── derived values ──────────────────────────────────────────────────────────

  const bk        = booking;

  // Debug: log the raw booking shape so we can see exactly what the API returns
  if (bk) console.log('[BookingDetailModal] raw booking:', JSON.stringify(bk, null, 2));

  const status    = String(bk?.status ?? bk?.booking_status ?? 'scheduled').toLowerCase();
  const isCompleted = status === 'completed';
  const ss        = statusStyle(status);
  const bookingNum = String(bk?.booking_number ?? '').replace('undefined', '').replace('null', '');
  const ref       = String(
    bk?.booking_number ?? bk?.reference_number ??
    bk?.bookings_id ?? bk?.booking_id ??
    bk?.reference ?? bk?.id ?? bookingId
  );

  // ── nested objects ────────────────────────────────────────────────
  const customerObj  = (bk?.customer_data ?? bk?.customer) as AnyRecord | undefined;
  const therapistObj = (bk?.therapist_data ?? bk?.therapist) as AnyRecord | undefined;
  const svcObj       = (bk?.service_data ?? bk?.service) as AnyRecord | undefined;
  const arrObj       = (bk?.service_arrangement_data ?? bk?.arrangement) as AnyRecord | undefined;
  const addons       = (bk?.selected_addons ?? bk?.addons ?? []) as AnyRecord[];
  const pricing      = (bk?.pricing_details ?? bk?.pricing) as AnyRecord | undefined;

  // ── helper: pick first non-empty string value ──────────────────────
  function firstTruthy(...vals: (string | null | undefined)[]): string {
    for (const v of vals) { if (v) return v; }
    return '\u2014';
  }

  // ── customer ────────────────────────────────────────────────────────
  const customerFL    = [customerObj?.first_name, customerObj?.last_name].filter(Boolean).join(' ');
  const customerName  = firstTruthy(customerObj?.customer_name, customerObj?.name, customerFL, bk?.customer_name, bk?.client_name);
  const customerPhone = firstTruthy(customerObj?.phone_number, customerObj?.phone, bk?.phone_number);
  const customerEmail = firstTruthy(customerObj?.email, bk?.email);

  // ── therapist ───────────────────────────────────────────────────────
  const therapistFL    = [therapistObj?.first_name, therapistObj?.last_name].filter(Boolean).join(' ');
  const therapistName  = firstTruthy(therapistObj?.therapist_name, therapistObj?.name, therapistFL, bk?.therapist_name);
  const therapistPhoto = therapistObj?.photo_url ?? therapistObj?.avatar ?? therapistObj?.profile_picture ?? null;

  // ── service ─────────────────────────────────────────────────────────
  const svcName     = firstTruthy(svcObj?.service_name, svcObj?.name, bk?.service_name);
  const svcCategory = firstTruthy(svcObj?.service_category, svcObj?.category, bk?.service_category);

  // ── branch ──────────────────────────────────────────────────────────
  const branchObj  = bk?.branch_data as AnyRecord | undefined;
  const branchName = firstTruthy(branchObj?.branch_name, branchObj?.name, bk?.branch_name);

  // ── arrangement ─────────────────────────────────────────────────────
  const arrName = firstTruthy(arrObj?.arrangement_name, arrObj?.name);
  const arrType = firstTruthy(arrObj?.arrangement_type);

  // ── date & time ─────────────────────────────────────────────────────
  const isoStart   = bk?.appointment_start ?? bk?.appointment_datetime ?? '';
  const isoEnd     = bk?.appointment_end ?? '';
  const isoDate    = isoStart ? isoStart.split('T')[0] : '';
  // The system stores local Kuwait time labelled as UTC (timezone-naive by design).
  // Using timeZone:'UTC' reads the raw stored value without browser-local conversion.
  const formatTimeSlot = (str: string) => {
    if (!str) return '';
    const s = str.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
    let dateStr = s;
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(dateStr)) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  };
  const isoTime    = isoStart ? formatTimeSlot(isoStart) : '';
  const isoEndTime = isoEnd ? formatTimeSlot(isoEnd) : '';
  const dateRaw    = firstTruthy(bk?.date, bk?.booking_date, bk?.appointment_date, isoDate);
  const rawTimeSlot = firstTruthy(
    (isoTime && isoEndTime) ? `${isoTime} – ${isoEndTime}` : null,
    bk?.time_slot,
    bk?.displayTime,
    bk?.appointment_time,
    bk?.time,
    isoTime
  );


  // ── rest ────────────────────────────────────────────────────────────
  const durationVal = String(bk?.total_duration ?? bk?.duration_minutes ?? bk?.duration ?? '');
  const duration    = durationVal || '';
  const totalPrice  = pricing?.total_price ?? pricing?.total ?? bk?.total_price ?? bk?.price ?? '';
  const currency    = firstTruthy(bk?.currency, 'KWD');
  const notes       = firstTruthy(bk?.customer_notes, bk?.notes, bk?.customerMessage);
  const rawPaymentStatus = (bk?.payment_status ?? bk?.paymentStatus ?? bk?.payment_state ?? '').toString().toLowerCase().trim();
  const isCancelled = status === 'cancelled';
  const isPaid = rawPaymentStatus === 'success' || rawPaymentStatus === 'paid' || rawPaymentStatus === 'completed';
  const isPending = (rawPaymentStatus === 'pending' || rawPaymentStatus === 'unpaid' || paymentSuccess) && !isCancelled && !cancelDone;

  // ── Payment & Invoices details ──────────────────────────────────────
  const paymentsData = (bk?.payments_data ?? bk?.payment_data) as AnyRecord | undefined;
  const paymentProvider = firstTruthy(
    bk?.payment_provider,
    bk?.payment_gateway,
    paymentsData?.payment_provider,
    paymentsData?.payment_gateway,
    bk?.payment_method
  );
  const transactionId = firstTruthy(
    bk?.transaction_id,
    bk?.reference_id,
    paymentsData?.transaction_id,
    paymentsData?.reference_id
  );
  const traceId = firstTruthy(
    paymentsData?.trace_id,
    paymentsData?.reference_id,
    bk?.trace_id
  );
  const invoiceNumber = firstTruthy(
    bk?.invoice_number,
    bk?.invoice_id,
    bk?.invoice_reference,
    paymentsData?.invoice_number,
    paymentsData?.invoice_id,
    pricing?.invoice_number,
    pricing?.invoice_id
  );
  const receiptImg = paymentsData?.receipt_image ?? bk?.receipt_image ?? null;
  const paymentNotes = paymentsData?.notes ?? bk?.payment_notes ?? null;
  const paymentDate = paymentsData?.transaction_date ?? paymentsData?.paid_at ?? bk?.paid_at ?? null;
  const paymentThrough = firstTruthy(bk?.source, bk?.payment_through, paymentsData?.payment_through, 'ushdesk');
  const paymentUrl = firstTruthy(bk?.payment_url, bk?.payment_link, bk?.payment_link_url, paymentsData?.payment_url);

  // ── State Change / Status History ───────────────────────────────────
  const bkStatusHistory = bk?.status_history;
  const bkStateHistory = bk?.state_history;
  const bkHistory = bk?.history;
  const rawHistory = (
    (Array.isArray(bkStatusHistory) && bkStatusHistory) ||
    (Array.isArray(bkStateHistory) && bkStateHistory) ||
    (Array.isArray(bkHistory) && bkHistory) ||
    []
  ) as AnyRecord[];

  const historyList = rawHistory.length > 0 ? rawHistory : [
    {
      title: 'Booking Created',
      new_status: bk?.status === 'confirmed' ? 'confirmed' : 'scheduled',
      created_at: bk?.created_at || bk?.created || isoStart,
      source: paymentThrough || 'ushdesk',
      reason: 'Initial appointment reservation recorded',
      change_by_user: customerName !== '—' ? customerName : 'Front Desk Staff',
    },
    ...(isPaid || paymentDate ? [{
      title: 'Payment Completed',
      new_status: 'paid',
      created_at: paymentDate || bk?.created_at || isoStart,
      source: paymentProvider !== '—' ? paymentProvider : 'ushdesk',
      reason: `Payment of ${fmt(totalPrice)} ${currency} verified via ${paymentProvider !== '—' ? paymentProvider : 'Desk'}${invoiceNumber !== '—' ? ` (Invoice: ${invoiceNumber})` : ''}`,
      change_by_user: paymentsData?.received_by || 'Payment Gateway / Staff',
    }] : []),
    ...(isCompleted ? [{
      title: 'Service Completed',
      new_status: 'completed',
      created_at: isoEnd || bk?.updated_at || new Date().toISOString(),
      source: 'ushdesk',
      reason: 'Treatment completed at branch',
      change_by_user: therapistName !== '—' ? therapistName : 'Therapist',
    }] : []),
    ...(isCancelled ? [{
      title: 'Booking Cancelled',
      new_status: 'cancelled',
      created_at: bk?.cancelled_at || bk?.updated_at || new Date().toISOString(),
      source: 'ushdesk',
      reason: bk?.cancel_reason || bk?.cancellation_reason || bk?.reason || 'Cancelled from ushdesk',
      change_by_user: 'Staff / Admin',
    }] : []),
  ];

  // Optional: load invoice detail from backend if invoice number exists
  useEffect(() => {
    if (!invoiceNumber || invoiceNumber === '—') {
      setInvoiceRecord(null);
      return;
    }
    let cancelled = false;
    setInvoiceLoading(true);
    authedFetch(`/api/v1/invoices?search=${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        const found = items.find((i: AnyRecord) => i.name === invoiceNumber || i.id === invoiceNumber || i.reference === invoiceNumber) || items[0];
        if (found) setInvoiceRecord(found);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setInvoiceLoading(false);
      });
    return () => { cancelled = true; };
  }, [invoiceNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'relative z-10 w-full max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-200',
          'max-w-3xl sm:max-w-4xl lg:max-w-[880px]',
          isCompleted
            ? 'booking-completed-modal border-[#B8A394] text-[#2D241E]'
            : 'border-border/60 bg-card text-foreground'
        )}
        style={isCompleted ? { backgroundColor: '#D3C0B2', color: '#2D241E' } : undefined}
      >
        {isCompleted && (
          <style>{`
            .booking-completed-modal {
              background-color: #D3C0B2 !important;
              color: #2D241E !important;
            }
            .booking-completed-modal h2,
            .booking-completed-modal h3,
            .booking-completed-modal p,
            .booking-completed-modal span:not([class*="bg-"]):not([class*="text-violet"]):not([class*="text-emerald"]):not([class*="text-rose"]) {
              color: #2D241E;
            }
            .booking-completed-modal .text-foreground {
              color: #2D241E !important;
            }
            .booking-completed-modal .text-muted-foreground {
              color: #69584D !important;
            }
            .booking-completed-modal .border-border\/40,
            .booking-completed-modal .border-border\/50,
            .booking-completed-modal .border-border\/60,
            .booking-completed-modal .border-border {
              border-color: rgba(105, 88, 77, 0.25) !important;
            }
            .booking-completed-modal .bg-muted\/20,
            .booking-completed-modal .bg-muted\/30,
            .booking-completed-modal .bg-muted\/40,
            .booking-completed-modal .bg-muted\/50,
            .booking-completed-modal .bg-muted\/60,
            .booking-completed-modal .bg-muted {
              background-color: rgba(255, 255, 255, 0.45) !important;
            }
            .booking-completed-modal .bg-card {
              background-color: rgba(255, 255, 255, 0.6) !important;
            }
          `}</style>
        )}

        {/* Status accent bar */}
        <div className={cn('h-1.5 w-full bg-gradient-to-r shrink-0', isCompleted ? 'bg-[#7D6453]' : ss.bar)} />

        {/* Header */}
        <div className={cn(
          'shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b',
          isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
        )}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Hash className={cn('h-3.5 w-3.5 shrink-0', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')} />
              <p className={cn('text-[11px] font-mono font-semibold truncate', isCompleted ? 'text-[#69584D]' : 'text-muted-foreground')}>{ref}</p>
            </div>
            <h2 className={cn('text-base font-extrabold leading-tight', isCompleted ? 'text-[#2D241E]' : 'text-foreground')}>Booking Details</h2>
            {!loading && bk && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                  isCompleted ? 'bg-[#5C7359]/20 text-[#244221] border border-[#5C7359]/40' : ss.pill
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isCompleted ? 'bg-[#244221]' : ss.dot)} />
                  {status.replace(/_/g, ' ')}
                </span>
                {bk?.payment_status && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    isCompleted ? 'bg-[#3D5A6C]/15 text-[#1B3A4B] border border-[#3D5A6C]/30' : 'bg-muted text-muted-foreground'
                  )}>
                    <CreditCard className="h-2.5 w-2.5" />
                    {String(bk.payment_status).replace(/_/g, ' ')}
                  </span>
                )}
                {bookingNum && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    isCompleted ? 'bg-[#7A5C43]/15 text-[#4A3221] border border-[#7A5C43]/30' : 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
                  )}>
                    <Hash className="h-2.5 w-2.5" />
                    {bookingNum}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose}
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition cursor-pointer',
              isCompleted ? 'bg-black/10 hover:bg-black/20 text-[#2D241E]' : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        {!loading && bk && (
          <div className={cn(
            'shrink-0 flex items-center border-b px-6 gap-1 sm:gap-2',
            isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/25' : 'border-border/40 bg-muted/20'
          )}>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                activeTab === 'details'
                  ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                  : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Info className="h-3.5 w-3.5" />
              Booking Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payment')}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition -mb-px cursor-pointer',
                activeTab === 'payment'
                  ? isCompleted ? 'border-[#3D2F27] text-[#2D241E]' : 'border-primary text-primary'
                  : isCompleted ? 'border-transparent text-[#69584D] hover:text-[#2D241E]' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Payment &amp; Invoices
              {isPaid ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Paid
                </span>
              ) : isPending ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Pending
                </span>
              ) : null}
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: 'none' }}>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading booking details…</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <button onClick={fetchBooking}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Booking content */}
          {!loading && bk && (
            <>
              {activeTab === 'details' && (
                <>
                  {/* ── Service ── */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10">
                      <Scissors className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Service</p>
                      <p className="text-sm font-bold truncate">{svcName}</p>
                      {svcCategory && <p className="text-[11px] text-muted-foreground">{svcCategory}</p>}
                    </div>
                    {totalPrice && (
                      <p className="shrink-0 text-sm font-extrabold text-violet-600 dark:text-violet-400">
                        {fmt(totalPrice)} <span className="text-[10px] font-semibold">{currency}</span>
                      </p>
                    )}
                  </div>

                  {/* ── Branch & Room / Arrangement in one row ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Branch */}
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10">
                        <MapPin className="h-4 w-4 text-sky-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Branch</p>
                        <p className="text-xs font-semibold truncate">{branchName}</p>
                      </div>
                    </div>

                    {/* Room / Arrangement */}
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: '#c9a96e18' }}>
                        <Building2 className="h-4 w-4" style={{ color: '#c9a96e' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Room / Arrangement</p>
                        <p className="text-xs font-semibold truncate">{arrName}</p>
                        {arrType && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                            {arrType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Date / Time / Duration ── */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: CalendarDays, label: 'Date',     value: fmtDate(dateRaw), color: 'text-violet-500' },
                      { icon: Clock,        label: 'Time',     value: rawTimeSlot || '—',  color: 'text-sky-500' },
                      { icon: Timer,        label: 'Duration', value: duration ? `${duration} min` : '—', color: 'text-indigo-500' },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                        </div>
                        <p className="text-xs font-bold leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Therapist & Customer ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Therapist */}
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden ring-2 ring-violet-400/30 shadow-sm">
                        {therapistPhoto
                          ? <img src={therapistPhoto} alt={therapistName} className="h-full w-full object-cover" />
                          : <div className="h-full w-full grid place-items-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-sm font-bold">
                              {therapistName.slice(0, 2).toUpperCase()}
                            </div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Therapist</p>
                        <p className="text-xs font-semibold truncate">{therapistName}</p>
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 text-white text-sm font-bold shrink-0">
                        {customerName !== '—' ? customerName.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer</p>
                        <p className="text-xs font-semibold truncate">{customerName}</p>
                        {customerPhone && <p className="text-[10px] text-muted-foreground">{customerPhone}</p>}
                        {customerEmail && <p className="text-[10px] text-muted-foreground truncate">{customerEmail}</p>}
                      </div>
                    </div>
                  </div>

                  {/* ── Add-ons ── */}
                  {addons.length > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Package className="h-3.5 w-3.5 text-violet-400" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add-ons ({addons.length})</p>
                      </div>
                      <div className="space-y-1.5">
                        {addons.map((a: AnyRecord, i: number) => (
                          <div key={a.id ?? i} className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-medium text-foreground leading-tight">{a.name ?? '—'}</p>
                            {a.price && <p className="text-[11px] font-bold text-violet-500 shrink-0">+{fmt(a.price)} {currency}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Pricing breakdown ── */}
                  {pricing && (
                    <div className="rounded-2xl border border-violet-200/40 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <DollarSign className="h-3.5 w-3.5 text-violet-500" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Pricing</p>
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Base price',  val: pricing.base_price  ?? pricing.base },
                          { label: 'Add-ons',     val: pricing.addons_price ?? pricing.addons },
                          { label: 'Extra time',  val: pricing.extra_time_price ?? pricing.extra_time },
                        ].filter(r => r.val && parseFloat(String(r.val)) > 0).map(r => (
                          <div key={r.label} className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">{r.label}</span>
                            <span className="font-semibold">{fmt(r.val)} {currency}</span>
                          </div>
                        ))}
                        <div className="border-t border-violet-200/60 dark:border-violet-700/40 mt-2 pt-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Total</span>
                          <span className="text-sm font-extrabold text-violet-700 dark:text-violet-300">
                            {fmt(pricing.total_price ?? pricing.total ?? totalPrice)} {currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Notes ── */}
                  {notes && (
                    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                        <p className="text-xs text-foreground leading-relaxed">{notes}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── TAB 2: Payment & Invoices ── */}
              {activeTab === 'payment' && (
                <div className="space-y-4">
                  {/* Official Invoice Card */}
                  <div className={cn(
                    'rounded-2xl border p-5 sm:p-6 transition shadow-xs space-y-4',
                    isCompleted
                      ? 'border-[#B8A394] bg-white/40'
                      : 'border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/40 via-card to-card dark:from-violet-950/20'
                  )}>
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/40">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Official Tax Invoice</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button
                              type="button"
                              onClick={() => setShowInvoiceModal(true)}
                              className="group/inv inline-flex items-center gap-1.5 text-sm font-mono font-extrabold text-foreground hover:text-violet-600 dark:hover:text-violet-400 transition cursor-pointer text-left"
                              title="Click to view full invoice details"
                            >
                              <span className="underline underline-offset-4 decoration-violet-400/60 group-hover/inv:decoration-violet-600">
                                {invoiceNumber !== '—' ? invoiceNumber : (invoiceRecord?.name || 'Pending Generation')}
                              </span>
                              <Eye className="h-3.5 w-3.5 text-violet-500 opacity-75 group-hover/inv:opacity-100 shrink-0" />
                            </button>
                            {invoiceNumber !== '—' && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(invoiceNumber);
                                  setCopiedLink('invoice');
                                  setTimeout(() => setCopiedLink(null), 2000);
                                }}
                                className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                                title="Copy invoice number"
                              >
                                {copiedLink === 'invoice' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => setShowInvoiceModal(true)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20 transition cursor-pointer"
                          title="Open invoice details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Invoice</span>
                        </button>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          isPaid
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                        )}>
                          {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {invoiceRecord?.status ? String(invoiceRecord.status).toUpperCase() : (isPaid ? 'PAID' : 'DRAFT')}
                        </span>
                        {(invoiceNumber !== '—' || invoiceRecord?.id) && (
                          <Link
                            href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber !== '—' ? invoiceNumber : invoiceRecord?.id || '')}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline px-2 py-1 rounded-lg hover:bg-muted/40 transition"
                          >
                            <span>Accounting</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Invoice details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-border/40 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Billed To</p>
                        <p className="font-bold truncate mt-0.5">{customerName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Issue Date</p>
                        <p className="font-medium mt-0.5">{fmtDateTime(invoiceRecord?.invoice_date || invoiceRecord?.date || paymentDate || bk?.created_at || isoStart)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Amount</p>
                        <p className="font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
                          {fmt(invoiceRecord?.total_amount ?? invoiceRecord?.total ?? totalPrice)} {currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold">Balance Due</p>
                        <p className="font-bold mt-0.5 text-foreground">
                          {isPaid ? `0.000 ${currency}` : `${fmt(totalPrice)} ${currency}`}
                        </p>
                      </div>
                    </div>

                    {/* Itemized breakdown in invoice */}
                    <div className="pt-1 space-y-2 pb-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                        <span>Description</span>
                        <span>Amount</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{svcName}</span>
                        <span className="font-semibold">{fmt(pricing?.base_price ?? pricing?.base ?? totalPrice)} {currency}</span>
                      </div>
                      {addons.map((a: AnyRecord, i: number) => (
                        <div key={a.id ?? i} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>+ Add-on: {a.name}</span>
                          <span>+{fmt(a.price || 0)} {currency}</span>
                        </div>
                      ))}
                      {pricing?.extra_time_price && parseFloat(String(pricing.extra_time_price)) > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>+ Extra Time</span>
                          <span>+{fmt(pricing.extra_time_price)} {currency}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Transaction & Gateway Details */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Transaction &amp; Gateway Details
                        </h4>
                      </div>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        isPaid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'
                      )}>
                        <ShieldCheck className="h-3 w-3" />
                        {isPaid ? 'Verified Desk Payment' : 'Pending Gateway Capture'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Payment Method / Provider</p>
                        <p className="text-xs font-bold text-foreground">
                          {paymentProvider !== '—' ? paymentProvider : 'Front Desk / Not specified'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Collected Through</p>
                        <p className="text-xs font-bold capitalize text-foreground">
                          {paymentThrough !== '—' ? paymentThrough : 'ushdesk'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Transaction / Reference ID</p>
                          {transactionId !== '—' && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(transactionId);
                                setCopiedLink('txn');
                                setTimeout(() => setCopiedLink(null), 2000);
                              }}
                              className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Copy transaction ID"
                            >
                              {copiedLink === 'txn' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <p className="font-mono text-xs font-bold text-foreground truncate">
                          {transactionId !== '—' ? transactionId : 'Auto-generated upon settlement'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">Trace / Auth Code</p>
                          {traceId !== '—' && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(traceId);
                                setCopiedLink('trace');
                                setTimeout(() => setCopiedLink(null), 2000);
                              }}
                              className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Copy trace ID"
                            >
                              {copiedLink === 'trace' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                        <p className="font-mono text-xs font-bold text-foreground truncate">
                          {traceId !== '—' ? traceId : '—'}
                        </p>
                      </div>
                    </div>

                    {paymentNotes && (
                      <div className="rounded-xl border border-border/40 bg-card/60 p-3">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Payment Reference Notes</p>
                        <p className="text-xs text-foreground leading-relaxed">{paymentNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Scanned Receipt Slip / Proof of Payment */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-violet-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Scanned Receipt / Slip
                        </h4>
                      </div>
                      {receiptImg && (
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Full Slip
                        </button>
                      )}
                    </div>

                    {receiptImg ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/70 p-3">
                        <button
                          type="button"
                          onClick={() => setReceiptZoom(true)}
                          className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-muted hover:opacity-90 transition cursor-zoom-in"
                        >
                          <img src={receiptImg} alt="Receipt slip" className="h-full w-full object-cover" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">Scanned Payment Receipt Attached</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Physical POS or bank voucher slip captured during booking check-in.</p>
                          <button
                            type="button"
                            onClick={() => setReceiptZoom(true)}
                            className="mt-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            Click to expand receipt image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>No physical receipt slip uploaded for this transaction. Digital ledger record attached.</span>
                      </div>
                    )}
                  </div>

                  {/* Customer Payment Link */}
                  {paymentUrl && (
                    <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-indigo-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            Customer Payment Link
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={paymentUrl}
                          className="flex-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-background px-3 py-2 text-xs font-mono text-foreground select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(paymentUrl);
                            setCopiedLink('payurl');
                            setTimeout(() => setCopiedLink(null), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold transition cursor-pointer"
                        >
                          {copiedLink === 'payurl' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedLink === 'payurl' ? 'Copied' : 'Copy'}
                        </button>
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-indigo-300 dark:border-indigo-700 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* State Change History Timeline */}
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-violet-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          State Change &amp; Audit History
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {historyList.length} recorded event{historyList.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="relative pl-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60 space-y-4">
                      {historyList.map((item: AnyRecord, idx: number) => {
                        const eventTitle = item.title || item.action || (item.new_status ? `Status changed to ${String(item.new_status).replace(/_/g, ' ')}` : 'Status Update');
                        const eventDate = item.created_at || item.timestamp || item.date || item.created;
                        const eventUser = item.change_by_user || item.user || item.actor || item.staff || item.source || 'Desk System';
                        const eventReason = item.reason || item.notes || item.comment || item.description;
                        const isTerminal = item.new_status === 'completed' || item.new_status === 'cancelled';

                        return (
                          <div key={idx} className="relative group">
                            {/* Dot */}
                            <span className={cn(
                              'absolute -left-5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background',
                              item.new_status === 'paid' ? 'bg-emerald-500 ring-2 ring-emerald-500/20' :
                              item.new_status === 'completed' ? 'bg-violet-600 ring-2 ring-violet-500/20' :
                              item.new_status === 'cancelled' ? 'bg-rose-500 ring-2 ring-rose-500/20' :
                              'bg-sky-500 ring-2 ring-sky-500/20'
                            )} />

                            <div className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-xs font-bold capitalize text-foreground">{eventTitle}</p>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {fmtDateTime(eventDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <UserCheck className="h-3 w-3" />
                                <span>Recorded by <strong className="font-semibold text-foreground">{eventUser}</strong></span>
                              </div>
                              {eventReason && (
                                <p className="text-xs text-muted-foreground/90 pt-1 leading-relaxed border-t border-border/30 mt-1">
                                  {eventReason}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payment feedback ── */}
              {paymentSuccess && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Payment link sent — status updated to Confirmed / Pending payment.
                  </p>
                </div>
              )}
              {paymentError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{paymentError}</p>
                </div>
              )}
            </>
          )}
        </div>

        {(paymentDoneError || cancelError || completeStatusError) && (
          <div className="shrink-0 mx-6 mb-2 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{paymentDoneError || cancelError || completeStatusError}</span>
          </div>
        )}

        {/* Footer */}
        {!loading && bk && (() => {
          const rawPaymentStatus = (bk?.payment_status ?? bk?.paymentStatus ?? bk?.payment_state ?? '').toString().toLowerCase().trim();
          const isCancelled = status === 'cancelled';
          const isPaid = rawPaymentStatus === 'success' || rawPaymentStatus === 'paid' || rawPaymentStatus === 'completed';
          const isPending = rawPaymentStatus === 'pending' || rawPaymentStatus === 'unpaid' || paymentSuccess;
          const isConfirmedAndPaid = status === 'confirmed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
          const isCompletedAndPaid = status === 'completed' && (rawPaymentStatus === 'success' || rawPaymentStatus === 'paid');
          const showPrintReceiptBtn = isConfirmedAndPaid || isCompletedAndPaid;

          return (
            <div className={cn(
              'shrink-0 flex flex-col border-t px-6 py-4 gap-2.5',
              isCompleted ? 'border-[#C0ABA0]/60 bg-[#C8B5A7]/30' : 'border-border/40'
            )}>
              {!isCancelled && !cancelDone && !isCompleted && !canCancel && cancellationEligibility.reason && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>{cancellationEligibility.reason}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <button
                  onClick={onClose}
                  className={cn(
                    'rounded-xl py-2.5 px-4 text-sm font-semibold transition whitespace-nowrap cursor-pointer',
                    isCompleted
                      ? 'border border-[#B8A394] bg-white/40 hover:bg-white/60 text-[#2D241E]'
                      : 'border border-border/60 bg-muted/40 hover:bg-muted text-foreground',
                    !isPending && !showPrintReceiptBtn && !(!isCancelled && !cancelDone && !isCompleted) && 'flex-1'
                  )}
                >
                  Close
                </button>
                {!isCancelled && !cancelDone && !isCompleted && (
                  <button
                    type="button"
                    onClick={handleCompleteBooking}
                    disabled={completingStatus}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition active:scale-[0.98] whitespace-nowrap cursor-pointer disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {completingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {completingStatus ? 'Completing…' : 'Mark Completed'}
                  </button>
                )}
                {showPrintReceiptBtn && (
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition active:scale-[0.98] whitespace-nowrap cursor-pointer',
                      isCompleted
                        ? 'bg-[#3D2F27] hover:bg-[#281E18] text-white'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white'
                    )}
                  >
                    <Printer className="h-4 w-4" />
                    Print Receipt
                  </button>
                )}
                {!isCancelled && !cancelDone && !isCompleted && (
                  <>
                    <button
                      type="button"
                      disabled={!canCancel}
                      onClick={handleCancelBooking}
                      title={!canCancel ? (cancellationEligibility.reason || undefined) : undefined}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition whitespace-nowrap',
                        !canCancel
                          ? 'border border-border/60 bg-muted/50 text-muted-foreground/50 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:scale-[0.98] text-white cursor-pointer'
                      )}
                    >
                      <Ban className="h-4 w-4" />
                      Cancel Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRescheduleModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition active:scale-[0.98] whitespace-nowrap cursor-pointer"
                    >
                      Reschedule Booking
                    </button>
                  </>
                )}
                {!isCancelled && !cancelDone && isPending && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentSubmitError(null);
                      setShowPaymentModal(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold text-white shadow-sm transition cursor-pointer active:scale-[0.98] whitespace-nowrap bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    Make Payment
                  </button>
                )}
                {!isCancelled && !cancelDone && !isPaid && !isPending && (
                  <button
                    onClick={handlePaymentLink}
                    disabled={paymentLoading || paymentSuccess}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition',
                      paymentLoading
                        ? 'bg-violet-400 cursor-wait'
                        : 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 active:scale-[0.98]',
                    )}
                  >
                    {paymentLoading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />&nbsp;Sending…</>
                    ) : (
                      <><CreditCard className="h-3.5 w-3.5" />&nbsp;Create Payment Link</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Payment Provider Selection Popup Modal (nested, z-[60]) ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !paymentSubmitLoading && setShowPaymentModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Payment Method</p>
                  <p className="text-sm font-bold text-foreground">
                    {customerName} {totalPrice ? `— ${currency} ${fmt(totalPrice)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {selectedProvider}
                </span>
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
            </div>

            {/* Provider Grid */}
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PAYMENT_PROVIDERS.map((provider) => {
                  const isSelected = selectedProvider === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setSelectedProvider(provider.id)}
                      className={cn(
                        'relative flex flex-col items-start p-3.5 rounded-2xl border-2 text-left transition cursor-pointer select-none',
                        isSelected
                          ? `${provider.borderColor} bg-white dark:bg-card shadow-sm`
                          : 'border-border/50 bg-card/60 hover:border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className={cn('text-xs font-extrabold', isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
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
                      <span className={cn('mt-2 inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-bold', provider.tagColor)}>
                        {provider.tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {paymentSubmitError && (
                <div className="mt-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{paymentSubmitError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border/40 px-6 py-4 bg-muted/10">
              <p className="text-xs text-muted-foreground">
                This will mark the booking as <span className="font-bold text-emerald-600 dark:text-emerald-400">paid</span> and confirmed.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentSubmitLoading}
                  className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5 text-sm font-semibold hover:bg-muted transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={paymentSubmitLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {paymentSubmitLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                  ) : (
                    <><Banknote className="h-4 w-4" />Confirm Payment</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Booking Modal */}
      {showRescheduleModal && (
        <RescheduleBookingModal
          bookingId={bookingId}
          initialBooking={booking}
          token={cleanToken}
          onClose={() => setShowRescheduleModal(false)}
          onSuccess={() => {
            fetchBooking();
            onSuccess?.();
          }}
        />
      )}

      {/* ── Booking Receipt Modal Preview & Print ── */}
      {showReceiptModal && (
        <BookingReceiptModal
          data={{
            bookingNumber: bk?.booking_number,
            reference: ref,
            customerName: customerName !== '\u2014' ? customerName : null,
            customerPhone: customerPhone !== '\u2014' ? customerPhone : null,
            customerEmail: customerEmail !== '\u2014' ? customerEmail : null,
            branchName: branchName !== '\u2014' ? branchName : null,
            arrangementName: arrName !== '\u2014' ? arrName : null,
            therapistName: therapistName !== '\u2014' ? therapistName : null,
            serviceName: svcName !== '\u2014' ? svcName : null,
            serviceCategory: svcCategory !== '\u2014' ? svcCategory : null,
            servicePrice: pricing?.service_price ?? svcObj?.price ?? bk?.service_price ?? totalPrice,
            appointmentStart: isoStart,
            appointmentEnd: isoEnd,
            timeSlot: rawTimeSlot !== '\u2014' ? rawTimeSlot : null,
            appointmentDate: dateRaw !== '\u2014' ? dateRaw : null,
            totalDuration: duration,
            serviceDuration: svcObj?.duration_minutes ?? svcObj?.base_duration,
            addons: addons.map((a) => ({
              name: a.name || a.addon_name,
              price: a.price || a.base_price,
              duration: a.duration_minutes || a.duration,
            })),
            currency,
            totalAmount: totalPrice,
            status: 'completed',
            paymentStatus: rawPaymentStatus || 'success',
            paymentMethod: bk?.payment_method || bk?.payment_provider || 'Desk Payment',
            paymentProvider: bk?.payment_provider || bk?.payment_gateway,
            transactionId: bk?.transaction_id || bk?.payment_data?.transaction_id,
            referenceId: bk?.reference_id || bk?.payment_data?.reference_id,
            paidAt: bk?.paid_at || bk?.payment_data?.paid_at,
          }}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
      {/* ── Scanned Receipt Slip Zoom Modal ── */}
      {receiptZoom && receiptImg && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setReceiptZoom(false)} />
          <div className="relative z-10 max-w-2xl w-full max-h-[85vh] flex flex-col rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-bold text-foreground">Scanned Receipt Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptZoom(false)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 dark:bg-black/40">
              <img
                src={receiptImg}
                alt="Receipt slip full view"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-border/40"
              />
            </div>
            <div className="px-5 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Invoice Reference: <strong className="font-mono text-foreground">{invoiceNumber !== '—' ? invoiceNumber : 'Attached'}</strong></p>
              <a
                href={receiptImg}
                download="booking-receipt-slip"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Original
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal Popup ── */}
      {showInvoiceModal && (
        <InvoiceDetailModal
          invoiceNumber={invoiceNumber !== '—' ? invoiceNumber : (invoiceRecord?.name || '')}
          invoiceRecord={invoiceRecord}
          bookingData={{
            customerName: customerName !== '—' ? customerName : undefined,
            customerPhone: customerPhone || undefined,
            customerEmail: customerEmail || undefined,
            serviceName: svcName !== '—' ? svcName : undefined,
            serviceCategory: svcCategory || undefined,
            servicePrice: pricing?.service_price ?? pricing?.base_price ?? totalPrice,
            addons,
            totalPrice,
            currency,
            paymentMethod: bk?.payment_method || undefined,
            paymentProvider: paymentProvider !== '—' ? paymentProvider : undefined,
            paymentThrough: paymentThrough !== '—' ? paymentThrough : undefined,
            paymentDate,
            transactionId: transactionId !== '—' ? transactionId : undefined,
            traceId: traceId !== '—' ? traceId : undefined,
            bookingNumber: bookingNum || ref,
            branchName: branchName !== '—' ? branchName : undefined,
            status,
            pricing,
          }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* ── Booking Cancellation Modal (with refund/accounting) ── */}
      {showCancellationModal && (
        <BookingCancellationModal
          bookingId={bookingId}
          bookingNumber={bookingNum || ref || null}
          invoiceNumber={invoiceNumber !== '—' ? invoiceNumber : null}
          isPaid={isPaid}
          totalAmount={parseFloat(String(totalPrice || '0')) || 0}
          totalDuration={parseInt(String(duration || '0'), 10) || 0}
          currency={currency !== '—' ? currency : 'KWD'}
          paymentMethod={paymentProvider !== '—' ? paymentProvider : null}
          customerId={
            String(bk?.customer_id ?? bk?.customer?.id ?? '').trim() || undefined
          }
          customerData={
            (bk?.customer_data as Record<string, unknown>) ??
            (bk?.customer as Record<string, unknown>) ??
            undefined
          }
          bookingType={String(bk?.booking_type ?? bk?.service_type ?? '').trim() || undefined}
          token={cleanToken}
          onClose={() => setShowCancellationModal(false)}
          onSuccess={() => {
            setShowCancellationModal(false);
            setCancelDone(true);
            fetchBooking();
            onSuccess?.();
          }}
        />
      )}
    </div>
  );
}
