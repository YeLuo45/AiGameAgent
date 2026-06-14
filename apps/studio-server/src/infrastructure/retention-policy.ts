// V20 RetentionPolicy (Direction E 20/30, ruflo)
// Rules for compacting/evicting old events

export type RetentionRule = "keep-all" | "evict-old" | "compact-summary" | "archive-then-evict";

export interface RetentionConfig {
  rule: RetentionRule;
  /** Max age in ms (for evict-old / archive-then-evict). */
  maxAgeMs?: number;
  /** Max count (for evict-old). */
  maxCount?: number;
  /** Compaction threshold: compact when count exceeds this. */
  compactThreshold?: number;
  /** Compaction target: keep at most this many after compact. */
  compactTarget?: number;
}

export interface RetentionDecision {
  /** Which events to evict (ids). */
  evictIds: number[];
  /** Summary of compacted events (if compact-summary rule). */
  compactedSummary: string | null;
  /** How many events were archived. */
  archivedCount: number;
  /** Total remaining after policy applied. */
  remaining: number;
}

export function planRetention<T extends { id: number; ts?: string | number }>(
  items: T[],
  now: number,
  config: RetentionConfig,
): RetentionDecision {
  if (config.rule === "keep-all") {
    return { evictIds: [], compactedSummary: null, archivedCount: 0, remaining: items.length };
  }
  if (config.rule === "evict-old") {
    const maxAge = config.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    const maxCount = config.maxCount ?? 10_000;
    const evict: number[] = [];
    for (const it of items) {
      const ts = typeof it.ts === "string" ? Date.parse(it.ts) : (it.ts ?? 0);
      if (now - ts > maxAge) evict.push(it.id);
    }
    // Also evict if over maxCount (oldest first)
    if (items.length - evict.length > maxCount) {
      const sorted = [...items].sort((a, b) => (typeof a.ts === "string" ? Date.parse(a.ts) : (a.ts ?? 0)) - (typeof b.ts === "string" ? Date.parse(b.ts) : (b.ts ?? 0)));
      let toEvict = items.length - evict.length - maxCount;
      for (const it of sorted) {
        if (toEvict <= 0) break;
        if (!evict.includes(it.id)) {
          evict.push(it.id);
          toEvict--;
        }
      }
    }
    return { evictIds: evict, compactedSummary: null, archivedCount: evict.length, remaining: items.length - evict.length };
  }
  if (config.rule === "compact-summary") {
    const threshold = config.compactThreshold ?? 5000;
    const target = config.compactTarget ?? 1000;
    if (items.length <= threshold) {
      return { evictIds: [], compactedSummary: null, archivedCount: 0, remaining: items.length };
    }
    const sorted = [...items].sort((a, b) => a.id - b.id);
    const toCompact = sorted.slice(0, items.length - target);
    const summary = `Compacted ${toCompact.length} events (ids ${toCompact[0]?.id}..${toCompact[toCompact.length - 1]?.id})`;
    return { evictIds: toCompact.map((x) => x.id), compactedSummary: summary, archivedCount: toCompact.length, remaining: target };
  }
  if (config.rule === "archive-then-evict") {
    const maxAge = config.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
    const evict: number[] = [];
    for (const it of items) {
      const ts = typeof it.ts === "string" ? Date.parse(it.ts) : (it.ts ?? 0);
      if (now - ts > maxAge) evict.push(it.id);
    }
    return { evictIds: evict, compactedSummary: null, archivedCount: evict.length, remaining: items.length - evict.length };
  }
  return { evictIds: [], compactedSummary: null, archivedCount: 0, remaining: items.length };
}

/** Apply a retention decision to a list, returning the new list. */
export function applyRetention<T extends { id: number }>(items: T[], decision: RetentionDecision): T[] {
  const evictSet = new Set(decision.evictIds);
  return items.filter((it) => !evictSet.has(it.id));
}

/** Master metric: retention efficiency 0-1 (0 = evicting too much, 1 = good balance). */
export function retentionEfficiency(decision: RetentionDecision, originalCount: number): number {
  if (originalCount === 0) return 1.0;
  if (decision.remaining === 0 && originalCount > 0) return 0.3; // evicted everything
  const retentionRatio = decision.remaining / originalCount;
  if (retentionRatio < 0.1) return 0.3;
  if (retentionRatio > 0.95) return 0.9;
  return 0.7 + retentionRatio * 0.2;
}
