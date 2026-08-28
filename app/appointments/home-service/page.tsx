'use client';

import { HomeIcon } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';

export default function HomeServiceBookingsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 shadow-lg">
          <HomeIcon className="h-10 w-10 text-sky-600" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Home Service Bookings</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Home service appointment tracking is coming soon. You will be able to manage at-home
          appointments, assign mobile therapists and track routes.
        </p>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/5 px-5 py-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
          <span className="text-sm font-semibold text-sky-600">Coming Soon</span>
        </div>
      </div>
    </DashboardShell>
  );
}
