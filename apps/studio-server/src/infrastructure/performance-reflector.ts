// V26 PerformanceReflector (Direction E 26/30, generic-agent)
// Reflect on performance metrics and produce recommendations

import { type EventStoreState, queryEvents } from "./event-store.js";

export interface PerformanceMetrics {
  /** Total events in window. */
  totalEvents: number;
  /** Failure rate (0-1). */
  failureRate: number;
  /** Average latency (ms) from llm.chunk events. */
  avgFirstChunkMs: number | null;
  /** p95 latency estimate. */
  p95FirstChunkMs: number | null;
  /** Token throughput (tokens/sec over window). */
  tokensPerSec: number;
  /** Top error reasons. */
  topErrors: Array<{ reason: string; count: number }>;
}

export interface Recommendation {
  severity: "info" | "warn" | "critical";
  category: "performance" | "reliability" | "capacity" | "cost";
  message: string;
  suggestedAction: string;
}

export interface ReflectorState {
  /** History of reflections. */
  reflections: Array<{ ts: number; metrics: PerformanceMetrics; recommendations: Recommendation[] }>;
  /** Configurable thresholds. */
  thresholds: {
    failRateWarn: number;
    failRateCritical: number;
    p95Warn: number;
    p95Critical: number;
  };
}

export function createReflector(): ReflectorState {
  return {
    reflections: [],
    thresholds: { failRateWarn: 0.1, failRateCritical: 0.3, p95Warn: 2000, p95Critical: 5000 },
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function computeMetrics(state: EventStoreState, sinceMs: number = 0): PerformanceMetrics {
  const filtered = queryEvents(state, { since: new Date(sinceMs).toISOString() });
  const totalEvents = filtered.length;
  const failed = filtered.filter((e) => e.type === "job.failed" || e.type === "job.finished" && (e.payload as { ok?: boolean })?.ok === false).length;
  const failureRate = totalEvents === 0 ? 0 : failed / totalEvents;
  const llmEvents = filtered.filter((e) => e.type === "llm.chunk");
  const latencies = llmEvents.map((e) => (e.payload as { firstChunkMs?: number })?.firstChunkMs ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  const avgFirstChunkMs = latencies.length === 0 ? null : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95FirstChunkMs = latencies.length === 0 ? null : percentile(latencies, 0.95);
  // Token throughput: simple estimate
  const totalChars = filtered.filter((e) => e.type === "llm.chunk").reduce((acc, e) => acc + ((e.payload as { text?: string })?.text?.length ?? 0), 0);
  const tokensPerSec = totalChars / 4 / 3600; // assume 1h window
  // Top errors
  const errorCounts = new Map<string, number>();
  for (const e of filtered) {
    if (e.type === "job.failed") {
      const r = (e.payload as { failureReason?: string })?.failureReason ?? "unknown";
      errorCounts.set(r, (errorCounts.get(r) ?? 0) + 1);
    }
  }
  const topErrors = Array.from(errorCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  return { totalEvents, failureRate, avgFirstChunkMs, p95FirstChunkMs, tokensPerSec, topErrors };
}

export function generateRecommendations(metrics: PerformanceMetrics, state: ReflectorState): Recommendation[] {
  const out: Recommendation[] = [];
  if (metrics.failureRate > state.thresholds.failRateCritical) {
    out.push({ severity: "critical", category: "reliability", message: `Failure rate ${(metrics.failureRate * 100).toFixed(1)}% exceeds critical threshold`, suggestedAction: "Investigate top error reasons and consider circuit-breaker activation" });
  } else if (metrics.failureRate > state.thresholds.failRateWarn) {
    out.push({ severity: "warn", category: "reliability", message: `Failure rate ${(metrics.failureRate * 100).toFixed(1)}% is elevated`, suggestedAction: "Monitor error patterns" });
  }
  if (metrics.p95FirstChunkMs !== null) {
    if (metrics.p95FirstChunkMs > state.thresholds.p95Critical) {
      out.push({ severity: "critical", category: "performance", message: `P95 latency ${metrics.p95FirstChunkMs}ms is critical`, suggestedAction: "Switch to a faster provider or scale compute slots" });
    } else if (metrics.p95FirstChunkMs > state.thresholds.p95Warn) {
      out.push({ severity: "warn", category: "performance", message: `P95 latency ${metrics.p95FirstChunkMs}ms is elevated`, suggestedAction: "Consider pre-warming connections" });
    }
  }
  if (metrics.tokensPerSec < 10 && metrics.totalEvents > 100) {
    out.push({ severity: "info", category: "cost", message: "Low token throughput", suggestedAction: "Consider larger models for batch tasks" });
  }
  for (const err of metrics.topErrors.slice(0, 2)) {
    if (err.count > 5) {
      out.push({ severity: "warn", category: "reliability", message: `Frequent error: ${err.reason} (${err.count} occurrences)`, suggestedAction: `Add specific handling for "${err.reason}"` });
    }
  }
  return out;
}

export function reflect(state: ReflectorState, store: EventStoreState, sinceMs: number = 0): { state: ReflectorState; metrics: PerformanceMetrics; recommendations: Recommendation[] } {
  const metrics = computeMetrics(store, sinceMs);
  const recommendations = generateRecommendations(metrics, state);
  return { state: { ...state, reflections: [...state.reflections, { ts: Date.now(), metrics, recommendations }] }, metrics, recommendations };
}

/** Master metric: reflection quality 0-1. */
export function reflectionQuality(recs: Recommendation[]): number {
  if (recs.length === 0) return 0.7; // no issues found
  const critical = recs.filter((r) => r.severity === "critical").length;
  const warn = recs.filter((r) => r.severity === "warn").length;
  if (critical > 0) return 0.2;
  if (warn > 0) return 0.5;
  return 0.8;
}
