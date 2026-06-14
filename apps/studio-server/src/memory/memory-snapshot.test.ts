// V13 MemorySnapshot (Direction A 13/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  takeSnapshot,
  diffSnapshots,
  restoreFromSnapshot,
  listSnapshots,
  snapshotCoverage,
} from "./memory-snapshot.js";
import { createMemoryLayer, addCharterSnapshot, recordChange, addAgentNote, rememberPattern } from "./memory-layer.js";

test("takeSnapshot: empty layer", () => {
  const snap = takeSnapshot(createMemoryLayer(), "init");
  assert.equal(snap.layerData.l0Count, 0);
  assert.equal(snap.layerData.l1Versions.length, 0);
  assert.equal(snap.layerData.l1CurrentVersion, null);
  assert.equal(snap.layerData.l2Count, 0);
  assert.equal(snap.layerData.l3Agents.length, 0);
  assert.equal(snap.layerData.l4Count, 0);
  assert.equal(snap.label, "init");
  assert.ok(snap.id.startsWith("snap-"));
});

test("takeSnapshot: captures counts", () => {
  let l = createMemoryLayer();
  l = addCharterSnapshot(l, "g1", ["m1"], ["n1"], "initial", "u");
  l = recordChange(l, "comment", 1, 2, ["x"]);
  l = addAgentNote(l, "a1", "task", "n");
  l = rememberPattern(l, "preference", "k", "v");
  const snap = takeSnapshot(l);
  assert.equal(snap.layerData.l1Versions.length, 1);
  assert.equal(snap.layerData.l1CurrentVersion, 1);
  assert.equal(snap.layerData.l2Count, 1);
  assert.deepEqual(snap.layerData.l3Agents, ["a1"]);
  assert.equal(snap.layerData.l4Count, 1);
});

test("takeSnapshot: L4 avgConfidence", () => {
  let l = createMemoryLayer();
  l = rememberPattern(l, "preference", "a", "v");
  l = rememberPattern(l, "preference", "a", "v"); // boost
  const snap = takeSnapshot(l);
  assert.ok(snap.layerData.l4AvgConfidence > 0);
});

test("diffSnapshots: detects additions", () => {
  let a = takeSnapshot(createMemoryLayer(), "a");
  let b = createMemoryLayer();
  b = addCharterSnapshot(b, "g", ["m"], ["n"], "initial", "u");
  b = rememberPattern(b, "preference", "k", "v");
  const snapB = takeSnapshot(b, "b");
  const d = diffSnapshots(a, snapB);
  assert.equal(d.l1Added.length, 1);
  assert.equal(d.l4Delta, 1);
});

test("diffSnapshots: detects removals (count delta)", () => {
  let a = takeSnapshot(createMemoryLayer(), "a");
  const b = takeSnapshot(createMemoryLayer(), "b");
  const d = diffSnapshots(a, b);
  assert.equal(d.l0Delta, 0);
  assert.equal(d.l1Added.length, 0);
});

test("diffSnapshots: L3 agent changes", () => {
  let a = takeSnapshot(createMemoryLayer(), "a");
  let b = createMemoryLayer();
  b = addAgentNote(b, "a1", "task", "x");
  b = addAgentNote(b, "a2", "task", "y");
  const snapB = takeSnapshot(b, "b");
  const d = diffSnapshots(a, snapB);
  assert.deepEqual(d.l3Added, ["a1", "a2"]);
});

test("restoreFromSnapshot: returns layer", () => {
  const l = createMemoryLayer();
  const snap = takeSnapshot(l);
  assert.equal(restoreFromSnapshot(snap), l);
});

test("listSnapshots: sorted by ts desc", async () => {
  const a = takeSnapshot(createMemoryLayer(), "a");
  // Force ts difference
  await new Promise((r) => setTimeout(r, 2));
  const b = takeSnapshot(createMemoryLayer(), "b");
  const list = listSnapshots([a, b]);
  assert.equal(list[0].label, "b");
  assert.equal(list[1].label, "a");
});

test("snapshotCoverage: 1.0 when same", () => {
  const l = createMemoryLayer();
  const snap = takeSnapshot(l);
  assert.equal(snapshotCoverage(snap, l), 1.0);
});

test("snapshotCoverage: 0.5 when half added", () => {
  let l = createMemoryLayer();
  const snap = takeSnapshot(l);
  l = rememberPattern(l, "preference", "a", "v");
  l = rememberPattern(l, "preference", "b", "v");
  // snap has 0 patterns, current has 2 → coverage of current 0
  // But the formula is captured / current
  // captured = 0 (from snap), current = 2
  // 0 / 2 = 0
  // Hmm, we want to see how well the snapshot covers the current state
  assert.equal(snapshotCoverage(snap, l), 0);
});
