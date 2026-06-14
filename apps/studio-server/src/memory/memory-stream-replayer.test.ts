// V14 MemoryStreamReplayer (Direction A 14/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryStreamReplay,
  recordMemoryEvent,
  queryMemoryEvents,
  subscribeMemoryEvents,
  unsubscribeMemoryEvents,
  countByLayer,
  countByOp,
  streamActivity,
} from "./memory-stream-replayer.js";

test("createMemoryStreamReplay: empty", () => {
  const s = createMemoryStreamReplay();
  assert.equal(s.events.length, 0);
  assert.equal(s.subscribers.length, 0);
});

test("recordMemoryEvent: adds with id + ts", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "user" });
  assert.equal(s.events[0].id, 1);
  assert.ok(s.events[0].ts > 0);
});

test("queryMemoryEvents: by layer", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "u" });
  s = recordMemoryEvent(s, { layer: "L1", op: "append", targetId: "c1", actor: "u" });
  assert.equal(queryMemoryEvents(s, { layer: "L0" }).length, 1);
});

test("queryMemoryEvents: by op", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "u" });
  s = recordMemoryEvent(s, { layer: "L0", op: "delete", targetId: "e1", actor: "u" });
  assert.equal(queryMemoryEvents(s, { op: "delete" }).length, 1);
});

test("queryMemoryEvents: by actor", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "alice" });
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e2", actor: "bob" });
  assert.equal(queryMemoryEvents(s, { actor: "alice" }).length, 1);
});

test("queryMemoryEvents: by since", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "u" });
  // Small delay to ensure ts differs
  const since = Date.now() + 1;
  // Force at least 1ms gap by setting ts manually
  s = { ...s, events: [...s.events, { ...s.events[s.events.length - 1], id: 2, ts: since + 10, targetId: "e2" }] };
  const r = queryMemoryEvents(s, { since });
  assert.equal(r.length, 1);
  assert.equal(r[0].targetId, "e2");
});

test("subscribeMemoryEvents: adds", () => {
  let s = createMemoryStreamReplay();
  s = subscribeMemoryEvents(s, "sub1");
  assert.deepEqual(s.subscribers, ["sub1"]);
});

test("subscribeMemoryEvents: idempotent", () => {
  let s = createMemoryStreamReplay();
  s = subscribeMemoryEvents(s, "sub1");
  s = subscribeMemoryEvents(s, "sub1");
  assert.equal(s.subscribers.length, 1);
});

test("unsubscribeMemoryEvents: removes", () => {
  let s = createMemoryStreamReplay();
  s = subscribeMemoryEvents(s, "sub1");
  s = unsubscribeMemoryEvents(s, "sub1");
  assert.equal(s.subscribers.length, 0);
});

test("countByLayer: aggregate", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "u" });
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e2", actor: "u" });
  s = recordMemoryEvent(s, { layer: "L1", op: "update", targetId: "c1", actor: "u" });
  const c = countByLayer(s);
  assert.equal(c["L0"], 2);
  assert.equal(c["L1"], 1);
});

test("countByOp: aggregate", () => {
  let s = createMemoryStreamReplay();
  s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: "e1", actor: "u" });
  s = recordMemoryEvent(s, { layer: "L0", op: "clear", targetId: "all", actor: "u" });
  const c = countByOp(s);
  assert.equal(c["append"], 1);
  assert.equal(c["clear"], 1);
});

test("streamActivity: 0 empty", () => {
  assert.equal(streamActivity(createMemoryStreamReplay()), 0);
});

test("streamActivity: scales with events + subscribers", () => {
  let s = createMemoryStreamReplay();
  for (let i = 0; i < 50; i++) s = recordMemoryEvent(s, { layer: "L0", op: "append", targetId: `e${i}`, actor: "u" });
  s = subscribeMemoryEvents(s, "sub1");
  s = subscribeMemoryEvents(s, "sub2");
  assert.ok(streamActivity(s) > 0);
});
