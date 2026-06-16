// V4 MetricsRegistry (Direction F 4/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMetricsRegistry, registerCounter, registerGauge, registerHistogram, getEntry, listEntries, recordValue, registryCoverage,
} from "./metrics-registry.js";

test("createMetricsRegistry: empty", () => {
  const s = createMetricsRegistry();
  assert.equal(Object.keys(s.metrics).length, 0);
});

test("registerCounter: creates", () => {
  let s = createMetricsRegistry();
  s = registerCounter(s, "requests", { help: "Total requests" });
  const e = getEntry(s, "requests");
  assert.equal(e?.kind, "counter");
});

test("registerGauge: creates", () => {
  let s = createMetricsRegistry();
  s = registerGauge(s, "memory");
  assert.equal(getEntry(s, "memory")?.kind, "gauge");
});

test("registerHistogram: creates with buckets", () => {
  let s = createMetricsRegistry();
  s = registerHistogram(s, "latency", [0.1, 1, 10]);
  assert.equal(getEntry(s, "latency")?.kind, "histogram");
});

test("getEntry: undefined for missing", () => {
  assert.equal(getEntry(createMetricsRegistry(), "x"), undefined);
});

test("listEntries: filter by kind", () => {
  let s = createMetricsRegistry();
  s = registerCounter(s, "c1");
  s = registerCounter(s, "c2");
  s = registerGauge(s, "g1");
  assert.equal(listEntries(s, "counter").length, 2);
});

test("recordValue: counter increment", () => {
  let s = createMetricsRegistry();
  s = registerCounter(s, "c1");
  s = recordValue(s, "c1", 5);
  s = recordValue(s, "c1", 3);
  const e = getEntry(s, "c1")!;
  assert.equal((e.ref as { value: number }).value, 8);
});

test("recordValue: gauge set", () => {
  let s = createMetricsRegistry();
  s = registerGauge(s, "g1");
  s = recordValue(s, "g1", 42);
  assert.equal((getEntry(s, "g1")!.ref as { value: number }).value, 42);
});

test("recordValue: histogram observe", () => {
  let s = createMetricsRegistry();
  s = registerHistogram(s, "h1", [1, 5, 10]);
  s = recordValue(s, "h1", 3);
  s = recordValue(s, "h1", 7);
  const h = getEntry(s, "h1")!.ref as { count: number };
  assert.equal(h.count, 2);
});

test("recordValue: no-op for missing", () => {
  let s = createMetricsRegistry();
  s = recordValue(s, "x", 1);
  assert.equal(Object.keys(s.metrics).length, 0);
});

test("registryCoverage: 0 empty", () => {
  assert.equal(registryCoverage(createMetricsRegistry()), 0);
});

test("registryCoverage: 1.0 with all 3 kinds", () => {
  let s = createMetricsRegistry();
  s = registerCounter(s, "c");
  s = registerGauge(s, "g");
  s = registerHistogram(s, "h");
  assert.equal(registryCoverage(s), 1.0);
});
