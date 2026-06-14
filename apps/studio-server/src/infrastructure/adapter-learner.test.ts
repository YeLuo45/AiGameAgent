// V25 AdapterLearner (Direction E 25/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAdapterLearner,
  recordOutcome,
  getScore,
  pickBest,
  readyProviders,
  resetLearner,
  learningCoverage,
} from "./adapter-learner.js";

test("createAdapterLearner: defaults", () => {
  const s = createAdapterLearner();
  assert.equal(Object.keys(s.scores).length, 0);
  assert.equal(s.alpha, 0.3);
  assert.equal(s.minAttempts, 5);
});

test("recordOutcome: creates score on first call", () => {
  let s = createAdapterLearner();
  s = recordOutcome(s, "a1", "text", true, 100);
  const sc = getScore(s, "a1", "text");
  assert.ok(sc);
  assert.equal(sc?.attempts, 1);
  assert.equal(sc?.successes, 1);
  assert.equal(sc?.successRate, 1);
  assert.equal(sc?.avgLatencyMs, 100);
});

test("recordOutcome: failure case", () => {
  let s = createAdapterLearner();
  s = recordOutcome(s, "a1", "text", false, 200);
  const sc = getScore(s, "a1", "text");
  assert.equal(sc?.attempts, 1);
  assert.equal(sc?.successes, 0);
  assert.equal(sc?.successRate, 0);
});

test("recordOutcome: EWMA decay", () => {
  let s = createAdapterLearner(0.5, 1);
  s = recordOutcome(s, "a1", "text", true, 100); // 1.0
  s = recordOutcome(s, "a1", "text", false, 200); // 0.5 * 0 + 1 * 0.5 = 0.5
  const sc = getScore(s, "a1", "text");
  assert.equal(sc?.successRate, 0.5);
});

test("recordOutcome: latency tracking", () => {
  let s = createAdapterLearner(0.5, 1);
  s = recordOutcome(s, "a1", "text", true, 100);
  s = recordOutcome(s, "a1", "text", true, 200);
  // EWMA: 0.5*100 + 0.5*200 = 150
  assert.equal(getScore(s, "a1", "text")?.avgLatencyMs, 150);
});

test("pickBest: insufficient data = null", () => {
  let s = createAdapterLearner(0.3, 5);
  s = recordOutcome(s, "a1", "text", true, 100); // only 1 attempt, need 5
  assert.equal(pickBest(s, "text", ["a1", "a2"]), null);
});

test("pickBest: returns highest composite", () => {
  let s = createAdapterLearner(0.5, 1);
  s = recordOutcome(s, "a1", "text", true, 100); // successRate 1, latency 100 → 1 - 0.01 = 0.99
  s = recordOutcome(s, "a2", "text", false, 500); // successRate 0, latency 500 → 0 - 0.05 = -0.05
  assert.equal(pickBest(s, "text", ["a1", "a2"]), "a1");
});

test("pickBest: considers latency in composite", () => {
  let s = createAdapterLearner(0.5, 1);
  s = recordOutcome(s, "fast", "text", true, 100); // 1 - 0.01 = 0.99
  s = recordOutcome(s, "slow", "text", true, 5000); // 1 - 0.5 = 0.5
  assert.equal(pickBest(s, "text", ["fast", "slow"]), "fast");
});

test("pickBest: empty candidates = null", () => {
  assert.equal(pickBest(createAdapterLearner(), "text", []), null);
});

test("pickBest: filters by taskKind", () => {
  let s = createAdapterLearner(0.5, 1);
  s = recordOutcome(s, "a1", "text", true, 100);
  s = recordOutcome(s, "a1", "code", false, 200);
  assert.equal(pickBest(s, "text", ["a1"]), "a1");
  // For code, successRate = 0, composite = -0.02, so it might still be selected
  // since it's the only candidate
  assert.equal(pickBest(s, "code", ["a1"]), "a1");
});

test("readyProviders: returns only those with enough data", () => {
  let s = createAdapterLearner(0.3, 2);
  s = recordOutcome(s, "a1", "text", true, 100); // 1 attempt
  assert.deepEqual(readyProviders(s, "text"), []);
  s = recordOutcome(s, "a1", "text", true, 100); // 2 attempts
  assert.deepEqual(readyProviders(s, "text"), ["a1"]);
});

test("resetLearner: clears all scores", () => {
  let s = createAdapterLearner();
  s = recordOutcome(s, "a1", "text", true, 100);
  s = resetLearner(s);
  assert.equal(Object.keys(s.scores).length, 0);
});

test("learningCoverage: empty = 1.0", () => {
  assert.equal(learningCoverage(createAdapterLearner(), [], []), 1.0);
});

test("learningCoverage: 1/2 ready = 0.5", () => {
  let s = createAdapterLearner(0.3, 1);
  s = recordOutcome(s, "a1", "text", true, 100);
  assert.equal(learningCoverage(s, ["a1", "a2"], ["text", "code"]), 0.25);
});

test("learningCoverage: all ready = 1.0", () => {
  let s = createAdapterLearner(0.3, 1);
  s = recordOutcome(s, "a1", "text", true, 100);
  s = recordOutcome(s, "a2", "text", true, 100);
  s = recordOutcome(s, "a1", "code", true, 100);
  s = recordOutcome(s, "a2", "code", true, 100);
  assert.equal(learningCoverage(s, ["a1", "a2"], ["text", "code"]), 1.0);
});
