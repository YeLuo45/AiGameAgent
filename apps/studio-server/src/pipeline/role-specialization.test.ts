// V4 RoleSpecialization (Direction C 4/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultAssignmentFor,
  allDefaultAssignments,
  createRoleState,
  setAssignment,
  getAssignment,
  agentMatches,
  findBestMatch,
  roleCoverage,
} from "./role-specialization.js";

test("defaultAssignmentFor: ideation = producer", () => {
  const a = defaultAssignmentFor("ideation");
  assert.equal(a.role, "producer");
  assert.ok(a.capabilities.length > 0);
});

test("defaultAssignmentFor: all 6 phases defined", () => {
  for (const p of ["ideation", "architecture", "design", "production", "polish", "release"] as const) {
    const a = defaultAssignmentFor(p);
    assert.ok(a);
    assert.equal(a.phase, p);
  }
});

test("allDefaultAssignments: 6 entries", () => {
  assert.equal(allDefaultAssignments().length, 6);
});

test("createRoleState: defaults all 6", () => {
  const s = createRoleState();
  assert.equal(Object.keys(s.assignments).length, 6);
});

test("setAssignment: overrides", () => {
  let s = createRoleState();
  s = setAssignment(s, "ideation", { agentId: "boss", role: "creative" });
  assert.equal(s.assignments.ideation.agentId, "boss");
  assert.equal(s.assignments.ideation.role, "creative");
});

test("getAssignment: returns current", () => {
  const s = createRoleState();
  const a = getAssignment(s, "release");
  assert.equal(a.role, "release-manager");
});

test("agentMatches: full coverage", () => {
  const a = defaultAssignmentFor("ideation");
  assert.equal(agentMatches(a, ["game-design", "pitch", "ideation", "extra"]), true);
});

test("agentMatches: missing capability", () => {
  const a = defaultAssignmentFor("ideation");
  assert.equal(agentMatches(a, ["game-design", "pitch"]), false);
});

test("agentMatches: empty agent caps = false", () => {
  const a = defaultAssignmentFor("ideation");
  assert.equal(agentMatches(a, []), false);
});

test("findBestMatch: returns best overlap", () => {
  const a = defaultAssignmentFor("production");
  const result = findBestMatch(a, [
    { id: "a1", capabilities: ["testing"] },
    { id: "a2", capabilities: ["programming", "art-pipeline"] },
    { id: "a3", capabilities: ["programming", "art-pipeline", "audio"] },
  ]);
  assert.equal(result, "a3");
});

test("findBestMatch: null when no overlap", () => {
  const a = defaultAssignmentFor("ideation");
  const result = findBestMatch(a, [{ id: "a1", capabilities: ["unrelated"] }]);
  assert.equal(result, null);
});

test("findBestMatch: null for empty candidates", () => {
  const a = defaultAssignmentFor("ideation");
  assert.equal(findBestMatch(a, []), null);
});

test("roleCoverage: 1.0 when all covered", () => {
  const s = createRoleState();
  const agents = [
    { id: "p", capabilities: ["game-design", "pitch", "ideation"] },
    { id: "a", capabilities: ["tech-decision", "engine-selection"] },
    { id: "d", capabilities: ["system-design", "level-design", "ui-ux"] },
    { id: "e", capabilities: ["programming", "art-pipeline", "audio"] },
    { id: "q", capabilities: ["testing", "profiling", "accessibility"] },
    { id: "r", capabilities: ["packaging", "deployment", "localization"] },
  ];
  assert.equal(roleCoverage(s, agents), 1.0);
});

test("roleCoverage: 0.5 when half covered", () => {
  const s = createRoleState();
  // Only ideation is covered
  const agents = [{ id: "p", capabilities: ["game-design", "pitch", "ideation"] }];
  assert.equal(roleCoverage(s, agents), 1 / 6);
});
