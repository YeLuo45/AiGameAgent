// V26 EvolutionPipeline (Direction C 26/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evolveAtPhase,
  recordPhaseEvolution,
  integrationRate,
  DEFAULT_PHASE_EVOLUTION_CONFIG,
} from "./evolution-pipeline.js";
import { createEvolverState } from "../evolution/evolver-orchestrator.js";
import { recordTask } from "../evolution/performance-tracker.js";

test("DEFAULT_PHASE_EVOLUTION_CONFIG: autoEvolvePhases includes polish", () => {
  assert.ok(DEFAULT_PHASE_EVOLUTION_CONFIG.autoEvolvePhases.includes("polish"));
});

test("evolveAtPhase: ideation (not in autoEvolvePhases) = no-op", () => {
  const s = createEvolverState();
  const r = evolveAtPhase(s, "ideation");
  assert.equal(r.result.suggestions, 0);
});

test("evolveAtPhase: release triggers evolution", () => {
  let s = createEvolverState();
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a1", false, 100) };
  const r = evolveAtPhase(s, "release");
  assert.ok(r.result.applied > 0);
});

test("evolveAtPhase: clean system applies no critical", () => {
  let s = createEvolverState();
  for (let i = 0; i < 5; i++) s = { ...s, perf: recordTask(s.perf, "a1", true, 100) };
  const r = evolveAtPhase(s, "release");
  // No critical issues, no auto-apply
  assert.equal(r.result.applied, 0);
});

test("recordPhaseEvolution: success", () => {
  let s = createEvolverState();
  s = recordPhaseEvolution(s, "release", true);
  assert.equal(s.history.entries.length, 1);
  assert.equal(s.history.entries[0].kind, "improvement-applied");
});

test("recordPhaseEvolution: failure = rollback", () => {
  let s = createEvolverState();
  s = recordPhaseEvolution(s, "release", false);
  assert.equal(s.history.entries[0].kind, "rollback");
});

test("integrationRate: 0 empty", () => {
  assert.equal(integrationRate([]), 0);
});

test("integrationRate: ratio", () => {
  const r: import("./evolution-pipeline.js").PhaseEvolutionResult[] = [
    { phase: "polish", suggestions: 5, applied: 3, rejected: 2, errors: [] },
    { phase: "release", suggestions: 5, applied: 5, rejected: 0, errors: [] },
  ];
  assert.equal(integrationRate(r), 8 / 10);
});
