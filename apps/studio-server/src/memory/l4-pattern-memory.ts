// V5 L4PatternMemory (Direction A 5/30, thunderbolt)
// L4 = cross-session pattern memory (player prefs, success patterns)

export interface Pattern {
  id: string;
  ts: number;
  category: "preference" | "success-pattern" | "failure-pattern" | "stylistic" | "domain";
  key: string;
  value: string;
  /** Confidence 0-1. */
  confidence: number;
  /** How many times this pattern was observed. */
  observations: number;
}

export interface L4PatternMemoryState {
  patterns: Record<string, Pattern>; // key = `${category}::${key}`
  maxPatterns: number;
  /** Decay rate for old patterns when not observed. */
  decayPerDay: number;
}

export function createL4PatternMemory(maxPatterns: number = 1000, decayPerDay: number = 0.05): L4PatternMemoryState {
  return { patterns: {}, maxPatterns, decayPerDay };
}

function k(category: Pattern["category"], key: string): string {
  return `${category}::${key}`;
}

export function recordPattern(
  state: L4PatternMemoryState,
  category: Pattern["category"],
  key: string,
  value: string,
  now: number = Date.now(),
): L4PatternMemoryState {
  const keyId = k(category, key);
  const existing = state.patterns[keyId];
  if (existing) {
    // Update with reinforcement
    const updated: Pattern = {
      ...existing,
      value, // latest value
      ts: now,
      confidence: Math.min(1, existing.confidence + 0.1),
      observations: existing.observations + 1,
    };
    return { ...state, patterns: { ...state.patterns, [keyId]: updated } };
  }
  // New pattern
  const p: Pattern = { id: keyId, ts: now, category, key, value, confidence: 0.5, observations: 1 };
  let patterns = { ...state.patterns, [keyId]: p };
  // Evict if over max
  const ids = Object.keys(patterns);
  if (ids.length > state.maxPatterns) {
    const sorted = ids.map((id) => patterns[id]).sort((a, b) => a.confidence - b.confidence);
    const toEvict = sorted.slice(0, ids.length - state.maxPatterns).map((p) => p.id);
    for (const id of toEvict) delete patterns[id];
  }
  return { ...state, patterns };
}

export function getPattern(state: L4PatternMemoryState, category: Pattern["category"], key: string): Pattern | undefined {
  return state.patterns[k(category, key)];
}

export function getByCategory(state: L4PatternMemoryState, category: Pattern["category"]): Pattern[] {
  return Object.values(state.patterns).filter((p) => p.category === category).sort((a, b) => b.confidence - a.confidence);
}

export function decayOldPatterns(state: L4PatternMemoryState, now: number = Date.now()): L4PatternMemoryState {
  const patterns: Record<string, Pattern> = {};
  for (const [id, p] of Object.entries(state.patterns)) {
    const daysSince = (now - p.ts) / 86_400_000;
    const newConf = Math.max(0, p.confidence - daysSince * state.decayPerDay);
    if (newConf > 0.05) {
      patterns[id] = { ...p, confidence: newConf };
    }
  }
  return { ...state, patterns };
}

export function deletePattern(state: L4PatternMemoryState, category: Pattern["category"], key: string): L4PatternMemoryState {
  const keyId = k(category, key);
  const { [keyId]: _, ...rest } = state.patterns;
  return { ...state, patterns: rest };
}

export function distinctCategories(state: L4PatternMemoryState): string[] {
  return Array.from(new Set(Object.values(state.patterns).map((p) => p.category))).sort();
}

/** Master metric: pattern knowledge depth 0-1. */
export function patternKnowledge(state: L4PatternMemoryState): number {
  const ps = Object.values(state.patterns);
  if (ps.length === 0) return 0;
  const avgConfidence = ps.reduce((acc, p) => acc + p.confidence, 0) / ps.length;
  const catCount = new Set(ps.map((p) => p.category)).size;
  return Math.min(1, avgConfidence * 0.7 + Math.min(0.3, catCount * 0.1));
}
