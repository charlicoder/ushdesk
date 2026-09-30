/**
 * usePermissions — React hook to check RBAC permissions for the logged-in user.
 *
 * Reads user_type, permissions, and roleInfo from the Redux auth store.
 * Admins (user_type === "admin") OR superusers (roleInfo.is_superuser === true)
 * always return `true` for any permission check.
 */

import { useAppSelector } from '@/store/hooks';
import { hasPermission, hasAnyPermission, isAdmin as checkIsAdmin } from '@/lib/permissions';

export function usePermissions() {
  const user        = useAppSelector((s) => s.auth.user);
  const permissions = useAppSelector((s) => s.auth.permissions);
  const roleInfo    = useAppSelector((s) => s.auth.roleInfo);

  const userType   = user?.user_type ?? null;
  // Treat both admin user_type AND is_superuser flag as full access
  const adminAccess = checkIsAdmin(userType) || (roleInfo?.is_superuser === true);

  return {
    /** True if the current user has full access (admin user_type or is_superuser flag) */
    isAdmin: adminAccess,

    /** Check if the user has a specific permission string */
    can: (permission: string): boolean => {
      if (adminAccess) return true;
      return hasPermission(userType, permissions, permission);
    },

    /** True if the employee has at least one permission; always true for admins/superusers */
    hasAnyPermission: adminAccess || hasAnyPermission(userType, permissions),

    /** The raw permissions codenames array */
    permissions,

    /** The role info block from the API (role_name, is_superuser, etc.) */
    roleInfo,

    /** The user's type */
    userType,
  };
}
