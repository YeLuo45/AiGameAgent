// V29 StudioResilienceOrchestrator (Direction E 29/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createResilienceState,
  checkRequest,
  recordAttempt,
  maybeRecover,
  shouldRetryAttempt,
  resilienceScore,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from "./resilience-orchestrator.js";
import { recordHealth } from "./health-checker.js";
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

test("DEFAULT_ORCHESTRATOR_CONFIG: maxRetries 2", () => {
  assert.equal(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries, 2);
});

test("createResilienceState: empty adapters", () => {
  const s = createResilienceState([]);
  assert.equal(Object.keys(s.health).length, 0);
  assert.equal(s.metrics.totalAttempts, 0);
});

test("createResilienceState: with adapters", () => {
  const s = createResilienceState([makeAdapter("a1"), makeAdapter("a2")]);
  assert.equal(Object.keys(s.health).length, 2);
  assert.ok(s.health["a1"]);
  assert.ok(s.rateLimits["a1"]);
});

test("checkRequest: ok by default", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  const r = checkRequest(s, { providerId: "a1" });
  assert.equal(r.allowed, true);
  assert.equal(r.reason, "ok");
});

test("checkRequest: open circuit = blocked", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  s.health["a1"] = recordHealth(s.health["a1"], false, null, "fail");
  s.health["a1"] = recordHealth(s.health["a1"], false, null, "fail");
  s.health["a1"] = recordHealth(s.health["a1"], false, null, "fail");
  const r = checkRequest(s, { providerId: "a1" });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "circuit-open");
});

test("checkRequest: rate limit gives retryAfterMs", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  // Default capacity is 10, so first 10 should succeed
  for (let i = 0; i < 10; i++) checkRequest(s, { providerId: "a1" });
  const r = checkRequest(s, { providerId: "a1" });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "rate-limited");
  assert.ok(r.retryAfterMs > 0);
});

test("checkRequest: rate limited after exhaustion", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  // Default rate limit has capacity 10
  for (let i = 0; i < 10; i++) checkRequest(s, { providerId: "a1" });
  const r = checkRequest(s, { providerId: "a1" });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "rate-limited");
  assert.equal(s.metrics.totalRateLimited, 1);
});

test("checkRequest: unknown provider = ok with default rate limit", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  const r = checkRequest(s, { providerId: "unknown" });
  assert.equal(r.allowed, true);
});

test("recordAttempt: success", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  recordAttempt(s, "a1", true);
  assert.equal(s.metrics.totalSuccess, 1);
  assert.equal(s.metrics.totalFailed, 0);
});

test("recordAttempt: failure", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  recordAttempt(s, "a1", false);
  assert.equal(s.metrics.totalFailed, 1);
});

test("recordAttempt: unknown provider initializes health", () => {
  const s = createResilienceState([]);
  recordAttempt(s, "newp", true);
  assert.ok(s.health["newp"]);
});

test("maybeRecover: open circuit triggers recovery", () => {
  const s = createResilienceState([makeAdapter("p"), makeAdapter("fb")]);
  s.health["p"] = recordHealth(s.health["p"], false, null, "fail");
  s.health["p"] = recordHealth(s.health["p"], false, null, "fail");
  s.health["p"] = recordHealth(s.health["p"], false, null, "fail");
  const r = maybeRecover(s, makeAdapter("p"), [makeAdapter("p"), makeAdapter("fb")], "test");
  assert.equal(s.metrics.totalRecoveries, 1);
  assert.equal(r.recovery.recoveries["p"]?.currentFallback, "fb");
});

test("maybeRecover: closed circuit no recovery", () => {
  const s = createResilienceState([makeAdapter("p"), makeAdapter("fb")]);
  const r = maybeRecover(s, makeAdapter("p"), [makeAdapter("p"), makeAdapter("fb")], "test");
  assert.equal(s.metrics.totalRecoveries, 0);
});

test("shouldRetryAttempt: retries 5xx", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  assert.equal(shouldRetryAttempt(s, 1, { status: 503 }), true);
  assert.equal(shouldRetryAttempt(s, 5, { status: 503 }), false); // max attempts
});

test("shouldRetryAttempt: not 4xx", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  assert.equal(shouldRetryAttempt(s, 1, { status: 400 }), false);
});

test("resilienceScore: empty = 1.0", () => {
  assert.equal(resilienceScore(createResilienceState([])), 1.0);
});

test("resilienceScore: all success = 1.0", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  recordAttempt(s, "a1", true);
  recordAttempt(s, "a1", true);
  assert.equal(resilienceScore(s), 1.0);
});

test("resilienceScore: 50% success = 0.5", () => {
  const s = createResilienceState([makeAdapter("a1")]);
  recordAttempt(s, "a1", true);
  recordAttempt(s, "a1", false);
  assert.equal(resilienceScore(s), 0.5);
});
