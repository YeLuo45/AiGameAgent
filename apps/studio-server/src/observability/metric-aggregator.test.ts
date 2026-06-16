// V8 MetricAggregator (Direction F 8/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAggregatorState, addObservation, getWindowed, windowedAverage, windowedRate, cleanupWindow, aggregationCoverage, WINDOW_MS } from "./metric-aggregator.js";

test("createAggregatorState: empty", () => {
  const s = createAggregatorState();
  assert.deepEqual(s.data, {});
});

test("addObservation: creates entry", () => {
  let s = createAggregatorState();
  s = addObservation(s, "rps", 1, "1m");
  assert.ok(getWindowed(s, "rps", "1m"));
});

test("addObservation: aggregates sum/count", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 2, "1m");
  s = addObservation(s, "x", 3, "1m");
  const w = getWindowed(s, "x", "1m")!;
  assert.equal(w.sum, 6);
  assert.equal(w.count, 3);
});

test("addObservation: min/max", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 5, "1m");
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 10, "1m");
  const w = getWindowed(s, "x", "1m")!;
  assert.equal(w.min, 1);
  assert.equal(w.max, 10);
});

test("getWindowed: undefined for missing", () => {
  assert.equal(getWindowed(createAggregatorState(), "x", "1m"), undefined);
});

test("windowedAverage: 0 for empty", () => {
  assert.equal(windowedAverage(createAggregatorState(), "x", "1m"), 0);
});

test("windowedAverage: avg", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 2, "1m");
  s = addObservation(s, "x", 4, "1m");
  assert.equal(windowedAverage(s, "x", "1m"), 3);
});

test("windowedRate: per second", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 1, "1m");
  assert.equal(windowedRate(s, "x", "1m"), 3 / 60);
});

test("cleanupWindow: removes window", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 1, "5m");
  s = cleanupWindow(s, "x", "1m");
  assert.equal(getWindowed(s, "x", "1m"), undefined);
  assert.ok(getWindowed(s, "x", "5m"));
});

test("aggregationCoverage: 0 empty", () => {
  assert.equal(aggregationCoverage(createAggregatorState()), 0);
});

test("aggregationCoverage: 1.0 all windows", () => {
  let s = createAggregatorState();
  s = addObservation(s, "x", 1, "1m");
  s = addObservation(s, "x", 1, "5m");
  s = addObservation(s, "x", 1, "1h");
  s = addObservation(s, "x", 1, "24h");
  assert.equal(aggregationCoverage(s), 1.0);
});

test("WINDOW_MS: 4 windows", () => {
  assert.equal(Object.keys(WINDOW_MS).length, 4);
});
