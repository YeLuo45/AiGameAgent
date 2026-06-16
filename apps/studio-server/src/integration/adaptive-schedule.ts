// V22 AdaptiveSchedule (Direction D 22/30, orchestrator)
// Auto-schedule based on load (priority + queue length)

export type TaskPriority = "low" | "normal" | "high" | "critical";

export interface ScheduledTask {
  id: string;
  priority: TaskPriority;
  estimatedDurationMs: number;
  ts: number;
  /** Optional dependencies. */
  dependsOn: string[];
}

export interface AdaptiveScheduleState {
  queue: ScheduledTask[];
  maxConcurrent: number;
  /** Currently running. */
  running: string[];
  /** Average duration EWMA. */
  avgDurationMs: number;
  /** Total scheduled. */
  totalScheduled: number;
  /** Total completed. */
  totalCompleted: number;
}

export function createScheduleState(maxConcurrent: number = 3): AdaptiveScheduleState {
  return { queue: [], maxConcurrent, running: [], avgDurationMs: 100, totalScheduled: 0, totalCompleted: 0 };
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  low: 1, normal: 2, high: 4, critical: 8,
};

export function schedule(state: AdaptiveScheduleState, task: ScheduledTask): AdaptiveScheduleState {
  return { ...state, queue: [...state.queue, task], totalScheduled: state.totalScheduled + 1 };
}

export function scheduleMany(state: AdaptiveScheduleState, tasks: ScheduledTask[]): AdaptiveScheduleState {
  return { ...state, queue: [...state.queue, ...tasks], totalScheduled: state.totalScheduled + tasks.length };
}

export function nextBatch(state: AdaptiveScheduleState, now: number = Date.now()): { state: AdaptiveScheduleState; next: ScheduledTask[] } {
  // Sort by priority desc, then by ts asc
  const sorted = [...state.queue].sort((a, b) => {
    const dp = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (dp !== 0) return dp;
    return a.ts - b.ts;
  });
  // Take up to maxConcurrent, respecting dependencies
  const next: ScheduledTask[] = [];
  const completedIds = new Set<string>();
  for (const t of sorted) {
    if (next.length >= state.maxConcurrent - state.running.length) break;
    if (t.dependsOn.every((d) => completedIds.has(d))) {
      next.push(t);
      completedIds.add(t.id);
    }
  }
  return { state, next };
}

export function markStarted(state: AdaptiveScheduleState, taskId: string): AdaptiveScheduleState {
  return { ...state, queue: state.queue.filter((t) => t.id !== taskId), running: [...state.running, taskId] };
}

export function markCompleted(state: AdaptiveScheduleState, taskId: string, durationMs: number): AdaptiveScheduleState {
  const newAvg = state.avgDurationMs * 0.7 + durationMs * 0.3;
  return { ...state, running: state.running.filter((id) => id !== taskId), totalCompleted: state.totalCompleted + 1, avgDurationMs: newAvg };
}

export function adjustMaxConcurrent(state: AdaptiveScheduleState, queueSize: number): AdaptiveScheduleState {
  // Scale max concurrent based on queue
  if (queueSize > state.maxConcurrent * 5) {
    return { ...state, maxConcurrent: Math.min(20, state.maxConcurrent + 2) };
  }
  if (queueSize < state.maxConcurrent && state.maxConcurrent > 1) {
    return { ...state, maxConcurrent: Math.max(1, state.maxConcurrent - 1) };
  }
  return state;
}

/** Master metric: schedule throughput 0-1. */
export function scheduleThroughput(state: AdaptiveScheduleState): number {
  if (state.totalScheduled === 0) return 1.0;
  return state.totalCompleted / state.totalScheduled;
}
