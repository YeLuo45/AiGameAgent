// V30 MasterPipelineEvolution (Direction C+D 30/30, orchestrator)
// Final master orchestrator: integrate pipeline + evolution + scheduling

import { createPhaseEngine, type PhaseState } from "../pipeline/phase-engine.js";
import { type EvolverState, evolverHealth } from "../evolution/evolver-orchestrator.js";
import { type AdaptiveScheduleState, type TaskPriority, scheduleThroughput, type ScheduledTask } from "./adaptive-schedule.js";
import { type TaskSchedulerState, schedulerThroughput } from "./task-scheduler.js";
import { type KnowledgeTransferState, knowledgeDensity } from "./knowledge-transfer.js";
import { type DriftDetectorState, detectAllDrift, driftStability } from "./drift-detector.js";
import { buildEvolutionSnapshot, evolutionMastery } from "./evolution-master-orchestrator.js";

export interface MasterInput {
  phaseState: PhaseState;
  evolver: EvolverState;
  schedule: AdaptiveScheduleState;
  taskScheduler: TaskSchedulerState;
  knowledge: KnowledgeTransferState;
  drift: DriftDetectorState;
}

export interface MasterSnapshot {
  pipelineProgress: number;
  evolverHealth: number;
  evolutionMastery: number;
  scheduleThroughput: number;
  taskSchedulerThroughput: number;
  knowledgeDensity: number;
  driftStability: number;
  overall: number;
}

export function buildMasterSnapshot(input: MasterInput): MasterSnapshot {
  const evoSnap = buildEvolutionSnapshot({
    evolver: input.evolver,
    schedule: input.schedule,
    knowledge: input.knowledge,
    drift: input.drift,
  });
  const evoMastery = evolutionMastery(evoSnap);
  const driftAlerts = detectAllDrift(input.drift);
  // pipelineProgress = (idx + 1) / 6
  const phaseIdx = ["ideation", "architecture", "design", "production", "polish", "release"].indexOf(input.phaseState.current);
  const pipelineProgress = (phaseIdx + 1) / 6;
  return {
    pipelineProgress,
    evolverHealth: evolverHealth(input.evolver),
    evolutionMastery: evoMastery.score,
    scheduleThroughput: scheduleThroughput(input.schedule),
    taskSchedulerThroughput: schedulerThroughput(input.taskScheduler),
    knowledgeDensity: knowledgeDensity(input.knowledge),
    driftStability: driftStability(driftAlerts),
    overall: (pipelineProgress + evoMastery.score + scheduleThroughput(input.schedule) + schedulerThroughput(input.taskScheduler) + knowledgeDensity(input.knowledge) + driftStability(driftAlerts)) / 6,
  };
}

export function masterAction(snap: MasterSnapshot): { action: "advance-pipeline" | "evolve" | "balance-load" | "rebalance-knowledge" | "investigate-drift" | "hold"; reason: string } {
  if (snap.pipelineProgress < 0.5) return { action: "advance-pipeline", reason: "Pipeline not yet at midpoint" };
  if (snap.evolverHealth < 0.5) return { action: "evolve", reason: "Low evolver health" };
  if (snap.taskSchedulerThroughput < 0.5) return { action: "balance-load", reason: "Low task throughput" };
  if (snap.knowledgeDensity < 0.3) return { action: "rebalance-knowledge", reason: "Low knowledge sharing" };
  if (snap.driftStability < 0.7) return { action: "investigate-drift", reason: "Drift detected" };
  return { action: "hold", reason: "All systems nominal" };
}

export function createMasterInput(): MasterInput {
  return {
    phaseState: createPhaseEngine(),
    evolver: { perf: { metrics: {}, alpha: 0.3 }, patterns: { patterns: {}, minOccurrences: 3 }, feedback: { entries: [], nextId: 1, maxEntries: 1000 }, history: { entries: [], nextId: 1, byKind: {} as any }, tuner: { params: {}, targets: {} } },
    schedule: { queue: [], maxConcurrent: 3, running: [], avgDurationMs: 100, totalScheduled: 0, totalCompleted: 0 },
    taskScheduler: { queue: [], running: [], completed: [], maxConcurrent: 3 },
    knowledge: { packets: [], nextId: 1, byAgent: {}, maxPackets: 500 },
    drift: { snapshots: [], warnThreshold: 0.1, criticalThreshold: 0.3 },
  };
}
