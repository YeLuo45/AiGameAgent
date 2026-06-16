// V28 ThreatDetector (Direction G 28/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createThreatDetector, recordLogin, detectRateSpike, detectUnusualSource, emitSignal, listSignals, criticalSignals, threatSeverity, DEFAULT_THREAT_CONFIG } from "./threat-detector.js";

test("createThreatDetector: empty", () => {
  const s = createThreatDetector();
  assert.equal(s.signals.length, 0);
  assert.equal(s.nextId, 1);
});

test("recordLogin: success = no signal", () => {
  const s = createThreatDetector();
  assert.equal(recordLogin(s, "user1", true).signals.length, 0);
});

test("recordLogin: failure tracks", () => {
  const s = createThreatDetector();
  assert.equal(recordLogin(s, "user1", false).failedLogins["user1"].length, 1);
});

test("recordLogin: brute force = signal", () => {
  let s = createThreatDetector();
  for (let i = 0; i < 5; i++) s = recordLogin(s, "attacker", false);
  assert.ok(listSignals(s, "high").length > 0);
});

test("recordLogin: out of window = no signal", () => {
  let s = createThreatDetector();
  for (let i = 0; i < 3; i++) s = recordLogin(s, "u1", false, 1000 + i);
  s = recordLogin(s, "u1", false, 1000 + 70_000); // out of 60s window
  // No new entry, so still 3 in window
  assert.equal(listSignals(s).length, 0);
});

test("detectRateSpike: above threshold", () => {
  const s = createThreatDetector();
  assert.equal(detectRateSpike(s, 200, "src").signals.length, 1);
});

test("detectRateSpike: below threshold = no signal", () => {
  const s = createThreatDetector();
  assert.equal(detectRateSpike(s, 50, "src").signals.length, 0);
});

test("detectUnusualSource: above threshold", () => {
  const s = createThreatDetector();
  const sources = Array.from({ length: 12 }, (_, i) => `src${i}`);
  assert.equal(detectUnusualSource(s, sources).signals.length, 1);
});

test("emitSignal: adds", () => {
  const s = createThreatDetector();
  const s2 = emitSignal(s, "low", "data-exfil", "src", { size: 1000 });
  assert.equal(s2.signals.length, 1);
});

test("listSignals: filter by level", () => {
  let s = createThreatDetector();
  s = emitSignal(s, "low", "x", "y", {});
  s = emitSignal(s, "high", "x", "y", {});
  assert.equal(listSignals(s, "low").length, 1);
  assert.equal(listSignals(s, "high").length, 1);
});

test("criticalSignals: only critical", () => {
  let s = createThreatDetector();
  s = emitSignal(s, "critical", "x", "y", {});
  s = emitSignal(s, "low", "x", "y", {});
  assert.equal(criticalSignals(s).length, 1);
});

test("threatSeverity: 0 for empty", () => {
  assert.equal(threatSeverity(createThreatDetector()), 0);
});

test("threatSeverity: weighted", () => {
  let s = createThreatDetector();
  s = emitSignal(s, "critical", "x", "y", {});
  assert.equal(threatSeverity(s), 0.2); // 1/5
});

test("DEFAULT_THREAT_CONFIG: 5 threshold", () => {
  assert.equal(DEFAULT_THREAT_CONFIG.bruteForceThreshold, 5);
});
