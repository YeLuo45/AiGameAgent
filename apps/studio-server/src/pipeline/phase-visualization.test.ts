// V7 PhaseVisualization (Direction C 7/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVisualization,
  progressBar,
  visualizationCompleteness,
} from "./phase-visualization.js";
import { createPhaseEngine, transition, setOutput } from "./phase-engine.js";

test("buildVisualization: all pending at start", () => {
  const v = buildVisualization(createPhaseEngine());
  assert.equal(v.phases.length, 6);
  assert.equal(v.phases[0].status, "current"); // ideation is current
  assert.equal(v.phases[1].status, "pending");
  assert.equal(v.totalCompleted, 0);
  assert.equal(v.totalFailed, 0);
});

test("buildVisualization: completed phases", () => {
  let s = createPhaseEngine();
  s = transition(s, "architecture");
  s = transition(s, "design");
  const v = buildVisualization(s);
  assert.equal(v.phases[0].status, "completed"); // ideation
  assert.equal(v.phases[1].status, "completed"); // architecture
  assert.equal(v.phases[2].status, "current"); // design
  assert.equal(v.totalCompleted, 2);
});

test("buildVisualization: failed phase", () => {
  let s = createPhaseEngine();
  s = transition(s, "architecture", "failure");
  const v = buildVisualization(s);
  assert.equal(v.phases[0].status, "completed");
  assert.equal(v.phases[1].status, "failed");
  assert.equal(v.totalFailed, 1);
});

test("buildVisualization: with output", () => {
  let s = createPhaseEngine();
  s = setOutput(s, "ideation", { idea: "test" });
  s = transition(s, "architecture");
  const v = buildVisualization(s);
  assert.equal(v.phases[0].hasOutput, true);
  assert.ok(v.phases[0].outputSummary.includes("idea"));
});

test("buildVisualization: skipped phase", () => {
  let s = createPhaseEngine();
  s = transition(s, "architecture", "skipped");
  const v = buildVisualization(s);
  assert.equal(v.phases[1].status, "skipped");
});

test("buildVisualization: progress calculation", () => {
  const v = buildVisualization(createPhaseEngine());
  // ideation is current → 1/6
  assert.equal(v.overallProgress, 1 / 6);
});

test("progressBar: empty", () => {
  const bar = progressBar(0, 5);
  assert.equal(bar, "[░░░░░]");
});

test("progressBar: full", () => {
  const bar = progressBar(1, 5);
  assert.equal(bar, "[█████]");
});

test("progressBar: half", () => {
  const bar = progressBar(0.5, 4);
  assert.equal(bar, "[██░░]");
});

test("progressBar: custom width", () => {
  const bar = progressBar(1, 10);
  assert.equal(bar, "[██████████]");
});

test("visualizationCompleteness: 0 all pending", () => {
  const v = buildVisualization(createPhaseEngine());
  // ideation is current (not pending)
  assert.equal(visualizationCompleteness(v), 1 / 6);
});

test("visualizationCompleteness: 1.0 all done", () => {
  let s = createPhaseEngine();
  for (const p of ["architecture", "design", "production", "polish", "release"] as const) {
    s = transition(s, p);
  }
  const v = buildVisualization(s);
  // ideation completed, release current
  assert.equal(visualizationCompleteness(v), 1.0);
});
