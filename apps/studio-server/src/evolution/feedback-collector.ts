// V13 FeedbackCollector (Direction D 13/30, generic-agent)
// Gather user + system feedback

export type FeedbackSource = "user" | "agent" | "system" | "metric";
export type FeedbackSentiment = "positive" | "negative" | "neutral";

export interface FeedbackEntry {
  id: number;
  ts: number;
  source: FeedbackSource;
  /** What the feedback is about. */
  target: string;
  sentiment: FeedbackSentiment;
  /** Score -1 to 1 (negative to positive). */
  score: number;
  comment: string;
  /** Optional metadata. */
  meta?: Record<string, unknown>;
}

export interface FeedbackCollectorState {
  entries: FeedbackEntry[];
  nextId: number;
  maxEntries: number;
}

export function createFeedbackCollector(maxEntries: number = 1000): FeedbackCollectorState {
  return { entries: [], nextId: 1, maxEntries };
}

export function recordFeedback(state: FeedbackCollectorState, source: FeedbackSource, target: string, sentiment: FeedbackSentiment, score: number, comment: string, meta?: Record<string, unknown>): FeedbackCollectorState {
  const entry: FeedbackEntry = { id: state.nextId, ts: Date.now(), source, target, sentiment, score, comment };
  if (meta) entry.meta = meta;
  const entries = [...state.entries, entry];
  if (entries.length > state.maxEntries) entries.shift();
  return { ...state, entries, nextId: state.nextId + 1 };
}

export function queryFeedback(state: FeedbackCollectorState, filter: { source?: FeedbackSource; target?: string; sentiment?: FeedbackSentiment; since?: number } = {}): FeedbackEntry[] {
  let arr = state.entries;
  if (filter.source) arr = arr.filter((e) => e.source === filter.source);
  if (filter.target) arr = arr.filter((e) => e.target === filter.target);
  if (filter.sentiment) arr = arr.filter((e) => e.sentiment === filter.sentiment);
  if (filter.since) arr = arr.filter((e) => e.ts >= filter.since!);
  return arr;
}

export function countBySentiment(state: FeedbackCollectorState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.sentiment] = (out[e.sentiment] ?? 0) + 1;
  return out;
}

export function averageScore(state: FeedbackCollectorState, target?: string): number {
  let arr = state.entries;
  if (target) arr = arr.filter((e) => e.target === target);
  if (arr.length === 0) return 0;
  return arr.reduce((a, e) => a + e.score, 0) / arr.length;
}

/** Master metric: feedback sentiment 0-1. */
export function feedbackSentiment(state: FeedbackCollectorState): number {
  if (state.entries.length === 0) return 0.5; // neutral
  const score = averageScore(state);
  return (score + 1) / 2; // map [-1, 1] to [0, 1]
}
