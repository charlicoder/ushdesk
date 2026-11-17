'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { normalizeBranchName } from '@/lib/branches';
import React, { useEffect, useMemo, useRef } from 'react';
import { Printer, X } from 'lucide-react';

export interface BookingReceiptData {
  bookingNumber?: string | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  arrangementName?: string | null;
  therapistName?: string | null;
  secondaryTherapistName?: string | null;
  serviceName?: string | null;
  serviceNameAr?: string | null;
  serviceCategory?: string | null;
  servicePrice?: number | string | null;
  /** All booked services (one line each). When omitted the single `serviceName` is shown. */
  services?: Array<{
    name?: string;
    nameAr?: string | null;
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

const formatBranchName = (rawName?: string | null): string => {
  if (!rawName) return 'Ush spa';
  const norm = normalizeBranchName(rawName);
  const clean = norm.replace(/\s*branch$/i, '').trim();
  if (clean.toLowerCase().startsWith('ush spa')) return clean;
  return `Ush spa ${clean}`;
};

const getBranchAddress = (branchName?: string | null, customAddress?: string | null): string => {
  if (customAddress && customAddress.trim()) return customAddress.trim();
  const name = String(branchName || '').toLowerCase();
  if (name.includes('mangaf') || name.includes('منقف')) {
    return 'Mangaf Block 4 Building 1604 First floor,\nKuwait, Mangaf, Kuwait';
  }
  if (name.includes('sharq') || name.includes('شرق')) {
    return 'Sharq- Block 4 - Martyrs Street, Plot 32 opposite Al Hamra Tower - 1st Floor,\nKuwait City, Kuwait';
  }
  if (name.includes('mahboula') || name.includes('مهبولة')) {
    return 'Mahboula Block 1 Coastal Road,\nKuwait, Mahboula, Kuwait';
  }
  if (name.includes('salmiya') || name.includes('سالمية')) {
    return 'Salmiya Salem Al Mubarak Street,\nKuwait, Salmiya, Kuwait';
  }
  if (name.includes('hawally') || name.includes('حولي')) {
    return 'Hawally Tunis Street,\nKuwait, Hawally, Kuwait';
  }
  return 'Kuwait';
};

const formatReceiptDateTime = (startVal?: string | null, dateVal?: string | null, timeVal?: string | null): string => {
  if (startVal) {
    try {
      const d = new Date(startVal);
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString('en-GB', {
          timeZone: KUWAIT_TZ,
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const timePart = d.toLocaleTimeString('en-US', {
          timeZone: KUWAIT_TZ,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        return `${datePart} ${timePart}`;
      }
    } catch {}
  }
  if (dateVal && timeVal) {
    return `${dateVal} ${timeVal}`;
  }
  const now = new Date();
  const datePart = now.toLocaleDateString('en-GB', {
    timeZone: KUWAIT_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = now.toLocaleTimeString('en-US', {
    timeZone: KUWAIT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} ${timePart}`;
};

const getNormalizedPaymentMethod = (
  pm?: string | null,
  pp?: string | null,
  isCourse?: boolean,
  isVoucher?: boolean
): string => {
  if (isCourse) return 'Course Package';
  if (isVoucher) return 'Gift Voucher';
  const str = String(pm || pp || '').toLowerCase();
  if (str.includes('knet') || str.includes('debit')) return 'Knet Card';
  if (str.includes('credit') || str.includes('visa') || str.includes('master')) return 'Credit Card';
  if (str.includes('cash')) return 'Cash';
  if (str.includes('link') || str.includes('myfatoorah') || str.includes('online')) return 'Knet Card';
  if (str.includes('voucher') || str.includes('gift')) return 'Gift Voucher';
  if (str.includes('course') || str.includes('subscription')) return 'Course Package';
  if (pm && pm.trim()) {
    return pm
      .trim()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Knet Card';
};

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

  const totalAmountNum = parseFloat(String(data.totalAmount ?? '0')) || 0;
  const servicePriceNum = parseFloat(String(data.servicePrice ?? '0')) || 0;
  const extraPriceNum = parseFloat(String(data.extraPrice ?? '0')) || 0;
  const packagePriceNum = parseFloat(String(data.packagePrice ?? data.voucherPackagePrice ?? '0')) || 0;
  const discountNum = parseFloat(String(data.discount ?? '0')) || 0;

  const addonsTotal = (data.addons || []).reduce(
    (sum, a) => sum + (parseFloat(String(a.price ?? '0')) || 0),
    0
  );

  const subtotalNum =
    data.subtotal != null
      ? (parseFloat(String(data.subtotal)) || 0)
      : (totalAmountNum + discountNum);

  const totalNum = Math.max(0, subtotalNum - discountNum);
  const finalTotalNum = (data.isCourseRedemption || data.isVoucherRedemption) ? 0 : (totalAmountNum > 0 ? totalAmountNum : totalNum);

  const receiptRefNumber = data.invoiceNumber || data.bookingNumber || data.reference || 'RECEIPT';
  const customerLine = `${data.customerName || 'Valued Guest'}${data.customerPhone ? `, ${data.customerPhone}` : ''}`;
  const formattedBranch = formatBranchName(data.branchName);
  const branchAddress = getBranchAddress(data.branchName, data.branchAddress);
  const dateTimeLine = formatReceiptDateTime(data.appointmentStart, data.appointmentDate, data.timeSlot);
  const therapistLine = data.therapistName
    ? `${data.therapistName}${data.secondaryTherapistName && data.secondaryTherapistName !== '—' ? ` + ${data.secondaryTherapistName}` : ''}`
    : '';

  const normalizedPaymentMethod = getNormalizedPaymentMethod(
    data.paymentMethod,
    data.paymentProvider,
    data.isCourseRedemption,
    data.isVoucherRedemption || data.isVoucherPackage
  );

  const itemsList = useMemo(() => {
    if (data.services && data.services.length > 0) {
      return data.services.map((sv) => {
        let p = parseFloat(String(sv.price ?? '0')) || 0;
        const isPkg = Boolean(
          data.isPackageBooking ||
          data.isVoucherPackage ||
          (data.packageName && sv.name && sv.name.toLowerCase().includes(data.packageName.toLowerCase())) ||
          (sv.name && sv.name.toLowerCase().includes('package'))
        );
        if (isPkg && packagePriceNum > 0 && (p === totalAmountNum || p > packagePriceNum)) {
          p = packagePriceNum;
        } else if ((data.services?.length ?? 1) <= 1 && (addonsTotal > 0 || extraPriceNum > 0)) {
          const grossTotal = totalAmountNum + discountNum;
          if (p === totalAmountNum || p === grossTotal) {
            p = Math.max(0, p - addonsTotal - extraPriceNum);
          }
        }
        return {
          name: sv.name || 'Spa Service',
          nameAr: sv.nameAr || null,
          price: p,
          duration: sv.duration,
        };
      });
    }

    let dispPrice = servicePriceNum > 0 ? servicePriceNum : totalAmountNum;
    const isSinglePkg = Boolean(
      data.isPackageBooking ||
      data.isVoucherPackage ||
      (data.serviceName && data.serviceName.toLowerCase().includes('package'))
    );
    if (isSinglePkg && packagePriceNum > 0 && (dispPrice === totalAmountNum || dispPrice > packagePriceNum)) {
      dispPrice = packagePriceNum;
    } else if (addonsTotal > 0 || extraPriceNum > 0) {
      const grossTotal = totalAmountNum + discountNum;
      if (dispPrice === totalAmountNum || dispPrice === grossTotal) {
        dispPrice = Math.max(0, dispPrice - addonsTotal - extraPriceNum);
      }
    }
    return [
      {
        name: data.serviceName || 'Spa Service',
        nameAr: data.serviceNameAr || null,
        price: dispPrice,
        duration: data.serviceDuration || data.totalDuration,
      },
    ];
  }, [
    data.services,
    data.serviceName,
    data.serviceNameAr,
    data.serviceDuration,
    data.totalDuration,
    servicePriceNum,
    totalAmountNum,
    packagePriceNum,
    addonsTotal,
    extraPriceNum,
    data.isPackageBooking,
    data.isVoucherPackage,
    data.packageName,
    discountNum,
  ]);

  // Isolated print using hidden iframe for thermal printing
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
            margin: 3mm 4mm;
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
            padding: 8px;
            color: #000000 !important;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
            font-weight: 700 !important;
          }
          * { 
            box-sizing: border-box; 
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .receipt-box {
            max-width: 300px;
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
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700 !important; }
          .border-t { border-top: 1px solid #000000 !important; }
          .border-b { border-bottom: 1px solid #000000 !important; }
          .border-dashed { border-style: dashed !important; }
          .my-1 { margin-top: 4px; margin-bottom: 4px; }
          .my-1\\.5 { margin-top: 6px; margin-bottom: 6px; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
          .my-2\\.5 { margin-top: 10px; margin-bottom: 10px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .pt-0\\.5 { padding-top: 2px; }
          .pt-1 { padding-top: 4px; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .items-start { align-items: flex-start; }
          .text-xs { font-size: 11px; }
          .text-sm { font-size: 13px; }
          .text-base { font-size: 14px; }
          .space-y-0\\.5 > * + * { margin-top: 2px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .w-1\\/2 { width: 50%; }
          .w-full { width: 100%; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .whitespace-pre-line { white-space: pre-line; }
          .leading-snug { line-height: 1.35; }
          .tracking-widest { letter-spacing: 0.1em; }
          .uppercase { text-transform: uppercase; }
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
      <div className="relative z-10 w-full max-w-md flex flex-col max-h-[92vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/40 px-5 py-3.5 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
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
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/20">
          <div
            ref={receiptRef}
            id="ush-printable-receipt"
            className="mx-auto w-full max-w-[320px] bg-white text-black font-bold rounded-2xl shadow-lg border border-black p-5 font-sans text-xs select-text"
          >
            {/* Header: Zen Stones Icon & Spa Name */}
            <div className="text-center">
              <svg width="36" height="24" viewBox="0 0 36 24" fill="currentColor" className="mx-auto text-black">
                <ellipse cx="18" cy="4.5" rx="5" ry="2.5" />
                <ellipse cx="18" cy="11.5" rx="8" ry="3.5" />
                <ellipse cx="18" cy="19" rx="12" ry="4" />
              </svg>
              <p className="text-sm font-black tracking-widest uppercase text-black text-center mt-1">USH SPA</p>
              <h2 className="text-xs font-black text-black text-center mt-1">Client Invoice</h2>
            </div>

            {/* Branch Details */}
            <div className="text-center mt-2.5 space-y-0.5 text-xs font-bold text-black">
              <p className="font-extrabold text-black">{formattedBranch}</p>
              <p className="text-[11px] text-black whitespace-pre-line leading-snug">{branchAddress}</p>
            </div>

            {/* Client, Invoice, DateTime & Staff */}
            <div className="text-center mt-2.5 space-y-0.5 text-xs font-bold text-black">
              <p className="text-black">{customerLine}</p>
              <p className="font-mono text-black">{receiptRefNumber}</p>
              <p className="text-black">{dateTimeLine}</p>
              {therapistLine && <p className="text-black">{therapistLine}</p>}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2.5" />

            {/* Items List */}
            <div className="space-y-1">
              {itemsList.map((item, idx) => (
                <div key={idx} className="my-1.5 text-xs font-bold text-black">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="shrink-0 font-bold">{idx + 1}</span>
                      <span className="font-bold text-left break-words">
                        {item.name}
                        {Number(item.duration ?? 0) > 0 && !item.name.toLowerCase().includes(String(item.duration)) ? ` ${item.duration}` : ''}
                      </span>
                    </div>
                    <span className="font-mono shrink-0 font-bold text-right pl-2">
                      {data.isCourseRedemption || data.isVoucherRedemption ? '0.00' : item.price.toFixed(2)}
                    </span>
                  </div>
                  {item.nameAr && (
                    <div className="text-[11px] text-black pr-2 text-right font-bold mt-0.5" dir="rtl">
                      {item.nameAr}
                    </div>
                  )}
                </div>
              ))}

              {/* Add-ons */}
              {data.addons && data.addons.length > 0 && data.addons.map((addon, aIdx) => {
                const aPrice = parseFloat(String(addon.price ?? 0)) || 0;
                return (
                  <div key={`addon-${aIdx}`} className="my-1 text-xs font-bold text-black flex justify-between items-start pl-4 gap-2">
                    <span className="truncate">+ {addon.name}{addon.duration ? ` (${addon.duration}m)` : ''}</span>
                    <span className="font-mono shrink-0 text-right">
                      {data.isVoucherPackage || data.isVoucherRedemption ? '0.00' : aPrice.toFixed(2)}
                    </span>
                  </div>
                );
              })}

              {/* Extra Time */}
              {Number(data.extraMinutes ?? 0) > 0 && (
                <div className="my-1 text-xs font-bold text-black flex justify-between items-start pl-4 gap-2">
                  <span className="truncate">+ Extra Time ({data.extraMinutes}m)</span>
                  <span className="font-mono shrink-0 text-right">{extraPriceNum.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2.5" />

            {/* Subtotal, Tax, Discount, Total, Gratuity */}
            <div className="space-y-1 text-xs font-bold text-black">
              <div className="flex justify-between items-center">
                <span className="w-1/2 text-right pr-4 font-bold">Sub total</span>
                <span className="font-mono text-right w-1/2 font-bold">{subtotalNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="w-1/2 text-right pr-4 font-bold">Tax (None 0%)</span>
                <span className="font-mono text-right w-1/2 font-bold">0.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="w-1/2 text-right pr-4 font-bold">Discount</span>
                <span className="font-mono text-right w-1/2 font-bold">{discountNum > 0 ? `-${discountNum.toFixed(2)}` : '0.00'}</span>
              </div>
              <div className="flex justify-between items-center font-extrabold">
                <span className="w-1/2 text-right pr-4 font-bold">Total</span>
                <span className="font-mono text-right w-1/2 font-bold">{totalNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="w-1/2 text-right pr-4 font-bold">Gratuity</span>
                <span className="font-mono text-right w-1/2 font-bold">0.00</span>
              </div>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-1.5" />

            {/* Final Total */}
            <div className="flex justify-between items-center text-xs font-black text-black">
              <span className="w-1/2 text-right pr-4 text-sm font-black">Final Total</span>
              <span className="font-mono text-right w-1/2 text-sm font-black">{finalTotalNum.toFixed(2)}</span>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-1.5" />

            {/* Signature */}
            <div className="flex justify-between items-center text-xs font-bold text-black py-0.5">
              <span className="w-1/2 text-right pr-4 font-bold">Signature</span>
              <span className="w-1/2 text-right border-b border-black inline-block h-3" />
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-1.5" />

            {/* Payment & Change */}
            <div className="space-y-1 text-xs font-bold text-black">
              <div className="flex justify-between items-center">
                <span className="font-bold">{normalizedPaymentMethod}</span>
                <span className="font-mono font-bold">{finalTotalNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">Change</span>
                <span className="font-mono font-bold">0.00</span>
              </div>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* Arabic Footer Notices */}
            <div className="text-center space-y-2 pt-1 text-xs font-bold text-black" dir="rtl">
              <p className="leading-snug font-bold">يرجى الحفاظ على أغراضك الشخصية ونحن غير مسؤولين عن فقدانها</p>
              <p className="font-black">** نتمنى لك وقت ممتع **</p>
              <p className="tracking-widest font-black text-sm">*******</p>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-border/40 px-5 py-3.5 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-1.5 text-xs font-semibold hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
