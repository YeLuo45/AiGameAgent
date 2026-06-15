// V10 PipelineOrchestrator (Direction C 10/30, chatdev)
// Master pipeline coordinator (integrates all phase systems)

import { createPhaseEngine, transition, setOutput, type Phase, type PhaseState, isComplete } from "./phase-engine.js";
import { checkGate, gateForPhase, type GateSchema } from "./gate-condition.js";
import { runStep, type PipelineStep } from "./pipeline-runner.js";
import { createRoleState, getAssignment, findBestMatch, type RoleState, type RoleAssignment } from "./role-specialization.js";
import { createHandoffState, handoff, type HandoffState } from "./cross-phase-handoff.js";
import { createPhaseHistory, recordEntry, type PhaseHistoryState } from "./phase-history.js";
import { buildVisualization, type PhaseVisualization } from "./phase-visualization.js";
import { linearDependencyGraph, isReady, type DependencyGraph } from "./phase-dependency.js";
import { createErrorState, recordError, shouldRetry, type ErrorState } from "./phase-error.js";

export interface OrchestratorConfig {
  maxRetries: number;
  /** If true, auto-handoff between phases. */
  autoHandoff: boolean;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = { maxRetries: 3, autoHandoff: true };

export interface PipelineOrchestrator {
  phaseState: PhaseState;
  roles: RoleState;
  handoffs: HandoffState;
  history: PhaseHistoryState;
  errors: ErrorState;
  graph: DependencyGraph;
  config: OrchestratorConfig;
  /** Per-phase step overrides. */
  steps: Record<Phase, PipelineStep | undefined>;
}

export function createPipelineOrchestrator(config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG): PipelineOrchestrator {
  return {
    phaseState: createPhaseEngine(),
    roles: createRoleState(),
    handoffs: createHandoffState(),
    history: createPhaseHistory(),
    errors: createErrorState(),
    graph: linearDependencyGraph(),
    config,
    steps: {} as Record<Phase, PipelineStep | undefined>,
  };
}

export function registerStep(orch: PipelineOrchestrator, step: PipelineStep): PipelineOrchestrator {
  return { ...orch, steps: { ...orch.steps, [step.phase]: step } };
}

/** Run a single phase (with retry if needed). */
export async function runPhase(orch: PipelineOrchestrator, phase: Phase): Promise<{ orch: PipelineOrchestrator; passed: boolean }> {
  const step = orch.steps[phase];
  if (!step) {
    const errState = recordError(orch.errors, phase, "validation", `no step registered for ${phase}`);
    return { orch: { ...orch, errors: errState }, passed: false };
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < orch.config.maxRetries; attempt++) {
    if (attempt > 0 && !shouldRetry(orch.errors, phase, orch.config.maxRetries)) {
      break;
    }
    const result = await runStep(orch.phaseState, step);
    if (result.gate && result.gate.passed) {
      const h = recordEntry(orch.history, "transition", "orchestrator", { phase }, phase);
      let newState: PipelineOrchestrator = { ...orch, phaseState: result.state, history: h };
      // Auto-handoff to next
      if (newState.config.autoHandoff) {
        const output = result.state.outputs[phase];
        newState = { ...newState, handoffs: handoff(newState.handoffs, phase, "ideation", { output }, `output of ${phase}`) };
      }
      return { orch: newState, passed: true };
    }
    lastErr = result.gate?.errors ?? "unknown";
  }
  const errState = recordError(orch.errors, phase, "validation", `phase ${phase} failed after ${orch.config.maxRetries} attempts: ${JSON.stringify(lastErr)}`, true);
  return { orch: { ...orch, errors: errState }, passed: false };
}

/** Get visualization of current state. */
export function getVisualization(orch: PipelineOrchestrator): PhaseVisualization {
  return buildVisualization(orch.phaseState);
}

/** Auto-assign agent to a phase based on capabilities. */
export function autoAssignAgent(orch: PipelineOrchestrator, phase: Phase, candidates: Array<{ id: string; capabilities: string[] }>): PipelineOrchestrator {
  const assignment = getAssignment(orch.roles, phase);
  const id = findBestMatch(assignment, candidates);
  if (!id) return orch;
  return { ...orch, roles: { ...orch.roles, assignments: { ...orch.roles.assignments, [phase]: { ...assignment, agentId: id } } } };
}

/** Master metric: orchestrator health 0-1. */
export function orchestratorHealth(orch: PipelineOrchestrator): number {
  if (isComplete(orch.phaseState)) return 1.0;
  if (orch.phaseState.current === "release" && orch.errors.errors.length > 0) return 0.3;
  if (orch.errors.errors.length === 0) return 0.7;
  return 0.5;
}
