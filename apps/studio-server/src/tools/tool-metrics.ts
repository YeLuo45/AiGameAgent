// V26 ToolMetrics (Direction B 26/30, generic-agent)
// Per-tool execution metrics

export interface ToolStat {
  toolName: string;
  invocations: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  avgDurationMs: number;
  /** EWMA of duration. */
  ewmaDurationMs: number;
  /** EWMA of success (0-1). */
  successRate: number;
  /** Last invocation time. */
  lastInvokedAt: number | null;
  /** Last error. */
  lastError: string | null;
}

export interface ToolMetricsState {
  stats: Record<string, ToolStat>;
  /** EWMA decay factor. */
  alpha: number;
  /** Max stats to keep. */
  maxStats: number;
}

export function createToolMetrics(alpha: number = 0.3, maxStats: number = 1000): ToolMetricsState {
  return { stats: {}, alpha, maxStats };
}

function ensureStat(state: ToolMetricsState, toolName: string): ToolStat {
  return state.stats[toolName] ?? { toolName, invocations: 0, successes: 0, failures: 0, totalDurationMs: 0, avgDurationMs: 0, ewmaDurationMs: 0, successRate: 1, lastInvokedAt: null, lastError: null };
}

export function recordInvocation(state: ToolMetricsState, toolName: string, success: boolean, durationMs: number, error?: string, now: number = Date.now()): ToolMetricsState {
  const cur = ensureStat(state, toolName);
  const invocations = cur.invocations + 1;
  const successes = success ? cur.successes + 1 : cur.successes;
  const failures = success ? cur.failures : cur.failures + 1;
  const totalDurationMs = cur.totalDurationMs + durationMs;
  const avgDurationMs = totalDurationMs / invocations;
  const ewmaDurationMs = cur.invocations === 0 ? durationMs : cur.ewmaDurationMs * (1 - state.alpha) + durationMs * state.alpha;
  const successRate = cur.invocations === 0 ? (success ? 1 : 0) : cur.successRate * (1 - state.alpha) + (success ? 1 : 0) * state.alpha;
  const newStat: ToolStat = {
    toolName,
    invocations,
    successes,
    failures,
    totalDurationMs,
    avgDurationMs,
    ewmaDurationMs,
    successRate,
    lastInvokedAt: now,
    lastError: success ? cur.lastError : (error ?? null),
  };
  return { ...state, stats: { ...state.stats, [toolName]: newStat } };
}

export function getStat(state: ToolMetricsState, toolName: string): ToolStat | undefined {
  return state.stats[toolName];
}

export function listStats(state: ToolMetricsState): ToolStat[] {
  return Object.values(state.stats).sort((a, b) => b.invocations - a.invocations);
}

export function clearStats(state: ToolMetricsState): ToolMetricsState {
  return { ...state, stats: {} };
}

export function topByInvocations(state: ToolMetricsState, n: number): ToolStat[] {
  return listStats(state).slice(0, n);
}

export function slowestTools(state: ToolMetricsState, n: number): ToolStat[] {
  return [...listStats(state)].sort((a, b) => b.ewmaDurationMs - a.ewmaDurationMs).slice(0, n);
}

/** Master metric: tool ecosystem health 0-1. */
export function toolEcosystemHealth(state: ToolMetricsState): number {
  const stats = Object.values(state.stats);
  if (stats.length === 0) return 1.0;
  const avgSuccess = stats.reduce((a, s) => a + s.successRate, 0) / stats.length;
  return avgSuccess;
}
