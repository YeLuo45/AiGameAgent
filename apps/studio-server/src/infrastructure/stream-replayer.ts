// V13 StreamReplayer (Direction E 13/30, nanobot)
// Live stream of events from a position, similar to tail -f

import { type EventRecord, type EventStoreState, queryEvents } from "./event-store.js";
import { type ReplayCursor, startReplay, nextBatch } from "./event-replayer.js";

export interface StreamReplayerState {
  cursor: ReplayCursor;
  /** Subscribers (callback ids). */
  subscribers: Map<string, StreamSubscriber>;
  /** Total events emitted to all subscribers. */
  totalEmitted: number;
}

export interface StreamSubscriber {
  id: string;
  filter: { type?: string; agentId?: string };
  /** Last seen event id. */
  lastSeenId: number;
  /** Optional callback (would be set in real impl; not invoked in pure tests). */
  onEvent?: (ev: EventRecord) => void;
}

export function createStreamReplayer(startFromId: number = 0): StreamReplayerState {
  return {
    cursor: startReplay(createEmptyStore(), startFromId),
    subscribers: new Map(),
    totalEmitted: 0,
  };
}

function createEmptyStore(): EventStoreState {
  return { events: [], nextId: 1, maxEvents: 10_000 };
}

export function subscribe(state: StreamReplayerState, id: string, filter: { type?: string; agentId?: string } = {}): StreamReplayerState {
  const sub: StreamSubscriber = { id, filter, lastSeenId: state.cursor.currentId };
  const subscribers = new Map(state.subscribers);
  subscribers.set(id, sub);
  return { ...state, subscribers };
}

export function unsubscribe(state: StreamReplayerState, id: string): StreamReplayerState {
  const subscribers = new Map(state.subscribers);
  subscribers.delete(id);
  return { ...state, subscribers };
}

/** Advance the replayer: fetch new events from the store and return them per subscriber. */
export function advance(
  replayer: StreamReplayerState,
  store: EventStoreState,
  batchSize: number = 50,
): { replayer: StreamReplayerState; emitted: Map<string, EventRecord[]> } {
  const r = nextBatch(store, replayer.cursor, batchSize);
  const emitted = new Map<string, EventRecord[]>();
  for (const [id, sub] of replayer.subscribers) {
    const newEvents = r.events.filter((e) => e.id > sub.lastSeenId);
    const filtered = newEvents.filter((e) => {
      if (sub.filter.type && e.type !== sub.filter.type) return false;
      if (sub.filter.agentId && e.agentId !== sub.filter.agentId) return false;
      return true;
    });
    if (filtered.length > 0) {
      emitted.set(id, filtered);
      sub.lastSeenId = filtered[filtered.length - 1].id;
    } else {
      emitted.set(id, []);
    }
  }
  return {
    replayer: { ...replayer, cursor: r.cursor, totalEmitted: replayer.totalEmitted + r.events.length },
    emitted,
  };
}

export function subscriberCount(state: StreamReplayerState): number {
  return state.subscribers.size;
}

export function getSubscriber(state: StreamReplayerState, id: string): StreamSubscriber | undefined {
  return state.subscribers.get(id);
}

/** Master metric: replayer health 0-1. */
export function streamHealth(state: StreamReplayerState): number {
  if (state.subscribers.size === 0) return 0.5; // idle
  let score = 0.5;
  score += Math.min(0.4, state.subscribers.size * 0.1);
  if (state.totalEmitted > 0) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
