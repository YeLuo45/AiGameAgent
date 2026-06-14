// V1 L0SessionMemory (Direction A 1/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createL0SessionMemory,
  appendL0,
  getRecent,
  filterByKind,
  countByKind,
  clearL0,
  estimateContextTokens,
  l0Utilization,
} from "./l0-session-memory.js";

test("createL0SessionMemory: defaults", () => {
  const s = createL0SessionMemory("s1");
  assert.equal(s.sessionId, "s1");
  assert.equal(s.entries.length, 0);
  assert.equal(s.maxEntries, 1000);
  assert.equal(s.maxTotalSize, 1_000_000);
});

test("appendL0: adds entry with id + ts", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "user", text: "hello" });
  assert.equal(s.entries.length, 1);
  assert.ok(s.entries[0].id.startsWith("l0-"));
});

test("appendL0: accumulates totalSize", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "user", text: "abcde" });
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "assistant", text: "fghij" });
  assert.equal(s.totalSize, 10);
});

test("appendL0: evicts oldest by count", () => {
  let s = createL0SessionMemory("s1", 2, 1000);
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "1" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "2" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "3" });
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0].text, "2");
});

test("appendL0: evicts oldest by total size", () => {
  let s = createL0SessionMemory("s1", 100, 5);
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "abc" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "def" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "ghi" });
  // Each entry is 3 chars, total 9 > 5, so first 2 entries evicted
  assert.equal(s.entries.length, 1);
  assert.equal(s.totalSize, 3);
  assert.equal(s.entries[0].text, "ghi");
});

test("getRecent: returns last N", () => {
  let s = createL0SessionMemory("s1");
  for (let i = 0; i < 5; i++) s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: `m${i}` });
  const recent = getRecent(s, 3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0].text, "m2");
});

test("getRecent: filter by agentId", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a1", sessionId: "s1", kind: "user", text: "x" });
  s = appendL0(s, { agentId: "a2", sessionId: "s1", kind: "user", text: "y" });
  const recent = getRecent(s, 10, "a1");
  assert.equal(recent.length, 1);
  assert.equal(recent[0].text, "x");
});

test("filterByKind: only matching", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "u" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "assistant", text: "a" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "tool_call", text: "t" });
  assert.equal(filterByKind(s, "user").length, 1);
  assert.equal(filterByKind(s, "assistant").length, 1);
  assert.equal(filterByKind(s, "tool_call").length, 1);
});

test("countByKind: aggregate", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "u1" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "u2" });
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "assistant", text: "a" });
  const c = countByKind(s);
  assert.equal(c["user"], 2);
  assert.equal(c["assistant"], 1);
});

test("clearL0: empties", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "x" });
  s = clearL0(s);
  assert.equal(s.entries.length, 0);
  assert.equal(s.totalSize, 0);
});

test("estimateContextTokens: 4 chars per token", () => {
  let s = createL0SessionMemory("s1");
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "a".repeat(100) });
  assert.equal(estimateContextTokens(s), 25);
});

test("l0Utilization: 0 empty", () => {
  assert.equal(l0Utilization(createL0SessionMemory("s1")), 0);
});

test("l0Utilization: ratio of totalSize / max", () => {
  let s = createL0SessionMemory("s1", 1000, 100);
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "a".repeat(50) });
  assert.equal(l0Utilization(s), 0.5);
});

test("l0Utilization: clamped to 1", () => {
  let s = createL0SessionMemory("s1", 1000, 100);
  s = appendL0(s, { agentId: "a", sessionId: "s1", kind: "user", text: "a".repeat(200) });
  // Over limit, but evicts to stay under → may not be 1
  assert.ok(l0Utilization(s) <= 1);
});
