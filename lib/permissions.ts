/**
 * RBAC Permission constants and helper utilities for USH Desk.
 *
 * Permission format: deskmenu.<section>[.<subsection>]
 *
 * Admins bypass all permission checks.
 * Employees must have explicit permissions assigned.
 */

// ─── Permission Keys ──────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // ── Top-level menus ──────────────────────────────────────────────────────────
  APPOINTMENTS: 'deskmenu.appointments',
  BOOKINGS:     'deskmenu.bookings',
  USHSPA:       'deskmenu.ushspa',
  FINANCE:      'deskmenu.finance',
  VENDORS:      'deskmenu.vendors',
  SETTINGS:     'deskmenu.settings',
  OVERVIEW:     'deskmenu.overview',

  // ── Appointments submenus ────────────────────────────────────────────────────
  APPOINTMENTS_THERAPIST_SCHEDULE:  'deskmenu.appointments.therapist_schedule',
  APPOINTMENTS_BRANCH_APPOINTMENTS: 'deskmenu.appointments.branch_appointments',
  APPOINTMENTS_HOME_SERVICE:        'deskmenu.appointments.home_service',
  APPOINTMENTS_GIFT_VOUCHER:        'deskmenu.appointments.gift_voucher',

  // ── Bookings submenus ────────────────────────────────────────────────────────
  BOOKINGS_BOOKING_LIST:   'deskmenu.bookings.booking_list',
  BOOKINGS_PAYMENTS:       'deskmenu.bookings.payments',
  BOOKINGS_REFUNDS:        'deskmenu.bookings.refunds',
  BOOKINGS_BOOKING_REPORT: 'deskmenu.bookings.booking_report',

  // ── UshSpa submenus ──────────────────────────────────────────────────────────
  USHSPA_BRANCHES:          'deskmenu.ushspa.branches',
  USHSPA_CUSTOMERS:         'deskmenu.ushspa.customers',
  USHSPA_EMPLOYEES:         'deskmenu.ushspa.employees',
  USHSPA_LEAVE_MANAGEMENT:  'deskmenu.ushspa.leave_management',
  USHSPA_WORKING_HOURS:     'deskmenu.ushspa.working_hours',
  USHSPA_PRODUCTS:          'deskmenu.ushspa.products',
  USHSPA_SERVICES:          'deskmenu.ushspa.services',

  // ── Finance submenus ─────────────────────────────────────────────────────────
  FINANCE_OVERVIEW:           'deskmenu.finance.overview',
  FINANCE_INVOICES_AND_BILLS: 'deskmenu.finance.invoices_and_bills',
  FINANCE_JOURNAL_ENTRIES:    'deskmenu.finance.journal_entries',
  FINANCE_CHART_OF_ACCOUNTS:  'deskmenu.finance.chart_of_accounts',
  FINANCE_BANKING_AND_CASH:   'deskmenu.finance.banking_and_cash',
  FINANCE_BUDGETS_AND_PLANNING: 'deskmenu.finance.budgets_and_planning',
  FINANCE_FINANCIAL_REPORTS:  'deskmenu.finance.financial_reports',
  FINANCE_PARTNERS:           'deskmenu.finance.partners',
  FINANCE_TAXES_AND_FISCAL:   'deskmenu.finance.taxes_and_fiscal',
  FINANCE_FIXED_ASSETS:       'deskmenu.finance.fixed_assets',
  FINANCE_JOURNALS:           'deskmenu.finance.journals',
  FINANCE_GENERAL_LEDGER:     'deskmenu.finance.general_ledger',
  FINANCE_FISCAL_PERIODS:     'deskmenu.finance.fiscal_periods',
  FINANCE_COMPANIES:          'deskmenu.finance.companies',
  FINANCE_PROFIT_ANALYSIS:    'deskmenu.finance.profit_analysis',

  // ── Vendors submenus ─────────────────────────────────────────────────────────
  VENDORS_ORDERS:      'deskmenu.vendors.orders',
  VENDORS_GIFT_ORDERS: 'deskmenu.vendors.gift_orders',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── User type constants ──────────────────────────────────────────────────────

/** User types that are allowed to log in to the desk portal */
export const ALLOWED_USER_TYPES = ['employee', 'staff', 'manager', 'admin', 'administrator', 'superuser', 'branch_manager'] as const;

/** User types considered "customer" — blocked from login */
export const CUSTOMER_USER_TYPES = ['customer', 'client', 'user'] as const;

/** Admin user types — bypass all permission checks */
export const ADMIN_USER_TYPES = ['admin', 'administrator', 'superuser'] as const;

export type AllowedUserType = (typeof ALLOWED_USER_TYPES)[number];

import { loadUser } from './api';

// ─── Role & Permission Types ──────────────────────────────────────────────────

export interface RoleInfoLike {
  role_id?: string | null;
  role_name?: string | null;
  role_description?: string | null;
  role_code?: string | null;
  is_superuser?: boolean;
  is_branch_manager?: boolean;
  is_therapist_role?: boolean;
}

export interface UserLike {
  user_type?: string | null;
  role?: string | null;
  role_name?: string | null;
  role_title?: string | null;
  position?: string | null;
}

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the user_type is an admin.
 * Admins have full access to everything without needing explicit permissions.
 * Recognised admin types: 'admin', 'administrator', 'superuser'.
 */
