// V22 ConflictResolver (Direction E 22/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectConflicts,
  resolveConflict,
  applyResolutions,
  resolutionEfficiency,
} from "./conflict-resolver.js";
import type { EventRecord } from "./event-store.js";

function ev(id: number, type: string, ts: string, correlationId: string = "c1"): EventRecord {
  return { id, type, ts, correlationId, sessionId: "s1", payload: {} };
}

test("detectConflicts: empty", () => {
  assert.equal(detectConflicts([]).length, 0);
});

test("detectConflicts: same correlationId divergent types", () => {
  const events = [ev(1, "llm.chunk", "2026-06-14T00:00:00.000Z"), ev(2, "tool.start", "2026-06-14T00:00:01.000Z", "c1")];
  const c = detectConflicts(events);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, "same-correlation-divergent");
  assert.equal(c[0].severity, "high");
});

test("detectConflicts: same correlationId same type = no conflict", () => {
  const events = [ev(1, "llm.chunk", "x"), ev(2, "llm.chunk", "y", "c1")];
  assert.equal(detectConflicts(events).length, 0);
});

test("detectConflicts: out-of-order detected", () => {
  const events = [ev(1, "x", "2026-06-14T00:00:01.000Z"), ev(2, "x", "2026-06-14T00:00:00.000Z")];
  const c = detectConflicts(events);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, "out-of-order");
});

test("detectConflicts: in-order = no conflict", () => {
  const events = [ev(1, "x", "2026-06-14T00:00:00.000Z"), ev(2, "x", "2026-06-14T00:00:01.000Z")];
  assert.equal(detectConflicts(events).length, 0);
});

test("detectConflicts: future event = low severity", () => {
  const future = new Date(Date.now() + 120_000).toISOString();
  const c = detectConflicts([ev(1, "x", future)]);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, "timestamp-anomaly");
  assert.equal(c[0].severity, "low");
});

test("resolveConflict: keep-last default", () => {
  const events = [ev(1, "a", "x"), ev(2, "b", "x", "c1")];
  const conflict = detectConflicts(events)[0];
  const r = resolveConflict(conflict, events);
  assert.equal(r.winnerId, 2);
  assert.deepEqual(r.dropIds, [1]);
});

test("resolveConflict: keep-first", () => {
  const events = [ev(1, "a", "x"), ev(2, "b", "x", "c1")];
  const conflict = detectConflicts(events)[0];
  const r = resolveConflict(conflict, events, "keep-first");
  assert.equal(r.winnerId, 1);
  assert.deepEqual(r.dropIds, [2]);
});

test("resolveConflict: keep-highest-priority", () => {
  const events = [ev(1, "a", "x"), ev(2, "b", "x", "c1")];
  const conflict = detectConflicts(events)[0];
  const r = resolveConflict(conflict, events, "keep-highest-priority");
  assert.equal(r.winnerId, 2); // higher id wins
});

test("resolveConflict: out-of-order resolution", () => {
  const events = [ev(1, "x", "2026-06-14T00:00:01.000Z"), ev(2, "x", "2026-06-14T00:00:00.000Z")];
  const conflict = detectConflicts(events)[0];
  const r = resolveConflict(conflict, events);
  assert.equal(r.kind, "out-of-order");
  assert.equal(r.winnerId, 1);
  assert.deepEqual(r.dropIds, [2]);
});

test("applyResolutions: drops events", () => {
  const events = [ev(1, "a", "x"), ev(2, "b", "y", "c1"), ev(3, "c", "z")];
  const resolutions = [{ kind: "same-correlation-divergent" as const, winnerId: 2, dropIds: [1], strategy: "keep-last" as const, details: "x" }];
  const result = applyResolutions(events, resolutions);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((e) => e.id), [2, 3]);
});

test("applyResolutions: no resolutions = no change", () => {
  const events = [ev(1, "a", "x"), ev(2, "b", "y")];
  assert.equal(applyResolutions(events, []).length, 2);
});

test("resolutionEfficiency: 0 conflicts = 1.0", () => {
  assert.equal(resolutionEfficiency([], []), 1.0);
});

test("resolutionEfficiency: all resolved = 1.0", () => {
  assert.equal(resolutionEfficiency([{ kind: "out-of-order", eventIds: [1, 2], details: "x", severity: "low" }], [{ kind: "out-of-order", winnerId: 1, dropIds: [2], strategy: "keep-first", details: "x" }]), 1.0);
});

test("resolutionEfficiency: partial = 0.5", () => {
  assert.equal(resolutionEfficiency([{ kind: "x", eventIds: [1, 2], details: "x", severity: "low" }, { kind: "x", eventIds: [3, 4], details: "y", severity: "low" }], [{ kind: "x", winnerId: 1, dropIds: [2], strategy: "keep-first", details: "x" }]), 0.5);
});
