// V17 AuthSession (Direction G 17/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState, login, getSession, touchSession, expireSession, revokeSession, listSessions, cleanupExpired, sessionHealth } from "./auth-session.js";
import { verifyToken, randomSecret } from "./auth-token.js";

test("createSessionState: empty", () => {
  const s = createSessionState();
  assert.equal(Object.keys(s.sessions).length, 0);
});

test("login: creates session", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const all = listSessions(s);
  assert.equal(all.length, 1);
  assert.equal(all[0].userId, "u1");
  assert.equal(all[0].status, "active");
});

test("login: token verifies", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const session = listSessions(s)[0];
  const verified = verifyToken(session.token.token, secret);
  assert.equal(verified?.sub, "u1");
});

test("getSession: undefined for missing", () => {
  assert.equal(getSession(createSessionState(), "x"), undefined);
});

test("touchSession: updates lastActiveAt", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const id = listSessions(s)[0].id;
  s = touchSession(s, id, 5000);
  assert.equal(getSession(s, id).lastActiveAt, 5000);
});

test("expireSession: status change", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const id = listSessions(s)[0].id;
  s = expireSession(s, id);
  assert.equal(getSession(s, id).status, "expired");
});

test("revokeSession: status change", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const id = listSessions(s)[0].id;
  s = revokeSession(s, id);
  assert.equal(getSession(s, id).status, "revoked");
});

test("listSessions: filter by userId", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  s = login(s, "u1", secret);
  s = login(s, "u2", secret);
  assert.equal(listSessions(s, { userId: "u1" }).length, 2);
});

test("listSessions: filter by status", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  const id = listSessions(s)[0].id;
  s = revokeSession(s, id);
  assert.equal(listSessions(s, { status: "revoked" }).length, 1);
  assert.equal(listSessions(s, { status: "active" }).length, 0);
});

test("cleanupExpired: removes expired", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret, -1); // already expired
  s = cleanupExpired(s);
  assert.equal(Object.keys(s.sessions).length, 0);
});

test("sessionHealth: 1.0 for empty", () => {
  assert.equal(sessionHealth(createSessionState()), 1.0);
});

test("sessionHealth: ratio active", () => {
  const secret = randomSecret();
  let s = createSessionState();
  s = login(s, "u1", secret);
  s = login(s, "u1", secret);
  s = revokeSession(s, listSessions(s)[0].id);
  assert.equal(sessionHealth(s), 0.5);
});
