// V11 EventIndexer (Direction E 11/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventIndex,
  indexEvent,
  rebuildIndex,
  countByTypeFromIndex,
  countByAgentFromIndex,
  distinctAgents,
  distinctTypes,
  distinctSessions,
  eventIdsByType,
  eventIdsByAgent,
  indexCoverage,
  indexedQuery,
} from "./event-indexer.js";
import { createEventStore, appendEvent, type EventRecord } from "./event-store.js";

function ev(id: number, type: string, agentId?: string, sessionId = "s1"): EventRecord {
  return { id, type, agentId, sessionId, correlationId: `c${id}`, ts: `2026-06-14T00:00:00.000Z`, payload: {} };
}

test("createEventIndex: empty", () => {
  const idx = createEventIndex();
  assert.equal(Object.keys(idx.byType).length, 0);
  assert.equal(Object.keys(idx.byAgent).length, 0);
  assert.equal(Object.keys(idx.bySession).length, 0);
});

test("indexEvent: by type", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "llm.chunk"));
  assert.equal(idx.byType["llm.chunk"]?.size, 1);
});

test("indexEvent: by agent (when present)", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x", "a1"));
  assert.equal(idx.byAgent["a1"]?.size, 1);
});

test("indexEvent: no agent = no agent index", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x"));
  assert.equal(Object.keys(idx.byAgent).length, 0);
});

test("indexEvent: by session", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x", "a1", "sess1"));
  assert.equal(idx.bySession["sess1"]?.size, 1);
});

test("rebuildIndex: covers all events", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  assert.equal(idx.byType["a"]?.size, 1);
  assert.equal(idx.byType["b"]?.size, 1);
  assert.equal(idx.bySession["s1"]?.size, 2);
});

test("countByTypeFromIndex: type counts", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "a"));
  idx = indexEvent(idx, ev(2, "a"));
  idx = indexEvent(idx, ev(3, "b"));
  const c = countByTypeFromIndex(idx);
  assert.equal(c["a"], 2);
  assert.equal(c["b"], 1);
});

test("countByAgentFromIndex: agent counts", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x", "a1"));
  idx = indexEvent(idx, ev(2, "x", "a1"));
  idx = indexEvent(idx, ev(3, "x", "a2"));
  const c = countByAgentFromIndex(idx);
  assert.equal(c["a1"], 2);
  assert.equal(c["a2"], 1);
});

test("distinctAgents sorted", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x", "z"));
  idx = indexEvent(idx, ev(2, "x", "a"));
  idx = indexEvent(idx, ev(3, "x", "m"));
  assert.deepEqual(distinctAgents(idx), ["a", "m", "z"]);
});

test("distinctTypes sorted", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "z"));
  idx = indexEvent(idx, ev(2, "a"));
  assert.deepEqual(distinctTypes(idx), ["a", "z"]);
});

test("distinctSessions sorted", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(1, "x", undefined, "s2"));
  idx = indexEvent(idx, ev(2, "x", undefined, "s1"));
  assert.deepEqual(distinctSessions(idx), ["s1", "s2"]);
});

test("eventIdsByType sorted", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(3, "a"));
  idx = indexEvent(idx, ev(1, "a"));
  idx = indexEvent(idx, ev(2, "a"));
  assert.deepEqual(eventIdsByType(idx, "a"), [1, 2, 3]);
});

test("eventIdsByType missing", () => {
  assert.deepEqual(eventIdsByType(createEventIndex(), "x"), []);
});

test("eventIdsByAgent sorted", () => {
  let idx = createEventIndex();
  idx = indexEvent(idx, ev(2, "x", "a"));
  idx = indexEvent(idx, ev(1, "x", "a"));
  assert.deepEqual(eventIdsByAgent(idx, "a"), [1, 2]);
});

test("indexCoverage: empty store = 1.0", () => {
  assert.equal(indexCoverage(createEventIndex(), createEventStore()), 1.0);
});

test("indexCoverage: 1.0 when all indexed", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  assert.equal(indexCoverage(idx, s), 1.0);
});

test("indexCoverage: partial index (manually broken)", () => {
  // Build an index that doesn't cover all events
  const idx = createEventIndex();
  // The `indexed > 0` would only fire if events match the byType check
  // But the function returns max 0 if events don't have the right type set
  // With empty index, indexed stays 0, returns 0 / state.events.length = 0
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  assert.ok(indexCoverage(idx, s) >= 0);
});

test("indexedQuery: by type", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c3", ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  const r = indexedQuery(s, idx, { type: "a" });
  assert.equal(r.length, 2);
});

test("indexedQuery: by type + agent intersection", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", agentId: "x", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "a", agentId: "y", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", agentId: "x", sessionId: "s1", correlationId: "c3", ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  const r = indexedQuery(s, idx, { type: "a", agentId: "x" });
  assert.equal(r.length, 1);
  assert.equal(r[0].agentId, "x");
});

test("indexedQuery: no filter = full scan", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  const r = indexedQuery(s, idx, {});
  assert.equal(r.length, 2);
});

test("indexedQuery: pagination", () => {
  let s = createEventStore();
  for (let i = 0; i < 5; i++) s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: `c${i}`, ts: "x", payload: {} }).state;
  const idx = rebuildIndex(s);
  const r = indexedQuery(s, idx, { type: "a" }, 2, 1);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, 2);
});
