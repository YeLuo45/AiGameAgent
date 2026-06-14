// V9 AdapterRegistry (Direction E 9/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAdapterRegistry,
  registerAdapter,
  unregisterAdapter,
  getAdapter,
  setAdapterEnabled,
  setAdapterPriority,
  listAdapters,
  getDefaultAdapter,
  countAdapters,
  buildFallbackChain,
  registryHealth,
} from "./adapter-registry.js";
import type { ChannelAdapter } from "./channel-adapter.js";

function makeAdapter(id: string, type: ChannelAdapter["type"] = "openai", caps: ChannelAdapter["capabilities"] = ["text"]): ChannelAdapter {
  return {
    id, type, capabilities: caps,
    baseUrl: "http://x",
    defaultModel: "m",
    chat: async () => ({ ok: true, chunks: [], text: "", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, firstChunkMs: 0, totalMs: 0 }),
    health: async () => ({ ok: true, firstChunkMs: 0, model: "m" }),
    close: async () => {},
  };
}

test("createAdapterRegistry: empty", () => {
  const s = createAdapterRegistry();
  assert.equal(Object.keys(s.adapters).length, 0);
  assert.equal(s.defaultPriority, 100);
});

test("registerAdapter: adds entry", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"));
  assert.ok(s.adapters["a1"]);
  assert.equal(s.adapters["a1"].enabled, true);
  assert.equal(s.adapters["a1"].priority, 100);
});

test("registerAdapter: with options", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { priority: 5, enabled: false, tags: ["fast"] });
  assert.equal(s.adapters["a1"].priority, 5);
  assert.equal(s.adapters["a1"].enabled, false);
  assert.deepEqual(s.adapters["a1"].tags, ["fast"]);
});

test("unregisterAdapter: removes entry", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"));
  s = unregisterAdapter(s, "a1");
  assert.equal(s.adapters["a1"], undefined);
});

test("unregisterAdapter: no-op for missing", () => {
  const s = createAdapterRegistry();
  const after = unregisterAdapter(s, "missing");
  assert.equal(Object.keys(after.adapters).length, 0);
});

test("getAdapter: returns entry or undefined", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"));
  assert.ok(getAdapter(s, "a1"));
  assert.equal(getAdapter(s, "nope"), undefined);
});

test("setAdapterEnabled: toggles flag", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"));
  s = setAdapterEnabled(s, "a1", false);
  assert.equal(s.adapters["a1"].enabled, false);
  s = setAdapterEnabled(s, "a1", true);
  assert.equal(s.adapters["a1"].enabled, true);
});

test("setAdapterEnabled: no-op for missing", () => {
  const s = createAdapterRegistry();
  const after = setAdapterEnabled(s, "nope", true);
  assert.equal(after, s);
});

test("setAdapterPriority: no-op for missing", () => {
  const s = createAdapterRegistry();
  const after = setAdapterPriority(s, "nope", 10);
  assert.equal(after, s);
});

test("listAdapters: sorted by priority", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { priority: 50 });
  s = registerAdapter(s, makeAdapter("a2"), { priority: 10 });
  s = registerAdapter(s, makeAdapter("a3"), { priority: 30 });
  const list = listAdapters(s);
  assert.equal(list[0].adapter.id, "a2");
  assert.equal(list[1].adapter.id, "a3");
  assert.equal(list[2].adapter.id, "a1");
});

test("listAdapters: filter by type", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1", "openai"));
  s = registerAdapter(s, makeAdapter("a2", "ollama"));
  const openai = listAdapters(s, { type: "openai" });
  assert.equal(openai.length, 1);
  assert.equal(openai[0].adapter.id, "a1");
});

test("listAdapters: filter by capability", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1", "openai", ["text"]));
  s = registerAdapter(s, makeAdapter("a2", "openai", ["text", "image"]));
  const textOnly = listAdapters(s, { capability: "image" });
  assert.equal(textOnly.length, 1);
  assert.equal(textOnly[0].adapter.id, "a2");
});

test("listAdapters: enabledOnly filter", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { enabled: true });
  s = registerAdapter(s, makeAdapter("a2"), { enabled: false });
  assert.equal(listAdapters(s, { enabledOnly: true }).length, 1);
  assert.equal(listAdapters(s).length, 2);
});

test("listAdapters: filter by tag", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { tags: ["fast"] });
  s = registerAdapter(s, makeAdapter("a2"), { tags: ["cheap"] });
  const fast = listAdapters(s, { tag: "fast" });
  assert.equal(fast.length, 1);
  assert.equal(fast[0].adapter.id, "a1");
});

test("getDefaultAdapter: returns first enabled", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { priority: 50 });
  s = registerAdapter(s, makeAdapter("a2"), { priority: 10 });
  const def = getDefaultAdapter(s);
  assert.equal(def?.adapter.id, "a2");
});

test("getDefaultAdapter: returns null when empty", () => {
  assert.equal(getDefaultAdapter(createAdapterRegistry()), null);
});

test("getDefaultAdapter: filter by capability", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1", "openai", ["text"]), { priority: 10 });
  s = registerAdapter(s, makeAdapter("a2", "openai", ["text", "image"]), { priority: 20 });
  const text = getDefaultAdapter(s, "text");
  assert.equal(text?.adapter.id, "a1");
  const image = getDefaultAdapter(s, "image");
  assert.equal(image?.adapter.id, "a2");
});

test("countAdapters: total and enabled", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { enabled: true });
  s = registerAdapter(s, makeAdapter("a2"), { enabled: false });
  assert.equal(countAdapters(s), 2);
  assert.equal(countAdapters(s, true), 1);
});

test("buildFallbackChain: enabled adapters in priority order", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { priority: 30, enabled: true });
  s = registerAdapter(s, makeAdapter("a2"), { priority: 10, enabled: true });
  s = registerAdapter(s, makeAdapter("a3"), { priority: 20, enabled: false });
  const chain = buildFallbackChain(s);
  assert.equal(chain[0].id, "a2");
  assert.equal(chain[1].id, "a1");
  assert.equal(chain.length, 2);
});

test("registryHealth: empty = 0", () => {
  assert.equal(registryHealth(createAdapterRegistry()), 0);
});

test("registryHealth: all enabled + diverse types", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1", "openai"));
  s = registerAdapter(s, makeAdapter("a2", "ollama"));
  s = registerAdapter(s, makeAdapter("a3", "anthropic"));
  // 1.0 (all enabled) + 0.3 (3 types, capped) = 1.3 → 1.0
  assert.equal(registryHealth(s), 1.0);
});

test("registryHealth: half enabled", () => {
  let s = createAdapterRegistry();
  s = registerAdapter(s, makeAdapter("a1"), { enabled: true });
  s = registerAdapter(s, makeAdapter("a2"), { enabled: false });
  // 0.5 (1/2) + 0.1 (1 type) = 0.6
  assert.equal(Math.abs(registryHealth(s) - 0.6) < 1e-9, true);
});
