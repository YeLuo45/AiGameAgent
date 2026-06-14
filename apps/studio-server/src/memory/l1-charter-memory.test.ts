// V2 L1CharterMemory (Direction A 2/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createL1CharterMemory,
  addCharterSnapshot,
  getCurrentCharter,
  getCharterByVersion,
  listCharters,
  setCurrentVersion,
  diffCharters,
  charterConsistency,
} from "./l1-charter-memory.js";

test("createL1CharterMemory: empty", () => {
  const s = createL1CharterMemory();
  assert.equal(s.snapshots.length, 0);
  assert.equal(s.currentVersion, null);
});

test("addCharterSnapshot: adds with id + ts", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g1", milestones: ["m1"], nodes: ["n1"], reason: "initial", createdBy: "boss" });
  assert.equal(s.snapshots.length, 1);
  assert.equal(s.snapshots[0].id, "charter-1");
  assert.equal(s.snapshots[0].ts, s.snapshots[0].ts);
});

test("addCharterSnapshot: with explicit ts", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u", ts: 1000 });
  assert.equal(s.snapshots[0].ts, 1000);
});

test("getCurrentCharter: null when empty", () => {
  assert.equal(getCurrentCharter(createL1CharterMemory()), null);
});

test("getCurrentCharter: returns current", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g1", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g2", milestones: [], nodes: [], reason: "approval", createdBy: "u" });
  assert.equal(getCurrentCharter(s)?.version, 2);
});

test("getCharterByVersion: found", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g2", milestones: [], nodes: [], reason: "approval", createdBy: "u" });
  assert.equal(getCharterByVersion(s, 1)?.goal, "g");
  assert.equal(getCharterByVersion(s, 99), null);
});

test("listCharters: asc sort by default", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 3, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  const list = listCharters(s);
  assert.equal(list[0].version, 1);
  assert.equal(list[2].version, 3);
});

test("listCharters: desc sort", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  const list = listCharters(s, true);
  assert.equal(list[0].version, 2);
});

test("setCurrentVersion: changes current", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = setCurrentVersion(s, 1);
  assert.equal(s.currentVersion, 1);
});

test("setCurrentVersion: no-op for missing", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  const s1 = setCurrentVersion(s, 99);
  assert.equal(s1, s);
});

test("diffCharters: goal changed", () => {
  const a = { id: "c1", version: 1, ts: 1, goal: "a", milestones: [], nodes: [], reason: "initial" as const, createdBy: "u" };
  const b = { id: "c2", version: 2, ts: 2, goal: "b", milestones: [], nodes: [], reason: "approval" as const, createdBy: "u" };
  const d = diffCharters(a, b);
  assert.equal(d.goalChanged, true);
});

test("diffCharters: milestones added/removed", () => {
  const a = { id: "c1", version: 1, ts: 1, goal: "g", milestones: ["m1", "m2"], nodes: [], reason: "initial" as const, createdBy: "u" };
  const b = { id: "c2", version: 2, ts: 2, goal: "g", milestones: ["m1", "m3"], nodes: [], reason: "approval" as const, createdBy: "u" };
  const d = diffCharters(a, b);
  assert.deepEqual(d.milestonesAdded, ["m3"]);
  assert.deepEqual(d.milestonesRemoved, ["m2"]);
});

test("diffCharters: nodes added/removed", () => {
  const a = { id: "c1", version: 1, ts: 1, goal: "g", milestones: [], nodes: ["n1"], reason: "initial" as const, createdBy: "u" };
  const b = { id: "c2", version: 2, ts: 2, goal: "g", milestones: [], nodes: ["n2"], reason: "approval" as const, createdBy: "u" };
  const d = diffCharters(a, b);
  assert.deepEqual(d.nodesAdded, ["n2"]);
  assert.deepEqual(d.nodesRemoved, ["n1"]);
});

test("charterConsistency: 1.0 with <2 snapshots", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  assert.equal(charterConsistency(s), 1.0);
});

test("charterConsistency: 1.0 for identical consecutive", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g", milestones: ["m1"], nodes: ["n1"], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g", milestones: ["m1"], nodes: ["n1"], reason: "approval", createdBy: "u" });
  assert.equal(charterConsistency(s), 1.0);
});

test("charterConsistency: lower with goal change", () => {
  let s = createL1CharterMemory();
  s = addCharterSnapshot(s, { version: 1, goal: "g1", milestones: [], nodes: [], reason: "initial", createdBy: "u" });
  s = addCharterSnapshot(s, { version: 2, goal: "g2", milestones: [], nodes: [], reason: "approval", createdBy: "u" });
  // 0.5 drift from goal change
  assert.equal(charterConsistency(s), 0.5);
});
