// V17 ToolPermissionControl (Direction B 17/30, chatdev)
// Allow/deny matrix for tools (per agent, per tool)

export type Permission = "allow" | "deny" | "ask" | "sandbox-only";

export interface PermissionRule {
  /** Tool name pattern (e.g. "Read", "Bash*", "*"). */
  toolPattern: string;
  /** Agent ID pattern (e.g. "qa-tester", "*"). */
  agentPattern: string;
  /** Permission level. */
  permission: Permission;
  /** Optional scope (e.g. specific file paths for Read). */
  scope?: string;
  /** Reason / note. */
  reason?: string;
}

export interface PermissionState {
  rules: PermissionRule[];
  /** Default permission when no rule matches. */
  defaultPermission: Permission;
}

export function createPermissionState(defaultPermission: Permission = "ask"): PermissionState {
  return { rules: [], defaultPermission };
}

function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (pattern === value) return true;
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return false;
}

export function addRule(state: PermissionState, rule: PermissionRule): PermissionState {
  return { ...state, rules: [...state.rules, rule] };
}

export function removeRule(state: PermissionState, toolPattern: string, agentPattern: string): PermissionState {
  return { ...state, rules: state.rules.filter((r) => !(r.toolPattern === toolPattern && r.agentPattern === agentPattern)) };
}

export function checkPermission(state: PermissionState, toolName: string, agentId: string): { permission: Permission; matchedRule?: PermissionRule } {
  for (const r of state.rules) {
    if (matchesPattern(r.toolPattern, toolName) && matchesPattern(r.agentPattern, agentId)) {
      return { permission: r.permission, matchedRule: r };
    }
  }
  return { permission: state.defaultPermission };
}

export function setDefaultPermission(state: PermissionState, p: Permission): PermissionState {
  return { ...state, defaultPermission: p };
}

/** Check if a tool call should be auto-approved. */
export function isAutoAllowed(state: PermissionState, toolName: string, agentId: string): boolean {
  return checkPermission(state, toolName, agentId).permission === "allow";
}

/** Check if a tool call should be auto-denied. */
export function isAutoDenied(state: PermissionState, toolName: string, agentId: string): boolean {
  const p = checkPermission(state, toolName, agentId).permission;
  return p === "deny";
}

/** Master metric: permission policy completeness 0-1 (how many tool/agent combos have explicit rules). */
export function permissionCoverage(state: PermissionState, allTools: string[], allAgents: string[]): number {
  const total = allTools.length * allAgents.length;
  if (total === 0) return 1.0;
  let covered = 0;
  for (const t of allTools) for (const a of allAgents) {
    if (checkPermission(state, t, a).matchedRule !== undefined) covered++;
  }
  return covered / total;
}
