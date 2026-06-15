// V11 PerformanceTracker (Direction D 11/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPerformanceTracker,
  recordTask,
  getMetric,
  listMetrics,
  topPerformers,
  underPerformers,
  clearMetric,
  systemPerformance,
} from "./performance-tracker.js";

test("createPerformanceTracker: empty", () => {
  const s = createPerformanceTracker();
  assert.equal(Object.keys(s.metrics).length, 0);
  assert.equal(s.alpha, 0.3);
});

test("recordTask: creates metric", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "a1", true, 100);
  const m = getMetric(s, "a1");
  assert.equal(m?.tasksAttempted, 1);
  assert.equal(m?.tasksSucceeded, 1);
  assert.equal(m?.ewmaSuccess, 1);
});

test("recordTask: failure EWMA updates", () => {
  let s = createPerformanceTracker(0.5, 100);
  s = recordTask(s, "a1", true, 100); // 1.0
  s = recordTask(s, "a1", false, 100); // 0.5*1 + 0.5*0 = 0.5
  assert.equal(getMetric(s, "a1").ewmaSuccess, 0.5);
});

test("recordTask: duration EWMA", () => {
  let s = createPerformanceTracker(0.5);
  s = recordTask(s, "a1", true, 100);
  s = recordTask(s, "a1", true, 200);
  // 0.5*100 + 0.5*200 = 150
  assert.equal(getMetric(s, "a1").ewmaDurationMs, 150);
});

test("recordTask: updates lastActiveAt", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "a1", true, 100, 5000);
  assert.equal(getMetric(s, "a1").lastActiveAt, 5000);
});

test("getMetric: undefined for missing", () => {
  assert.equal(getMetric(createPerformanceTracker(), "x"), undefined);
});

test("listMetrics: sorted by ewmaSuccess desc", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "low", false, 100);
  s = recordTask(s, "high", true, 100);
  const list = listMetrics(s);
  assert.equal(list[0].agentId, "high");
});

test("topPerformers: limit N", () => {
  let s = createPerformanceTracker();
  for (const a of ["a", "b", "c"]) s = recordTask(s, a, true, 100);
  assert.equal(topPerformers(s, 2).length, 2);
});

test("underPerformers: below threshold + min attempts", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "good", true, 100);
  for (let i = 0; i < 5; i++) s = recordTask(s, "bad", false, 100);
  const u = underPerformers(s, 0.5);
  assert.equal(u.length, 1);
  assert.equal(u[0].agentId, "bad");
});

test("underPerformers: ignores <3 attempts", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "new", false, 100);
  s = recordTask(s, "new", false, 100);
  assert.equal(underPerformers(s, 0.5).length, 0);
});

test("clearMetric: removes", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "a1", true, 100);
  s = clearMetric(s, "a1");
  assert.equal(s.metrics.a1, undefined);
});

test("systemPerformance: 1.0 empty", () => {
  assert.equal(systemPerformance(createPerformanceTracker()), 1.0);
});

test("systemPerformance: avg", () => {
  let s = createPerformanceTracker();
  s = recordTask(s, "a", true, 100);
  s = recordTask(s, "a", true, 100);
  s = recordTask(s, "b", false, 100);
  s = recordTask(s, "b", false, 100);
  // a = 1.0, b = 0.0 → avg 0.5
  assert.equal(systemPerformance(s), 0.5);
});
