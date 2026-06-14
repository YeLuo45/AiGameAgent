// V9 MemoryRetriever (Direction A 9/30, nanobot)
// Search across L0-L4 by relevance

import { type L0SessionMemoryState, filterByKind as l0Filter, getRecent as l0Recent } from "./l0-session-memory.js";
import { type L1CharterMemoryState, getCurrentCharter as l1Current } from "./l1-charter-memory.js";
import { type L2ChangeHistoryState, queryChanges as l2Query } from "./l2-change-history.js";
import { type L3AgentMemoryState, getNotesByCategory as l3Filter } from "./l3-agent-memory.js";
import { type L4PatternMemoryState, getByCategory as l4ByCategory } from "./l4-pattern-memory.js";

export interface RetrievalQuery {
  text: string;
  layers?: ("L0" | "L1" | "L2" | "L3" | "L4")[];
  agentId?: string;
  maxResults?: number;
  minScore?: number;
}

export interface RetrievalResult {
  layer: "L0" | "L1" | "L2" | "L3" | "L4";
  id: string;
  text: string;
  score: number;
  meta?: Record<string, unknown>;
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
}

function score(queryTokens: Set<string>, candidate: string): number {
  if (queryTokens.size === 0) return 0;
  const candTokens = tokenize(candidate);
  if (candTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of candTokens) if (queryTokens.has(t)) overlap++;
  return overlap / Math.sqrt(queryTokens.size * candTokens.size);
}

export function retrieve(q: RetrievalQuery, layer: {
  l0?: L0SessionMemoryState;
  l1?: L1CharterMemoryState;
  l2?: L2ChangeHistoryState;
  l3?: L3AgentMemoryState;
  l4?: L4PatternMemoryState;
}): RetrievalResult[] {
  const queryTokens = tokenize(q.text);
  const max = q.maxResults ?? 10;
  const minScore = q.minScore ?? 0;
  const results: RetrievalResult[] = [];
  // L0
  if ((!q.layers || q.layers.includes("L0")) && layer.l0) {
    const entries = q.agentId ? l0Recent(layer.l0, layer.l0.entries.length, q.agentId) : l0Recent(layer.l0, layer.l0.entries.length);
    for (const e of entries) {
      const s = score(queryTokens, e.text);
      if (s >= minScore) results.push({ layer: "L0", id: e.id, text: e.text, score: s, meta: { kind: e.kind, agentId: e.agentId } });
    }
  }
  // L1
  if ((!q.layers || q.layers.includes("L1")) && layer.l1) {
    const c = l1Current(layer.l1);
    if (c) {
      const text = `${c.goal} ${c.milestones.join(" ")} ${c.nodes.join(" ")}`;
      const s = score(queryTokens, text);
      if (s >= minScore) results.push({ layer: "L1", id: c.id, text, score: s, meta: { version: c.version } });
    }
  }
  // L2
  if ((!q.layers || q.layers.includes("L2")) && layer.l2) {
    const records = l2Query(layer.l2);
    for (const r of records) {
      const text = `${r.kind} ${r.affected.join(" ")} ${r.comment ?? ""}`;
      const s = score(queryTokens, text);
      if (s >= minScore) results.push({ layer: "L2", id: String(r.id), text, score: s, meta: { kind: r.kind, from: r.fromVersion, to: r.toVersion } });
    }
  }
  // L3
  if ((!q.layers || q.layers.includes("L3")) && layer.l3) {
    for (const cat of ["task", "context", "todo", "decision", "snippet"] as const) {
      const notes = l3Filter(layer.l3, cat);
      for (const n of notes) {
        const s = score(queryTokens, n.content);
        if (s >= minScore) results.push({ layer: "L3", id: n.id, text: n.content, score: s, meta: { category: n.category, agentId: layer.l3.agentId } });
      }
    }
  }
  // L4
  if ((!q.layers || q.layers.includes("L4")) && layer.l4) {
    for (const cat of ["preference", "success-pattern", "failure-pattern", "stylistic", "domain"] as const) {
      const ps = l4ByCategory(layer.l4, cat);
      for (const p of ps) {
        const text = `${p.key} ${p.value}`;
        const s = score(queryTokens, text) * p.confidence;
        if (s >= minScore) results.push({ layer: "L4", id: p.id, text, score: s, meta: { category: p.category, confidence: p.confidence } });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, max);
}

/** Master metric: retrieval recall 0-1. */
export function retrievalRecall(results: RetrievalResult[], expectedMinResults: number): number {
  if (expectedMinResults === 0) return 1.0;
  return Math.min(1, results.length / expectedMinResults);
}
