// V18 AuditLog (Direction E 18/30, ruflo)
// Structured append-only audit log

export type AuditAction = "create" | "update" | "delete" | "read" | "execute" | "config";

export interface AuditEntry {
  id: number;
  ts: string; // ISO-8601
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogState {
  entries: AuditEntry[];
  nextId: number;
  maxEntries: number;
}

export function createAuditLog(maxEntries: number = 50_000): AuditLogState {
  return { entries: [], nextId: 1, maxEntries };
}

export function appendAudit(state: AuditLogState, entry: Omit<AuditEntry, "id" | "ts"> & { ts?: string }): { state: AuditLogState; entry: AuditEntry } {
  const fullEntry: AuditEntry = {
    id: state.nextId,
    ts: entry.ts ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    details: entry.details,
  };
  const entries = [...state.entries, fullEntry];
  if (entries.length > state.maxEntries) entries.shift();
  return { state: { ...state, entries, nextId: state.nextId + 1 }, entry: fullEntry };
}

export function queryAudit(
  state: AuditLogState,
  filter: { actor?: string; action?: AuditAction; resource?: string; fromId?: number; toId?: number } = {},
  limit: number = 100,
  offset: number = 0,
): AuditEntry[] {
  let arr = state.entries;
  if (filter.actor) arr = arr.filter((e) => e.actor === filter.actor);
  if (filter.action) arr = arr.filter((e) => e.action === filter.action);
  if (filter.resource) arr = arr.filter((e) => e.resource === filter.resource);
  if (filter.fromId !== undefined) arr = arr.filter((e) => e.id >= filter.fromId!);
  if (filter.toId !== undefined) arr = arr.filter((e) => e.id <= filter.toId!);
  return arr.slice(offset, offset + limit);
}

export function countAudit(state: AuditLogState, filter: { actor?: string; action?: AuditAction; resource?: string } = {}): number {
  return queryAudit(state, filter, state.entries.length + 1, 0).length;
}

export function countByAction(state: AuditLogState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.action] = (out[e.action] ?? 0) + 1;
  return out;
}

export function countByActor(state: AuditLogState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.actor] = (out[e.actor] ?? 0) + 1;
  return out;
}

export function distinctActors(state: AuditLogState): string[] {
  return Array.from(new Set(state.entries.map((e) => e.actor))).sort();
}

/** Master metric: audit log integrity 0-1. */
export function auditLogHealth(state: AuditLogState): number {
  if (state.maxEntries === 0) return 0;
  const util = state.entries.length / state.maxEntries;
  let score = 1.0;
  if (util > 0.95) score -= 0.2; // near eviction
  if (state.entries.length > 0) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
