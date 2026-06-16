// V27 TaskDecomposer (Direction C 27/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decomposeTask,
  buildDecomposition,
  leaves,
  roots,
  decompositionQuality,
} from "./task-decomposer.js";

test("decomposeTask: empty = empty", () => {
  const d = decomposeTask("");
  assert.equal(d.subtasks.length, 0);
});

test("decomposeTask: single sentence = single subtask", () => {
  const d = decomposeTask("Build the login page");
  assert.equal(d.subtasks.length, 1);
});

test("decomposeTask: multiple sentences", () => {
  const d = decomposeTask("Build the login page. Add password validation. Style the form.");
  assert.equal(d.subtasks.length, 3);
});

test("decomposeTask: sequential dependencies", () => {
  const d = decomposeTask("First, run the unit tests. Then, run the integration tests. Then, build the artifacts.", "sequential");
  assert.deepEqual(d.subtasks[1].dependsOn, ["st1"]);
  assert.deepEqual(d.subtasks[2].dependsOn, ["st2"]);
});

test("decomposeTask: parallel = no dependencies", () => {
  const d = decomposeTask("Build the login page. Add password validation. Style the form.", "parallel");
  for (const s of d.subtasks) assert.equal(s.dependsOn.length, 0);
});

test("decomposeTask: totalEffort sums", () => {
  const d = decomposeTask("Do task A. Do task B. Do task C.");
  const sum = d.subtasks.reduce((a, s) => a + s.effort, 0);
  assert.ok(Math.abs(d.totalEffort - sum) < 1e-9);
});

test("decomposeTask: depth", () => {
  const d = decomposeTask("First, do task A. Then, do task B. Then, do task C.");
  assert.equal(d.depth, 3);
});

test("buildDecomposition: with explicit subtasks", () => {
  const d = buildDecomposition([
    { id: "a", name: "A", description: "do a", dependsOn: [], effort: 0.3 },
    { id: "b", name: "B", description: "do b", dependsOn: ["a"], effort: 0.5 },
  ]);
  assert.equal(d.subtasks.length, 2);
  assert.equal(d.totalEffort, 0.8);
  assert.equal(d.depth, 2);
});

test("leaves: no dependents", () => {
  const d = buildDecomposition([
    { id: "a", name: "A", description: "", dependsOn: [], effort: 0.5 },
    { id: "b", name: "B", description: "", dependsOn: ["a"], effort: 0.5 },
  ]);
  const l = leaves(d);
  assert.equal(l.length, 1);
  assert.equal(l[0].id, "b");
});

test("roots: no dependencies", () => {
  const d = buildDecomposition([
    { id: "a", name: "A", description: "", dependsOn: [], effort: 0.5 },
    { id: "b", name: "B", description: "", dependsOn: ["a"], effort: 0.5 },
  ]);
  const r = roots(d);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "a");
});

test("decompositionQuality: 0 empty", () => {
  assert.equal(decompositionQuality({ strategy: "sequential", subtasks: [], totalEffort: 0, depth: 0 }), 0);
});

test("decompositionQuality: 1.0 with 5+ subtasks", () => {
  const d = buildDecomposition(Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, name: "x", description: "", dependsOn: [], effort: 0.2 })));
  assert.equal(decompositionQuality(d), 1.0);
});
