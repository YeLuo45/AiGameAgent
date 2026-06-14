// V4 L3AgentWorkingMemory (Direction A 4/30, thunderbolt)
// L3 = per-agent working memory (task context, in-flight notes)

export interface L3WorkingNote {
  id: string;
  ts: number;
  category: "task" | "context" | "todo" | "decision" | "snippet";
  content: string;
  /** Optional expiration. */
  expiresAt?: number;
}

export interface L3AgentMemoryState {
  agentId: string;
  notes: L3WorkingNote[];
  maxNotes: number;
}

export function createL3AgentMemory(agentId: string, maxNotes: number = 200): L3AgentMemoryState {
  return { agentId, notes: [], maxNotes };
}

export function addNote(state: L3AgentMemoryState, category: L3WorkingNote["category"], content: string, ttlMs?: number): L3AgentMemoryState {
  const id = `l3-${state.notes.length + 1}-${Date.now().toString(36)}`;
  const note: L3WorkingNote = { id, ts: Date.now(), category, content };
  if (ttlMs) note.expiresAt = Date.now() + ttlMs;
  let notes = [...state.notes, note];
  if (notes.length > state.maxNotes) notes = notes.slice(-state.maxNotes);
  return { ...state, notes };
}

export function getNotesByCategory(state: L3AgentMemoryState, category: L3WorkingNote["category"]): L3WorkingNote[] {
  return state.notes.filter((n) => n.category === category);
}

export function getOpenTodos(state: L3AgentMemoryState): L3WorkingNote[] {
  return state.notes.filter((n) => n.category === "todo" && !isComplete(n.content));
}

function isComplete(content: string): boolean {
  return content.startsWith("[done]") || content.startsWith("[x]");
}

export function markTodoDone(state: L3AgentMemoryState, id: string): L3AgentMemoryState {
  return { ...state, notes: state.notes.map((n) => n.id === id && n.category === "todo" ? { ...n, content: `[done] ${n.content}` } : n) };
}

export function pruneExpired(state: L3AgentMemoryState, now: number = Date.now()): L3AgentMemoryState {
  return { ...state, notes: state.notes.filter((n) => !n.expiresAt || n.expiresAt > now) };
}

export function clearCategory(state: L3AgentMemoryState, category: L3WorkingNote["category"]): L3AgentMemoryState {
  return { ...state, notes: state.notes.filter((n) => n.category !== category) };
}

export function countByCategory(state: L3AgentMemoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of state.notes) out[n.category] = (out[n.category] ?? 0) + 1;
  return out;
}

/** Master metric: working memory load 0-1. */
export function workingMemoryLoad(state: L3AgentMemoryState): number {
  if (state.maxNotes === 0) return 0;
  return Math.min(1, state.notes.length / state.maxNotes);
}
