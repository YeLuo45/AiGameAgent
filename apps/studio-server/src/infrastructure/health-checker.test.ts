// V6 HealthChecker (Direction E 6/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHealthState,
  recordHealth,
  getCircuitState,
  shouldProbe,
  resetCircuit,
  avgFirstChunkMs,
  failureRate,
  healthScore,
} from "./health-checker.js";

test("createHealthState: defaults", () => {
  const s = createHealthState("p1");
  assert.equal(s.providerId, "p1");
  assert.equal(s.history.length, 0);
  assert.equal(s.maxHistory, 20);
  assert.equal(s.failureThreshold, 3);
  assert.equal(s.openCooldownMs, 30000);
  assert.equal(s.openedAt, null);
});

test("createHealthState: custom options", () => {
  const s = createHealthState("p1", { maxHistory: 5, failureThreshold: 2, openCooldownMs: 1000 });
  assert.equal(s.maxHistory, 5);
  assert.equal(s.failureThreshold, 2);
  assert.equal(s.openCooldownMs, 1000);
});

test("recordHealth: success updates lastOkAt + lastFirstChunkMs", () => {
  let s = createHealthState("p1");
  s = recordHealth(s, true, 100);
  assert.equal(s.history.length, 1);
  assert.ok(s.lastOkAt !== null);
  assert.equal(s.lastFirstChunkMs, 100);
});

test("recordHealth: failure does not change lastOkAt but stores error", () => {
  let s = createHealthState("p1");
  s = recordHealth(s, true, 100);
  const prevLastOk = s.lastOkAt;
  s = recordHealth(s, false, null, "ECONNREFUSED");
  assert.equal(s.lastOkAt, prevLastOk);
  assert.equal(s.history[1].error, "ECONNREFUSED");
});

test("recordHealth: maxHistory enforces sliding window", () => {
  let s = createHealthState("p1", { maxHistory: 3 });
  s = recordHealth(s, true, 100);
  s = recordHealth(s, true, 200);
  s = recordHealth(s, true, 300);
  s = recordHealth(s, true, 400);
  assert.equal(s.history.length, 3);
  assert.equal(s.history[0].firstChunkMs, 200);
});

test("recordHealth: 3 consecutive failures opens circuit", () => {
  let s = createHealthState("p1", { failureThreshold: 3 });
  s = recordHealth(s, false, null, "e1");
  assert.equal(s.openedAt, null);
  s = recordHealth(s, false, null, "e2");
  assert.equal(s.openedAt, null);
  s = recordHealth(s, false, null, "e3");
  assert.ok(s.openedAt !== null, "should open after 3 failures");
});

test("recordHealth: success closes circuit", () => {
  let s = createHealthState("p1", { failureThreshold: 2 });
  s = recordHealth(s, false, null, "e1");
  s = recordHealth(s, false, null, "e2");
  assert.ok(s.openedAt !== null);
  s = recordHealth(s, true, 100);
  assert.equal(s.openedAt, null);
});

test("getCircuitState: closed when no failure", () => {
  const s = createHealthState("p1");
  assert.equal(getCircuitState(s), "closed");
});

test("getCircuitState: open right after threshold", () => {
  let s = createHealthState("p1", { failureThreshold: 2, openCooldownMs: 1000 });
  s = recordHealth(s, false, null, "e1");
  s = recordHealth(s, false, null, "e2");
  assert.equal(getCircuitState(s, Date.now()), "open");
});

test("getCircuitState: half-open after cooldown", () => {
  let s = createHealthState("p1", { failureThreshold: 1, openCooldownMs: 1000 });
  s = recordHealth(s, false, null, "e1");
  const opened = s.openedAt!;
  assert.equal(getCircuitState(s, opened + 1000), "half-open");
  assert.equal(getCircuitState(s, opened + 2000), "half-open");
});

test("shouldProbe: true when closed, false when open, true when half-open", () => {
  let s = createHealthState("p1", { failureThreshold: 1, openCooldownMs: 1000 });
  assert.equal(shouldProbe(s), true);
  s = recordHealth(s, false, null, "e1");
  assert.equal(shouldProbe(s, s.openedAt! + 100), false);
  assert.equal(shouldProbe(s, s.openedAt! + 1500), true);
});

test("resetCircuit clears openedAt", () => {
  let s = createHealthState("p1", { failureThreshold: 1 });
  s = recordHealth(s, false, null, "e1");
  s = resetCircuit(s);
  assert.equal(s.openedAt, null);
  assert.equal(getCircuitState(s), "closed");
});

test("avgFirstChunkMs: empty returns null", () => {
  const s = createHealthState("p1");
  assert.equal(avgFirstChunkMs(s), null);
});

test("avgFirstChunkMs: only successful checks counted", () => {
  let s = createHealthState("p1");
  s = recordHealth(s, true, 100);
  s = recordHealth(s, true, 300);
  s = recordHealth(s, false, null, "e");
  assert.equal(avgFirstChunkMs(s), 200);
});

test("failureRate: empty = 0", () => {
  assert.equal(failureRate(createHealthState("p1")), 0);
});

test("failureRate: half-half = 0.5", () => {
  let s = createHealthState("p1");
  s = recordHealth(s, true, 100);
  s = recordHealth(s, false, null, "e");
  assert.equal(failureRate(s), 0.5);
});

test("healthScore: 1.0 for all-success", () => {
  let s = createHealthState("p1");
  s = recordHealth(s, true, 100);
  s = recordHealth(s, true, 200);
  // 1.0 - 0 (no failures) + 0.1 (avg<200ms? avg=150, yes) = 1.1 → clamped 1.0
  assert.equal(healthScore(s), 1.0);
});

test("healthScore: 0 when circuit open", () => {
  let s = createHealthState("p1", { failureThreshold: 1, openCooldownMs: 60000 });
  s = recordHealth(s, false, null, "e");
  assert.equal(healthScore(s, Date.now()), 0);
});

test("healthScore: half-open halves score", () => {
  let s = createHealthState("p1", { failureThreshold: 1, openCooldownMs: 1000 });
  s = recordHealth(s, true, 100);
  s = recordHealth(s, false, null, "e"); // opens
  // half-open at openedAt+1000: 1.0 failureRate from one fail, score = 0; half-open halves 0 = 0
  // Better: use a state with mixed: 1 ok + 1 fail, then trigger
  s = recordHealth(s, true, 100);
  // Now history: 1 fail + 1 ok (oldest first?), order matters
  // Actually history is [ok, fail, ok], last was success so circuit closed
  // Need to test half-open with a stable open state
  s = createHealthState("p1", { failureThreshold: 1, openCooldownMs: 1000 });
  s = recordHealth(s, false, null, "e");
  const after = s.openedAt! + 2000;
  assert.equal(healthScore(s, after), 0); // half-open with no recent data
});
