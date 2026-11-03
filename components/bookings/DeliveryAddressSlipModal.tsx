'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  X,
  MapPin,
  Phone,
  Sparkles,
  Package,
  Calendar,
  Gift,
  Heart,
  Truck,
  CheckCircle2,
  Copy,
  Check,
  User,
  AlertCircle,
  QrCode,
  Layers,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

export interface DeliveryAddressSlipItem {
  sku?: string;
  name?: string;
  name_en?: string;
  name_ar?: string;
  image?: string;
  price?: number | string;
  quantity?: number;
  product_id?: string;
  total_price?: number | string;
  currency?: string;
}

export interface DeliveryAddressSlipData {
  id: string;
  voucher_number?: string | null;
  voucher_no?: string | null;
  secret_code?: string | null;
  public_token?: string | null;
  created_at?: string | null;
  gift_category?: string;
  total_amount?: string | number;
  currency?: string;
  delivery_status?: string | null;
  delivery_status_label?: string | null;
  delivery_address?: {
    area?: string;
    city?: string;
    block?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    notes?: string;
    formatted?: string;
    [key: string]: any;
  } | null;
  sender_data?: {
    name?: string;
    phone_number?: string;
  } | null;
  recipient_data?: {
    name?: string;
    phone_number?: string;
    email?: string;
  } | null;
  recipient_phone?: string | null;
  gift_message?: string | null;
  ordered_items?: DeliveryAddressSlipItem[] | null;
  service_data?: {
    name?: string;
    currency?: string;
    base_price?: string;
  } | null;
}

export interface DeliveryAddressSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DeliveryAddressSlipData | null;
  initialItemIndex?: number | null;
}

