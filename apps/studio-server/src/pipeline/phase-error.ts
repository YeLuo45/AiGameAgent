// V9 PhaseError (Direction C 9/30, chatdev)
// Phase failure handling + retry strategies

import type { Phase } from "./phase-engine.js";

export type ErrorKind = "validation" | "execution" | "timeout" | "dependency" | "resource";

export interface PhaseError {
  id: number;
  ts: number;
  phase: Phase;
  kind: ErrorKind;
  message: string;
  /** Stack or detailed context. */
  context?: string;
  /** Whether this error is recoverable. */
  recoverable: boolean;
}

export interface ErrorState {
  errors: PhaseError[];
  nextId: number;
  /** Errors per phase. */
  byPhase: Record<Phase, PhaseError[]>;
}

export function createErrorState(): ErrorState {
  return { errors: [], nextId: 1, byPhase: {} as Record<Phase, PhaseError[]> };
}

export function recordError(state: ErrorState, phase: Phase, kind: ErrorKind, message: string, recoverable: boolean = true, context?: string): ErrorState {
  const err: PhaseError = { id: state.nextId, ts: Date.now(), phase, kind, message, recoverable };
  if (context) err.context = context;
  const byPhase = { ...state.byPhase, [phase]: [...(state.byPhase[phase] ?? []), err] };
  return { ...state, errors: [...state.errors, err], nextId: state.nextId + 1, byPhase };
}

export function errorsFor(state: ErrorState, phase: Phase): PhaseError[] {
  return state.byPhase[phase] ?? [];
}

export function hasErrors(state: ErrorState, phase: Phase): boolean {
  return errorsFor(state, phase).length > 0;
}

export function clearErrors(state: ErrorState, phase: Phase): ErrorState {
  const { [phase]: _, ...rest } = state.byPhase;
  return { ...state, errors: state.errors.filter((e) => e.phase !== phase), byPhase: rest };
}

export function countByKind(state: ErrorState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.errors) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

export function recoverableErrors(state: ErrorState): PhaseError[] {
  return state.errors.filter((e) => e.recoverable);
}

/** Decide if a phase should retry based on error history. */
export function shouldRetry(state: ErrorState, phase: Phase, maxRetries: number = 3): boolean {
  const errs = errorsFor(state, phase);
  if (errs.length >= maxRetries) return false;
  if (errs.length === 0) return true;
  // Retry only if last error is recoverable
  return errs[errs.length - 1].recoverable;
}

/** Master metric: error recovery rate 0-1. */
export function errorRecoveryRate(state: ErrorState): number {
  if (state.errors.length === 0) return 1.0;
  const rec = state.errors.filter((e) => e.recoverable).length;
  return rec / state.errors.length;
}
