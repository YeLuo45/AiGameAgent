// V5 CounterMetric (Direction F 5/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCounter, increment, decrement, reset, setLabel, getLabel, rate, counterActivity } from "./counter-metric.js";

test("createCounter: defaults", () => {
  const m = createCounter("c1");
  assert.equal(m.name, "c1");
  assert.equal(m.value, 0);
  assert.deepEqual(m.labels, {});
});

test("createCounter: with help + labels", () => {
  const m = createCounter("c1", { help: "Total", labels: ["env", "ver"] });
  assert.equal(m.help, "Total");
  assert.deepEqual(Object.keys(m.labels), ["env", "ver"]);
});

test("increment: by 1 default", () => {
  let m = createCounter("c");
  m = increment(m);
  assert.equal(m.value, 1);
});

test("increment: by N", () => {
  let m = createCounter("c");
  m = increment(m, 5);
  assert.equal(m.value, 5);
});

test("decrement: subtracts", () => {
  let m = createCounter("c");
  m = increment(m, 10);
  m = decrement(m, 3);
  assert.equal(m.value, 7);
});

test("reset: zero", () => {
  let m = createCounter("c");
  m = increment(m, 100);
  m = reset(m);
  assert.equal(m.value, 0);
});

test("setLabel + getLabel", () => {
  let m = createCounter("c", { labels: ["env"] });
  m = setLabel(m, "env", "prod");
  assert.equal(getLabel(m, "env"), "prod");
});

test("rate: per second", () => {
  const m = createCounter("c");
  // m.value=0 (no increment), rate=0
  assert.equal(rate(m, 1000), 0);
});

test("rate: with increments", () => {
  let m = createCounter("c");
  m = increment(m, 100);
  // 100 / (1000/1000) = 100/sec
  assert.equal(rate(m, 1000), 100);
});

test("counterActivity: 0 for 0", () => {
  assert.equal(counterActivity(createCounter("c")), 0);
});

test("counterActivity: 1 for non-zero", () => {
  let m = createCounter("c");
  m = increment(m, 1);
  assert.equal(counterActivity(m), 1);
});
