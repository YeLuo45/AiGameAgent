// V10 AlertManager (Direction F 10/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAlertManager, addRule, evaluate, fire, resolve, listAlerts, activeAlertCount, alertNoise } from "./alert-manager.js";
import { createRule } from "./alert-rule.js";

test("createAlertManager: empty", () => {
  const s = createAlertManager();
  assert.equal(Object.keys(s.rules).length, 0);
  assert.equal(s.breachThreshold, 1);
});

test("addRule: adds", () => {
  let s = createAlertManager();
  s = addRule(s, createRule("r1", "latency", ">", 1000));
  assert.equal(Object.keys(s.rules).length, 1);
});

test("evaluate: fires alert on breach", () => {
  let s = createAlertManager();
  s = addRule(s, createRule("r1", "latency", ">", 1000, "critical"));
  s = evaluate(s, "latency", 1500);
  assert.equal(activeAlertCount(s), 1);
});

test("evaluate: no fire on non-matching metric", () => {
  let s = createAlertManager();
  s = addRule(s, createRule("r1", "latency", ">", 1000));
  s = evaluate(s, "other", 9999);
  assert.equal(activeAlertCount(s), 0);
});

test("fire: creates alert", () => {
  let s = createAlertManager();
  s = addRule(s, createRule("r1", "x", ">", 100));
  s = fire(s, s.rules["r1"], 200);
  assert.equal(listAlerts(s).length, 1);
});

test("resolve: changes state", () => {
  let s = createAlertManager();
  s = addRule(s, createRule("r1", "x", ">", 100));
  s = fire(s, s.rules["r1"], 200);
  s = resolve(s, "r1");
  const a = listAlerts(s)[0];
  assert.equal(a.state, "resolved");
  assert.ok(a.resolvedAt);
});

test("listAlerts: filter by severity", () => {
  let s = createAlertManager();
  s = fire(s, createRule("r1", "x", ">", 100, "warn"), 200);
  s = fire(s, createRule("r2", "x", ">", 100, "critical"), 200);
  assert.equal(listAlerts(s, { severity: "critical" }).length, 1);
});

test("listAlerts: filter by state", () => {
  let s = createAlertManager();
  s = fire(s, createRule("r1", "x", ">", 100), 200);
  s = resolve(s, "r1");
  assert.equal(listAlerts(s, { state: "firing" }).length, 0);
  assert.equal(listAlerts(s, { state: "resolved" }).length, 1);
});

test("activeAlertCount: only firing", () => {
  let s = createAlertManager();
  s = fire(s, createRule("r1", "x", ">", 100), 200);
  s = fire(s, createRule("r2", "x", ">", 100), 300);
  s = resolve(s, "r1");
  assert.equal(activeAlertCount(s), 1);
});

test("alertNoise: 0 for empty", () => {
  assert.equal(alertNoise(createAlertManager()), 0);
});

test("alertNoise: 1.0 for 10+ active", () => {
  let s = createAlertManager();
  for (let i = 0; i < 10; i++) s = fire(s, createRule(`r${i}`, "x", ">", 100), 200);
  assert.equal(alertNoise(s), 1.0);
});

test("evaluate: breachThreshold > 1", () => {
  let s = createAlertManager(2);
  s = addRule(s, createRule("r1", "x", ">", 100));
  s = evaluate(s, "x", 200);
  assert.equal(activeAlertCount(s), 0);
  s = evaluate(s, "x", 200);
  assert.equal(activeAlertCount(s), 1);
});
