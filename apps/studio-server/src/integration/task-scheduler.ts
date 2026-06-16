// V29 TaskScheduler (Direction C 29/30, orchestrator)
// Queue + priority scheduler (composes with adaptive-schedule)

import { type ScheduledTask, type AdaptiveScheduleState, type TaskPriority, schedule, markStarted, markCompleted, nextBatch } from "./adaptive-schedule.js";

export interface ScheduledJob {
  id: string;
  priority: TaskPriority;
  payload: Record<string, unknown>;
  ts: number;
  /** Optional dependencies. */
  dependsOn: string[];
  /** Optional deadline (ms timestamp). */
  deadlineAt?: number;
}

export interface TaskSchedulerState {
  queue: ScheduledJob[];
  running: string[];
  completed: string[];
  maxConcurrent: number;
}

export function createTaskScheduler(maxConcurrent: number = 3): TaskSchedulerState {
  return { queue: [], running: [], completed: [], maxConcurrent };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { low: 0, normal: 1, high: 2, critical: 3 };

export function enqueue(state: TaskSchedulerState, job: ScheduledJob): TaskSchedulerState {
  return { ...state, queue: [...state.queue, job] };
}

export function nextJobs(state: TaskSchedulerState): ScheduledJob[] {
  const slots = state.maxConcurrent - state.running.length;
  if (slots <= 0) return [];
  const completed = new Set(state.completed);
  const candidates = state.queue.filter((j) => j.dependsOn.every((d) => completed.has(d)));
  candidates.sort((a, b) => {
    const dp = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (dp !== 0) return dp;
    // Earlier deadline first
    if (a.deadlineAt && b.deadlineAt) return a.deadlineAt - b.deadlineAt;
    if (a.deadlineAt) return -1;
    if (b.deadlineAt) return 1;
    return a.ts - b.ts;
  });
  return candidates.slice(0, slots);
}

export function startJob(state: TaskSchedulerState, id: string): TaskSchedulerState {
  return { ...state, queue: state.queue.filter((j) => j.id !== id), running: [...state.running, id] };
}

export function completeJob(state: TaskSchedulerState, id: string): TaskSchedulerState {
  return { ...state, running: state.running.filter((rid) => rid !== id), completed: [...state.completed, id] };
}

export function pendingJobs(state: TaskSchedulerState): ScheduledJob[] {
  return state.queue.filter((j) => !j.dependsOn.every((d) => state.completed.includes(d)));
}

export function jobStatus(state: TaskSchedulerState, id: string): "queued" | "running" | "completed" | "unknown" {
  if (state.running.includes(id)) return "running";
  if (state.completed.includes(id)) return "completed";
  if (state.queue.some((j) => j.id === id)) return "queued";
  return "unknown";
}

/** Master metric: scheduler throughput 0-1. */
export function schedulerThroughput(state: TaskSchedulerState): number {
  const total = state.completed.length + state.running.length + state.queue.length;
  if (total === 0) return 1.0;
  return state.completed.length / total;
}
