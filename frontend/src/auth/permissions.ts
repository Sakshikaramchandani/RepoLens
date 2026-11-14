import type { CurrentUser } from "../api/contract";

/**
 * Role checks for the UI ONLY (hide/show navigation).
 * The backend must still enforce every permission.
 *
 * Roles are not finalised yet, so `allowedRoles` is optional: no list = everyone signed in.
 * Once the team agrees on roles (e.g. "USER", "ADMIN"), pass them per route/nav item.
 */
export function canAccess(user: CurrentUser | null, allowedRoles?: readonly string[]): boolean {
  if (!user) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((role) => role.toUpperCase() === user.role?.toUpperCase());
}