export function DeliveryAddressSlipModal({
  isOpen,
  onClose,
  order,
  initialItemIndex = null,
}: DeliveryAddressSlipModalProps) {
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | 'all'>(
    typeof initialItemIndex === 'number' ? initialItemIndex : 'all'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const slipContainerRef = useRef<HTMLDivElement>(null);

  // Sync initial item selection when opened
  useEffect(() => {
    if (typeof initialItemIndex === 'number') {
      setSelectedItemIdx(initialItemIndex);
    } else {
      setSelectedItemIdx('all');
    }
  }, [initialItemIndex, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const addr = order.delivery_address;
  const items = order.ordered_items && order.ordered_items.length > 0 ? order.ordered_items : [];
  const voucherCode = order.secret_code || order.voucher_number || order.voucher_no || `#${order.id.slice(0, 8).toUpperCase()}`;
  const trackingUrl = order.public_token
    ? `https://desk.ushspa.co/gift/track/${order.public_token}`
    : voucherCode;

  // Format date helper
  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('en-GB', {
        timeZone: KUWAIT_TZ,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return val;
    }
  };

  const formattedAddressText = (() => {
    if (!addr) return 'No delivery address specified';
    if (addr.formatted && typeof addr.formatted === 'string' && addr.formatted.trim()) {
      return addr.formatted.trim();
    }
    const parts = [
      addr.area && `Area: ${addr.area}`,
      addr.block && `Block: ${addr.block}`,
      addr.street && `Street: ${addr.street}`,
      addr.building && `Bldg: ${addr.building}`,
      (addr.floor || addr.apartment) && [addr.floor && `Fl: ${addr.floor}`, addr.apartment && `Apt: ${addr.apartment}`].filter(Boolean).join(', '),
      addr.city && `City: ${addr.city}`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No delivery address specified';
  })();

  // Build clean HTML slip for print
  const buildSlipHtml = (targetItem?: DeliveryAddressSlipItem | null, itemNum?: number) => {
    const isSingleItem = Boolean(targetItem);
    const displayedItems = isSingleItem && targetItem ? [targetItem] : items;
    const recipientPhone = order.recipient_phone || order.recipient_data?.phone_number || '—';
    const recipientName = order.recipient_data?.name || 'Valued Recipient';
    const senderName = order.sender_data?.name || 'Valued Guest';
    const senderPhone = order.sender_data?.phone_number || '';
    const orderDate = formatDate(order.created_at);
    const currentDate = new Date().toLocaleDateString('en-GB', {
      timeZone: KUWAIT_TZ,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Extract SVG string from QR
    const qrSvgString = qrRef.current ? qrRef.current.innerHTML : '';

    return `
      <div class="address-slip">
        <!-- Brand Header Bar -->
        <div class="slip-header">
          <div class="brand-left">
            <div class="brand-title">USH SPA</div>
            <div class="brand-sub">LUXURY WELLNESS &amp; SPA &bull; STATE OF KUWAIT</div>
          </div>
          <div class="slip-type-badge">
            <div class="badge-title">DELIVERY ADDRESS SLIP</div>
            <div class="badge-sub">${isSingleItem ? `ITEM ${itemNum} OF ${items.length || 1}` : `PARCEL PACKAGE (${items.length || 1} ITEMS)`}</div>
          </div>
        </div>

        <!-- Meta Bar -->
        <div class="meta-strip">
          <div><span class="meta-label">VOUCHER CODE:</span> <span class="meta-val font-mono">${voucherCode}</span></div>
          <div><span class="meta-label">ORDER ID:</span> <span class="meta-val font-mono">#${order.id.slice(0, 8).toUpperCase()}</span></div>
          <div><span class="meta-label">DISPATCH DATE:</span> <span class="meta-val">${currentDate}</span></div>
        </div>

        <!-- Recipient (Deliver To) Banner -->
        <div class="section-box recipient-box">
          <div class="section-banner">
            <span>DELIVER TO &bull; المستلم</span>
            <span class="priority-tag">HANDLE WITH CARE</span>
          </div>
          <div class="recipient-body">
            <div class="recipient-name">${recipientName}</div>
            <div class="recipient-phone">
              <span class="phone-icon">&#9742;</span>
              <strong>${recipientPhone}</strong>
            </div>

            <!-- Structured Kuwait Address Table -->
            <div class="address-grid">
              ${addr?.area ? `<div class="addr-cell"><span class="cell-lbl">AREA / المنطقة:</span><span class="cell-val font-bold">${addr.area}</span></div>` : ''}
              ${addr?.block ? `<div class="addr-cell"><span class="cell-lbl">BLOCK / القطعة:</span><span class="cell-val font-bold">${addr.block}</span></div>` : ''}
              ${addr?.street ? `<div class="addr-cell"><span class="cell-lbl">STREET / الشارع:</span><span class="cell-val font-bold">${addr.street}</span></div>` : ''}
              ${addr?.building ? `<div class="addr-cell"><span class="cell-lbl">BLDG / المبنى:</span><span class="cell-val font-bold">${addr.building}</span></div>` : ''}
              ${(addr?.floor || addr?.apartment) ? `<div class="addr-cell"><span class="cell-lbl">FLOOR / APT:</span><span class="cell-val font-bold">${[addr.floor && `Fl: ${addr.floor}`, addr.apartment && `Apt: ${addr.apartment}`].filter(Boolean).join(', ')}</span></div>` : ''}
              ${addr?.city ? `<div class="addr-cell"><span class="cell-lbl">CITY / المدينة:</span><span class="cell-val font-bold">${addr.city}</span></div>` : ''}
            </div>

            <div class="full-address-bar">
              <span class="full-addr-label">FULL ADDRESS:</span> ${formattedAddressText}
            </div>

            ${addr?.notes ? `
              <div class="delivery-notes-callout">
                <strong>&#9888; DRIVER INSTRUCTIONS:</strong> &ldquo;${addr.notes}&rdquo;
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Package Content / Item Details -->
        <div class="section-box item-box">
          <div class="section-banner item-banner">
            <span>PARCEL ITEM CONTENTS &bull; محتويات الشحنة</span>
            <span>${displayedItems.length} ITEM${displayedItems.length > 1 ? 'S' : ''}</span>
          </div>
          <div class="item-list">
            ${displayedItems.length > 0 ? displayedItems.map((itm, idx) => `
              <div class="item-row">
                <div class="item-check">&#9633;</div>
                <div class="item-info">
                  <div class="item-name">${itm.name_en || itm.name || 'Spa Physical Gift Item'}</div>
                  ${itm.sku ? `<div class="item-sku">SKU: ${itm.sku}</div>` : ''}
                </div>
                <div class="item-qty">
                  <strong>QTY: ${itm.quantity ?? 1}</strong>
                </div>
              </div>
            `).join('') : `
              <div class="item-row">
                <div class="item-check">&#9633;</div>
                <div class="item-info">
                  <div class="item-name">${order.service_data?.name || 'Luxury Spa Physical Gift Box'}</div>
                </div>
                <div class="item-qty"><strong>QTY: 1</strong></div>
              </div>
            `}
          </div>
        </div>

        <!-- Sender & Personal Gift Message -->
        <div class="split-row">
          <div class="sender-subbox">
            <div class="subbox-title">GIFT FROM &bull; من</div>
            <div class="sender-name">${senderName}</div>
            ${senderPhone ? `<div class="sender-phone">Tel: ${senderPhone}</div>` : ''}
          </div>

          ${order.gift_message ? `
            <div class="gift-message-subbox">
              <div class="subbox-title">&#10084; PERSONAL GIFT MESSAGE</div>
              <div class="message-quote">&ldquo;${order.gift_message}&rdquo;</div>
            </div>
          ` : ''}
        </div>

        <!-- Verification, QR Code & Signatures -->
        <div class="bottom-strip">
          <div class="qr-col">
            <div class="qr-box">${qrSvgString}</div>
            <div class="qr-sub">SCAN TO TRACK</div>
          </div>
          <div class="signature-col">
            <div class="sig-line">Packaged By: ___________________</div>
            <div class="sig-line">Courier / Driver: ___________________</div>
            <div class="sig-line">Recipient Sign: ___________________</div>
          </div>
        </div>

        <!-- Slip Footer -->
        <div class="slip-footer">
          <span>USH SPA LUXURY CARE &bull; STATE OF KUWAIT &bull; www.ushspa.co</span>
        </div>
      </div>
    `;
  };

  // Perform isolated iframe print
  const handlePrint = (mode: 'selected' | 'all') => {
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

    let slipsHtml = '';
    if (mode === 'selected') {
      if (selectedItemIdx === 'all' || items.length === 0) {
        slipsHtml = buildSlipHtml(null);
      } else {
        const item = items[selectedItemIdx];
        slipsHtml = buildSlipHtml(item, selectedItemIdx + 1);
      }
    } else {
      // Print all items: each item on a separate page
      if (items.length <= 1) {
        slipsHtml = buildSlipHtml(items[0] || null, 1);
      } else {
        slipsHtml = items
          .map((item, idx) => `<div class="page-break-wrapper">${buildSlipHtml(item, idx + 1)}</div>`)
          .join('');
      }
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Delivery Slip - ${voucherCode}</title>
        <style>
          @page {
            size: 100mm 150mm;
            margin: 4mm;
          }
          @media print {
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #111827 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .page-break-wrapper {
              page-break-after: always;
              break-after: page;
            }
            .page-break-wrapper:last-child {
              page-break-after: auto;
              break-after: auto;
            }
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-size: 11px;
            line-height: 1.35;
          }
          .address-slip {
            width: 100%;
            max-width: 96mm;
            margin: 0 auto;
            border: 2px solid #1f2937;
            border-radius: 8px;
            padding: 8px;
            background: #ffffff;
          }
          .slip-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #1f2937;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.15em;
            color: #111827;
            line-height: 1;
          }
          .brand-sub {
            font-size: 8px;
            font-weight: 700;
            color: #6b7280;
            letter-spacing: 0.05em;
            margin-top: 2px;
          }
          .slip-type-badge {
            text-align: right;
            background: #111827;
            color: #ffffff;
            padding: 3px 7px;
            border-radius: 4px;
          }
          .badge-title {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.05em;
          }
          .badge-sub {
            font-size: 7.5px;
            color: #d1d5db;
          }
          .meta-strip {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            padding: 3px 5px;
            background: #f3f4f6;
            border-radius: 4px;
            margin-bottom: 6px;
            border: 1px solid #e5e7eb;
          }
          .meta-label {
            color: #4b5563;
            font-weight: 600;
          }
          .meta-val {
            font-weight: 800;
            color: #111827;
          }
          .font-mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
          .font-bold {
            font-weight: 700;
          }
          .section-box {
            border: 1.5px solid #1f2937;
            border-radius: 6px;
            margin-bottom: 6px;
            overflow: hidden;
          }
          .section-banner {
            background: #1f2937;
            color: #ffffff;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            padding: 3px 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .priority-tag {
            background: #dc2626;
            color: #ffffff;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 8px;
          }
          .recipient-body {
            padding: 6px;
          }
          .recipient-name {
            font-size: 15px;
            font-weight: 900;
            color: #111827;
            line-height: 1.2;
          }
          .recipient-phone {
            font-size: 13px;
            color: #111827;
            margin: 3px 0 5px 0;
            background: #fef3c7;
            padding: 3px 6px;
            border-radius: 4px;
            display: inline-block;
            border: 1px solid #f59e0b;
          }
          .phone-icon {
            margin-right: 4px;
          }
          .address-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3px;
            margin: 4px 0;
            font-size: 9.5px;
          }
          .addr-cell {
            background: #f9fafb;
            padding: 2.5px 4px;
            border-radius: 3px;
            border: 1px solid #e5e7eb;
          }
          .cell-lbl {
            color: #6b7280;
            font-size: 8px;
            display: block;
          }
          .cell-val {
            font-size: 10px;
            color: #111827;
          }
          .full-address-bar {
            font-size: 9px;
            padding: 4px;
            background: #f3f4f6;
            border-radius: 3px;
            margin-top: 3px;
            line-height: 1.3;
          }
          .full-addr-label {
            font-weight: 700;
            color: #4b5563;
          }
          .delivery-notes-callout {
            margin-top: 4px;
            padding: 4px 6px;
            background: #fffbeb;
            border: 1px dashed #d97706;
            border-radius: 4px;
            font-size: 9px;
            color: #92400e;
          }
          .item-box {
            border-color: #374151;
          }
          .item-banner {
            background: #374151;
          }
          .item-list {
            padding: 4px 6px;
          }
          .item-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 3px 0;
            border-bottom: 1px dashed #e5e7eb;
          }
          .item-row:last-child {
            border-bottom: none;
          }
          .item-check {
            font-size: 13px;
            margin-right: 5px;
            color: #4b5563;
          }
          .item-info {
            flex: 1;
            font-size: 9.5px;
          }
          .item-name {
            font-weight: 700;
            color: #111827;
          }
          .item-sku {
            font-size: 8px;
            color: #6b7280;
          }
          .item-qty {
            font-size: 10px;
            color: #111827;
          }
          .split-row {
            display: flex;
            gap: 5px;
            margin-bottom: 6px;
          }
          .sender-subbox {
            flex: 1;
            border: 1px solid #d1d5db;
            border-radius: 5px;
            padding: 4px 6px;
            background: #f9fafb;
          }
          .subbox-title {
            font-size: 8px;
            font-weight: 800;
            color: #4b5563;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
          }
          .sender-name {
            font-size: 10px;
            font-weight: 700;
            color: #111827;
          }
          .sender-phone {
            font-size: 8.5px;
            color: #6b7280;
          }
          .gift-message-subbox {
            flex: 1.3;
            border: 1px solid #fbcfe8;
            border-radius: 5px;
            padding: 4px 6px;
            background: #fdf2f8;
          }
          .message-quote {
            font-size: 8.5px;
            font-style: italic;
            color: #831843;
            line-height: 1.25;
          }
          .bottom-strip {
            display: flex;
            align-items: center;
            gap: 8px;
            border-top: 1px solid #e5e7eb;
            padding-top: 5px;
            margin-bottom: 4px;
          }
          .qr-col {
            text-align: center;
          }
          .qr-box svg {
            width: 58px;
            height: 58px;
            display: block;
          }
          .qr-sub {
            font-size: 7px;
            font-weight: 700;
            color: #6b7280;
            margin-top: 1px;
          }
          .signature-col {
            flex: 1;
            font-size: 8px;
            color: #4b5563;
          }
          .sig-line {
            padding: 2.5px 0;
            border-bottom: 1px dotted #d1d5db;
          }
          .slip-footer {
            text-align: center;
            font-size: 7.5px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 3px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${slipsHtml}
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

  const currentDisplayItem =
    selectedItemIdx !== 'all' && items[selectedItemIdx] ? items[selectedItemIdx] : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4">
      {/* Hidden QR Code generator for print capture */}
      <div className="hidden" ref={qrRef}>
        <QRCodeSVG value={trackingUrl} size={64} level="M" />
      </div>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/50 bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-foreground">
                  Delivery Address Slip
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 className="h-3 w-3" /> USH Brand Standard
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>Voucher: <strong className="font-mono text-foreground">{voucherCode}</strong></span>
                <span>&bull;</span>
                <span>{items.length} Product{items.length !== 1 ? 's' : ''}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrint('selected')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Slip</span>
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

        {/* Item Selection Tabs (when multiple items exist) */}
        {items.length > 1 && (
          <div className="shrink-0 flex items-center gap-1.5 px-6 py-2.5 bg-muted/20 border-b border-border/40 overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
              <Layers className="h-3.5 w-3.5 text-primary" /> Target:
            </span>
            <button
              type="button"
              onClick={() => setSelectedItemIdx('all')}
              className={cn(
                'rounded-lg px-3 py-1.5 font-bold transition shrink-0 cursor-pointer',
                selectedItemIdx === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
              )}
            >
              All Items ({items.length})
            </button>
            {items.map((itm, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedItemIdx(idx)}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5',
                  selectedItemIdx === idx
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
                )}
              >
                <span>Item {idx + 1}:</span>
                <span className="truncate max-w-[130px]">{itm.name_en || itm.name || 'Product'}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => handlePrint('all')}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 font-bold transition shrink-0 cursor-pointer"
              title="Print an individual slip for each item on separate pages"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print All Slips ({items.length} pages)</span>
            </button>
          </div>
        )}

        {/* Preview Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/15">
          <div
            ref={slipContainerRef}
            className="mx-auto w-full max-w-[460px] bg-white text-slate-900 rounded-2xl shadow-xl border-2 border-slate-900 p-5 font-sans text-xs select-text"
          >
            {/* Header: Brand Banner */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
              <div>
                <div className="flex items-center gap-1 text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xl font-black tracking-widest uppercase">USH SPA</span>
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mt-0.5">
                  Luxury Wellness &bull; State of Kuwait
                </p>
              </div>
              <div className="text-right bg-slate-900 text-white rounded-lg px-2.5 py-1.5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider">DELIVERY ADDRESS SLIP</p>
                <p className="text-[8px] text-slate-300 font-semibold">
                  {selectedItemIdx === 'all'
                    ? `Package: ${items.length || 1} Item${items.length > 1 ? 's' : ''}`
                    : `Item ${typeof selectedItemIdx === 'number' ? selectedItemIdx + 1 : 1} of ${items.length || 1}`}
                </p>
              </div>
            </div>

            {/* Order Metadata Strip */}
            <div className="flex items-center justify-between bg-slate-100 rounded-lg px-2.5 py-1.5 mb-3 border border-slate-200 text-[10px]">
              <div>
                <span className="text-slate-500 font-semibold">Voucher Code: </span>
                <span className="font-mono font-bold text-slate-900">{voucherCode}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Order: </span>
                <span className="font-mono font-bold text-slate-900">#{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Date: </span>
                <span className="font-bold text-slate-900">
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Recipient / Delivery Address Section */}
            <div className="rounded-xl border-2 border-slate-900 overflow-hidden mb-3">
              <div className="bg-slate-900 text-white px-3 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-amber-400" />
                  Deliver To &bull; المستلم
                </span>
                <span className="bg-red-600 text-white px-1.5 py-0.2 rounded text-[8px] font-bold">
                  Fragile Gift
                </span>
              </div>
              <div className="p-3 bg-white space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      {order.recipient_data?.name || 'Valued Recipient'}
                    </h4>
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-md px-2 py-0.5 mt-1 font-bold text-xs">
                      <Phone className="h-3.5 w-3.5 text-amber-700" />
                      <span>{order.recipient_phone || order.recipient_data?.phone_number || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Structured Kuwait Address Grid */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                  {addr?.area && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">Area / المنطقة</span>
                      <strong className="text-slate-900">{addr.area}</strong>
                    </div>
                  )}
                  {addr?.block && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">Block / القطعة</span>
                      <strong className="text-slate-900">{addr.block}</strong>
                    </div>
                  )}
                  {addr?.street && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">Street / الشارع</span>
                      <strong className="text-slate-900">{addr.street}</strong>
                    </div>
                  )}
                  {addr?.building && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">Building / المبنى</span>
                      <strong className="text-slate-900">{addr.building}</strong>
                    </div>
                  )}
                  {(addr?.floor || addr?.apartment) && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">Floor / Apt</span>
                      <strong className="text-slate-900">
                        {[addr.floor && `Fl: ${addr.floor}`, addr.apartment && `Apt: ${addr.apartment}`].filter(Boolean).join(', ')}
                      </strong>
                    </div>
                  )}
                  {addr?.city && (
                    <div className="bg-slate-50 rounded-md p-1.5 border border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-500 block">City / المدينة</span>
                      <strong className="text-slate-900">{addr.city}</strong>
                    </div>
                  )}
                </div>

                {/* Formatted string */}
                <div className="bg-slate-100 rounded-md p-2 text-[10px] text-slate-700 leading-relaxed border border-slate-200">
                  <strong className="text-slate-900 font-bold">Address: </strong>
                  {formattedAddressText}
                </div>

                {/* Delivery Notes */}
                {addr?.notes && (
                  <div className="rounded-lg bg-amber-50 border border-amber-300 p-2 text-[10px] text-amber-900 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Driver Instructions: </strong>
                      <span className="italic">&ldquo;{addr.notes}&rdquo;</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product Item / Parcel Contents Section */}
            <div className="rounded-xl border border-slate-700 overflow-hidden mb-3">
              <div className="bg-slate-800 text-white px-3 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Package className="h-3 w-3 text-amber-400" />
                  Parcel Items &bull; محتويات الشحنة
                </span>
                <span className="text-[9px] text-slate-300 font-semibold">
                  {currentDisplayItem ? '1 Specific Item' : `${items.length || 1} Items Included`}
                </span>
              </div>
              <div className="p-2.5 bg-white divide-y divide-dashed divide-slate-200 text-xs">
                {currentDisplayItem ? (
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border border-slate-400 rounded grid place-items-center text-[10px] font-bold text-slate-600">
                        &#10003;
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs">
                          {currentDisplayItem.name_en || currentDisplayItem.name || 'Luxury Spa Product'}
                        </p>
                        {currentDisplayItem.sku && (
                          <p className="text-[9px] font-mono text-slate-500">SKU: {currentDisplayItem.sku}</p>
                        )}
                      </div>
                    </div>
                    <span className="bg-slate-100 font-bold text-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                      Qty: {currentDisplayItem.quantity ?? 1}
                    </span>
                  </div>
                ) : items.length > 0 ? (
                  items.map((itm, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-slate-400 rounded grid place-items-center text-[10px] font-bold text-slate-400">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">
                            {itm.name_en || itm.name || 'Spa Physical Gift Item'}
                          </p>
                          {itm.sku && (
                            <p className="text-[9px] font-mono text-slate-500">SKU: {itm.sku}</p>
                          )}
                        </div>
                      </div>
                      <span className="bg-slate-100 font-bold text-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                        Qty: {itm.quantity ?? 1}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between py-1">
                    <p className="font-bold text-slate-900 text-xs">
                      {order.service_data?.name || 'Luxury Spa Physical Gift Box'}
                    </p>
                    <span className="bg-slate-100 font-bold text-slate-800 px-2 py-0.5 rounded text-[10px]">
                      Qty: 1
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sender & Gift Message Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                  Gift From &bull; مرسل الهدية
                </p>
                <p className="font-bold text-slate-900 text-xs">{order.sender_data?.name || 'Valued Guest'}</p>
                {order.sender_data?.phone_number && (
                  <p className="text-[9px] text-slate-600 mt-0.5">Tel: {order.sender_data.phone_number}</p>
                )}
              </div>

              {order.gift_message ? (
                <div className="rounded-lg border border-pink-200 bg-pink-50/60 p-2 text-xs">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-pink-700 mb-0.5 flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5 text-pink-500 fill-pink-500" /> Personal Gift Message
                  </p>
                  <p className="text-[10px] italic text-pink-950 leading-snug">
                    &ldquo;{order.gift_message}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 flex items-center justify-center text-center">
                  <span className="text-[9px] text-slate-400 italic">No personal message attached</span>
                </div>
              )}
            </div>

            {/* Bottom Strip: QR Code & Courier Signatures */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-200 mb-2">
              <div className="shrink-0 text-center">
                <div className="p-1 border border-slate-300 rounded-lg inline-block bg-white shadow-xs">
                  <QRCodeSVG value={trackingUrl} size={62} level="M" />
                </div>
                <p className="text-[7.5px] font-mono font-bold text-slate-500 mt-0.5">SCAN TO TRACK</p>
              </div>

              <div className="flex-1 text-[9px] text-slate-600 space-y-1.5">
                <div className="border-b border-dotted border-slate-300 pb-0.5 flex justify-between">
                  <span>Packaged By:</span>
                  <span className="text-slate-400">________________</span>
                </div>
                <div className="border-b border-dotted border-slate-300 pb-0.5 flex justify-between">
                  <span>Courier / Driver:</span>
                  <span className="text-slate-400">________________</span>
                </div>
                <div className="border-b border-dotted border-slate-300 pb-0.5 flex justify-between">
                  <span>Recipient Sign:</span>
                  <span className="text-slate-400">________________</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-slate-200 text-[8px] text-slate-400 font-semibold tracking-wider uppercase">
              USH SPA LUXURY CARE &bull; STATE OF KUWAIT &bull; www.ushspa.co
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="shrink-0 flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(formattedAddressText);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground px-3.5 py-2 text-xs font-semibold transition cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCode ? 'Address Copied' : 'Copy Address'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/80 bg-background hover:bg-muted px-4 py-2 text-xs font-semibold text-foreground transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handlePrint('selected')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

