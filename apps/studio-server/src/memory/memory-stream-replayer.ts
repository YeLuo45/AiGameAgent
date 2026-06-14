// V14 MemoryStreamReplayer (Direction A 14/30, ruflo)
// Stream memory mutations as a log for replay

export interface MemoryEvent {
  id: number;
  ts: number;
  layer: "L0" | "L1" | "L2" | "L3" | "L4";
  op: "append" | "update" | "delete" | "clear" | "consolidate";
  /** Target id (entry id, charter version, etc.). */
  targetId: string;
  /** User who triggered. */
  actor: string;
  /** Optional data. */
  data?: Record<string, unknown>;
}

export interface MemoryStreamReplayState {
  events: MemoryEvent[];
  nextId: number;
  /** Subscribers. */
  subscribers: string[];
}

export function createMemoryStreamReplay(): MemoryStreamReplayState {
  return { events: [], nextId: 1, subscribers: [] };
}

export function recordMemoryEvent(state: MemoryStreamReplayState, ev: Omit<MemoryEvent, "id" | "ts">): MemoryStreamReplayState {
  const full: MemoryEvent = { ...ev, id: state.nextId, ts: Date.now() };
  return { ...state, events: [...state.events, full], nextId: state.nextId + 1 };
}

export function queryMemoryEvents(state: MemoryStreamReplayState, filter: { layer?: MemoryEvent["layer"]; op?: MemoryEvent["op"]; actor?: string; since?: number } = {}): MemoryEvent[] {
  let arr = state.events;
  if (filter.layer) arr = arr.filter((e) => e.layer === filter.layer);
  if (filter.op) arr = arr.filter((e) => e.op === filter.op);
  if (filter.actor) arr = arr.filter((e) => e.actor === filter.actor);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  return arr;
}

export function subscribeMemoryEvents(state: MemoryStreamReplayState, id: string): MemoryStreamReplayState {
  if (state.subscribers.includes(id)) return state;
  return { ...state, subscribers: [...state.subscribers, id] };
}

export function unsubscribeMemoryEvents(state: MemoryStreamReplayState, id: string): MemoryStreamReplayState {
  return { ...state, subscribers: state.subscribers.filter((s) => s !== id) };
}

export function countByLayer(state: MemoryStreamReplayState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.events) out[e.layer] = (out[e.layer] ?? 0) + 1;
  return out;
}

export function countByOp(state: MemoryStreamReplayState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.events) out[e.op] = (out[e.op] ?? 0) + 1;
  return out;
}

/** Master metric: stream activity 0-1. */
export function streamActivity(state: MemoryStreamReplayState): number {
  if (state.events.length === 0) return 0;
  return Math.min(1, state.events.length / 100) * (1 + state.subscribers.length * 0.1);
}
