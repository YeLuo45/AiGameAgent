// V27 AutoRecovery (Direction E 27/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAutoRecovery,
  shouldRecover,
  confirmRecoveryUsed,
  resetRecovery,
  currentFallback,
  recoveryCount,
  recoveryEffectiveness,
} from "./auto-recovery.js";
import { createHealthState, recordHealth } from "./health-checker.js";
import type { ChannelAdapter } from "./channel-adapter.js";

function makeAdapter(id: string): ChannelAdapter {
  return {
    id, type: "openai", capabilities: ["text"],
    baseUrl: "http://x", defaultModel: "m",
    chat: async () => ({ ok: true, chunks: [], text: "", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, firstChunkMs: 0, totalMs: 0 }),
    health: async () => ({ ok: true, firstChunkMs: 0, model: "m" }),
    close: async () => {},
  };
}

function openHealth(id: string, threshold: number = 1) {
  let h = createHealthState(id, { failureThreshold: threshold, openCooldownMs: 60_000 });
  h = recordHealth(h, false, null, "fail");
  return h;
}

test("createAutoRecovery: defaults", () => {
  const s = createAutoRecovery();
  assert.equal(Object.keys(s.recoveries).length, 0);
});

test("shouldRecover: closed circuit = no recovery", () => {
  let s = createAutoRecovery();
  const primary = makeAdapter("p");
  const fb = makeAdapter("fb");
  const h = createHealthState("p");
  const r = shouldRecover(s, primary, [primary, fb], h, "test");
  assert.equal(r.recovery, null);
});

test("shouldRecover: open circuit picks first fallback", () => {
  let s = createAutoRecovery();
  const primary = makeAdapter("p");
  const fb1 = makeAdapter("fb1");
  const fb2 = makeAdapter("fb2");
  const h = openHealth("p");
  const r = shouldRecover(s, primary, [primary, fb1, fb2], h, "circuit-open");
  assert.ok(r.recovery);
  assert.equal(r.recovery?.toProvider, "fb1");
  assert.equal(currentFallback(r.state, "p"), "fb1");
});

test("shouldRecover: skips same-id fallback", () => {
  let s = createAutoRecovery();
  const primary = makeAdapter("p");
  const h = openHealth("p");
  const r = shouldRecover(s, primary, [primary], h, "test");
  assert.equal(r.recovery, null); // no real fallback available
});

test("shouldRecover: cooldown after recovery", () => {
  let s = createAutoRecovery();
  const primary = makeAdapter("p");
  const fb = makeAdapter("fb");
  const h = openHealth("p");
  const r1 = shouldRecover(s, primary, [primary, fb], h, "first", 1000);
  // Immediate second attempt should be blocked by cooldown
  const r2 = shouldRecover(r1.state, primary, [primary, fb], h, "second", 2000);
  assert.equal(r2.recovery, null);
});

test("shouldRecover: max recoveries per window", () => {
  let s = createAutoRecovery({ failureThreshold: 3, cooldownMs: 0, maxRecoveriesPerWindow: 2 });
  const primary = makeAdapter("p");
  const fb = makeAdapter("fb");
  let h = createHealthState("p", { failureThreshold: 1, openCooldownMs: 1000 });
  h = recordHealth(h, false, null, "fail");
  // First recovery
  const r1 = shouldRecover(s, primary, [primary, fb], h, "1", 1000);
  // Manually update lastRecoveryAt to 0 to bypass cooldown (we set cooldownMs=0 above but JS is tricky)
  // Actually cooldown is 0, so any time diff is ≥ 0. Let me check.
  // The check is: now - lastRecoveryAt < cooldownMs. With cooldown=0 and now=2000-last=1000, 1000 < 0 is false.
  // So we can recover again.
  h = recordHealth(h, false, null, "fail");
  const r2 = shouldRecover(r1.state, primary, [primary, fb], h, "2", 2000);
  assert.ok(r2.recovery); // cooldown=0 allows
  h = recordHealth(h, false, null, "fail");
  const r3 = shouldRecover(r2.state, primary, [primary, fb], h, "3", 3000);
  // Now we have 2 events in the 1h window. limit=2, so this is the 3rd which is blocked
  assert.equal(r3.recovery, null);
});

test("confirmRecoveryUsed: updates lastRecoveryAt", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [{ ts: 1000, fromProvider: "p", toProvider: "fb", reason: "x" }], lastRecoveryAt: 1000, currentFallback: "fb" } } };
  const before = s.recoveries["p"].lastRecoveryAt;
  s = confirmRecoveryUsed(s, "p");
  assert.ok(s.recoveries["p"].lastRecoveryAt! >= before);
});

test("resetRecovery: specific provider", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [], lastRecoveryAt: 1, currentFallback: "fb" }, q: { events: [], lastRecoveryAt: 2, currentFallback: null } } };
  s = resetRecovery(s, "p");
  assert.equal(s.recoveries["p"], undefined);
  assert.ok(s.recoveries["q"]);
});

test("resetRecovery: all", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [], lastRecoveryAt: 1, currentFallback: "fb" } } };
  s = resetRecovery(s);
  assert.equal(Object.keys(s.recoveries).length, 0);
});

test("currentFallback: no entry = null", () => {
  assert.equal(currentFallback(createAutoRecovery(), "missing"), null);
});

test("recoveryCount: counts events in window", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [{ ts: 1000, fromProvider: "p", toProvider: "fb", reason: "x" }], lastRecoveryAt: 1000, currentFallback: "fb" } } };
  assert.equal(recoveryCount(s, "p", 3_600_000, 2000), 1);
  assert.equal(recoveryCount(s, "p", 500, 2000), 0); // outside window
});

test("recoveryEffectiveness: no recoveries = 1.0", () => {
  assert.equal(recoveryEffectiveness(createAutoRecovery()), 1.0);
});

test("recoveryEffectiveness: with fallback = high", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [], lastRecoveryAt: 1, currentFallback: "fb" } } };
  assert.equal(recoveryEffectiveness(s), 1.0);
});

test("recoveryEffectiveness: no fallback = 0", () => {
  let s = createAutoRecovery();
  s = { ...s, recoveries: { p: { events: [], lastRecoveryAt: 1, currentFallback: null } } };
  assert.equal(recoveryEffectiveness(s), 0);
});
