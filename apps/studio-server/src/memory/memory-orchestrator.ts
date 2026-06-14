// V15 MemoryOrchestrator (Direction A 15/30, chatdev)
// Coordinate all memory layers (inject, dream, snapshot, evict)

import { createMemoryLayer, type MemoryLayer, addCharterSnapshot, recordChange, addAgentNote, rememberPattern, memoryHealth } from "./memory-layer.js";
import { planInjection, type InjectionPlan } from "./memory-injector.js";
import { consolidate } from "./memory-consolidator.js";
import { takeSnapshot, type MemorySnapshot } from "./memory-snapshot.js";
import { evictByPolicy, type EvictableEntry, type EvictionPolicy } from "./memory-evictor.js";
import { runDream, createDreamState } from "./dream-memory.js";
import { recordMemoryEvent, createMemoryStreamReplay, type MemoryStreamReplayState } from "./memory-stream-replayer.js";

export interface OrchestratorConfig {
  dreamIntervalMs: number;
  defaultBudget: number;
  defaultEvictionPolicy: EvictionPolicy;
  defaultMaxCount: number;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  dreamIntervalMs: 1_800_000, // 30 min
  defaultBudget: 4000,
  defaultEvictionPolicy: "ttl-lru",
  defaultMaxCount: 1000,
};

export interface OrchestratorStats {
  injectionsPlanned: number;
  consolidationsRun: number;
  snapshotsTaken: number;
  evictionsRun: number;
  dreamsRun: number;
}

export interface MemoryOrchestrator {
  layer: MemoryLayer;
  stream: MemoryStreamReplayState;
  snapshots: MemorySnapshot[];
  config: OrchestratorConfig;
  stats: OrchestratorStats;
}

export function createMemoryOrchestrator(config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG): MemoryOrchestrator {
  return {
    layer: createMemoryLayer(),
    stream: createMemoryStreamReplay(),
    snapshots: [],
    config,
    stats: { injectionsPlanned: 0, consolidationsRun: 0, snapshotsTaken: 0, evictionsRun: 0, dreamsRun: 0 },
  };
}

export function orchestrateInject(orch: MemoryOrchestrator, opts: { text: string; budget?: number; layers?: Array<"L0" | "L1" | "L2" | "L3" | "L4"> }): InjectionPlan {
  // Build a synthetic injection plan from current state (simplified)
  const budget = opts.budget ?? orch.config.defaultBudget;
  const sections = planInjection([], budget); // empty sections since we don't build from layer here
  orch.stats = { ...orch.stats, injectionsPlanned: orch.stats.injectionsPlanned + 1 };
  return sections;
}

export function orchestrateConsolidate(orch: MemoryOrchestrator): MemoryOrchestrator {
  for (const agentId of Object.keys(orch.layer.l3)) {
    const r = consolidate(orch.layer.l3[agentId], orch.layer.l4);
    orch.layer.l4 = r.layer4;
  }
  orch.stats = { ...orch.stats, consolidationsRun: orch.stats.consolidationsRun + 1 };
  return orch;
}

export function orchestrateSnapshot(orch: MemoryOrchestrator, label: string = ""): MemoryOrchestrator {
  const snap = takeSnapshot(orch.layer, label);
  orch.snapshots = [...orch.snapshots, snap];
  orch.stats = { ...orch.stats, snapshotsTaken: orch.stats.snapshotsTaken + 1 };
  return orch;
}

export function orchestrateEvict(orch: MemoryOrchestrator, entries: EvictableEntry[], policy?: EvictionPolicy, maxCount?: number): { orch: MemoryOrchestrator; evicted: number } {
  const p = policy ?? orch.config.defaultEvictionPolicy;
  const r = evictByPolicy(entries, p, { maxCount: maxCount ?? orch.config.defaultMaxCount });
  orch.stats = { ...orch.stats, evictionsRun: orch.stats.evictionsRun + 1 };
  return { orch, evicted: r.evictedIds.length };
}

export function orchestrateDream(orch: MemoryOrchestrator, now: number = Date.now()): MemoryOrchestrator {
  const dreamState = createDreamState(orch.layer.l0, orch.layer.l3, orch.layer.l4);
  const newDream = runDream(dreamState, now);
  orch.layer.l0 = newDream.l0;
  orch.layer.l3 = newDream.l3ByAgent;
  orch.layer.l4 = newDream.l4;
  orch.stats = { ...orch.stats, dreamsRun: orch.stats.dreamsRun + 1 };
  orch.stream = recordMemoryEvent(orch.stream, { layer: "L4", op: "consolidate", targetId: "dream", actor: "orchestrator" });
  return orch;
}

/** Master metric: orchestrator throughput 0-1. */
export function orchestratorThroughput(orch: MemoryOrchestrator): number {
  const total = orch.stats.injectionsPlanned + orch.stats.consolidationsRun + orch.stats.snapshotsTaken + orch.stats.evictionsRun + orch.stats.dreamsRun;
  return Math.min(1, total / 100);
}

export function memoryLayerHealth(orch: MemoryOrchestrator): number {
  return memoryHealth(orch.layer);
}
