// V12 EventReplayer (Direction E 12/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startReplay,
  nextBatch,
  replayAll,
  resumeFromCursor,
  snapshotCursor,
  estimateReplayDurationMs,
  replayProgress,
} from "./event-replayer.js";
import { createEventStore, appendEvent } from "./event-store.js";

function evStore(): ReturnType<typeof createEventStore> {
  let s = createEventStore();
  for (let i = 0; i < 5; i++) {
    s = appendEvent(s, { type: "x", sessionId: "s1", correlationId: `c${i}`, ts: "2026-06-14T00:00:00.000Z", payload: {} }).state;
  }
  return s;
}

test("startReplay: default from id 1", () => {
  const c = startReplay(createEventStore());
  assert.equal(c.currentId, 0);
  assert.equal(c.replayed, 0);
  assert.equal(c.done, false);
});

test("startReplay: from custom id", () => {
  const c = startReplay(createEventStore(), 10);
  assert.equal(c.currentId, 9);
});

test("nextBatch: emits batchSize events", () => {
  const s = evStore();
  const c0 = startReplay(s);
  const r = nextBatch(s, c0, 2);
  assert.equal(r.events.length, 2);
  assert.equal(r.cursor.currentId, 2);
  assert.equal(r.cursor.replayed, 2);
  assert.equal(r.cursor.done, false);
});

test("nextBatch: done when last batch < batchSize", () => {
  const s = evStore();
  const c0 = startReplay(s);
  const r1 = nextBatch(s, c0, 3);
  assert.equal(r1.events.length, 3);
  assert.equal(r1.cursor.done, false);
  const r2 = nextBatch(s, r1.cursor, 3);
  assert.equal(r2.events.length, 2);
  assert.equal(r2.cursor.done, true);
});

test("nextBatch: empty when no more events", () => {
  const s = evStore();
  const c0 = { currentId: 100, replayed: 0, startedAt: 0, lastBatchAt: null, done: false };
  const r = nextBatch(s, c0, 10);
  assert.equal(r.events.length, 0);
  assert.equal(r.cursor.currentId, 100);
  assert.equal(r.cursor.done, true);
});

test("nextBatch: with type filter", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c3", ts: "x", payload: {} }).state;
  const c0 = startReplay(s);
  const r = nextBatch(s, c0, 10, { type: "a" });
  assert.equal(r.events.length, 2);
});

test("nextBatch: with agentId filter", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "x", agentId: "a1", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "x", agentId: "a2", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  const c0 = startReplay(s);
  const r = nextBatch(s, c0, 10, { agentId: "a1" });
  assert.equal(r.events.length, 1);
});

test("replayAll: returns everything in one batch", () => {
  const s = evStore();
  const r = replayAll(s);
  assert.equal(r.events.length, 5);
  assert.equal(r.cursor.done, true);
  assert.equal(r.cursor.replayed, 5);
});

test("replayAll: with filter", () => {
  let s = createEventStore();
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c1", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "b", sessionId: "s1", correlationId: "c2", ts: "x", payload: {} }).state;
  s = appendEvent(s, { type: "a", sessionId: "s1", correlationId: "c3", ts: "x", payload: {} }).state;
  const r = replayAll(s, { type: "a" });
  assert.equal(r.events.length, 2);
});

test("replayAll: empty store", () => {
  const r = replayAll(createEventStore());
  assert.equal(r.events.length, 0);
  assert.equal(r.cursor.done, true);
});

test("resumeFromCursor: continues from saved position", () => {
  const s = evStore();
  const c0 = startReplay(s);
  const r1 = nextBatch(s, c0, 2);
  const saved = snapshotCursor(r1.cursor);
  const r2 = resumeFromCursor(s, saved, 10);
  assert.equal(r2.events.length, 3);
  assert.equal(r2.events[0].id, 3);
});

test("snapshotCursor: returns copy", () => {
  const c0 = startReplay(createEventStore());
  const c1 = snapshotCursor(c0);
  assert.deepEqual(c0, c1);
  assert.notEqual(c0, c1);
});

test("estimateReplayDurationMs: empty = 0", () => {
  assert.equal(estimateReplayDurationMs(createEventStore(), 10), 0);
});

test("estimateReplayDurationMs: 100 events, batch 10, 10ms/batch = 100ms", () => {
  let s = createEventStore();
  for (let i = 0; i < 100; i++) s = appendEvent(s, { type: "x", sessionId: "s", correlationId: `c${i}`, ts: "x", payload: {} }).state;
  assert.equal(estimateReplayDurationMs(s, 10, 10), 100);
});

test("replayProgress: 0.5 when half replayed", () => {
  const c = { currentId: 5, replayed: 5, startedAt: 0, lastBatchAt: null, done: false };
  assert.equal(replayProgress(c, 10), 0.5);
});

test("replayProgress: 1.0 for empty total", () => {
  assert.equal(replayProgress({ currentId: 0, replayed: 0, startedAt: 0, lastBatchAt: null, done: true }, 0), 1.0);
});

test("replayProgress: clamps to [0,1]", () => {
  const c = { currentId: 100, replayed: 100, startedAt: 0, lastBatchAt: null, done: true };
  assert.equal(replayProgress(c, 5), 1.0);
  const c2 = { currentId: 0, replayed: 0, startedAt: 0, lastBatchAt: null, done: false };
  assert.equal(replayProgress(c2, 100), 0);
});
