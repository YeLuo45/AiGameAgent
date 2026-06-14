// V20 RetentionPolicy (Direction E 20/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planRetention,
  applyRetention,
  retentionEfficiency,
} from "./retention-policy.js";

test("planRetention: keep-all", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const r = planRetention(items, Date.now(), { rule: "keep-all" });
  assert.equal(r.evictIds.length, 0);
  assert.equal(r.remaining, 3);
});

test("planRetention: evict-old by age", () => {
  const now = Date.now();
  const items = [
    { id: 1, ts: now - 10 * 24 * 60 * 60 * 1000 }, // 10 days old
    { id: 2, ts: now - 1 * 24 * 60 * 60 * 1000 },  // 1 day old
  ];
  const r = planRetention(items, now, { rule: "evict-old", maxAgeMs: 7 * 24 * 60 * 60 * 1000 });
  assert.deepEqual(r.evictIds, [1]);
  assert.equal(r.remaining, 1);
});

test("planRetention: evict-old by count", () => {
  const now = Date.now();
  const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, ts: now - (100 - i) * 1000 }));
  const r = planRetention(items, now, { rule: "evict-old", maxAgeMs: 99999999, maxCount: 50 });
  assert.equal(r.evictIds.length, 50);
  assert.equal(r.remaining, 50);
});

test("planRetention: evict-old with string ts", () => {
  const now = Date.now();
  const items = [
    { id: 1, ts: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 2, ts: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() },
  ];
  const r = planRetention(items, now, { rule: "evict-old", maxAgeMs: 7 * 24 * 60 * 60 * 1000 });
  assert.deepEqual(r.evictIds, [1]);
});

test("planRetention: compact-summary triggers when over threshold", () => {
  const now = Date.now();
  const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, ts: now }));
  const r = planRetention(items, now, { rule: "compact-summary", compactThreshold: 50, compactTarget: 30 });
  assert.equal(r.evictIds.length, 70);
  assert.equal(r.remaining, 30);
  assert.ok(r.compactedSummary && r.compactedSummary.includes("Compacted 70"));
});

test("planRetention: compact-summary under threshold no-op", () => {
  const now = Date.now();
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, ts: now }));
  const r = planRetention(items, now, { rule: "compact-summary", compactThreshold: 50, compactTarget: 30 });
  assert.equal(r.evictIds.length, 0);
  assert.equal(r.compactedSummary, null);
});

test("planRetention: archive-then-evict by age", () => {
  const now = Date.now();
  const items = [
    { id: 1, ts: now - 100 * 24 * 60 * 60 * 1000 }, // 100 days
    { id: 2, ts: now - 1 * 24 * 60 * 60 * 1000 },
  ];
  const r = planRetention(items, now, { rule: "archive-then-evict", maxAgeMs: 30 * 24 * 60 * 60 * 1000 });
  assert.deepEqual(r.evictIds, [1]);
});

test("applyRetention: removes evicted", () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const result = applyRetention(items, { evictIds: [2], compactedSummary: null, archivedCount: 1, remaining: 2 });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((x) => x.id), [1, 3]);
});

test("applyRetention: no eviction = unchanged", () => {
  const items = [{ id: 1 }, { id: 2 }];
  const result = applyRetention(items, { evictIds: [], compactedSummary: null, archivedCount: 0, remaining: 2 });
  assert.equal(result.length, 2);
});

test("retentionEfficiency: empty = 1.0", () => {
  assert.equal(retentionEfficiency({ evictIds: [], compactedSummary: null, archivedCount: 0, remaining: 0 }, 0), 1.0);
});

test("retentionEfficiency: all evicted = 0.3", () => {
  assert.equal(retentionEfficiency({ evictIds: [1, 2], compactedSummary: null, archivedCount: 2, remaining: 0 }, 2), 0.3);
});

test("retentionEfficiency: balanced (50%) = 0.8", () => {
  assert.ok(Math.abs(retentionEfficiency({ evictIds: [1, 2, 3, 4, 5], compactedSummary: null, archivedCount: 5, remaining: 5 }, 10) - 0.8) < 1e-9);
});

test("retentionEfficiency: < 10% retention = 0.3", () => {
  // remaining=1, original=20 → 0.05 retention → 0.3
  assert.equal(retentionEfficiency({ evictIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], compactedSummary: null, archivedCount: 19, remaining: 1 }, 20), 0.3);
});

test("retentionEfficiency: 10-95% retention = 0.7-0.9", () => {
  // 0.9 retention → 0.7 + 0.9*0.2 = 0.88
  assert.ok(Math.abs(retentionEfficiency({ evictIds: [1], compactedSummary: null, archivedCount: 1, remaining: 9 }, 10) - 0.88) < 1e-9);
});

test("retentionEfficiency: high retention (98%) = 0.9", () => {
  // 0.98 > 0.95 → returns 0.9
  const eff = retentionEfficiency({ evictIds: [1, 2], compactedSummary: null, archivedCount: 2, remaining: 98 }, 100);
  assert.equal(eff, 0.9);
});
