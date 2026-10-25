'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiSelectDropProps<T> {
  items: T[];
  selectedIds: string[];
  getId: (item: T) => string;
  search: string;
  onSearch: (q: string) => void;
  onToggle: (item: T) => void;
  /** Return a reason string to disable an (unselected) item, or null when selectable. */
  getDisabledReason?: (item: T) => string | null;
  renderItem: (item: T, checked: boolean) => React.ReactNode;
  placeholder: string;
  loading?: boolean;
  icon?: React.ElementType;
}

/**
 * Searchable dropdown with a checkbox per row. The list stays open while ticking
 * several rows. Selected rows can always be un-ticked; unselected rows can be
 * disabled (with a tooltip) by `getDisabledReason`.
 */
export function MultiSelectDrop<T>({
  items, selectedIds, getId, search, onSearch, onToggle, getDisabledReason,
  renderItem, placeholder, loading, icon: Icon = Search,
}: MultiSelectDropProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = new Set(selectedIds);

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3 z-10 grid h-5 w-5 place-items-center text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <input
          value={search}
          onChange={(e) => { onSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={
            selectedIds.length > 0
              ? `${selectedIds.length} service${selectedIds.length > 1 ? 's' : ''} selected — search to add more…`
              : placeholder
          }
          className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2.5 grid h-5 w-5 place-items-center text-muted-foreground"
            aria-label="Toggle service list"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground italic">{loading ? 'Loading…' : 'No results'}</p>
          ) : (
            items.map((item, idx) => {
              const id = getId(item);
              const checked = selected.has(id);
              const reason = !checked && getDisabledReason ? getDisabledReason(item) : null;
              const disabled = Boolean(reason);
              return (
                <label
                  key={id || `item-${idx}`}
                  title={reason ?? undefined}
                  className={cn(
                    'flex items-center gap-3 pl-4 transition',
                    disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-muted/60',
                    checked && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-4 w-4 shrink-0 place-items-center rounded border transition',
                      checked ? 'border-primary bg-primary text-white' : 'border-border bg-background',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(item)}
                  />
                  <div className="min-w-0 flex-1">
                    {renderItem(item, checked)}
                    {disabled && (
                      <p className="-mt-2 mb-2 pr-4 text-[10px] font-medium text-amber-600 dark:text-amber-400">{reason}</p>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