export function isAdmin(userType: string | undefined | null): boolean {
  if (!userType) return false;
  return ADMIN_USER_TYPES.includes(userType.toLowerCase() as typeof ADMIN_USER_TYPES[number]);
}

/**
 * Returns true if the user_type is a customer (blocked from login).
 */
export function isCustomerType(userType: string | undefined | null): boolean {
  if (!userType) return false;
  return CUSTOMER_USER_TYPES.includes(userType.toLowerCase() as typeof CUSTOMER_USER_TYPES[number]);
}

/**
 * Extracts and normalizes role candidate strings from roleInfo and user data.
 */
function extractRoleCandidates(roleInfo?: RoleInfoLike | null, user?: UserLike | null): string[] {
  if (!roleInfo && !user && typeof window !== 'undefined') {
    try {
      const stored = loadUser() as (UserLike & { roleInfo?: RoleInfoLike }) | null;
      if (stored) {
        roleInfo = stored.roleInfo ?? null;
        user = stored;
      }
    } catch {
      // ignore
    }
  }

  const rawValues = [
    roleInfo?.role_name,
    roleInfo?.role_description,
    roleInfo?.role_code,
    user?.role,
    user?.role_name,
    user?.role_title,
    user?.position,
    user?.user_type,
  ];

  return rawValues
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' '));
}

/**
 * Checks whether the current user has the Administrator role.
 */
export function isAdministratorRole(roleInfo?: RoleInfoLike | null, user?: UserLike | null): boolean {
  if (roleInfo?.is_superuser === true) return true;
  if (isAdmin(user?.user_type)) return true;

  const candidates = extractRoleCandidates(roleInfo, user);
  const patterns = ['administrator', 'admin', 'superuser'];
  return candidates.some((c) =>
    patterns.some((p) => c === p || c.includes(p) || p.includes(c))
  );
}

/**
 * Checks whether the current user has the Spa Director role.
 */
export function isSpaDirectorRole(roleInfo?: RoleInfoLike | null, user?: UserLike | null): boolean {
  const candidates = extractRoleCandidates(roleInfo, user);
  const patterns = ['spa director', 'spadirector'];
  return candidates.some((c) =>
    patterns.some((p) => c === p || c.includes(p) || p.includes(c))
  );
}

/**
 * Checks whether the current user has the Finance Manager role.
 */
export function isFinanceManagerRole(roleInfo?: RoleInfoLike | null, user?: UserLike | null): boolean {
  const candidates = extractRoleCandidates(roleInfo, user);
  const patterns = ['finance manager', 'financemanager'];
  return candidates.some((c) =>
    patterns.some((p) => c === p || c.includes(p) || p.includes(c))
  );
}

/**
 * Checks whether the user is in one of the roles granted access to
 * the Refunds submenu under Bookings and all submenus under Finance:
 * - Administrator
 * - Spa Director
 * - Finance Manager
 */
export function isRefundsAndFinancePermittedRole(
  roleInfo?: RoleInfoLike | null,
  user?: UserLike | null,
): boolean {
  return (
    isAdministratorRole(roleInfo, user) ||
    isSpaDirectorRole(roleInfo, user) ||
    isFinanceManagerRole(roleInfo, user)
  );
}

/**
 * Checks whether a given permission corresponds to the Refunds submenu
 * or any Finance menu / submenu.
 */
export function isRefundsOrFinancePermission(permission: string): boolean {
  return (
    permission === PERMISSIONS.BOOKINGS_REFUNDS ||
    permission === PERMISSIONS.BOOKINGS ||
    permission === PERMISSIONS.FINANCE ||
    permission.startsWith('deskmenu.finance')
  );
}

/**
 * Check whether a user has a given permission.
 * - Admins and Administrator roles always return true.
 * - Spa Director and Finance Manager have automatic access to Refunds and Finance menus.
 * - Other employees must have the permission string in their permissions array.
 */
export function hasPermission(
  userType: string | undefined | null,
  permissions: string[],
  permission: string,
  roleInfo?: RoleInfoLike | null,
  user?: UserLike | null,
): boolean {
  if (isAdmin(userType)) return true;
  if (isAdministratorRole(roleInfo, user)) return true;
  if (isRefundsAndFinancePermittedRole(roleInfo, user) && isRefundsOrFinancePermission(permission)) {
    return true;
  }
  return permissions.includes(permission);
}

/**
 * Check whether the employee has at least one permission assigned.
 * Admins, superusers, and privileged roles always return true.
 */
export function hasAnyPermission(
  userType: string | undefined | null,
  permissions: string[],
  roleInfo?: RoleInfoLike | null,
  user?: UserLike | null,
): boolean {
  if (isAdmin(userType)) return true;
  if (isAdministratorRole(roleInfo, user)) return true;
  if (isRefundsAndFinancePermittedRole(roleInfo, user)) return true;
  return permissions.length > 0;
}

export {
  canCancelBookingAnytime,
  checkBookingCancellationEligibility,
  getBookingAppointmentDateTime,
  MIN_HOURS_BEFORE_CANCELLATION,
} from './cancellation-policy';

