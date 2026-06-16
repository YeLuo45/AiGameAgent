// V7 HistogramMetric (Direction F 7/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHistogram, observe, mean, percentile, p50, p95, p99, histogramCoverage } from "./histogram-metric.js";

test("createHistogram: empty", () => {
  const m = createHistogram("h");
  assert.equal(m.count, 0);
  assert.equal(m.sum, 0);
  assert.equal(m.bucketCounts.length, 5);
});

test("observe: increments count + sum", () => {
  let m = createHistogram("h");
  m = observe(m, 1);
  m = observe(m, 2);
  m = observe(m, 3);
  assert.equal(m.count, 3);
  assert.equal(m.sum, 6);
});

test("observe: places in correct bucket", () => {
  let m = createHistogram("h", [1, 5, 10]);
  m = observe(m, 0.5); // bucket 0 (≤1)
  m = observe(m, 3);   // bucket 1 (≤5)
  m = observe(m, 7);   // bucket 2 (≤10)
  m = observe(m, 20);  // no bucket (above all)
  assert.equal(m.bucketCounts[0], 1);
  assert.equal(m.bucketCounts[1], 1);
  assert.equal(m.bucketCounts[2], 1);
});

test("observe: tracks min/max", () => {
  let m = createHistogram("h");
  m = observe(m, 5);
  m = observe(m, 10);
  m = observe(m, 1);
  assert.equal(m.min, 1);
  assert.equal(m.max, 10);
});

test("mean: 0 for empty", () => {
  assert.equal(mean(createHistogram("h")), 0);
});

test("mean: avg", () => {
  let m = createHistogram("h");
  m = observe(m, 2);
  m = observe(m, 4);
  m = observe(m, 6);
  assert.equal(mean(m), 4);
});

test("percentile: 0 for empty", () => {
  assert.equal(percentile(createHistogram("h"), 50), 0);
});

test("p50 / p95 / p99: sorted samples", () => {
  let m = createHistogram("h");
  for (let i = 1; i <= 100; i++) m = observe(m, i);
  // percentile: idx = floor(p/100 * length)
  // p50: floor(50) = 50 → sorted[50] = 51
  // p95: floor(95) = 95 → sorted[95] = 96
  // p99: floor(99) = 99 → sorted[99] = 100
  assert.equal(p50(m), 51);
  assert.equal(p95(m), 96);
  assert.equal(p99(m), 100);
});

test("histogramCoverage: 0 for empty", () => {
  assert.equal(histogramCoverage(createHistogram("h")), 0);
});

test("histogramCoverage: 1.0 for 100+", () => {
  let m = createHistogram("h");
  for (let i = 0; i < 100; i++) m = observe(m, i);
  assert.equal(histogramCoverage(m), 1.0);
});

test("observe: caps samples at maxSamples", () => {
  const m = createHistogram("h", [1, 5, 10], 5);
  let state = m;
  for (let i = 0; i < 10; i++) state = observe(state, i);
  assert.equal(state.samples.length, 5);
});
