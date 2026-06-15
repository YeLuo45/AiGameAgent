// V3 PipelineRunner (Direction C 3/30, chatdev)
// Executes phases in sequence with gate validation

import { createPhaseEngine, transition, setOutput, getOutput, isComplete, nextPhase, type Phase, type PhaseState } from "./phase-engine.js";
import { checkGate, gateForPhase, type GateResult } from "./gate-condition.js";

export interface PipelineStep {
  phase: Phase;
  run: (state: PhaseState) => Promise<unknown>;
}

export interface PipelineResult {
  state: PhaseState;
  passed: boolean;
  /** Map of phase → gate result. */
  gates: Record<Phase, GateResult>;
  /** Phases that failed. */
  failedPhases: Phase[];
}

export async function runPipeline(steps: PipelineStep[]): Promise<PipelineResult> {
  let state = createPhaseEngine();
  const gates: Record<Phase, GateResult> = {} as Record<Phase, GateResult>;
  const failedPhases: Phase[] = [];
  let passed = true;
  for (const step of steps) {
    try {
      const output = await step.run(state);
      state = setOutput(state, step.phase, output);
      // Check gate
      const schema = gateForPhase(step.phase);
      if (schema) {
        const gateResult = checkGate(schema, output);
        gates[step.phase] = gateResult;
        if (!gateResult.passed) {
          failedPhases.push(step.phase);
          passed = false;
          break; // halt on first failure
        }
      }
      // Transition
      state = transition(state, step.phase, gateResultForOutcome(gates[step.phase]));
    } catch (err) {
      failedPhases.push(step.phase);
      passed = false;
      state = transition(state, step.phase, "failure");
      break;
    }
  }
  return { state, passed, gates, failedPhases };
}

function gateResultForOutcome(g: GateResult | undefined): "success" | "failure" | "skipped" {
  if (!g) return "skipped";
  return g.passed ? "success" : "failure";
}

/** Run a single phase step. */
export async function runStep(state: PhaseState, step: PipelineStep): Promise<{ state: PhaseState; gate: GateResult | null }> {
  try {
    const output = await step.run(state);
    const nextState = setOutput(state, step.phase, output);
    const schema = gateForPhase(step.phase);
    if (!schema) return { state: nextState, gate: null };
    const gate = checkGate(schema, output);
    return { state: transition(nextState, step.phase, gate.passed ? "success" : "failure"), gate };
  } catch {
    return { state: transition(state, step.phase, "failure"), gate: null };
  }
}

/** Master metric: pipeline runner success rate 0-1. */
export function runnerSuccessRate(result: PipelineResult): number {
  const total = Object.keys(result.gates).length;
  if (total === 0) return 0;
  const passed = Object.values(result.gates).filter((g) => g.passed).length;
  return passed / total;
}
