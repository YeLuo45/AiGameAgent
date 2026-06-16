// V30 MasterPipelineEvolution (Direction C+D 30/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMasterSnapshot,
  masterAction,
  createMasterInput,
} from "./master-pipeline-evolution.js";
import { recordTask } from "../evolution/performance-tracker.js";

test("createMasterInput: empty defaults", () => {
  const m = createMasterInput();
  assert.equal(m.phaseState.current, "ideation");
  assert.equal(m.schedule.totalScheduled, 0);
});

test("buildMasterSnapshot: all 7 metrics", () => {
  const s = buildMasterSnapshot(createMasterInput());
  assert.ok("pipelineProgress" in s);
  assert.ok("evolverHealth" in s);
  assert.ok("evolutionMastery" in s);
  assert.ok("scheduleThroughput" in s);
  assert.ok("taskSchedulerThroughput" in s);
  assert.ok("knowledgeDensity" in s);
  assert.ok("driftStability" in s);
  assert.ok("overall" in s);
});

test("buildMasterSnapshot: empty overall = mid", () => {
  const s = buildMasterSnapshot(createMasterInput());
  // pipelineProgress=1/6, pipelineMastery=?, evolverHealth=0.7, evolutionMastery=?, sched=1, task=1, know=0, drift=1
  // overall = avg
  assert.ok(s.overall > 0.2 && s.overall < 1.0);
});

test("masterAction: pipeline at start → advance-pipeline", () => {
  const s = buildMasterSnapshot(createMasterInput());
  // pipelineProgress = 1/6 ≈ 0.167 < 0.5
  assert.equal(masterAction(s).action, "advance-pipeline");
});

test("masterAction: low evolver → evolve", () => {
  const input = createMasterInput();
  input.phaseState = { ...input.phaseState, current: "polish" };
  // Make evolver underperform
  for (let i = 0; i < 5; i++) input.evolver = { ...input.evolver, perf: recordTask(input.evolver.perf, "a1", false, 100) };
  const s = buildMasterSnapshot(input);
  // evolverHealth should be < 0.5 now
  assert.ok(s.evolverHealth < 0.5, `expected < 0.5, got ${s.evolverHealth}`);
  assert.equal(masterAction(s).action, "evolve");
});

test("masterAction: low task throughput → balance-load", () => {
  const input = createMasterInput();
  input.phaseState = { ...input.phaseState, current: "polish" };
  input.taskScheduler = { ...input.taskScheduler, queue: [{ id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] }] };
  const s = buildMasterSnapshot(input);
  // taskSchedulerThroughput = 0 / 1 = 0
  assert.equal(masterAction(s).action, "balance-load");
});

test("masterAction: low knowledge → rebalance", () => {
  const input = createMasterInput();
  input.phaseState = { ...input.phaseState, current: "polish" };
  input.knowledge = { ...input.knowledge }; // empty
  const s = buildMasterSnapshot(input);
  // knowledgeDensity = 0 < 0.3
  assert.equal(masterAction(s).action, "rebalance-knowledge");
});

test("masterAction: drift → investigate", () => {
  const input = createMasterInput();
  input.phaseState = { ...input.phaseState, current: "polish" };
  // Add knowledge packets to satisfy rebalance-knowledge check
  for (let i = 0; i < 10; i++) input.knowledge = { ...input.knowledge, packets: [...input.knowledge.packets, { id: i + 1, ts: 1, fromAgent: "a", toAgent: "b", topic: "x", payload: {}, confidence: 0.8 }], nextId: i + 2 };
  // Add high-priority tasks to satisfy balance-load check
  input.taskScheduler = { ...input.taskScheduler, queue: [] };
  // Add drift
  input.drift = { ...input.drift, snapshots: [
    { ts: 1, metric: "success-rate", value: 0.5, baseline: 0.9 },
    { ts: 2, metric: "success-rate", value: 0.5, baseline: 0.9 },
  ] };
  const s = buildMasterSnapshot(input);
  assert.equal(masterAction(s).action, "investigate-drift");
});

test("masterAction: all nominal → hold", () => {
  const input = createMasterInput();
  input.phaseState = { ...input.phaseState, current: "polish" };
  // Add knowledge to satisfy rebalance-knowledge check
  for (let i = 0; i < 10; i++) input.knowledge = { ...input.knowledge, packets: [...input.knowledge.packets, { id: i + 1, ts: 1, fromAgent: "a", toAgent: "b", topic: "x", payload: {}, confidence: 0.8 }], nextId: i + 2 };
  // Empty task queue so taskSchedulerThroughput = 1.0
  input.taskScheduler = { ...input.taskScheduler, queue: [] };
  const s = buildMasterSnapshot(input);
  // All metrics OK
  assert.equal(masterAction(s).action, "hold");
});
