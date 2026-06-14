// V13 StreamReplayer (Direction E 13/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStreamReplayer,
  subscribe,
  unsubscribe,
  advance,
  subscriberCount,
  getSubscriber,
  streamHealth,
} from "./stream-replayer.js";
import { createEventStore, appendEvent } from "./event-store.js";

test("createStreamReplayer: defaults", () => {
  const s = createStreamReplayer();
  assert.equal(s.subscribers.size, 0);
  assert.equal(s.totalEmitted, 0);
  assert.equal(s.cursor.currentId, -1);
});

test("subscribe: adds subscriber", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "sub1", { type: "llm.chunk" });
  assert.equal(subscriberCount(s), 1);
  const sub = getSubscriber(s, "sub1");
  assert.equal(sub?.filter.type, "llm.chunk");
});

test("subscribe: multiple subscribers", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  s = subscribe(s, "b", { agentId: "x" });
  assert.equal(subscriberCount(s), 2);
});

test("unsubscribe: removes", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  s = unsubscribe(s, "a");
  assert.equal(subscriberCount(s), 0);
});

test("advance: no subscribers → no emit", () => {
  const s = createStreamReplayer();
  const store = createEventStore();
  const r = advance(s, store, 10);
  assert.equal(r.emitted.size, 0);
});

test("advance: emits new events to subscribers", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  let store = createEventStore();
  for (let i = 0; i < 3; i++) {
    store = appendEvent(store, { type: "x", sessionId: "s", correlationId: `c${i}`, ts: "x", payload: {} }).state;
  }
  const r = advance(s, store, 10);
  const out = r.emitted.get("a");
  assert.equal(out?.length, 3);
  assert.equal(r.replayer.totalEmitted, 3);
});

test("advance: filters by type", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", { type: "llm.chunk" });
  let store = createEventStore();
  store = appendEvent(store, { type: "llm.chunk", sessionId: "s", correlationId: "c1", ts: "x", payload: {} }).state;
  store = appendEvent(store, { type: "tool.start", sessionId: "s", correlationId: "c2", ts: "x", payload: {} }).state;
  store = appendEvent(store, { type: "llm.chunk", sessionId: "s", correlationId: "c3", ts: "x", payload: {} }).state;
  const r = advance(s, store, 10);
  const out = r.emitted.get("a");
  assert.equal(out?.length, 2);
  assert.equal(out?.[0].type, "llm.chunk");
});

test("advance: filters by agentId", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", { agentId: "x" });
  let store = createEventStore();
  store = appendEvent(store, { type: "y", agentId: "x", sessionId: "s", correlationId: "c1", ts: "x", payload: {} }).state;
  store = appendEvent(store, { type: "y", agentId: "y", sessionId: "s", correlationId: "c2", ts: "x", payload: {} }).state;
  const r = advance(s, store, 10);
  assert.equal(r.emitted.get("a")?.length, 1);
});

test("advance: doesn't re-emit already seen events", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  let store = createEventStore();
  store = appendEvent(store, { type: "x", sessionId: "s", correlationId: "c1", ts: "x", payload: {} }).state;
  store = appendEvent(store, { type: "x", sessionId: "s", correlationId: "c2", ts: "x", payload: {} }).state;
  const r1 = advance(s, store, 10);
  assert.equal(r1.emitted.get("a")?.length, 2);
  const r2 = advance(r1.replayer, store, 10);
  assert.equal(r2.emitted.get("a")?.length, 0);
});

test("advance: emits only new events on second call", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  let store = createEventStore();
  store = appendEvent(store, { type: "x", sessionId: "s", correlationId: "c1", ts: "x", payload: {} }).state;
  const r1 = advance(s, store, 10);
  store = appendEvent(store, { type: "x", sessionId: "s", correlationId: "c2", ts: "x", payload: {} }).state;
  store = appendEvent(store, { type: "x", sessionId: "s", correlationId: "c3", ts: "x", payload: {} }).state;
  const r2 = advance(r1.replayer, store, 10);
  assert.equal(r2.emitted.get("a")?.length, 2);
});

test("subscriberCount: starts at 0", () => {
  assert.equal(subscriberCount(createStreamReplayer()), 0);
});

test("getSubscriber: returns sub or undefined", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", { type: "x" });
  assert.ok(getSubscriber(s, "a"));
  assert.equal(getSubscriber(s, "nope"), undefined);
});

test("streamHealth: no subscribers = 0.5 (idle)", () => {
  assert.equal(streamHealth(createStreamReplayer()), 0.5);
});

test("streamHealth: subscribers + emitted boosts", () => {
  let s = createStreamReplayer();
  s = subscribe(s, "a", {});
  s = subscribe(s, "b", {});
  s = { ...s, totalEmitted: 100 };
  // 0.5 + 0.2 (2 subs, capped 0.4) + 0.1 (emitted>0) = 0.8
  assert.ok(Math.abs(streamHealth(s) - 0.8) < 1e-9);
});
