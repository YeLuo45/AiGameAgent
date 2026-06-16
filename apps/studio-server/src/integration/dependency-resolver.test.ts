// V28 DependencyResolver (Direction C 28/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveDeps,
  findCriticalPath,
  dagDensity,
} from "./dependency-resolver.js";

test("resolveDeps: empty", () => {
  const r = resolveDeps([]);
  assert.equal(r.order.length, 0);
  assert.equal(r.hasCycle, false);
});

test("resolveDeps: linear", () => {
  const r = resolveDeps([
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
    { id: "c", deps: ["b"] },
  ]);
  assert.deepEqual(r.order, ["a", "b", "c"]);
  assert.equal(r.hasCycle, false);
});

test("resolveDeps: diamond", () => {
  const r = resolveDeps([
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
    { id: "c", deps: ["a"] },
    { id: "d", deps: ["b", "c"] },
  ]);
  assert.equal(r.order[0], "a");
  assert.equal(r.order[r.order.length - 1], "d");
  assert.equal(r.hasCycle, false);
});

test("resolveDeps: cycle detected", () => {
  const r = resolveDeps([
    { id: "a", deps: ["b"] },
    { id: "b", deps: ["a"] },
  ]);
  assert.equal(r.hasCycle, true);
  assert.ok(r.cycleNodes.length > 0);
});

test("resolveDeps: self-loop = cycle", () => {
  const r = resolveDeps([{ id: "a", deps: ["a"] }]);
  assert.equal(r.hasCycle, true);
});

test("resolveDeps: multiple components", () => {
  const r = resolveDeps([
    { id: "a1", deps: [] },
    { id: "a2", deps: ["a1"] },
    { id: "b1", deps: [] },
  ]);
  assert.equal(r.order.length, 3);
});

test("findCriticalPath: linear", () => {
  const path = findCriticalPath([
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
    { id: "c", deps: ["b"] },
  ]);
  assert.deepEqual(path, ["a", "b", "c"]);
});

test("findCriticalPath: with weights", () => {
  const path = findCriticalPath([
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
    { id: "c", deps: ["a"] },
  ], () => 1);
  assert.ok(path.length > 0);
});

test("findCriticalPath: cycle = empty", () => {
  const path = findCriticalPath([
    { id: "a", deps: ["b"] },
    { id: "b", deps: ["a"] },
  ]);
  assert.equal(path.length, 0);
});

test("dagDensity: empty = 0", () => {
  assert.equal(dagDensity([]), 0);
});

test("dagDensity: complete = 1", () => {
  const d = dagDensity([
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
  ]);
  // 1 edge, 1 possible edge → 1.0
  assert.equal(d, 1.0);
});
