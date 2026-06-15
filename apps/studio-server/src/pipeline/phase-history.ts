// V6 PhaseHistory (Direction C 6/30, chatdev)
// Audit log of all phase transitions (append-only)

import type { Phase } from "./phase-engine.js";

export type HistoryEntryKind = "transition" | "output-set" | "gate-check" | "rollback" | "comment";

export interface HistoryEntry {
  id: number;
  ts: number;
  kind: HistoryEntryKind;
  phase?: Phase;
  /** Actor (user/agent). */
  actor: string;
  details: Record<string, unknown>;
}

export interface PhaseHistoryState {
  entries: HistoryEntry[];
  nextId: number;
}

export function createPhaseHistory(): PhaseHistoryState {
  return { entries: [], nextId: 1 };
}

export function recordEntry(state: PhaseHistoryState, kind: HistoryEntryKind, actor: string, details: Record<string, unknown> = {}, phase?: Phase): PhaseHistoryState {
  const entry: HistoryEntry = { id: state.nextId, ts: Date.now(), kind, actor, details };
  if (phase) entry.phase = phase;
  return { ...state, entries: [...state.entries, entry], nextId: state.nextId + 1 };
}

export function queryHistory(state: PhaseHistoryState, filter: { kind?: HistoryEntryKind; phase?: Phase; actor?: string; since?: number } = {}): HistoryEntry[] {
  let arr = state.entries;
  if (filter.kind) arr = arr.filter((e) => e.kind === filter.kind);
  if (filter.phase) arr = arr.filter((e) => e.phase === filter.phase);
  if (filter.actor) arr = arr.filter((e) => e.actor === filter.actor);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  return arr;
}

export function countByKind(state: PhaseHistoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

export function latestEntry(state: PhaseHistoryState): HistoryEntry | undefined {
  return state.entries[state.entries.length - 1];
}

/** Master metric: history density 0-1. */
export function historyDensity(state: PhaseHistoryState): number {
  if (state.entries.length === 0) return 0;
  return Math.min(1, state.entries.length / 50);
}
