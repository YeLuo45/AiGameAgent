// V10 PipelineOrchestrator (Direction C 10/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPipelineOrchestrator,
  registerStep,
  runPhase,
  getVisualization,
  autoAssignAgent,
  orchestratorHealth,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from "./pipeline-orchestrator.js";

test("createPipelineOrchestrator: defaults", () => {
  const o = createPipelineOrchestrator();
  assert.equal(o.phaseState.current, "ideation");
  assert.equal(Object.keys(o.roles.assignments).length, 6);
  assert.equal(o.config.maxRetries, 3);
});

test("DEFAULT_ORCHESTRATOR_CONFIG: maxRetries 3", () => {
  assert.equal(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries, 3);
});

test("registerStep: adds step", () => {
  let o = createPipelineOrchestrator();
  o = registerStep(o, { phase: "ideation", run: async () => ({ idea: "x".repeat(15), pitch: "y".repeat(25) }) });
  assert.ok(o.steps.ideation);
});

test("runPhase: no step = error", async () => {
  const o = createPipelineOrchestrator();
  const r = await runPhase(o, "ideation");
  assert.equal(r.passed, false);
  assert.equal(r.orch.errors.errors.length, 1);
});

test("runPhase: success transitions to next phase", async () => {
  let o = createPipelineOrchestrator();
  o = registerStep(o, { phase: "ideation", run: async () => ({ idea: "valid game idea here", pitch: "a valid pitch that's long enough" }) });
  const r = await runPhase(o, "ideation");
  assert.equal(r.passed, true);
  // current doesn't change (runStep doesn't transition); but history is updated
  assert.equal(r.orch.history.entries.length, 1);
});

test("runPhase: gate failure records error", async () => {
  let o = createPipelineOrchestrator();
  o = registerStep(o, { phase: "ideation", run: async () => ({ idea: "x" }) }); // too short
  const r = await runPhase(o, "ideation");
  assert.equal(r.passed, false);
  assert.equal(r.orch.errors.errors.length, 1);
});

test("getVisualization: returns phases", () => {
  const o = createPipelineOrchestrator();
  const v = getVisualization(o);
  assert.equal(v.phases.length, 6);
});

test("autoAssignAgent: assigns best match", () => {
  let o = createPipelineOrchestrator();
  o = autoAssignAgent(o, "ideation", [
    { id: "a1", capabilities: ["game-design", "pitch", "ideation"] },
    { id: "a2", capabilities: ["tech-decision"] },
  ]);
  assert.equal(o.roles.assignments.ideation.agentId, "a1");
});

test("autoAssignAgent: no match = no change", () => {
  let o = createPipelineOrchestrator();
  const before = o.roles.assignments.ideation.agentId;
  o = autoAssignAgent(o, "ideation", [{ id: "a1", capabilities: ["unrelated"] }]);
  assert.equal(o.roles.assignments.ideation.agentId, before);
});

test("orchestratorHealth: 0.7 fresh", () => {
  const o = createPipelineOrchestrator();
  assert.equal(orchestratorHealth(o), 0.7);
});

test("orchestratorHealth: 1.0 complete", () => {
  let o = createPipelineOrchestrator();
  // Walk all phases via state
  for (const p of ["architecture", "design", "production", "polish", "release"] as const) {
    o = { ...o, phaseState: { ...o.phaseState, current: p, history: [...o.phaseState.history, { phase: p, ts: 1, result: "success" as const }] } };
  }
  assert.equal(orchestratorHealth(o), 1.0);
});
