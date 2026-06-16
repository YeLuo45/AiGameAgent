// V28 ThreatDetector (Direction G 28/30, orchestrator)
// Security anomaly detection (brute force, unusual access)

import { type LogEntry } from "../observability/structured-log.js";

export type ThreatLevel = "none" | "low" | "medium" | "high" | "critical";

export interface ThreatSignal {
  id: number;
  ts: number;
  level: ThreatLevel;
  kind: "brute-force" | "unusual-source" | "rate-spike" | "data-exfil" | "privilege-escalation";
  source: string;
  details: Record<string, unknown>;
}

export interface ThreatDetectorConfig {
  /** Failed login threshold. */
  bruteForceThreshold: number;
  /** Time window. */
  bruteForceWindowMs: number;
  /** Distinct IPs threshold. */
  unusualSourceThreshold: number;
  /** Requests per minute. */
  rateSpikeThreshold: number;
}

export const DEFAULT_THREAT_CONFIG: ThreatDetectorConfig = {
  bruteForceThreshold: 5,
  bruteForceWindowMs: 60_000,
  unusualSourceThreshold: 10,
  rateSpikeThreshold: 100,
};

export interface ThreatDetectorState {
  config: ThreatDetectorConfig;
  signals: ThreatSignal[];
  nextId: number;
  /** Recent failed logins by source. */
  failedLogins: Record<string, number[]>;
}

export function createThreatDetector(config: ThreatDetectorConfig = DEFAULT_THREAT_CONFIG): ThreatDetectorState {
  return { config, signals: [], nextId: 1, failedLogins: {} };
}

export function recordLogin(state: ThreatDetectorState, source: string, success: boolean, now: number = Date.now()): ThreatDetectorState {
  if (success) return state;
  const arr = (state.failedLogins[source] ?? []).filter((t) => now - t < state.config.bruteForceWindowMs);
  arr.push(now);
  let next: ThreatDetectorState = { ...state, failedLogins: { ...state.failedLogins, [source]: arr } };
  if (arr.length >= state.config.bruteForceThreshold) {
    next = emitSignal(next, "high", "brute-force", source, { count: arr.length });
  }
  return next;
}

export function detectRateSpike(state: ThreatDetectorState, requestCount: number, source: string, now: number = Date.now()): ThreatDetectorState {
  if (requestCount < state.config.rateSpikeThreshold) return state;
  return emitSignal(state, "medium", "rate-spike", source, { count: requestCount });
}

export function detectUnusualSource(state: ThreatDetectorState, sources: string[]): ThreatDetectorState {
  if (sources.length < state.config.unusualSourceThreshold) return state;
  return emitSignal(state, "low", "unusual-source", "multi", { count: sources.length });
}

export function emitSignal(state: ThreatDetectorState, level: ThreatLevel, kind: ThreatSignal["kind"], source: string, details: Record<string, unknown>, now: number = Date.now()): ThreatDetectorState {
  const signal: ThreatSignal = { id: state.nextId, ts: now, level, kind, source, details };
  return { ...state, signals: [...state.signals, signal], nextId: state.nextId + 1 };
}

export function listSignals(state: ThreatDetectorState, level?: ThreatLevel): ThreatSignal[] {
  let arr = state.signals;
  if (level) arr = arr.filter((s) => s.level === level);
  return arr.sort((a, b) => b.ts - a.ts);
}

export function criticalSignals(state: ThreatDetectorState): ThreatSignal[] {
  return listSignals(state, "critical");
}

/** Master metric: threat severity 0-1. */
export function threatSeverity(state: ThreatDetectorState): number {
  const counts: Record<ThreatLevel, number> = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of state.signals) counts[s.level]++;
  const weights: Record<ThreatLevel, number> = { none: 0, low: 0.1, medium: 0.3, high: 0.7, critical: 1 };
  let score = 0;
  for (const [level, count] of Object.entries(counts)) score += (weights as Record<string, number>)[level] * count;
  return Math.min(1, score / 5);
}
