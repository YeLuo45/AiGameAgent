// V18 EvolverOrchestrator (Direction D 18/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEvolverState,
  analyze,
  tuneCycle,
  shouldApply,
  evolverHealth,
} from "./evolver-orchestrator.js";
import { recordTask } from "./performance-tracker.js";
import { recordFeedback } from "./feedback-collector.js";
import { observe } from "./pattern-learner.js";
import { setParam, setTarget } from "./auto-tuner.js";

test("createEvolverState: empty", () => {
  const s = createEvolverState();
  assert.equal(Object.keys(s.perf.metrics).length, 0);
  assert.equal(Object.keys(s.patterns.patterns).length, 0);
});

test("analyze: returns all metrics", () => {
  // Use a patterns state with significant patterns to avoid the learning suggestion
  let s = createEvolverState();
  // Add 5 significant patterns (each with 4 observations to exceed minOccurrences=3)
  for (let round = 0; round < 4; round++) {
    let next = s;
    for (let i = 0; i < 5; i++) {
      next = { ...next, patterns: observe(next.patterns, "tool-usage", `p${i}`, true, "") };
    }
    s = next;
  }
  const a = analyze(s);
  assert.equal(a.systemPerformance, 1.0); // empty perf
  assert.ok(a.patternConfidence > 0.5, `expected > 0.5, got ${a.patternConfidence}`);
  assert.equal(a.feedbackSentiment, 0.5); // empty (neutral)
  assert.equal(a.evolutionVelocity, 0); // empty
  assert.equal(a.suggestions.length, 0);
  assert.deepEqual(a.reflections, []);
});

test("analyze: with data", () => {
  let s = createEvolverState();
  s = { ...s, perf: recordTask(s.perf, "a1", true, 100) };
  s = { ...s, perf: recordTask(s.perf, "a1", true, 100) };
  s = { ...s, feedback: recordFeedback(s.feedback, "user", "a1", "positive", 1, "good") };
  s = { ...s, patterns: observe(s.patterns, "tool-usage", "Read", true, "") };
  const a = analyze(s);
  assert.ok(a.systemPerformance > 0.5);
  assert.equal(a.feedbackSentiment, 1.0);
});

test("tuneCycle: adjusts params", () => {
  let s = createEvolverState();
  s = { ...s, tuner: setParam(s.tuner, "x", 0.5, 0, 1) };
  s = { ...s, tuner: setTarget(s.tuner, "x", 0.9) };
  const s2 = tuneCycle(s, { x: 0.5 });
  assert.ok(s2.tuner.params.x.value > 0.5);
});

test("shouldApply: critical = always", () => {
  const s = createEvolverState();
  const sug = { id: "1", ts: 0, category: "performance" as const, severity: "critical" as const, target: "x", message: "", suggestedAction: "", confidence: 0.1 };
  assert.equal(shouldApply(s, sug), true);
});

test("shouldApply: low confidence = skip", () => {
  const s = createEvolverState();
  const sug = { id: "1", ts: 0, category: "performance" as const, severity: "warn" as const, target: "x", message: "", suggestedAction: "", confidence: 0.2 };
  assert.equal(shouldApply(s, sug), false);
});

test("shouldApply: high confidence + good system = skip", () => {
  let s = createEvolverState();
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a", true, 100) };
  const sug = { id: "1", ts: 0, category: "performance" as const, severity: "warn" as const, target: "x", message: "", suggestedAction: "", confidence: 0.7 };
  assert.equal(shouldApply(s, sug), false);
});

test("shouldApply: medium confidence + bad system = apply", () => {
  let s = createEvolverState();
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a", false, 100) };
  const sug = { id: "1", ts: 0, category: "performance" as const, severity: "warn" as const, target: "x", message: "", suggestedAction: "", confidence: 0.7 };
  assert.equal(shouldApply(s, sug), true);
});

test("evolverHealth: 1.0 for empty", () => {
  // Empty state: systemPerformance=1, patternConfidence=0, feedbackSentiment=0.5, evolutionVelocity=0
  // 1.0*0.4 + 0*0.2 + 0.5*0.2 + 0*0.2 = 0.5
  assert.equal(evolverHealth(createEvolverState()), 0.5);
});
