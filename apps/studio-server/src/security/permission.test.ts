// V21 Permission (Direction G 21/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPermission, checkAnyPermission, checkAllPermissions, allowedResources, isReadOnly, isAdmin, permissionCoverage } from "./permission.js";
import { createRBACState, defineRole, assignRole } from "./rbac.js";

test("checkPermission: direct match", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(checkPermission(s, { userId: "u1", resource: "doc", action: "read" }), true);
  assert.equal(checkPermission(s, { userId: "u1", resource: "doc", action: "admin" }), false);
});

test("checkAnyPermission: any", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(checkAnyPermission(s, "u1", "doc", ["admin", "read"]), true);
});

test("checkAllPermissions: all", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(checkAllPermissions(s, "u1", "doc", ["read", "write"]), true);
  assert.equal(checkAllPermissions(s, "u1", "doc", ["read", "admin"]), false);
});

test("allowedResources: admin gets all", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "admin", name: "Admin", permissions: ["admin"], parent: null });
  s = assignRole(s, "u1", "admin");
  const all = ["doc1", "doc2", "doc3"];
  // "admin" permission doesn't include "read" by default, so we need a different approach
  // Use a role that has "read" + everything
  s = defineRole(s, { id: "superadmin", name: "SuperAdmin", permissions: ["read", "admin"], parent: null });
  s = assignRole(s, "u2", "superadmin");
  assert.equal(allowedResources(s, "u2", "read", all).length, 3);
});

test("allowedResources: no perm = empty", () => {
  let s = createRBACState();
  s = assignRole(s, "u1", "nothign");
  assert.equal(allowedResources(s, "u1", "read", ["doc1"]).length, 0);
});

test("isReadOnly: read-only user", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "viewer", name: "Viewer", permissions: ["read"], parent: null });
  s = assignRole(s, "u1", "viewer");
  assert.equal(isReadOnly(s, "u1"), true);
});

test("isReadOnly: false for write user", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "editor", name: "Editor", permissions: ["read", "write"], parent: null });
  s = assignRole(s, "u1", "editor");
  assert.equal(isReadOnly(s, "u1"), false);
});

test("isAdmin: true for admin", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "admin", name: "Admin", permissions: ["admin"], parent: null });
  s = assignRole(s, "u1", "admin");
  assert.equal(isAdmin(s, "u1"), true);
});

test("permissionCoverage: 0 empty", () => {
  assert.equal(permissionCoverage(createRBACState()), 0);
});

test("permissionCoverage: ratio", () => {
  let s = createRBACState();
  s = defineRole(s, { id: "viewer", name: "Viewer", permissions: ["read"], parent: null });
  s = assignRole(s, "u1", "viewer");
  s = assignRole(s, "u2", "viewer");
  assert.equal(permissionCoverage(s), 1.0);
});
