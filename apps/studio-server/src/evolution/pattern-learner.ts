// V12 PatternLearner (Direction D 12/30, generic-agent)
// Extract patterns from successful runs (mining frequent sequences)

export type PatternKind = "action-sequence" | "input-pattern" | "outcome-pattern" | "tool-usage";

export interface Pattern {
  id: string;
  kind: PatternKind;
  signature: string;
  occurrences: number;
  successRate: number;
  examples: string[];
}

export interface PatternLearnerState {
  patterns: Record<string, Pattern>;
  minOccurrences: number;
}

function signature(kind: PatternKind, key: string): string {
  return `${kind}::${key}`;
}

export function createPatternLearner(minOccurrences: number = 3): PatternLearnerState {
  return { patterns: {}, minOccurrences };
}

export function observe(state: PatternLearnerState, kind: PatternKind, key: string, success: boolean, example: string): PatternLearnerState {
  const sig = signature(kind, key);
  const cur = state.patterns[sig];
  if (cur) {
    const occurrences = cur.occurrences + 1;
    const successRate = (cur.successRate * cur.occurrences + (success ? 1 : 0)) / occurrences;
    const examples = cur.examples.length < 5 ? [...cur.examples, example] : cur.examples;
    return { ...state, patterns: { ...state.patterns, [sig]: { ...cur, occurrences, successRate, examples } } };
  }
  return { ...state, patterns: { ...state.patterns, [sig]: { id: sig, kind, signature: key, occurrences: 1, successRate: success ? 1 : 0, examples: [example] } } };
}

export function getPattern(state: PatternLearnerState, kind: PatternKind, key: string): Pattern | undefined {
  return state.patterns[signature(kind, key)];
}

export function listPatterns(state: PatternLearnerState, filter: { kind?: PatternKind; minSuccessRate?: number } = {}): Pattern[] {
  let arr = Object.values(state.patterns);
  if (filter.kind) arr = arr.filter((p) => p.kind === filter.kind);
  if (filter.minSuccessRate !== undefined) arr = arr.filter((p) => p.successRate >= filter.minSuccessRate!);
  return arr.sort((a, b) => b.occurrences - a.occurrences);
}

export function significantPatterns(state: PatternLearnerState): Pattern[] {
  return listPatterns(state, {}).filter((p) => p.occurrences >= state.minOccurrences);
}

export function clearPatterns(state: PatternLearnerState): PatternLearnerState {
  return { ...state, patterns: {} };
}

/** Master metric: pattern confidence 0-1 (avg success rate of significant patterns). */
export function patternConfidence(state: PatternLearnerState): number {
  const sigs = significantPatterns(state);
  if (sigs.length === 0) return 0;
  const avg = sigs.reduce((a, p) => a + p.successRate, 0) / sigs.length;
  return avg;
}
