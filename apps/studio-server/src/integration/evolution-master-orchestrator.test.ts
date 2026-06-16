// V25 EvolutionMasterOrchestrator (Direction D 25/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEvolutionSnapshot,
  evolutionMastery,
} from "./evolution-master-orchestrator.js";
import { createEvolverState } from "../evolution/evolver-orchestrator.js";
import { recordTask } from "../evolution/performance-tracker.js";
import { observe } from "../evolution/pattern-learner.js";
import { createScheduleState, schedule, markStarted, markCompleted } from "./adaptive-schedule.js";
import { createKnowledgeTransfer, transfer } from "./knowledge-transfer.js";
import { createDriftDetector, recordSnapshot } from "./drift-detector.js";

test("buildEvolutionSnapshot: all fields", () => {
  const snap = buildEvolutionSnapshot({
    evolver: createEvolverState(),
    schedule: createScheduleState(),
    knowledge: createKnowledgeTransfer(),
    drift: createDriftDetector(),
  });
  assert.equal(snap.evolverHealth, 0.5); // empty evolver
  assert.equal(snap.scheduleThroughput, 1.0); // empty
  assert.equal(snap.knowledgeDensity, 0); // empty
  assert.equal(snap.driftStability, 1.0); // empty
});

test("evolutionMastery: all 0.2 → bootstrap", () => {
  const m = evolutionMastery({ evolverHealth: 0.2, scheduleThroughput: 0.2, knowledgeDensity: 0.2, driftStability: 0.2 });
  // density = 0.2 < 0.3 → bootstrap
  assert.equal(m.adapt, "bootstrap");
});

test("evolutionMastery: all 1.0 → maintain", () => {
  const m = evolutionMastery({ evolverHealth: 1, scheduleThroughput: 1, knowledgeDensity: 1, driftStability: 1 });
  assert.equal(m.adapt, "maintain");
});

test("evolutionMastery: with data", () => {
  let evolver = createEvolverState();
  for (let i = 0; i < 5; i++) evolver = { ...evolver, perf: recordTask(evolver.perf, "a", true, 100) };
  // Add significant patterns to boost patternConfidence
  for (let round = 0; round < 4; round++) {
    let next = evolver;
    for (let i = 0; i < 5; i++) next = { ...next, patterns: observe(next.patterns, "tool-usage", `p${i}`, true, "") };
    evolver = next;
  }
  let sch = createScheduleState();
  sch = schedule(sch, { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  sch = markStarted(sch, "t1");
  sch = markCompleted(sch, "t1", 100);
  let knowledge = createKnowledgeTransfer();
  knowledge = transfer(knowledge, "a", "b", "tip", {});
  const drift = createDriftDetector();
  const snap = buildEvolutionSnapshot({ evolver, schedule: sch, knowledge, drift });
  assert.ok(snap.evolverHealth > 0.5, `expected > 0.5, got ${snap.evolverHealth}`);
  assert.equal(snap.scheduleThroughput, 1.0);
  assert.ok(snap.knowledgeDensity > 0);
  assert.equal(snap.driftStability, 1.0);
});
