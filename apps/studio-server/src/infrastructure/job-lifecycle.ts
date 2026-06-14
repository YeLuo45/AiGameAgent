// V16 JobLifecycle (Direction E 16/30, ruflo)
// Job lifecycle state machine: queued → running → done/failed/cancelled

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobRecord {
  id: string;
  agentId: string;
  task: string;
  priority: number;
  status: JobStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  /** Failure reason if status === "failed". */
  failureReason?: string;
  /** Duration in ms when finished. */
  durationMs?: number;
}

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["done", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionJob(job: JobRecord, to: JobStatus, failureReason?: string): JobRecord {
  if (!canTransition(job.status, to)) {
    throw new Error(`Invalid transition: ${job.status} → ${to}`);
  }
  const now = Date.now();
  const updates: Partial<JobRecord> = { status: to };
  if (to === "running") updates.startedAt = now;
  if (to === "done" || to === "failed" || to === "cancelled") {
    updates.finishedAt = now;
    if (job.startedAt) updates.durationMs = now - job.startedAt;
  }
  if (to === "failed" && failureReason) updates.failureReason = failureReason;
  return { ...job, ...updates };
}

export function createJob(id: string, agentId: string, task: string, priority: number = 0): JobRecord {
  return { id, agentId, task, priority, status: "queued", createdAt: Date.now(), startedAt: null, finishedAt: null };
}

export function isTerminal(status: JobStatus): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}

export function isActive(status: JobStatus): boolean {
  return status === "queued" || status === "running";
}

/** Compute wait time in queue (ms from createdAt to startedAt). */
export function queueWaitMs(job: JobRecord): number {
  if (!job.startedAt) return Date.now() - job.createdAt;
  return job.startedAt - job.createdAt;
}

/** Master metric: lifecycle health 0-1 (success rate). */
export function lifecycleHealth(jobs: JobRecord[]): number {
  const finished = jobs.filter((j) => isTerminal(j.status));
  if (finished.length === 0) return 1.0;
  const success = finished.filter((j) => j.status === "done").length;
  return success / finished.length;
}
