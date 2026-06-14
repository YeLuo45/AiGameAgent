// V27 AutoRecovery (Direction E 27/30, generic-agent)
// When a provider fails, automatically swap to fallback

import { type ChannelAdapter, type ChannelResponse } from "./channel-adapter.js";
import { type HealthCheckerState, getCircuitState, recordHealth } from "./health-checker.js";

export interface RecoveryConfig {
  /** Number of consecutive failures before triggering recovery. */
  failureThreshold: number;
  /** Cooldown after recovery before retrying primary. */
  cooldownMs: number;
  /** Max recoveries per primary per window. */
  maxRecoveriesPerWindow: number;
}

export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = { failureThreshold: 3, cooldownMs: 60_000, maxRecoveriesPerWindow: 5 };

export interface RecoveryEvent {
  ts: number;
  fromProvider: string;
  toProvider: string;
  reason: string;
}

export interface AutoRecoveryState {
  /** Per-primary recovery state. */
  recoveries: Record<string, { events: RecoveryEvent[]; lastRecoveryAt: number | null; currentFallback: string | null }>;
  config: RecoveryConfig;
}

export function createAutoRecovery(config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG): AutoRecoveryState {
  return { recoveries: {}, config };
}

function pruneOldEvents(events: RecoveryEvent[], now: number, windowMs: number = 3_600_000): RecoveryEvent[] {
  return events.filter((e) => now - e.ts < windowMs);
}

/** Decide whether to recover. Returns the fallback adapter id or null. */
export function shouldRecover(
  state: AutoRecoveryState,
  primary: ChannelAdapter,
  fallbackChain: ChannelAdapter[],
  health: HealthCheckerState,
  reason: string,
  now: number = Date.now(),
): { state: AutoRecoveryState; recovery: RecoveryEvent | null } {
  const rec = state.recoveries[primary.id] ?? { events: [], lastRecoveryAt: null, currentFallback: null };
  if (rec.lastRecoveryAt && now - rec.lastRecoveryAt < state.config.cooldownMs) {
    // Still in cooldown, continue using fallback if set
    return { state: { ...state, recoveries: { ...state.recoveries, [primary.id]: rec } }, recovery: null };
  }
  const recent = pruneOldEvents(rec.events, now);
  if (recent.length >= state.config.maxRecoveriesPerWindow) {
    return { state, recovery: null }; // hit the limit
  }
  // Circuit open? Trigger recovery
  if (getCircuitState(health, now) === "open") {
    // Find first healthy fallback
    for (const fb of fallbackChain) {
      if (fb.id === primary.id) continue;
      const recovery: RecoveryEvent = { ts: now, fromProvider: primary.id, toProvider: fb.id, reason };
      const updated = { events: [...recent, recovery], lastRecoveryAt: now, currentFallback: fb.id };
      return { state: { ...state, recoveries: { ...state.recoveries, [primary.id]: updated } }, recovery };
    }
  }
  return { state, recovery: null };
}

/** Mark that a recovery was used (for backoff tracking). */
export function confirmRecoveryUsed(state: AutoRecoveryState, primary: string): AutoRecoveryState {
  const rec = state.recoveries[primary];
  if (!rec) return state;
  return { ...state, recoveries: { ...state.recoveries, [primary]: { ...rec, lastRecoveryAt: Date.now() } } };
}

/** Clear recovery state. */
export function resetRecovery(state: AutoRecoveryState, primary?: string): AutoRecoveryState {
  if (primary) {
    const { [primary]: _, ...rest } = state.recoveries;
    return { ...state, recoveries: rest };
  }
  return { ...state, recoveries: {} };
}

export function currentFallback(state: AutoRecoveryState, primary: string): string | null {
  return state.recoveries[primary]?.currentFallback ?? null;
}

export function recoveryCount(state: AutoRecoveryState, primary: string, windowMs: number = 3_600_000, now: number = Date.now()): number {
  return pruneOldEvents(state.recoveries[primary]?.events ?? [], now, windowMs).length;
}

/** Master metric: recovery effectiveness 0-1. */
export function recoveryEffectiveness(state: AutoRecoveryState): number {
  const total = Object.values(state.recoveries);
  if (total.length === 0) return 1.0;
  const withFallback = total.filter((r) => r.currentFallback !== null).length;
  return withFallback / total.length;
}
