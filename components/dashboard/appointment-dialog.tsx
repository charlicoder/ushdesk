'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useI18n } from '@/hooks/use-i18n';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { formatCurrency } from '@/lib/helpers';
import type { Appointment, AppointmentStatus } from '@/lib/supabase';
import { useAppDispatch } from '@/store/hooks';
import { updateAppointmentStatus } from '@/store/slices/dataSlice';
import { User, Sparkles, Store, Calendar, Clock, CreditCard, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const STATUS_KEY: Record<AppointmentStatus, 'statusPending' | 'statusConfirmed' | 'statusCompleted' | 'statusCancelled' | 'statusNoShow'> = {
  pending: 'statusPending', confirmed: 'statusConfirmed', completed: 'statusCompleted',
  cancelled: 'statusCancelled', no_show: 'statusNoShow',
};

export function AppointmentDialog({ appointment, open, onClose }: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();

  if (!appointment) return null;
  const a = appointment;
  const dt = new Date(a.start_time);
  const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleStatusChange = (status: AppointmentStatus) => {
    dispatch(updateAppointmentStatus({ id: a.id, status }));
  };

  const rows = [
    { icon: User, label: t('customer'), value: a.customer?.name ?? '—' },
    { icon: Sparkles, label: t('service'), value: a.service?.name ?? '—' },
    { icon: Store, label: t('branch'), value: a.branch?.name ?? '—' },
    { icon: User, label: t('staff'), value: a.staff?.name ?? '—' },
    { icon: Calendar, label: t('date'), value: dateStr },
    { icon: Clock, label: t('time'), value: timeStr },
    { icon: Clock, label: t('duration'), value: `${a.duration_min} ${t('min')}` },
    { icon: CreditCard, label: t('payment'), value: a.payment_method ?? '—' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{t('appointmentDetails')}</span>
            <StatusBadge status={a.status} />
          </DialogTitle>
          <DialogDescription className="sr-only">{t('appointmentDetails')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <r.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="text-sm font-semibold">{r.value}</p>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{t('price')}</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(Number(a.price), t('currency'))}</p>
            </div>
          </div>

          {a.notes && (
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                <StickyNote className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t('notes')}</p>
                <p className="text-sm">{a.notes}</p>
              </div>
            </div>
          )}

          {/* status changer */}
          <div className="pt-2">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('changeStatus')}</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                    a.status === s
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t(STATUS_KEY[s])}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
