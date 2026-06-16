// V15 Dashboard (Direction F 15/30, thunderbolt)
// UI-ready dashboard snapshot (for visualization)

import { type MetricsRegistryState, listEntries, type MetricEntry } from "./metrics-registry.js";
import { type AlertManagerState, activeAlertCount } from "./alert-manager.js";
import { type LogAggregatorState, countErrors } from "./log-aggregator.js";

export interface DashboardPanel {
  title: string;
  type: "metric" | "alert" | "log";
  value: number;
  unit: string;
  status: "ok" | "warn" | "critical";
  trend: "up" | "down" | "stable";
}

export interface Dashboard {
  panels: DashboardPanel[];
  /** Overall system health. */
  systemHealth: number;
  /** Generated at. */
  generatedAt: number;
}

export function buildDashboard(metrics: MetricsRegistryState, alerts: AlertManagerState, logs: LogAggregatorState, now: number = Date.now()): Dashboard {
  const panels: DashboardPanel[] = [];
  // Metrics panels
  for (const e of listEntries(metrics)) {
    const value = readMetricValue(e);
    panels.push({
      title: e.name,
      type: "metric",
      value,
      unit: e.kind,
      status: value > 1000 ? "warn" : "ok",
      trend: "stable",
    });
  }
  // Alert panel
  panels.push({
    title: "Active Alerts",
    type: "alert",
    value: activeAlertCount(alerts),
    unit: "count",
    status: activeAlertCount(alerts) > 0 ? "warn" : "ok",
    trend: "stable",
  });
  // Error log panel
  const errs = countErrors(logs);
  panels.push({
    title: "Error Logs",
    type: "log",
    value: errs,
    unit: "count",
    status: errs > 10 ? "critical" : errs > 0 ? "warn" : "ok",
    trend: "stable",
  });
  return { panels, systemHealth: computeSystemHealth(panels), generatedAt: now };
}

function readMetricValue(e: MetricEntry): number {
  const ref = e.ref as { value?: number };
  return ref.value ?? 0;
}

function computeSystemHealth(panels: DashboardPanel[]): number {
  if (panels.length === 0) return 1.0;
  const scores = panels.map((p) => p.status === "ok" ? 1 : p.status === "warn" ? 0.5 : 0.2);
  return scores.reduce((a, b) => a + b, 0) / panels.length;
}

export function criticalPanels(d: Dashboard): DashboardPanel[] {
  return d.panels.filter((p) => p.status === "critical");
}

/** Master metric: dashboard completeness 0-1. */
export function dashboardCompleteness(d: Dashboard): number {
  if (d.panels.length === 0) return 0;
  return Math.min(1, d.panels.length / 5);
}
