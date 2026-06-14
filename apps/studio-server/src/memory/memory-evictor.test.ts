// V10 MemoryEvictor (Direction A 10/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evictByPolicy,
  touchEntry,
  evictionEfficiency,
} from "./memory-evictor.js";

function makeEntry(id: string, ts: number, size: number = 100, ttlMs?: number, lastAccessedAt: number = ts): ReturnType<typeof makeEntryStub> {
  return { id, ts, size, lastAccessedAt, accessCount: 1, ttlMs };
}
function makeEntryStub(): { id: string; ts: number; size: number; lastAccessedAt: number; accessCount: number; ttlMs?: number } {
  return { id: "x", ts: 0, size: 0, lastAccessedAt: 0, accessCount: 0 };
}

test("evictByPolicy: none = no change", () => {
  const r = evictByPolicy([makeEntry("1", 1)], "none");
  assert.equal(r.evictedIds.length, 0);
  assert.equal(r.reason, "policy-none");
});

test("evictByPolicy: TTL expired", () => {
  const now = 10000;
  const r = evictByPolicy([
    makeEntry("1", 1, 100, 100), // expired (1+100 < 10000)
    makeEntry("2", 1, 100, 100000), // fresh
  ], "ttl", { now });
  assert.deepEqual(r.evictedIds, ["1"]);
  assert.equal(r.reason, "ttl");
});

test("evictByPolicy: LRU by lastAccessedAt", () => {
  const r = evictByPolicy([
    makeEntry("old", 1, 100, undefined, 100), // least recent
    makeEntry("mid", 2, 100, undefined, 200),
    makeEntry("new", 3, 100, undefined, 300),
  ], "lru", { maxCount: 2, now: 1000 });
  assert.deepEqual(r.evictedIds, ["old"]);
  assert.equal(r.reason, "lru");
});

test("evictByPolicy: FIFO by ts", () => {
  const r = evictByPolicy([
    makeEntry("a", 1),
    makeEntry("b", 2),
    makeEntry("c", 3),
  ], "fifo", { maxCount: 2, now: 100 });
  assert.deepEqual(r.evictedIds, ["a"]);
  assert.equal(r.reason, "fifo");
});

test("evictByPolicy: size cap", () => {
  const r = evictByPolicy([
    makeEntry("a", 1, 100, undefined, 100),
    makeEntry("b", 2, 200, undefined, 200),
    makeEntry("c", 3, 300, undefined, 300),
  ], "lru", { maxSize: 300, now: 1000 });
  // 100 + 200 + 300 = 600 > 300. Evict in LRU order (a is LRU).
  assert.ok(r.evictedIds.includes("a"));
  assert.equal(r.reason, "size");
});

test("evictByPolicy: ttl-lru combined", () => {
  const now = 10000;
  const r = evictByPolicy([
    makeEntry("1", 1, 100, 100, 100), // TTL expired
    makeEntry("2", 1, 100, undefined, 100), // LRU candidate
    makeEntry("3", 1, 100, undefined, 200),
  ], "ttl-lru", { maxCount: 1, now });
  assert.ok(r.evictedIds.includes("1"));
  assert.ok(r.evictedIds.includes("2"));
});

test("evictByPolicy: under limits = no eviction", () => {
  const r = evictByPolicy([makeEntry("a", 1), makeEntry("b", 2)], "lru", { maxCount: 5, now: 100 });
  assert.equal(r.evictedIds.length, 0);
});

test("touchEntry: updates lastAccessedAt + accessCount", () => {
  const e = makeEntry("a", 1);
  const t = touchEntry(e, 100);
  assert.equal(t.lastAccessedAt, 100);
  assert.equal(t.accessCount, 2);
});

test("evictionEfficiency: 1.0 with empty input", () => {
  assert.equal(evictionEfficiency({ evictedIds: [], remaining: 0, totalSizeBefore: 0, totalSizeAfter: 0, reason: "policy-none" }), 1.0);
});

test("evictionEfficiency: ratio", () => {
  assert.equal(evictionEfficiency({ evictedIds: ["a"], remaining: 1, totalSizeBefore: 200, totalSizeAfter: 100, reason: "lru" }), 0.5);
});
