// V29 SecurityPolicy (Direction G 29/30, orchestrator)
// Security policy (allow-list / deny-list / password rules)

export type PolicyAction = "allow" | "deny" | "audit" | "challenge";

export interface PolicyRule {
  id: string;
  name: string;
  /** Resource pattern. */
  resource: string;
  action: PolicyAction;
  /** Whether enabled. */
  enabled: boolean;
  /** Priority (higher = wins). */
  priority: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  /** Max age in days. */
  maxAgeDays: number | null;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSpecial: false,
  maxAgeDays: 90,
};

export interface SecurityPolicyState {
  rules: PolicyRule[];
  password: PasswordPolicy;
  /** IP allow list. */
  allowIps: string[];
  /** IP deny list. */
  denyIps: string[];
}

export function createSecurityPolicyState(password: PasswordPolicy = DEFAULT_PASSWORD_POLICY): SecurityPolicyState {
  return { rules: [], password, allowIps: [], denyIps: [] };
}

export function addRule(state: SecurityPolicyState, rule: PolicyRule): SecurityPolicyState {
  return { ...state, rules: [...state.rules, rule] };
}

export function removeRule(state: SecurityPolicyState, id: string): SecurityPolicyState {
  return { ...state, rules: state.rules.filter((r) => r.id !== id) };
}

export function enableRule(state: SecurityPolicyState, id: string): SecurityPolicyState {
  return { ...state, rules: state.rules.map((r) => r.id === id ? { ...r, enabled: true } : r) };
}

export function disableRule(state: SecurityPolicyState, id: string): SecurityPolicyState {
  return { ...state, rules: state.rules.map((r) => r.id === id ? { ...r, enabled: false } : r) };
}

export function evaluateAction(state: SecurityPolicyState, resource: string, ip: string | null = null): PolicyAction {
  // IP deny list takes precedence
  if (ip && state.denyIps.includes(ip)) return "deny";
  // Evaluate rules by priority
  const matched = state.rules
    .filter((r) => r.enabled && matchesResource(r.resource, resource))
    .sort((a, b) => b.priority - a.priority);
  if (matched.length > 0) return matched[0].action;
  // IP allow list default
  if (ip && state.allowIps.length > 0 && !state.allowIps.includes(ip)) return "deny";
  return "allow";
}

function matchesResource(pattern: string, resource: string): boolean {
  if (pattern === "*") return true;
  if (pattern === resource) return true;
  if (pattern.endsWith("*")) return resource.startsWith(pattern.slice(0, -1));
  return false;
}

export function validatePassword(state: SecurityPolicyState, password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < state.password.minLength) errors.push(`min length ${state.password.minLength}`);
  if (state.password.requireUpper && !/[A-Z]/.test(password)) errors.push("missing upper");
  if (state.password.requireLower && !/[a-z]/.test(password)) errors.push("missing lower");
  if (state.password.requireDigit && !/[0-9]/.test(password)) errors.push("missing digit");
  if (state.password.requireSpecial && !/[^A-Za-z0-9]/.test(password)) errors.push("missing special");
  return { valid: errors.length === 0, errors };
}

/** Master metric: policy coverage 0-1. */
export function policyCoverage(state: SecurityPolicyState): number {
  let score = 0;
  if (state.rules.length > 0) score += 0.3;
  if (state.allowIps.length > 0 || state.denyIps.length > 0) score += 0.3;
  if (state.password.minLength >= 8) score += 0.4;
  return Math.min(1, score);
}
