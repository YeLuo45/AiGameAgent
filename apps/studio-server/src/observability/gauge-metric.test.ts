// V6 GaugeMetric (Direction F 6/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGauge, setGauge, addGauge, subGauge, gaugeRange, gaugeStability } from "./gauge-metric.js";

test("createGauge: defaults", () => {
  const m = createGauge("g");
  assert.equal(m.name, "g");
  assert.equal(m.value, 0);
  assert.equal(m.min, Infinity);
  assert.equal(m.max, -Infinity);
});

test("setGauge: updates + min/max", () => {
  let m = createGauge("g");
  m = setGauge(m, 50);
  m = setGauge(m, 20);
  m = setGauge(m, 80);
  assert.equal(m.value, 80);
  assert.equal(m.min, 20);
  assert.equal(m.max, 80);
});

test("setGauge: updates lastUpdateTs", () => {
  let m = createGauge("g");
  m = setGauge(m, 10, 5000);
  assert.equal(m.lastUpdateTs, 5000);
});

test("addGauge: positive", () => {
  let m = createGauge("g");
  m = setGauge(m, 10);
  m = addGauge(m, 5);
  assert.equal(m.value, 15);
});

test("subGauge: subtracts", () => {
  let m = createGauge("g");
  m = setGauge(m, 10);
  m = subGauge(m, 3);
  assert.equal(m.value, 7);
});

test("gaugeRange: 0 for no updates", () => {
  assert.equal(gaugeRange(createGauge("g")), 0);
});

test("gaugeRange: max - min", () => {
  let m = createGauge("g");
  m = setGauge(m, 5);
  m = setGauge(m, 15);
  assert.equal(gaugeRange(m), 10);
});

test("gaugeStability: 1.0 for no updates", () => {
  assert.equal(gaugeStability(createGauge("g")), 1.0);
});

test("gaugeStability: low with large range", () => {
  let m = createGauge("g");
  m = setGauge(m, 0);
  m = setGauge(m, 200);
  assert.ok(gaugeStability(m) < 0.5);
});
