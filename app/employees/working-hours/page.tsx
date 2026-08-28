'use client';

import { Clock } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';

export default function WorkingHoursPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 shadow-lg">
          <Clock className="h-10 w-10 text-violet-600 dark:text-violet-400" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Working Hours & Shifts</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Employee working hours, shift schedules, and duty time tracking are coming soon.
          You will be able to configure weekly working hours and branch shift rotations.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/5 px-5 py-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">Coming Soon</span>
        </div>
      </div>
    </DashboardShell>
  );
}
