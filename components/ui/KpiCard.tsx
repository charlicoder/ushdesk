'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  trend: number;
  trendLabel?: string;
  icon: React.ReactNode;
  accent?: 'primary' | 'default' | 'success' | 'warning' | 'danger';
  highlight?: boolean;
}

export default function KpiCard({
  label,
  value,
  trend,
  trendLabel = 'vs last period',
  icon,
  accent = 'default',
}: KpiCardProps) {
  const positive = trend >= 0;
  const accentStyles = {
    primary: 'bg-card border-border/60',
    default: 'bg-card border-border/60',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md',
        accentStyles[accent],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            'flex items-center gap-0.5 font-bold',
            positive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400',
          )}
        >
          {positive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="text-[10px] text-muted-foreground">{trendLabel}</span>
      </div>
    </div>
  );
}
