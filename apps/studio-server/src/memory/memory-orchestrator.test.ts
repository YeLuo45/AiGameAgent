// V15 MemoryOrchestrator (Direction A 15/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryOrchestrator,
  orchestrateInject,
  orchestrateConsolidate,
  orchestrateSnapshot,
  orchestrateEvict,
  orchestrateDream,
  orchestratorThroughput,
  memoryLayerHealth,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from "./memory-orchestrator.js";

function makeEntry(id: string, ts: number, size: number = 100): { id: string; ts: number; size: number; lastAccessedAt: number; accessCount: number; ttlMs?: number } {
  return { id, ts, size, lastAccessedAt: ts, accessCount: 1 };
}

test("createMemoryOrchestrator: empty", () => {
  const o = createMemoryOrchestrator();
  assert.equal(o.snapshots.length, 0);
  assert.equal(o.stats.injectionsPlanned, 0);
});

test("DEFAULT_ORCHESTRATOR_CONFIG: 30min dream interval", () => {
  assert.equal(DEFAULT_ORCHESTRATOR_CONFIG.dreamIntervalMs, 1_800_000);
  assert.equal(DEFAULT_ORCHESTRATOR_CONFIG.defaultBudget, 4000);
});

test("orchestrateInject: increments stat", () => {
  let o = createMemoryOrchestrator();
  o = { ...o, layer: o.layer };
  const plan = orchestrateInject(o, { text: "test" });
  assert.equal(o.stats.injectionsPlanned, 1);
  assert.equal(plan.budget, 4000);
});

test("orchestrateConsolidate: runs consolidate", () => {
  let o = createMemoryOrchestrator();
  o = { ...o, layer: { ...o.layer, l3: { a1: { agentId: "a1", notes: [{ id: "n1", ts: 1, category: "decision", content: "prefer dark mode" }], maxNotes: 200 } } } };
  o = orchestrateConsolidate(o);
  assert.equal(o.stats.consolidationsRun, 1);
  assert.ok(Object.keys(o.layer.l4.patterns).length > 0);
});

test("orchestrateSnapshot: stores snapshot", () => {
  let o = createMemoryOrchestrator();
  o = orchestrateSnapshot(o, "v1");
  assert.equal(o.snapshots.length, 1);
  assert.equal(o.snapshots[0].label, "v1");
  assert.equal(o.stats.snapshotsTaken, 1);
});

test("orchestrateEvict: returns count", () => {
  let o = createMemoryOrchestrator();
  const r = orchestrateEvict(o, [
    makeEntry("a", 1, 100, ),
    makeEntry("b", 2, 100, ),
    makeEntry("c", 3, 100, ),
  ], "lru", 2);
  assert.equal(r.evicted, 1);
  assert.equal(o.stats.evictionsRun, 1);
});

test("orchestrateEvict: no eviction when under", () => {
  let o = createMemoryOrchestrator();
  const r = orchestrateEvict(o, [makeEntry("a", 1)], "lru", 5);
  assert.equal(r.evicted, 0);
});

test("orchestrateDream: runs dream + records event", () => {
  let o = createMemoryOrchestrator();
  o = orchestrateDream(o);
  assert.equal(o.stats.dreamsRun, 1);
  assert.equal(o.stream.events.length, 1);
});

test("orchestratorThroughput: 0 for no ops", () => {
  assert.equal(orchestratorThroughput(createMemoryOrchestrator()), 0);
});

test("orchestratorThroughput: scales with ops", () => {
  let o = createMemoryOrchestrator();
  o = orchestrateSnapshot(o);
  o = orchestrateSnapshot(o);
  o = orchestrateDream(o);
  assert.ok(orchestratorThroughput(o) > 0);
});

test("memoryLayerHealth: passes through to memoryHealth", () => {
  const o = createMemoryOrchestrator();
  const h = memoryLayerHealth(o);
  assert.ok(h >= 0 && h <= 1);
});
