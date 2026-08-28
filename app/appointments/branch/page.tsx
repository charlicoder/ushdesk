'use client';

import { Store } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';

export default function BranchAppointmentsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg">
          <Store className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Branch Appointments</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Branch-level appointment management is coming soon. You will be able to view, filter and
          manage appointments grouped by branch location.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-semibold text-primary">Coming Soon</span>
        </div>
      </div>
    </DashboardShell>
  );
}
