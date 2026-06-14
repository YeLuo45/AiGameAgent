// V28 AdaptiveRouter (Direction E 28/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveRoute,
  routingQuality,
  DEFAULT_ADAPTIVE_ROUTER_CONFIG,
} from "./adaptive-router.js";
import { createAdapterLearner, recordOutcome } from "./adapter-learner.js";
import { createHealthState, recordHealth } from "./health-checker.js";
import type { ChannelAdapter } from "./channel-adapter.js";

function makeAdapter(id: string): ChannelAdapter {
  return {
    id, type: "openai", capabilities: ["text"],
    baseUrl: "http://x", defaultModel: "m",
    chat: async () => ({ ok: true, chunks: [], text: "", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, firstChunkMs: 0, totalMs: 0 }),
    health: async () => ({ ok: true, firstChunkMs: 0, model: "m" }),
    close: async () => {},
  };
}

test("DEFAULT_ADAPTIVE_ROUTER_CONFIG: learner 0.6, health 0.4", () => {
  assert.equal(DEFAULT_ADAPTIVE_ROUTER_CONFIG.learnerWeight, 0.6);
  assert.equal(DEFAULT_ADAPTIVE_ROUTER_CONFIG.healthWeight, 0.4);
});

test("adaptiveRoute: no candidates", () => {
  const r = adaptiveRoute([], "text", createAdapterLearner(), {});
  assert.equal(r.selectedId, "");
  assert.equal(r.confidence, 0);
});

test("adaptiveRoute: single candidate with no data = default", () => {
  const r = adaptiveRoute([makeAdapter("a1")], "text", createAdapterLearner(), {});
  assert.equal(r.selectedId, "a1");
  // 0.5 * 0.6 + 0.5 * 0.4 = 0.5
  assert.equal(r.confidence, 0.5);
});

test("adaptiveRoute: picks best by composite (learner + health)", () => {
  let learner = createAdapterLearner(0.3, 1);
  learner = recordOutcome(learner, "a1", "text", true, 100);
  learner = recordOutcome(learner, "a1", "text", true, 100);
  // a1 has successRate ~1.0, no health data (defaults to 0.5)
  // composite = 1.0 * 0.6 + 0.5 * 0.4 = 0.8
  const a1 = makeAdapter("a1");
  const a2 = makeAdapter("a2"); // no learner data, no health data
  const r = adaptiveRoute([a2, a1], "text", learner, {});
  assert.equal(r.selectedId, "a1");
  assert.equal(r.reason, "learner-best");
});

test("adaptiveRoute: health-based selection", () => {
  const a1 = makeAdapter("a1");
  const a2 = makeAdapter("a2");
  let h1 = createHealthState("a1");
  h1 = recordHealth(h1, true, 100);
  h1 = recordHealth(h1, true, 100);
  // a1 healthy
  let h2 = createHealthState("a2");
  h2 = recordHealth(h2, false, null, "fail");
  h2 = recordHealth(h2, false, null, "fail");
  h2 = recordHealth(h2, false, null, "fail");
  // a2 open circuit
  const r = adaptiveRoute([a1, a2], "text", createAdapterLearner(), { a1: h1, a2: h2 });
  assert.equal(r.selectedId, "a1");
});

test("adaptiveRoute: alternatives populated", () => {
  const r = adaptiveRoute([makeAdapter("a1"), makeAdapter("a2"), makeAdapter("a3")], "text", createAdapterLearner(), {});
  assert.equal(r.alternatives.length, 2);
});

test("adaptiveRoute: all open circuit", () => {
  let h1 = createHealthState("a1", { failureThreshold: 1, openCooldownMs: 60000 });
  h1 = recordHealth(h1, false, null, "fail");
  let h2 = createHealthState("a2", { failureThreshold: 1, openCooldownMs: 60000 });
  h2 = recordHealth(h2, false, null, "fail");
  const r = adaptiveRoute([makeAdapter("a1"), makeAdapter("a2")], "text", createAdapterLearner(), { a1: h1, a2: h2 });
  // All scores are 0 (open circuit penalty), but still picks first
  assert.equal(r.selectedId, "a1");
});

test("adaptiveRoute: composite calculation", () => {
  let learner = createAdapterLearner(0.3, 1);
  learner = recordOutcome(learner, "a1", "text", true, 100);
  learner = recordOutcome(learner, "a1", "text", true, 100);
  // a1 successRate = 1.0
  const r = adaptiveRoute([makeAdapter("a1")], "text", learner, {});
  // 1.0 * 0.6 + 0.5 * 0.4 = 0.6 + 0.2 = 0.8
  assert.equal(r.confidence, 0.8);
});

test("routingQuality: equals confidence", () => {
  const r: ReturnType<typeof adaptiveRoute> = { selectedId: "a1", reason: "learner-best", confidence: 0.75, alternatives: [] };
  assert.equal(routingQuality(r), 0.75);
});
