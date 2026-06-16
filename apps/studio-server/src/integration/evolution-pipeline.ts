// V26 EvolutionPipeline (Direction C 26/30, orchestrator)
// Integrate pipeline + evolution (auto-evolve between phases)

import { type Phase } from "../pipeline/phase-engine.js";
import { type EvolverState, analyze, shouldApply } from "../evolution/evolver-orchestrator.js";
import { recordEvolution } from "../evolution/evolution-history.js";

export interface PhaseEvolutionConfig {
  /** Phases that should auto-trigger evolution. */
  autoEvolvePhases: Phase[];
  /** Whether to halt on evolution failure. */
  haltOnError: boolean;
}

export const DEFAULT_PHASE_EVOLUTION_CONFIG: PhaseEvolutionConfig = {
  autoEvolvePhases: ["polish", "release"],
  haltOnError: false,
};

export interface PhaseEvolutionResult {
  phase: Phase;
  suggestions: number;
  applied: number;
  rejected: number;
  errors: string[];
}

export function evolveAtPhase(state: EvolverState, phase: Phase, config: PhaseEvolutionConfig = DEFAULT_PHASE_EVOLUTION_CONFIG): { state: EvolverState; result: PhaseEvolutionResult } {
  const result: PhaseEvolutionResult = { phase, suggestions: 0, applied: 0, rejected: 0, errors: [] };
  if (!config.autoEvolvePhases.includes(phase)) {
    return { state, result };
  }
  const a = analyze(state);
  result.suggestions = a.suggestions.length;
  let next = state;
  for (const sug of a.suggestions) {
    if (shouldApply(next, sug)) {
      next = { ...next, history: recordEvolution(next.history, "improvement-applied", sug.target, "pipeline-evolver", `phase ${phase}: ${sug.message}`, sug.confidence) };
      result.applied++;
    } else {
      result.rejected++;
    }
  }
  return { state: next, result };
}

export function recordPhaseEvolution(state: EvolverState, phase: Phase, success: boolean): EvolverState {
  return { ...state, history: recordEvolution(state.history, success ? "improvement-applied" : "rollback", phase, "pipeline", success ? `phase ${phase} evolved successfully` : `phase ${phase} evolution failed`, 0.7) };
}

/** Master metric: pipeline-evolution integration rate 0-1. */
export function integrationRate(results: PhaseEvolutionResult[]): number {
  if (results.length === 0) return 0;
  const totalApplied = results.reduce((a, r) => a + r.applied, 0);
  const totalSuggestions = results.reduce((a, r) => a + r.suggestions, 0);
  if (totalSuggestions === 0) return 1.0;
  return totalApplied / totalSuggestions;
}
