// V1 ChannelAdapter (Direction E 1/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type ChannelAdapter,
  type ChannelCapability,
  type ChannelChunk,
  type ChannelMessage,
  type ChannelRequest,
  type ChannelResponse,
  aggregateChunks,
  adapterReadiness,
  createEmptyUsage,
  estimateTokens,
  hasCapability,
  supportsTools,
} from "./channel-adapter.js";

function makeStubAdapter(overrides: Partial<ChannelAdapter> = {}): ChannelAdapter {
  return {
    id: "stub",
    type: "openai",
    capabilities: ["text"],
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2",
    chat: async () => ({ ok: true, chunks: [], text: "", toolCalls: [], usage: createEmptyUsage(), firstChunkMs: 100, totalMs: 100 }),
    health: async () => ({ ok: true, firstChunkMs: 50, model: "llama3.2" }),
    close: async () => {},
    ...overrides,
  };
}

test("createEmptyUsage returns zeroed usage", () => {
  const u = createEmptyUsage();
  assert.equal(u.promptTokens, 0);
  assert.equal(u.completionTokens, 0);
  assert.equal(u.totalTokens, 0);
});

test("aggregateChunks: text chunks concatenate", () => {
  const chunks: ChannelChunk[] = [
    { type: "text", text: "Hello" },
    { type: "text", text: " " },
    { type: "text", text: "world" },
  ];
  const r = aggregateChunks(chunks);
  assert.equal(r.text, "Hello world");
  assert.equal(r.toolCalls.length, 0);
  assert.equal(r.error, null);
});

test("aggregateChunks: tool_call chunks collected", () => {
  const chunks: ChannelChunk[] = [
    { type: "tool_call", id: "tc1", name: "Read", args: '{"path":"/a"}' },
    { type: "tool_call", id: "tc2", name: "Write", args: '{"path":"/b"}' },
  ];
  const r = aggregateChunks(chunks);
  assert.equal(r.toolCalls.length, 2);
  assert.equal(r.toolCalls[0].name, "Read");
  assert.equal(r.toolCalls[1].id, "tc2");
});

test("aggregateChunks: usage and finishReason extracted", () => {
  const chunks: ChannelChunk[] = [
    { type: "usage", promptTokens: 10, completionTokens: 5 },
    { type: "done", finishReason: "stop" },
  ];
  const r = aggregateChunks(chunks);
  assert.equal(r.usage.promptTokens, 10);
  assert.equal(r.usage.completionTokens, 5);
  assert.equal(r.usage.totalTokens, 15);
  assert.equal(r.finishReason, "stop");
});

test("aggregateChunks: error chunk sets error + finishReason", () => {
  const chunks: ChannelChunk[] = [
    { type: "text", text: "partial" },
    { type: "error", message: "upstream_500", code: "500" },
  ];
  const r = aggregateChunks(chunks);
  assert.equal(r.error, "upstream_500");
  assert.equal(r.finishReason, "error");
  assert.equal(r.text, "partial");
});

test("hasCapability returns true for present, false for absent", () => {
  const a = makeStubAdapter({ capabilities: ["text", "tools"] });
  assert.equal(hasCapability(a, "text"), true);
  assert.equal(hasCapability(a, "tools"), true);
  assert.equal(hasCapability(a, "image"), false);
  assert.equal(hasCapability(a, "music"), false);
});

test("supportsTools true when 'tools' in capabilities", () => {
  const a = makeStubAdapter({ capabilities: ["text"] });
  assert.equal(supportsTools(a), false);
  const b = makeStubAdapter({ capabilities: ["text", "tools"] });
  assert.equal(supportsTools(b), true);
});

test("estimateTokens: 4 chars per token rounding", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(estimateTokens("a".repeat(100)), 25);
});

test("adapterReadiness: 0.5 baseline (no health) + capability boost", () => {
  // 0.5 base + 0.025 * 1 cap (text) = 0.525
  const a = makeStubAdapter({ capabilities: ["text"] });
  assert.equal(adapterReadiness(a, null), 0.525);
});

test("adapterReadiness: no capabilities = 0.5 baseline", () => {
  const a = makeStubAdapter({ capabilities: [] });
  assert.equal(adapterReadiness(a, null), 0.5);
});

test("adapterReadiness: ok + fast firstChunk → high score", () => {
  const a = makeStubAdapter({ capabilities: ["text"] });
  // 0.5 + 0.3 (ok) + 0.2 (fast) + 0.025 (1 cap) = 1.025 → clamped to 1.0
  const score = adapterReadiness(a, { ok: true, firstChunkMs: 500, model: "x" });
  assert.ok(score >= 0.95 && score <= 1.0, `expected ≥0.95, got ${score}`);
});

test("adapterReadiness: ok but slow firstChunk → mid score", () => {
  const a = makeStubAdapter({ capabilities: ["text"] });
  // 0.5 + 0.3 (ok) + 0 (slow, >1500ms) + 0.025 (1 cap) ≈ 0.825
  const score = adapterReadiness(a, { ok: true, firstChunkMs: 3000, model: "x" });
  assert.ok(Math.abs(score - 0.825) < 1e-9, `expected ≈0.825, got ${score}`);
});

test("adapterReadiness: failing health → 0.525 (with capabilities)", () => {
  const a = makeStubAdapter({ capabilities: ["text"] });
  // 0.5 base + 0.025 (1 cap), no health bonus
  const score = adapterReadiness(a, { ok: false, firstChunkMs: null, model: "x", error: "ECONNREFUSED" });
  assert.equal(score, 0.525);
});

test("adapterReadiness: many capabilities boost score", () => {
  const a = makeStubAdapter({ capabilities: ["text", "image", "music", "tools"] });
  const score = adapterReadiness(a, { ok: true, firstChunkMs: 100, model: "x" });
  assert.ok(score >= 1.0, `expected cap at 1.0, got ${score}`);
});
