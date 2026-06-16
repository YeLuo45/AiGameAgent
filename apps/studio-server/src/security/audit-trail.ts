// V24 AuditTrail (Direction G 24/30, orchestrator)
// Security audit log (append-only, hash-chained)

import { createHash } from "node:crypto";

export type AuditAction = "login" | "logout" | "create" | "read" | "update" | "delete" | "execute" | "config" | "permission" | "deny";

export interface AuditEntry {
  id: number;
  ts: number;
  actor: string;
  action: AuditAction;
  resource: string;
  outcome: "success" | "failure" | "denied";
  details: Record<string, string>;
  prevHash: string;
  hash: string;
}

export function hashEntry(entry: Omit<AuditEntry, "hash">, prevHash: string): string {
  const payload = JSON.stringify({ ...entry, prevHash });
  return createHash("sha256").update(payload).digest("hex");
}

export function createAuditEntry(id: number, actor: string, action: AuditAction, resource: string, outcome: AuditEntry["outcome"], details: Record<string, string> = {}, prevHash: string = "0"): AuditEntry {
  const entry: Omit<AuditEntry, "hash"> = { id, ts: Date.now(), actor, action, resource, outcome, details, prevHash };
  return { ...entry, hash: hashEntry(entry, prevHash) };
}

export interface AuditTrail {
  entries: AuditEntry[];
  nextId: number;
}

export function createAuditTrail(): AuditTrail {
  return { entries: [], nextId: 1 };
}

export function appendAudit(state: AuditTrail, actor: string, action: AuditAction, resource: string, outcome: AuditEntry["outcome"], details: Record<string, string> = {}): AuditTrail {
  const prevHash = state.entries.length > 0 ? state.entries[state.entries.length - 1].hash : "0";
  const entry = createAuditEntry(state.nextId, actor, action, resource, outcome, details, prevHash);
  return { entries: [...state.entries, entry], nextId: state.nextId + 1 };
}

export function verifyChain(state: AuditTrail): boolean {
  for (let i = 0; i < state.entries.length; i++) {
    const e = state.entries[i];
    const expectedPrev = i > 0 ? state.entries[i - 1].hash : "0";
    if (e.prevHash !== expectedPrev) return false;
    const { hash: _h, ...rest } = e;
    if (hashEntry(rest, e.prevHash) !== e.hash) return false;
  }
  return true;
}

export function queryAudit(state: AuditTrail, filter: { actor?: string; action?: AuditAction; resource?: string; outcome?: AuditEntry["outcome"]; since?: number } = {}): AuditEntry[] {
  let arr = state.entries;
  if (filter.actor) arr = arr.filter((e) => e.actor === filter.actor);
  if (filter.action) arr = arr.filter((e) => e.action === filter.action);
  if (filter.resource) arr = arr.filter((e) => e.resource === filter.resource);
  if (filter.outcome) arr = arr.filter((e) => e.outcome === filter.outcome);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  return arr;
}

export function countByActor(state: AuditTrail, actor: string): number {
  return state.entries.filter((e) => e.actor === actor).length;
}

/** Master metric: audit integrity 0-1. */
export function auditIntegrity(state: AuditTrail): number {
  if (state.entries.length === 0) return 1.0;
  return verifyChain(state) ? 1.0 : 0;
}
