'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, Filter, X, Check } from 'lucide-react';
import { kuwaitDateString, kuwaitDatePlusDays } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export type DateFilterType = 'all' | 'today' | 'last_week' | 'last_month' | 'custom';

export interface DateRange {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface DateRangeFilterProps {
  dateFilter: DateFilterType;
  dateRange: DateRange;
  onChange: (filterType: DateFilterType, range: DateRange) => void;
  className?: string;
  buttonLabelPrefix?: string;
  align?: 'left' | 'right';
  showBadge?: boolean;
}

/** Check if a target date string matches the active date range */
export function matchesDateRange(
  dateValue: string | Date | null | undefined,
  range: DateRange
): boolean {
  if (!range.from && !range.to) return true;
  if (!dateValue) return false;

  let dStr = '';
  if (dateValue instanceof Date) {
    dStr = kuwaitDateString(dateValue);
  } else if (typeof dateValue === 'string') {
    dStr = dateValue.slice(0, 10);
  }
  if (!dStr) return false;

  if (range.from && dStr < range.from) return false;
  if (range.to && dStr > range.to) return false;
  return true;
}

export function DateRangeFilter({
  dateFilter,
  dateRange,
  onChange,
  className,
  buttonLabelPrefix = 'Date Filters',
  align = 'right',
  showBadge = true,
}: DateRangeFilterProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalFrom, setModalFrom] = useState('');
  const [modalTo, setModalTo] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const handleSelectOption = (type: DateFilterType) => {
    const today = kuwaitDateString();

    if (type === 'custom') {
      setShowDropdown(false);
      setModalFrom(dateRange.from || today);
      setModalTo(dateRange.to || today);
      setShowModal(true);
      return;
    }

    if (type === 'today') {
      onChange('today', { from: today, to: today });
      setShowDropdown(false);
    } else if (type === 'last_week') {
      onChange('last_week', { from: kuwaitDatePlusDays(-7), to: today });
      setShowDropdown(false);
    } else if (type === 'last_month') {
      onChange('last_month', { from: kuwaitDatePlusDays(-30), to: today });
      setShowDropdown(false);
    } else if (type === 'all') {
      onChange('all', {});
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    onChange('all', {});
    setShowDropdown(false);
  };

  const buttonLabel = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return 'Today';
      case 'last_week':
        return 'Last Week';
      case 'last_month':
        return 'Last Month';
      case 'custom':
        return dateRange.from && dateRange.to
          ? `${dateRange.from} → ${dateRange.to}`
          : 'Custom Range';
      default:
        return buttonLabelPrefix;
    }
  }, [dateFilter, dateRange, buttonLabelPrefix]);

  const badgeText = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return `Current Date: ${dateRange.from}`;
      case 'last_week':
        return `Last Week: ${dateRange.from} to ${dateRange.to}`;
      case 'last_month':
        return `Last Month: ${dateRange.from} to ${dateRange.to}`;
      case 'custom':
        return `Custom Range: ${dateRange.from || 'Start'} to ${dateRange.to || 'End'}`;
      default:
        return '';
    }
  }, [dateFilter, dateRange]);

  return (
    <>
      <div className={cn('relative inline-block', className)} ref={dropdownRef}>
        {/* Filter Button */}
        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition shadow-xs cursor-pointer',
            dateFilter !== 'all'
              ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
              : 'border-border/60 bg-card text-foreground hover:bg-muted/60'
          )}
          title="Filter by Date"
        >
          <Filter className={cn('h-3.5 w-3.5', dateFilter !== 'all' && 'fill-primary text-primary')} />
          <span>{buttonLabel}</span>
          {dateFilter !== 'all' && (
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>

        {/* Dropdown Options */}
        {showDropdown && (
          <div
            className={cn(
              'absolute mt-2 z-50 w-72 rounded-2xl border border-border/80 bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95',
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Filter by Date
              </span>
              {dateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-medium text-rose-500 hover:text-rose-600 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 space-y-1">
              {[
                { id: 'all', label: 'All Dates', sub: 'No date restriction' },
                { id: 'today', label: 'Current Date', sub: 'Today' },
                { id: 'last_week', label: 'Last Week', sub: 'Past 7 days' },
                { id: 'last_month', label: 'Last Month', sub: 'Past 30 days' },
                { id: 'custom', label: 'Custom Range…', sub: 'Select date interval via popup' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id as DateFilterType)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition cursor-pointer',
                    dateFilter === opt.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <div>
                    <p>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                  </div>
                  {dateFilter === opt.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Custom Date Range Modal Popup */}
      {showModal && (
        <CustomDateModal
          initialFrom={modalFrom}
          initialTo={modalTo}
          onApply={(from, to) => {
            onChange('custom', { from: from || undefined, to: to || undefined });
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

/** Standalone active date badge component */
export function DateFilterActiveBadge({
  dateFilter,
  dateRange,
  onClear,
  onEditCustom,
}: {
  dateFilter: DateFilterType;
  dateRange: DateRange;
  onClear: () => void;
  onEditCustom?: () => void;
}) {
  if (dateFilter === 'all') return null;

  const text =
    dateFilter === 'today'
      ? `Current Date: ${dateRange.from}`
      : dateFilter === 'last_week'
      ? `Last Week: ${dateRange.from} to ${dateRange.to}`
      : dateFilter === 'last_month'
      ? `Last Month: ${dateRange.from} to ${dateRange.to}`
      : `Custom Range: ${dateRange.from || 'Start'} to ${dateRange.to || 'End'}`;

  return (
    <div className="mt-2.5 flex items-center gap-2 animate-in fade-in">
      <span className="text-xs text-muted-foreground">Active Filter:</span>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Calendar className="h-3 w-3" />
        <button
          type="button"
          onClick={dateFilter === 'custom' ? onEditCustom : undefined}
          className={cn(dateFilter === 'custom' && 'hover:underline cursor-pointer')}
          title={dateFilter === 'custom' ? 'Click to edit date range' : undefined}
        >
          {text}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded-full p-0.5 hover:bg-primary/20 text-primary transition cursor-pointer"
          title="Clear date filter"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Custom Date Range Modal Dialog ─────────────────────────────────────────────
interface CustomDateModalProps {
  initialFrom?: string;
  initialTo?: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}

export function CustomDateModal({
  initialFrom,
  initialTo,
  onApply,
  onClose,
}: CustomDateModalProps) {
  const today = kuwaitDateString();
  const [from, setFrom]   = useState(initialFrom || today);
  const [to, setTo]       = useState(initialTo || today);
  const [error, setError] = useState<string | null>(null);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (from && to && from > to) {
      setError('Start date cannot be after end date.');
      return;
    }
    setError(null);
    onApply(from, to);
  };

  const applyPreset = (days: number) => {
    setError(null);
    setTo(today);
    setFrom(kuwaitDatePlusDays(-days));
  };

  const applyThisMonth = () => {
    setError(null);
    const [y, m] = today.split('-');
    setFrom(`${y}-${m}-01`);
    setTo(today);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Select Date Range</h3>
              <p className="text-xs text-muted-foreground">Filter records between specific dates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Shortcuts */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick Shortcuts
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Past 7 Days', action: () => applyPreset(7) },
              { label: 'This Month', action: applyThisMonth },
              { label: 'Past 30 Days', action: () => applyPreset(30) },
              { label: 'Past 90 Days', action: () => applyPreset(90) },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.action}
                className="rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs Form */}
        <form onSubmit={handleApply} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                From Date
              </label>
              <input
                type="date"
                required
                value={from}
                onChange={(e) => { setFrom(e.target.value); setError(null); }}
                className="h-10 w-full rounded-xl border border-border/80 bg-muted/30 px-3 text-xs font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                To Date
              </label>
              <input
                type="date"
                required
                value={to}
                onChange={(e) => { setTo(e.target.value); setError(null); }}
                className="h-10 w-full rounded-xl border border-border/80 bg-muted/30 px-3 text-xs font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Active Range Preview */}
          {from && to && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
              <span className="text-muted-foreground block text-[11px]">Selected Interval:</span>
              <span className="font-semibold text-foreground font-mono mt-0.5 block">
                {from} <span className="text-primary font-sans font-bold">→</span> {to}
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-border/70 px-4 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Range
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
