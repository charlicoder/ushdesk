'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Printer, X, MessageCircle, Copy, CheckCircle2,
  Building2, Calendar, CreditCard, DollarSign,
  TrendingUp, FileText, Check, Phone, ArrowUpRight,
  ShieldCheck, AlertCircle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { whatsappShareUrl } from '@/lib/paymentLinks';
import type { Payment } from '@/app/bookings/payments/page';

export interface PaymentReportModalProps {
  payments: Payment[];
  activeFilters: {
    branch?: string;
    status?: string;
    provider?: string;
    payment_through?: string;
    search?: string;
    dateLabel?: string;
    dateRange?: { from?: string; to?: string };
  };
  onClose: () => void;
}

function formatKwd(val: number | string): string {
  const num = typeof val === 'number' ? val : parseFloat(val || '0');
  if (isNaN(num)) return '0.000';
  return num.toFixed(3);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    const s = String(iso).trim();
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    const s = String(iso).trim();
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PaymentReportModal({
  payments,
  activeFilters,
  onClose,
}: PaymentReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [waPhone, setWaPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [showWhatsAppPanel, setShowWhatsAppPanel] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalVolume = 0;
    let paidVolume = 0;
    let pendingVolume = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const methodMap = new Map<string, { count: number; volume: number }>();
    const branchMap = new Map<string, { count: number; volume: number }>();

    payments.forEach((p) => {
      const amt = parseFloat(p.amount || p.total_amount || '0') || 0;
      totalVolume += amt;

      const s = (p.status || '').toLowerCase();
      const isPaid = p.is_paid || s === 'success' || s === 'paid';

      if (isPaid) {
        paidVolume += amt;
        paidCount++;
      } else {
        pendingVolume += amt;
        pendingCount++;
      }

      // Method Breakdown
      const methodKey = p.payment_provider || p.provider || p.payment_method || 'Other';
      const mCur = methodMap.get(methodKey) || { count: 0, volume: 0 };
      methodMap.set(methodKey, { count: mCur.count + 1, volume: mCur.volume + amt });

      // Branch Breakdown
      const branchKey = p.branch_name || 'Unassigned Branch';
      const bCur = branchMap.get(branchKey) || { count: 0, volume: 0 };
      branchMap.set(branchKey, { count: bCur.count + 1, volume: bCur.volume + amt });
    });

    const avgTicket = payments.length > 0 ? totalVolume / payments.length : 0;

    return {
      totalCount: payments.length,
      totalVolume,
      paidCount,
      paidVolume,
      pendingCount,
      pendingVolume,
      avgTicket,
      methodBreakdown: Array.from(methodMap.entries()).map(([name, data]) => ({ name, ...data })),
      branchBreakdown: Array.from(branchMap.entries()).map(([name, data]) => ({ name, ...data })),
    };
  }, [payments]);

  // Formatted generation time
  const generatedAt = useMemo(() => {
    return new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  // WhatsApp Message formulation
  const whatsappMessage = useMemo(() => {
    const branchLabel = activeFilters.branch || 'All Branches';
    const dateLabel = activeFilters.dateLabel || 'All Time';
    const statusLabel = activeFilters.status || 'All Statuses';

    let msg = `*📊 USH SPA - Payments & Financial Report*\n`;
    msg += `📅 *Date Range:* ${dateLabel}\n`;
    msg += `🏢 *Branch:* ${branchLabel}\n`;
    msg += `🏷️ *Status Filter:* ${statusLabel}\n`;
    if (activeFilters.payment_through) {
      msg += `💳 *Channel:* ${activeFilters.payment_through.toUpperCase()}\n`;
    }
    msg += `\n`;

    msg += `*📈 Financial Summary:*\n`;
    msg += `• *Total Transactions:* ${metrics.totalCount}\n`;
    msg += `• *Total Volume:* ${formatKwd(metrics.totalVolume)} KWD\n`;
    msg += `• *Paid / Settled:* ${metrics.paidCount} tx (${formatKwd(metrics.paidVolume)} KWD)\n`;
    if (metrics.pendingCount > 0) {
      msg += `• *Pending / Unpaid:* ${metrics.pendingCount} tx (${formatKwd(metrics.pendingVolume)} KWD)\n`;
    }
    msg += `• *Avg Transaction:* ${formatKwd(metrics.avgTicket)} KWD\n\n`;

    if (metrics.methodBreakdown.length > 0) {
      msg += `*💳 By Payment Method:*\n`;
      metrics.methodBreakdown.forEach((m) => {
        msg += `• ${m.name}: ${m.count} tx (${formatKwd(m.volume)} KWD)\n`;
      });
      msg += `\n`;
    }

    if (metrics.branchBreakdown.length > 1) {
      msg += `*🏢 By Branch:*\n`;
      metrics.branchBreakdown.forEach((b) => {
        msg += `• ${b.name}: ${b.count} tx (${formatKwd(b.volume)} KWD)\n`;
      });
      msg += `\n`;
    }

    msg += `_Generated on ${generatedAt} via USHDesk ERP_`;
    return msg;
  }, [activeFilters, metrics, generatedAt]);

  const handleCopyMessage = () => {
    navigator.clipboard?.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const url = whatsappShareUrl(waPhone, whatsappMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Isolated Printing / PDF export
  const handlePrint = () => {
    const reportElement = reportRef.current;
    if (!reportElement) {
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
        <title>Payments_Report_${new Date().toISOString().split('T')[0]}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
          }
          .report-container {
            width: 100%;
            margin: 0 auto;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            margin: 0 0 2px 0;
          }
          .report-title {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            margin: 0;
          }
          .meta-box {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .meta-box strong {
            color: #0f172a;
          }
          .badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 16px;
          }
          .badge {
            display: inline-block;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            color: #334155;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .kpi-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
          }
          .kpi-value {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            font-family: monospace;
          }
          .kpi-sub {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 20px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 6px 8px;
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          tr {
            page-break-inside: avoid;
          }
          .text-right {
            text-align: right;
          }
          .font-mono {
            font-family: monospace;
          }
          .font-bold {
            font-weight: 700;
          }
          .status-paid {
            color: #15803d;
            font-weight: 700;
          }
          .status-pending {
            color: #b45309;
            font-weight: 600;
          }
          .status-failed {
            color: #b91c1c;
            font-weight: 600;
          }
          .footer-box {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header-box">
            <div>
              <h1 class="brand-title">USH SPA & SALON</h1>
              <p class="report-title">Payment Transactions & Financial Report</p>
            </div>
            <div class="meta-box">
              <p style="margin: 0 0 2px 0;">Generated: <strong>${generatedAt}</strong></p>
              <p style="margin: 0;">Currency: <strong>KWD (Kuwaiti Dinar)</strong></p>
            </div>
          </div>

          <div class="badge-row">
            <span class="badge">Branch: <strong>${activeFilters.branch || 'All Branches'}</strong></span>
            <span class="badge">Date Range: <strong>${activeFilters.dateLabel || 'All Time'}</strong></span>
            <span class="badge">Status: <strong>${activeFilters.status || 'All Statuses'}</strong></span>
            ${activeFilters.payment_through ? `<span class="badge">Channel: <strong>${activeFilters.payment_through.toUpperCase()}</strong></span>` : ''}
            ${activeFilters.provider ? `<span class="badge">Provider: <strong>${activeFilters.provider}</strong></span>` : ''}
            <span class="badge">Total Records: <strong>${metrics.totalCount}</strong></span>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Total Volume</div>
              <div class="kpi-value">${formatKwd(metrics.totalVolume)} KWD</div>
              <div class="kpi-sub">${metrics.totalCount} total transactions</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Paid / Settled</div>
              <div class="kpi-value" style="color: #166534;">${formatKwd(metrics.paidVolume)} KWD</div>
              <div class="kpi-sub">${metrics.paidCount} paid transactions</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Pending / Unpaid</div>
              <div class="kpi-value" style="color: #9a3412;">${formatKwd(metrics.pendingVolume)} KWD</div>
              <div class="kpi-sub">${metrics.pendingCount} pending transactions</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Average Ticket</div>
              <div class="kpi-value">${formatKwd(metrics.avgTicket)} KWD</div>
              <div class="kpi-sub">Per transaction</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Payment / Inv #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Method / Channel</th>
                <th>Status</th>
                <th class="text-right">Amount (KWD)</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((p, idx) => {
                const s = (p.status || '').toLowerCase();
                const isPaid = p.is_paid || s === 'success' || s === 'paid';
                const statusClass = isPaid ? 'status-paid' : s.includes('fail') ? 'status-failed' : 'status-pending';
                const statusText = isPaid ? 'Paid' : (p.status || 'Pending');

                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>
                      <span class="font-mono font-bold">${p.payment_number || p.payment_id || '—'}</span>
                      ${p.invoice_number ? `<br/><span style="color:#64748b; font-size:9px;">Inv: ${p.invoice_number}</span>` : ''}
                      ${p.booking_number ? `<br/><span style="color:#64748b; font-size:9px;">Bok: ${p.booking_number}</span>` : ''}
                    </td>
                    <td>${formatDateTime(p.created_at)}</td>
                    <td>
                      <strong>${p.customer_name || 'Customer'}</strong>
                      ${p.customer_mobile ? `<br/><span style="color:#64748b;">${p.customer_mobile}</span>` : ''}
                    </td>
                    <td><strong>${p.branch_name || '—'}</strong></td>
                    <td>
                      ${p.payment_provider || p.provider || p.payment_method || '—'}
                      ${p.payment_through ? `<span style="color:#64748b; font-size:9px;"> (${p.payment_through})</span>` : ''}
                    </td>
                    <td class="${statusClass}">${statusText}</td>
                    <td class="text-right font-mono font-bold">${formatKwd(p.amount || p.total_amount || '0')}</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="7" class="text-right" style="padding: 8px;">TOTAL REVENUE:</td>
                <td class="text-right font-mono font-bold" style="padding: 8px; font-size: 12px; color: #0f172a;">
                  ${formatKwd(metrics.totalVolume)} KWD
                </td>
              </tr>
            </tbody>
          </table>

          <div class="footer-box">
            <span>USH SPA Management System — Confidential Financial Document</span>
            <span>Printed on: ${generatedAt}</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() {
              window.frameElement?.remove();
            }, 1200);
          };
        </script>
      </body>
      </html>
    `);
    doc.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-border/70 bg-card shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in-50 zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground tracking-tight flex items-center gap-2">
                Payments Financial Report
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing {metrics.totalCount} filtered record{metrics.totalCount !== 1 ? 's' : ''} · Generated on {generatedAt}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWhatsAppPanel(!showWhatsAppPanel)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer shadow-xs',
                showWhatsAppPanel
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50'
              )}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Share WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition cursor-pointer active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp Sharing Drawer/Banner */}
        {showWhatsAppPanel && (
          <div className="border-b border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/20 px-6 py-3.5 transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  Share Financial Summary via WhatsApp
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Enter recipient phone number or leave empty to pick directly in WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="e.g. 96590000000"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    className="h-8 w-full rounded-xl border border-emerald-300/60 dark:border-emerald-800 bg-card pl-8 pr-2.5 text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <button
                  onClick={handleSendWhatsApp}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer whitespace-nowrap"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Open WhatsApp
                </button>

                <button
                  onClick={handleCopyMessage}
                  title="Copy Report Text"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/60 bg-card px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 transition cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Report Content */}
        <div ref={reportRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Header Brand & Active Filters */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">USH SPA & SALON</span>
                <h1 className="text-xl font-extrabold text-foreground">Payments Summary Report</h1>
              </div>
              <div className="sm:text-right text-xs text-muted-foreground space-y-0.5">
                <p>Generated: <span className="font-semibold text-foreground">{generatedAt}</span></p>
                <p>Currency: <span className="font-semibold text-foreground">KWD</span></p>
              </div>
            </div>

            {/* Filter tags */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground font-semibold">Active Filters:</span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground">
                <Building2 className="h-3 w-3 text-primary" />
                {activeFilters.branch || 'All Branches'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground">
                <Calendar className="h-3 w-3 text-primary" />
                {activeFilters.dateLabel || 'All Time'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" />
                Status: {activeFilters.status || 'All Statuses'}
              </span>
              {activeFilters.payment_through && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground uppercase">
                  <CreditCard className="h-3 w-3 text-primary" />
                  Channel: {activeFilters.payment_through}
                </span>
              )}
              {activeFilters.provider && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-bold text-foreground">
                  <CreditCard className="h-3 w-3 text-primary" />
                  {activeFilters.provider}
                </span>
              )}
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Volume */}
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" /> Total Volume
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-foreground font-mono">
                {formatKwd(metrics.totalVolume)} <span className="text-xs font-normal text-muted-foreground">KWD</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                {metrics.totalCount} total transactions
              </p>
            </div>

            {/* Paid Amount */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/10 p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Settled / Paid
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {formatKwd(metrics.paidVolume)} <span className="text-xs font-normal text-emerald-600/70">KWD</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-700/80 font-medium">
                {metrics.paidCount} transactions ({metrics.totalCount > 0 ? Math.round((metrics.paidCount / metrics.totalCount) * 100) : 0}%)
              </p>
            </div>

            {/* Pending Amount */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/10 p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending / Unpaid
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {formatKwd(metrics.pendingVolume)} <span className="text-xs font-normal text-amber-600/70">KWD</span>
              </p>
              <p className="mt-1 text-[11px] text-amber-700/80 font-medium">
                {metrics.pendingCount} transactions
              </p>
            </div>

            {/* Average Ticket */}
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-4 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Average Ticket
              </p>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-foreground font-mono">
                {formatKwd(metrics.avgTicket)} <span className="text-xs font-normal text-muted-foreground">KWD</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Per transaction average
              </p>
            </div>
          </div>

          {/* Breakdown Mini-Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Payment Provider */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" /> Breakdown By Payment Method
              </p>
              <div className="divide-y divide-border/40 text-xs">
                {metrics.methodBreakdown.map((m) => (
                  <div key={m.name} className="py-2 flex items-center justify-between">
                    <span className="font-semibold text-foreground capitalize">{m.name}</span>
                    <div className="text-right font-mono">
                      <span className="font-bold text-foreground">{formatKwd(m.volume)} KWD</span>
                      <span className="text-muted-foreground text-[11px] ml-1.5">({m.count} tx)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Branch */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Breakdown By Branch
              </p>
              <div className="divide-y divide-border/40 text-xs">
                {metrics.branchBreakdown.map((b) => (
                  <div key={b.name} className="py-2 flex items-center justify-between">
                    <span className="font-semibold text-foreground">{b.name}</span>
                    <div className="text-right font-mono">
                      <span className="font-bold text-foreground">{formatKwd(b.volume)} KWD</span>
                      <span className="text-muted-foreground text-[11px] ml-1.5">({b.count} tx)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Itemised Transactions Table */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
            <div className="border-b border-border/50 bg-muted/40 px-5 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Itemised Payment Transactions ({payments.length})
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4 w-10">#</th>
                    <th className="py-3 px-4">Payment #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Method / Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount (KWD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {payments.map((p, idx) => {
                    const s = (p.status || '').toLowerCase();
                    const isPaid = p.is_paid || s === 'success' || s === 'paid';

                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 text-muted-foreground font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono font-bold text-primary block truncate max-w-[130px]">
                            {p.payment_number || p.payment_id || '—'}
                          </span>
                          {p.invoice_number && (
                            <span className="font-mono text-[10px] text-muted-foreground block truncate">
                              Inv: {p.invoice_number}
                            </span>
                          )}
                          {p.booking_number && (
                            <span className="font-mono text-[10px] text-muted-foreground block truncate">
                              Bok: {p.booking_number}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(p.created_at)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-foreground block truncate max-w-[140px]">
                            {p.customer_name || 'Customer'}
                          </span>
                          {p.customer_mobile && (
                            <span className="text-[11px] text-muted-foreground block font-mono">
                              {p.customer_mobile}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-foreground block truncate max-w-[130px]">
                            {p.branch_name || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-medium text-foreground capitalize block truncate">
                            {p.payment_provider || p.provider || p.payment_method || '—'}
                          </span>
                          {p.payment_through && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {p.payment_through}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize',
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : s.includes('fail')
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            )}
                          >
                            {isPaid ? 'Paid' : (p.status || 'Pending')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                          {formatKwd(p.amount || p.total_amount || '0')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/60 bg-muted/40 font-bold text-foreground">
                    <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                      Total ({payments.length} Payments):
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-black text-primary">
                      {formatKwd(metrics.totalVolume)} KWD
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-3.5">
          <p className="text-xs text-muted-foreground">
            Total Revenue: <span className="font-bold text-foreground font-mono">{formatKwd(metrics.totalVolume)} KWD</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
