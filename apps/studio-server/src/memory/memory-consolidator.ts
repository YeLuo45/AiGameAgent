// V8 MemoryConsolidator (Direction A 8/30, nanobot)
// Merge L3 notes into L4 patterns (find repeating themes)

import { type L3AgentMemoryState, getNotesByCategory } from "./l3-agent-memory.js";
import { type L4PatternMemoryState, recordPattern } from "./l4-pattern-memory.js";

export interface ConsolidationResult {
  patternsFound: number;
  patternsRecorded: number;
  notesConsumed: number;
  categories: string[];
}

type ThemeCategory = "preference" | "success-pattern" | "failure-pattern" | "stylistic" | "domain";

const THEME_KEYWORDS: Record<ThemeCategory, string[]> = {
  preference: ["like", "prefer", "want", "love", "favorite", "hate", "dislike"],
  "success-pattern": ["worked", "succeeded", "good", "right", "correct", "passed"],
  "failure-pattern": ["failed", "wrong", "bug", "error", "broke", "rejected"],
  stylistic: ["tone", "voice", "style", "format", "casual", "formal"],
  domain: ["game", "engine", "render", "physics", "ai", "audio"],
};

export function detectTheme(text: string): ThemeCategory | null {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(THEME_KEYWORDS) as [ThemeCategory, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return null;
}

/** Consolidate L3 notes into L4 patterns (deduplicates by category+key). */
export function consolidate(layer3: L3AgentMemoryState, layer4: L4PatternMemoryState): { layer4: L4PatternMemoryState; result: ConsolidationResult } {
  let newL4 = layer4;
  let recorded = 0;
  let consumed = 0;
  const categories = new Set<string>();
  for (const cat of ["task", "context", "decision", "snippet", "todo"] as const) {
    const notes = getNotesByCategory(layer3, cat);
    for (const note of notes) {
      const theme = detectTheme(note.content);
      if (!theme) continue;
      const key = `${cat}-${note.content.slice(0, 30).replace(/\s+/g, "-").toLowerCase()}`;
      newL4 = recordPattern(newL4, theme as "preference" | "success-pattern" | "failure-pattern" | "stylistic" | "domain", key, note.content);
      recorded++;
      consumed++;
      categories.add(theme);
    }
  }
  return {
    layer4: newL4,
    result: { patternsFound: consumed, patternsRecorded: recorded, notesConsumed: consumed, categories: Array.from(categories) },
  };
}

export function findRepeatingThemes(layer3: L3AgentMemoryState, minOccurrences: number = 2): string[] {
  const counts = new Map<string, number>();
  for (const cat of ["task", "context", "decision", "snippet", "todo"] as const) {
    for (const note of getNotesByCategory(layer3, cat)) {
      const theme = detectTheme(note.content);
      if (!theme) continue;
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).filter(([, c]) => c >= minOccurrences).map(([t]) => t);
}

/** Master metric: consolidation yield 0-1. */
export function consolidationYield(result: ConsolidationResult, available: number): number {
  if (available === 0) return 0;
  return Math.min(1, result.notesConsumed / available);
}
