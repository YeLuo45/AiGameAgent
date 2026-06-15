// V5 CrossPhaseHandoff (Direction C 5/30, chatdev)
// Document transfer between phases (preserves context)

import type { Phase } from "./phase-engine.js";

export interface HandoffDoc {
  from: Phase;
  to: Phase;
  ts: number;
  /** Free-form context payload. */
  payload: Record<string, unknown>;
  /** Summary line for quick reference. */
  summary: string;
}

export interface HandoffState {
  docs: HandoffDoc[];
  /** Latest handoff per (from, to) pair. */
  latest: Record<string, HandoffDoc>;
}

function key(from: Phase, to: Phase): string {
  return `${from}->${to}`;
}

export function createHandoffState(): HandoffState {
  return { docs: [], latest: {} };
}

export function handoff(state: HandoffState, from: Phase, to: Phase, payload: Record<string, unknown>, summary: string = ""): HandoffState {
  const doc: HandoffDoc = { from, to, ts: Date.now(), payload, summary };
  return {
    ...state,
    docs: [...state.docs, doc],
    latest: { ...state.latest, [key(from, to)]: doc },
  };
}

export function getHandoff(state: HandoffState, from: Phase, to: Phase): HandoffDoc | undefined {
  return state.latest[key(from, to)];
}

export function listHandoffs(state: HandoffState, from?: Phase): HandoffDoc[] {
  let arr = state.docs;
  if (from) arr = arr.filter((d) => d.from === from);
  return arr;
}

/** Build handoff payload for the next phase (extracts from previous outputs). */
export function buildNextHandoff<T extends Record<string, unknown>>(currentOutputs: T, nextPhase: Phase): Record<string, unknown> {
  return { ...currentOutputs, _target: nextPhase, _ts: Date.now() };
}

/** Master metric: handoff coverage 0-1 (how many phase transitions have handoffs). */
export function handoffCoverage(state: HandoffState, expectedTransitions: Array<[Phase, Phase]>): number {
  if (expectedTransitions.length === 0) return 1.0;
  let covered = 0;
  for (const [from, to] of expectedTransitions) {
    if (state.latest[key(from, to)]) covered++;
  }
  return covered / expectedTransitions.length;
}
