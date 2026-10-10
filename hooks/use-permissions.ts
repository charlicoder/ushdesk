/**
 * usePermissions — React hook to check RBAC permissions for the logged-in user.
 *
 * Reads user_type, permissions, and roleInfo from the Redux auth store.
 * Admins (user_type === "admin") OR superusers (roleInfo.is_superuser === true)
 * always return `true` for any permission check.
 */

import { useAppSelector } from '@/store/hooks';
import {
  hasPermission,
  hasAnyPermission,
  isAdmin as checkIsAdmin,
  isAdministratorRole,
  isSpaDirectorRole,
  isFinanceManagerRole,
  isRefundsAndFinancePermittedRole,
  isRefundsOrFinancePermission,
} from '@/lib/permissions';

export function usePermissions() {
  const user        = useAppSelector((s) => s.auth.user);
  const permissions = useAppSelector((s) => s.auth.permissions);
  const roleInfo    = useAppSelector((s) => s.auth.roleInfo);

  const userType   = user?.user_type ?? null;
  // Treat admin user_type, is_superuser flag, or Administrator role as full access
  const adminAccess = checkIsAdmin(userType) || (roleInfo?.is_superuser === true) || isAdministratorRole(roleInfo, user);
  const isRefundsAndFinanceAllowed = isRefundsAndFinancePermittedRole(roleInfo, user);

  return {
    /** True if the current user has full access (admin user_type or is_superuser flag or administrator role) */
    isAdmin: adminAccess,

    /** True if the user is a Spa Director */
    isSpaDirector: isSpaDirectorRole(roleInfo, user),

    /** True if the user is a Finance Manager */
    isFinanceManager: isFinanceManagerRole(roleInfo, user),

    /** True if user has access to Refunds and Finance submenus */
    isRefundsAndFinancePermitted: isRefundsAndFinanceAllowed,

    /** Check if the user has a specific permission string */
    can: (permission: string): boolean => {
      if (adminAccess) return true;
      if (isRefundsAndFinanceAllowed && isRefundsOrFinancePermission(permission)) {
        return true;
      }
      return hasPermission(userType, permissions, permission, roleInfo, user);
    },

    /** True if the employee has at least one permission; always true for admins/superusers */
    hasAnyPermission: adminAccess || isRefundsAndFinanceAllowed || hasAnyPermission(userType, permissions, roleInfo, user),

    /** The raw permissions codenames array */
    permissions,

    /** The role info block from the API (role_name, is_superuser, etc.) */
    roleInfo,

    /** The user's type */
    userType,
  };
}

