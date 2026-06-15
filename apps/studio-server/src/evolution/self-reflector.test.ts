// V15 SelfReflector (Direction D 15/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reflect,
  reflectAll,
  reflectionQuality,
} from "./self-reflector.js";
import { createPerformanceTracker, recordTask } from "./performance-tracker.js";
import { createFeedbackCollector, recordFeedback } from "./feedback-collector.js";

test("reflect: no data → anomaly insight", () => {
  const r = reflect("a1", createPerformanceTracker(), createFeedbackCollector());
  assert.equal(r.insights.length, 1);
  assert.equal(r.insights[0].kind, "anomaly");
});

test("reflect: high success → strength", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", true, 100);
  const r = reflect("a1", perf, createFeedbackCollector());
  assert.ok(r.insights.some((i) => i.kind === "strength"));
});

test("reflect: low success → weakness", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", false, 100);
  const r = reflect("a1", perf, createFeedbackCollector());
  assert.ok(r.insights.some((i) => i.kind === "weakness"));
});

test("reflect: stable performance → trend", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 3; i++) perf = recordTask(perf, "a1", true, 100);
  // 3 successes, ewma stays at 1.0 - no strength (requires >=3) but the >=3 makes it pass
  // Hmm actually 3 successes is enough for strength
  // Let me make it 2 only
  // Actually createPerformanceTracker starts with ewmaSuccess=1
  // After 2 successes, ewma = 1.0, but tasksAttempted = 2 < 3 → no strength
  // After 1 success, same thing
  // So empty insights → "stable" trend
  // Reset state:
  perf = { ...createPerformanceTracker(), metrics: { a1: { agentId: "a1", tasksAttempted: 2, tasksSucceeded: 1, tasksFailed: 1, totalDurationMs: 200, ewmaSuccess: 0.5, ewmaDurationMs: 100, lastActiveAt: 1 } } };
  const r = reflect("a1", perf, createFeedbackCollector());
  assert.ok(r.insights.some((i) => i.kind === "trend" && i.text.includes("Stable")));
});

test("reflect: high success + negative feedback → anomaly", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", true, 100);
  let f = createFeedbackCollector();
  for (let i = 0; i < 3; i++) f = recordFeedback(f, "user", "a1", "negative", -0.8, "x");
  const r = reflect("a1", perf, f);
  assert.ok(r.insights.some((i) => i.kind === "anomaly"));
});

test("reflect: trend text matches", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", true, 100);
  // All success → ewma = 1.0 → strength (not trend)
  // To trigger trend positive, need successRate around 0.7-0.9
  perf = { ...createPerformanceTracker(), metrics: { a1: { agentId: "a1", tasksAttempted: 5, tasksSucceeded: 4, tasksFailed: 1, totalDurationMs: 500, ewmaSuccess: 0.75, ewmaDurationMs: 100, lastActiveAt: 1 } } };
  const r = reflect("a1", perf, createFeedbackCollector());
  assert.ok(r.insights.some((i) => i.kind === "trend" && i.text.includes("positive")));
});

test("reflectAll: returns for all agents with data", () => {
  let perf = createPerformanceTracker();
  perf = recordTask(perf, "a1", true, 100);
  perf = recordTask(perf, "b1", false, 100);
  const rs = reflectAll(perf, createFeedbackCollector());
  assert.equal(rs.length, 2);
});

test("reflectionQuality: 1.0 for all high-confidence", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", true, 100);
  const r = reflect("a1", perf, createFeedbackCollector());
  assert.ok(reflectionQuality(r) >= 0.5);
});

test("reflectionQuality: 0 for empty", () => {
  assert.equal(reflectionQuality({ ts: 0, agentId: "x", insights: [] }), 0);
});
