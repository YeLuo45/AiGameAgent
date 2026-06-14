// V6 HealthChecker (Direction E 6/30, thunderbolt)
// Circuit breaker + first-chunk latency tracker

export type CircuitState = "closed" | "open" | "half-open";

export interface HealthCheckRecord {
  ts: number;
  ok: boolean;
  firstChunkMs: number | null;
  error?: string;
}

export interface HealthCheckerState {
  /** Provider id. */
  providerId: string;
  /** Last N health records (sliding window). */
  history: HealthCheckRecord[];
  /** Max history records. */
  maxHistory: number;
  /** Number of consecutive failures before opening circuit. */
  failureThreshold: number;
  /** How long to wait (ms) before transitioning to half-open. */
  openCooldownMs: number;
  /** When the circuit was opened (null = closed). */
  openedAt: number | null;
  /** Last successful health check. */
  lastOkAt: number | null;
  /** Last first-chunk latency (ms) when healthy. */
  lastFirstChunkMs: number | null;
}

export function createHealthState(providerId: string, opts: Partial<Pick<HealthCheckerState, "maxHistory" | "failureThreshold" | "openCooldownMs">> = {}): HealthCheckerState {
  return {
    providerId,
    history: [],
    maxHistory: opts.maxHistory ?? 20,
    failureThreshold: opts.failureThreshold ?? 3,
    openCooldownMs: opts.openCooldownMs ?? 30_000,
    openedAt: null,
    lastOkAt: null,
    lastFirstChunkMs: null,
  };
}

export function recordHealth(state: HealthCheckerState, ok: boolean, firstChunkMs: number | null, error?: string): HealthCheckerState {
  const record: HealthCheckRecord = { ts: Date.now(), ok, firstChunkMs };
  if (!ok && error) record.error = error;
  const history = [...state.history, record];
  if (history.length > state.maxHistory) history.shift();
  const openedAt = !ok && !state.openedAt && countConsecutiveFailures(history) >= state.failureThreshold
    ? Date.now()
    : ok
      ? null
      : state.openedAt;
  return {
    ...state,
    history,
    openedAt,
    lastOkAt: ok ? Date.now() : state.lastOkAt,
    lastFirstChunkMs: ok && firstChunkMs !== null ? firstChunkMs : state.lastFirstChunkMs,
  };
}

function countConsecutiveFailures(history: HealthCheckRecord[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].ok) n++;
    else break;
  }
  return n;
}

export function getCircuitState(state: HealthCheckerState, now: number = Date.now()): CircuitState {
  if (!state.openedAt) return "closed";
  if (now - state.openedAt >= state.openCooldownMs) return "half-open";
  return "open";
}

export function shouldProbe(state: HealthCheckerState, now: number = Date.now()): boolean {
  const c = getCircuitState(state, now);
  return c === "closed" || c === "half-open";
}

/** Manual reset to closed. */
export function resetCircuit(state: HealthCheckerState): HealthCheckerState {
  return { ...state, openedAt: null };
}

/** Get average first-chunk latency over recent successful checks. */
export function avgFirstChunkMs(state: HealthCheckerState): number | null {
  const okRecs = state.history.filter((r) => r.ok && r.firstChunkMs !== null);
  if (okRecs.length === 0) return null;
  const sum = okRecs.reduce((acc, r) => acc + (r.firstChunkMs ?? 0), 0);
  return Math.round(sum / okRecs.length);
}

/** Get failure rate (0-1) over the recent window. */
export function failureRate(state: HealthCheckerState): number {
  if (state.history.length === 0) return 0;
  const fails = state.history.filter((r) => !r.ok).length;
  return fails / state.history.length;
}

/** Master metric: composite health score 0-1. */
export function healthScore(state: HealthCheckerState, now: number = Date.now()): number {
  const cs = getCircuitState(state, now);
  if (cs === "open") return 0;
  let score = 1.0 - failureRate(state);
  const avg = avgFirstChunkMs(state);
  if (avg !== null) {
    if (avg < 200) score += 0.1;
    else if (avg < 1000) score += 0.05;
    else if (avg > 5000) score -= 0.2;
  }
  if (cs === "half-open") score *= 0.5;
  return Math.max(0, Math.min(1, score));
}
