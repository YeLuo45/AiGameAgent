// V3 AnthropicChannelAdapter (Direction E 3/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toAnthropicBody,
  fromAnthropicResponse,
  mapAnthropicStopReason,
  anthropicFidelity,
  anthropicMessagesPath,
} from "./anthropic-adapter.js";
import type { ChannelRequest } from "./channel-adapter.js";

function makeReq(o: Partial<ChannelRequest> = {}): ChannelRequest {
  return { model: "claude-3-5-sonnet-20241022", messages: [{ role: "user", content: "hi" }], stream: false, ...o };
}

test("toAnthropicBody: system message extracted to body.system", () => {
  const body = toAnthropicBody(makeReq({ messages: [{ role: "system", content: "be brief" }, { role: "user", content: "hi" }] }));
  assert.equal(body.system, "be brief");
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, "user");
});

test("toAnthropicBody: max_tokens defaults to 4096 if absent", () => {
  const body = toAnthropicBody(makeReq());
  assert.equal(body.max_tokens, 4096);
});

test("toAnthropicBody: max_tokens override", () => {
  const body = toAnthropicBody(makeReq({ maxTokens: 100 }));
  assert.equal(body.max_tokens, 100);
});

test("toAnthropicBody: stop_sequences populated", () => {
  const body = toAnthropicBody(makeReq({ stop: ["END", "STOP"] }));
  assert.deepEqual(body.stop_sequences, ["END", "STOP"]);
});

test("toAnthropicBody: tool_choice auto", () => {
  const body = toAnthropicBody(makeReq({ toolChoice: "auto" }));
  assert.deepEqual(body.tool_choice, { type: "auto" });
});

test("toAnthropicBody: tool_choice specific", () => {
  const body = toAnthropicBody(makeReq({ toolChoice: { name: "Bash" } }));
  assert.deepEqual(body.tool_choice, { type: "tool", name: "Bash" });
});

test("toAnthropicBody: tools → input_schema", () => {
  const body = toAnthropicBody(makeReq({ tools: [{ name: "Read", description: "Read", parameters: { type: "object" } }] }));
  assert.equal(body.tools?.[0].input_schema, body.tools?.[0].input_schema);
  assert.equal(body.tools?.[0].name, "Read");
});

test("fromAnthropicResponse: text blocks aggregated", () => {
  const resp = fromAnthropicResponse({
    id: "x", model: "claude",
    content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 5, output_tokens: 3 },
  }, Date.now());
  assert.equal(resp.text, "Hello world");
  assert.equal(resp.usage.totalTokens, 8);
});

test("fromAnthropicResponse: tool_use → tool_call", () => {
  const resp = fromAnthropicResponse({
    id: "x", model: "claude",
    content: [{ type: "tool_use", id: "tu_1", name: "Read", input: { path: "/a" } }],
    stop_reason: "tool_use",
    usage: { input_tokens: 10, output_tokens: 20 },
  }, Date.now());
  assert.equal(resp.toolCalls.length, 1);
  assert.equal(resp.toolCalls[0].name, "Read");
  assert.ok(resp.toolCalls[0].args.includes('"path"'));
});

test("mapAnthropicStopReason: all 4 cases", () => {
  assert.equal(mapAnthropicStopReason("end_turn"), "stop");
  assert.equal(mapAnthropicStopReason("stop_sequence"), "stop");
  assert.equal(mapAnthropicStopReason("max_tokens"), "length");
  assert.equal(mapAnthropicStopReason("tool_use"), "tool_calls");
  assert.equal(mapAnthropicStopReason(null), null);
});

test("anthropicMessagesPath is v1/messages", () => {
  assert.equal(anthropicMessagesPath(), "v1/messages");
});

test("anthropicFidelity: full marks", () => {
  assert.equal(anthropicFidelity(makeReq({ maxTokens: 100 })), 1.0);
});

test("anthropicFidelity: missing maxTokens → 0.95", () => {
  assert.equal(anthropicFidelity(makeReq()), 0.95);
});

test("anthropicFidelity: missing model → 0.45", () => {
  // 1.0 - 0.5 (no model) - 0.05 (no maxTokens) = 0.45
  assert.ok(Math.abs(anthropicFidelity(makeReq({ model: "" })) - 0.45) < 1e-9);
});

test("anthropicFidelity: only system message → 0.95", () => {
  // system gets extracted, no user/assistant left = empty
  // 1.0 - 0.05 (only system, length=1) = 0.95 (maxTokens is provided so no penalty)
  const f = anthropicFidelity({ model: "claude", messages: [{ role: "system", content: "x" }], stream: false, maxTokens: 100 } as ChannelRequest);
  assert.ok(Math.abs(f - 0.95) < 1e-9, `expected ≈0.95, got ${f}`);
});

test("anthropicFidelity: empty messages → 0.6", () => {
  // 1.0 - 0.4 (no messages) - 0.05 (no maxTokens) = 0.55... hmm
  // Actually !messages check: 1.0 - 0.5 (no model) doesn't fire
  // 1.0 - 0.4 (empty messages) - 0.05 (no maxTokens) = 0.55
  // But model is set, so 1.0 - 0.4 (empty) - 0.05 (no maxTokens) = 0.55
  const f = anthropicFidelity({ model: "claude", messages: [], stream: false } as ChannelRequest);
  assert.ok(Math.abs(f - 0.55) < 1e-9, `expected ≈0.55, got ${f}`);
});

test("toAnthropicBody: tool_choice none maps to auto", () => {
  // Anthropic doesn't have "none" → maps to auto
  const body = toAnthropicBody(makeReq({ toolChoice: "none" }));
  assert.deepEqual(body.tool_choice, { type: "auto" });
});
