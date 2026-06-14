// V11 DreamMemory (Direction A 11/30, ruflo)
// Offline consolidation job (scheduled background merge)

import { type L0SessionMemoryState } from "./l0-session-memory.js";
import { type L3AgentMemoryState, addNote } from "./l3-agent-memory.js";
import { type L4PatternMemoryState, recordPattern } from "./l4-pattern-memory.js";
import { consolidate } from "./memory-consolidator.js";

export interface DreamState {
  l0: L0SessionMemoryState;
  l3ByAgent: Record<string, L3AgentMemoryState>;
  l4: L4PatternMemoryState;
  /** Last run time. */
  lastRunAt: number | null;
  /** Last run stats. */
  lastStats: { promoted: number; patternsFound: number; durationMs: number } | null;
  /** Total runs. */
  totalRuns: number;
}

export function createDreamState(l0: L0SessionMemoryState, l3ByAgent: Record<string, L3AgentMemoryState>, l4: L4PatternMemoryState): DreamState {
  return { l0, l3ByAgent, l4, lastRunAt: null, lastStats: null, totalRuns: 0 };
}

/** Run a dream cycle: convert L0 highlights into L3 notes, consolidate L3 → L4. */
export function runDream(state: DreamState, now: number = Date.now()): DreamState {
  const started = Date.now();
  let l3 = state.l3ByAgent;
  let promoted = 0;
  // Step 1: Promote L0 highlights into L3
  for (const e of state.l0.entries) {
    if (e.kind === "user" || e.kind === "assistant") {
      const cat = e.kind === "user" ? "context" : "decision";
      const existing = l3[e.agentId] ?? (l3[e.agentId] = { agentId: e.agentId, notes: [], maxNotes: 200 });
      l3[e.agentId] = addNote(existing, cat, e.text);
      promoted++;
    }
  }
  // Step 2: Consolidate L3 → L4 (per agent)
  let l4 = state.l4;
  let totalFound = 0;
  for (const agentId of Object.keys(l3)) {
    const r = consolidate(l3[agentId], l4);
    l4 = r.layer4;
    totalFound += r.result.patternsFound;
  }
  return {
    ...state,
    l3ByAgent: l3,
    l4,
    lastRunAt: now,
    lastStats: { promoted, patternsFound: totalFound, durationMs: Date.now() - started },
    totalRuns: state.totalRuns + 1,
  };
}

export function shouldRunDream(state: DreamState, intervalMs: number, now: number = Date.now()): boolean {
  if (state.lastRunAt === null) return true;
  return now - state.lastRunAt >= intervalMs;
}

/** Estimate time savings (avoid re-running recently). */
export function timeSinceLastRun(state: DreamState, now: number = Date.now()): number {
  if (state.lastRunAt === null) return Infinity;
  return now - state.lastRunAt;
}

/** Master metric: dream efficiency 0-1. */
export function dreamEfficiency(state: DreamState): number {
  if (state.totalRuns === 0) return 0;
  const lastPromoted = state.lastStats?.promoted ?? 0;
  const lastPatterns = state.lastStats?.patternsFound ?? 0;
  return Math.min(1, (lastPromoted + lastPatterns) / 100);
}
