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

  // ── Vendors submenus ─────────────────────────────────────────────────────────
  VENDORS_ORDERS:      'deskmenu.vendors.orders',
  VENDORS_GIFT_ORDERS: 'deskmenu.vendors.gift_orders',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── User type constants ──────────────────────────────────────────────────────

/** User types that are allowed to log in to the desk portal */
export const ALLOWED_USER_TYPES = ['employee', 'staff', 'manager', 'admin', 'branch_manager'] as const;

/** User types considered "customer" — blocked from login */
export const CUSTOMER_USER_TYPES = ['customer', 'client', 'user'] as const;

/** Admin user types — bypass all permission checks */
export const ADMIN_USER_TYPES = ['admin'] as const;

export type AllowedUserType = (typeof ALLOWED_USER_TYPES)[number];

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the user_type is an admin.
 * Admins have full access to everything without needing explicit permissions.
 */
export function isAdmin(userType: string | undefined | null): boolean {
  if (!userType) return false;
  return ADMIN_USER_TYPES.includes(userType.toLowerCase() as 'admin');
}

/**
 * Returns true if the user_type is a customer (blocked from login).
 */
export function isCustomerType(userType: string | undefined | null): boolean {
  if (!userType) return false;
  return CUSTOMER_USER_TYPES.includes(userType.toLowerCase() as typeof CUSTOMER_USER_TYPES[number]);
}

/**
 * Check whether a user has a given permission.
 * - Admins always return true.
 * - Employees must have the permission string in their permissions array.
 */
export function hasPermission(
  userType: string | undefined | null,
  permissions: string[],
  permission: string,
): boolean {
  if (isAdmin(userType)) return true;
  return permissions.includes(permission);
}

/**
 * Check whether the employee has at least one permission assigned.
 * Admins always return true.
 */
export function hasAnyPermission(
  userType: string | undefined | null,
  permissions: string[],
): boolean {
  if (isAdmin(userType)) return true;
  return permissions.length > 0;
}
