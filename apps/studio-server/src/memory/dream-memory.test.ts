// V11 DreamMemory (Direction A 11/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDreamState,
  runDream,
  shouldRunDream,
  timeSinceLastRun,
  dreamEfficiency,
} from "./dream-memory.js";
import { createL0SessionMemory, appendL0 } from "./l0-session-memory.js";
import { createL3AgentMemory } from "./l3-agent-memory.js";
import { createL4PatternMemory } from "./l4-pattern-memory.js";

test("createDreamState: empty", () => {
  const s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  assert.equal(s.lastRunAt, null);
  assert.equal(s.totalRuns, 0);
});

test("runDream: promotes L0 to L3", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a1", sessionId: "s1", kind: "user", text: "hello" });
  l0 = appendL0(l0, { agentId: "a1", sessionId: "s1", kind: "assistant", text: "hi back" });
  const s = createDreamState(l0, {}, createL4PatternMemory());
  const r = runDream(s);
  assert.equal(r.lastStats?.promoted, 2);
  assert.ok(r.l3ByAgent["a1"]);
});

test("runDream: consolidates L3 to L4", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = { ...l3, notes: [{ id: "n1", ts: 1, category: "decision", content: "prefer dark mode" }] };
  const s = createDreamState(createL0SessionMemory("s1"), { a1: l3 }, createL4PatternMemory());
  const r = runDream(s);
  assert.ok(r.lastStats?.patternsFound && r.lastStats.patternsFound > 0);
  assert.ok(Object.keys(r.l4.patterns).length > 0);
});

test("runDream: increments totalRuns", () => {
  const s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  const r = runDream(s);
  assert.equal(r.totalRuns, 1);
});

test("runDream: sets lastRunAt", () => {
  const s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  const now = 1000;
  const r = runDream(s, now);
  assert.equal(r.lastRunAt, now);
});

test("shouldRunDream: true on first call", () => {
  const s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  assert.equal(shouldRunDream(s, 1000), true);
});

test("shouldRunDream: false within interval", () => {
  let s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  s = runDream(s, 1000);
  assert.equal(shouldRunDream(s, 1000, 1500), false);
});

test("shouldRunDream: true after interval", () => {
  let s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  s = runDream(s, 1000);
  assert.equal(shouldRunDream(s, 1000, 2500), true);
});

test("timeSinceLastRun: Infinity initially", () => {
  const s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  assert.equal(timeSinceLastRun(s, 1000), Infinity);
});

test("timeSinceLastRun: ms since last", () => {
  let s = createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory());
  s = runDream(s, 1000);
  assert.equal(timeSinceLastRun(s, 1500), 500);
});

test("dreamEfficiency: 0 before any run", () => {
  assert.equal(dreamEfficiency(createDreamState(createL0SessionMemory("s1"), {}, createL4PatternMemory())), 0);
});

test("dreamEfficiency: positive after run", () => {
  let l0 = createL0SessionMemory("s1");
  for (let i = 0; i < 50; i++) l0 = appendL0(l0, { agentId: "a1", sessionId: "s1", kind: "user", text: `prefer ${i}` });
  let s = createDreamState(l0, {}, createL4PatternMemory());
  s = runDream(s);
  // 50 promoted + ~50 patterns found → 100/100 = 1.0 → > 0.5
  assert.ok(dreamEfficiency(s) > 0.5);
});
