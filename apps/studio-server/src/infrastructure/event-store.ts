// V10 EventStore (Direction E 10/30, nanobot)
// In-memory event log with query support (SQLite-backed interface, but pure for testing)

export interface EventRecord {
  id: number;
  ts: string; // ISO-8601
  type: string;
  sessionId: string;
  correlationId: string;
  agentId?: string;
  payload: Record<string, unknown>;
}

export interface EventStoreState {
  events: EventRecord[];
  nextId: number;
  /** Cap on stored events (oldest evicted). */
  maxEvents: number;
}

export function createEventStore(maxEvents: number = 10_000): EventStoreState {
  return { events: [], nextId: 1, maxEvents };
}

export function appendEvent(state: EventStoreState, ev: Omit<EventRecord, "id">): { state: EventStoreState; record: EventRecord } {
  const record: EventRecord = { ...ev, id: state.nextId };
  const events = [...state.events, record];
  if (events.length > state.maxEvents) events.shift();
  return { state: { ...state, events, nextId: state.nextId + 1 }, record };
}

export function queryEvents(
  state: EventStoreState,
  filter: { type?: string; agentId?: string; sessionId?: string; fromId?: number; toId?: number; since?: string; until?: string } = {},
  limit: number = 100,
  offset: number = 0,
): EventRecord[] {
  let arr = state.events;
  if (filter.type) arr = arr.filter((e) => e.type === filter.type);
  if (filter.agentId) arr = arr.filter((e) => e.agentId === filter.agentId);
  if (filter.sessionId) arr = arr.filter((e) => e.sessionId === filter.sessionId);
  if (filter.fromId !== undefined) arr = arr.filter((e) => e.id >= filter.fromId!);
  if (filter.toId !== undefined) arr = arr.filter((e) => e.id <= filter.toId!);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  if (filter.until) arr = arr.filter((e) => e.ts <= filter.until!);
  return arr.slice(offset, offset + limit);
}

export function countEvents(state: EventStoreState, filter: { type?: string; agentId?: string; sessionId?: string } = {}): number {
  return queryEvents(state, filter, state.events.length + 1, 0).length;
}

export function getEvent(state: EventStoreState, id: number): EventRecord | undefined {
  return state.events.find((e) => e.id === id);
}

export function getLatestEvent(state: EventStoreState, filter: { type?: string; agentId?: string } = {}): EventRecord | undefined {
  const filtered = queryEvents(state, filter, state.events.length + 1, 0);
  return filtered[filtered.length - 1];
}

export function getEarliestEvent(state: EventStoreState): EventRecord | undefined {
  return state.events[0];
}

export function deleteEventsBefore(state: EventStoreState, beforeId: number): EventStoreState {
  return { ...state, events: state.events.filter((e) => e.id >= beforeId) };
}

/** Aggregate event counts by type. */
export function countByType(state: EventStoreState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.events) out[e.type] = (out[e.type] ?? 0) + 1;
  return out;
}

/** Master metric: event store health 0-1. */
export function eventStoreHealth(state: EventStoreState): number {
  if (state.maxEvents === 0) return 0;
  const utilization = state.events.length / state.maxEvents;
  // Healthy: 10-80% utilization, with some recent events
  let score = 1.0;
  if (utilization > 0.9) score -= 0.3;
  if (utilization < 0.01 && state.events.length > 0) score -= 0.2;
  if (state.events.length > 0) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
