'use client';

import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionCard({ title, subtitle, className, children, action }: SectionCardProps) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-fade-in-up', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
