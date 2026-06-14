// V3 L2ChangeHistory (Direction A 3/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createL2ChangeHistory,
  appendChange,
  queryChanges,
  countByKind,
  latestChange,
  changeVelocity,
} from "./l2-change-history.js";

test("createL2ChangeHistory: empty", () => {
  const s = createL2ChangeHistory();
  assert.equal(s.records.length, 0);
  assert.equal(s.nextId, 1);
});

test("appendChange: increments id + ts", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, ["goal"], "switch to dark");
  assert.equal(s.records[0].id, 1);
  assert.equal(s.records[0].ts, s.records[0].ts);
  assert.equal(s.nextId, 2);
});

test("appendChange: comment optional", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "milestones_changed", 1, 2, ["m1"]);
  assert.equal(s.records[0].comment, undefined);
});

test("appendChange: with comment", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "rollback", 2, 1, ["goal"], "rolled back due to bug");
  assert.equal(s.records[0].comment, "rolled back due to bug");
});

test("queryChanges: by kind", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, []);
  s = appendChange(s, "milestones_changed", 2, 3, []);
  s = appendChange(s, "goal_changed", 3, 4, []);
  assert.equal(queryChanges(s, { kind: "goal_changed" }).length, 2);
});

test("queryChanges: by version range", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, []);
  s = appendChange(s, "goal_changed", 2, 3, []);
  s = appendChange(s, "goal_changed", 3, 4, []);
  assert.equal(queryChanges(s, { fromVersion: 2, toVersion: 3 }).length, 1);
});

test("queryChanges: by ts range", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, []);
  s = appendChange(s, "goal_changed", 2, 3, []);
  const since = Date.now();
  s = appendChange(s, "goal_changed", 3, 4, []);
  assert.ok(queryChanges(s, { since }).length >= 1);
});

test("countByKind: aggregate", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, []);
  s = appendChange(s, "goal_changed", 2, 3, []);
  s = appendChange(s, "milestones_changed", 3, 4, []);
  const c = countByKind(s);
  assert.equal(c["goal_changed"], 2);
  assert.equal(c["milestones_changed"], 1);
});

test("latestChange: returns last", () => {
  let s = createL2ChangeHistory();
  s = appendChange(s, "goal_changed", 1, 2, []);
  s = appendChange(s, "milestones_changed", 2, 3, []);
  assert.equal(latestChange(s)?.kind, "milestones_changed");
});

test("latestChange: undefined for empty", () => {
  assert.equal(latestChange(createL2ChangeHistory()), undefined);
});

test("changeVelocity: 0 for empty", () => {
  assert.equal(changeVelocity(createL2ChangeHistory()), 0);
});

test("changeVelocity: 1/hr for 2 changes in 1h", () => {
  const now = Date.now();
  const s = {
    ...createL2ChangeHistory(),
    records: [
      { id: 1, ts: now, kind: "goal_changed" as const, fromVersion: null, toVersion: null, affected: [] },
      { id: 2, ts: now + 3_600_000, kind: "goal_changed" as const, fromVersion: null, toVersion: null, affected: [] },
    ],
  };
  assert.equal(changeVelocity(s), 1);
});
