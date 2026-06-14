// V22 ConflictResolver (Direction E 22/30, chatdev)
// Resolve conflicts between events (e.g. duplicate ids, out-of-order timestamps)

import { type EventRecord } from "./event-store.js";

export type ConflictKind = "duplicate-id" | "out-of-order" | "same-correlation-divergent" | "timestamp-anomaly";

export interface ConflictDetection {
  kind: ConflictKind;
  eventIds: number[];
  details: string;
  severity: "low" | "medium" | "high";
}

export interface ConflictResolution {
  kind: ConflictKind;
  /** Event id that "wins" (the one to keep). */
  winnerId: number;
  /** Event ids to drop. */
  dropIds: number[];
  /** How the conflict was resolved. */
  strategy: "keep-first" | "keep-last" | "keep-highest-priority" | "merge";
  details: string;
}

/** Detect conflicts in a list of events. */
export function detectConflicts(events: EventRecord[]): ConflictDetection[] {
  const conflicts: ConflictDetection[] = [];
  // Duplicate correlationId with different types
  const byCorr = new Map<string, EventRecord[]>();
  for (const e of events) {
    const arr = byCorr.get(e.correlationId) ?? [];
    arr.push(e);
    byCorr.set(e.correlationId, arr);
  }
  for (const [corr, evs] of byCorr) {
    if (evs.length > 1) {
      const types = new Set(evs.map((e) => e.type));
      if (types.size > 1) {
        conflicts.push({ kind: "same-correlation-divergent", eventIds: evs.map((e) => e.id), details: `CorrelationId ${corr} has ${types.size} types`, severity: "high" });
      }
    }
  }
  // Out-of-order: event with id N has ts < previous event's ts
  const sorted = [...events].sort((a, b) => a.id - b.id);
  for (let i = 1; i < sorted.length; i++) {
    if (new Date(sorted[i].ts) < new Date(sorted[i - 1].ts)) {
      conflicts.push({ kind: "out-of-order", eventIds: [sorted[i - 1].id, sorted[i].id], details: `Event ${sorted[i].id} ts < ${sorted[i - 1].id}`, severity: "medium" });
    }
  }
  // Timestamp anomaly: future events
  const now = Date.now();
  for (const e of events) {
    if (new Date(e.ts).getTime() > now + 60_000) {
      conflicts.push({ kind: "timestamp-anomaly", eventIds: [e.id], details: `Event ${e.id} ts in future`, severity: "low" });
    }
  }
  return conflicts;
}

/** Resolve a specific conflict. */
export function resolveConflict(conflict: ConflictDetection, events: EventRecord[], strategy: ConflictResolution["strategy"] = "keep-last"): ConflictResolution {
  if (conflict.kind === "same-correlation-divergent") {
    const sorted = conflict.eventIds.map((id) => events.find((e) => e.id === id)!).filter(Boolean);
    if (strategy === "keep-first") {
      return { kind: conflict.kind, winnerId: sorted[0].id, dropIds: sorted.slice(1).map((e) => e.id), strategy, details: "kept first event" };
    }
    if (strategy === "keep-highest-priority") {
      // priority = type weight (heuristic: later in event flow wins)
      const sorted2 = [...sorted].sort((a, b) => b.id - a.id);
      return { kind: conflict.kind, winnerId: sorted2[0].id, dropIds: sorted2.slice(1).map((e) => e.id), strategy, details: "kept highest-id (latest)" };
    }
    return { kind: conflict.kind, winnerId: sorted[sorted.length - 1].id, dropIds: sorted.slice(0, -1).map((e) => e.id), strategy, details: "kept last event" };
  }
  if (conflict.kind === "out-of-order") {
    const sorted = conflict.eventIds.map((id) => events.find((e) => e.id === id)!).filter(Boolean);
    return { kind: conflict.kind, winnerId: sorted[0].id, dropIds: [sorted[1].id], strategy, details: "rejected out-of-order" };
  }
  // Default: keep first
  return { kind: conflict.kind, winnerId: conflict.eventIds[0], dropIds: conflict.eventIds.slice(1), strategy, details: "default keep-first" };
}

/** Apply resolutions to a list of events. */
export function applyResolutions(events: EventRecord[], resolutions: ConflictResolution[]): EventRecord[] {
  const dropSet = new Set<number>();
  for (const r of resolutions) for (const id of r.dropIds) dropSet.add(id);
  return events.filter((e) => !dropSet.has(e.id));
}

/** Master metric: conflict resolution efficiency 0-1. */
export function resolutionEfficiency(conflicts: ConflictDetection[], resolutions: ConflictResolution[]): number {
  if (conflicts.length === 0) return 1.0;
  return Math.min(1, resolutions.length / conflicts.length);
}
