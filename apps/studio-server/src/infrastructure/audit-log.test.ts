// V18 AuditLog (Direction E 18/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAuditLog,
  appendAudit,
  queryAudit,
  countAudit,
  countByAction,
  countByActor,
  distinctActors,
  auditLogHealth,
} from "./audit-log.js";

test("createAuditLog: empty defaults", () => {
  const s = createAuditLog();
  assert.equal(s.entries.length, 0);
  assert.equal(s.nextId, 1);
  assert.equal(s.maxEntries, 50_000);
});

test("appendAudit: adds entry with auto id + ts", () => {
  let s = createAuditLog();
  const r = appendAudit(s, { actor: "admin", action: "create", resource: "project" });
  assert.equal(r.entry.id, 1);
  assert.ok(r.entry.ts);
  assert.equal(r.state.nextId, 2);
});

test("appendAudit: with explicit ts", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "a", action: "create", resource: "r", ts: "2026-06-14T00:00:00.000Z" }).state;
  assert.equal(s.entries[0].ts, "2026-06-14T00:00:00.000Z");
});

test("appendAudit: maxEntries evicts oldest", () => {
  let s = createAuditLog(2);
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0].id, 2);
});

test("queryAudit: by actor", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "alice", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "bob", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "alice", action: "update", resource: "r" }).state;
  assert.equal(queryAudit(s, { actor: "alice" }).length, 2);
});

test("queryAudit: by action", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "delete", resource: "r" }).state;
  assert.equal(queryAudit(s, { action: "delete" }).length, 1);
});

test("queryAudit: by resource", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "a", action: "create", resource: "project" }).state;
  s = appendAudit(s, { actor: "a", action: "create", resource: "agent" }).state;
  assert.equal(queryAudit(s, { resource: "agent" }).length, 1);
});

test("queryAudit: by id range + pagination", () => {
  let s = createAuditLog();
  for (let i = 0; i < 10; i++) s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  assert.equal(queryAudit(s, { fromId: 3, toId: 7 }).length, 5);
  assert.equal(queryAudit(s, {}, 3, 0).length, 3);
  assert.equal(queryAudit(s, {}, 3, 8).length, 2);
});

test("countAudit: same as queryAudit length", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "delete", resource: "r" }).state;
  assert.equal(countAudit(s), 3);
  assert.equal(countAudit(s, { action: "create" }), 2);
});

test("countByAction: aggregate", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "a", action: "delete", resource: "r" }).state;
  const c = countByAction(s);
  assert.equal(c["create"], 2);
  assert.equal(c["delete"], 1);
});

test("countByActor: aggregate", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "alice", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "bob", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "alice", action: "delete", resource: "r" }).state;
  const c = countByActor(s);
  assert.equal(c["alice"], 2);
  assert.equal(c["bob"], 1);
});

test("distinctActors: sorted unique", () => {
  let s = createAuditLog();
  s = appendAudit(s, { actor: "charlie", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "alice", action: "create", resource: "r" }).state;
  s = appendAudit(s, { actor: "charlie", action: "delete", resource: "r" }).state;
  assert.deepEqual(distinctActors(s), ["alice", "charlie"]);
});

test("auditLogHealth: empty = 1.0 (no events bonus lost but no penalty)", () => {
  // 1.0 (start) - 0 (no util penalty) - 0 (no length bonus) = 1.0
  assert.equal(auditLogHealth(createAuditLog()), 1.0);
});

test("auditLogHealth: with events = 1.1 clamped to 1.0", () => {
  let s = createAuditLog(100);
  s = appendAudit(s, { actor: "a", action: "create", resource: "r" }).state;
  assert.equal(auditLogHealth(s), 1.0);
});

test("auditLogHealth: near eviction penalized", () => {
  const s = { ...createAuditLog(10), entries: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, ts: "x", actor: "a", action: "create" as const, resource: "r" })) };
  // 10/10 = 1.0 → -0.2 + 0.1 (events>0) = 0.9
  assert.equal(auditLogHealth(s), 0.9);
});
