// V24 DriftDetector (Direction D 24/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDriftDetector,
  recordSnapshot,
  detectDrift,
  detectAllDrift,
  criticalDrifts,
  driftStability,
} from "./drift-detector.js";

test("createDriftDetector: defaults", () => {
  const s = createDriftDetector();
  assert.equal(s.snapshots.length, 0);
  assert.equal(s.warnThreshold, 0.1);
  assert.equal(s.criticalThreshold, 0.3);
});

test("recordSnapshot: adds", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "success-rate", 0.9, 0.95);
  assert.equal(s.snapshots.length, 1);
});

test("detectDrift: insufficient data = null", () => {
  const s = createDriftDetector();
  assert.equal(detectDrift(s, "success-rate"), null);
});

test("detectDrift: no drift", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "success-rate", 0.9, 0.9);
  s = recordSnapshot(s, "success-rate", 0.91, 0.9);
  const a = detectDrift(s, "success-rate");
  assert.equal(a?.severity, "info");
  assert.ok(a && a.driftPercent < 0.1);
});

test("detectDrift: warn level", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "success-rate", 0.8, 0.9); // ~11% drift
  s = recordSnapshot(s, "success-rate", 0.8, 0.9);
  const a = detectDrift(s, "success-rate");
  assert.equal(a?.severity, "warn");
});

test("detectDrift: critical level", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "success-rate", 0.5, 0.9); // ~44% drift
  s = recordSnapshot(s, "success-rate", 0.5, 0.9);
  const a = detectDrift(s, "success-rate");
  assert.equal(a?.severity, "critical");
});

test("detectDrift: zero baseline = null", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "duration", 100, 0);
  s = recordSnapshot(s, "duration", 100, 0);
  assert.equal(detectDrift(s, "duration"), null);
});

test("detectAllDrift: multiple metrics", () => {
  let s = createDriftDetector();
  s = recordSnapshot(s, "success-rate", 0.5, 0.9);
  s = recordSnapshot(s, "success-rate", 0.5, 0.9);
  s = recordSnapshot(s, "duration", 200, 100);
  s = recordSnapshot(s, "duration", 200, 100);
  const alerts = detectAllDrift(s);
  assert.equal(alerts.length, 2);
});

test("criticalDrifts: only critical", () => {
  const a: import("./drift-detector.js").DriftAlert[] = [
    { metric: "success-rate", ts: 1, driftPercent: 0.05, severity: "info", message: "" },
    { metric: "duration", ts: 2, driftPercent: 0.5, severity: "critical", message: "" },
  ];
  const c = criticalDrifts(a);
  assert.equal(c.length, 1);
});

test("driftStability: 1.0 for empty", () => {
  assert.equal(driftStability([]), 1.0);
});

test("driftStability: lower with more drift", () => {
  const a: import("./drift-detector.js").DriftAlert = { metric: "success-rate", ts: 1, driftPercent: 0.1, severity: "info", message: "" };
  const b: import("./drift-detector.js").DriftAlert = { metric: "duration", ts: 2, driftPercent: 0.5, severity: "critical", message: "" };
  assert.ok(driftStability([a]) > driftStability([b]));
});
