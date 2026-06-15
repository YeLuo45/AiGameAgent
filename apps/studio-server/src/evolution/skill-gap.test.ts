// V20 SkillGap (Direction D 20/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identifyGap,
  identifyAllGaps,
  criticalGaps,
  suggestTraining,
  agentSkillCoverage,
  DEFAULT_REQUIREMENTS,
} from "./skill-gap.js";

test("DEFAULT_REQUIREMENTS: 5 task kinds", () => {
  assert.equal(Object.keys(DEFAULT_REQUIREMENTS).length, 5);
});

test("identifyGap: full match", () => {
  const g = identifyGap(["writing", "language"], "text");
  assert.equal(g.missing.length, 0);
  assert.equal(g.coverage, 1.0);
});

test("identifyGap: partial match", () => {
  const g = identifyGap(["writing"], "text");
  assert.deepEqual(g.missing, ["language"]);
  assert.equal(g.coverage, 0.5);
});

test("identifyGap: no match", () => {
  const g = identifyGap([], "code");
  assert.equal(g.missing.length, 3);
  assert.equal(g.coverage, 0);
});

test("identifyAllGaps: 5 entries", () => {
  const gaps = identifyAllGaps(["writing", "programming"]);
  assert.equal(gaps.length, 5);
});

test("identifyAllGaps: coverage varies", () => {
  const gaps = identifyAllGaps(["writing", "programming"]);
  const textGap = gaps.find((g) => g.taskKind === "text");
  const codeGap = gaps.find((g) => g.taskKind === "code");
  // text requires writing + language, we have writing
  assert.equal(textGap.coverage, 0.5);
  // code requires programming + debugging + testing, we have programming
  assert.equal(codeGap.coverage, 1 / 3);
});

test("criticalGaps: below threshold", () => {
  const gaps = [
    { taskKind: "text" as const, missing: [], coverage: 1.0 },
    { taskKind: "code" as const, missing: ["debugging", "testing"], coverage: 0.33 },
  ];
  const c = criticalGaps(gaps, 0.5);
  assert.equal(c.length, 1);
  assert.equal(c[0].taskKind, "code");
});

test("suggestTraining: returns training items", () => {
  const g = identifyGap([], "text");
  const t = suggestTraining(g);
  assert.ok(t.length > 0);
  assert.ok(t[0].includes("Train skill"));
});

test("agentSkillCoverage: 0 empty", () => {
  assert.equal(agentSkillCoverage([]), 0);
});

test("agentSkillCoverage: full when all skills present", () => {
  const allSkills = Array.from(new Set(Object.values(DEFAULT_REQUIREMENTS).flat()));
  assert.equal(agentSkillCoverage(allSkills), 1.0);
});

test("agentSkillCoverage: avg", () => {
  // Just "writing" - text has writing+language (50%), code 0%, summary 33%, tools 0%, creative 33%
  // avg = (0.5 + 0 + 1/3 + 0 + 1/3) / 5 = 0.233
  const cov = agentSkillCoverage(["writing"]);
  assert.ok(cov > 0.2 && cov < 0.3, `expected ~0.23, got ${cov}`);
});
