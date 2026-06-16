// V9 AlertRule (Direction F 9/30, thunderbolt)
// Threshold-based alert rules

export type AlertOp = ">" | ">=" | "<" | "<=" | "==" | "!=";

export interface AlertRule {
  id: string;
  metric: string;
  op: AlertOp;
  threshold: number;
  /** Severity. */
  severity: "info" | "warn" | "critical";
  /** Optional description. */
  description: string;
  /** Enabled. */
  enabled: boolean;
  /** Cool-down in ms. */
  cooldownMs: number;
  /** Last fired at. */
  lastFiredAt: number | null;
}

export function createRule(id: string, metric: string, op: AlertOp, threshold: number, severity: AlertRule["severity"] = "warn", opts: { description?: string; cooldownMs?: number } = {}): AlertRule {
  return { id, metric, op, threshold, severity, description: opts.description ?? "", enabled: true, cooldownMs: opts.cooldownMs ?? 60_000, lastFiredAt: null };
}

export function matchesRule(rule: AlertRule, value: number): boolean {
  if (!rule.enabled) return false;
  switch (rule.op) {
    case ">": return value > rule.threshold;
    case ">=": return value >= rule.threshold;
    case "<": return value < rule.threshold;
    case "<=": return value <= rule.threshold;
    case "==": return value === rule.threshold;
    case "!=": return value !== rule.threshold;
  }
}

export function shouldFire(rule: AlertRule, value: number, now: number = Date.now()): boolean {
  if (!matchesRule(rule, value)) return false;
  if (rule.lastFiredAt === null) return true;
  return now - rule.lastFiredAt >= rule.cooldownMs;
}

export function markFired(rule: AlertRule, now: number = Date.now()): AlertRule {
  return { ...rule, lastFiredAt: now };
}

export function enableRule(rule: AlertRule): AlertRule {
  return { ...rule, enabled: true };
}

export function disableRule(rule: AlertRule): AlertRule {
  return { ...rule, enabled: false };
}

/** Master metric: rule coverage 0-1. */
export function ruleCoverage(rules: AlertRule[]): number {
  if (rules.length === 0) return 0;
  return rules.filter((r) => r.enabled).length / rules.length;
}
