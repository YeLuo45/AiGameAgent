// V11 EventIndexer (Direction E 11/30, nanobot)
// Secondary index over event store for fast lookup by common keys

import { type EventRecord, type EventStoreState, queryEvents } from "./event-store.js";

export interface EventIndex {
  /** type → Set<eventId> */
  byType: Record<string, Set<number>>;
  /** agentId → Set<eventId> */
  byAgent: Record<string, Set<number>>;
  /** sessionId → Set<eventId> */
  bySession: Record<string, Set<number>>;
}

export function createEventIndex(): EventIndex {
  return { byType: {}, byAgent: {}, bySession: {} };
}

export function indexEvent(idx: EventIndex, ev: EventRecord): EventIndex {
  const byType = { ...idx.byType };
  if (!byType[ev.type]) byType[ev.type] = new Set();
  byType[ev.type].add(ev.id);
  const byAgent = { ...idx.byAgent };
  if (ev.agentId) {
    if (!byAgent[ev.agentId]) byAgent[ev.agentId] = new Set();
    byAgent[ev.agentId].add(ev.id);
  }
  const bySession = { ...idx.bySession };
  if (!bySession[ev.sessionId]) bySession[ev.sessionId] = new Set();
  bySession[ev.sessionId].add(ev.id);
  return { byType, byAgent, bySession };
}

export function rebuildIndex(state: EventStoreState): EventIndex {
  let idx = createEventIndex();
  for (const e of state.events) idx = indexEvent(idx, e);
  return idx;
}

export function countByTypeFromIndex(idx: EventIndex): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [t, ids] of Object.entries(idx.byType)) out[t] = ids.size;
  return out;
}

export function countByAgentFromIndex(idx: EventIndex): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [a, ids] of Object.entries(idx.byAgent)) out[a] = ids.size;
  return out;
}

export function distinctAgents(idx: EventIndex): string[] {
  return Object.keys(idx.byAgent).sort();
}

export function distinctTypes(idx: EventIndex): string[] {
  return Object.keys(idx.byType).sort();
}

export function distinctSessions(idx: EventIndex): string[] {
  return Object.keys(idx.bySession).sort();
}

/** Get event ids for a type. */
export function eventIdsByType(idx: EventIndex, type: string): number[] {
  return Array.from(idx.byType[type] ?? []).sort((a, b) => a - b);
}

/** Get event ids for an agent. */
export function eventIdsByAgent(idx: EventIndex, agentId: string): number[] {
  return Array.from(idx.byAgent[agentId] ?? []).sort((a, b) => a - b);
}

/** Master metric: index coverage 0-1. */
export function indexCoverage(idx: EventIndex, state: EventStoreState): number {
  if (state.events.length === 0) return 1.0;
  let indexed = 0;
  for (const e of state.events) {
    if (idx.byType[e.type]?.has(e.id)) indexed++;
    if (e.agentId && !idx.byAgent[e.agentId]?.has(e.id)) indexed--;
    if (!idx.bySession[e.sessionId]?.has(e.id)) indexed--;
  }
  return Math.max(0, Math.min(1, indexed / state.events.length));
}

/** Indexed query: use index for type/agent/session, then filter. */
export function indexedQuery(
  state: EventStoreState,
  idx: EventIndex,
  filter: { type?: string; agentId?: string; sessionId?: string },
  limit: number = 100,
  offset: number = 0,
): EventRecord[] {
  // Use index for single-key fast path
  let candidateIds: Set<number> | null = null;
  if (filter.type) candidateIds = idx.byType[filter.type] ?? new Set();
  if (filter.agentId) {
    const a = idx.byAgent[filter.agentId] ?? new Set();
    candidateIds = candidateIds ? new Set([...candidateIds].filter((x) => a.has(x))) : a;
  }
  if (filter.sessionId) {
    const s = idx.bySession[filter.sessionId] ?? new Set();
    candidateIds = candidateIds ? new Set([...candidateIds].filter((x) => s.has(x))) : s;
  }
  let candidates: EventRecord[];
  if (candidateIds === null) {
    return queryEvents(state, filter, limit, offset);
  }
  const idSet = candidateIds;
  candidates = state.events.filter((e) => idSet.has(e.id));
  return candidates.slice(offset, offset + limit);
}
