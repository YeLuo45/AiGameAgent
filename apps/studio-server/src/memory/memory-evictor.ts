// V10 MemoryEvictor (Direction A 10/30, nanobot)
// TTL + LRU eviction policies per layer

export type EvictionPolicy = "ttl" | "lru" | "ttl-lru" | "fifo" | "none";

export interface EvictableEntry {
  id: string;
  ts: number;
  lastAccessedAt: number;
  size: number;
  /** Optional TTL. */
  ttlMs?: number;
  accessCount: number;
}

export interface EvictionResult {
  evictedIds: string[];
  remaining: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  reason: "ttl" | "lru" | "ttl-lru" | "fifo" | "size" | "policy-none";
}

export function evictByPolicy(entries: EvictableEntry[], policy: EvictionPolicy, options: { maxSize?: number; maxCount?: number; now?: number } = {}): EvictionResult {
  const now = options.now ?? Date.now();
  const totalBefore = entries.reduce((a, e) => a + e.size, 0);
  if (policy === "none") {
    return { evictedIds: [], remaining: entries.length, totalSizeBefore: totalBefore, totalSizeAfter: totalBefore, reason: "policy-none" };
  }
  let arr = [...entries];
  const evicted = new Set<string>();
  const reasons = new Set<EvictionResult["reason"]>();
  // Step 1: TTL eviction
  if (policy === "ttl" || policy === "ttl-lru") {
    for (const e of arr) {
      if (e.ttlMs && now - e.ts > e.ttlMs) {
        evicted.add(e.id);
        reasons.add("ttl");
      }
    }
  }
  arr = arr.filter((e) => !evicted.has(e.id));
  // Step 2: LRU by lastAccessedAt
  if (policy === "lru" || policy === "ttl-lru") {
    const maxCount = options.maxCount ?? arr.length;
    if (arr.length > maxCount) {
      const sorted = arr.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const toEvict = sorted.slice(0, arr.length - maxCount);
      for (const e of toEvict) {
        evicted.add(e.id);
        reasons.add("lru");
      }
    }
    arr = arr.filter((e) => !evicted.has(e.id));
  }
  // Step 3: FIFO by ts
  if (policy === "fifo") {
    const maxCount = options.maxCount ?? arr.length;
    if (arr.length > maxCount) {
      const sorted = arr.sort((a, b) => a.ts - b.ts);
      const toEvict = sorted.slice(0, arr.length - maxCount);
      for (const e of toEvict) {
        evicted.add(e.id);
        reasons.add("fifo");
      }
    }
    arr = arr.filter((e) => !evicted.has(e.id));
  }
  // Step 4: size cap
  if (options.maxSize !== undefined) {
    let total = arr.reduce((a, e) => a + e.size, 0);
    while (total > options.maxSize && arr.length > 0) {
      const sorted = arr.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const drop = sorted[0];
      evicted.add(drop.id);
      arr = arr.filter((e) => e.id !== drop.id);
      total -= drop.size;
      reasons.add("size");
    }
  }
  const totalAfter = arr.reduce((a, e) => a + e.size, 0);
  const reason: EvictionResult["reason"] = reasons.has("ttl-lru") ? "ttl-lru" : Array.from(reasons)[0] ?? "policy-none";
  return { evictedIds: Array.from(evicted), remaining: arr.length, totalSizeBefore: totalBefore, totalSizeAfter: totalAfter, reason };
}

/** Mark entry as accessed (update lastAccessedAt + accessCount). */
export function touchEntry(entry: EvictableEntry, now: number = Date.now()): EvictableEntry {
  return { ...entry, lastAccessedAt: now, accessCount: entry.accessCount + 1 };
}

/** Master metric: eviction efficiency 0-1 (1 = no waste, lower = more eviction). */
export function evictionEfficiency(result: EvictionResult): number {
  if (result.totalSizeBefore === 0) return 1.0;
  return result.totalSizeAfter / result.totalSizeBefore;
}
