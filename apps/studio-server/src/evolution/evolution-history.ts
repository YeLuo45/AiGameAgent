// V17 EvolutionHistory (Direction D 17/30, generic-agent)
// Track all evolutions (immutable audit trail)

export type EvolutionKind = "improvement-applied" | "param-tuned" | "skill-added" | "skill-removed" | "model-swapped" | "rollback";

export interface EvolutionEntry {
  id: number;
  ts: number;
  kind: EvolutionKind;
  /** Target of evolution. */
  target: string;
  /** Before/after values. */
  before?: unknown;
  after?: unknown;
  /** Reason. */
  reason: string;
  /** Who triggered. */
  actor: string;
  /** Confidence 0-1. */
  confidence: number;
}

export interface EvolutionHistoryState {
  entries: EvolutionEntry[];
  nextId: number;
  /** Index by kind for fast lookup. */
  byKind: Record<EvolutionKind, number[]>;
}

export function createEvolutionHistory(): EvolutionHistoryState {
  return { entries: [], nextId: 1, byKind: {} as Record<EvolutionKind, number[]> };
}

export function recordEvolution(state: EvolutionHistoryState, kind: EvolutionKind, target: string, actor: string, reason: string, confidence: number = 0.8, before?: unknown, after?: unknown): EvolutionHistoryState {
  const entry: EvolutionEntry = { id: state.nextId, ts: Date.now(), kind, target, actor, reason, confidence };
  if (before !== undefined) entry.before = before;
  if (after !== undefined) entry.after = after;
  const byKind = { ...state.byKind, [kind]: [...(state.byKind[kind] ?? []), state.nextId] };
  return { ...state, entries: [...state.entries, entry], nextId: state.nextId + 1, byKind };
}

export function queryEvolution(state: EvolutionHistoryState, filter: { kind?: EvolutionKind; target?: string; since?: number; actor?: string } = {}): EvolutionEntry[] {
  let arr = state.entries;
  if (filter.kind) arr = arr.filter((e) => e.kind === filter.kind);
  if (filter.target) arr = arr.filter((e) => e.target === filter.target);
  if (filter.actor) arr = arr.filter((e) => e.actor === filter.actor);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  return arr;
}

export function latestEvolution(state: EvolutionHistoryState, target?: string): EvolutionEntry | undefined {
  let arr = state.entries;
  if (target) arr = arr.filter((e) => e.target === target);
  return arr[arr.length - 1];
}

export function countByKind(state: EvolutionHistoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

export function rollbackTo(state: EvolutionHistoryState, entryId: number): EvolutionHistoryState {
  const idx = state.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) return state;
  const target = state.entries[idx];
  const newEntry: EvolutionEntry = { id: state.nextId, ts: Date.now(), kind: "rollback", target: target.target, actor: "system", reason: `rollback to #${entryId}`, confidence: 1, after: target.before };
  return { ...state, entries: [...state.entries, newEntry], nextId: state.nextId + 1 };
}

/** Master metric: evolution velocity (changes per hour). */
export function evolutionVelocity(state: EvolutionHistoryState): number {
  if (state.entries.length < 2) return 0;
  const sorted = [...state.entries].sort((a, b) => a.ts - b.ts);
  const spanMs = sorted[sorted.length - 1].ts - sorted[0].ts;
  if (spanMs <= 0) return 0;
  return (state.entries.length - 1) / (spanMs / 3_600_000);
}
