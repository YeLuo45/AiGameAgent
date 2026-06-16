// V9 AlertRule (Direction F 9/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRule, matchesRule, shouldFire, markFired, enableRule, disableRule, ruleCoverage } from "./alert-rule.js";

test("createRule: defaults", () => {
  const r = createRule("r1", "latency", ">", 1000);
  assert.equal(r.id, "r1");
  assert.equal(r.metric, "latency");
  assert.equal(r.op, ">");
  assert.equal(r.threshold, 1000);
  assert.equal(r.severity, "warn");
  assert.equal(r.enabled, true);
});

test("matchesRule: gt", () => {
  assert.equal(matchesRule(createRule("r", "m", ">", 100), 200), true);
  assert.equal(matchesRule(createRule("r", "m", ">", 100), 50), false);
});

test("matchesRule: gte/lte/lt", () => {
  assert.equal(matchesRule(createRule("r", "m", ">=", 100), 100), true);
  assert.equal(matchesRule(createRule("r", "m", "<=", 100), 100), true);
  assert.equal(matchesRule(createRule("r", "m", "<", 100), 99), true);
});

test("matchesRule: eq/ne", () => {
  assert.equal(matchesRule(createRule("r", "m", "==", 100), 100), true);
  assert.equal(matchesRule(createRule("r", "m", "==", 100), 101), false);
  assert.equal(matchesRule(createRule("r", "m", "!=", 100), 101), true);
});

test("matchesRule: disabled = false", () => {
  const r = disableRule(createRule("r", "m", ">", 100));
  assert.equal(matchesRule(r, 200), false);
});

test("shouldFire: never fired = true", () => {
  assert.equal(shouldFire(createRule("r", "m", ">", 100), 200), true);
});

test("shouldFire: cooled down", () => {
  let r = markFired(createRule("r", "m", ">", 100, "warn", { cooldownMs: 1000 }), 1000);
  assert.equal(shouldFire(r, 200, 2500), true);
  assert.equal(shouldFire(r, 200, 1500), false);
});

test("markFired: updates lastFiredAt", () => {
  const r = markFired(createRule("r", "m", ">", 100), 5000);
  assert.equal(r.lastFiredAt, 5000);
});

test("enableRule / disableRule: toggle", () => {
  const r = createRule("r", "m", ">", 100);
  assert.equal(disableRule(r).enabled, false);
  assert.equal(enableRule(disableRule(r)).enabled, true);
});

test("ruleCoverage: 0 for empty", () => {
  assert.equal(ruleCoverage([]), 0);
});

test("ruleCoverage: ratio", () => {
  const a = createRule("a", "m", ">", 100);
  const b = disableRule(createRule("b", "m", ">", 100));
  assert.equal(ruleCoverage([a, b]), 0.5);
});
