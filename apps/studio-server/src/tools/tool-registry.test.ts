// V16 ToolRegistry (Direction B 16/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createToolRegistry,
  registerTool,
  unregisterTool,
  getTool,
  setToolEnabled,
  listTools,
  findToolsByTag,
  registryHealth,
} from "./tool-registry.js";

function makeTool(name: string, category: "filesystem" | "search" | "shell" | "network" | "agent" | "custom" = "filesystem"): import("./tool-registry.js").ToolDefinition {
  return { name, category, description: `${name} tool`, parameters: {}, requiresSandbox: false, defaultTimeoutMs: 5000 };
}

test("createToolRegistry: empty", () => {
  const s = createToolRegistry();
  assert.equal(Object.keys(s.tools).length, 0);
});

test("registerTool: adds", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read"), "u");
  assert.ok(s.tools["Read"]);
});

test("registerTool: with tags", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read"), "u", ["fs", "safe"]);
  assert.deepEqual(s.tools["Read"].tags, ["fs", "safe"]);
});

test("unregisterTool: removes", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read"), "u");
  s = unregisterTool(s, "Read");
  assert.equal(s.tools["Read"], undefined);
});

test("unregisterTool: no-op for missing", () => {
  const s = createToolRegistry();
  const s1 = unregisterTool(s, "missing");
  assert.deepEqual(s1, s);
});

test("getTool: returns or undefined", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read"), "u");
  assert.ok(getTool(s, "Read"));
  assert.equal(getTool(s, "nope"), undefined);
});

test("setToolEnabled: toggles", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read"), "u");
  s = setToolEnabled(s, "Read", false);
  assert.equal(s.tools["Read"].enabled, false);
});

test("setToolEnabled: no-op for missing", () => {
  const s = createToolRegistry();
  const s1 = setToolEnabled(s, "nope", true);
  assert.equal(s1, s);
});

test("listTools: sorted alphabetically", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Zebra"), "u");
  s = registerTool(s, makeTool("Apple"), "u");
  s = registerTool(s, makeTool("Mango"), "u");
  const list = listTools(s);
  assert.equal(list[0].tool.name, "Apple");
  assert.equal(list[1].tool.name, "Mango");
  assert.equal(list[2].tool.name, "Zebra");
});

test("listTools: filter by category", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("Read", "filesystem"), "u");
  s = registerTool(s, makeTool("Grep", "search"), "u");
  assert.equal(listTools(s, { category: "filesystem" }).length, 1);
});

test("listTools: enabledOnly", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("a"), "u");
  s = registerTool(s, makeTool("b"), "u");
  s = setToolEnabled(s, "b", false);
  assert.equal(listTools(s, { enabledOnly: true }).length, 1);
});

test("findToolsByTag: matches", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("a"), "u", ["safe"]);
  s = registerTool(s, makeTool("b"), "u", ["dangerous"]);
  assert.equal(findToolsByTag(s, "safe").length, 1);
});

test("registryHealth: 0 empty", () => {
  assert.equal(registryHealth(createToolRegistry()), 0);
});

test("registryHealth: all enabled + categories", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("a", "filesystem"), "u");
  s = registerTool(s, makeTool("b", "search"), "u");
  s = registerTool(s, makeTool("c", "shell"), "u");
  // 1.0 (all enabled) + 0.3 (3 categories) = 1.3 → 1.0
  assert.equal(registryHealth(s), 1.0);
});

test("registryHealth: half enabled", () => {
  let s = createToolRegistry();
  s = registerTool(s, makeTool("a", "filesystem"), "u");
  s = registerTool(s, makeTool("b", "filesystem"), "u");
  s = setToolEnabled(s, "b", false);
  // 0.5 + 0.1 (1 category) = 0.6
  assert.ok(Math.abs(registryHealth(s) - 0.6) < 1e-9);
});
