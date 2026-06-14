// V27 ToolCache (Direction B 27/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createToolCache,
  get,
  set,
  invalidate,
  clearCache,
  cacheStats,
  cacheEffectiveness,
} from "./tool-cache.js";

test("createToolCache: empty", () => {
  const s = createToolCache();
  assert.equal(s.entries.size, 0);
});

test("set + get: roundtrip", () => {
  let s = createToolCache();
  s = set(s, "k1", "v1");
  const r = get(s, "k1");
  assert.equal(r.hit, true);
  assert.equal(r.value, "v1");
});

test("get: miss for missing", () => {
  const s = createToolCache();
  const r = get(s, "k");
  assert.equal(r.hit, false);
});

test("get: TTL expired = miss", () => {
  let s = createToolCache();
  s = set(s, "k", "v", 1000, 1000);
  const r = get(s, "k", 3000);
  assert.equal(r.hit, false);
});

test("set: custom TTL = 0 = no expiration", () => {
  let s = createToolCache();
  s = set(s, "k", "v", 0);
  const entry = s.entries.get("k");
  assert.equal(entry?.expiresAt, null);
});

test("set: evicts oldest when over max", () => {
  let s = createToolCache(2, 1000);
  s = set(s, "a", 1);
  s = set(s, "b", 2);
  s = set(s, "c", 3);
  assert.equal(s.entries.size, 2);
  assert.equal(s.entries.has("a"), false);
});

test("invalidate: removes", () => {
  let s = createToolCache();
  s = set(s, "k", "v");
  s = invalidate(s, "k");
  assert.equal(s.entries.has("k"), false);
});

test("clearCache: empties", () => {
  let s = createToolCache();
  s = set(s, "a", 1);
  s = set(s, "b", 2);
  s = clearCache(s);
  assert.equal(s.entries.size, 0);
});

test("cacheStats: hitRate 0 when no traffic", () => {
  const stats = cacheStats(createToolCache());
  assert.equal(stats.hitRate, 0);
  assert.equal(stats.size, 0);
});

test("cacheStats: hitRate = 1.0 all hits", () => {
  let s = createToolCache();
  s = set(s, "k", "v");
  get(s, "k");
  get(s, "k");
  assert.equal(cacheStats(s).hitRate, 1.0);
});

test("cacheStats: hitRate = 0 all misses", () => {
  const s = createToolCache();
  get(s, "a");
  get(s, "b");
  assert.equal(cacheStats(s).hitRate, 0);
});

test("cacheEffectiveness: equals hitRate", () => {
  let s = createToolCache();
  s = set(s, "k", "v");
  get(s, "k");
  get(s, "missing");
  assert.equal(cacheEffectiveness(s), 0.5);
});
