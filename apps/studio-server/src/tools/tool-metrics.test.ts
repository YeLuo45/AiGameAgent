// V26 ToolMetrics (Direction B 26/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createToolMetrics,
  recordInvocation,
  getStat,
  listStats,
  clearStats,
  topByInvocations,
  slowestTools,
  toolEcosystemHealth,
} from "./tool-metrics.js";

test("createToolMetrics: empty", () => {
  const s = createToolMetrics();
  assert.equal(Object.keys(s.stats).length, 0);
});

test("recordInvocation: creates stat", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "Read", true, 100);
  const stat = getStat(s, "Read");
  assert.ok(stat);
  assert.equal(stat.invocations, 1);
  assert.equal(stat.successes, 1);
  assert.equal(stat.failures, 0);
});

test("recordInvocation: failure", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "Read", false, 100, "file not found");
  const stat = getStat(s, "Read");
  assert.equal(stat.failures, 1);
  assert.equal(stat.lastError, "file not found");
});

test("recordInvocation: EWMA updates", () => {
  let s = createToolMetrics(0.5, 100);
  s = recordInvocation(s, "X", true, 100);
  s = recordInvocation(s, "X", true, 200);
  // EWMA: 0.5*100 + 0.5*200 = 150
  assert.equal(getStat(s, "X").ewmaDurationMs, 150);
});

test("recordInvocation: success rate EWMA", () => {
  let s = createToolMetrics(0.5, 100);
  s = recordInvocation(s, "X", true, 100); // 1.0
  s = recordInvocation(s, "X", false, 100); // 0.5*1 + 0.5*0 = 0.5
  assert.equal(getStat(s, "X").successRate, 0.5);
});

test("recordInvocation: updates lastInvokedAt", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "X", true, 100, undefined, 5000);
  assert.equal(getStat(s, "X").lastInvokedAt, 5000);
});

test("getStat: returns undefined for missing", () => {
  assert.equal(getStat(createToolMetrics(), "X"), undefined);
});

test("listStats: sorted by invocations desc", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "a", true, 10);
  s = recordInvocation(s, "b", true, 10);
  s = recordInvocation(s, "b", true, 10);
  s = recordInvocation(s, "c", true, 10);
  s = recordInvocation(s, "c", true, 10);
  s = recordInvocation(s, "c", true, 10);
  const list = listStats(s);
  assert.equal(list[0].toolName, "c");
});

test("clearStats: empty", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "X", true, 10);
  s = clearStats(s);
  assert.equal(Object.keys(s.stats).length, 0);
});

test("topByInvocations: limit N", () => {
  let s = createToolMetrics();
  for (const n of ["a", "b", "c"]) for (let i = 0; i < 3; i++) s = recordInvocation(s, n, true, 10);
  assert.equal(topByInvocations(s, 2).length, 2);
});

test("slowestTools: sorted by EWMA", () => {
  let s = createToolMetrics();
  s = recordInvocation(s, "fast", true, 50);
  s = recordInvocation(s, "slow", true, 500);
  const slow = slowestTools(s, 2);
  assert.equal(slow[0].toolName, "slow");
});

test("toolEcosystemHealth: 1.0 empty", () => {
  assert.equal(toolEcosystemHealth(createToolMetrics()), 1.0);
});

test("toolEcosystemHealth: avg success rate", () => {
  let s = createToolMetrics(0.3, 100);
  s = recordInvocation(s, "a", true, 10); // 1.0
  s = recordInvocation(s, "a", true, 10); // 1.0 (stays 1.0)
  s = recordInvocation(s, "b", false, 10); // 0
  // avg = (1.0 + 0) / 2 = 0.5
  assert.equal(toolEcosystemHealth(s), 0.5);
});
