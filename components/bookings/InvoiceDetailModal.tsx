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
    paymentNumber?: string | null;
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
  const [journalEntries, setJournalEntries] = useState<AnyRecord[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

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

  // Journal entries of this invoice: its own posting entry + any entry that references the invoice (e.g. payments)
  const invoiceJournalEntryId = invoice?.journal_entry_id ? String(invoice.journal_entry_id) : '';
  useEffect(() => {
    if (!invoiceNumber || invoiceNumber === '—') return;
    let cancelled = false;
    setJournalLoading(true);
    (async () => {
      try {
        const ids: string[] = invoiceJournalEntryId ? [invoiceJournalEntryId] : [];
        try {
          const r = await authedFetch(`/uanr/api/v1/journal-entries/?search=${encodeURIComponent(invoiceNumber)}&page_size=20`);
          const res = await r.json().catch(() => ({}));
          const items: AnyRecord[] = res?.data?.items ?? res?.items ?? (Array.isArray(res?.data) ? res.data : []);
          for (const it of items) {
            const id = String(it.id ?? '');
            const related = it.name === invoiceNumber || it.reference === invoiceNumber || String(it.narration ?? '').includes(invoiceNumber);
            if (id && related && !ids.includes(id)) ids.push(id);
          }
        } catch { /* list is optional */ }
        const details = await Promise.all(ids.slice(0, 10).map(async (id) => {
          try {
            const r = await authedFetch(`/uanr/api/v1/journal-entries/${id}`);
            const res = await r.json().catch(() => ({}));
            return (res?.data ?? res) as AnyRecord;
          } catch { return null; }
        }));
        const entries = details.filter((d): d is AnyRecord => Boolean(d && (d.id || d.name)));
        if (cancelled) return;
        setJournalEntries(entries);
        try {
          const ar = await authedFetch('/uanr/api/v1/accounts/?page_size=500');
          const ares = await ar.json().catch(() => ({}));
          const accs: AnyRecord[] = ares?.data?.items ?? ares?.items ?? (Array.isArray(ares?.data) ? ares.data : []);
          const map: Record<string, string> = {};
          for (const a of accs) map[String(a.id)] = [a.code, a.name].filter(Boolean).join(' · ');
          if (!cancelled) setAccountNames(map);
        } catch { /* names are cosmetic */ }
      } finally {
        if (!cancelled) setJournalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceNumber, invoiceJournalEntryId]);

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

  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const handlePrint = () => {
    const rows = invoiceLines.map((line: AnyRecord, idx: number) => {
      const qty = parseFloat(String(line.quantity ?? 1)) || 1;
      const unit = parseFloat(String(line.unit_price ?? line.price_unit ?? line.price ?? 0)) || 0;
      const sub = parseFloat(String(line.subtotal ?? line.price_subtotal ?? unit * qty)) || 0;
      return `<tr><td class="c">${idx + 1}</td><td><strong>${esc(line.name || line.product_name || `Item ${idx + 1}`)}</strong>${line.description ? `<div class="muted">${esc(line.description)}</div>` : ''}</td><td class="r">${qty}</td><td class="r">${fmt(unit)}</td><td class="r">${fmt(sub)}</td></tr>`;
    }).join('');
    const status = invoice?.state ? String(invoice.state).toUpperCase() : (isPaid ? 'PAID' : 'DRAFT');
    const customer = invoice?.partner_name || bookingData?.customerName || 'Walk-in Client';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #2d241e; font-size: 12px; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #5a3e36; padding-bottom: 14px; }
  .brand h1 { margin: 0; font-size: 26px; letter-spacing: 1px; color: #5a3e36; }
  .brand p { margin: 2px 0 0; color: #7a6a62; font-size: 11px; }
  .title { text-align: right; }
  .title h2 { margin: 0; font-size: 22px; letter-spacing: 2px; }
  .title .no { font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 4px; }
  .badge { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 12px; border: 1px solid #2f9e6f; color: #2f9e6f; font-weight: bold; font-size: 11px; }
  .grid { display: flex; gap: 24px; margin: 18px 0; }
  .box { flex: 1; border: 1px solid #e3d9d3; border-radius: 8px; padding: 12px 14px; }
  .box h3 { margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #7a6a62; }
  .box .row { display: flex; justify-content: space-between; margin: 4px 0; gap: 12px; }
  .muted { color: #7a6a62; font-size: 11px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #5a3e36; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  td { padding: 9px 10px; border-bottom: 1px solid #eee5e0; vertical-align: top; }
  .r { text-align: right; } .c { text-align: center; width: 36px; }
  .totals { width: 46%; margin-left: auto; margin-top: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #5a3e36; margin-top: 4px; padding-top: 8px; font-size: 15px; font-weight: bold; }
  .foot { margin-top: 36px; border-top: 1px solid #e3d9d3; padding-top: 10px; text-align: center; color: #7a6a62; font-size: 11px; }
</style></head><body>
  <div class="top">
    <div class="brand"><h1>USH SPA</h1><p>Spa &amp; Wellness Center</p></div>
    <div class="title"><h2>TAX INVOICE</h2><div class="no">${esc(invoiceNumber || invoice?.name)}</div><span class="badge">${esc(status)}</span></div>
  </div>
  <div class="grid">
    <div class="box"><h3>Billed To</h3>
      <div><strong>${esc(customer)}</strong></div>
      ${bookingData?.customerPhone ? `<div class="muted">${esc(bookingData.customerPhone)}</div>` : ''}
      ${bookingData?.customerEmail ? `<div class="muted">${esc(bookingData.customerEmail)}</div>` : ''}
    </div>
    <div class="box"><h3>Invoice Details</h3>
      <div class="row"><span>Issue Date</span><strong>${esc(fmtDate(invoice?.invoice_date || invoice?.date || bookingData?.paymentDate))}</strong></div>
      <div class="row"><span>Due Date</span><strong>${esc(fmtDate(invoice?.due_date || invoice?.invoice_date || bookingData?.paymentDate))}</strong></div>
      <div class="row"><span>Branch</span><strong>${esc(bookingData?.branchName || '—')}</strong></div>
      <div class="row"><span>Booking Ref.</span><strong>${esc(bookingData?.bookingNumber || '—')}</strong></div>
    </div>
  </div>
  <table>
    <thead><tr><th class="c">#</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Price (${esc(currency)})</th><th class="r">Amount (${esc(currency)})</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal (Untaxed)</span><span>${fmt(untaxedAmount)} ${esc(currency)}</span></div>
    ${taxAmount > 0 ? `<div class="row"><span>Tax / VAT</span><span>${fmt(taxAmount)} ${esc(currency)}</span></div>` : ''}
    <div class="row grand"><span>Total</span><span>${fmt(totalAmount)} ${esc(currency)}</span></div>
    <div class="row"><span>Amount Paid</span><span>${fmt(amountPaid)} ${esc(currency)}</span></div>
    <div class="row"><strong>Balance Due</strong><strong>${fmt(balanceDue)} ${esc(currency)}</strong></div>
  </div>
  ${(bookingData?.paymentProvider || bookingData?.paymentMethod || bookingData?.transactionId) ? `<div class="box" style="margin-top:18px"><h3>Payment</h3>
    <div class="row"><span>Method</span><strong>${esc(bookingData?.paymentProvider || bookingData?.paymentMethod || '—')}</strong></div>
    ${bookingData?.paymentNumber ? `<div class="row"><span>Payment No.</span><strong>${esc(bookingData.paymentNumber)}</strong></div>` : ''}
    ${bookingData?.transactionId ? `<div class="row"><span>Transaction ID</span><strong>${esc(bookingData.transactionId)}</strong></div>` : ''}
  </div>` : ''}
  <div class="foot">Thank you for choosing USH Spa. This is a computer-generated invoice.</div>
</body></html>`;

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) { document.body.removeChild(frame); return; }
    doc.open(); doc.write(html); doc.close();
    const win = frame.contentWindow;
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 1500);
    }, 250);
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
                const linePrice = parseFloat(String(line.unit_price ?? line.price_unit ?? line.price ?? 0)) || 0;
                const lineSubtotal = parseFloat(String(line.subtotal ?? line.price_subtotal ?? linePrice * lineQty)) || 0;

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
                {bookingData.paymentNumber && (
                  <div>
                    <span>Payment Number: </span>
                    <strong className="font-mono text-foreground font-bold">{bookingData.paymentNumber}</strong>
                  </div>
                )}
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

          {/* 5. Journal Entries */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Journal Entries</h4>
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                {journalLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {journalEntries.length} entr{journalEntries.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
            {journalEntries.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                {journalLoading ? 'Loading journal entries…' : 'No journal entries found for this invoice.'}
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {journalEntries.map((entry, ei) => {
                  const items: AnyRecord[] = entry.items ?? entry.lines ?? [];
                  const dr = items.reduce((a, l) => a + (parseFloat(String(l.debit_amount ?? l.debit ?? 0)) || 0), 0);
                  const cr = items.reduce((a, l) => a + (parseFloat(String(l.credit_amount ?? l.credit ?? 0)) || 0), 0);
                  return (
                    <div key={entry.id || ei} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-foreground">{entry.name || 'Journal Entry'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {fmtDate(entry.entry_date || entry.accounting_date)}{entry.reference ? ` · Ref: ${entry.reference}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {String(entry.state || 'posted')}
                        </span>
                      </div>
                      <table className="w-full text-left text-[11px]">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="py-1.5">Account</th>
                            <th className="py-1.5 text-right">Debit</th>
                            <th className="py-1.5 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {items.map((l, li) => {
                            const d = parseFloat(String(l.debit_amount ?? l.debit ?? 0)) || 0;
                            const c = parseFloat(String(l.credit_amount ?? l.credit ?? 0)) || 0;
                            return (
                              <tr key={l.id || li}>
                                <td className="py-1.5 pr-2">
                                  <p className="font-semibold text-foreground">
                                    {l.account_name || accountNames[String(l.account_id)] || (l.account_id ? `${String(l.account_id).slice(0, 8)}…` : '—')}
                                  </p>
                                  {l.name && <p className="text-[10px] text-muted-foreground">{l.name}</p>}
                                </td>
                                <td className="py-1.5 text-right font-mono font-semibold">{d > 0 ? fmt(d) : '—'}</td>
                                <td className="py-1.5 text-right font-mono font-semibold">{c > 0 ? fmt(c) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t border-border/50 font-bold">
                          <tr>
                            <td className="py-1.5 text-right uppercase text-[10px] text-muted-foreground">Totals ({currency})</td>
                            <td className="py-1.5 text-right font-mono">{fmt(dr)}</td>
                            <td className="py-1.5 text-right font-mono">{fmt(cr)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
