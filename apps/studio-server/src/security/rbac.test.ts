// V20 RBAC (Direction G 20/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRBACState, defineRole, assignRole, unassignRole, getEffectivePermissions, hasPermission, hasAnyPermission, hasAllPermissions, rbacCoverage } from "./rbac.js";

test("createRBACState: empty", () => {
  const s = createRBACState();
  assert.equal(Object.keys(s.roles).length, 0);
});

test("defineRole: adds role", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "admin", name: "Admin", permissions: ["read", "write", "admin"], parent: null });
  assert.ok(s.roles["admin"]);
});

test("assignRole + unassignRole", () => {
  let s = createRBACState();
  s = assignRole(s, "u1", "admin");
  assert.deepEqual(s.userRoles["u1"], ["admin"]);
  s = unassignRole(s, "u1", "admin");
  assert.deepEqual(s.userRoles["u1"], []);
});

test("assignRole: idempotent", () => {
  let s = createRBACState();
  s = assignRole(s, "u1", "admin");
  s = assignRole(s, "u1", "admin");
  assert.equal(s.userRoles["u1"].length, 1);
});

test("getEffectivePermissions: direct", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  const perms = getEffectivePermissions(s, "u1");
  assert.ok(perms.has("read"));
  assert.ok(perms.has("write"));
});

test("getEffectivePermissions: inherited", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "base", name: "Base", permissions: ["read"], parent: null });
  s = defineRole(s, { id: "admin", name: "Admin", permissions: ["admin"], parent: "base" });
  s = assignRole(s, "u1", "admin");
  const perms = getEffectivePermissions(s, "u1");
  assert.ok(perms.has("read"));
  assert.ok(perms.has("admin"));
});

test("getEffectivePermissions: missing role = empty", () => {
  assert.equal(getEffectivePermissions(createRBACState(), "u1").size, 0);
});

test("getEffectivePermissions: missing parent role = partial", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "child", name: "Child", permissions: ["read"], parent: "nonexistent" });
  s = assignRole(s, "u1", "child");
  const perms = getEffectivePermissions(s, "u1");
  assert.ok(perms.has("read"));
});

test("collectPermissions: handles cycle", () => {
  let s = createRBACState();
  // a -> b -> a (cycle)
  s = defineRole(s, { id: "a", name: "A", permissions: ["read"], parent: "b" });
  s = defineRole(s, { id: "b", name: "B", permissions: ["write"], parent: "a" });
  s = assignRole(s, "u1", "a");
  const perms = getEffectivePermissions(s, "u1");
  assert.ok(perms.has("read"));
  assert.ok(perms.has("write"));
});

test("hasPermission: true/false", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(hasPermission(s, "u1", "read"), true);
  assert.equal(hasPermission(s, "u1", "admin"), false);
});

test("hasAnyPermission: any", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(hasAnyPermission(s, "u1", ["admin", "read"]), true);
  assert.equal(hasAnyPermission(s, "u1", ["admin", "deploy"]), false);
});

test("hasAllPermissions: all", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(hasAllPermissions(s, "u1", ["read", "write"]), true);
  assert.equal(hasAllPermissions(s, "u1", ["read", "admin"]), false);
});

test("rbacCoverage: 0 empty", () => {
  assert.equal(rbacCoverage(createRBACState()), 0);
});

test("rbacCoverage: 0 for users with no roles", () => {
  let s = createRBACState();
  s = assignRole(s, "u1", "admin");
  s = unassignRole(s, "u1", "admin");
  assert.equal(rbacCoverage(s), 0);
});

test("rbacCoverage: ratio with roles", () => {
  let s = createRBACState();
  s = assignRole(s, "u1", "admin");
  s = assignRole(s, "u2", "admin");
  s = assignRole(s, "u3", "admin");
  s = unassignRole(s, "u3", "admin");
  assert.equal(rbacCoverage(s), 2 / 3);
});
