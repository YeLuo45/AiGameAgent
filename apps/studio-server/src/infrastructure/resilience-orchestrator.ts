// V29 StudioResilienceOrchestrator (Direction E 29/30, orchestrator)
// Integration: combines Health + RateLimit + Retry + AutoRecovery into one orchestrator

import { type HealthCheckerState, createHealthState, getCircuitState, recordHealth } from "./health-checker.js";
import { type RateLimiterState, tryAcquire } from "./rate-limiter.js";
import { DEFAULT_RETRY_POLICY, shouldRetry as retryShouldRetry, type RetryPolicyConfig } from "./retry-policy.js";
import { type AutoRecoveryState, shouldRecover as autoShouldRecover } from "./auto-recovery.js";
import { type ChannelAdapter } from "./channel-adapter.js";

export interface OrchestratorConfig {
  retry: RetryPolicyConfig;
  /** Max retries per request before giving up. */
  maxRetries: number;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = { retry: DEFAULT_RETRY_POLICY, maxRetries: 2 };

export interface ResilienceMetrics {
  totalAttempts: number;
  totalSuccess: number;
  totalFailed: number;
  totalRecoveries: number;
  totalRateLimited: number;
}

export interface StudioResilienceState {
  health: Record<string, HealthCheckerState>;
  rateLimits: Record<string, RateLimiterState>;
  recovery: AutoRecoveryState;
  metrics: ResilienceMetrics;
  config: OrchestratorConfig;
}

export function createResilienceState(
  adapters: ChannelAdapter[],
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
): StudioResilienceState {
  const health: Record<string, HealthCheckerState> = {};
  const rateLimits: Record<string, RateLimiterState> = {};
  for (const a of adapters) {
    health[a.id] = createHealthState(a.id);
    rateLimits[a.id] = { providerId: a.id, tokens: 10, capacity: 10, refillPerSec: 1, lastRefillAt: Date.now(), totalAllowed: 0, totalDenied: 0 };
  }
  return {
    health,
    rateLimits,
    recovery: { recoveries: {}, config: { failureThreshold: 3, cooldownMs: 60_000, maxRecoveriesPerWindow: 5 } },
    metrics: { totalAttempts: 0, totalSuccess: 0, totalFailed: 0, totalRecoveries: 0, totalRateLimited: 0 },
    config,
  };
}

export interface CheckRequestInput {
  providerId: string;
  estimatedTokens?: number;
}

export interface CheckRequestResult {
  allowed: boolean;
  retryAfterMs: number;
  reason: "ok" | "rate-limited" | "circuit-open" | "no-budget";
}

export function checkRequest(state: StudioResilienceState, input: CheckRequestInput, now: number = Date.now()): CheckRequestResult {
  const health = state.health[input.providerId];
  const circuitOpen = health ? getCircuitState(health, now) === "open" : false;
  if (circuitOpen) {
    // Use config retry maxDelayMs as a fallback retry-after
    return { allowed: false, retryAfterMs: state.config.retry.maxDelayMs, reason: "circuit-open" };
  }
  const rl = tryAcquire(state.rateLimits[input.providerId] ?? createDefaultRateLimit(input.providerId), input.estimatedTokens ?? 1, now);
  state.rateLimits[input.providerId] = rl.state;
  if (!rl.ok) {
    state.metrics.totalRateLimited++;
    return { allowed: false, retryAfterMs: rl.retryAfterMs, reason: "rate-limited" };
  }
  return { allowed: true, retryAfterMs: 0, reason: "ok" };
}

function createDefaultRateLimit(providerId: string): RateLimiterState {
  return { providerId, tokens: 10, capacity: 10, refillPerSec: 1, lastRefillAt: Date.now(), totalAllowed: 0, totalDenied: 0 };
}

export function recordAttempt(state: StudioResilienceState, providerId: string, success: boolean, now: number = Date.now()): StudioResilienceState {
  const h = state.health[providerId] ?? createHealthState(providerId);
  state.health[providerId] = { ...h, ...recordHealth(h, success, null) };
  state.metrics = { ...state.metrics, totalAttempts: state.metrics.totalAttempts + 1, totalSuccess: state.metrics.totalSuccess + (success ? 1 : 0), totalFailed: state.metrics.totalFailed + (success ? 0 : 1) };
  return state;
}

export function maybeRecover(
  state: StudioResilienceState,
  primary: ChannelAdapter,
  fallbackChain: ChannelAdapter[],
  reason: string,
  now: number = Date.now(),
): StudioResilienceState {
  const h = state.health[primary.id];
  if (!h) return state;
  const r = autoShouldRecover(state.recovery, primary, fallbackChain, h, reason, now);
  if (r.recovery) {
    state.recovery = r.state;
    state.metrics = { ...state.metrics, totalRecoveries: state.metrics.totalRecoveries + 1 };
  }
  return state;
}

export function shouldRetryAttempt(state: StudioResilienceState, attempt: number, error: { status?: number; code?: string } | null): boolean {
  return retryShouldRetry(state.config.retry, attempt, error) === "retry";
}

/** Master metric: resilience score 0-1. */
export function resilienceScore(state: StudioResilienceState): number {
  if (state.metrics.totalAttempts === 0) return 1.0;
  const successRate = state.metrics.totalSuccess / state.metrics.totalAttempts;
  const recoveryPenalty = Math.min(0.3, state.metrics.totalRecoveries * 0.05);
  const rateLimitPenalty = Math.min(0.2, state.metrics.totalRateLimited * 0.01);
  return Math.max(0, Math.min(1, successRate - recoveryPenalty - rateLimitPenalty));
}
