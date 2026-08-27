'use client';

import { STATUS_COLORS } from '@/lib/helpers';
import type { AppointmentStatus } from '@/lib/supabase';
import { useI18n } from '@/hooks/use-i18n';
import { cn } from '@/lib/utils';

const STATUS_KEY: Record<AppointmentStatus, 'statusPending' | 'statusConfirmed' | 'statusCompleted' | 'statusCancelled' | 'statusNoShow'> = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
  no_show: 'statusNoShow',
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const { t } = useI18n();
  const c = STATUS_COLORS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', c.bg, c.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {t(STATUS_KEY[status])}
    </span>
  );
}
