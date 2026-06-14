// V28 AdaptiveRouter (Direction E 28/30, generic-agent)
// Dynamic routing that adapts based on learner + health + reflector

import { type ChannelAdapter } from "./channel-adapter.js";
import { type AdapterLearnerState, pickBest as pickLearnerBest, getScore } from "./adapter-learner.js";
import { type HealthCheckerState, getCircuitState } from "./health-checker.js";

export type TaskKind = "text" | "code" | "summary" | "tools" | "creative";

export interface RoutingDecision {
  selectedId: string;
  reason: "learner-best" | "health-best" | "fallback" | "default";
  /** Score 0-1. */
  confidence: number;
  /** Alternatives considered. */
  alternatives: Array<{ id: string; score: number; reason: string }>;
}

export interface AdaptiveRouterConfig {
  /** Weight for learner score. */
  learnerWeight: number;
  /** Weight for health score. */
  healthWeight: number;
}

export const DEFAULT_ADAPTIVE_ROUTER_CONFIG: AdaptiveRouterConfig = { learnerWeight: 0.6, healthWeight: 0.4 };

export function adaptiveRoute(
  candidates: ChannelAdapter[],
  taskKind: TaskKind,
  learner: AdapterLearnerState,
  healthMap: Record<string, HealthCheckerState>,
  config: AdaptiveRouterConfig = DEFAULT_ADAPTIVE_ROUTER_CONFIG,
  now: number = Date.now(),
): RoutingDecision {
  const scored: Array<{ id: string; score: number; reason: string }> = [];
  for (const a of candidates) {
    const l = getScore(learner, a.id, taskKind);
    const h = healthMap[a.id];
    const learnerScore = l && l.attempts >= learner.minAttempts ? l.successRate : 0.5; // default neutral
    const healthScore = h ? (getCircuitState(h, now) === "open" ? 0 : 1) : 0.5;
    const composite = learnerScore * config.learnerWeight + healthScore * config.healthWeight;
    const reason = learnerScore > 0.7 ? "learner-best" : healthScore > 0.8 ? "health-best" : "fallback";
    scored.push({ id: a.id, score: composite, reason });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return { selectedId: candidates[0]?.id ?? "", reason: "default", confidence: 0, alternatives: [] };
  }
  const top = scored[0];
  return { selectedId: top.id, reason: top.reason as RoutingDecision["reason"], confidence: top.score, alternatives: scored.slice(1) };
}

/** Master metric: routing quality 0-1. */
export function routingQuality(decision: RoutingDecision): number {
  return decision.confidence;
}
