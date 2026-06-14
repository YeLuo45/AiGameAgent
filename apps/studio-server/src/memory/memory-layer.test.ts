// V6 MemoryLayer (Direction A 6/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryLayer,
  ensureL3,
  appendL0Entry,
  getL0Recent,
  addCharterSnapshot,
  recordChange,
  addAgentNote,
  getAgentTodos,
  rememberPattern,
  recallPattern,
  lastChange,
  memoryHealth,
} from "./memory-layer.js";

test("createMemoryLayer: empty defaults", () => {
  const l = createMemoryLayer();
  assert.equal(l.l0.entries.length, 0);
  assert.equal(l.l1.snapshots.length, 0);
  assert.equal(l.l2.records.length, 0);
  assert.equal(Object.keys(l.l3).length, 0);
  assert.equal(Object.keys(l.l4.patterns).length, 0);
});

test("ensureL3: creates new agent state", () => {
  const l = createMemoryLayer();
  const s = ensureL3(l, "a1");
  assert.equal(s.agentId, "a1");
  assert.ok(l.l3["a1"]);
});

test("ensureL3: returns existing", () => {
  let l = createMemoryLayer();
  l = addAgentNote(l, "a1", "task", "x");
  const s = ensureL3(l, "a1");
  assert.equal(s.notes.length, 1);
});

test("appendL0Entry: adds to L0", () => {
  let l = createMemoryLayer();
  l = appendL0Entry(l, "a1", "user", "hello");
  assert.equal(l.l0.entries.length, 1);
});

test("getL0Recent: returns last N", () => {
  let l = createMemoryLayer();
  for (let i = 0; i < 5; i++) l = appendL0Entry(l, "a1", "user", `m${i}`);
  const recent = getL0Recent(l, 3);
  assert.equal(recent.length, 3);
});

test("getL0Recent: filter by agentId", () => {
  let l = createMemoryLayer();
  l = appendL0Entry(l, "a1", "user", "x");
  l = appendL0Entry(l, "a2", "user", "y");
  const recent = getL0Recent(l, 10, "a1");
  assert.equal(recent.length, 1);
});

test("addCharterSnapshot: increments version", () => {
  let l = createMemoryLayer();
  l = addCharterSnapshot(l, "g1", ["m1"], ["n1"], "initial", "u");
  assert.equal(l.l1.snapshots.length, 1);
  l = addCharterSnapshot(l, "g2", ["m1", "m2"], ["n1"], "approval", "u");
  assert.equal(l.l1.snapshots.length, 2);
  assert.equal(l.l1.snapshots[1].version, 2);
});

test("recordChange: adds to L2", () => {
  let l = createMemoryLayer();
  l = recordChange(l, "goal_changed", 1, 2, ["goal"]);
  assert.equal(l.l2.records.length, 1);
});

test("addAgentNote: per-agent memory", () => {
  let l = createMemoryLayer();
  l = addAgentNote(l, "a1", "task", "do x");
  assert.equal(l.l3["a1"].notes.length, 1);
});

test("getAgentTodos: returns todos", () => {
  let l = createMemoryLayer();
  l = addAgentNote(l, "a1", "todo", "do x");
  l = addAgentNote(l, "a1", "task", "do y");
  const todos = getAgentTodos(l, "a1");
  assert.equal(todos.length, 1);
});

test("rememberPattern + recallPattern: roundtrip", () => {
  let l = createMemoryLayer();
  l = rememberPattern(l, "preference", "lang", "zh");
  const p = recallPattern(l, "preference", "lang");
  assert.equal(p?.value, "zh");
});

test("recallPattern: undefined for missing", () => {
  assert.equal(recallPattern(createMemoryLayer(), "preference", "x"), undefined);
});

test("lastChange: returns most recent", () => {
  let l = createMemoryLayer();
  l = recordChange(l, "goal_changed", 1, 2, []);
  l = recordChange(l, "milestones_changed", 2, 3, []);
  assert.equal(lastChange(l)?.kind, "milestones_changed");
});

test("memoryHealth: 0.5 with empty L1", () => {
  const l = createMemoryLayer();
  const h = memoryHealth(l);
  // 1.0 (l0) * 0.2 + 0.5 (l1) * 0.3 + 0 (l2) * 0.1 + 0 (l3) * 0.2 + 0 (l4) * 0.2
  // 0.2 + 0.15 = 0.35
  assert.equal(h, 0.35);
});

test("memoryHealth: high with full data", () => {
  let l = createMemoryLayer();
  l = addCharterSnapshot(l, "g", ["m"], ["n"], "initial", "u");
  for (let i = 0; i < 3; i++) l = recordChange(l, "comment", 1, 2, []);
  l = addAgentNote(l, "a1", "task", "x");
  l = addAgentNote(l, "a2", "task", "y");
  l = addAgentNote(l, "a3", "task", "z");
  for (let i = 0; i < 20; i++) l = rememberPattern(l, "preference", `k${i}`, "v");
  assert.ok(memoryHealth(l) > 0.5);
});
