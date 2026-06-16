// V10 AlertManager (Direction F 10/30, thunderbolt)
// Alert state machine (pending → firing → resolved)

import { type AlertRule, shouldFire, markFired, createRule } from "./alert-rule.js";

export type AlertState = "ok" | "pending" | "firing" | "resolved";

export interface ActiveAlert {
  id: string;
  ruleId: string;
  metric: string;
  severity: AlertRule["severity"];
  value: number;
  startedAt: number;
  resolvedAt: number | null;
  state: AlertState;
}

export interface AlertManagerState {
  rules: Record<string, AlertRule>;
  alerts: Record<string, ActiveAlert>;
  /** Required consecutive breaches to fire. */
  breachThreshold: number;
  /** Per-rule breach counter. */
  breachCounts: Record<string, number>;
}

export function createAlertManager(breachThreshold: number = 1): AlertManagerState {
  return { rules: {}, alerts: {}, breachThreshold, breachCounts: {} };
}

export function addRule(state: AlertManagerState, rule: AlertRule): AlertManagerState {
  return { ...state, rules: { ...state.rules, [rule.id]: rule } };
}

export function evaluate(state: AlertManagerState, metric: string, value: number, now: number = Date.now()): AlertManagerState {
  let next = state;
  for (const rule of Object.values(state.rules)) {
    if (rule.metric !== metric) continue;
    const matches = shouldFire(rule, value, now) || (rule.op !== "==" && rule.op !== "!=" && (value > rule.threshold || value < rule.threshold));
    if (matches) {
      next = { ...next, breachCounts: { ...next.breachCounts, [rule.id]: (next.breachCounts[rule.id] ?? 0) + 1 } };
      if ((next.breachCounts[rule.id] ?? 0) >= next.breachThreshold) {
        if (shouldFire(rule, value, now)) {
          next = fire(next, rule, value, now);
        }
      }
    } else {
      if (next.breachCounts[rule.id]) {
        next = { ...next, breachCounts: { ...next.breachCounts, [rule.id]: 0 } };
        next = resolve(next, rule.id, now);
      }
    }
  }
  return next;
}

export function fire(state: AlertManagerState, rule: AlertRule, value: number, now: number = Date.now()): AlertManagerState {
  const alertId = `${rule.id}-${now}`;
  const alert: ActiveAlert = { id: alertId, ruleId: rule.id, metric: rule.metric, severity: rule.severity, value, startedAt: now, resolvedAt: null, state: "firing" };
  return { ...state, alerts: { ...state.alerts, [alertId]: alert }, rules: { ...state.rules, [rule.id]: markFired(rule, now) } };
}

export function resolve(state: AlertManagerState, ruleId: string, now: number = Date.now()): AlertManagerState {
  const updated: Record<string, ActiveAlert> = {};
  for (const [id, a] of Object.entries(state.alerts)) {
    if (a.ruleId === ruleId && a.state === "firing") {
      updated[id] = { ...a, state: "resolved", resolvedAt: now };
    } else {
      updated[id] = a;
    }
  }
  return { ...state, alerts: updated };
}

export function listAlerts(state: AlertManagerState, filter: { severity?: AlertRule["severity"]; state?: AlertState; metric?: string } = {}): ActiveAlert[] {
  let arr = Object.values(state.alerts);
  if (filter.severity) arr = arr.filter((a) => a.severity === filter.severity);
  if (filter.state) arr = arr.filter((a) => a.state === filter.state);
  if (filter.metric) arr = arr.filter((a) => a.metric === filter.metric);
  return arr.sort((a, b) => b.startedAt - a.startedAt);
}

export function activeAlertCount(state: AlertManagerState): number {
  return listAlerts(state, { state: "firing" }).length;
}

/** Master metric: alert noise 0-1 (fewer = better). */
export function alertNoise(state: AlertManagerState): number {
  const active = activeAlertCount(state);
  return Math.min(1, active / 10);
}
