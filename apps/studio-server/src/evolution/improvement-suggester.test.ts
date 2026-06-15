// V14 ImprovementSuggester (Direction D 14/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestImprovements,
  criticalSuggestions,
  improvementCoverage,
} from "./improvement-suggester.js";
import { createPerformanceTracker, recordTask } from "./performance-tracker.js";
import { createFeedbackCollector, recordFeedback } from "./feedback-collector.js";
import { createPatternLearner, observe } from "./pattern-learner.js";

test("suggestImprovements: empty when all healthy", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "a1", true, 100);
  let pa = createPatternLearner(2);
  for (let i = 0; i < 5; i++) pa = observe(pa, "tool-usage", `p${i}`, true, "");
  // Add 2nd observations
  for (let i = 0; i < 5; i++) pa = observe(pa, "tool-usage", `p${i}`, true, "");
  const f = createFeedbackCollector();
  const s = suggestImprovements(perf, f, pa);
  assert.equal(s.length, 0);
});

test("suggestImprovements: underperformer", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "bad", false, 100);
  const s = suggestImprovements(perf, createFeedbackCollector(), createPatternLearner(2));
  assert.ok(s.some((x) => x.target === "bad" && x.category === "performance"));
});

test("suggestImprovements: negative feedback", () => {
  let f = createFeedbackCollector();
  f = recordFeedback(f, "user", "Read", "negative", -0.8, "bad tool");
  const s = suggestImprovements(createPerformanceTracker(), f, createPatternLearner(2));
  assert.ok(s.some((x) => x.target === "Read" && x.category === "satisfaction"));
});

test("suggestImprovements: system-wide low performance", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 3; i++) perf = recordTask(perf, "a", false, 100);
  for (let i = 0; i < 3; i++) perf = recordTask(perf, "b", false, 100);
  const s = suggestImprovements(perf, createFeedbackCollector(), createPatternLearner(2));
  assert.ok(s.some((x) => x.target === "system" && x.severity === "critical"));
});

test("suggestImprovements: low pattern coverage", () => {
  let pa = createPatternLearner(5);
  pa = observe(pa, "tool-usage", "Read", true, "");
  pa = observe(pa, "tool-usage", "Read", true, "");
  const s = suggestImprovements(createPerformanceTracker(), createFeedbackCollector(), pa);
  assert.ok(s.some((x) => x.category === "learning"));
});

test("suggestImprovements: sorted by severity", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "bad", false, 100);
  let f = createFeedbackCollector();
  f = recordFeedback(f, "user", "Read", "negative", -0.5, "x");
  const s = suggestImprovements(perf, f, createPatternLearner(2));
  // First should be critical (perf < 0.3) or warn
  if (s.length > 1) {
    const w0 = s[0].severity === "critical" ? 3 : s[0].severity === "warn" ? 2 : 1;
    const w1 = s[1].severity === "critical" ? 3 : s[1].severity === "warn" ? 2 : 1;
    assert.ok(w0 >= w1);
  }
});

test("criticalSuggestions: only critical", () => {
  let perf = createPerformanceTracker();
  for (let i = 0; i < 5; i++) perf = recordTask(perf, "bad", false, 100);
  let f = createFeedbackCollector();
  f = recordFeedback(f, "user", "Read", "negative", -0.9, "x");
  const s = suggestImprovements(perf, f, createPatternLearner(2));
  const c = criticalSuggestions(s);
  for (const x of c) assert.equal(x.severity, "critical");
});

test("improvementCoverage: 1.0 for empty", () => {
  assert.equal(improvementCoverage([]), 1.0);
});

test("improvementCoverage: ratio of high-confidence", () => {
  const s = [
    { id: "1", ts: 0, category: "performance" as const, severity: "warn" as const, target: "x", message: "a", suggestedAction: "a", confidence: 0.9 },
    { id: "2", ts: 0, category: "performance" as const, severity: "warn" as const, target: "y", message: "b", suggestedAction: "b", confidence: 0.3 },
  ];
  assert.equal(improvementCoverage(s), 0.5);
});
