// V7 MemoryInjector (Direction A 7/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPromptSections,
  planInjection,
  formatAsSystemPrompt,
  injectionEfficiency,
} from "./memory-injector.js";

test("buildPromptSections: empty", () => {
  const s = buildPromptSections({});
  assert.equal(s.length, 0);
});

test("buildPromptSections: L1 charter included with priority 1", () => {
  const s = buildPromptSections({ l1Charter: { goal: "ship game", milestones: ["m1"], nodes: ["n1"] } });
  assert.equal(s.length, 1);
  assert.equal(s[0].layer, "L1");
  assert.equal(s[0].priority, 1);
});

test("buildPromptSections: L0 recent as user role", () => {
  const s = buildPromptSections({ l0Recent: [{ agentId: "a1", text: "hi" }] });
  assert.equal(s[0].role, "user");
  assert.equal(s[0].layer, "L0");
});

test("buildPromptSections: order is L1, L4, L2, L3, L0", () => {
  const s = buildPromptSections({
    l1Charter: { goal: "g", milestones: [], nodes: [] },
    l4Patterns: [{ key: "k", value: "v", confidence: 0.5 }],
    l2Recent: "r",
    l3Notes: [{ agentId: "a", category: "task", content: "n" }],
    l0Recent: [{ agentId: "a", text: "x" }],
  });
  assert.equal(s[0].layer, "L1");
  assert.equal(s[1].layer, "L4");
  assert.equal(s[2].layer, "L2");
  assert.equal(s[3].layer, "L3");
  assert.equal(s[4].layer, "L0");
});

test("buildPromptSections: token estimate", () => {
  const s = buildPromptSections({ l1Charter: { goal: "a".repeat(100), milestones: ["b".repeat(40)], nodes: [] } });
  // 100 + 40 = 140 chars, /4 = 35 + 10 = 45
  assert.ok(s[0].tokens >= 40 && s[0].tokens <= 50);
});

test("planInjection: fits within budget", () => {
  const s = buildPromptSections({ l1Charter: { goal: "g", milestones: ["m"], nodes: ["n"] } });
  const plan = planInjection(s, 1000);
  assert.equal(plan.sections.length, 1);
  assert.equal(plan.omitted, 0);
});

test("planInjection: excludes when over budget", () => {
  const s = buildPromptSections({ l1Charter: { goal: "g", milestones: ["m"], nodes: ["n"] } });
  const plan = planInjection(s, 5);
  assert.equal(plan.sections.length, 0);
  assert.equal(plan.omitted, 1);
});

test("planInjection: respects priority (L1 first)", () => {
  const s = buildPromptSections({
    l1Charter: { goal: "charter", milestones: ["m"], nodes: [] },
    l0Recent: [{ agentId: "a", text: "x".repeat(1000) }],
  });
  const plan = planInjection(s, 50);
  // L1 fits, L0 doesn't
  assert.equal(plan.sections.length, 1);
  assert.equal(plan.sections[0].layer, "L1");
});

test("formatAsSystemPrompt: joins sections", () => {
  const s = buildPromptSections({ l1Charter: { goal: "g", milestones: ["m"], nodes: [] } });
  const plan = planInjection(s, 1000);
  const text = formatAsSystemPrompt(plan);
  assert.ok(text.includes("g"));
});

test("injectionEfficiency: ratio of used / budget", () => {
  const s = buildPromptSections({ l1Charter: { goal: "g", milestones: ["m"], nodes: [] } });
  const plan = planInjection(s, 1000);
  assert.ok(injectionEfficiency(plan) > 0);
  assert.ok(injectionEfficiency(plan) <= 1);
});

test("injectionEfficiency: 0 with empty budget", () => {
  assert.equal(injectionEfficiency({ sections: [], totalTokens: 0, budgetUsed: 0, budget: 0, omitted: 0 }), 0);
});
