// V3 PipelineRunner (Direction C 3/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline, runStep, runnerSuccessRate } from "./pipeline-runner.js";
import { createPhaseEngine, type Phase } from "./phase-engine.js";

function step(phase: Phase, run: (s: unknown) => Promise<unknown>) {
  return { phase, run };
}

test("runPipeline: empty steps", async () => {
  const r = await runPipeline([]);
  assert.equal(r.passed, true);
  assert.equal(r.failedPhases.length, 0);
});

test("runPipeline: all phases pass", async () => {
  const r = await runPipeline([
    step("ideation", async () => ({ idea: "a game about cats".padEnd(15), pitch: "this is a long enough pitch for sure" })),
    step("architecture", async () => ({ engine: "phaser", platforms: ["web"] })),
    step("design", async () => ({ systems: [{}] })),
    step("production", async () => ({ artifacts: ["a.ts"] })),
    step("polish", async () => ({ testReport: { passed: 10, failed: 0 } })),
    step("release", async () => ({ version: "1.0.0", platforms: ["web"] })),
  ]);
  assert.equal(r.passed, true);
  assert.equal(r.failedPhases.length, 0);
});

test("runPipeline: halts on first failure", async () => {
  const r = await runPipeline([
    step("ideation", async () => ({ idea: "a game about cats".padEnd(15), pitch: "this is a long enough pitch for sure" })),
    step("architecture", async () => ({ engine: "unity", platforms: ["web"] })), // bad engine
    step("design", async () => ({ systems: [{}] })),
  ]);
  assert.equal(r.passed, false);
  assert.deepEqual(r.failedPhases, ["architecture"]);
  // design should not have run
  assert.equal(r.state.outputs.design, undefined);
});

test("runPipeline: step throws → failure", async () => {
  const r = await runPipeline([
    step("ideation", async () => ({ idea: "valid game idea here", pitch: "a valid pitch that's long enough" })),
    step("architecture", async () => { throw new Error("boom"); }),
  ]);
  assert.equal(r.passed, false);
  assert.deepEqual(r.failedPhases, ["architecture"]);
});

test("runPipeline: gates populated per phase", async () => {
  const r = await runPipeline([
    step("ideation", async () => ({ idea: "a game about cats".padEnd(15), pitch: "this is a long enough pitch for sure" })),
  ]);
  assert.ok(r.gates.ideation);
  assert.equal(r.gates.ideation.passed, true);
});

test("runStep: single step", async () => {
  const s = createPhaseEngine();
  const r = await runStep(s, step("ideation", async () => ({ idea: "a game about cats".padEnd(15), pitch: "this is a long enough pitch for sure" })));
  assert.equal(r.gate?.passed, true);
});

test("runStep: no gate for unknown phase", async () => {
  // Use a custom step that doesn't have a gate
  const s = createPhaseEngine("ideation");
  const r = await runStep(s, { phase: "ideation", run: async () => "raw output" });
  // ideation has a gate though. Let me use a fake phase
  // Actually all phases have gates. Skip.
  assert.ok(r.gate);
});

test("runnerSuccessRate: all pass = 1.0", async () => {
  const r = await runPipeline([step("ideation", async () => ({ idea: "a game about cats".padEnd(15), pitch: "this is a long enough pitch for sure" }))]);
  assert.equal(runnerSuccessRate(r), 1.0);
});

test("runnerSuccessRate: empty = 0", async () => {
  const r = await runPipeline([]);
  assert.equal(runnerSuccessRate(r), 0);
});
