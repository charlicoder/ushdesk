'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import React, { useEffect, useRef } from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  MapPin,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  BookMarked,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BookingReceiptData {
  bookingNumber?: string | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  branchName?: string | null;
  arrangementName?: string | null;
  therapistName?: string | null;
  secondaryTherapistName?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  servicePrice?: number | string | null;
  /** All booked services (one line each). When omitted the single `serviceName` is shown. */
  services?: Array<{ name?: string; category?: string | null; price?: number | string; duration?: number | string }>;
  appointmentStart?: string | null;
  appointmentEnd?: string | null;
  timeSlot?: string | null;
  appointmentDate?: string | null;
  totalDuration?: number | string | null;
  serviceDuration?: number | string | null;
  addonsDuration?: number | string | null;
  extraMinutes?: number | string | null;
  extraPrice?: number | string | null;
  addons?: Array<{ name?: string; price?: number | string; duration?: number | string }>;
  currency?: string | null;
  subtotal?: number | string | null;
  discount?: number | string | null;
  totalAmount?: number | string | null;
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  transactionId?: string | null;
  referenceId?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  notes?: string | null;
  // Course Redemption additions
  isCourseRedemption?: boolean;
  courseCode?: string | null;
  courseName?: string | null;
  courseSubscriptionNumber?: string | null;
  currentSessionNumber?: number | null;
  totalSessions?: number | null;
  remainingSessions?: number | null;
  subscriptionPrice?: number | string | null;
  subscriptionPaymentMethod?: string | null;
  subscriptionPaymentProvider?: string | null;
  subscriptionInvoiceNumber?: string | null;
  // Gift Voucher Redemption additions
  isVoucherRedemption?: boolean;
  isVoucherPackage?: boolean;
  voucherPackageName?: string | null;
  voucherPackagePrice?: number | string | null;
  voucherCode?: string | null;
  isPartialRedeem?: boolean;
  redeemedServices?: Array<{ name?: string; duration?: number | string }> | null;
  remainingServices?: Array<{ name?: string; duration?: number | string }> | null;
}

interface BookingReceiptModalProps {
  data: BookingReceiptData;
  onClose: () => void;
}

