// V9 MemoryRetriever (Direction A 9/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  retrieve,
  retrievalRecall,
} from "./memory-retriever.js";
import { createL0SessionMemory, appendL0 } from "./l0-session-memory.js";
import { createL1CharterMemory, addCharterSnapshot } from "./l1-charter-memory.js";
import { createL2ChangeHistory, appendChange } from "./l2-change-history.js";
import { createL3AgentMemory, addNote } from "./l3-agent-memory.js";
import { createL4PatternMemory, recordPattern } from "./l4-pattern-memory.js";

test("retrieve: empty layer = empty results", () => {
  const r = retrieve({ text: "hello" }, {});
  assert.equal(r.length, 0);
});

test("retrieve: matches L0 entries", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "user", text: "hello world" });
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "user", text: "goodbye world" });
  const r = retrieve({ text: "hello" }, { l0: s });
  assert.ok(r.length > 0);
  assert.equal(r[0].layer, "L0");
});

test("retrieve: matches L1 charter", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "ship a game", milestones: ["design", "code"], nodes: ["ui", "ai"], reason: "initial", createdBy: "u" });
  const r = retrieve({ text: "ship game" }, { l1: s });
  assert.equal(r[0].layer, "L1");
});

test("retrieve: matches L2 changes", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, ["goal"], "switch to dark mode");
  const r = retrieve({ text: "dark" }, { l2: s });
  assert.equal(r[0].layer, "L2");
});

test("retrieve: matches L3 notes", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "fix the bug");
  const r = retrieve({ text: "bug" }, { l3: s });
  assert.equal(r[0].layer, "L3");
});

test("retrieve: matches L4 patterns", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "lang", "zh");
  const r = retrieve({ text: "zh" }, { l4: s });
  assert.equal(r[0].layer, "L4");
});

test("retrieve: layer filter", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "x" });
  let l1 = createL1CharterMemory();
  l1 = addCharterSnapshot(l1, { version: 1, goal: "x", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  const r = retrieve({ text: "x", layers: ["L0"] }, { l0, l1 });
  for (const result of r) assert.equal(result.layer, "L0");
});

test("retrieve: sorted by score desc", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello" });
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello hello hello" });
  const r = retrieve({ text: "hello" }, { l0 });
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
});

test("retrieve: maxResults limit", () => {
  let l0 = createL0SessionMemory("s1");
  for (let i = 0; i < 5; i++) l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: `hello ${i}` });
  const r = retrieve({ text: "hello", maxResults: 2 }, { l0 });
  assert.equal(r.length, 2);
});

test("retrieve: minScore filter", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "completely different text" });
  const r = retrieve({ text: "hello", minScore: 0.5 }, { l0 });
  assert.equal(r.length, 0);
});

test("retrievalRecall: 0 for 0 expected", () => {
  assert.equal(retrievalRecall([], 0), 1.0);
});

test("retrievalRecall: ratio", () => {
  const fake: ReturnType<typeof retrieve> = [{ layer: "L0", id: "1", text: "x", score: 0.5 }];
  assert.equal(retrievalRecall(fake, 2), 0.5);
});

test("retrievalRecall: 1.0 when enough", () => {
  const fake: ReturnType<typeof retrieve> = [
    { layer: "L0", id: "1", text: "x", score: 0.5 },
    { layer: "L0", id: "2", text: "y", score: 0.5 },
  ];
  assert.equal(retrievalRecall(fake, 2), 1.0);
});
