// V12 PatternLearner (Direction D 12/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPatternLearner,
  observe,
  getPattern,
  listPatterns,
  significantPatterns,
  clearPatterns,
  patternConfidence,
} from "./pattern-learner.js";

test("createPatternLearner: empty", () => {
  const s = createPatternLearner();
  assert.equal(Object.keys(s.patterns).length, 0);
  assert.equal(s.minOccurrences, 3);
});

test("observe: first occurrence", () => {
  let s = createPatternLearner();
  s = observe(s, "action-sequence", "read-then-write", true, "example 1");
  const p = getPattern(s, "action-sequence", "read-then-write");
  assert.equal(p?.occurrences, 1);
  assert.equal(p?.successRate, 1);
});

test("observe: increments occurrences", () => {
  let s = createPatternLearner();
  s = observe(s, "tool-usage", "Read", true, "a");
  s = observe(s, "tool-usage", "Read", true, "b");
  s = observe(s, "tool-usage", "Read", false, "c");
  const p = getPattern(s, "tool-usage", "Read");
  assert.equal(p?.occurrences, 3);
  assert.equal(p?.successRate, 2 / 3);
});

test("observe: caps examples at 5", () => {
  let s = createPatternLearner();
  for (let i = 0; i < 10; i++) s = observe(s, "tool-usage", "Read", true, `ex${i}`);
  const p = getPattern(s, "tool-usage", "Read");
  assert.equal(p?.examples.length, 5);
});

test("listPatterns: filter by kind", () => {
  let s = createPatternLearner();
  s = observe(s, "action-sequence", "a", true, "");
  s = observe(s, "tool-usage", "b", true, "");
  assert.equal(listPatterns(s, { kind: "tool-usage" }).length, 1);
});

test("listPatterns: filter by minSuccessRate", () => {
  let s = createPatternLearner();
  s = observe(s, "action-sequence", "a", true, "");
  s = observe(s, "action-sequence", "a", false, "");
  s = observe(s, "action-sequence", "b", true, "");
  s = observe(s, "action-sequence", "b", true, "");
  assert.equal(listPatterns(s, { minSuccessRate: 0.9 }).length, 1);
});

test("significantPatterns: requires minOccurrences", () => {
  let s = createPatternLearner(3);
  s = observe(s, "tool-usage", "Read", true, "");
  s = observe(s, "tool-usage", "Read", true, "");
  assert.equal(significantPatterns(s).length, 0);
  s = observe(s, "tool-usage", "Read", true, "");
  assert.equal(significantPatterns(s).length, 1);
});

test("clearPatterns: empty", () => {
  let s = createPatternLearner();
  s = observe(s, "tool-usage", "Read", true, "");
  s = clearPatterns(s);
  assert.equal(Object.keys(s.patterns).length, 0);
});

test("patternConfidence: 0 empty", () => {
  assert.equal(patternConfidence(createPatternLearner()), 0);
});

test("patternConfidence: avg of significant", () => {
  let s = createPatternLearner(2);
  s = observe(s, "tool-usage", "a", true, "");
  s = observe(s, "tool-usage", "a", true, "");
  s = observe(s, "tool-usage", "b", false, "");
  s = observe(s, "tool-usage", "b", false, "");
  // a = 1.0, b = 0.0 → avg 0.5
  assert.equal(patternConfidence(s), 0.5);
});
