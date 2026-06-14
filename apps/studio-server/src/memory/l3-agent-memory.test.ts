// V4 L3AgentMemory (Direction A 4/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createL3AgentMemory,
  addNote,
  getNotesByCategory,
  getOpenTodos,
  markTodoDone,
  pruneExpired,
  clearCategory,
  countByCategory,
  workingMemoryLoad,
} from "./l3-agent-memory.js";

test("createL3AgentMemory: empty", () => {
  const s = createL3AgentMemory("a1");
  assert.equal(s.notes.length, 0);
  assert.equal(s.agentId, "a1");
});

test("addNote: adds with id", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "do the thing");
  assert.equal(s.notes.length, 1);
  assert.ok(s.notes[0].id.startsWith("l3-"));
});

test("addNote: with TTL", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "temp", 1000);
  assert.ok(s.notes[0].expiresAt);
});

test("addNote: evicts oldest when over max", () => {
  let s = createL3AgentMemory("a1", 2);
  s = addNote(s, "task", "a");
  s = addNote(s, "task", "b");
  s = addNote(s, "task", "c");
  assert.equal(s.notes.length, 2);
  assert.equal(s.notes[0].content, "b");
});

test("getNotesByCategory: only matching", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "t1");
  s = addNote(s, "context", "c1");
  s = addNote(s, "task", "t2");
  assert.equal(getNotesByCategory(s, "task").length, 2);
  assert.equal(getNotesByCategory(s, "context").length, 1);
});

test("getOpenTodos: excludes [done]/[x]", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "todo", "[ ] do x");
  s = addNote(s, "todo", "[done] y");
  s = addNote(s, "todo", "[x] z");
  assert.equal(getOpenTodos(s).length, 1);
  assert.equal(getOpenTodos(s)[0].content, "[ ] do x");
});

test("markTodoDone: prepends [done]", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "todo", "do x");
  s = markTodoDone(s, s.notes[0].id);
  assert.ok(s.notes[0].content.startsWith("[done]"));
});

test("markTodoDone: no-op for non-todo", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "do x");
  const before = s.notes[0].content;
  s = markTodoDone(s, s.notes[0].id);
  assert.equal(s.notes[0].content, before);
});

test("pruneExpired: removes expired", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "future", 10000);
  s = addNote(s, "task", "past", -1000);
  s = pruneExpired(s, Date.now());
  assert.equal(s.notes.length, 1);
  assert.equal(s.notes[0].content, "future");
});

test("clearCategory: removes by category", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "t1");
  s = addNote(s, "context", "c1");
  s = clearCategory(s, "task");
  assert.equal(s.notes.length, 1);
  assert.equal(s.notes[0].category, "context");
});

test("countByCategory: aggregate", () => {
  let s = createL3AgentMemory("a1");
  s = addNote(s, "task", "a");
  s = addNote(s, "task", "b");
  s = addNote(s, "decision", "x");
  const c = countByCategory(s);
  assert.equal(c["task"], 2);
  assert.equal(c["decision"], 1);
});

test("workingMemoryLoad: 0 empty", () => {
  assert.equal(workingMemoryLoad(createL3AgentMemory("a1")), 0);
});

test("workingMemoryLoad: ratio", () => {
  let s = createL3AgentMemory("a1", 4);
  s = addNote(s, "task", "a");
  s = addNote(s, "task", "b");
  assert.equal(workingMemoryLoad(s), 0.5);
});

test("workingMemoryLoad: clamped to 1", () => {
  let s = createL3AgentMemory("a1", 2);
  for (let i = 0; i < 10; i++) s = addNote(s, "task", `n${i}`);
  assert.equal(workingMemoryLoad(s), 1);
});
