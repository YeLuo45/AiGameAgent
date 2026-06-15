// V18 EvolverOrchestrator (Direction D 18/30, generic-agent)
// Master coordinator: tracker + learner + feedback + reflector + tuner

import { type PerformanceTrackerState, systemPerformance } from "./performance-tracker.js";
import { type PatternLearnerState, patternConfidence } from "./pattern-learner.js";
import { type FeedbackCollectorState, feedbackSentiment } from "./feedback-collector.js";
import { type EvolutionHistoryState, evolutionVelocity } from "./evolution-history.js";
import { type TunerState, autoTune } from "./auto-tuner.js";
import { suggestImprovements, type ImprovementSuggestion } from "./improvement-suggester.js";
import { reflectAll, type Reflection } from "./self-reflector.js";

export interface EvolverState {
  perf: PerformanceTrackerState;
  patterns: PatternLearnerState;
  feedback: FeedbackCollectorState;
  history: EvolutionHistoryState;
  tuner: TunerState;
}

export function createEvolverState(): EvolverState {
  return {
    perf: { metrics: {}, alpha: 0.3 },
    patterns: { patterns: {}, minOccurrences: 3 },
    feedback: { entries: [], nextId: 1, maxEntries: 1000 },
    history: { entries: [], nextId: 1, byKind: {} as any },
    tuner: { params: {}, targets: {} },
  };
}

export interface EvolverAnalysis {
  systemPerformance: number;
  patternConfidence: number;
  feedbackSentiment: number;
  evolutionVelocity: number;
  suggestions: ImprovementSuggestion[];
  reflections: Reflection[];
}

export function analyze(state: EvolverState): EvolverAnalysis {
  return {
    systemPerformance: systemPerformance(state.perf),
    patternConfidence: patternConfidence(state.patterns),
    feedbackSentiment: feedbackSentiment(state.feedback),
    evolutionVelocity: evolutionVelocity(state.history),
    suggestions: suggestImprovements(state.perf, state.feedback, state.patterns),
    reflections: reflectAll(state.perf, state.feedback),
  };
}

/** Run auto-tune cycle (adjust params based on current metrics). */
export function tuneCycle(state: EvolverState, metrics: Record<string, number>): EvolverState {
  return { ...state, tuner: autoTune(state.tuner, metrics) };
}

/** Decide whether to apply a suggestion (based on confidence + system state). */
export function shouldApply(state: EvolverState, suggestion: ImprovementSuggestion): boolean {
  if (suggestion.severity === "critical") return true;
  if (suggestion.confidence < 0.5) return false;
  if (systemPerformance(state.perf) < 0.5) return true; // boost when system underperforming
  return false;
}

/** Master metric: evolver health 0-1. */
export function evolverHealth(state: EvolverState): number {
  const a = analyze(state);
  return (a.systemPerformance * 0.4 + a.patternConfidence * 0.2 + a.feedbackSentiment * 0.2 + Math.min(1, a.evolutionVelocity / 5) * 0.2);
}
