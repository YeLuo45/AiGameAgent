// V12 MemoryQuery (Direction A 12/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  query,
  queryPrecision,
} from "./memory-query.js";
import { createL0SessionMemory, appendL0 } from "./l0-session-memory.js";
import { createL1CharterMemory, addCharterSnapshot } from "./l1-charter-memory.js";
import { createL3AgentMemory, addNote } from "./l3-agent-memory.js";
import { createL4PatternMemory, recordPattern } from "./l4-pattern-memory.js";

test("query: fuzzy mode delegates to retrieve", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello world" });
  const r = query({ text: "hello", mode: "fuzzy" }, { l0 });
  assert.equal(r.mode, "fuzzy");
  assert.ok(r.results.length > 0);
});

test("query: exact match", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello world" });
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "goodbye" });
  const r = query({ text: "hello world", mode: "exact" }, { l0 });
  assert.equal(r.results.length, 1);
});

test("query: case-insensitive by default", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "Hello World" });
  const r = query({ text: "hello world", mode: "exact" }, { l0 });
  assert.equal(r.results.length, 1);
});

test("query: case-sensitive", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "Hello World" });
  const r = query({ text: "hello world", mode: "exact", caseSensitive: true }, { l0 });
  assert.equal(r.results.length, 0);
});

test("query: prefix match", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello world" });
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "help me" });
  const r = query({ text: "help", mode: "prefix" }, { l0 });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].text, "help me");
});

test("query: regex match", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "error 42 happened" });
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "all good" });
  const r = query({ text: "error \\d+", mode: "regex" }, { l0 });
  assert.equal(r.results.length, 1);
});

test("query: layer filter", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello" });
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "task", "hello world");
  const r = query({ text: "hello", mode: "fuzzy", layers: ["L0"] }, { l0, l3 });
  for (const result of r.results) assert.equal(result.layer, "L0");
});

test("query: L1 charter match (version keyword)", () => {
  let l1 = createL1CharterMemory();
  l1 = addCharterSnapshot(l1, { version: 1, goal: "ship game", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  const r = query({ text: "version", mode: "exact" }, { l1 });
  assert.equal(r.results.length, 1);
});

test("query: L3 note match (contains)", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "task", "hello world");
  l3 = addNote(l3, "task", "goodbye");
  const r = query({ text: "world", mode: "exact" }, { l3 });
  assert.equal(r.results.length, 1);
});

test("query: L4 pattern match", () => {
  let l4 = createL4PatternMemory();
  l4 = recordPattern(l4, "preference", "lang", "zh");
  const r = query({ text: "lang", mode: "exact" }, { l4 });
  assert.equal(r.results.length, 1);
});

test("query: agentId filter", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a1", sessionId: "s1", kind: "user", text: "hello" });
  l0 = appendL0(l0, { agentId: "a2", sessionId: "s1", kind: "user", text: "hello" });
  const r = query({ text: "hello", mode: "exact", agentId: "a1" }, { l0 });
  assert.equal(r.results.length, 1);
});

test("queryPrecision: 1.0 when all relevant", () => {
  let l0 = createL0SessionMemory("s1");
  l0 = appendL0(l0, { agentId: "a", sessionId: "s1", kind: "user", text: "hello" });
  const r = query({ text: "hello", mode: "fuzzy" }, { l0 });
  assert.equal(queryPrecision(r), 1.0);
});

test("queryPrecision: 0 when empty", () => {
  const r = query({ text: "nothing", mode: "fuzzy" }, {});
  assert.equal(queryPrecision(r), 0);
});
