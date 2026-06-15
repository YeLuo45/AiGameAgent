// V4 RoleSpecialization (Direction C 4/30, chatdev)
// Per-phase role assignments (which agent role handles which phase)

import type { Phase } from "./phase-engine.js";

export type Role = "producer" | "architect" | "designer" | "engineer" | "qa" | "release-manager" | "creative";

export interface RoleAssignment {
  phase: Phase;
  role: Role;
  /** Optional agent ID override. */
  agentId?: string;
  /** Required capabilities. */
  capabilities: string[];
}

const DEFAULT_ASSIGNMENTS: Record<Phase, RoleAssignment> = {
  ideation: { phase: "ideation", role: "producer", capabilities: ["game-design", "pitch", "ideation"] },
  architecture: { phase: "architecture", role: "architect", capabilities: ["tech-decision", "engine-selection"] },
  design: { phase: "design", role: "designer", capabilities: ["system-design", "level-design", "ui-ux"] },
  production: { phase: "production", role: "engineer", capabilities: ["programming", "art-pipeline", "audio"] },
  polish: { phase: "polish", role: "qa", capabilities: ["testing", "profiling", "accessibility"] },
  release: { phase: "release", role: "release-manager", capabilities: ["packaging", "deployment", "localization"] },
};

export function defaultAssignmentFor(phase: Phase): RoleAssignment {
  return { ...DEFAULT_ASSIGNMENTS[phase] };
}

export function allDefaultAssignments(): RoleAssignment[] {
  return Object.values(DEFAULT_ASSIGNMENTS).map((a) => ({ ...a }));
}

export interface RoleState {
  /** Phase → assigned agent ID. */
  assignments: Record<Phase, RoleAssignment>;
}

export function createRoleState(): RoleState {
  const assignments: Record<Phase, RoleAssignment> = {} as Record<Phase, RoleAssignment>;
  for (const phase of Object.keys(DEFAULT_ASSIGNMENTS) as Phase[]) {
    assignments[phase] = { ...DEFAULT_ASSIGNMENTS[phase] };
  }
  return { assignments };
}

export function setAssignment(state: RoleState, phase: Phase, assignment: Partial<RoleAssignment>): RoleState {
  return { ...state, assignments: { ...state.assignments, [phase]: { ...state.assignments[phase], ...assignment } } };
}

export function getAssignment(state: RoleState, phase: Phase): RoleAssignment {
  return state.assignments[phase];
}

/** Check if a given agent has the required capabilities. */
export function agentMatches(assignment: RoleAssignment, agentCapabilities: string[]): boolean {
  return assignment.capabilities.every((c) => agentCapabilities.includes(c));
}

/** Find best-matching agent for a phase (by capability overlap). */
export function findBestMatch(assignment: RoleAssignment, candidates: Array<{ id: string; capabilities: string[] }>): string | null {
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const overlap = assignment.capabilities.filter((cap) => c.capabilities.includes(cap)).length;
    if (overlap === 0) continue;
    if (!best || overlap > best.score) best = { id: c.id, score: overlap };
  }
  return best?.id ?? null;
}

/** Master metric: role coverage 0-1. */
export function roleCoverage(state: RoleState, availableAgents: Array<{ id: string; capabilities: string[] }>): number {
  const phases = Object.keys(state.assignments) as Phase[];
  if (phases.length === 0) return 1.0;
  let covered = 0;
  for (const p of phases) {
    if (findBestMatch(state.assignments[p], availableAgents)) covered++;
  }
  return covered / phases.length;
}
