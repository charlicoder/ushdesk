'use client';

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
  serviceName?: string | null;
  serviceCategory?: string | null;
  servicePrice?: number | string | null;
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
  const refCode = data.bookingNumber || data.reference || 'RECEIPT';

  // Format date helper
  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('en-US', {
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
      return d.toLocaleTimeString('en-US', {
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
        <title>Receipt - ${refCode}</title>
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
              <p className="text-[11px] font-mono text-muted-foreground">{refCode}</p>
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
              <div className="pt-2 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 className="h-3 w-3" /> COMPLETED
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold">
                  <ShieldCheck className="h-3 w-3" /> PAID
                </span>
              </div>
            </div>

            {/* Receipt Metadata */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt / Ref #:</span>
                <span className="font-mono font-bold text-slate-900">{refCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issue Date:</span>
                <span className="font-medium text-slate-800">
                  {new Date().toLocaleDateString('en-US', {
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
                  <span className="text-slate-500">Therapist:</span>
                  <span className="font-semibold text-slate-800">{data.therapistName}</span>
                </div>
              )}
              {data.arrangementName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Arrangement:</span>
                  <span className="font-semibold text-slate-800">{data.arrangementName}</span>
                </div>
              )}
            </div>

            {/* Itemized Services & Addons */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Description</span>
                <span>Amount</span>
              </div>

              {/* Main Service */}
              <div className="space-y-0.5">
                <div className="flex justify-between font-bold text-slate-900 text-xs">
                  <span>{data.serviceName || 'Spa Service'}</span>
                  <span className="font-mono">
                    {servicePriceNum > 0
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
                <span>Subtotal:</span>
                <span className="font-mono">{totalAmountNum.toFixed(3)} {currency}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax / VAT (0%):</span>
                <span className="font-mono">Included</span>
              </div>
              <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
                <span className="text-sm font-extrabold text-slate-900 uppercase">Total Paid:</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {totalAmountNum.toFixed(3)} <span className="text-xs font-semibold">{currency}</span>
                </span>
              </div>
            </div>

            {/* Payment Method / Audit */}
            <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {data.paymentMethod || data.paymentProvider || 'Desk Payment (Confirmed)'}
                </span>
              </div>
              {data.invoiceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice No:</span>
                  <span className="font-mono font-bold text-slate-800">{data.invoiceNumber}</span>
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
              <p className="font-mono text-[9px] text-slate-500 tracking-widest">{refCode}</p>

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
