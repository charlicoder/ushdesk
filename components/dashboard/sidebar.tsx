'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Users,
  Store,
  Sparkles,
  Settings,
  X,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSidebarOpen } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.sidebarOpen);

  const items = [
    { href: '/', label: t('navOverview'), icon: LayoutDashboard },
    { href: '/appointments', label: t('navAppointments'), icon: CalendarDays },
    { href: '/reports', label: t('navReports'), icon: BarChart3 },
    { href: '/customers', label: t('navCustomers'), icon: Users },
    { href: '/branches', label: t('navBranches'), icon: Store },
    { href: '/services', label: t('navServices'), icon: Sparkles },
    { href: '/settings', label: t('navSettings'), icon: Settings },
  ];

  /** Close the drawer only when the user is on a small screen (mobile/tablet) */
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      dispatch(setSidebarOpen(false));
    }
  };

  return (
    <>
      {/* overlay – shown on mobile when sidebar is open */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => dispatch(setSidebarOpen(false))}
      />

      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300',
          'ltr:left-0 ltr:border-r ltr:border-white/5 rtl:right-0 rtl:border-l rtl:border-white/5',
          open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
        )}
      >
        {/* brand */}
        <div className="flex items-center justify-between gap-3 px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/10 shadow-lg shadow-primary/20">
              <Image
                src="/logo.png"
                alt="USH Spa Logo"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">{t('brandName')}</p>
              <p className="text-xs text-sidebar-foreground/60">{t('brandTagline')}</p>
            </div>
          </Link>
          <button
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 hover:bg-white/10 transition"
            onClick={() => dispatch(setSidebarOpen(false))}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Menu
          </p>
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200',
                  active
                    ? 'bg-rose-900/10 text-rose-900 shadow-sm dark:bg-rose-400/20 dark:text-rose-200'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute ltr:left-0 rtl:right-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full bg-rose-800 dark:bg-rose-300" />
                )}
                <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', active ? 'text-rose-800 dark:text-rose-300' : 'text-muted-foreground')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

