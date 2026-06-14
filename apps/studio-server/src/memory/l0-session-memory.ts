// V1 L0SessionMemory (Direction A 1/30, thunderbolt)
// L0 = current session in-memory raw context (per-agent, ephemeral)

export interface L0Entry {
  id: string;
  agentId: string;
  sessionId: string;
  ts: number;
  kind: "user" | "assistant" | "tool_call" | "tool_result" | "system";
  text: string;
  /** Optional structured data. */
  data?: Record<string, unknown>;
  /** Size in chars (cached for eviction). */
  size: number;
}

export interface L0SessionMemoryState {
  sessionId: string;
  entries: L0Entry[];
  maxEntries: number;
  /** Total chars across all entries. */
  totalSize: number;
  maxTotalSize: number;
}

export function createL0SessionMemory(sessionId: string, maxEntries: number = 1000, maxTotalSize: number = 1_000_000): L0SessionMemoryState {
  return { sessionId, entries: [], maxEntries, totalSize: 0, maxTotalSize };
}

export function appendL0(state: L0SessionMemoryState, entry: Omit<L0Entry, "id" | "ts" | "size">): L0SessionMemoryState {
  const id = `l0-${state.entries.length + 1}-${Date.now().toString(36)}`;
  const full: L0Entry = { ...entry, id, ts: Date.now(), size: entry.text.length };
  let entries = [...state.entries, full];
  let totalSize = state.totalSize + full.size;
  // Evict oldest if over limits
  while (entries.length > state.maxEntries || totalSize > state.maxTotalSize) {
    const dropped = entries.shift();
    if (!dropped) break;
    totalSize -= dropped.size;
  }
  return { ...state, entries, totalSize };
}

export function getRecent(state: L0SessionMemoryState, n: number = 10, agentId?: string): L0Entry[] {
  let arr = state.entries;
  if (agentId) arr = arr.filter((e) => e.agentId === agentId);
  return arr.slice(-n);
}

export function filterByKind(state: L0SessionMemoryState, kind: L0Entry["kind"]): L0Entry[] {
  return state.entries.filter((e) => e.kind === kind);
}

export function countByKind(state: L0SessionMemoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of state.entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

export function clearL0(state: L0SessionMemoryState): L0SessionMemoryState {
  return { ...state, entries: [], totalSize: 0 };
}

export function estimateContextTokens(state: L0SessionMemoryState): number {
  return Math.max(0, Math.floor(state.totalSize / 4));
}

/** Master metric: L0 utilization 0-1 (how full is the buffer). */
export function l0Utilization(state: L0SessionMemoryState): number {
  if (state.maxTotalSize === 0) return 0;
  return Math.min(1, state.totalSize / state.maxTotalSize);
}
