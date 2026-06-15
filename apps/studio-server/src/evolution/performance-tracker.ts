// V11 PerformanceTracker (Direction D 11/30, generic-agent)
// Per-agent success metrics with EWMA

export interface AgentMetric {
  agentId: string;
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  totalDurationMs: number;
  /** EWMA of success rate. */
  ewmaSuccess: number;
  /** EWMA of duration. */
  ewmaDurationMs: number;
  lastActiveAt: number | null;
}

export interface PerformanceTrackerState {
  metrics: Record<string, AgentMetric>;
  alpha: number;
}

export function createPerformanceTracker(alpha: number = 0.3): PerformanceTrackerState {
  return { metrics: {}, alpha };
}

function ensureMetric(state: PerformanceTrackerState, agentId: string): AgentMetric {
  return state.metrics[agentId] ?? { agentId, tasksAttempted: 0, tasksSucceeded: 0, tasksFailed: 0, totalDurationMs: 0, ewmaSuccess: 1, ewmaDurationMs: 0, lastActiveAt: null };
}

export function recordTask(state: PerformanceTrackerState, agentId: string, success: boolean, durationMs: number, now: number = Date.now()): PerformanceTrackerState {
  const cur = ensureMetric(state, agentId);
  const tasksAttempted = cur.tasksAttempted + 1;
  const tasksSucceeded = cur.tasksSucceeded + (success ? 1 : 0);
  const tasksFailed = cur.tasksFailed + (success ? 0 : 1);
  const totalDurationMs = cur.totalDurationMs + durationMs;
  const ewmaSuccess = cur.tasksAttempted === 0 ? (success ? 1 : 0) : cur.ewmaSuccess * (1 - state.alpha) + (success ? 1 : 0) * state.alpha;
  const ewmaDurationMs = cur.tasksAttempted === 0 ? durationMs : cur.ewmaDurationMs * (1 - state.alpha) + durationMs * state.alpha;
  const newMetric: AgentMetric = { agentId, tasksAttempted, tasksSucceeded, tasksFailed, totalDurationMs, ewmaSuccess, ewmaDurationMs, lastActiveAt: now };
  return { ...state, metrics: { ...state.metrics, [agentId]: newMetric } };
}

export function getMetric(state: PerformanceTrackerState, agentId: string): AgentMetric | undefined {
  return state.metrics[agentId];
}

export function listMetrics(state: PerformanceTrackerState): AgentMetric[] {
  return Object.values(state.metrics).sort((a, b) => b.ewmaSuccess - a.ewmaSuccess);
}

export function topPerformers(state: PerformanceTrackerState, n: number): AgentMetric[] {
  return listMetrics(state).slice(0, n);
}

export function underPerformers(state: PerformanceTrackerState, threshold: number = 0.5): AgentMetric[] {
  return Object.values(state.metrics).filter((m) => m.ewmaSuccess < threshold && m.tasksAttempted >= 3);
}

export function clearMetric(state: PerformanceTrackerState, agentId: string): PerformanceTrackerState {
  const { [agentId]: _, ...rest } = state.metrics;
  return { ...state, metrics: rest };
}

/** Master metric: system performance 0-1. */
export function systemPerformance(state: PerformanceTrackerState): number {
  const ms = Object.values(state.metrics);
  if (ms.length === 0) return 1.0;
  const avg = ms.reduce((a, m) => a + m.ewmaSuccess, 0) / ms.length;
  return avg;
}
