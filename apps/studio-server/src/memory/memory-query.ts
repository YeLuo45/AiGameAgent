// V12 MemoryQuery (Direction A 12/30, ruflo)
// Fuzzy + exact match query interface

import { retrieve, type RetrievalResult } from "./memory-retriever.js";
import { type L0SessionMemoryState } from "./l0-session-memory.js";
import { type L1CharterMemoryState } from "./l1-charter-memory.js";
import { type L2ChangeHistoryState } from "./l2-change-history.js";
import { type L3AgentMemoryState } from "./l3-agent-memory.js";
import { type L4PatternMemoryState } from "./l4-pattern-memory.js";

export type QueryMode = "fuzzy" | "exact" | "regex" | "prefix";

export interface QueryOptions {
  text: string;
  mode: QueryMode;
  layers?: Array<"L0" | "L1" | "L2" | "L3" | "L4">;
  maxResults?: number;
  caseSensitive?: boolean;
  agentId?: string;
}

export interface QueryResponse {
  results: RetrievalResult[];
  mode: QueryMode;
  queryTimeMs: number;
  totalCandidates: number;
}

export function query(opts: QueryOptions, layer: {
  l0?: L0SessionMemoryState;
  l1?: L1CharterMemoryState;
  l2?: L2ChangeHistoryState;
  l3?: L3AgentMemoryState;
  l4?: L4PatternMemoryState;
}): QueryResponse {
  const started = Date.now();
  if (opts.mode === "fuzzy") {
    const r = retrieve({ text: opts.text, layers: opts.layers, maxResults: opts.maxResults, agentId: opts.agentId }, layer);
    return { results: r, mode: opts.mode, queryTimeMs: Date.now() - started, totalCandidates: r.length };
  }
  // exact / prefix: simple contains check
  const caseSensitive = opts.caseSensitive ?? false;
  const q = caseSensitive ? opts.text : opts.text.toLowerCase();
  const all: RetrievalResult[] = [];
  if ((!opts.layers || opts.layers.includes("L0")) && layer.l0) {
    for (const e of layer.l0.entries) {
      if (opts.agentId && e.agentId !== opts.agentId) continue;
      const text = caseSensitive ? e.text : e.text.toLowerCase();
      const matches = opts.mode === "regex" ? new RegExp(opts.text).test(e.text) :
        opts.mode === "prefix" ? text.startsWith(q) : text === q;
      if (matches) all.push({ layer: "L0", id: e.id, text: e.text, score: 1, meta: { kind: e.kind, agentId: e.agentId } });
    }
  }
  if ((!opts.layers || opts.layers.includes("L1")) && layer.l1) {
    const charters = layer.l1.snapshots;
    for (const c of charters) {
      const text = caseSensitive ? c.goal : c.goal.toLowerCase();
      if (text.includes(q) || q.includes("version")) {
        all.push({ layer: "L1", id: c.id, text: `${c.goal}`, score: 1, meta: { version: c.version } });
      }
    }
  }
  if ((!opts.layers || opts.layers.includes("L3")) && layer.l3) {
    for (const n of layer.l3.notes) {
      const text = caseSensitive ? n.content : n.content.toLowerCase();
      const matches = opts.mode === "regex" ? new RegExp(opts.text).test(n.content) :
        opts.mode === "prefix" ? text.startsWith(q) : text.includes(q);
      if (matches) all.push({ layer: "L3", id: n.id, text: n.content, score: 1, meta: { category: n.category } });
    }
  }
  if ((!opts.layers || opts.layers.includes("L4")) && layer.l4) {
    for (const p of Object.values(layer.l4.patterns)) {
      const text = caseSensitive ? `${p.key} ${p.value}` : `${p.key} ${p.value}`.toLowerCase();
      const matches = opts.mode === "regex" ? new RegExp(opts.text).test(p.value) :
        opts.mode === "prefix" ? text.startsWith(q) : text.includes(q);
      if (matches) all.push({ layer: "L4", id: p.id, text: `${p.key}: ${p.value}`, score: 1, meta: { category: p.category } });
    }
  }
  // For exact mode without matches, return empty
  const total = all.length;
  return { results: all.slice(0, opts.maxResults ?? total), mode: opts.mode, queryTimeMs: Date.now() - started, totalCandidates: total };
}

/** Master metric: query precision 0-1 (relevant results / total). */
export function queryPrecision(response: QueryResponse, minScore: number = 0.5): number {
  if (response.results.length === 0) return 0;
  const relevant = response.results.filter((r) => r.score >= minScore).length;
  return relevant / response.results.length;
}
