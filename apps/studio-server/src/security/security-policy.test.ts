// V29 SecurityPolicy (Direction G 29/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSecurityPolicyState, addRule, removeRule, enableRule, disableRule, evaluateAction, validatePassword, policyCoverage, DEFAULT_PASSWORD_POLICY } from "./security-policy.js";

test("createSecurityPolicyState: defaults", () => {
  const s = createSecurityPolicyState();
  assert.equal(s.rules.length, 0);
  assert.equal(s.password.minLength, 8);
});

test("addRule: adds", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "block-admin", resource: "/admin/*", action: "deny", enabled: true, priority: 10 });
  assert.equal(s.rules.length, 1);
});

test("removeRule: removes by id", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "r", resource: "x", action: "deny", enabled: true, priority: 1 });
  s = addRule(s, { id: "r2", name: "r", resource: "y", action: "allow", enabled: true, priority: 1 });
  s = removeRule(s, "r1");
  assert.equal(s.rules.length, 1);
});

test("enableRule / disableRule: toggles", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "r", resource: "x", action: "deny", enabled: true, priority: 1 });
  s = disableRule(s, "r1");
  assert.equal(s.rules[0].enabled, false);
  s = enableRule(s, "r1");
  assert.equal(s.rules[0].enabled, true);
});

test("evaluateAction: default allow", () => {
  const s = createSecurityPolicyState();
  assert.equal(evaluateAction(s, "x"), "allow");
});

test("evaluateAction: deny IP", () => {
  let s = createSecurityPolicyState();
  s = { ...s, denyIps: ["1.2.3.4"] };
  assert.equal(evaluateAction(s, "x", "1.2.3.4"), "deny");
});

test("evaluateAction: rule match", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "block", resource: "/admin/*", action: "deny", enabled: true, priority: 10 });
  assert.equal(evaluateAction(s, "/admin/users"), "deny");
});

test("evaluateAction: priority wins", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "low", resource: "x", action: "allow", enabled: true, priority: 1 });
  s = addRule(s, { id: "r2", name: "high", resource: "x", action: "deny", enabled: true, priority: 10 });
  assert.equal(evaluateAction(s, "x"), "deny");
});

test("evaluateAction: disabled rule ignored", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "block", resource: "x", action: "deny", enabled: false, priority: 10 });
  assert.equal(evaluateAction(s, "x"), "allow");
});

test("evaluateAction: IP allow list", () => {
  let s = createSecurityPolicyState();
  s = { ...s, allowIps: ["10.0.0.1"] };
  assert.equal(evaluateAction(s, "x", "10.0.0.1"), "allow");
  assert.equal(evaluateAction(s, "x", "8.8.8.8"), "deny");
});

test("evaluateAction: wildcard", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "r", resource: "*", action: "audit", enabled: true, priority: 1 });
  assert.equal(evaluateAction(s, "anything"), "audit");
});

test("validatePassword: valid", () => {
  const s = createSecurityPolicyState();
  const r = validatePassword(s, "Password1");
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test("validatePassword: too short", () => {
  const s = createSecurityPolicyState();
  const r = validatePassword(s, "Pw1");
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0);
});

test("validatePassword: missing digit", () => {
  const s = createSecurityPolicyState();
  const r = validatePassword(s, "PasswordNoDigit");
  assert.equal(r.valid, false);
});

test("validatePassword: with special requirement", () => {
  const s = createSecurityPolicyState({ ...DEFAULT_PASSWORD_POLICY, requireSpecial: true });
  assert.equal(validatePassword(s, "Password1").valid, false);
  assert.equal(validatePassword(s, "Password1!").valid, true);
});

test("policyCoverage: 0 for empty", () => {
  assert.equal(policyCoverage(createSecurityPolicyState()), 0.4);
});

test("policyCoverage: 1.0 with all", () => {
  let s = createSecurityPolicyState();
  s = addRule(s, { id: "r1", name: "r", resource: "x", action: "allow", enabled: true, priority: 1 });
  s = { ...s, allowIps: ["1.2.3.4"] };
  assert.equal(policyCoverage(s), 1.0);
});
