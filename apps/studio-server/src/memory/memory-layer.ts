// V6 MemoryLayer (Direction A 6/30, nanobot)
// Unified facade over L0-L4

import { type L0SessionMemoryState, createL0SessionMemory, appendL0 as l0Append, getRecent as l0Recent } from "./l0-session-memory.js";
import { type L1CharterMemoryState, createL1CharterMemory, getCurrentCharter as l1Current, addCharterSnapshot as l1Add } from "./l1-charter-memory.js";
import { type L2ChangeHistoryState, createL2ChangeHistory, appendChange as l2Append, latestChange as l2Latest } from "./l2-change-history.js";
import { type L3AgentMemoryState, createL3AgentMemory, addNote as l3Add, getOpenTodos as l3Todos } from "./l3-agent-memory.js";
import { type L4PatternMemoryState, createL4PatternMemory, recordPattern as l4Record, getPattern as l4Get } from "./l4-pattern-memory.js";

export interface MemoryLayer {
  l0: L0SessionMemoryState;
  l1: L1CharterMemoryState;
  l2: L2ChangeHistoryState;
  l3: Record<string, L3AgentMemoryState>; // agentId -> state
  l4: L4PatternMemoryState;
}

export function createMemoryLayer(): MemoryLayer {
  return {
    l0: createL0SessionMemory(`sess-${Date.now().toString(36)}`),
    l1: createL1CharterMemory(),
    l2: createL2ChangeHistory(),
    l3: {},
    l4: createL4PatternMemory(),
  };
}

export function ensureL3(layer: MemoryLayer, agentId: string): L3AgentMemoryState {
  if (layer.l3[agentId]) return layer.l3[agentId];
  const s = createL3AgentMemory(agentId);
  layer.l3[agentId] = s;
  return s;
}

export function appendL0Entry(layer: MemoryLayer, agentId: string, kind: "user" | "assistant" | "tool_call" | "tool_result" | "system", text: string): MemoryLayer {
  return { ...layer, l0: l0Append(layer.l0, { agentId, sessionId: layer.l0.sessionId, kind, text }) };
}

export function getL0Recent(layer: MemoryLayer, n: number = 10, agentId?: string): L0SessionMemoryState["entries"] {
  return l0Recent(layer.l0, n, agentId);
}

export function addCharterSnapshot(layer: MemoryLayer, goal: string, milestones: string[], nodes: string[], reason: "initial" | "approval" | "change-meeting" | "rollback", createdBy: string): MemoryLayer {
  const nextVersion = (l1Current(layer.l1)?.version ?? 0) + 1;
  return { ...layer, l1: l1Add(layer.l1, { version: nextVersion, goal, milestones, nodes, reason, createdBy }) };
}

export function recordChange(layer: MemoryLayer, kind: "goal_changed" | "milestones_changed" | "nodes_changed" | "rollback" | "comment", fromVersion: number | null, toVersion: number | null, affected: string[], comment?: string): MemoryLayer {
  return { ...layer, l2: l2Append(layer.l2, kind, fromVersion, toVersion, affected, comment) };
}

export function addAgentNote(layer: MemoryLayer, agentId: string, category: "task" | "context" | "todo" | "decision" | "snippet", content: string, ttlMs?: number): MemoryLayer {
  const agentState = ensureL3(layer, agentId);
  return { ...layer, l3: { ...layer.l3, [agentId]: l3Add(agentState, category, content, ttlMs) } };
}

export function getAgentTodos(layer: MemoryLayer, agentId: string) {
  return l3Todos(layer.l3[agentId] ?? createL3AgentMemory(agentId));
}

export function rememberPattern(layer: MemoryLayer, category: "preference" | "success-pattern" | "failure-pattern" | "stylistic" | "domain", key: string, value: string): MemoryLayer {
  return { ...layer, l4: l4Record(layer.l4, category, key, value) };
}

export function recallPattern(layer: MemoryLayer, category: "preference" | "success-pattern" | "failure-pattern" | "stylistic" | "domain", key: string) {
  return l4Get(layer.l4, category, key);
}

export function lastChange(layer: MemoryLayer) {
  return l2Latest(layer.l2);
}

/** Master metric: overall memory health 0-1. */
export function memoryHealth(layer: MemoryLayer): number {
  const l0Health = 1 - Math.min(1, layer.l0.entries.length / 1000);
  const l1Health = layer.l1.snapshots.length > 0 ? 1 : 0.5;
  const l2Health = Math.min(1, layer.l2.records.length / 50);
  const l3Agents = Object.keys(layer.l3).length;
  const l3Health = Math.min(1, l3Agents / 3);
  const l4Health = Math.min(1, Object.keys(layer.l4.patterns).length / 20);
  return (l0Health * 0.2 + l1Health * 0.3 + l2Health * 0.1 + l3Health * 0.2 + l4Health * 0.2);
}
