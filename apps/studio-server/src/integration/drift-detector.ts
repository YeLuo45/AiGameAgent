// V24 DriftDetector (Direction D 24/30, orchestrator)
// Detect behavioral changes (agent personality drift)

export type DriftMetric = "success-rate" | "duration" | "tool-usage" | "output-style" | "capability-mix";

export interface DriftSnapshot {
  ts: number;
  metric: DriftMetric;
  value: number;
  /** Reference baseline (e.g. 7-day rolling avg). */
  baseline: number;
}

export interface DriftAlert {
  metric: DriftMetric;
  ts: number;
  driftPercent: number; // 0-1
  severity: "info" | "warn" | "critical";
  message: string;
}

export interface DriftDetectorState {
  snapshots: DriftSnapshot[];
  /** Threshold for warnings. */
  warnThreshold: number; // 0.1 = 10% drift
  criticalThreshold: number; // 0.3 = 30% drift
}

export function createDriftDetector(warnThreshold: number = 0.1, criticalThreshold: number = 0.3): DriftDetectorState {
  return { snapshots: [], warnThreshold, criticalThreshold };
}

export function recordSnapshot(state: DriftDetectorState, metric: DriftMetric, value: number, baseline: number): DriftDetectorState {
  return { ...state, snapshots: [...state.snapshots, { ts: Date.now(), metric, value, baseline }] };
}

export function detectDrift(state: DriftDetectorState, metric: DriftMetric): DriftAlert | null {
  const matching = state.snapshots.filter((s) => s.metric === metric);
  if (matching.length < 2) return null;
  const latest = matching[matching.length - 1];
  if (latest.baseline === 0) return null;
  const drift = Math.abs(latest.value - latest.baseline) / Math.max(0.01, Math.abs(latest.baseline));
  const severity = drift >= state.criticalThreshold ? "critical" : drift >= state.warnThreshold ? "warn" : "info";
  return { metric, ts: latest.ts, driftPercent: drift, severity, message: `${metric} drift: ${(drift * 100).toFixed(1)}% from baseline` };
}

export function detectAllDrift(state: DriftDetectorState): DriftAlert[] {
  const metrics = new Set(state.snapshots.map((s) => s.metric));
  const out: DriftAlert[] = [];
  for (const m of metrics) {
    const a = detectDrift(state, m);
    if (a) out.push(a);
  }
  return out;
}

export function criticalDrifts(alerts: DriftAlert[]): DriftAlert[] {
  return alerts.filter((a) => a.severity === "critical");
}

/** Master metric: drift stability 0-1 (low drift = high stability). */
export function driftStability(alerts: DriftAlert[]): number {
  if (alerts.length === 0) return 1.0;
  const avgDrift = alerts.reduce((a, x) => a + x.driftPercent, 0) / alerts.length;
  return Math.max(0, 1 - avgDrift);
}
