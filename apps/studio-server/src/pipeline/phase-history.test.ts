// V6 PhaseHistory (Direction C 6/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPhaseHistory,
  recordEntry,
  queryHistory,
  countByKind,
  latestEntry,
  historyDensity,
} from "./phase-history.js";

test("createPhaseHistory: empty", () => {
  const s = createPhaseHistory();
  assert.equal(s.entries.length, 0);
  assert.equal(s.nextId, 1);
});

test("recordEntry: with phase", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "transition", "user", { from: "ideation", to: "architecture" }, "architecture");
  assert.equal(s.entries[0].phase, "architecture");
});

test("recordEntry: without phase", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "comment", "user", { text: "x" });
  assert.equal(s.entries[0].phase, undefined);
});

test("recordEntry: id auto-increments", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "comment", "u");
  s = recordEntry(s, "comment", "u");
  assert.equal(s.entries[1].id, 2);
});

test("queryHistory: by kind", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "transition", "u", {}, "ideation");
  s = recordEntry(s, "comment", "u");
  assert.equal(queryHistory(s, { kind: "transition" }).length, 1);
});

test("queryHistory: by phase", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "transition", "u", {}, "ideation");
  s = recordEntry(s, "transition", "u", {}, "design");
  assert.equal(queryHistory(s, { phase: "ideation" }).length, 1);
});

test("queryHistory: by actor", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "comment", "alice");
  s = recordEntry(s, "comment", "bob");
  assert.equal(queryHistory(s, { actor: "alice" }).length, 1);
});

test("queryHistory: by since", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "comment", "u");
  const since = Date.now() + 100;
  assert.equal(queryHistory(s, { since }).length, 0);
});

test("countByKind: aggregate", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "transition", "u", {}, "ideation");
  s = recordEntry(s, "transition", "u", {}, "design");
  s = recordEntry(s, "comment", "u");
  const c = countByKind(s);
  assert.equal(c.transition, 2);
  assert.equal(c.comment, 1);
});

test("latestEntry: returns last", () => {
  let s = createPhaseHistory();
  s = recordEntry(s, "comment", "u", { a: 1 });
  s = recordEntry(s, "transition", "u", { b: 2 }, "design");
  assert.equal(latestEntry(s)?.kind, "transition");
});

test("latestEntry: undefined for empty", () => {
  assert.equal(latestEntry(createPhaseHistory()), undefined);
});

test("historyDensity: 0 for empty", () => {
  assert.equal(historyDensity(createPhaseHistory()), 0);
});

test("historyDensity: scales with entries", () => {
  let s = createPhaseHistory();
  for (let i = 0; i < 30; i++) s = recordEntry(s, "comment", "u");
  assert.ok(historyDensity(s) > 0.5);
});
