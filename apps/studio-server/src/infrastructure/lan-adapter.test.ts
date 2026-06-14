// V5 LANChannelAdapter (Direction E 5/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectLANKind,
  lanChatPath,
  isLANHost,
  estimateLANLatency,
  lanReadiness,
  LAN_CAPABILITIES,
  LAN_TYPE,
} from "./lan-adapter.js";
import type { ChannelRequest } from "./channel-adapter.js";

test("detectLANKind: vllm by owned_by", () => {
  assert.equal(detectLANKind("http://gpu.local:8000", { data: [{ id: "x", owned_by: "vllm" }] }), "vllm");
});

test("detectLANKind: lmstudio by owned_by", () => {
  assert.equal(detectLANKind("http://localhost:1234", { data: [{ id: "x", owned_by: "lmstudio" }] }), "lmstudio");
});

test("detectLANKind: by URL hint (vllm)", () => {
  assert.equal(detectLANKind("http://host/vllm-api", { data: [] }), "vllm");
});

test("detectLANKind: by URL hint (lmstudio port 1234)", () => {
  assert.equal(detectLANKind("http://127.0.0.1:1234", {}), "lmstudio");
});

test("detectLANKind: llamacpp port 8080", () => {
  assert.equal(detectLANKind("http://192.168.1.1:8080", {}), "llamacpp");
});

test("detectLANKind: text-generation-webui port 7860", () => {
  assert.equal(detectLANKind("http://host:7860", {}), "text-generation-webui");
});

test("detectLANKind: unknown for empty", () => {
  assert.equal(detectLANKind("", {}), "unknown");
  assert.equal(detectLANKind("http://x:9999", { data: "garbage" }), "unknown");
});

test("lanChatPath always v1/chat/completions", () => {
  assert.equal(lanChatPath("vllm"), "v1/chat/completions");
  assert.equal(lanChatPath("lmstudio"), "v1/chat/completions");
  assert.equal(lanChatPath("llamacpp"), "v1/chat/completions");
  assert.equal(lanChatPath("text-generation-webui"), "v1/chat/completions");
  assert.equal(lanChatPath("unknown"), "v1/chat/completions");
});

test("isLANHost: true for loopback", () => {
  assert.equal(isLANHost("http://127.0.0.1:11434/v1"), true);
  assert.equal(isLANHost("http://localhost:8000"), true);
});

test("isLANHost: true for 192.168.x.x", () => {
  assert.equal(isLANHost("http://192.168.1.5:8000"), true);
});

test("isLANHost: true for 10.x.x.x", () => {
  assert.equal(isLANHost("http://10.0.0.1:8000"), true);
});

test("isLANHost: true for 172.16-31.x.x", () => {
  assert.equal(isLANHost("http://172.20.5.1:8000"), true);
  assert.equal(isLANHost("http://172.15.5.1:8000"), false);
  assert.equal(isLANHost("http://172.32.5.1:8000"), false);
});

test("isLANHost: false for public", () => {
  assert.equal(isLANHost("http://api.openai.com"), false);
  assert.equal(isLANHost("https://api.anthropic.com"), false);
});

test("isLANHost: false for empty/invalid", () => {
  assert.equal(isLANHost(""), false);
  assert.equal(isLANHost("not a url"), false);
});

test("estimateLANLatency: tiny model", () => {
  assert.equal(estimateLANLatency(5, "tiny"), 55);
});

test("estimateLANLatency: large model", () => {
  assert.equal(estimateLANLatency(100, "large"), 1600);
});

test("lanReadiness: unreachable = 0", () => {
  assert.equal(lanReadiness(5, "tiny", false), 0);
});

test("lanReadiness: reachable + tiny + fast = 0.9", () => {
  // 0.6 base + 0.3 (rtt<10) = 0.9
  assert.ok(Math.abs(lanReadiness(5, "tiny", true) - 0.9) < 1e-9);
});

test("lanReadiness: medium + medium rtt = 0.65", () => {
  // 0.6 base + 0.1 (rtt<200) - 0.05 (medium penalty) = 0.65
  assert.ok(Math.abs(lanReadiness(100, "medium", true) - 0.65) < 1e-9);
});

test("lanReadiness: large + slow rtt = 0.5", () => {
  // 0.6 base + 0 (rtt>=200) - 0.1 (large penalty) = 0.5
  assert.ok(Math.abs(lanReadiness(300, "large", true) - 0.5) < 1e-9);
});

test("LAN_CAPABILITIES contains text", () => {
  assert.ok(LAN_CAPABILITIES.includes("text"));
});

test("LAN_TYPE is 'lan'", () => {
  assert.equal(LAN_TYPE, "lan");
});
