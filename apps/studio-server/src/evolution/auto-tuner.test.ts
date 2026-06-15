// V16 AutoTuner (Direction D 16/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTunerState,
  setParam,
  getParam,
  setTarget,
  tuneToward,
  autoTune,
  recentTrend,
  tuningStability,
} from "./auto-tuner.js";

test("createTunerState: empty", () => {
  const s = createTunerState();
  assert.equal(Object.keys(s.params).length, 0);
});

test("setParam: clamps to range", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5, 0, 1);
  s = setParam(s, "x", 1.5, 0, 1);
  assert.equal(getParam(s, "x").value, 1);
  s = setParam(s, "x", -0.5, 0, 1);
  assert.equal(getParam(s, "x").value, 0);
});

test("setParam: tracks history (last 5)", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.1);
  s = setParam(s, "x", 0.2);
  s = setParam(s, "x", 0.3);
  assert.equal(getParam(s, "x").history.length, 2);
});

test("setTarget: sets target", () => {
  let s = createTunerState();
  s = setTarget(s, "x", 0.9);
  assert.equal(s.targets.x, 0.9);
});

test("tuneToward: no target = no change", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5);
  const s2 = tuneToward(s, "x", 0.7);
  assert.equal(s2.params.x.value, 0.5);
});

test("tuneToward: adjusts up when below target", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5, 0, 1);
  s = setTarget(s, "x", 0.9);
  const s2 = tuneToward(s, "x", 0.5); // current metric = 0.5, target = 0.9, error = 0.4
  // adjustment = 0.5 * 0.1 * 0.4 = 0.02
  assert.ok(s2.params.x.value > 0.5);
});

test("tuneToward: adjusts down when above target", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.9, 0, 1);
  s = setTarget(s, "x", 0.5);
  const s2 = tuneToward(s, "x", 0.9);
  assert.ok(s2.params.x.value < 0.9);
});

test("autoTune: multiple params", () => {
  let s = createTunerState();
  s = setParam(s, "a", 0.5, 0, 1);
  s = setParam(s, "b", 0.5, 0, 1);
  s = setTarget(s, "a", 0.8);
  s = setTarget(s, "b", 0.3);
  const s2 = autoTune(s, { a: 0.5, b: 0.5 });
  assert.ok(s2.params.a.value > 0.5); // up
  assert.ok(s2.params.b.value < 0.5); // down
});

test("recentTrend: unknown for insufficient data", () => {
  const s = createTunerState();
  assert.equal(recentTrend(s, "x"), "unknown");
});

test("recentTrend: up", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.1);
  s = setParam(s, "x", 0.2);
  s = setParam(s, "x", 0.4); // 3 setParams = 2 history entries (0.1, 0.2)
  assert.equal(recentTrend(s, "x"), "up");
});

test("recentTrend: down", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5);
  s = setParam(s, "x", 0.3);
  s = setParam(s, "x", 0.1); // 3 setParams = 2 history entries
  assert.equal(recentTrend(s, "x"), "down");
});

test("recentTrend: stable", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5);
  s = setParam(s, "x", 0.51);
  s = setParam(s, "x", 0.52); // small change
  assert.equal(recentTrend(s, "x"), "stable");
});

test("tuningStability: 1.0 for empty", () => {
  assert.equal(tuningStability(createTunerState()), 1.0);
});

test("tuningStability: high with stable params", () => {
  let s = createTunerState();
  s = setParam(s, "x", 0.5);
  s = setParam(s, "x", 0.51);
  assert.ok(tuningStability(s) > 0.9);
});
