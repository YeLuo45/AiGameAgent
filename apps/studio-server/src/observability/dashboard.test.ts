// V15 Dashboard (Direction F 15/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, criticalPanels, dashboardCompleteness } from "./dashboard.js";
import { createMetricsRegistry, registerCounter, registerGauge, registerHistogram, recordValue } from "./metrics-registry.js";
import { createAlertManager, fire } from "./alert-manager.js";
import { createRule } from "./alert-rule.js";
import { createLogAggregator, appendLog } from "./log-aggregator.js";

test("buildDashboard: empty = 1 panel min", () => {
  const d = buildDashboard(createMetricsRegistry(), createAlertManager(), createLogAggregator());
  // alert panel + log panel
  assert.ok(d.panels.length >= 2);
});

test("buildDashboard: includes metric panels", () => {
  let m = createMetricsRegistry();
  m = registerCounter(m, "requests");
  m = recordValue(m, "requests", 100);
  m = registerGauge(m, "memory");
  m = recordValue(m, "memory", 512);
  const d = buildDashboard(m, createAlertManager(), createLogAggregator());
  assert.ok(d.panels.some((p) => p.title === "requests"));
  assert.ok(d.panels.some((p) => p.title === "memory"));
});

test("buildDashboard: includes alert panel", () => {
  let a = createAlertManager();
  a = fire(a, createRule("r1", "x", ">", 100, "critical"), 200);
  const d = buildDashboard(createMetricsRegistry(), a, createLogAggregator());
  const alertPanel = d.panels.find((p) => p.title === "Active Alerts");
  assert.equal(alertPanel?.value, 1);
  assert.equal(alertPanel?.status, "warn");
});

test("buildDashboard: log panel counts errors", () => {
  let l = createLogAggregator();
  l = appendLog(l, "error", "x", "y");
  l = appendLog(l, "error", "x", "y");
  l = appendLog(l, "fatal", "x", "y");
  const d = buildDashboard(createMetricsRegistry(), createAlertManager(), l);
  const logPanel = d.panels.find((p) => p.title === "Error Logs");
  assert.equal(logPanel?.value, 3);
});

test("buildDashboard: log panel status = critical at 10+", () => {
  let l = createLogAggregator();
  for (let i = 0; i < 11; i++) l = appendLog(l, "error", "x", "y");
  const d = buildDashboard(createMetricsRegistry(), createAlertManager(), l);
  const logPanel = d.panels.find((p) => p.title === "Error Logs");
  assert.equal(logPanel?.status, "critical");
});

test("criticalPanels: only critical", () => {
  let l = createLogAggregator();
  for (let i = 0; i < 11; i++) l = appendLog(l, "error", "x", "y");
  const d = buildDashboard(createMetricsRegistry(), createAlertManager(), l);
  const c = criticalPanels(d);
  for (const p of c) assert.equal(p.status, "critical");
});

test("dashboardCompleteness: scales with panels", () => {
  let m = createMetricsRegistry();
  m = registerCounter(m, "c1");
  m = registerCounter(m, "c2");
  m = registerGauge(m, "g1");
  m = registerHistogram(m, "h1");
  const d = buildDashboard(m, createAlertManager(), createLogAggregator());
  // 4 metric panels + 2 system panels = 6 → capped at 1.0
  assert.equal(dashboardCompleteness(d), 1.0);
});
