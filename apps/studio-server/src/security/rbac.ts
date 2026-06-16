// V20 RBAC (Direction G 20/30, generic-agent)
// Role-based access control

export type Permission = "read" | "write" | "execute" | "admin" | "audit" | "deploy";

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  /** Parent role (inherits permissions). */
  parent: string | null;
}

export interface RBACState {
  roles: Record<string, Role>;
  userRoles: Record<string, string[]>;
}

export function createRBACState(): RBACState {
  return { roles: {}, userRoles: {} };
}

export function defineRole(state: RBACState, role: Role): RBACState {
  return { ...state, roles: { ...state.roles, [role.id]: role } };
}

export function assignRole(state: RBACState, userId: string, roleId: string): RBACState {
  const cur = state.userRoles[userId] ?? [];
  if (cur.includes(roleId)) return state;
  return { ...state, userRoles: { ...state.userRoles, [userId]: [...cur, roleId] } };
}

export function unassignRole(state: RBACState, userId: string, roleId: string): RBACState {
  const cur = state.userRoles[userId] ?? [];
  return { ...state, userRoles: { ...state.userRoles, [userId]: cur.filter((r) => r !== roleId) } };
}

export function getEffectivePermissions(state: RBACState, userId: string): Set<Permission> {
  const result = new Set<Permission>();
  const roles = state.userRoles[userId] ?? [];
  for (const roleId of roles) {
    collectPermissions(state, roleId, result, new Set());
  }
  return result;
}

function collectPermissions(state: RBACState, roleId: string, into: Set<Permission>, visiting: Set<string>): void {
  if (visiting.has(roleId)) return;
  visiting.add(roleId);
  const role = state.roles[roleId];
  if (!role) {
    visiting.delete(roleId);
    return;
  }
  for (const p of role.permissions) into.add(p);
  if (role.parent) collectPermissions(state, role.parent, into, visiting);
  visiting.delete(roleId);
}

export function hasPermission(state: RBACState, userId: string, permission: Permission): boolean {
  return getEffectivePermissions(state, userId).has(permission);
}

export function hasAnyPermission(state: RBACState, userId: string, perms: Permission[]): boolean {
  const effective = getEffectivePermissions(state, userId);
  return perms.some((p) => effective.has(p));
}

export function hasAllPermissions(state: RBACState, userId: string, perms: Permission[]): boolean {
  const effective = getEffectivePermissions(state, userId);
  return perms.every((p) => effective.has(p));
}

/** Master metric: RBAC coverage 0-1. */
export function rbacCoverage(state: RBACState): number {
  const userCount = Object.keys(state.userRoles).length;
  if (userCount === 0) return 0;
  const usersWithRoles = Object.values(state.userRoles).filter((r) => r.length > 0).length;
  return usersWithRoles / userCount;
}
