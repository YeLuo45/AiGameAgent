// V26 KeyManager (Direction G 26/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createKeyManagerState, issueKey, getActiveKey, rotateKey, revokeKey, incrementUse, encryptWithActive, listKeys, rotationHealth } from "./key-manager.js";

test("createKeyManagerState: empty", () => {
  const s = createKeyManagerState();
  assert.equal(s.activeId, null);
});

test("issueKey: creates + sets active", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  assert.ok(s.activeId);
  assert.equal(getActiveKey(s).status, "active");
});

test("getActiveKey: undefined for empty", () => {
  assert.equal(getActiveKey(createKeyManagerState()), undefined);
});

test("rotateKey: marks current as rotating + issues new", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  const oldId = s.activeId;
  s = rotateKey(s);
  assert.equal(s.activeId !== oldId, true);
  assert.equal(s.keys[oldId].status, "rotating");
});

test("revokeKey: status change", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  const id = s.activeId;
  s = revokeKey(s, id);
  assert.equal(s.keys[id].status, "revoked");
  assert.equal(s.activeId, null);
});

test("revokeKey: no-op for missing", () => {
  const s = createKeyManagerState();
  const s2 = revokeKey(s, "missing");
  assert.equal(s2, s);
});

test("incrementUse: counter", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  const id = s.activeId!;
  s = incrementUse(s, id);
  s = incrementUse(s, id);
  assert.equal(s.keys[id].useCount, 2);
});

test("incrementUse: no-op for missing", () => {
  const s = createKeyManagerState();
  const s2 = incrementUse(s, "missing");
  assert.equal(s2, s);
});

test("encryptWithActive: returns null when no active", () => {
  assert.equal(encryptWithActive(createKeyManagerState(), "x"), null);
});

test("encryptWithActive: returns payload", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  const p = encryptWithActive(s, "hello");
  assert.ok(p);
  assert.ok(p!.ciphertext.length > 0);
});

test("listKeys: filter by status", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  s = rotateKey(s);
  assert.equal(listKeys(s, "active").length, 1);
  assert.equal(listKeys(s, "rotating").length, 1);
});

test("rotationHealth: 1.0 for empty", () => {
  assert.equal(rotationHealth(createKeyManagerState()), 1.0);
});

test("rotationHealth: active ratio", () => {
  let s = createKeyManagerState();
  s = issueKey(s);
  s = rotateKey(s);
  // 1 active + 1 rotating = 2 total, 1 active = 0.5
  assert.equal(rotationHealth(s), 0.5);
});
