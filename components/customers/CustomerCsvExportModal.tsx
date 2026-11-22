'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Download, GripVertical, ArrowUp, ArrowDown, Check, RotateCcw,
  Loader2, AlertCircle, FileSpreadsheet, Users, CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExportableCustomer {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  account_status: string;
  is_mobile_verified: boolean;
  is_whatsapp_verified: boolean;
  is_email_verified: boolean;
  is_loyalty_enrolled: boolean;
  notification_channel: string | null;
  created_at: string | null;
}

export type CustomerFieldKey =
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'gender'
  | 'dob'
  | 'account_status'
  | 'is_mobile_verified'
  | 'is_whatsapp_verified'
  | 'is_email_verified'
  | 'is_loyalty_enrolled'
  | 'notification_channel'
  | 'created_at'
  | 'id';

interface FieldDef {
  key: CustomerFieldKey;
  label: string;
  defaultSelected: boolean;
  getValue: (c: ExportableCustomer) => string;
}

const KUWAIT_TZ = 'Asia/Kuwait';

function fmtDate(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-CA', { timeZone: KUWAIT_TZ });
}

function fmtDateTime(raw: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-GB', {
    timeZone: KUWAIT_TZ,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DEFAULT_FIELDS: FieldDef[] = [
  { key: 'name',                 label: 'Full Name',            defaultSelected: true,  getValue: (c) => c.name || '' },
  { key: 'first_name',           label: 'First Name',           defaultSelected: false, getValue: (c) => c.first_name || '' },
  { key: 'last_name',            label: 'Last Name',            defaultSelected: false, getValue: (c) => c.last_name || '' },
  { key: 'phone',                label: 'Phone Number',         defaultSelected: true,  getValue: (c) => c.phone || '' },
  { key: 'email',                label: 'Email',                defaultSelected: true,  getValue: (c) => c.email || '' },
  { key: 'gender',               label: 'Gender',               defaultSelected: true,  getValue: (c) => c.gender || '' },
  { key: 'dob',                  label: 'Date of Birth',        defaultSelected: true,  getValue: (c) => fmtDate(c.dob) },
  { key: 'account_status',       label: 'Account Status',       defaultSelected: true,  getValue: (c) => c.account_status || '' },
  { key: 'is_mobile_verified',   label: 'Mobile Verified',      defaultSelected: true,  getValue: (c) => (c.is_mobile_verified ? 'Yes' : 'No') },
  { key: 'is_whatsapp_verified', label: 'WhatsApp Verified',    defaultSelected: true,  getValue: (c) => (c.is_whatsapp_verified ? 'Yes' : 'No') },
  { key: 'is_email_verified',    label: 'Email Verified',       defaultSelected: true,  getValue: (c) => (c.is_email_verified ? 'Yes' : 'No') },
  { key: 'is_loyalty_enrolled',  label: 'Loyalty Enrolled',     defaultSelected: true,  getValue: (c) => (c.is_loyalty_enrolled ? 'Yes' : 'No') },
  { key: 'notification_channel', label: 'Notification Channel', defaultSelected: false, getValue: (c) => c.notification_channel || '' },
  { key: 'created_at',           label: 'Joined Date',          defaultSelected: true,  getValue: (c) => fmtDateTime(c.created_at) },
  { key: 'id',                   label: 'Customer ID',          defaultSelected: false, getValue: (c) => c.id || '' },
];

const FIELD_MAP: Record<CustomerFieldKey, FieldDef> = Object.fromEntries(
  DEFAULT_FIELDS.map((f) => [f.key, f]),
) as Record<CustomerFieldKey, FieldDef>;

interface FieldState {
  key: CustomerFieldKey;
  selected: boolean;
}

const initialFieldState = (): FieldState[] =>
  DEFAULT_FIELDS.map((f) => ({ key: f.key, selected: f.defaultSelected }));

interface Props {
  /** Number of individually selected customers on loaded pages */
  selectedCount: number;
  /** Whether "Select All Customers" across all pages is active */
  allCustomersSelected: boolean;
  /** Total matching customers count across all pages */
  totalCount: number;
  /** Returns the currently selected customer objects (when exporting specific selections) */
  getSelectedCustomers: () => ExportableCustomer[];
  /** Fetches ALL matching customers across all pages, reporting progress */
  fetchAllCustomers: (onProgress: (loaded: number, total: number) => void) => Promise<ExportableCustomer[]>;
  onClose: () => void;
  onExported?: (count: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CustomerCsvExportModal({
  selectedCount,
  allCustomersSelected,
  totalCount,
  getSelectedCustomers,
  fetchAllCustomers,
  onClose,
  onExported,
}: Props) {
  const hasSpecificSelection = !allCustomersSelected && selectedCount > 0;
  const [scope, setScope] = useState<'selected' | 'all'>(hasSpecificSelection ? 'selected' : 'all');
  const [fields, setFields] = useState<FieldState[]>(initialFieldState);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, exporting]);

  const selectedFields = useMemo(
    () => fields.filter((f) => f.selected).map((f) => FIELD_MAP[f.key]),
    [fields],
  );

  const toggleField = (key: CustomerFieldKey) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, selected: !f.selected } : f)));
  };

  const selectAllFields = () => {
    setFields((prev) => prev.map((f) => ({ ...f, selected: true })));
  };

  const deselectAllFields = () => {
    setFields((prev) => prev.map((f) => ({ ...f, selected: false })));
  };

  const resetDefaults = () => {
    setFields(initialFieldState());
  };

  const moveField = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDownload = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to include in the CSV.');
      return;
    }
    setError(null);
    setExporting(true);
    setProgress(null);

    try {
      let rows: ExportableCustomer[];
      if (scope === 'selected' && hasSpecificSelection) {
        rows = getSelectedCustomers();
      } else {
        rows = await fetchAllCustomers((loaded, total) => setProgress({ loaded, total }));
      }

      if (rows.length === 0) {
        setError('No customers found to export.');
        setExporting(false);
        return;
      }

      const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const headerLine = selectedFields.map((f) => esc(f.label)).join(',');
      const dataLines = rows.map((c) => selectedFields.map((f) => esc(f.getValue(c))).join(','));
      // UTF-8 BOM ensures Excel opens Arabic & international names cleanly
      const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: KUWAIT_TZ });
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      onExported?.(rows.length);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export customers CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={() => !exporting && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Export Customers to CSV</h3>
              <p className="text-[11px] text-muted-foreground">
                Choose which customers to export, select fields, and drag or use arrows to set column order
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Scope selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Customers to Export
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={exporting}
                onClick={() => setScope('all')}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition cursor-pointer',
                  scope === 'all'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/70 bg-background text-foreground hover:bg-muted/40',
                )}
              >
                <div className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                  scope === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  <Users className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs">All Customers</p>
                  <p className="text-[11px] opacity-80">
                    All {totalCount.toLocaleString()} matching customers
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={exporting || !hasSpecificSelection}
                onClick={() => hasSpecificSelection && setScope('selected')}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                  !hasSpecificSelection
                    ? 'border-border/40 bg-muted/20 text-muted-foreground opacity-50 cursor-not-allowed'
                    : scope === 'selected'
                    ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                    : 'border-border/70 bg-background text-foreground hover:bg-muted/40 cursor-pointer',
                )}
              >
                <div className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                  scope === 'selected' && hasSpecificSelection
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  <CheckSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs">Selected Customers</p>
                  <p className="text-[11px] opacity-80">
                    {hasSpecificSelection
                      ? `${selectedCount.toLocaleString()} selected customer${selectedCount !== 1 ? 's' : ''}`
                      : 'Select individual rows first'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Field Selection & Ordering */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                CSV Columns &amp; Order ({selectedFields.length} of {fields.length} selected)
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={selectAllFields}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={deselectAllFields}
                  className="font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Deselect All
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={resetDefaults}
                  className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Default
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 divide-y divide-border/50 overflow-hidden bg-background">
              {fields.map((item, idx) => {
                const def = FIELD_MAP[item.key];
                const orderNum = item.selected
                  ? fields.slice(0, idx + 1).filter((f) => f.selected).length
                  : null;
                return (
                  <div
                    key={item.key}
                    draggable={!exporting}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDragLeave={() => {
                      if (dragOverIdx === idx) setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(idx);
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 transition select-none',
                      dragIdx === idx && 'opacity-40 bg-muted/60',
                      dragOverIdx === idx && dragIdx !== idx && 'border-t-2 border-t-primary bg-primary/5',
                      item.selected ? 'bg-card' : 'bg-muted/15 text-muted-foreground',
                    )}
                  >
                    <span
                      className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>

                    <label className="flex flex-1 items-center gap-2.5 cursor-pointer min-w-0">
                      <span
                        className={cn(
                          'grid h-4 w-4 shrink-0 place-items-center rounded border transition',
                          item.selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background',
                        )}
                      >
                        {item.selected && <Check className="h-3 w-3" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={item.selected}
                        disabled={exporting}
                        onChange={() => toggleField(item.key)}
                      />
                      <span className={cn('truncate', item.selected ? 'font-semibold text-foreground' : 'font-medium')}>
                        {def.label}
                      </span>
                    </label>

                    {orderNum !== null && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-primary">
                        Col #{orderNum}
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={exporting || idx === 0}
                        onClick={() => moveField(idx, -1)}
                        title="Move up"
                        className="grid h-6 w-6 place-items-center rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={exporting || idx === fields.length - 1}
                        onClick={() => moveField(idx, 1)}
                        title="Move down"
                        className="grid h-6 w-6 place-items-center rounded-md border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Column Order Preview */}
          {selectedFields.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                CSV Header Order Preview
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedFields.map((f, i) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground"
                  >
                    <span className="text-[10px] font-mono text-primary">{i + 1}.</span>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {exporting && progress && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Fetching customers…
                </span>
                <span className="font-mono">
                  {progress.loaded.toLocaleString()}
                  {progress.total > 0 ? ` / ${progress.total.toLocaleString()}` : ''}
                </span>
              </div>
              {progress.total > 0 && (
                <div className="h-1.5 w-full rounded-full bg-primary/15 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.round((progress.loaded / progress.total) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3.5">
          <span className="text-[11px] text-muted-foreground">
            {selectedFields.length} column{selectedFields.length !== 1 ? 's' : ''} ·{' '}
            {scope === 'selected' && hasSpecificSelection
              ? `${selectedCount.toLocaleString()} selected`
              : `${totalCount.toLocaleString()} total`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={onClose}
              className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={exporting || selectedFields.length === 0}
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-40 cursor-pointer"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{exporting ? 'Exporting…' : 'Download CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
