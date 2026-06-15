// V8 PhaseDependency (Direction C 8/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linearDependencyGraph,
  buildGraph,
  dependenciesOf,
  dependentsOf,
  isReady,
  topologicalOrder,
  graphHealth,
} from "./phase-dependency.js";

test("linearDependencyGraph: 6 nodes", () => {
  const g = linearDependencyGraph();
  assert.equal(g.nodes.length, 6);
});

test("linearDependencyGraph: each phase depends on previous", () => {
  const g = linearDependencyGraph();
  assert.deepEqual(g.edges.ideation, []);
  assert.deepEqual(g.edges.architecture, ["ideation"]);
  assert.deepEqual(g.edges.design, ["architecture"]);
  assert.deepEqual(g.edges.production, ["design"]);
  assert.deepEqual(g.edges.polish, ["production"]);
  assert.deepEqual(g.edges.release, ["polish"]);
});

test("buildGraph: custom edges", () => {
  const g = buildGraph({ production: ["ideation", "design"] });
  assert.deepEqual(g.edges.production, ["ideation", "design"]);
  assert.deepEqual(g.edges.ideation, []);
});

test("dependenciesOf: returns edges", () => {
  const g = linearDependencyGraph();
  assert.deepEqual(dependenciesOf(g, "release"), ["polish"]);
});

test("dependentsOf: returns reverse", () => {
  const g = linearDependencyGraph();
  assert.deepEqual(dependentsOf(g, "ideation"), ["architecture"]);
});

test("dependentsOf: multiple dependents", () => {
  const g = buildGraph({ production: ["ideation", "design"] });
  const deps = dependentsOf(g, "ideation");
  assert.ok(deps.includes("production"));
});

test("isReady: true when deps met", () => {
  const g = linearDependencyGraph();
  assert.equal(isReady(g, "architecture", new Set(["ideation"])), true);
});

test("isReady: false when deps missing", () => {
  const g = linearDependencyGraph();
  assert.equal(isReady(g, "architecture", new Set()), false);
});

test("isReady: multiple deps", () => {
  const g = buildGraph({ production: ["ideation", "design"] });
  assert.equal(isReady(g, "production", new Set(["ideation", "design"])), true);
  assert.equal(isReady(g, "production", new Set(["ideation"])), false);
});

test("topologicalOrder: linear = same as ALL_PHASES", () => {
  const g = linearDependencyGraph();
  const order = topologicalOrder(g);
  assert.deepEqual(order, ["ideation", "architecture", "design", "production", "polish", "release"]);
});

test("topologicalOrder: cycle = null", () => {
  const g = buildGraph({ ideation: ["release"], release: ["ideation"] });
  assert.equal(topologicalOrder(g), null);
});

test("topologicalOrder: independent phases", () => {
  const g = buildGraph({}); // no edges
  const order = topologicalOrder(g);
  assert.equal(order?.length, 6);
});

test("graphHealth: 1.0 linear", () => {
  assert.equal(graphHealth(linearDependencyGraph()), 1.0);
});

test("graphHealth: 0 for cycle", () => {
  const g = buildGraph({ ideation: ["release"], release: ["ideation"] });
  assert.equal(graphHealth(g), 0);
});
