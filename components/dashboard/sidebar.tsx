'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Users,
  Store,
  Sparkles,
  Settings,
  X,
  UserCheck,
  Package,
  BookOpen,
  List,
  PieChart,
  ChevronDown,
  LayoutGrid,
  HomeIcon,
  Clock,
  CalendarOff,
  Landmark,
  CreditCard,
  Building2,
  Gift,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSidebarOpen } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string; icon: React.ElementType; disabled?: boolean }[];
}

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.sidebarOpen);

  // Track which collapsible groups are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    bookings:     pathname.startsWith('/bookings'),
    appointments: pathname.startsWith('/appointments'),
    employees:    pathname.startsWith('/employees'),
    finance:      pathname.startsWith('/finance'),
    ushspa:       pathname.startsWith('/branches') || pathname.startsWith('/customers') || pathname.startsWith('/products') || pathname.startsWith('/services'),
  });

  const items: NavItem[] = [
    { href: '/',        label: t('navOverview'), icon: LayoutDashboard },
    {
      href: '/appointments',
      label: t('navAppointments'),
      icon: CalendarDays,
      children: [
        { href: '/appointments/therapist-schedule', label: 'Therapist Schedule',   icon: Clock },
        { href: '/appointments/branch',             label: 'Branch Appointments',  icon: LayoutGrid },
        { href: '/appointments/home-service',       label: 'Home Service',         icon: HomeIcon, disabled: true },
        { href: '/appointments/gift-vouchers',      label: 'Gift Vouchers',        icon: Gift },
      ],
    },
    { href: '/reports',   label: t('navReports'),   icon: BarChart3 },
    {
      href: '/ushspa',
      label: 'UshSpa',
      icon: Building2,
      children: [
        { href: '/branches',  label: t('navBranches'),  icon: Store },
        { href: '/customers', label: t('navCustomers'), icon: Users },
        { href: '/products',  label: t('navProducts'),  icon: Package },
        { href: '/services',  label: t('navServices'),  icon: Sparkles },
      ],
    },
    {
      href: '/employees',
      label: t('navEmployees'),
      icon: UserCheck,
      children: [
        { href: '/employees',               label: t('navEmployees'),   icon: UserCheck },
        { href: '/employees/leaves',        label: 'Leave Management',  icon: CalendarOff },
        { href: '/employees/working-hours', label: 'Working Hours',     icon: Clock },
      ],
    },

    {
      href: '/bookings',
      label: 'Bookings',
      icon: BookOpen,
      children: [
        { href: '/bookings',         label: 'Booking List',    icon: List },
        { href: '/bookings/reports', label: 'Booking Reports', icon: PieChart },
      ],
    },
    {
      href: '/finance',
      label: 'Finance',
      icon: Landmark,
      children: [
        { href: '/finance/payments', label: 'Payments',         icon: CreditCard },
        { href: '/finance/reports',  label: 'Reports',          icon: BarChart3 },
      ],
    },
    { href: '/settings', label: t('navSettings'), icon: Settings },
  ];

  /** Close the drawer only when the user is on a small screen (mobile/tablet) */
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      dispatch(setSidebarOpen(false));
    }
  };

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
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
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-primary/20">
              <Image
                src="/ush-spa-logo.png"
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
            const Icon = item.icon;

            // ── Collapsible group (has children) ──────────────────────────────
            if (item.children) {
              const groupKey = item.href.replace('/', '') || 'root';
              const isOpen   = expanded[groupKey];
              const anyChildActive = item.children.some((c) =>
                c.href === item.href ? pathname === c.href : pathname.startsWith(c.href),
              );

              return (
                <div key={item.href}>
                  {/* Group header button */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200',
                      anyChildActive
                        ? 'bg-rose-900/10 text-rose-900 shadow-sm dark:bg-rose-400/20 dark:text-rose-200'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {anyChildActive && (
                      <span className="absolute ltr:left-0 rtl:right-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full bg-rose-800 dark:bg-rose-300" />
                    )}
                    <Icon className={cn(
                      'h-5 w-5 transition-transform group-hover:scale-110',
                      anyChildActive ? 'text-rose-800 dark:text-rose-300' : 'text-muted-foreground',
                    )} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={cn(
                      'h-4 w-4 shrink-0 transition-transform duration-200',
                      isOpen ? 'rotate-180' : '',
                    )} />
                  </button>

                  {/* Children */}
                  {isOpen && (
                    <div className="mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname === child.href;

                        // Disabled / coming-soon item — non-navigable
                        if (child.disabled) {
                          return (
                            <span
                              key={child.href}
                              className="group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium cursor-not-allowed opacity-45 select-none"
                              title="Coming soon"
                            >
                              <ChildIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1">{child.label}</span>
                              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Soon</span>
                            </span>
                          );
                        }

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={handleNavClick}
                            className={cn(
                              'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
                              childActive
                                ? 'bg-rose-900/10 text-rose-900 dark:bg-rose-400/20 dark:text-rose-200'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            )}
                          >
                            <ChildIcon className={cn(
                              'h-4 w-4 shrink-0',
                              childActive ? 'text-rose-800 dark:text-rose-300' : 'text-muted-foreground',
                            )} />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // ── Regular flat link ──────────────────────────────────────────────
            const active = pathname === item.href;
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
