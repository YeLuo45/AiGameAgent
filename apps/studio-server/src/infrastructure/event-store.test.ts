// V10 EventStore (Direction E 10/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventStore,
  appendEvent,
  queryEvents,
  countEvents,
  getEvent,
  getLatestEvent,
  getEarliestEvent,
  deleteEventsBefore,
  countByType,
  eventStoreHealth,
} from "./event-store.js";

function makeEv(o: Partial<{ type: string; agentId: string; sessionId: string; ts: string; correlationId: string; payload: Record<string, unknown> }> = {}) {
  return {
    type: o.type ?? "llm.chunk",
    sessionId: o.sessionId ?? "s1",
    correlationId: o.correlationId ?? "c1",
    agentId: o.agentId,
    ts: o.ts ?? "2026-06-14T00:00:00.000Z",
    payload: o.payload ?? { text: "x" },
  };
}

test("createEventStore: empty", () => {
  const s = createEventStore();
  assert.equal(s.events.length, 0);
  assert.equal(s.nextId, 1);
  assert.equal(s.maxEvents, 10_000);
});

test("appendEvent: adds record with auto id", () => {
  let s = createEventStore();
  const r = appendEvent(s, makeEv());
  assert.equal(r.record.id, 1);
  assert.equal(r.state.nextId, 2);
  assert.equal(r.state.events.length, 1);
});

test("appendEvent: ids increment", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  const r = appendEvent(s, makeEv());
  assert.equal(r.record.id, 3);
});

test("appendEvent: maxEvents cap evicts oldest", () => {
  let s = createEventStore(2);
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(s.events.length, 2);
  assert.equal(s.events[0].id, 2);
  assert.equal(s.events[1].id, 3);
});

test("queryEvents: empty store", () => {
  const s = createEventStore();
  assert.equal(queryEvents(s).length, 0);
  assert.equal(queryEvents(s, { type: "x" }).length, 0);
});

test("queryEvents: no filter = all", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(queryEvents(s).length, 2);
});

test("queryEvents: by agentId", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv({ agentId: "a1" })).state;
  s = appendEvent(s, makeEv({ agentId: "a2" })).state;
  s = appendEvent(s, makeEv({ agentId: "a1" })).state;
  assert.equal(queryEvents(s, { agentId: "a1" }).length, 2);
});

test("queryEvents: by sessionId", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv({ sessionId: "s1" })).state;
  s = appendEvent(s, makeEv({ sessionId: "s2" })).state;
  assert.equal(queryEvents(s, { sessionId: "s2" }).length, 1);
});

test("queryEvents: by id range", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(queryEvents(s, { fromId: 2, toId: 3 }).length, 2);
});

test("queryEvents: by ts since/until", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv({ ts: "2026-06-14T00:00:00.000Z" })).state;
  s = appendEvent(s, makeEv({ ts: "2026-06-14T01:00:00.000Z" })).state;
  s = appendEvent(s, makeEv({ ts: "2026-06-14T02:00:00.000Z" })).state;
  assert.equal(queryEvents(s, { since: "2026-06-14T01:00:00.000Z" }).length, 2);
  assert.equal(queryEvents(s, { until: "2026-06-14T01:00:00.000Z" }).length, 2);
});

test("queryEvents: pagination", () => {
  let s = createEventStore();
  for (let i = 0; i < 10; i++) s = appendEvent(s, makeEv()).state;
  assert.equal(queryEvents(s, {}, 3, 0).length, 3);
  assert.equal(queryEvents(s, {}, 3, 8).length, 2);
});

test("countEvents: same as queryEvents length", () => {
  let s = createEventStore();
  for (let i = 0; i < 5; i++) s = appendEvent(s, makeEv({ type: "x" })).state;
  for (let i = 0; i < 3; i++) s = appendEvent(s, makeEv({ type: "y" })).state;
  assert.equal(countEvents(s, { type: "x" }), 5);
  assert.equal(countEvents(s), 8);
});

test("getEvent: by id", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(getEvent(s, 2)?.id, 2);
  assert.equal(getEvent(s, 99), undefined);
});

test("getLatestEvent: with filter", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv({ type: "a" })).state;
  s = appendEvent(s, makeEv({ type: "b" })).state;
  s = appendEvent(s, makeEv({ type: "a" })).state;
  const last = getLatestEvent(s, { type: "a" });
  assert.equal(last?.id, 3);
});

test("getLatestEvent: no filter = last overall", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(getLatestEvent(s)?.id, 2);
});

test("getLatestEvent: empty = undefined", () => {
  assert.equal(getLatestEvent(createEventStore()), undefined);
});

test("getEarliestEvent: first event", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv()).state;
  s = appendEvent(s, makeEv()).state;
  assert.equal(getEarliestEvent(s)?.id, 1);
});

test("deleteEventsBefore: removes old", () => {
  let s = createEventStore();
  for (let i = 0; i < 5; i++) s = appendEvent(s, makeEv()).state;
  s = deleteEventsBefore(s, 3);
  assert.equal(s.events.length, 3);
  assert.equal(s.events[0].id, 3);
});

test("countByType: aggregate", () => {
  let s = createEventStore();
  s = appendEvent(s, makeEv({ type: "a" })).state;
  s = appendEvent(s, makeEv({ type: "a" })).state;
  s = appendEvent(s, makeEv({ type: "b" })).state;
  const c = countByType(s);
  assert.equal(c["a"], 2);
  assert.equal(c["b"], 1);
});

test("eventStoreHealth: empty = 1.0", () => {
  // 1.0 - 0 (utilization 0 < 0.01 but length=0, so no penalty) - 0 (no bonus since length=0)
  // = 1.0
  assert.equal(eventStoreHealth(createEventStore()), 1.0);
});

test("eventStoreHealth: low utilization with events → penalized", () => {
  // 1 event in 1000-capacity store = 0.001 utilization (low but events>0)
  // 1.0 - 0.2 (low util + length>0) + 0.1 (events>0) = 0.9
  const s = { ...createEventStore(1000), events: [{ id: 1, type: "x", sessionId: "s", correlationId: "c", ts: "x", payload: {} }] };
  assert.equal(eventStoreHealth(s), 0.9);
});

test("eventStoreHealth: normal utilization", () => {
  const s = { ...createEventStore(100), events: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, type: "x", sessionId: "s", correlationId: "c", ts: "2026-06-14T00:00:00.000Z", payload: {} })) };
  // 50/100 = 0.5 → no penalty, +0.1 (events > 0) = 1.1 → 1.0
  assert.equal(eventStoreHealth(s), 1.0);
});

test("eventStoreHealth: high utilization penalized", () => {
  const s = { ...createEventStore(10), events: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, type: "x", sessionId: "s", correlationId: "c", ts: "2026-06-14T00:00:00.000Z", payload: {} })) };
  // 10/10 = 1.0 → -0.3 (over 0.9) + 0.1 = 0.8
  assert.ok(Math.abs(eventStoreHealth(s) - 0.8) < 1e-9);
});
