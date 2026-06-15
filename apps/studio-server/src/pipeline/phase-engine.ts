// V1 PhaseEngine (Direction C 1/30, chatdev)
// State machine for 6-phase game development pipeline

export type Phase = "ideation" | "architecture" | "design" | "production" | "polish" | "release";

export const ALL_PHASES: Phase[] = ["ideation", "architecture", "design", "production", "polish", "release"];

export interface PhaseState {
  current: Phase;
  history: Array<{ phase: Phase; ts: number; result: "success" | "failure" | "skipped" }>;
  outputs: Record<Phase, unknown>;
}

export function createPhaseEngine(start: Phase = "ideation"): PhaseState {
  return { current: start, history: [], outputs: {} as Record<Phase, unknown> };
}

const NEXT: Record<Phase, Phase | null> = {
  ideation: "architecture",
  architecture: "design",
  design: "production",
  production: "polish",
  polish: "release",
  release: null,
};

export function nextPhase(current: Phase): Phase | null {
  return NEXT[current];
}

export function prevPhase(current: Phase): Phase | null {
  const idx = ALL_PHASES.indexOf(current);
  if (idx <= 0) return null;
  return ALL_PHASES[idx - 1];
}

export function transition(state: PhaseState, to: Phase, result: "success" | "failure" | "skipped" = "success"): PhaseState {
  return { ...state, current: to, history: [...state.history, { phase: to, ts: Date.now(), result }], outputs: { ...state.outputs, [to]: state.outputs[to] } };
}

export function setOutput(state: PhaseState, phase: Phase, output: unknown): PhaseState {
  return { ...state, outputs: { ...state.outputs, [phase]: output } };
}

export function getOutput(state: PhaseState, phase: Phase): unknown {
  return state.outputs[phase];
}

export function isTerminal(phase: Phase): boolean {
  return phase === "release";
}

export function isComplete(state: PhaseState): boolean {
  return state.current === "release" && state.history.some((h) => h.phase === "release" && h.result === "success");
}

export function phaseIndex(phase: Phase): number {
  return ALL_PHASES.indexOf(phase);
}

export function progress(state: PhaseState): number {
  return (phaseIndex(state.current) + 1) / ALL_PHASES.length;
}

/** Master metric: pipeline progress 0-1. */
export function pipelineProgress(state: PhaseState): number {
  return progress(state);
}
