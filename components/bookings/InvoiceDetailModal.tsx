'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X, FileText, CheckCircle2, Clock, Copy, Check, ExternalLink,
  Printer, ShieldCheck, User, MapPin, Calendar, CreditCard,
  Tag, AlertCircle, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

type AnyRecord = Record<string, any>;

export interface InvoiceDetailModalProps {
  invoiceNumber: string;
  invoiceRecord?: AnyRecord | null;
  bookingData?: {
    customerName?: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    serviceName?: string;
    serviceCategory?: string | null;
    servicePrice?: string | number;
    addons?: Array<AnyRecord>;
    extraMinutes?: number;
    extraPrice?: string | number;
    totalPrice?: string | number;
    currency?: string;
    paymentMethod?: string | null;
    paymentProvider?: string | null;
    paymentThrough?: string | null;
    paymentDate?: string | null;
    transactionId?: string | null;
    traceId?: string | null;
    bookingNumber?: string | null;
    branchName?: string | null;
    status?: string;
    pricing?: AnyRecord | null;
  };
  onClose: () => void;
}

export function InvoiceDetailModal({
  invoiceNumber,
  invoiceRecord: initialInvoice,
  bookingData,
  onClose,
}: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<AnyRecord | null>(initialInvoice || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch full invoice record from backend if not already loaded or missing detailed lines
  useEffect(() => {
    if (!invoiceNumber || invoiceNumber === '—') return;
    let cancelled = false;
    setLoading(true);

    authedFetch(`/uanr/api/v1/invoices?search=${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
        const found = items.find((i: AnyRecord) => i.name === invoiceNumber || i.id === invoiceNumber || i.reference === invoiceNumber) || items[0];
        if (found) {
          setInvoice((prev) => ({ ...(prev || {}), ...found }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invoiceNumber]);

  const currency = invoice?.currency_code || invoice?.currency || bookingData?.currency || 'KWD';
  const totalAmount = parseFloat(String(invoice?.amount_total ?? invoice?.total_amount ?? invoice?.total ?? bookingData?.totalPrice ?? 0)) || 0;
  const isPaid = (
    String(invoice?.state).toLowerCase() === 'paid' ||
    String(invoice?.state).toLowerCase() === 'posted' ||
    String(bookingData?.status).toLowerCase() === 'confirmed' ||
    String(bookingData?.status).toLowerCase() === 'completed'
  );
  const amountPaid = parseFloat(String(invoice?.amount_paid ?? (isPaid ? totalAmount : 0))) || 0;
  const balanceDue = parseFloat(String(invoice?.amount_residual ?? Math.max(0, totalAmount - amountPaid))) || 0;
  const untaxedAmount = parseFloat(String(invoice?.amount_untaxed ?? totalAmount)) || 0;
  const taxAmount = parseFloat(String(invoice?.amount_tax ?? 0)) || 0;

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (n: number | string | undefined | null) => {
    const v = parseFloat(String(n ?? 0));
    return isNaN(v) ? '0.000' : v.toFixed(3);
  };

  const fmtDate = (d: string | undefined | null) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(d);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Compile line items from invoice record or fallback to booking service + addons + extra minutes
  const rawInvoiceLines = (Array.isArray(invoice?.invoice_line_ids) && invoice?.invoice_line_ids) ||
    (Array.isArray(invoice?.lines) && invoice?.lines) ||
    null;

  const invoiceLines = (rawInvoiceLines && rawInvoiceLines.length > 0)
    ? rawInvoiceLines
    : [
        {
          name: bookingData?.serviceName || 'Spa Treatment Service',
          description: bookingData?.serviceCategory ? `Category: ${bookingData.serviceCategory}` : 'Main appointment treatment',
          quantity: 1,
          price_unit: parseFloat(String(bookingData?.servicePrice ?? bookingData?.pricing?.base_price ?? totalAmount)) || 0,
          price_subtotal: parseFloat(String(bookingData?.servicePrice ?? bookingData?.pricing?.base_price ?? totalAmount)) || 0,
        },
        ...(bookingData?.addons ?? []).map((addon) => ({
          name: addon.name || addon.addon_name || 'Add-on Treatment',
          description: 'Appointment Enhancement',
          quantity: 1,
          price_unit: parseFloat(String(addon.price ?? addon.base_price ?? 0)) || 0,
          price_subtotal: parseFloat(String(addon.price ?? addon.base_price ?? 0)) || 0,
        })),
        ...(Number(bookingData?.extraMinutes ?? 0) > 0 ? [{
          name: `Extra Session Time (+${bookingData?.extraMinutes} min)`,
          description: 'Extended appointment duration',
          quantity: 1,
          price_unit: parseFloat(String(bookingData?.extraPrice ?? 0)) || 0,
          price_subtotal: parseFloat(String(bookingData?.extraPrice ?? 0)) || 0,
        }] : []),
      ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog Container */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Status Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 shrink-0" />

        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-600/10 text-violet-600 dark:text-violet-400 shadow-sm border border-violet-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-foreground font-mono">
                  {invoiceNumber || invoice?.name || 'Invoice'}
                </h3>
                {Boolean(invoiceNumber) && (
                  <button
                    type="button"
                    onClick={() => copyText(invoiceNumber, 'inv')}
                    className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                    title="Copy invoice number"
                  >
                    {copied === 'inv' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>Official Tax Invoice</span>
                <span>•</span>
                <span className="capitalize">{invoice?.invoice_type || 'Customer Sale'}</span>
                {loading && <span className="text-[10px] text-violet-500 animate-pulse">(Updating...)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border',
              isPaid
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-500/30'
            )}>
              {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {invoice?.state ? String(invoice.state).toUpperCase() : (isPaid ? 'PAID' : 'DRAFT')}
            </span>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: 'none' }}>
          
          {/* 1. Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 text-center">
              <Tag className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm font-extrabold text-foreground">{fmt(untaxedAmount)} <span className="text-[10px] font-normal">{currency}</span></p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Untaxed Subtotal</p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 text-center">
              <ShieldCheck className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-sm font-extrabold text-foreground">{fmt(taxAmount)} <span className="text-[10px] font-normal">{currency}</span></p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">Tax / VAT</p>
            </div>

            <div className="rounded-2xl border border-violet-300/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 p-3.5 text-center">
              <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400 mx-auto mb-1" />
              <p className="text-sm font-black text-violet-600 dark:text-violet-400">{fmt(totalAmount)} <span className="text-[10px] font-normal">{currency}</span></p>
              <p className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400 mt-0.5">Total Amount</p>
            </div>

            <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 text-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmt(amountPaid)} <span className="text-[10px] font-normal">{currency}</span></p>
              <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">Amount Paid</p>
            </div>
          </div>

          {/* 2. Invoice Metadata Details Grid */}
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Invoice &amp; Customer Information
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs pt-1">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Billed Customer</span>
                <p className="font-bold text-foreground mt-0.5 truncate">
                  {invoice?.partner_name || bookingData?.customerName || 'Walk-in Client'}
                </p>
                {bookingData?.customerPhone && (
                  <p className="text-[11px] text-muted-foreground">{bookingData.customerPhone}</p>
                )}
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Invoice Issue Date</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {fmtDate(invoice?.invoice_date || invoice?.date || bookingData?.paymentDate)}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Due Date</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {fmtDate(invoice?.due_date || invoice?.invoice_date || bookingData?.paymentDate)}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Branch Location</span>
                <p className="font-semibold text-foreground mt-0.5 truncate">
                  {bookingData?.branchName || 'Main Center'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Payment Terms</span>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  {invoice?.payment_terms || 'Immediate Settlement'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Associated Booking</span>
                <p className="font-mono font-semibold text-primary mt-0.5 truncate">
                  {bookingData?.bookingNumber || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Itemized Breakdown Table */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Itemized Invoice Lines
              </h4>
              <span className="text-[11px] font-bold text-muted-foreground">
                {invoiceLines.length} item{invoiceLines.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="divide-y divide-border/40">
              {invoiceLines.map((line: AnyRecord, idx: number) => {
                const lineName = line.name || line.product_name || `Line Item #${idx + 1}`;
                const lineDesc = line.description || line.notes || '';
                const lineQty = line.quantity || 1;
                const linePrice = parseFloat(String(line.price_unit ?? line.price ?? 0)) || 0;
                const lineSubtotal = parseFloat(String(line.price_subtotal ?? linePrice * lineQty)) || 0;

                return (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between gap-4 text-xs hover:bg-muted/10 transition">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground leading-tight">{lineName}</p>
                      {lineDesc && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lineDesc}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-foreground">
                        {fmt(lineSubtotal)} <span className="text-[10px] font-normal text-muted-foreground">{currency}</span>
                      </p>
                      {lineQty > 1 && (
                        <p className="text-[10px] text-muted-foreground">
                          {lineQty} × {fmt(linePrice)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals Summary Footer */}
            <div className="bg-muted/20 px-4 py-3 border-t border-border/50 space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (Untaxed):</span>
                <span className="font-mono font-semibold text-foreground">{fmt(untaxedAmount)} {currency}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax / VAT:</span>
                  <span className="font-mono font-semibold text-foreground">+{fmt(taxAmount)} {currency}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border/40 text-sm font-extrabold text-foreground">
                <span>Invoice Total:</span>
                <span className="font-mono text-violet-600 dark:text-violet-400 font-black">
                  {fmt(totalAmount)} {currency}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Balance Due:</span>
                <span className={cn('font-mono font-bold', balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                  {fmt(balanceDue)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Payment & Gateway Info Box */}
          {(bookingData?.transactionId || bookingData?.paymentMethod || bookingData?.paymentProvider) && (
            <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground uppercase text-[10px] flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Payment Settlement Details
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Electronic Capture
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
                <div>
                  <span>Method / Gateway: </span>
                  <strong className="text-foreground capitalize">{bookingData.paymentProvider || bookingData.paymentMethod || 'Front Desk'}</strong>
                </div>
                {bookingData.transactionId && (
                  <div>
                    <span>Transaction ID: </span>
                    <strong className="font-mono text-foreground">{bookingData.transactionId}</strong>
                  </div>
                )}
                {bookingData.traceId && (
                  <div>
                    <span>Trace / Auth Code: </span>
                    <strong className="font-mono text-foreground">{bookingData.traceId}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-2">
            {Boolean(invoiceNumber) && (
              <Link
                href={`/finance/invoices?search=${encodeURIComponent(invoiceNumber)}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer shadow-xs"
              >
                <ExternalLink className="h-3.5 w-3.5 text-violet-500" />
                <span>Open in Accounting</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer shadow-xs"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Print Invoice</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/60 bg-card hover:bg-muted px-5 py-2 text-xs font-bold text-foreground transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