export function BookingReceiptModal({ data, onClose }: BookingReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currency = data.currency || 'KWD';
  const totalAmountNum = parseFloat(String(data.totalAmount ?? '0')) || 0;
  const servicePriceNum = parseFloat(String(data.servicePrice ?? '0')) || 0;
  const extraPriceNum = parseFloat(String(data.extraPrice ?? '0')) || 0;
  const receiptRefNumber = data.invoiceNumber || data.reference || data.bookingNumber || 'RECEIPT';
  const bookingNumber = data.bookingNumber || (data.reference !== receiptRefNumber ? data.reference : null);

  // Format date helper
  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return val;
    }
  };

  // Format time helper
  const formatTime = (val?: string | null) => {
    if (!val) return '';
    try {
      if (/^\d{1,2}:\d{2}/.test(val)) return val;
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleTimeString('en-US', { timeZone: KUWAIT_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return val;
    }
  };

  const displayDate = data.appointmentDate || formatDate(data.appointmentStart);
  const displayTime =
    data.timeSlot ||
    (data.appointmentStart && data.appointmentEnd
      ? `${formatTime(data.appointmentStart)} – ${formatTime(data.appointmentEnd)}`
      : formatTime(data.appointmentStart) || '—');

  // Isolated print using hidden iframe for thermal / desktop receipt printing
  const handlePrint = () => {
    const receiptElement = receiptRef.current;
    if (!receiptElement) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${receiptRefNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          @media print {
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 10px;
            color: #111827;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
          }
          * { box-sizing: border-box; }
          .receipt-box {
            max-width: 360px;
            margin: 0 auto;
            background: #ffffff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700; }
          .font-extrabold { font-weight: 800; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .border-t { border-top: 1px solid #e5e7eb; }
          .border-b { border-bottom: 1px solid #e5e7eb; }
          .border-dashed { border-style: dashed; }
          .my-1 { margin-top: 4px; margin-bottom: 4px; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
          .my-3 { margin-top: 12px; margin-bottom: 12px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .text-xs { font-size: 11px; }
          .text-sm { font-size: 13px; }
          .text-lg { font-size: 16px; }
          .text-xl { font-size: 18px; }
          .text-muted { color: #6b7280; }
          .uppercase { text-transform: uppercase; }
          .tracking-wider { letter-spacing: 0.05em; }
          .grid { display: grid; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .gap-1 { gap: 4px; }
          .gap-1\.5 { gap: 6px; }
          .p-1 { padding: 4px; }
          .p-1\.5 { padding: 6px; }
          .p-3 { padding: 12px; }
          .rounded { border-radius: 6px; }
          .rounded-lg { border-radius: 8px; }
          .rounded-xl { border-radius: 12px; }
          .rounded-full { border-radius: 9999px; }
          .bg-slate-50 { background-color: #f8fafc; }
          .bg-white { background-color: #ffffff; }
          .bg-amber-50 { background-color: #fffbeb; }
          .bg-amber-100 { background-color: #fef3c7; }
          .bg-emerald-100 { background-color: #d1fae5; }
          .bg-emerald-600 { background-color: #059669; }
          .bg-amber-500 { background-color: #f59e0b; }
          .border { border: 1px solid #e2e8f0; }
          .border-amber-200 { border-color: #fde68a; }
          .text-emerald-700 { color: #047857; }
          .text-emerald-800 { color: #065f46; }
          .text-amber-700 { color: #b45309; }
          .text-amber-800 { color: #92400e; }
          .text-amber-900 { color: #78350f; }
          .text-slate-400 { color: #94a3b8; }
          .text-slate-500 { color: #64748b; }
          .text-slate-700 { color: #334155; }
          .text-slate-900 { color: #0f172a; }
          .italic { font-style: italic; }
          .pl-1 { padding-left: 4px; }
          .pl-2 { padding-left: 8px; }
          .font-semibold { font-weight: 600; }
          .font-black { font-weight: 900; }
          .barcode-container {
            display: flex;
            justify-content: center;
            margin: 12px 0 6px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          ${receiptElement.innerHTML}
        </div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              window.frameElement.remove();
            }, 1200);
          };
        </script>
      </body>
      </html>
    `);
    doc.close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg flex flex-col max-h-[92vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/40 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Receipt Preview</h3>
              <p className="text-[11px] font-mono text-muted-foreground">{receiptRefNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/20">
          <div
            ref={receiptRef}
            id="ush-printable-receipt"
            className="mx-auto w-full max-w-[380px] bg-white text-slate-900 rounded-2xl shadow-lg border border-slate-200 p-6 font-sans text-xs select-text"
          >
            {/* Header: Spa Logo & Info */}
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
              <div className="inline-flex items-center justify-center gap-1.5 text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span className="text-lg font-black tracking-widest uppercase">USH SPA</span>
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Luxury Spa &amp; Wellness Center
              </p>
              {data.branchName && (
                <p className="text-xs font-bold text-slate-800">{data.branchName}</p>
              )}
              <p className="text-[10px] text-slate-500">
                State of Kuwait &bull; desk.ushspa.co
              </p>
              <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 className="h-3 w-3" /> COMPLETED
                </span>
                {data.isCourseRedemption ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs" style={{ background: '#543C30' }}>
                    <BookMarked className="h-3 w-3 text-white" /> COURSE REDEMPTION
                  </span>
                ) : data.isVoucherPackage ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs bg-amber-700">
                    <Gift className="h-3 w-3 text-white" /> {data.isPartialRedeem ? 'PARTIAL PACKAGE REDEEM' : 'GIFT PACKAGE REDEMPTION'}
                  </span>
                ) : data.isVoucherRedemption ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs bg-emerald-700">
                    <Gift className="h-3 w-3 text-white" /> {data.isPartialRedeem ? 'PARTIAL VOUCHER REDEEM' : 'GIFT VOUCHER REDEEM'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" /> PAID
                  </span>
                )}
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt / Ref #:</span>
                <span className="font-mono font-bold text-slate-900">{receiptRefNumber}</span>
              </div>
              {bookingNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking #:</span>
                  <span className="font-mono font-bold text-slate-900">{bookingNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Issue Date:</span>
                <span className="font-medium text-slate-800">
                  {new Date().toLocaleDateString('en-US', { timeZone: KUWAIT_TZ,
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Appt Date:</span>
                <span className="font-bold text-slate-900">{displayDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span className="font-bold text-slate-900">{displayTime}</span>
              </div>
              {data.totalDuration && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Duration:</span>
                  <span className="font-bold text-slate-900">{data.totalDuration} mins</span>
                </div>
              )}
            </div>

            {/* Guest & Appointment Details */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Guest:</span>
                <span className="font-bold text-slate-900 text-right">
                  {data.customerName || 'Valued Guest'}
                </span>
              </div>
              {data.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-800">{data.customerPhone}</span>
                </div>
              )}
              {data.therapistName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Therapist{data.secondaryTherapistName ? ' 1' : ''}:</span>
                  <span className="font-semibold text-slate-800">{data.therapistName}</span>
                </div>
              )}
              {data.secondaryTherapistName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Therapist 2:</span>
                  <span className="font-semibold text-slate-800">{data.secondaryTherapistName}</span>
                </div>
              )}
              {data.arrangementName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Arrangement:</span>
                  <span className="font-semibold text-slate-800">{data.arrangementName}</span>
                </div>
              )}
            </div>

            {/* Course Package & Session Progress for Course Redemption */}
            {data.isCourseRedemption && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
                <div className="flex justify-between items-start text-slate-900">
                  <span className="text-slate-500 font-semibold">Course:</span>
                  <span className="font-bold text-right text-slate-900 max-w-[220px]">
                    {data.courseCode ? `[${data.courseCode}] ` : ''}{data.courseName || 'Course Package'}
                  </span>
                </div>
                {data.courseSubscriptionNumber && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-semibold">Subscription #:</span>
                    <span className="font-mono font-bold text-slate-900">{data.courseSubscriptionNumber}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-dashed border-slate-200 grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Current</span>
                    <span className="font-black text-slate-900 text-xs">Session #{data.currentSessionNumber ?? 1}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Total</span>
                    <span className="font-bold text-slate-700 text-xs">{data.totalSessions ?? 1} Sessions</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Remaining</span>
                    <span className="font-bold text-emerald-700 text-xs">{data.remainingSessions ?? 0} Left</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gift Package Card (when package voucher) */}
            {data.isVoucherPackage && !data.isCourseRedemption && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-start text-slate-900">
                  <span className="text-slate-500 font-semibold">Gift Package:</span>
                  <span className="font-bold text-right text-slate-900 max-w-[220px]">
                    {data.voucherPackageName || data.serviceName || 'Spa Package'}
                  </span>
                </div>
                {data.voucherCode && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-semibold">Voucher Code:</span>
                    <span className="font-mono font-bold text-slate-900">{data.voucherCode}</span>
                  </div>
                )}
                {data.voucherPackagePrice != null && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500 font-semibold">Package Price:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {(parseFloat(String(data.voucherPackagePrice)) || 0).toFixed(3)} {currency} (Prepaid)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Partial Voucher Redemption Details (explaining which services redeemed and which remain) */}
            {(data.isPartialRedeem || (data.remainingServices && data.remainingServices.length > 0)) && (
              <div className="my-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] space-y-2">
                <div className="flex items-center justify-between text-amber-900 border-b border-amber-200/70 pb-1.5">
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-900">
                    Partial Voucher Redemption
                  </span>
                  {data.voucherCode && (
                    <span className="font-mono font-bold text-[10px] text-amber-800">
                      #{data.voucherCode}
                    </span>
                  )}
                </div>

                {/* Services Redeemed Now */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    ✓ Redeemed in this booking ({data.redeemedServices?.length || data.services?.length || 1}):
                  </p>
                  <div className="mt-1 space-y-1 pl-1">
                    {(data.redeemedServices && data.redeemedServices.length > 0
                      ? data.redeemedServices
                      : data.services && data.services.length > 0
                      ? data.services
                      : [{ name: data.serviceName || 'Spa Service' }]
                    ).map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-800 text-[11px]">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                          <span>{s.name || 'Service'}</span>
                        </span>
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                          Redeemed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services Remaining on Voucher */}
                {data.remainingServices && data.remainingServices.length > 0 && (
                  <div className="pt-2 border-t border-dashed border-amber-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      ⏳ Remaining on Voucher ({data.remainingServices.length}):
                    </p>
                    <div className="mt-1 space-y-1 pl-1">
                      {data.remainingServices.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-slate-700 text-[11px]">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>{s.name || 'Service'}</span>
                          </span>
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                            Remaining
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-800/80 pt-1 italic">
                      Remaining services can be redeemed in future visits using voucher code #{data.voucherCode || 'on file'}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Itemized Services & Addons */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Description</span>
                <span>Amount</span>
              </div>

              {/* Services (one line per service) */}
              {data.services && data.services.length > 0 ? (
                <div className="space-y-1.5">
                  {data.services.map((sv, idx) => {
                    const p = parseFloat(String(sv.price ?? '0')) || 0;
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-900 text-xs">
                          <span>
                            {data.services && data.services.length > 1 ? `#${idx + 1} ` : ''}
                            {sv.name || 'Spa Service'}
                            {data.isCourseRedemption && (
                              <span className="text-[10px] text-emerald-700 block font-normal">
                                (Session #{data.currentSessionNumber ?? 1} of {data.totalSessions ?? 1} · Package Covered)
                              </span>
                            )}
                            {data.isVoucherPackage && (
                              <span className="text-[10px] text-emerald-700 block font-normal">
                                (Included in Gift Package)
                              </span>
                            )}
                          </span>
                          <span className="font-mono">
                            {data.isCourseRedemption
                              ? `0.000 ${currency}`
                              : data.isVoucherPackage
                              ? 'Included'
                              : `${p.toFixed(3)} ${currency}`}
                          </span>
                        </div>
                        {Number(sv.duration ?? 0) > 0 && (
                          <p className="text-[10px] text-slate-500">{sv.duration} mins</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-900 text-xs">
                    <span>
                      {data.serviceName || 'Spa Service'}
                      {data.isCourseRedemption && (
                        <span className="text-[10px] text-emerald-700 block font-normal">
                          (Session #{data.currentSessionNumber ?? 1} of {data.totalSessions ?? 1} · Package Covered)
                        </span>
                      )}
                      {data.isVoucherPackage && (
                        <span className="text-[10px] text-emerald-700 block font-normal">
                          (Included in Gift Package)
                        </span>
                      )}
                    </span>
                    <span className="font-mono">
                      {data.isCourseRedemption
                        ? `0.000 ${currency}`
                        : data.isVoucherPackage
                        ? 'Included'
                        : servicePriceNum > 0
                        ? `${servicePriceNum.toFixed(3)} ${currency}`
                        : totalAmountNum > 0
                        ? `${totalAmountNum.toFixed(3)} ${currency}`
                        : `0.000 ${currency}`}
                    </span>
                  </div>
                  {data.serviceDuration && (
                    <p className="text-[10px] text-slate-500">{data.serviceDuration} mins base service</p>
                  )}
                </div>
              )}

              {/* Addons */}
              {data.addons && data.addons.length > 0 && (
                <div className="pt-1 space-y-1">
                  {data.addons.map((a, idx) => {
                    const aPrice = parseFloat(String(a.price ?? '0')) || 0;
                    return (
                      <div key={idx} className="flex justify-between text-[11px] text-slate-700">
                        <span>
                          + {a.name || `Add-on #${idx + 1}`}
                          {a.duration ? ` (${a.duration}m)` : ''}
                        </span>
                        <span className="font-mono font-medium">+{aPrice.toFixed(3)} {currency}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extra Minutes */}
              {Number(data.extraMinutes ?? 0) > 0 && (
                <div className="flex justify-between text-[11px] text-amber-800 pt-0.5">
                  <span>+ Extra Time ({data.extraMinutes} mins)</span>
                  <span className="font-mono font-medium">+{extraPriceNum.toFixed(3)} {currency}</span>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>
                  {data.isCourseRedemption
                    ? 'Session Standard Value:'
                    : data.isVoucherPackage
                    ? 'Package Price:'
                    : 'Subtotal:'}
                </span>
                <span className="font-mono">
                  {data.isVoucherPackage
                    ? `${(parseFloat(String(data.voucherPackagePrice ?? data.subtotal ?? totalAmountNum)) || totalAmountNum).toFixed(3)} ${currency}`
                    : data.subtotal != null
                    ? `${(parseFloat(String(data.subtotal)) || 0).toFixed(3)} ${currency}`
                    : `${(totalAmountNum + (parseFloat(String(data.discount ?? '0')) || 0)).toFixed(3)} ${currency}`}
                </span>
              </div>
              {data.isCourseRedemption ? (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Course Package Coverage:</span>
                  <span className="font-mono font-bold">-100% (Redeemed)</span>
                </div>
              ) : data.isVoucherPackage || data.isVoucherRedemption ? (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Gift Voucher Coverage:</span>
                  <span className="font-mono font-bold">-100% (Redeemed)</span>
                </div>
              ) : Number(data.discount ?? 0) > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono font-bold">-{(parseFloat(String(data.discount)) || 0).toFixed(3)} {currency}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-600">
                <span>Tax / VAT (0%):</span>
                <span className="font-mono">0.000 {currency}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
                <span className="text-sm font-extrabold text-slate-900 uppercase">
                  {data.isCourseRedemption || data.isVoucherRedemption ? 'Visit Balance Due:' : 'Total Paid:'}
                </span>
                <span className={cn('text-base font-black font-mono', (data.isCourseRedemption || data.isVoucherRedemption) ? 'text-emerald-700' : 'text-slate-900')}>
                  {data.isCourseRedemption || data.isVoucherRedemption ? '0.000' : totalAmountNum.toFixed(3)} <span className="text-xs font-semibold">{currency}</span>
                </span>
              </div>
              {data.isCourseRedemption && (
                <div className="text-[10px] text-slate-500 pt-0.5 text-right font-medium">
                  {data.subscriptionPrice
                    ? `Course Package: ${Number(data.subscriptionPrice).toFixed(3)} ${currency} (Prepaid in full)`
                    : 'Prepaid via Course Subscription'}
                </div>
              )}
              {data.isVoucherPackage && (
                <div className="text-[10px] text-slate-500 pt-0.5 text-right font-medium">
                  {`Gift Package: ${(parseFloat(String(data.voucherPackagePrice ?? totalAmountNum)) || 0).toFixed(3)} ${currency} (Prepaid in full)`}
                </div>
              )}
            </div>

            {/* Payment Method / Audit */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {data.isCourseRedemption
                    ? `Course Package (${data.subscriptionPaymentProvider || data.subscriptionPaymentMethod || 'Prepaid'})`
                    : data.isVoucherRedemption
                    ? `Gift Voucher (${data.paymentProvider || 'Prepaid'})`
                    : data.paymentMethod || data.paymentProvider || 'Desk Payment (Confirmed)'}
                </span>
              </div>
              {data.isCourseRedemption && data.courseSubscriptionNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Subscription Ref:</span>
                  <span className="font-mono font-bold text-slate-800">{data.courseSubscriptionNumber}</span>
                </div>
              )}
              {data.isVoucherRedemption && data.voucherCode && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Voucher Code:</span>
                  <span className="font-mono font-bold text-slate-800">{data.voucherCode}</span>
                </div>
              )}
              {(data.subscriptionInvoiceNumber || data.invoiceNumber) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice No:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {data.subscriptionInvoiceNumber || data.invoiceNumber}
                  </span>
                </div>
              )}
              {data.transactionId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[180px]">{data.transactionId}</span>
                </div>
              )}
              {data.referenceId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref ID:</span>
                  <span className="font-mono text-slate-700">{data.referenceId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status:</span>
                <span className="font-bold text-emerald-700 uppercase">Paid / Completed</span>
              </div>
            </div>

            {/* Decorative Barcode / Footer */}
            <div className="pt-4 text-center space-y-2">
              <div className="flex justify-center items-center gap-[2px] h-8 px-4 opacity-80">
                {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1].map((w, i) => (
                  <div
                    key={i}
                    style={{ width: `${w * 1.5}px` }}
                    className="h-full bg-slate-900"
                  />
                ))}
              </div>
              <p className="font-mono text-[9px] text-slate-500 tracking-widest">{receiptRefNumber}</p>

              <div className="pt-2 text-[10px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Thank you for visiting USH Spa!</p>
                <p>We look forward to welcoming you back for another relaxing experience.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border/40 px-6 py-4 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
