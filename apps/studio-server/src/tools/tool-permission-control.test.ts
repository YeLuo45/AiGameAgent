// V17 ToolPermissionControl (Direction B 17/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPermissionState,
  addRule,
  removeRule,
  checkPermission,
  setDefaultPermission,
  isAutoAllowed,
  isAutoDenied,
  permissionCoverage,
} from "./tool-permission-control.js";

test("createPermissionState: defaults to ask", () => {
  const s = createPermissionState();
  assert.equal(s.defaultPermission, "ask");
});

test("addRule: appends", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  assert.equal(s.rules.length, 1);
});

test("checkPermission: exact match returns permission", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  const r = checkPermission(s, "Read", "any-agent");
  assert.equal(r.permission, "allow");
});

test("checkPermission: no rule returns default", () => {
  const s = createPermissionState("deny");
  const r = checkPermission(s, "Read", "any");
  assert.equal(r.permission, "deny");
  assert.equal(r.matchedRule, undefined);
});

test("checkPermission: wildcard * matches everything", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "*", agentPattern: "*", permission: "allow" });
  assert.equal(checkPermission(s, "Anything", "Anyone").permission, "allow");
});

test("checkPermission: prefix pattern Read* matches ReadFile", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read*", agentPattern: "*", permission: "allow" });
  assert.equal(checkPermission(s, "ReadFile", "a").permission, "allow");
  assert.equal(checkPermission(s, "Write", "a").permission, "ask"); // default
});

test("checkPermission: agent pattern qa-* matches qa-tester", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "*", agentPattern: "qa-*", permission: "allow" });
  assert.equal(checkPermission(s, "X", "qa-tester").permission, "allow");
  assert.equal(checkPermission(s, "X", "dev-1").permission, "ask");
});

test("checkPermission: first matching rule wins", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  s = addRule(s, { toolPattern: "Read", agentPattern: "qa-*", permission: "deny" });
  // First match: "Read" + "*" matches Read+qa-tester → allow
  assert.equal(checkPermission(s, "Read", "qa-tester").permission, "allow");
});

test("removeRule: removes by tool+agent pattern", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  s = removeRule(s, "Read", "*");
  assert.equal(s.rules.length, 0);
});

test("removeRule: no-op for missing", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  const s1 = removeRule(s, "Read", "qa-*");
  assert.equal(s1.rules.length, 1);
});

test("setDefaultPermission: changes default", () => {
  let s = createPermissionState();
  s = setDefaultPermission(s, "deny");
  assert.equal(s.defaultPermission, "deny");
});

test("isAutoAllowed: true for allow", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  assert.equal(isAutoAllowed(s, "Read", "a"), true);
});

test("isAutoAllowed: false for sandbox-only", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Bash", agentPattern: "*", permission: "sandbox-only" });
  assert.equal(isAutoAllowed(s, "Bash", "a"), false);
});

test("isAutoDenied: true for deny", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Write", agentPattern: "*", permission: "deny" });
  assert.equal(isAutoDenied(s, "Write", "a"), true);
});

test("isAutoDenied: false for allow", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "Read", agentPattern: "*", permission: "allow" });
  assert.equal(isAutoDenied(s, "Read", "a"), false);
});

test("permissionCoverage: 0 empty", () => {
  assert.equal(permissionCoverage(createPermissionState(), [], []), 1.0);
});

test("permissionCoverage: 1.0 when all covered", () => {
  let s = createPermissionState();
  s = addRule(s, { toolPattern: "*", agentPattern: "*", permission: "allow" });
  assert.equal(permissionCoverage(s, ["Read", "Write"], ["a1", "a2"]), 1.0);
});

test("permissionCoverage: 0 when none covered", () => {
  const s = createPermissionState();
  assert.equal(permissionCoverage(s, ["Read", "Write"], ["a1", "a2"]), 0);
});
