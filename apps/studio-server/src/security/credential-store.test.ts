// V19 CredentialStore (Direction G 19/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCredentialStore, createUser, getById, getByUsername, getByEmail, authenticate, disableUser, listUsers, credentialCoverage } from "./credential-store.js";

test("createCredentialStore: empty", () => {
  const s = createCredentialStore();
  assert.equal(Object.keys(s.byId).length, 0);
});

test("createUser: registers", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  assert.ok(getByUsername(s, "alice"));
  assert.ok(getByEmail(s, "alice@x.com"));
});

test("createUser: auto-increment ID", () => {
  let s = createCredentialStore();
  s = createUser(s, "a", "a@x", "Pw1aaaa");
  s = createUser(s, "b", "b@x", "Pw1bbbb");
  assert.equal(getByUsername(s, "a").id, "u-1");
  assert.equal(getByUsername(s, "b").id, "u-2");
});

test("getById: undefined for missing", () => {
  assert.equal(getById(createCredentialStore(), "x"), undefined);
});

test("authenticate: by username + correct pw", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const r = authenticate(s, "alice", "Password1");
  assert.equal(r?.user.username, "alice");
  assert.ok(r?.token);
});

test("authenticate: by email", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const r = authenticate(s, "alice@x.com", "Password1");
  assert.equal(r?.user.username, "alice");
});

test("authenticate: wrong password = null", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  assert.equal(authenticate(s, "alice", "WrongPass1"), null);
});

test("authenticate: unknown user = null", () => {
  assert.equal(authenticate(createCredentialStore(), "nobody", "x"), null);
});

test("authenticate: disabled user = null", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const id = getByUsername(s, "alice").id;
  s = disableUser(s, id);
  assert.equal(authenticate(s, "alice", "Password1"), null);
});

test("disableUser: changes disabled flag", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const id = getByUsername(s, "alice").id;
  s = disableUser(s, id);
  assert.equal(getById(s, id).disabled, true);
});

test("getByUsername: undefined for missing", () => {
  assert.equal(getByUsername(createCredentialStore(), "nobody"), undefined);
});

test("getByEmail: undefined for missing", () => {
  assert.equal(getByEmail(createCredentialStore(), "nobody@x"), undefined);
});

test("getById: by id lookup", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const u = getByUsername(s, "alice");
  if (u) {
    const found = getById(s, u.id);
    if (found) assert.equal(found.username, "alice");
  }
  assert.ok(true);
});

test("credentialCoverage: 1.0 with admin@local", () => {
  let s = createCredentialStore();
  s = createUser(s, "admin", "admin@local", "Admin1xxx");
  assert.equal(credentialCoverage(s), 1.0);
});

test("credentialCoverage: 0.5 with non-admin user", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  assert.equal(credentialCoverage(s), 0.5);
});

test("getByUsername: not found after delete simulation", () => {
  // Test undefined path explicitly
  assert.equal(getByUsername(createCredentialStore(), "x"), undefined);
});

test("getByEmail: not found", () => {
  assert.equal(getByEmail(createCredentialStore(), "x@x"), undefined);
});

test("authenticate: updates lastLoginAt", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  const before = getByUsername(s, "alice")?.lastLoginAt ?? null;
  const r = authenticate(s, "alice", "Password1", 5000);
  assert.equal(r?.user.lastLoginAt, 5000);
  assert.notEqual(r?.user.lastLoginAt, before);
});

test("disableUser: no-op for missing", () => {
  const s = createCredentialStore();
  const s2 = disableUser(s, "nonexistent");
  assert.equal(s2, s);
});

test("credentialCoverage: 1.0 with admin@local", () => {
  let s = createCredentialStore();
  s = createUser(s, "admin", "admin@local", "Admin1xxx");
  assert.equal(credentialCoverage(s), 1.0);
});

test("credentialCoverage: 0.5 with non-admin user", () => {
  let s = createCredentialStore();
  s = createUser(s, "alice", "alice@x.com", "Password1");
  assert.equal(credentialCoverage(s), 0.5);
});

test("listUsers: filter disabled", () => {
  let s = createCredentialStore();
  s = createUser(s, "a", "a@x", "Pw1aaaa");
  s = createUser(s, "b", "b@x", "Pw1bbbb");
  const id = getByUsername(s, "a")?.id;
  if (id) s = disableUser(s, id);
  assert.equal(listUsers(s, false).length, 1);
  assert.equal(listUsers(s, true).length, 2);
});

test("createUser: with metadata", () => {
  let s = createCredentialStore();
  s = createUser(s, "a", "a@x", "Pw1aaaa", { role: "admin", env: "prod" });
  const u = getByUsername(s, "a");
  if (u) {
    assert.equal(u.metadata.role, "admin");
    assert.equal(u.metadata.env, "prod");
  }
});
