'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BookMarked,
  ScrollText,
  Boxes,
  TrendingUp,
  CalendarRange,
  Briefcase,
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
  Truck,
  ShoppingBag,
  Receipt,
  FileText,
  Layers,
  PiggyBank,
  Percent,
  Handshake,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSidebarOpen } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Required permission to show this top-level item. Admins bypass this. */
  permission?: string;
  children?: {
    href: string;
    label: string;
    icon: React.ElementType;
    disabled?: boolean;
    /** Required permission to show this child item. Admins bypass this. */
    permission?: string;
  }[];
}

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const { can, isAdmin } = usePermissions();

  // Track which collapsible groups are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    bookings:     pathname.startsWith('/bookings'),
    appointments: pathname.startsWith('/appointments'),
    finance:      pathname.startsWith('/finance'),
    ushspa:       pathname.startsWith('/branches') || pathname.startsWith('/customers') || pathname.startsWith('/products') || pathname.startsWith('/services') || pathname.startsWith('/employees'),
    vendors:      pathname.startsWith('/vendors'),
  });

  const items: NavItem[] = [
    { href: '/',        label: t('navOverview'), icon: LayoutDashboard, permission: PERMISSIONS.OVERVIEW },
    {
      href: '/appointments',
      label: t('navAppointments'),
      icon: CalendarDays,
      permission: PERMISSIONS.APPOINTMENTS,
      children: [
        { href: '/appointments/therapist-schedule', label: 'Therapist Schedule',  icon: Clock,      permission: PERMISSIONS.APPOINTMENTS_THERAPIST_SCHEDULE },
        { href: '/appointments/branch',             label: 'Branch Appointments', icon: LayoutGrid, permission: PERMISSIONS.APPOINTMENTS_BRANCH_APPOINTMENTS },
        { href: '/appointments/home-service',       label: 'Home Service',        icon: HomeIcon,   permission: PERMISSIONS.APPOINTMENTS_HOME_SERVICE, disabled: true },
        { href: '/appointments/gift-vouchers',      label: 'Gift Vouchers',       icon: Gift,       permission: PERMISSIONS.APPOINTMENTS_GIFT_VOUCHER },
      ],
    },
    { href: '/reports', label: t('navReports'), icon: BarChart3 },
    {
      href: '/ushspa',
      label: 'UshSpa',
      icon: Building2,
      permission: PERMISSIONS.USHSPA,
      children: [
        { href: '/branches',                label: t('navBranches'),   icon: Store,       permission: PERMISSIONS.USHSPA_BRANCHES },
        { href: '/customers',               label: t('navCustomers'),  icon: Users,       permission: PERMISSIONS.USHSPA_CUSTOMERS },
        { href: '/employees',               label: t('navEmployees'),  icon: UserCheck,   permission: PERMISSIONS.USHSPA_EMPLOYEES },
        { href: '/employees/leaves',        label: 'Leave Management', icon: CalendarOff, permission: PERMISSIONS.USHSPA_LEAVE_MANAGEMENT },
        { href: '/employees/working-hours', label: 'Working Hours',    icon: Clock,       permission: PERMISSIONS.USHSPA_WORKING_HOURS },
        { href: '/products',                label: t('navProducts'),   icon: Package,     permission: PERMISSIONS.USHSPA_PRODUCTS },
        { href: '/services',                label: t('navServices'),   icon: Sparkles,    permission: PERMISSIONS.USHSPA_SERVICES },
      ],
    },
    {
      href: '/bookings',
      label: 'Bookings',
      icon: BookOpen,
      permission: PERMISSIONS.BOOKINGS,
      children: [
        { href: '/bookings',          label: 'Booking List',    icon: List,       permission: PERMISSIONS.BOOKINGS_BOOKING_LIST },
        { href: '/bookings/payments', label: 'Payments',        icon: CreditCard, permission: PERMISSIONS.BOOKINGS_PAYMENTS },
        { href: '/bookings/refunds',  label: 'Refunds',         icon: RotateCcw,  permission: PERMISSIONS.BOOKINGS_REFUNDS },
        { href: '/bookings/reports',  label: 'Booking Reports', icon: PieChart,   permission: PERMISSIONS.BOOKINGS_BOOKING_REPORT },
      ],
    },
    {
      href: '/finance',
      label: 'Finance',
      icon: Landmark,
      permission: PERMISSIONS.FINANCE,
      children: [
        { href: '/finance',                 label: 'Overview',           icon: LayoutDashboard, permission: PERMISSIONS.FINANCE_OVERVIEW },
        { href: '/finance/invoices',        label: 'Invoices & Bills',   icon: Receipt,         permission: PERMISSIONS.FINANCE_INVOICES_AND_BILLS },
        { href: '/finance/journal-entries', label: 'Journal Entries',    icon: FileText,        permission: PERMISSIONS.FINANCE_JOURNAL_ENTRIES },
        { href: '/finance/journals',        label: 'Journals',           icon: BookMarked,      permission: PERMISSIONS.FINANCE_JOURNALS },
        { href: '/finance/accounts',        label: 'Chart of Accounts',  icon: Layers,          permission: PERMISSIONS.FINANCE_CHART_OF_ACCOUNTS },
        { href: '/finance/general-ledger',  label: 'General Ledger',     icon: ScrollText,      permission: PERMISSIONS.FINANCE_GENERAL_LEDGER },
        { href: '/finance/banking',         label: 'Banking & Cash',     icon: Building2,       permission: PERMISSIONS.FINANCE_BANKING_AND_CASH },
        { href: '/finance/assets',          label: 'Fixed Assets',       icon: Boxes,           permission: PERMISSIONS.FINANCE_FIXED_ASSETS },
        { href: '/finance/budgets',         label: 'Budgets & Planning', icon: PiggyBank,       permission: PERMISSIONS.FINANCE_BUDGETS_AND_PLANNING },
        { href: '/finance/reports',         label: 'Financial Reports',  icon: BarChart3,       permission: PERMISSIONS.FINANCE_FINANCIAL_REPORTS },
        { href: '/finance/profit-analysis', label: 'Profit Analysis',    icon: TrendingUp,      permission: PERMISSIONS.FINANCE_PROFIT_ANALYSIS },
        { href: '/finance/partners',        label: 'Partners',           icon: Handshake,       permission: PERMISSIONS.FINANCE_PARTNERS },
        { href: '/finance/taxes',           label: 'Taxes & Fiscal',     icon: Percent,         permission: PERMISSIONS.FINANCE_TAXES_AND_FISCAL },
        { href: '/finance/fiscal-periods',  label: 'Fiscal Periods',     icon: CalendarRange,   permission: PERMISSIONS.FINANCE_FISCAL_PERIODS },
        { href: '/finance/companies',       label: 'Companies',          icon: Briefcase,       permission: PERMISSIONS.FINANCE_COMPANIES },
      ],
    },
    {
      href: '/vendors',
      label: t('navVendors'),
      icon: Truck,
      permission: PERMISSIONS.VENDORS,
      children: [
        { href: '/vendors/orders',      label: t('navOrders'), icon: ShoppingBag, permission: PERMISSIONS.VENDORS_ORDERS },
        { href: '/vendors/gift-orders', label: 'Gift Vouchers', icon: Gift,        permission: PERMISSIONS.VENDORS_GIFT_ORDERS },
      ],
    },
    { href: '/settings', label: t('navSettings'), icon: Settings, permission: PERMISSIONS.SETTINGS },
  ];

  /**
   * Filter the nav items based on the current user's permissions.
   * Admins see everything. Employees only see items they have permission for.
   */
  const visibleItems = items.map((item) => {
    // Filter children first
    const filteredChildren = item.children?.filter((child) => {
      if (!child.permission) return true; // no permission required — always show
      return can(child.permission);
    });

    return { ...item, children: filteredChildren };
  }).filter((item) => {
    if (!item.permission) return true; // no permission required — always show
    return can(item.permission);
  });

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
          {visibleItems.map((item) => {
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
