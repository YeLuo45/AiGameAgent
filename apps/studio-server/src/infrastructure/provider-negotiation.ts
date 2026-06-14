// V24 ProviderNegotiation (Direction E 24/30, chatdev)
// Capability matching between request and available providers

import { type ChannelAdapter, type ChannelCapability } from "./channel-adapter.js";
import { type AdapterRegistryState, listAdapters } from "./adapter-registry.js";

export interface NegotiationRequest {
  requiredCapabilities: ChannelCapability[];
  preferredTypes?: Array<"openai" | "anthropic" | "ollama" | "lan" | "cloud">;
  maxLatencyMs?: number;
  excludeIds?: string[];
}

export interface NegotiationResult {
  /** Best matching adapter id (null if no match). */
  selectedId: string | null;
  /** Score 0-1. */
  score: number;
  /** All candidates with their scores (sorted desc). */
  candidates: Array<{ id: string; score: number; matched: ChannelCapability[]; missing: ChannelCapability[] }>;
}

function scoreAdapter(adapter: ChannelAdapter, req: NegotiationRequest): { score: number; matched: ChannelCapability[]; missing: ChannelCapability[] } {
  const matched: ChannelCapability[] = [];
  const missing: ChannelCapability[] = [];
  for (const cap of req.requiredCapabilities) {
    if (adapter.capabilities.includes(cap)) matched.push(cap);
    else missing.push(cap);
  }
  if (missing.length > 0) return { score: 0, matched, missing };
  // Base score: 0.5 for having capabilities, 0.5 for matching all required
  let score = 0.5;
  if (matched.length === req.requiredCapabilities.length) score += 0.5;
  // Penalty for excluded
  if (req.excludeIds && req.excludeIds.includes(adapter.id)) {
    score = 0;
  }
  // Store the uncapped score for sort comparison via a separate field
  // We'll use a small bonus for preferred type that doesn't get capped
  // Approach: keep score in [0,1] for the reported score, but use sort key separately
  const reportScore = Math.min(1, score);
  return { score: reportScore, matched, missing };
}

function sortKey(adapter: ChannelAdapter, req: NegotiationRequest): number {
  // Higher = better. Used for sorting only.
  if (req.excludeIds && req.excludeIds.includes(adapter.id)) return -1;
  let key = 0.5;
  if (req.requiredCapabilities.every((c) => adapter.capabilities.includes(c))) key += 0.5;
  if (req.preferredTypes && req.preferredTypes.includes(adapter.type)) key += 0.1;
  return key;
}

export function negotiate(req: NegotiationRequest, registry: AdapterRegistryState): NegotiationResult {
  const adapters = listAdapters(registry, { enabledOnly: true });
  const candidates = adapters
    .map((a) => {
      const { score, matched, missing } = scoreAdapter(a.adapter, req);
      const key = sortKey(a.adapter, req);
      return { id: a.adapter.id, score, matched, missing, _key: key };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b._key - a._key);
  if (candidates.length === 0) return { selectedId: null, score: 0, candidates: [] };
  const best = candidates[0];
  return { selectedId: best.id, score: best.score, candidates: candidates.map(({ _key, ...rest }) => rest) };
}

/** Master metric: negotiation coverage 0-1. */
export function negotiationCoverage(result: NegotiationResult): number {
  if (result.candidates.length === 0) return 0;
  return result.score;
}
