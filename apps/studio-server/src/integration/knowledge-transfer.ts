// V23 KnowledgeTransfer (Direction D 23/30, orchestrator)
// Cross-agent learning (share patterns between agents)

export interface KnowledgePacket {
  id: string;
  ts: number;
  fromAgent: string;
  toAgent: string;
  topic: string;
  payload: Record<string, unknown>;
  confidence: number;
}

export interface KnowledgeTransferState {
  packets: KnowledgePacket[];
  nextId: number;
  /** Index by agent. */
  byAgent: Record<string, KnowledgePacket[]>;
  maxPackets: number;
}

export function createKnowledgeTransfer(maxPackets: number = 500): KnowledgeTransferState {
  return { packets: [], nextId: 1, byAgent: {}, maxPackets };
}

export function transfer(state: KnowledgeTransferState, from: string, to: string, topic: string, payload: Record<string, unknown>, confidence: number = 0.8): KnowledgeTransferState {
  const packet: KnowledgePacket = { id: state.nextId, ts: Date.now(), fromAgent: from, toAgent: to, topic, payload, confidence };
  const byAgent = { ...state.byAgent, [to]: [...(state.byAgent[to] ?? []), packet] };
  const packets = [...state.packets, packet];
  if (packets.length > state.maxPackets) packets.shift();
  return { ...state, packets, nextId: state.nextId + 1, byAgent };
}

export function receivedBy(state: KnowledgeTransferState, agent: string): KnowledgePacket[] {
  return state.byAgent[agent] ?? [];
}

export function sentBy(state: KnowledgeTransferState, agent: string): KnowledgePacket[] {
  return state.packets.filter((p) => p.fromAgent === agent);
}

export function packetsByTopic(state: KnowledgeTransferState, topic: string): KnowledgePacket[] {
  return state.packets.filter((p) => p.topic === topic);
}

export function uniqueTopics(state: KnowledgeTransferState): string[] {
  return Array.from(new Set(state.packets.map((p) => p.topic))).sort();
}

export function broadcast(state: KnowledgeTransferState, from: string, toAgents: string[], topic: string, payload: Record<string, unknown>, confidence: number = 0.8): KnowledgeTransferState {
  let s = state;
  for (const to of toAgents) {
    s = transfer(s, from, to, topic, payload, confidence);
  }
  return s;
}

/** Master metric: knowledge transfer density 0-1. */
export function knowledgeDensity(state: KnowledgeTransferState): number {
  if (state.packets.length === 0) return 0;
  const uniquePairs = new Set(state.packets.map((p) => `${p.fromAgent}->${p.toAgent}`)).size;
  return Math.min(1, state.packets.length / Math.max(1, uniquePairs * 5));
}
