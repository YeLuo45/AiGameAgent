// V27 ToolCache (Direction B 27/30, generic-agent)
// Memoize tool results (LRU + TTL)

export interface CacheEntry {
  key: string;
  value: unknown;
  ts: number;
  expiresAt: number | null;
  hits: number;
}

export interface ToolCacheState {
  entries: Map<string, CacheEntry>;
  maxEntries: number;
  defaultTtlMs: number;
  totalHits: number;
  totalMisses: number;
}

export function createToolCache(maxEntries: number = 100, defaultTtlMs: number = 60_000): ToolCacheState {
  return { entries: new Map(), maxEntries, defaultTtlMs, totalHits: 0, totalMisses: 0 };
}

export function get(state: ToolCacheState, key: string, now: number = Date.now()): { value: unknown; hit: boolean } {
  const entry = state.entries.get(key);
  if (!entry) {
    state.totalMisses++;
    return { value: undefined, hit: false };
  }
  if (entry.expiresAt && entry.expiresAt < now) {
    state.entries.delete(key);
    state.totalMisses++;
    return { value: undefined, hit: false };
  }
  entry.hits++;
  state.totalHits++;
  return { value: entry.value, hit: true };
}

export function set(state: ToolCacheState, key: string, value: unknown, ttlMs?: number, now: number = Date.now()): ToolCacheState {
  const expiresAt = (ttlMs ?? state.defaultTtlMs) > 0 ? now + (ttlMs ?? state.defaultTtlMs) : null;
  const entry: CacheEntry = { key, value, ts: now, expiresAt, hits: 0 };
  state.entries.set(key, entry);
  // Evict oldest if over max
  if (state.entries.size > state.maxEntries) {
    const oldestKey = state.entries.keys().next().value;
    if (oldestKey !== undefined) state.entries.delete(oldestKey);
  }
  return state;
}

export function invalidate(state: ToolCacheState, key: string): ToolCacheState {
  state.entries.delete(key);
  return state;
}

export function clearCache(state: ToolCacheState): ToolCacheState {
  state.entries.clear();
  return state;
}

export function cacheStats(state: ToolCacheState): { size: number; hitRate: number; maxEntries: number } {
  const total = state.totalHits + state.totalMisses;
  const hitRate = total === 0 ? 0 : state.totalHits / total;
  return { size: state.entries.size, hitRate, maxEntries: state.maxEntries };
}

/** Master metric: cache effectiveness 0-1. */
export function cacheEffectiveness(state: ToolCacheState): number {
  return cacheStats(state).hitRate;
}
