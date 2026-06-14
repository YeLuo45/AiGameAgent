// V30 MasterOrchestrator (Direction E 30/30, orchestrator)
// Master orchestrator: integrates all 29 engines + produces mastery score

import { type ChannelAdapter, type ChannelCapability } from "./channel-adapter.js";
import { type AdapterRegistryState, getDefaultAdapter, listAdapters } from "./adapter-registry.js";
import { type HealthCheckerState, getCircuitState, healthScore, createHealthState } from "./health-checker.js";
import { type RateLimiterState, rateLimiterEfficiency } from "./rate-limiter.js";
import { type QuotaState, quotaHeadroom } from "./quota-tracker.js";
import { type EventStoreState, eventStoreHealth } from "./event-store.js";
import { type AuditLogState, auditLogHealth } from "./audit-log.js";
import { type ConnectionPoolState, poolHealth } from "./connection-pool.js";
import { type EventHookState, hookHealth } from "./event-hook.js";
import { type AdapterSharingState, sharingEfficiency } from "./adapter-sharing.js";
import { type ResilienceMetrics, resilienceScore } from "./resilience-orchestrator.js";

export interface MasterSnapshot {
  /** Per-adapter health score (0-1). */
  adapterHealth: Record<string, number>;
  /** Per-adapter rate limit efficiency (0-1). */
  rateEfficiency: Record<string, number>;
  /** Per-adapter quota headroom (0-1). */
  quotaHeadroomById: Record<string, number>;
  /** Event store health (0-1). */
  eventStore: number;
  /** Audit log health (0-1). */
  auditLog: number;
  /** Pool health (0-1, averaged). */
  poolAvg: number;
  /** Hook system health (0-1). */
  hookSystem: number;
  /** Sharing efficiency (0-1). */
  sharing: number;
  /** Resilience score (0-1). */
  resilience: number;
  /** Registry coverage (0-1). */
  registryCoverage: number;
}

export interface MasterInput {
  registry: AdapterRegistryState;
  health: Record<string, HealthCheckerState>;
  rateLimits: Record<string, RateLimiterState>;
  quotas: Record<string, QuotaState>;
  eventStore: EventStoreState;
  auditLog: AuditLogState;
  pools: ConnectionPoolState[];
  hooks: EventHookState;
  sharing: AdapterSharingState;
  metrics: ResilienceMetrics;
  capability?: ChannelCapability;
}

export function buildSnapshot(input: MasterInput): MasterSnapshot {
  const adapterHealth: Record<string, number> = {};
  const rateEfficiency: Record<string, number> = {};
  const quotaHeadroomById: Record<string, number> = {};
  const adapters = listAdapters(input.registry, { capability: input.capability, enabledOnly: true });
  for (const r of adapters) {
    const h = input.health[r.adapter.id];
    adapterHealth[r.adapter.id] = h ? healthScore(h) : 1.0;
    const rl = input.rateLimits[r.adapter.id];
    rateEfficiency[r.adapter.id] = rl ? rateLimiterEfficiency(rl) : 1.0;
    const q = input.quotas[r.adapter.id];
    quotaHeadroomById[r.adapter.id] = q ? quotaHeadroom(q) : 1.0;
  }
  const poolAvg = input.pools.length === 0 ? 1.0 : input.pools.reduce((a, p) => a + poolHealth(p), 0) / input.pools.length;
  // Build a fake resilience state for resilienceScore
  const fakeResilienceState = {
    health: input.health,
    rateLimits: input.rateLimits,
    recovery: { recoveries: {}, config: { failureThreshold: 3, cooldownMs: 60_000, maxRecoveriesPerWindow: 5 } },
    metrics: input.metrics,
    config: { retry: { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 30000, multiplier: 2, jitterMs: 0, retryableStatuses: [], retryableCodes: [] }, maxRetries: 2 },
  };
  return {
    adapterHealth,
    rateEfficiency,
    quotaHeadroomById,
    eventStore: eventStoreHealth(input.eventStore),
    auditLog: auditLogHealth(input.auditLog),
    poolAvg,
    hookSystem: hookHealth(input.hooks),
    sharing: sharingEfficiency(input.sharing),
    resilience: resilienceScore(fakeResilienceState),
    registryCoverage: adapters.length / Math.max(1, Object.keys(input.registry.adapters).length),
  };
}

/** Master mastery score 0-1: density (avg), coherence (1-stddev), resonance (weighted sum). */
export function mastery(snap: MasterSnapshot): { score: number; density: number; coherence: number; resonance: number; adapt: "bootstrap" | "balance" | "activate" | "maintain" } {
  const values = [
    snap.eventStore,
    snap.auditLog,
    snap.poolAvg,
    snap.hookSystem,
    snap.sharing,
    snap.resilience,
    snap.registryCoverage,
  ];
  const adapterScores = Object.values(snap.adapterHealth);
  if (adapterScores.length > 0) values.push(adapterScores.reduce((a, b) => a + b, 0) / adapterScores.length);
  const rateScores = Object.values(snap.rateEfficiency);
  if (rateScores.length > 0) values.push(rateScores.reduce((a, b) => a + b, 0) / rateScores.length);
  const quotaScores = Object.values(snap.quotaHeadroomById);
  if (quotaScores.length > 0) values.push(quotaScores.reduce((a, b) => a + b, 0) / quotaScores.length);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  const density = mean;
  const coherence = 1 - stdDev;
  const resonance = snap.resilience * 0.3 + snap.eventStore * 0.15 + snap.auditLog * 0.1 + snap.poolAvg * 0.15 + snap.hookSystem * 0.1 + snap.sharing * 0.1 + snap.registryCoverage * 0.1;
  const score = density * 0.4 + coherence * 0.3 + resonance * 0.3;
  let adapt: "bootstrap" | "balance" | "activate" | "maintain";
  if (density < 0.3) adapt = "bootstrap";
  else if (coherence < 0.4) adapt = "balance";
  else if (density < 0.5) adapt = "activate";
  else adapt = "maintain";
  return { score, density, coherence, resonance, adapt };
}

/** Master orchestrator: pick the best action based on mastery. */
export function pickAction(snap: MasterSnapshot): { action: "expand" | "rebalance" | "scale-up" | "hold"; reason: string } {
  if (snap.resilience < 0.3) return { action: "rebalance", reason: "Low resilience" };
  if (snap.registryCoverage < 0.5) return { action: "expand", reason: "Low coverage" };
  if (snap.eventStore < 0.5) return { action: "scale-up", reason: "Event store stressed" };
  return { action: "hold", reason: "All systems nominal" };
}
