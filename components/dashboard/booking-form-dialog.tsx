'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/hooks/use-i18n';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createAppointment } from '@/store/slices/dataSlice';
import type { Branch, Service, Customer, Staff } from '@/lib/supabase';
import { User, Sparkles, Clock, StickyNote, CreditCard, ChevronDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  branch: Branch | null;
  date: string;          // ISO yyyy-mm-dd
  slotTime: string;      // "HH:MM AM/PM"
  slotIso: string;       // ISO datetime for slot start
  intervalMin: 30 | 60;
}

const PAYMENT_METHODS = ['cash', 'card', 'online'];

function isoToLocalInput(isoDatetime: string): string {
  // returns "YYYY-MM-DDTHH:MM" for datetime-local input
  const d = new Date(isoDatetime);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(isoStr: string, minutes: number): string {
  if (!isoStr) return '';
  const ms = new Date(isoStr).getTime();
  if (isNaN(ms)) return '';
  return new Date(ms + minutes * 60_000).toISOString();
}

function fmtTime(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function BookingFormDialog({
  open, onClose, branch, date, slotTime, slotIso, intervalMin,
}: Props) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  const customers = useAppSelector((s) => s.data.customers);
  const services  = useAppSelector((s) => s.data.services);
  const staff     = useAppSelector((s) => s.data.staff);

  const [customerId,  setCustomerId]  = useState('');
  const [serviceId,   setServiceId]   = useState('');
  const [staffId,     setStaffId]     = useState('');
  const [payment,     setPayment]     = useState('cash');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [saved,       setSaved]       = useState(false);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setCustomerId('');
      setServiceId('');
      setStaffId('');
      setPayment('cash');
      setNotes('');
      setError(null);
      setSaved(false);
    }
  }, [open]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  const slotsNeeded = useMemo(
    () => (selectedService ? Math.ceil(selectedService.duration_min / intervalMin) : 1),
    [selectedService, intervalMin],
  );

  const endIso = useMemo(
    () => selectedService ? addMinutes(slotIso, selectedService.duration_min) : addMinutes(slotIso, intervalMin),
    [selectedService, slotIso, intervalMin],
  );

  // Filter staff by branch
  const branchStaff = useMemo<Staff[]>(
    () => (branch ? staff.filter((s) => s.branch_id === branch.id) : staff),
    [staff, branch],
  );

  const canSubmit = customerId && serviceId && staffId && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !branch || !selectedService) return;
    setSaving(true);
    setError(null);
    try {
      const result = await dispatch(createAppointment({
        branch_id:     branch.id,
        customer_id:   customerId,
        service_id:    serviceId,
        staff_id:      staffId,
        start_time:    slotIso,
        duration_min:  selectedService.duration_min,
        price:         selectedService.price,
        payment_method: payment,
        notes,
        status:        'confirmed',
      }));

      if (createAppointment.rejected.match(result)) {
        setError((result.payload as string) ?? t('bookingError'));
      } else {
        setSaved(true);
        setTimeout(() => onClose(), 1500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {t('bookingForm')}
          </DialogTitle>
          <DialogDescription>
            {branch?.name} · {date} · {slotTime}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">{t('bookingSuccess')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* slot summary */}
            <div className="flex gap-2 rounded-xl bg-primary/8 p-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <span className="font-semibold">{slotTime}</span>
                {selectedService && (
                  <span className="ml-2 text-muted-foreground">
                    → {fmtTime(endIso)} · {slotsNeeded} {t('slotsNeeded')}
                  </span>
                )}
              </div>
            </div>

            {/* Customer */}
            <Field icon={<User className="h-4 w-4" />} label={t('customer')}>
              <SelectInput
                value={customerId}
                onChange={setCustomerId}
                placeholder={t('selectCustomer')}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            {/* Service */}
            <Field icon={<Sparkles className="h-4 w-4" />} label={t('service')}>
              <SelectInput
                value={serviceId}
                onChange={setServiceId}
                placeholder={t('selectService')}
                options={services.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.duration_min}min · ${s.price} AED)`,
                }))}
              />
            </Field>

            {/* Staff */}
            <Field icon={<User className="h-4 w-4" />} label={t('staff')}>
              <SelectInput
                value={staffId}
                onChange={setStaffId}
                placeholder={t('selectStaff')}
                options={branchStaff.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` }))}
              />
            </Field>

            {/* Payment */}
            <Field icon={<CreditCard className="h-4 w-4" />} label={t('payment')}>
              <SelectInput
                value={payment}
                onChange={setPayment}
                placeholder="Payment method"
                options={PAYMENT_METHODS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              />
            </Field>

            {/* Notes */}
            <Field icon={<StickyNote className="h-4 w-4" />} label={t('notes')}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes…"
                className="w-full resize-none rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-muted/60 py-2.5 text-sm font-semibold transition hover:bg-muted"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition',
                  canSubmit
                    ? 'bg-primary hover:bg-primary/90 shadow-md shadow-primary/20'
                    : 'cursor-not-allowed bg-primary/40',
                )}
              >
                {saving ? '…' : t('saveBooking')}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---- helpers ---- */
function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-border bg-card px-3 py-2.5 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
