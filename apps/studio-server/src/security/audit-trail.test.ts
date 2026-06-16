// V24 AuditTrail (Direction G 24/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuditTrail, appendAudit, verifyChain, queryAudit, countByActor, auditIntegrity } from "./audit-trail.js";

test("createAuditTrail: empty", () => {
  const s = createAuditTrail();
  assert.equal(s.entries.length, 0);
});

test("appendAudit: adds entry with hash chain", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "admin", "create", "project", "success");
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].hash.length, 64);
});

test("appendAudit: chain links via prevHash", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u1", "update", "p1");
  assert.equal(s.entries[1].prevHash, s.entries[0].hash);
});

test("verifyChain: valid chain", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u1", "update", "p1");
  s = appendAudit(s, "u1", "delete", "p1");
  assert.equal(verifyChain(s), true);
});

test("verifyChain: empty = true", () => {
  assert.equal(verifyChain(createAuditTrail()), true);
});

test("verifyChain: detects tampering", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u1", "update", "p1");
  // Tamper with the first entry
  const tampered = { ...s, entries: s.entries.map((e, i) => i === 0 ? { ...e, actor: "hacker" } : e) };
  assert.equal(verifyChain(tampered), false);
});

test("queryAudit: by actor", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u2", "create", "p2");
  assert.equal(queryAudit(s, { actor: "u1" }).length, 1);
});

test("queryAudit: by outcome", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1", "success");
  s = appendAudit(s, "u1", "create", "p2", "denied");
  assert.equal(queryAudit(s, { outcome: "denied" }).length, 1);
});

test("countByActor: counts", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u1", "create", "p2");
  s = appendAudit(s, "u2", "create", "p3");
  assert.equal(countByActor(s, "u1"), 2);
});

test("auditIntegrity: 1.0 empty", () => {
  assert.equal(auditIntegrity(createAuditTrail()), 1.0);
});

test("auditIntegrity: 1.0 valid chain", () => {
  let s = createAuditTrail();
  s = appendAudit(s, "u1", "create", "p1");
  s = appendAudit(s, "u2", "update", "p1");
  assert.equal(auditIntegrity(s), 1.0);
});
