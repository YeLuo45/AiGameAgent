// V5 CrossPhaseHandoff (Direction C 5/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHandoffState,
  handoff,
  getHandoff,
  listHandoffs,
  buildNextHandoff,
  handoffCoverage,
} from "./cross-phase-handoff.js";

test("createHandoffState: empty", () => {
  const s = createHandoffState();
  assert.equal(s.docs.length, 0);
  assert.equal(Object.keys(s.latest).length, 0);
});

test("handoff: records doc", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", { idea: "game" }, "idea handed off");
  assert.equal(s.docs.length, 1);
  assert.equal(s.latest["ideation->architecture"]?.summary, "idea handed off");
});

test("handoff: overwrites latest for same pair", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", { v: 1 });
  s = handoff(s, "ideation", "architecture", { v: 2 });
  assert.equal(s.docs.length, 2);
  assert.equal((s.latest["ideation->architecture"]?.payload as { v: number }).v, 2);
});

test("getHandoff: returns latest", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", { idea: "x" });
  const doc = getHandoff(s, "ideation", "architecture");
  assert.ok(doc);
  assert.deepEqual(doc?.payload, { idea: "x" });
});

test("getHandoff: undefined for missing", () => {
  assert.equal(getHandoff(createHandoffState(), "ideation", "architecture"), undefined);
});

test("listHandoffs: all", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", {});
  s = handoff(s, "ideation", "design", {});
  assert.equal(listHandoffs(s).length, 2);
});

test("listHandoffs: filter by from", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", {});
  s = handoff(s, "design", "production", {});
  assert.equal(listHandoffs(s, "ideation").length, 1);
});

test("buildNextHandoff: includes target + ts", () => {
  const h = buildNextHandoff({ a: 1 }, "design");
  assert.equal(h.a, 1);
  assert.equal(h._target, "design");
  assert.ok(h._ts);
});

test("handoffCoverage: 1.0 when all covered", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", {});
  s = handoff(s, "architecture", "design", {});
  s = handoff(s, "design", "production", {});
  const cov = handoffCoverage(s, [["ideation", "architecture"], ["architecture", "design"], ["design", "production"]]);
  assert.equal(cov, 1.0);
});

test("handoffCoverage: 0.5 when half covered", () => {
  let s = createHandoffState();
  s = handoff(s, "ideation", "architecture", {});
  const cov = handoffCoverage(s, [["ideation", "architecture"], ["architecture", "design"]]);
  assert.equal(cov, 0.5);
});

test("handoffCoverage: 1.0 for empty", () => {
  assert.equal(handoffCoverage(createHandoffState(), []), 1.0);
});
