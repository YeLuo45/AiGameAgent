// V26 PerformanceReflector (Direction E 26/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createReflector,
  computeMetrics,
  generateRecommendations,
  reflect,
  reflectionQuality,
} from "./performance-reflector.js";
import { createEventStore, appendEvent } from "./event-store.js";

function ev(type: string, payload: Record<string, unknown> = {}): Omit<ReturnType<typeof appendEvent>["record"], "id"> {
  return { type, sessionId: "s1", correlationId: "c1", ts: "2026-06-14T00:00:00.000Z", payload };
}

test("createReflector: defaults", () => {
  const s = createReflector();
  assert.equal(s.reflections.length, 0);
  assert.equal(s.thresholds.failRateWarn, 0.1);
});

test("computeMetrics: empty store = zero metrics", () => {
  const m = computeMetrics(createEventStore());
  assert.equal(m.totalEvents, 0);
  assert.equal(m.failureRate, 0);
  assert.equal(m.avgFirstChunkMs, null);
});

test("computeMetrics: counts events", () => {
  let s = createEventStore();
  s = appendEvent(s, ev("llm.chunk")).state;
  s = appendEvent(s, ev("llm.chunk")).state;
  s = appendEvent(s, ev("tool.start")).state;
  const m = computeMetrics(s);
  assert.equal(m.totalEvents, 3);
});

test("computeMetrics: failure rate", () => {
  let s = createEventStore();
  s = appendEvent(s, ev("job.failed", { failureReason: "timeout" })).state;
  s = appendEvent(s, ev("job.finished", { ok: true })).state;
  s = appendEvent(s, ev("job.finished", { ok: false })).state;
  s = appendEvent(s, ev("job.finished", { ok: true })).state;
  const m = computeMetrics(s);
  // 1 failed (job.failed) + 1 finished{ok:false} = 2 of 4 = 0.5
  assert.equal(m.failureRate, 0.5);
});

test("computeMetrics: avgFirstChunkMs", () => {
  let s = createEventStore();
  s = appendEvent(s, ev("llm.chunk", { firstChunkMs: 100, text: "a" })).state;
  s = appendEvent(s, ev("llm.chunk", { firstChunkMs: 200, text: "b" })).state;
  s = appendEvent(s, ev("llm.chunk", { firstChunkMs: 300, text: "c" })).state;
  const m = computeMetrics(s);
  assert.equal(m.avgFirstChunkMs, 200);
});

test("computeMetrics: p95 latency", () => {
  let s = createEventStore();
  for (let i = 0; i < 100; i++) s = appendEvent(s, ev("llm.chunk", { firstChunkMs: i, text: "x" })).state;
  const m = computeMetrics(s);
  // p95 of 0..99 sorted → index 95 → 95
  assert.equal(m.p95FirstChunkMs, 95);
});

test("computeMetrics: top errors", () => {
  let s = createEventStore();
  s = appendEvent(s, ev("job.failed", { failureReason: "timeout" })).state;
  s = appendEvent(s, ev("job.failed", { failureReason: "timeout" })).state;
  s = appendEvent(s, ev("job.failed", { failureReason: "ECONNREFUSED" })).state;
  const m = computeMetrics(s);
  assert.equal(m.topErrors[0].reason, "timeout");
  assert.equal(m.topErrors[0].count, 2);
});

test("generateRecommendations: critical failure rate", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 10, failureRate: 0.5, avgFirstChunkMs: 100, p95FirstChunkMs: 200, tokensPerSec: 50, topErrors: [] }, s);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].severity, "critical");
});

test("generateRecommendations: warn failure rate", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 10, failureRate: 0.15, avgFirstChunkMs: 100, p95FirstChunkMs: 200, tokensPerSec: 50, topErrors: [] }, s);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].severity, "warn");
});

test("generateRecommendations: critical p95", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 10, failureRate: 0, avgFirstChunkMs: 100, p95FirstChunkMs: 6000, tokensPerSec: 50, topErrors: [] }, s);
  assert.equal(recs.some((r) => r.severity === "critical" && r.category === "performance"), true);
});

test("generateRecommendations: warn p95", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 10, failureRate: 0, avgFirstChunkMs: 100, p95FirstChunkMs: 3000, tokensPerSec: 50, topErrors: [] }, s);
  assert.equal(recs.some((r) => r.severity === "warn" && r.category === "performance"), true);
});

test("generateRecommendations: low throughput", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 200, failureRate: 0, avgFirstChunkMs: 100, p95FirstChunkMs: 200, tokensPerSec: 5, topErrors: [] }, s);
  assert.ok(recs.some((r) => r.category === "cost"));
});

test("generateRecommendations: frequent error", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 100, failureRate: 0, avgFirstChunkMs: 100, p95FirstChunkMs: 200, tokensPerSec: 50, topErrors: [{ reason: "timeout", count: 10 }] }, s);
  assert.ok(recs.some((r) => r.message.includes("timeout")));
});

test("generateRecommendations: all clear", () => {
  const s = createReflector();
  const recs = generateRecommendations({ totalEvents: 100, failureRate: 0.01, avgFirstChunkMs: 100, p95FirstChunkMs: 200, tokensPerSec: 50, topErrors: [] }, s);
  assert.equal(recs.length, 0);
});

test("reflect: stores reflection", () => {
  const s = createReflector();
  const store = createEventStore();
  const r = reflect(s, store);
  assert.equal(r.state.reflections.length, 1);
});

test("reflectionQuality: no recs = 0.7", () => {
  assert.equal(reflectionQuality([]), 0.7);
});

test("reflectionQuality: critical = 0.2", () => {
  assert.equal(reflectionQuality([{ severity: "critical", category: "performance", message: "x", suggestedAction: "y" }]), 0.2);
});

test("reflectionQuality: warn = 0.5", () => {
  assert.equal(reflectionQuality([{ severity: "warn", category: "performance", message: "x", suggestedAction: "y" }]), 0.5);
});

test("reflectionQuality: info = 0.8", () => {
  assert.equal(reflectionQuality([{ severity: "info", category: "cost", message: "x", suggestedAction: "y" }]), 0.8);
});
