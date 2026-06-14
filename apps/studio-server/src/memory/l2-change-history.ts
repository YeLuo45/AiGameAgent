// V3 L2ChangeHistory (Direction A 3/30, thunderbolt)
// L2 = charter change history (append-only)

export type ChangeKind = "goal_changed" | "milestones_changed" | "nodes_changed" | "rollback" | "comment";

export interface ChangeRecord {
  id: number;
  ts: number;
  kind: ChangeKind;
  fromVersion: number | null;
  toVersion: number | null;
  /** User comment. */
  comment?: string;
  /** Affected items. */
  affected: string[];
}

export interface L2ChangeHistoryState {
  records: ChangeRecord[];
  nextId: number;
}

export function createL2ChangeHistory(): L2ChangeHistoryState {
  return { records: [], nextId: 1 };
}

export function appendChange(state: L2ChangeHistoryState, kind: ChangeKind, fromVersion: number | null, toVersion: number | null, affected: string[], comment?: string): L2ChangeHistoryState {
  const rec: ChangeRecord = { id: state.nextId, ts: Date.now(), kind, fromVersion, toVersion, affected };
  if (comment) rec.comment = comment;
  return { ...state, records: [...state.records, rec], nextId: state.nextId + 1 };
}

export function queryChanges(state: L2ChangeHistoryState, filter: { kind?: ChangeKind; fromVersion?: number; toVersion?: number; since?: number; until?: number } = {}): ChangeRecord[] {
  let arr = state.records;
  if (filter.kind) arr = arr.filter((r) => r.kind === filter.kind);
  if (filter.fromVersion !== undefined) arr = arr.filter((r) => r.fromVersion === filter.fromVersion);
  if (filter.toVersion !== undefined) arr = arr.filter((r) => r.toVersion === filter.toVersion);
  if (filter.since) arr = arr.filter((r) => r.ts >= filter.since!);
  if (filter.until) arr = arr.filter((r) => r.ts <= filter.until!);
  return arr;
}

export function countByKind(state: L2ChangeHistoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of state.records) out[r.kind] = (out[r.kind] ?? 0) + 1;
  return out;
}

export function latestChange(state: L2ChangeHistoryState): ChangeRecord | undefined {
  return state.records[state.records.length - 1];
}

/** Master metric: change velocity (changes per hour estimate). */
export function changeVelocity(state: L2ChangeHistoryState): number {
  if (state.records.length < 2) return 0;
  const sorted = [...state.records].sort((a, b) => a.ts - b.ts);
  const first = sorted[0].ts;
  const last = sorted[sorted.length - 1].ts;
  const spanMs = last - first;
  if (spanMs <= 0) return 0;
  return (state.records.length - 1) / (spanMs / 3_600_000);
}
