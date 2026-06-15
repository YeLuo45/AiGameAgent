// V19 AgentProfile (Direction D 19/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAgentProfile,
  addCapability,
  setPreference,
  getCapability,
  hasCapability,
  recordTaskCompletion,
  avgCapabilityLevel,
  successRate,
  profileCompleteness,
} from "./agent-profile.js";

test("createAgentProfile: defaults", () => {
  const p = createAgentProfile("a1", "Alice", "developer");
  assert.equal(p.agentId, "a1");
  assert.equal(p.totalTasks, 0);
  assert.equal(p.capabilities.length, 0);
});

test("addCapability: creates", () => {
  let p = createAgentProfile("a1", "Alice", "dev");
  p = addCapability(p, "coding", 0.8);
  assert.equal(p.capabilities.length, 1);
  assert.equal(p.capabilities[0].level, 0.8);
});

test("addCapability: reinforces existing", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = addCapability(p, "coding", 0.5);
  p = addCapability(p, "coding", 0.7);
  assert.equal(p.capabilities.length, 1);
  assert.equal(p.capabilities[0].level, 0.7);
  assert.equal(p.capabilities[0].demonstrations, 2);
});

test("setPreference: stores", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = setPreference(p, "style", "concise");
  assert.equal(p.preferences.style, "concise");
});

test("getCapability: returns or undefined", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = addCapability(p, "coding", 0.5);
  assert.ok(getCapability(p, "coding"));
  assert.equal(getCapability(p, "unknown"), undefined);
});

test("hasCapability: true if level met", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = addCapability(p, "coding", 0.6);
  assert.equal(hasCapability(p, "coding"), true);
  assert.equal(hasCapability(p, "coding", 0.5), true);
  assert.equal(hasCapability(p, "coding", 0.7), false);
  assert.equal(hasCapability(p, "unknown"), false);
});

test("recordTaskCompletion: success/failure", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = recordTaskCompletion(p, true, 1000);
  p = recordTaskCompletion(p, false, 2000);
  assert.equal(p.totalTasks, 2);
  assert.equal(p.totalSuccesses, 1);
  assert.equal(p.lastActiveAt, 2000);
});

test("avgCapabilityLevel: 0 empty", () => {
  assert.equal(avgCapabilityLevel(createAgentProfile("a1", "A", "r")), 0);
});

test("avgCapabilityLevel: avg", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = addCapability(p, "a", 0.5);
  p = addCapability(p, "b", 0.9);
  assert.equal(avgCapabilityLevel(p), 0.7);
});

test("successRate: 1.0 empty", () => {
  assert.equal(successRate(createAgentProfile("a1", "A", "r")), 1.0);
});

test("successRate: ratio", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = recordTaskCompletion(p, true);
  p = recordTaskCompletion(p, false);
  p = recordTaskCompletion(p, true);
  assert.equal(successRate(p), 2 / 3);
});

test("profileCompleteness: 0 fresh", () => {
  const p = createAgentProfile("a1", "A", "r");
  assert.equal(profileCompleteness(p), 0);
});

test("profileCompleteness: 1.0 with all", () => {
  let p = createAgentProfile("a1", "A", "r");
  p = addCapability(p, "a");
  p = setPreference(p, "k", "v");
  p = recordTaskCompletion(p, true, 1);
  assert.equal(profileCompleteness(p), 1.0);
});
