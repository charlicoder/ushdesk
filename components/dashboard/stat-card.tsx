'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  gradient?: string;
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, trend, gradient = 'from-primary/20 to-accent/10', delay = 0 }: StatCardProps) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn('absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-100', gradient)} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
        </div>
        <div className={cn('grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md', gradient)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="relative mt-3 flex items-center gap-1.5 text-xs">
          <span className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold', positive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}
