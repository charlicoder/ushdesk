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
  services?: Array<{
    name?: string;
    category?: string | null;
    price?: number | string;
    duration?: number | string;
    therapistName?: string | null;
    secondaryTherapistName?: string | null;
    arrangementName?: string | null;
  }>;
  isPackageBooking?: boolean;
  packageName?: string | null;
  packagePrice?: number | string | null;
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
  const addonsTotal = (data.addons || []).reduce(
    (sum, a) => sum + (parseFloat(String(a.price ?? '0')) || 0),
    0
  );
  const packagePriceNum = parseFloat(String(data.packagePrice ?? data.voucherPackagePrice ?? '0')) || 0;
  const isPackageServiceBooking = Boolean(
    data.isPackageBooking ||
    data.isVoucherPackage ||
    (!data.isCourseRedemption &&
      !data.isVoucherRedemption &&
      data.services &&
      data.services.length > 1 &&
      data.services.some((s) => (parseFloat(String(s.price ?? '0')) || 0) > 0) &&
      data.services.some((s) => (parseFloat(String(s.price ?? '0')) || 0) === 0))
  );
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
            * {
              color: #000000 !important;
              font-weight: 700 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .border-t, .border-b, .border, .border-dashed {
              border-color: #000000 !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 10px;
            color: #000000 !important;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
            font-weight: 700 !important;
          }
          * { 
            box-sizing: border-box; 
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .receipt-box {
            max-width: 360px;
            margin: 0 auto;
            background: #ffffff;
            color: #000000 !important;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700 !important; }
          .font-extrabold { font-weight: 800 !important; }
          .font-black { font-weight: 900 !important; }
          .font-semibold { font-weight: 700 !important; }
          .font-medium { font-weight: 700 !important; }
          .font-normal { font-weight: 700 !important; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700 !important; }
          .border-t { border-top: 1px solid #000000 !important; }
          .border-b { border-bottom: 1px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; }
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
          .text-muted { color: #000000 !important; font-weight: 700 !important; }
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
          .bg-slate-50 { background-color: #ffffff; border: 1px solid #000000 !important; }
          .bg-white { background-color: #ffffff; }
          .bg-amber-50 { background-color: #ffffff; border: 1px solid #000000 !important; }
          .bg-amber-100 { background-color: #ffffff; border: 1px solid #000000 !important; }
          .bg-emerald-100 { background-color: #ffffff; border: 1px solid #000000 !important; }
          .bg-emerald-600 { background-color: #000000 !important; }
          .bg-amber-500 { background-color: #000000 !important; }
          .border { border: 1px solid #000000 !important; }
          .border-amber-200 { border-color: #000000 !important; }
          .border-emerald-200 { border-color: #000000 !important; }
          .border-slate-200 { border-color: #000000 !important; }
          .border-slate-300 { border-color: #000000 !important; }
          .text-emerald-700, .text-emerald-800, .text-emerald-900 { color: #000000 !important; font-weight: 700 !important; }
          .text-amber-700, .text-amber-800, .text-amber-900 { color: #000000 !important; font-weight: 700 !important; }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-slate-700, .text-slate-800, .text-slate-900 { color: #000000 !important; font-weight: 700 !important; }
          .italic { font-style: italic; }
          .pl-1 { padding-left: 4px; }
          .pl-2 { padding-left: 8px; }
          .barcode-container {
            display: flex;
            justify-content: center;
            margin: 12px 0 6px 0;
          }
          svg {
            stroke: #000000 !important;
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
            className="mx-auto w-full max-w-[380px] bg-white text-black font-bold rounded-2xl shadow-lg border border-black p-6 font-sans text-xs select-text"
          >
            {/* Header: Spa Logo & Info */}
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-black">
              <div className="inline-flex items-center justify-center gap-1.5 text-black">
                <Sparkles className="h-4 w-4 text-black" />
                <span className="text-lg font-black tracking-widest uppercase text-black">USH SPA</span>
                <Sparkles className="h-4 w-4 text-black" />
              </div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-black">
                Luxury Spa &amp; Wellness Center
              </p>
              {data.branchName && (
                <p className="text-xs font-black text-black">{data.branchName}</p>
              )}
              <p className="text-[10px] font-bold text-black">
                State of Kuwait &bull; desk.ushspa.co
              </p>
              <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-black border border-black px-2.5 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 className="h-3 w-3 text-black" /> COMPLETED
                </span>
                {data.isCourseRedemption ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-black border border-black bg-slate-100">
                    <BookMarked className="h-3 w-3 text-black" /> COURSE REDEMPTION
                  </span>
                ) : data.isVoucherPackage ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-black border border-black bg-slate-100">
                    <Gift className="h-3 w-3 text-black" /> {data.isPartialRedeem ? 'PARTIAL REDEEM' : 'GIFT PACKAGE REDEEM'}
                  </span>
                ) : data.isVoucherRedemption ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-black border border-black bg-slate-100">
                    <Gift className="h-3 w-3 text-black" /> {data.isPartialRedeem ? 'PARTIAL REDEEM' : 'GIFT VOUCHER REDEEM'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-black border border-black px-2.5 py-0.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3 text-black" /> PAID
                  </span>
                )}
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="py-3 border-b border-dashed border-black space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold text-black">Receipt / Ref #:</span>
                <span className="font-mono font-bold text-black">{receiptRefNumber}</span>
              </div>
              {bookingNumber && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Booking #:</span>
                  <span className="font-mono font-bold text-black">{bookingNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold text-black">Issue Date:</span>
                <span className="font-bold text-black">
                  {new Date().toLocaleDateString('en-US', { timeZone: KUWAIT_TZ,
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-black">Appt Date:</span>
                <span className="font-bold text-black">{displayDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-black">Time:</span>
                <span className="font-bold text-black">{displayTime}</span>
              </div>
              {data.totalDuration && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Total Duration:</span>
                  <span className="font-bold text-black">{data.totalDuration} mins</span>
                </div>
              )}
            </div>

            {/* Guest & Appointment Details */}
            <div className="py-3 border-b border-dashed border-black space-y-1.5 text-[11px]">
              <div className="flex justify-between items-start">
                <span className="font-bold text-black">Guest:</span>
                <span className="font-black text-black text-right">
                  {data.customerName || 'Valued Guest'}
                </span>
              </div>
              {data.customerPhone && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Phone:</span>
                  <span className="font-mono font-bold text-black">{data.customerPhone}</span>
                </div>
              )}
            </div>

            {/* Course Package & Session Progress for Course Redemption */}
            {data.isCourseRedemption && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-black space-y-2 text-[11px]">
                <div className="flex justify-between items-start text-black">
                  <span className="font-bold text-black">Course:</span>
                  <span className="font-black text-right text-black max-w-[220px]">
                    {data.courseCode ? `[${data.courseCode}] ` : ''}{data.courseName || 'Course Package'}
                  </span>
                </div>
                {data.courseSubscriptionNumber && (
                  <div className="flex justify-between items-center text-black">
                    <span className="font-bold text-black">Subscription #:</span>
                    <span className="font-mono font-bold text-black">{data.courseSubscriptionNumber}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-dashed border-black grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-white border border-black">
                    <span className="text-[9px] uppercase tracking-wider text-black block font-bold">Current</span>
                    <span className="font-black text-black text-xs">Session #{data.currentSessionNumber ?? 1}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-black">
                    <span className="text-[9px] uppercase tracking-wider text-black block font-bold">Total</span>
                    <span className="font-bold text-black text-xs">{data.totalSessions ?? 1} Sessions</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-white border border-black">
                    <span className="text-[9px] uppercase tracking-wider text-black block font-bold">Remaining</span>
                    <span className="font-bold text-black text-xs">{data.remainingSessions ?? 0} Left</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gift Package Card (when package voucher) */}
            {data.isVoucherPackage && !data.isCourseRedemption && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-black space-y-1.5 text-[11px]">
                <div className="flex justify-between items-start text-black">
                  <span className="font-bold text-black">Gift Package:</span>
                  <span className="font-black text-right text-black max-w-[220px]">
                    {data.voucherPackageName || data.serviceName || 'Spa Package'}
                  </span>
                </div>
                {data.voucherCode && (
                  <div className="flex justify-between items-center text-black">
                    <span className="font-bold text-black">Voucher Code:</span>
                    <span className="font-mono font-bold text-black">{data.voucherCode}</span>
                  </div>
                )}
                {data.voucherPackagePrice != null && (
                  <div className="flex justify-between items-center text-black">
                    <span className="font-bold text-black">Package Price:</span>
                    <span className="font-mono font-bold text-black">
                      {(parseFloat(String(data.voucherPackagePrice)) || 0).toFixed(3)} {currency} (Prepaid)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Partial Voucher Redemption Details (explaining which services redeemed and which remain) */}
            {(data.isPartialRedeem || (data.remainingServices && data.remainingServices.length > 0)) && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-black text-[11px] space-y-2">
                <div className="flex items-center justify-between text-black border-b border-black pb-1.5">
                  <span className="font-black uppercase tracking-wider text-[10px] text-black flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-black" />
                    Partial Voucher Redemption (Partial Redeem)
                  </span>
                  {data.voucherCode && (
                    <span className="font-mono font-bold text-[10px] text-black">
                      #{data.voucherCode}
                    </span>
                  )}
                </div>

                {/* Services Redeemed Now */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                    ✓ Redeemed in this booking ({data.redeemedServices?.length || data.services?.length || 1}):
                  </p>
                  <div className="mt-1 space-y-1 pl-1">
                    {(data.redeemedServices && data.redeemedServices.length > 0
                      ? data.redeemedServices
                      : data.services && data.services.length > 0
                      ? data.services
                      : [{ name: data.serviceName || 'Spa Service' }]
                    ).map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-black text-[11px]">
                        <span className="flex items-center gap-1.5 font-bold text-black">
                          <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                          <span>{s.name || 'Service'}{s.duration ? ` (${s.duration}m)` : ''}</span>
                        </span>
                        <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                          Redeemed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {data.addons && data.addons.length > 0 && (
                  <div className="pt-2 border-t border-dashed border-black">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                      ✓ Add-ons in this booking ({data.addons.length}):
                    </p>
                    <div className="mt-1 space-y-1 pl-1">
                      {data.addons.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between text-black text-[11px]">
                          <span className="flex items-center gap-1.5 font-bold text-black">
                            <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                            <span>{a.name || 'Add-on'}{a.duration ? ` (${a.duration}m)` : ''}</span>
                          </span>
                          <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                            Included
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Services Remaining on Voucher */}
                {data.remainingServices && data.remainingServices.length > 0 && (
                  <div className="pt-2 border-t border-dashed border-black">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                      ⏳ Remaining for Next Booking ({data.remainingServices.length}):
                    </p>
                    <div className="mt-1 space-y-1 pl-1">
                      {data.remainingServices.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-black text-[11px]">
                          <span className="flex items-center gap-1.5 font-bold text-black">
                            <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                            <span>{s.name || 'Service'}{s.duration ? ` (${s.duration}m)` : ''}</span>
                          </span>
                          <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                            Remaining
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-black font-bold pt-1 italic">
                      Partial redeem: Remaining services can be redeemed in future visits using voucher code #{data.voucherCode || 'on file'}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Full Voucher Redemption Details: All services from gift voucher included in this booking */}
            {(data.isVoucherRedemption || data.isVoucherPackage) && !data.isPartialRedeem && (!data.remainingServices || data.remainingServices.length === 0) && (
              <div className="my-3 p-3 rounded-xl bg-slate-50 border border-black text-[11px] space-y-2">
                <div className="flex items-center justify-between text-black border-b border-black pb-1.5">
                  <span className="font-black uppercase tracking-wider text-[10px] text-black flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-black" />
                    All Services Included in this Booking
                  </span>
                  {data.voucherCode && (
                    <span className="font-mono font-bold text-[10px] text-black">
                      #{data.voucherCode}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                    ✓ Services from Gift Voucher ({((data.redeemedServices && data.redeemedServices.length > 0) ? data.redeemedServices : (data.services && data.services.length > 0) ? data.services : [{ name: data.serviceName }]).length}):
                  </p>
                  <div className="mt-1 space-y-1 pl-1">
                    {((data.redeemedServices && data.redeemedServices.length > 0)
                      ? data.redeemedServices
                      : (data.services && data.services.length > 0)
                      ? data.services
                      : [{ name: data.serviceName || 'Spa Service' }]
                    ).map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-black text-[11px]">
                        <span className="flex items-center gap-1.5 font-bold text-black">
                          <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                          <span>{s.name || 'Service'}{s.duration ? ` (${s.duration}m)` : ''}</span>
                        </span>
                        <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                          Included
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {data.addons && data.addons.length > 0 && (
                  <div className="pt-2 border-t border-dashed border-black">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black">
                      ✓ Add-ons from Gift Voucher ({data.addons.length}):
                    </p>
                    <div className="mt-1 space-y-1 pl-1">
                      {data.addons.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between text-black text-[11px]">
                          <span className="flex items-center gap-1.5 font-bold text-black">
                            <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                            <span>{a.name || 'Add-on'}{a.duration ? ` (${a.duration}m)` : ''}</span>
                          </span>
                          <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                            Included
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Itemized Services & Addons */}
            <div className="py-3 border-b border-dashed border-black space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-black">
                <span>Description</span>
                {(!isPackageServiceBooking && !data.isVoucherPackage && !data.isVoucherRedemption) && (
                  <span>Amount</span>
                )}
              </div>

              {/* Services (one line per service/session) */}
              {data.services && data.services.length > 0 ? (
                <div className="space-y-1.5">
                  {data.services.map((sv, idx) => {
                    const rawP = parseFloat(String(sv.price ?? '0')) || 0;
                    let p = rawP;
                    const isPkg = Boolean(
                      data.isPackageBooking ||
                      data.isVoucherPackage ||
                      (data.packageName && sv.name && sv.name.toLowerCase().includes(data.packageName.toLowerCase())) ||
                      (sv.name && sv.name.toLowerCase().includes('package'))
                    );
                    if (isPkg && packagePriceNum > 0 && (p === totalAmountNum || p > packagePriceNum)) {
                      p = packagePriceNum;
                    } else if ((data.services?.length ?? 1) <= 1 && (addonsTotal > 0 || extraPriceNum > 0)) {
                      const rawDiscount = parseFloat(String(data.discount ?? '0')) || 0;
                      const grossTotal = totalAmountNum + rawDiscount;
                      if (p === totalAmountNum || p === grossTotal) {
                        p = Math.max(0, p - addonsTotal - extraPriceNum);
                      }
                    }
                    const itemTherapist = sv.therapistName || data.therapistName || null;
                    const itemSecTherapist = sv.secondaryTherapistName || (idx === 0 ? data.secondaryTherapistName : null) || null;
                    const itemArrangement = sv.arrangementName || data.arrangementName || null;
                    const metaParts = [
                      Number(sv.duration ?? 0) > 0 ? `${sv.duration} mins` : null,
                      itemTherapist && itemTherapist !== '—'
                        ? `Therapist: ${itemTherapist}${itemSecTherapist && itemSecTherapist !== '—' ? ` + ${itemSecTherapist}` : ''}`
                        : null,
                      itemArrangement && itemArrangement !== '—' ? itemArrangement : null,
                    ].filter(Boolean);
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between font-black text-black text-xs">
                          <span>
                            {data.services && data.services.length > 1 ? `#${idx + 1} ` : ''}
                            {sv.name || 'Spa Service'}
                            {data.isCourseRedemption && (
                              <span className="text-[10px] text-black block font-bold">
                                (Session #{data.currentSessionNumber ?? 1} of {data.totalSessions ?? 1} · Package Covered)
                              </span>
                            )}
                            {data.isVoucherPackage && (
                              <span className="text-[10px] text-black block font-bold">
                                (Included in Gift Package)
                              </span>
                            )}
                          </span>
                          {!isPackageServiceBooking && (
                            <span className="font-mono font-bold text-black">
                              {data.isCourseRedemption
                                ? `0.000 ${currency}`
                                : `${p.toFixed(3)} ${currency}`}
                            </span>
                          )}
                        </div>
                        {metaParts.length > 0 && (
                          <p className="text-[10px] text-black font-bold">{metaParts.join(' · ')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex justify-between font-black text-black text-xs">
                    <span>
                      {data.serviceName || 'Spa Service'}
                      {data.isCourseRedemption && (
                        <span className="text-[10px] text-black block font-bold">
                          (Session #{data.currentSessionNumber ?? 1} of {data.totalSessions ?? 1} · Package Covered)
                        </span>
                      )}
                      {data.isVoucherPackage && (
                        <span className="text-[10px] text-black block font-bold">
                          (Included in Gift Package)
                        </span>
                      )}
                    </span>
                    {!isPackageServiceBooking && (
                      <span className="font-mono font-bold text-black">
                        {data.isCourseRedemption
                          ? `0.000 ${currency}`
                          : (() => {
                              let dispPrice = servicePriceNum > 0 ? servicePriceNum : totalAmountNum;
                              const isSinglePkg = Boolean(
                                data.isPackageBooking ||
                                data.isVoucherPackage ||
                                (data.serviceName && data.serviceName.toLowerCase().includes('package'))
                              );
                              if (isSinglePkg && packagePriceNum > 0 && (dispPrice === totalAmountNum || dispPrice > packagePriceNum)) {
                                dispPrice = packagePriceNum;
                              } else if (addonsTotal > 0 || extraPriceNum > 0) {
                                const rawDiscount = parseFloat(String(data.discount ?? '0')) || 0;
                                const grossTotal = totalAmountNum + rawDiscount;
                                if (dispPrice === totalAmountNum || dispPrice === grossTotal) {
                                  dispPrice = Math.max(0, dispPrice - addonsTotal - extraPriceNum);
                                }
                              }
                              return `${dispPrice.toFixed(3)} ${currency}`;
                            })()}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const singleMetaParts = [
                      data.serviceDuration ? `${data.serviceDuration} mins` : (data.totalDuration ? `${data.totalDuration} mins` : null),
                      data.therapistName && data.therapistName !== '—'
                        ? `Therapist: ${data.therapistName}${data.secondaryTherapistName && data.secondaryTherapistName !== '—' ? ` + ${data.secondaryTherapistName}` : ''}`
                        : null,
                      data.arrangementName && data.arrangementName !== '—' ? data.arrangementName : null,
                    ].filter(Boolean);
                    return singleMetaParts.length > 0 ? (
                      <p className="text-[10px] text-black font-bold">{singleMetaParts.join(' · ')}</p>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Addons */}
              {data.addons && data.addons.length > 0 && (
                <div className="pt-1 space-y-1">
                  {data.addons.map((a, idx) => {
                    const aPrice = parseFloat(String(a.price ?? '0')) || 0;
                    return (
                      <div key={idx} className="flex justify-between text-[11px] font-bold text-black">
                        <span>
                          + {a.name || `Add-on #${idx + 1}`}
                          {a.duration ? ` (${a.duration}m)` : ''}
                        </span>
                        {(data.isVoucherPackage || data.isVoucherRedemption) ? (
                          <span className="text-[10px] font-bold text-black border border-black px-1.5 py-0.5 rounded">
                            Included
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-black">+{aPrice.toFixed(3)} {currency}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Extra Minutes */}
              {Number(data.extraMinutes ?? 0) > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-black pt-0.5">
                  <span>+ Extra Time ({data.extraMinutes} mins)</span>
                  <span className="font-mono font-bold text-black">+{extraPriceNum.toFixed(3)} {currency}</span>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="py-3 border-b border-dashed border-black space-y-1.5 text-xs font-bold text-black">
              <div className="flex justify-between text-black font-bold">
                <span>
                  {data.isCourseRedemption
                    ? 'Session Standard Value:'
                    : isPackageServiceBooking
                    ? (data.packageName ? `Package Price (${data.packageName}):` : 'Package Price:')
                    : 'Subtotal:'}
                </span>
                <span className="font-mono font-bold text-black">
                  {data.isVoucherPackage
                    ? `${(parseFloat(String(data.voucherPackagePrice ?? data.packagePrice ?? data.subtotal ?? totalAmountNum)) || totalAmountNum).toFixed(3)} ${currency}`
                    : isPackageServiceBooking
                    ? `${(packagePriceNum > 0 ? packagePriceNum : (data.packagePrice != null ? parseFloat(String(data.packagePrice)) : (addonsTotal > 0 || extraPriceNum > 0 ? Math.max(0, totalAmountNum - addonsTotal - extraPriceNum) : (parseFloat(String(data.servicePrice ?? data.subtotal ?? totalAmountNum)) || totalAmountNum)))).toFixed(3)} ${currency}`
                    : data.subtotal != null
                    ? `${(parseFloat(String(data.subtotal)) || 0).toFixed(3)} ${currency}`
                    : `${(totalAmountNum + (parseFloat(String(data.discount ?? '0')) || 0)).toFixed(3)} ${currency}`}
                </span>
              </div>
              {data.isCourseRedemption ? (
                <div className="flex justify-between text-black font-bold">
                  <span>Course Package Coverage:</span>
                  <span className="font-mono font-bold text-black">-100% (Redeemed)</span>
                </div>
              ) : data.isVoucherPackage || data.isVoucherRedemption ? (
                <div className="flex justify-between text-black font-bold">
                  <span>Gift Voucher Coverage:</span>
                  <span className="font-mono font-bold text-black">-100% (Redeemed)</span>
                </div>
              ) : Number(data.discount ?? 0) > 0 ? (
                <div className="flex justify-between text-black font-bold">
                  <span>Discount:</span>
                  <span className="font-mono font-bold text-black">-{(parseFloat(String(data.discount)) || 0).toFixed(3)} {currency}</span>
                </div>
              ) : null}
              {!isPackageServiceBooking && (
                <div className="flex justify-between text-black font-bold">
                  <span>Tax / VAT (0%):</span>
                  <span className="font-mono font-bold text-black">0.000 {currency}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-black">
                <span className="text-sm font-black text-black uppercase">
                  {data.isCourseRedemption || data.isVoucherRedemption ? 'Visit Balance Due:' : 'Total Paid:'}
                </span>
                <span className="text-base font-black font-mono text-black">
                  {data.isCourseRedemption || data.isVoucherRedemption ? '0.000' : totalAmountNum.toFixed(3)} <span className="text-xs font-black">{currency}</span>
                </span>
              </div>
              {data.isCourseRedemption && (
                <div className="text-[10px] text-black pt-0.5 text-right font-bold">
                  {data.subscriptionPrice
                    ? `Course Package: ${Number(data.subscriptionPrice).toFixed(3)} ${currency} (Prepaid in full)`
                    : 'Prepaid via Course Subscription'}
                </div>
              )}
              {data.isVoucherPackage && (
                <div className="text-[10px] text-black pt-0.5 text-right font-bold">
                  {`Gift Package: ${(parseFloat(String(data.voucherPackagePrice ?? totalAmountNum)) || 0).toFixed(3)} ${currency} (Prepaid in full)`}
                </div>
              )}
            </div>

            {/* Payment Method / Audit */}
            <div className="py-3 border-b border-dashed border-black space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold text-black">Payment Method:</span>
                <span className="font-bold text-black">
                  {data.isCourseRedemption
                    ? `Course Package (${data.subscriptionPaymentProvider || data.subscriptionPaymentMethod || 'Prepaid'})`
                    : (data.isVoucherRedemption || data.isVoucherPackage)
                    ? 'gift voucher'
                    : data.paymentMethod || data.paymentProvider || 'Desk Payment (Confirmed)'}
                </span>
              </div>
              {(data.isVoucherRedemption || data.isVoucherPackage) && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Payment Provider:</span>
                  <span className="font-bold text-black">
                    gift voucher
                  </span>
                </div>
              )}
              {data.isCourseRedemption && data.courseSubscriptionNumber && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Subscription Ref:</span>
                  <span className="font-mono font-bold text-black">{data.courseSubscriptionNumber}</span>
                </div>
              )}
              {data.isVoucherRedemption && data.voucherCode && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Voucher Code:</span>
                  <span className="font-mono font-bold text-black">{data.voucherCode}</span>
                </div>
              )}
              {(data.subscriptionInvoiceNumber || data.invoiceNumber) && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Invoice No:</span>
                  <span className="font-mono font-bold text-black">
                    {data.subscriptionInvoiceNumber || data.invoiceNumber}
                  </span>
                </div>
              )}
              {data.transactionId && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Transaction ID:</span>
                  <span className="font-mono font-bold text-black truncate max-w-[180px]">{data.transactionId}</span>
                </div>
              )}
              {data.referenceId && (
                <div className="flex justify-between">
                  <span className="font-bold text-black">Ref ID:</span>
                  <span className="font-mono font-bold text-black">{data.referenceId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold text-black">Payment Status:</span>
                <span className="font-black text-black uppercase">Paid / Completed</span>
              </div>
            </div>

            {/* Decorative Barcode / Footer */}
            <div className="pt-4 text-center space-y-2">
              <div className="flex justify-center items-center gap-[2px] h-8 px-4">
                {[1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1].map((w, i) => (
                  <div
                    key={i}
                    style={{ width: `${w * 1.5}px` }}
                    className="h-full bg-black"
                  />
                ))}
              </div>
              <p className="font-mono font-bold text-[10px] text-black tracking-widest">{receiptRefNumber}</p>

              <div className="pt-2 text-[10px] text-black font-bold space-y-1">
                <p className="font-black text-black">Thank you for visiting USH Spa!</p>
                <p className="font-bold text-black">We look forward to welcoming you back for another relaxing experience.</p>
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
