'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, DollarSign, Info, UserCheck } from 'lucide-react';
import {
  allocateProportionalDiscount,
  fmtKwd3,
  getClientDiscountRequesters,
  validateDiscountInput,
} from '@/lib/discount';

export interface DiscountPreviewItem {
  label: string;
  price: number;
}

export interface DiscountControlProps {
  idPrefix?: string;
  subtotal: number;
  currency?: string;
  discount: string;
  onDiscountChange: (val: string) => void;
  discountRequestedBy: string;
  onDiscountRequestedByChange: (val: string) => void;
  previewItems?: DiscountPreviewItem[];
  compact?: boolean;
}

let cachedRequesters: string[] | null = null;

export function DiscountControl({
  idPrefix = 'discount',
  subtotal,
  currency = 'KWD',
  discount,
  onDiscountChange,
  discountRequestedBy,
  onDiscountRequestedByChange,
  previewItems = [],
  compact = false,
}: DiscountControlProps) {
  const [requesters, setRequesters] = useState<string[]>(() =>
    cachedRequesters ?? getClientDiscountRequesters(),
  );

  useEffect(() => {
    if (cachedRequesters && cachedRequesters.length > 0) return;
    let active = true;
    fetch('/api/config/discount-requesters', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.requesters) ? data.requesters : [];
        if (list.length > 0) {
          cachedRequesters = list;
          setRequesters(list);
        }
      })
      .catch(() => {
        // Fallback to NEXT_PUBLIC_DISCOUNT_REQUESTED_BY already loaded
      });
    return () => {
      active = false;
    };
  }, []);

  const parsedDiscount = Math.max(0, parseFloat(discount) || 0);
  const hasRequester = discountRequestedBy.trim().length > 0;
  const validation = useMemo(
    () => validateDiscountInput(subtotal, parsedDiscount, discountRequestedBy),
    [subtotal, parsedDiscount, discountRequestedBy],
  );

  const proportionalPreview = useMemo(() => {
    if (parsedDiscount <= 0 || !validation.valid || previewItems.length === 0) return [];
    const positiveItems = previewItems.filter((it) => it.price > 0);
    if (positiveItems.length === 0) return [];
    const alloc = allocateProportionalDiscount(
      positiveItems.map((it) => it.price),
      parsedDiscount,
    );
    return positiveItems.map((it, idx) => ({
      label: it.label,
      ...alloc[idx],
    }));
  }, [parsedDiscount, validation.valid, previewItems]);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${idPrefix}-requester-select`}
          className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <UserCheck className="h-3.5 w-3.5 text-primary" />
          <span>Discount Requested By</span>
        </label>
        <select
          id={`${idPrefix}-requester-select`}
          value={discountRequestedBy}
          onChange={(e) => {
            const next = e.target.value;
            onDiscountRequestedByChange(next);
            if (!next.trim() && parsedDiscount > 0) {
              onDiscountChange('');
            }
          }}
          className="h-8 min-w-[190px] rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">— Select requester —</option>
          {requesters.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${idPrefix}-amount-input`}
          className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          <span>Discount Amount</span>
        </label>
        <div className="relative w-36">
          <input
            id={`${idPrefix}-amount-input`}
            type="number"
            min="0"
            max={subtotal > 0.001 ? Number((subtotal - 0.001).toFixed(3)) : 0}
            step="0.001"
            placeholder="0.000"
            disabled={!hasRequester || subtotal <= 0}
            value={hasRequester ? discount : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0)) {
                onDiscountChange(val);
              }
            }}
            className="h-8 w-full rounded-lg border border-border bg-background pl-2.5 pr-11 text-right text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
            {currency}
          </span>
        </div>
      </div>

      {!hasRequester && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" />
          <span>Select a requester name above to enable discount entry.</span>
        </p>
      )}

      {!validation.valid && validation.error && (
        <p className="text-[11px] font-semibold text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{validation.error}</span>
        </p>
      )}

      {parsedDiscount > 0 && validation.valid && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/20 px-2.5 py-2 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-semibold">
            <span>Discount applied ({discountRequestedBy})</span>
            <span className="font-mono">-{fmtKwd3(parsedDiscount)} {currency}</span>
          </div>
          {proportionalPreview.length > 0 && (
            <div className="border-t border-emerald-500/20 pt-1.5 space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Proportional Item Prices
              </p>
              {proportionalPreview.map((it, idx) => (
                <div key={`${it.label}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-foreground/85">{it.label}</span>
                  <span className="font-mono shrink-0">
                    <span className="line-through text-muted-foreground mr-1.5">{fmtKwd3(it.originalPrice)}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {fmtKwd3(it.discountedPrice)} {currency}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium pt-0.5">
            Non-refundable: discounted bookings/vouchers can be cancelled but are not eligible for refund.
          </p>
        </div>
      )}
    </div>
  );
}
