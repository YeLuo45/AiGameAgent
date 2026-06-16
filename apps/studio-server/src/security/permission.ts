// V21 Permission (Direction G 21/30, orchestrator)
// Fine-grained permissions (read/write/execute/admin/audit/deploy)

import { type RBACState, hasPermission, getEffectivePermissions } from "./rbac.js";

export type PermissionAction = "read" | "write" | "execute" | "admin" | "audit" | "deploy";

export type Resource = string;

export interface PermissionCheck {
  userId: string;
  resource: Resource;
  action: PermissionAction;
}

export function checkPermission(state: RBACState, check: PermissionCheck): boolean {
  return hasPermission(state, check.userId, check.action);
}

export function checkAnyPermission(state: RBACState, userId: string, resource: Resource, actions: PermissionAction[]): boolean {
  const effective = getEffectivePermissions(state, userId);
  return actions.some((a) => effective.has(a));
}

export function checkAllPermissions(state: RBACState, userId: string, resource: Resource, actions: PermissionAction[]): boolean {
  const effective = getEffectivePermissions(state, userId);
  return actions.every((a) => effective.has(a));
}

export function allowedResources(state: RBACState, userId: string, action: PermissionAction, allResources: Resource[]): Resource[] {
  if (hasPermission(state, userId, action)) return allResources;
  return [];
}

export function isReadOnly(state: RBACState, userId: string): boolean {
  const perms = getEffectivePermissions(state, userId);
  return perms.has("read") && !perms.has("write") && !perms.has("admin");
}

export function isAdmin(state: RBACState, userId: string): boolean {
  return hasPermission(state, userId, "admin");
}

/** Master metric: permission coverage 0-1. */
export function permissionCoverage(state: RBACState): number {
  if (Object.keys(state.userRoles).length === 0) return 0;
  const usersWithPerms = Object.keys(state.userRoles).filter((u) => getEffectivePermissions(state, u).size > 0).length;
  return usersWithPerms / Object.keys(state.userRoles).length;
}
