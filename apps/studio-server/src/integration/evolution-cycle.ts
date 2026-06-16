// V21 EvolutionCycle (Direction D 21/30, orchestrator)
// Full evolve loop (analyze → suggest → decide → apply → verify)

import { type EvolverState, analyze, shouldApply } from "../evolution/evolver-orchestrator.js";
import { recordEvolution } from "../evolution/evolution-history.js";
import { setParam } from "../evolution/auto-tuner.js";

export interface EvolutionCycleResult {
  before: EvolverState;
  after: EvolverState;
  appliedSuggestions: number;
  rejectedSuggestions: number;
  durationMs: number;
  newEvolutionEntries: number;
}

export function runEvolutionCycle(state: EvolverState, metricValues: Record<string, number> = {}): EvolutionCycleResult {
  const started = Date.now();
  const a = analyze(state);
  let applied = 0;
  let rejected = 0;
  let nextState = state;
  for (const sug of a.suggestions) {
    if (shouldApply(nextState, sug)) {
      nextState = { ...nextState, history: recordEvolution(nextState.history, "improvement-applied", sug.target, "evolver", sug.message, sug.confidence) };
      applied++;
    } else {
      nextState = { ...nextState, history: recordEvolution(nextState.history, "improvement-applied", sug.target, "evolver", `rejected: ${sug.message}`, 0.5) };
      rejected++;
    }
  }
  // Tune cycle
  if (Object.keys(metricValues).length > 0) {
    let next = nextState;
    for (const [k, v] of Object.entries(metricValues)) {
      next = { ...next, tuner: setParam(next.tuner, k, next.tuner.params[k]?.value ?? v, 0, 1) };
    }
    nextState = next;
  }
  return {
    before: state,
    after: nextState,
    appliedSuggestions: applied,
    rejectedSuggestions: rejected,
    durationMs: Date.now() - started,
    newEvolutionEntries: nextState.history.entries.length - state.history.entries.length,
  };
}

/** Master metric: cycle efficiency 0-1. */
export function cycleEfficiency(result: EvolutionCycleResult): number {
  const total = result.appliedSuggestions + result.rejectedSuggestions;
  if (total === 0) return 1.0;
  return result.appliedSuggestions / total;
}
