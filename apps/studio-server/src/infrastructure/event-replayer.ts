// V12 EventReplayer (Direction E 12/30, nanobot)
// Replay historical events from a start position

import { type EventRecord, type EventStoreState, queryEvents } from "./event-store.js";

export interface ReplayCursor {
  /** Current event id. */
  currentId: number;
  /** Total events replayed so far. */
  replayed: number;
  /** When the replay started. */
  startedAt: number;
  /** When the last batch was emitted. */
  lastBatchAt: number | null;
  /** Whether the replay has reached the end. */
  done: boolean;
}

export interface ReplayBatch {
  cursor: ReplayCursor;
  events: EventRecord[];
}

export function startReplay(state: EventStoreState, fromId: number = 1): ReplayCursor {
  return { currentId: fromId - 1, replayed: 0, startedAt: Date.now(), lastBatchAt: null, done: false };
}

/** Emit a batch of events starting after the cursor's currentId. */
export function nextBatch(
  state: EventStoreState,
  cursor: ReplayCursor,
  batchSize: number = 50,
  filter: { type?: string; agentId?: string } = {},
): ReplayBatch {
  const events = queryEvents(state, { ...filter, fromId: cursor.currentId + 1 }, batchSize, 0);
  const next: ReplayCursor = {
    ...cursor,
    currentId: events.length > 0 ? events[events.length - 1].id : cursor.currentId,
    replayed: cursor.replayed + events.length,
    lastBatchAt: Date.now(),
    done: events.length < batchSize,
  };
  return { cursor: next, events };
}

/** Replay all events (with optional filter), returns them as a single batch. */
export function replayAll(
  state: EventStoreState,
  filter: { type?: string; agentId?: string } = {},
  limit: number = 10_000,
): ReplayBatch {
  const cursor: ReplayCursor = {
    currentId: 0,
    replayed: 0,
    startedAt: Date.now(),
    lastBatchAt: null,
    done: false,
  };
  const events = queryEvents(state, { ...filter, fromId: 1 }, limit, 0);
  return {
    cursor: {
      ...cursor,
      currentId: events.length > 0 ? events[events.length - 1].id : 0,
      replayed: events.length,
      lastBatchAt: Date.now(),
      done: true,
    },
    events,
  };
}

/** Resume from a stored cursor (for crash recovery). */
export function resumeFromCursor(state: EventStoreState, saved: ReplayCursor, batchSize: number = 50): ReplayBatch {
  return nextBatch(state, saved, batchSize);
}

/** Snapshot cursor for persistence. */
export function snapshotCursor(cursor: ReplayCursor): ReplayCursor {
  return { ...cursor };
}

/** Estimate total replay time (events / batch / per-batch-ms). */
export function estimateReplayDurationMs(state: EventStoreState, batchSize: number, msPerBatch: number = 10): number {
  const batches = Math.ceil(state.events.length / Math.max(1, batchSize));
  return batches * msPerBatch;
}

/** Master metric: replay progress 0-1. */
export function replayProgress(cursor: ReplayCursor, totalEvents: number): number {
  if (totalEvents === 0) return 1.0;
  return Math.max(0, Math.min(1, cursor.replayed / totalEvents));
}
