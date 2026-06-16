// V23 RateLimit (Direction G 23/30, orchestrator)
// Per-key request rate limit (sliding window)

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitState {
  config: RateLimitConfig;
  /** key → array of request timestamps. */
  windows: Record<string, number[]>;
}

export function createRateLimit(config: RateLimitConfig): RateLimitState {
  return { config, windows: {} };
}

export function checkLimit(state: RateLimitState, key: string, now: number = Date.now()): { state: RateLimitState; allowed: boolean; remaining: number; resetAt: number } {
  const cutoff = now - state.config.windowMs;
  const arr = (state.windows[key] ?? []).filter((t) => t > cutoff);
  if (arr.length < state.config.maxRequests) {
    arr.push(now);
    const nextState: RateLimitState = { ...state, windows: { ...state.windows, [key]: arr } };
    return { state: nextState, allowed: true, remaining: state.config.maxRequests - arr.length, resetAt: now + state.config.windowMs };
  }
  return { state, allowed: false, remaining: 0, resetAt: arr[0] + state.config.windowMs };
}

export function recordRequest(state: RateLimitState, key: string, now: number = Date.now()): RateLimitState {
  const arr = state.windows[key] ?? [];
  return { ...state, windows: { ...state.windows, [key]: [...arr, now] } };
}

export function clearKey(state: RateLimitState, key: string): RateLimitState {
  const { [key]: _, ...rest } = state.windows;
  return { ...state, windows: rest };
}

export function clearAll(state: RateLimitState): RateLimitState {
  return { ...state, windows: {} };
}

/** Master metric: rate limit fairness 0-1. */
export function rateLimitFairness(state: RateLimitState): number {
  const keys = Object.keys(state.windows);
  if (keys.length === 0) return 1.0;
  const usage = keys.map((k) => state.windows[k].length);
  const mean = usage.reduce((a, b) => a + b, 0) / usage.length;
  const max = Math.max(...usage);
  return 1 - (max - mean) / Math.max(1, max);
}
