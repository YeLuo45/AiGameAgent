// V7 RateLimiter (Direction E 7/30, thunderbolt)
// Token bucket rate limiter per provider

export interface RateLimiterState {
  providerId: string;
  /** Current token count. */
  tokens: number;
  /** Maximum tokens (burst capacity). */
  capacity: number;
  /** Refill rate (tokens per second). */
  refillPerSec: number;
  /** Last refill timestamp (ms). */
  lastRefillAt: number;
  /** Total requests allowed. */
  totalAllowed: number;
  /** Total requests denied. */
  totalDenied: number;
}

export function createRateLimiter(providerId: string, capacity: number, refillPerSec: number): RateLimiterState {
  return {
    providerId,
    tokens: capacity,
    capacity,
    refillPerSec,
    lastRefillAt: Date.now(),
    totalAllowed: 0,
    totalDenied: 0,
  };
}

function refill(state: RateLimiterState, now: number): RateLimiterState {
  const elapsed = Math.max(0, (now - state.lastRefillAt) / 1000);
  const newTokens = Math.min(state.capacity, state.tokens + elapsed * state.refillPerSec);
  return { ...state, tokens: newTokens, lastRefillAt: now };
}

/** Try to acquire N tokens. Returns updated state + ok flag. */
export function tryAcquire(state: RateLimiterState, n: number = 1, now: number = Date.now()): { state: RateLimiterState; ok: boolean; retryAfterMs: number } {
  const refilled = refill(state, now);
  if (refilled.tokens >= n) {
    return { state: { ...refilled, tokens: refilled.tokens - n, totalAllowed: refilled.totalAllowed + n }, ok: true, retryAfterMs: 0 };
  }
  const deficit = n - refilled.tokens;
  const retryAfterMs = Math.ceil((deficit / refilled.refillPerSec) * 1000);
  return { state: { ...refilled, totalDenied: refilled.totalDenied + n }, ok: false, retryAfterMs };
}

/** Peek current available tokens without consuming. */
export function peekTokens(state: RateLimiterState, now: number = Date.now()): number {
  return refill(state, now).tokens;
}

/** Time until N tokens will be available. */
export function timeUntilAvailable(state: RateLimiterState, n: number, now: number = Date.now()): number {
  const refilled = refill(state, now);
  if (refilled.tokens >= n) return 0;
  const deficit = n - refilled.tokens;
  return Math.ceil((deficit / refilled.refillPerSec) * 1000);
}

/** Reset to full capacity. */
export function reset(state: RateLimiterState, now: number = Date.now()): RateLimiterState {
  return { ...state, tokens: state.capacity, lastRefillAt: now, totalAllowed: 0, totalDenied: 0 };
}

/** Deny ratio (0-1) over lifetime. */
export function denyRatio(state: RateLimiterState): number {
  const total = state.totalAllowed + state.totalDenied;
  if (total === 0) return 0;
  return state.totalDenied / total;
}

/** Master metric: rate limiter efficiency 0-1 (high = not throttled). */
export function rateLimiterEfficiency(state: RateLimiterState): number {
  const total = state.totalAllowed + state.totalDenied;
  if (total === 0) return 1.0;
  return state.totalAllowed / total;
}
