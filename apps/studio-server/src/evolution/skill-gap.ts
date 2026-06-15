// V20 SkillGap (Direction D 20/30, generic-agent)
// Identify missing skills per task type

export type TaskKind = "text" | "code" | "summary" | "tools" | "creative";

export interface SkillRequirement {
  taskKind: TaskKind;
  /** Required skills for this task. */
  required: string[];
}

export const DEFAULT_REQUIREMENTS: Record<TaskKind, string[]> = {
  text: ["writing", "language"],
  code: ["programming", "debugging", "testing"],
  summary: ["reading", "writing", "condensing"],
  tools: ["tool-use", "orchestration"],
  creative: ["writing", "ideation", "style"],
};

export interface SkillGapEntry {
  taskKind: TaskKind;
  missing: string[];
  /** Coverage 0-1 (matched / required). */
  coverage: number;
}

export function identifyGap(agentSkills: string[], taskKind: TaskKind): SkillGapEntry {
  const required = DEFAULT_REQUIREMENTS[taskKind];
  const missing = required.filter((s) => !agentSkills.includes(s));
  const coverage = required.length === 0 ? 1 : (required.length - missing.length) / required.length;
  return { taskKind, missing, coverage };
}

export function identifyAllGaps(agentSkills: string[]): SkillGapEntry[] {
  return (Object.keys(DEFAULT_REQUIREMENTS) as TaskKind[]).map((k) => identifyGap(agentSkills, k));
}

export function criticalGaps(gaps: SkillGapEntry[], maxCoverage: number = 0.5): SkillGapEntry[] {
  return gaps.filter((g) => g.coverage < maxCoverage);
}

export function suggestTraining(gap: SkillGapEntry): string[] {
  return gap.missing.map((s) => `Train skill: ${s}`);
}

/** Master metric: agent skill coverage 0-1 (avg across all task kinds). */
export function agentSkillCoverage(agentSkills: string[]): number {
  const gaps = identifyAllGaps(agentSkills);
  if (gaps.length === 0) return 1.0;
  return gaps.reduce((a, g) => a + g.coverage, 0) / gaps.length;
}
