// V21 EvolutionCycle (Direction D 21/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { runEvolutionCycle, cycleEfficiency } from "./evolution-cycle.js";
import { createEvolverState } from "../evolution/evolver-orchestrator.js";
import { recordTask } from "../evolution/performance-tracker.js";
import { observe } from "../evolution/pattern-learner.js";

test("runEvolutionCycle: empty = no-op", () => {
  let s = createEvolverState();
  // Add significant patterns to avoid the learning-coverage suggestion
  for (let round = 0; round < 4; round++) {
    let next = s;
    for (let i = 0; i < 5; i++) next = { ...next, patterns: observe(next.patterns, "tool-usage", `p${i}`, true, "") };
    s = next;
  }
  const r = runEvolutionCycle(s);
  assert.equal(r.appliedSuggestions, 0);
  assert.equal(r.rejectedSuggestions, 0);
  assert.equal(r.newEvolutionEntries, 0);
});

test("runEvolutionCycle: applies critical suggestions", () => {
  let s = createEvolverState();
  // 5 failures → low success → critical suggestion
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a1", false, 100) };
  const r = runEvolutionCycle(s);
  assert.ok(r.appliedSuggestions > 0);
  assert.ok(r.newEvolutionEntries > 0);
});

test("runEvolutionCycle: rejects low confidence when system is good", () => {
  let s = createEvolverState();
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a1", true, 100) };
  // Add 4 observations × 5 patterns to avoid learning suggestion
  for (let round = 0; round < 4; round++) {
    let next = s;
    for (let i = 0; i < 5; i++) next = { ...next, patterns: observe(next.patterns, "tool-usage", `p${i}`, true, "") };
    s = next;
  }
  const r = runEvolutionCycle(s);
  assert.equal(r.appliedSuggestions, 0);
});

test("runEvolutionCycle: tunes params", () => {
  let s = createEvolverState();
  s = { ...s, perf: recordTask(s.perf, "a1", true, 100) };
  const r = runEvolutionCycle(s, { myParam: 0.5 });
  // Param should be set
  assert.ok(r.after.tuner.params.myParam);
});

test("cycleEfficiency: 1.0 for no suggestions", () => {
  assert.equal(cycleEfficiency({ before: createEvolverState(), after: createEvolverState(), appliedSuggestions: 0, rejectedSuggestions: 0, durationMs: 0, newEvolutionEntries: 0 }), 1.0);
});

test("cycleEfficiency: ratio", () => {
  const s = createEvolverState();
  const r: ReturnType<typeof runEvolutionCycle> = { before: s, after: s, appliedSuggestions: 3, rejectedSuggestions: 1, durationMs: 0, newEvolutionEntries: 4 };
  assert.equal(cycleEfficiency(r), 0.75);
});
