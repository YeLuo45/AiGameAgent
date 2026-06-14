// V14 MultiProviderRouter (Direction E 14/30, nanobot)
// Routes a request to the best adapter in a fallback chain, with health-based selection

import { type ChannelAdapter, type ChannelRequest, type ChannelResponse } from "./channel-adapter.js";
import { type AdapterRegistryState, getAdapter, buildFallbackChain, listAdapters } from "./adapter-registry.js";
import { type HealthCheckerState, getCircuitState } from "./health-checker.js";

export interface ProviderHealthMap {
  [providerId: string]: HealthCheckerState;
}

export interface RouterDecision {
  /** Selected adapter id. */
  adapterId: string | null;
  /** Reason for selection. */
  reason: "primary" | "fallback" | "no-adapter" | "circuit-open" | "all-failed";
  /** Ordered chain of attempted adapter ids. */
  attemptedChain: string[];
}

export function pickProvider(
  registry: AdapterRegistryState,
  healthMap: ProviderHealthMap,
  capability: "text" | "image" | "music" | "tools" = "text",
  excludeIds: string[] = [],
  now: number = Date.now(),
): RouterDecision {
  const candidates = buildFallbackChain(registry, capability).filter((a) => !excludeIds.includes(a.id));
  if (candidates.length === 0) return { adapterId: null, reason: "no-adapter", attemptedChain: [] };
  const attempted: string[] = [];
  for (const a of candidates) {
    attempted.push(a.id);
    const h = healthMap[a.id];
    if (!h) return { adapterId: a.id, reason: attempted.length === 1 ? "primary" : "fallback", attemptedChain: attempted };
    if (getCircuitState(h, now) === "open") continue;
    return { adapterId: a.id, reason: attempted.length === 1 ? "primary" : "fallback", attemptedChain: attempted };
  }
  return { adapterId: null, reason: "circuit-open", attemptedChain: attempted };
}

/** Attempt a request through the fallback chain. */
export async function routeRequest(
  registry: AdapterRegistryState,
  healthMap: ProviderHealthMap,
  req: ChannelRequest,
  capability: "text" | "image" | "music" | "tools" = "text",
  onError?: (adapterId: string, err: unknown) => void,
): Promise<{ response: ChannelResponse | null; decision: RouterDecision }> {
  let decision: RouterDecision | null = null;
  const allAdapters = buildFallbackChain(registry, capability);
  const attempted: string[] = [];
  let lastErr: unknown = null;
  for (const a of allAdapters) {
    const h = healthMap[a.id];
    if (h && getCircuitState(h) === "open") {
      attempted.push(a.id);
      continue;
    }
    attempted.push(a.id);
    try {
      const resp = await a.chat(req);
      decision = { adapterId: a.id, reason: attempted.length === 1 ? "primary" : "fallback", attemptedChain: attempted };
      return { response: resp, decision };
    } catch (err) {
      lastErr = err;
      onError?.(a.id, err);
    }
  }
  decision = { adapterId: null, reason: lastErr ? "all-failed" : "circuit-open", attemptedChain: attempted };
  return { response: null, decision };
}

/** Build a fresh health map (all circuits closed). */
export function initHealthMap(registry: AdapterRegistryState): ProviderHealthMap {
  const map: ProviderHealthMap = {};
  for (const r of Object.values(registry.adapters)) {
    map[r.adapter.id] = {
      providerId: r.adapter.id,
      history: [],
      maxHistory: 20,
      failureThreshold: 3,
      openCooldownMs: 30_000,
      openedAt: null,
      lastOkAt: null,
      lastFirstChunkMs: null,
    };
  }
  return map;
}

/** Add or update a single provider's health state. */
export function setProviderHealth(map: ProviderHealthMap, state: HealthCheckerState): ProviderHealthMap {
  return { ...map, [state.providerId]: state };
}

/** Master metric: routing health 0-1 (fraction of healthy providers). */
export function routingHealth(healthMap: ProviderHealthMap, now: number = Date.now()): number {
  const states = Object.values(healthMap);
  if (states.length === 0) return 0;
  const healthy = states.filter((h) => getCircuitState(h, now) !== "open").length;
  return healthy / states.length;
}
