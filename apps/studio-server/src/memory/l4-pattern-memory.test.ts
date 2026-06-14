// V5 L4PatternMemory (Direction A 5/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createL4PatternMemory,
  recordPattern,
  getPattern,
  getByCategory,
  decayOldPatterns,
  deletePattern,
  distinctCategories,
  patternKnowledge,
} from "./l4-pattern-memory.js";

test("createL4PatternMemory: empty", () => {
  const s = createL4PatternMemory();
  assert.equal(Object.keys(s.patterns).length, 0);
});

test("recordPattern: creates new", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "language", "zh", 1000);
  const p = getPattern(s, "preference", "language");
  assert.ok(p);
  assert.equal(p?.value, "zh");
  assert.equal(p?.confidence, 0.5);
  assert.equal(p?.observations, 1);
});

test("recordPattern: reinforces existing", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "language", "zh", 1000);
  s = recordPattern(s, "preference", "language", "zh", 2000);
  const p = getPattern(s, "preference", "language");
  assert.equal(p?.observations, 2);
  assert.equal(p?.confidence, 0.6);
  assert.equal(p?.ts, 2000);
});

test("recordPattern: confidence capped at 1", () => {
  let s = createL4PatternMemory();
  for (let i = 0; i < 20; i++) s = recordPattern(s, "preference", "language", "zh");
  assert.equal(getPattern(s, "preference", "language")?.confidence, 1);
});

test("recordPattern: evicts lowest confidence when over max", () => {
  let s = createL4PatternMemory(2);
  s = recordPattern(s, "preference", "a", "vA");
  s = recordPattern(s, "preference", "b", "vB");
  s = recordPattern(s, "preference", "c", "vC");
  // Lowest confidence (a = 0.5) should be evicted
  assert.equal(getPattern(s, "preference", "a"), undefined);
  assert.ok(getPattern(s, "preference", "b"));
  assert.ok(getPattern(s, "preference", "c"));
});

test("getByCategory: sorted by confidence desc", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "a", "vA");
  s = recordPattern(s, "preference", "a", "vA"); // reinforce
  s = recordPattern(s, "preference", "b", "vB");
  const list = getByCategory(s, "preference");
  assert.equal(list[0].key, "a");
});

test("getByCategory: excludes other categories", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "lang", "zh");
  s = recordPattern(s, "stylistic", "voice", "casual");
  assert.equal(getByCategory(s, "preference").length, 1);
  assert.equal(getByCategory(s, "stylistic").length, 1);
});

test("decayOldPatterns: reduces confidence by days", () => {
  const now = Date.now();
  const old = now - 86_400_000 * 10; // 10 days old
  let s = createL4PatternMemory(100, 0.05);
  s = recordPattern(s, "preference", "a", "vA", old);
  s = decayOldPatterns(s, now);
  // 0.5 - 10 * 0.05 = 0
  assert.equal(getPattern(s, "preference", "a"), undefined);
});

test("decayOldPatterns: keeps fresh", () => {
  const now = Date.now();
  let s = createL4PatternMemory(100, 0.05);
  s = recordPattern(s, "preference", "a", "vA", now - 1000);
  s = decayOldPatterns(s, now);
  assert.ok(getPattern(s, "preference", "a"));
});

test("deletePattern: removes by category+key", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "lang", "zh");
  s = deletePattern(s, "preference", "lang");
  assert.equal(getPattern(s, "preference", "lang"), undefined);
});

test("distinctCategories: sorted unique", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "lang", "zh");
  s = recordPattern(s, "stylistic", "voice", "casual");
  s = recordPattern(s, "preference", "format", "markdown");
  assert.deepEqual(distinctCategories(s), ["preference", "stylistic"]);
});

test("patternKnowledge: 0 empty", () => {
  assert.equal(patternKnowledge(createL4PatternMemory()), 0);
});

test("patternKnowledge: high with many patterns + categories", () => {
  let s = createL4PatternMemory();
  s = recordPattern(s, "preference", "a", "v");
  s = recordPattern(s, "preference", "a", "v"); // boost confidence
  s = recordPattern(s, "stylistic", "b", "v");
  s = recordPattern(s, "domain", "c", "v");
  // 3 patterns, confs: 0.6, 0.5, 0.5 → avg ≈ 0.533
  // 3 categories → 0.3
  // 0.533 * 0.7 + 0.3 = 0.373 + 0.3 = 0.673
  assert.ok(Math.abs(patternKnowledge(s) - 0.6733333333333333) < 1e-9);
});
