'use client';

import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { DataLoader } from '@/components/data-loader';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const open   = useAppSelector((s) => s.ui.sidebarOpen);
  const locale = useAppSelector((s) => s.ui.locale);

  return (
    <div className="relative min-h-screen">
      <div className="aurora" />
      <Sidebar />
      <div
        className={cn(
          'relative z-10 transition-all duration-300',
          open ? 'ltr:pl-72 rtl:pr-72' : 'pl-0',
        )}
      >
        <Topbar />
        {/* key={locale} ensures the active page cleanly remounts and re-fetches with the new Accept-Language header */}
        <main key={locale} className="px-4 py-6 sm:px-6 lg:px-8">
          <DataLoader>{children}</DataLoader>
        </main>
      </div>
    </div>
  );
}
