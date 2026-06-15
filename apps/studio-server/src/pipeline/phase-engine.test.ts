// V1 PhaseEngine (Direction C 1/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPhaseEngine,
  nextPhase,
  prevPhase,
  transition,
  setOutput,
  getOutput,
  isTerminal,
  isComplete,
  phaseIndex,
  progress,
  pipelineProgress,
  ALL_PHASES,
} from "./phase-engine.js";

test("createPhaseEngine: starts at ideation", () => {
  const s = createPhaseEngine();
  assert.equal(s.current, "ideation");
});

test("createPhaseEngine: custom start", () => {
  const s = createPhaseEngine("design");
  assert.equal(s.current, "design");
});

test("nextPhase: ideation → architecture", () => {
  assert.equal(nextPhase("ideation"), "architecture");
});

test("nextPhase: release → null (terminal)", () => {
  assert.equal(nextPhase("release"), null);
});

test("nextPhase: all transitions", () => {
  assert.equal(nextPhase("architecture"), "design");
  assert.equal(nextPhase("design"), "production");
  assert.equal(nextPhase("production"), "polish");
  assert.equal(nextPhase("polish"), "release");
});

test("prevPhase: architecture → ideation", () => {
  assert.equal(prevPhase("architecture"), "ideation");
});

test("prevPhase: ideation → null (first)", () => {
  assert.equal(prevPhase("ideation"), null);
});

test("transition: records history", () => {
  let s = createPhaseEngine();
  s = transition(s, "architecture");
  assert.equal(s.current, "architecture");
  assert.equal(s.history.length, 1);
});

test("transition: failure result", () => {
  let s = createPhaseEngine();
  s = transition(s, "architecture", "failure");
  assert.equal(s.history[0].result, "failure");
});

test("setOutput + getOutput", () => {
  let s = createPhaseEngine();
  s = setOutput(s, "ideation", { idea: "game" });
  assert.deepEqual(getOutput(s, "ideation"), { idea: "game" });
});

test("isTerminal: only release", () => {
  assert.equal(isTerminal("release"), true);
  assert.equal(isTerminal("ideation"), false);
  assert.equal(isTerminal("polish"), false);
});

test("isComplete: false at start", () => {
  assert.equal(isComplete(createPhaseEngine()), false);
});

test("isComplete: true after release success", () => {
  let s = createPhaseEngine();
  // walk all phases
  for (const p of ["architecture", "design", "production", "polish", "release"]) {
    s = transition(s, p as never, "success");
  }
  assert.equal(isComplete(s), true);
});

test("phaseIndex: ordering", () => {
  assert.equal(phaseIndex("ideation"), 0);
  assert.equal(phaseIndex("architecture"), 1);
  assert.equal(phaseIndex("release"), 5);
});

test("progress: 1/6 at start", () => {
  assert.equal(progress(createPhaseEngine()), 1 / 6);
});

test("progress: 6/6 at release", () => {
  let s = createPhaseEngine();
  s = transition(s, "release");
  assert.equal(progress(s), 1);
});

test("ALL_PHASES: 6 phases", () => {
  assert.equal(ALL_PHASES.length, 6);
});

test("pipelineProgress: alias for progress", () => {
  assert.equal(pipelineProgress(createPhaseEngine()), progress(createPhaseEngine()));
});
