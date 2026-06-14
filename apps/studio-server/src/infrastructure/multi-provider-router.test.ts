// V14 MultiProviderRouter (Direction E 14/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickProvider,
  routeRequest,
  initHealthMap,
  setProviderHealth,
  routingHealth,
} from "./multi-provider-router.js";
import { createAdapterRegistry, registerAdapter } from "./adapter-registry.js";
import { createHealthState, recordHealth } from "./health-checker.js";
import type { ChannelAdapter, ChannelRequest, ChannelResponse } from "./channel-adapter.js";

function makeAdapter(id: string, fail: boolean = false): ChannelAdapter {
  return {
    id, type: "openai", capabilities: ["text"],
    baseUrl: "http://x", defaultModel: "m",
    chat: async (): Promise<ChannelResponse> => {
      if (fail) throw new Error(`${id} failed`);
      return { ok: true, chunks: [], text: "ok", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, firstChunkMs: 10, totalMs: 10 };
    },
    health: async () => ({ ok: true, firstChunkMs: 10, model: "m" }),
    close: async () => {},
  };
}

test("pickProvider: no adapters", () => {
  const r = pickProvider(createAdapterRegistry(), {});
  assert.equal(r.adapterId, null);
  assert.equal(r.reason, "no-adapter");
});

test("pickProvider: single adapter", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  const r = pickProvider(reg, {});
  assert.equal(r.adapterId, "a1");
  assert.equal(r.reason, "primary");
});

test("pickProvider: respects priority", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"), { priority: 50 });
  reg = registerAdapter(reg, makeAdapter("a2"), { priority: 10 });
  const r = pickProvider(reg, {});
  assert.equal(r.adapterId, "a2");
});

test("pickProvider: skips circuit-open", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"), { priority: 10 });
  reg = registerAdapter(reg, makeAdapter("a2"), { priority: 20 });
  let h = createHealthState("a1", { failureThreshold: 1, openCooldownMs: 60000 });
  h = recordHealth(h, false, null, "fail");
  const r = pickProvider(reg, { a1: h });
  assert.equal(r.adapterId, "a2");
  assert.equal(r.reason, "fallback");
});

test("pickProvider: all open = circuit-open", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  let h = createHealthState("a1", { failureThreshold: 1, openCooldownMs: 60000 });
  h = recordHealth(h, false, null, "fail");
  const r = pickProvider(reg, { a1: h });
  assert.equal(r.adapterId, null);
  assert.equal(r.reason, "circuit-open");
});

test("pickProvider: excludes ids", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"), { priority: 10 });
  reg = registerAdapter(reg, makeAdapter("a2"), { priority: 20 });
  const r = pickProvider(reg, {}, "text", ["a2"]);
  assert.equal(r.adapterId, "a1");
});

test("pickProvider: capability filter", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1", false), { priority: 10 });
  // Re-register a1 with tools capability
  reg.adapters["a1"].adapter = { ...reg.adapters["a1"].adapter, capabilities: ["text"] };
  reg = registerAdapter(reg, { ...makeAdapter("a2"), capabilities: ["text", "image"] }, { priority: 20 });
  const r = pickProvider(reg, {}, "image");
  assert.equal(r.adapterId, "a2");
});

test("routeRequest: primary success", async () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  const r = await routeRequest(reg, {}, { model: "m", messages: [], stream: false });
  assert.equal(r.response?.ok, true);
  assert.equal(r.decision.adapterId, "a1");
});

test("routeRequest: fallback when primary fails", async () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1", true), { priority: 10 });
  reg = registerAdapter(reg, makeAdapter("a2", false), { priority: 20 });
  let onErrorCalls = 0;
  const r = await routeRequest(reg, {}, { model: "m", messages: [], stream: false }, "text", () => onErrorCalls++);
  assert.equal(r.response?.ok, true);
  assert.equal(r.decision.adapterId, "a2");
  assert.equal(r.decision.reason, "fallback");
  assert.equal(onErrorCalls, 1);
});

test("routeRequest: all fail = all-failed", async () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1", true), { priority: 10 });
  reg = registerAdapter(reg, makeAdapter("a2", true), { priority: 20 });
  const r = await routeRequest(reg, {}, { model: "m", messages: [], stream: false });
  assert.equal(r.response, null);
  assert.equal(r.decision.reason, "all-failed");
});

test("initHealthMap: creates closed states for all adapters", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  reg = registerAdapter(reg, makeAdapter("a2"));
  const m = initHealthMap(reg);
  assert.equal(Object.keys(m).length, 2);
  assert.equal(m["a1"].openedAt, null);
});

test("setProviderHealth: adds/updates entry", () => {
  let m: Record<string, ReturnType<typeof createHealthState>> = {};
  const h = createHealthState("a1");
  m = setProviderHealth(m, h);
  assert.equal(m["a1"].providerId, "a1");
  const h2 = recordHealth(h, false, null, "fail");
  m = setProviderHealth(m, h2);
  assert.equal(m["a1"].history.length, 1);
});

test("routingHealth: empty = 0", () => {
  assert.equal(routingHealth({}), 0);
});

test("routingHealth: all closed = 1.0", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  reg = registerAdapter(reg, makeAdapter("a2"));
  const m = initHealthMap(reg);
  assert.equal(routingHealth(m), 1.0);
});

test("routingHealth: half open = 0.5", () => {
  let reg = createAdapterRegistry();
  reg = registerAdapter(reg, makeAdapter("a1"));
  reg = registerAdapter(reg, makeAdapter("a2"));
  let m = initHealthMap(reg);
  m["a1"] = recordHealth(m["a1"], false, null, "fail");
  m["a1"] = recordHealth(m["a1"], false, null, "fail");
  m["a1"] = recordHealth(m["a1"], false, null, "fail");
  assert.equal(Math.abs(routingHealth(m) - 0.5) < 1e-9, true);
});
