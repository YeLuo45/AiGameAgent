// V2 OpenAIChannelAdapter (Direction E 2/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toOpenAIBody,
  fromOpenAIResponse,
  parseOpenAISSEChunk,
  toOpenAISSE,
  openAIFidelity,
  openAIChatCompletionsPath,
} from "./openai-adapter.js";
import type { ChannelRequest } from "./channel-adapter.js";

function makeReq(overrides: Partial<ChannelRequest> = {}): ChannelRequest {
  return {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    stream: false,
    ...overrides,
  };
}

test("toOpenAIBody: minimal happy path", () => {
  const body = toOpenAIBody(makeReq());
  assert.equal(body.model, "gpt-4o");
  assert.equal(body.stream, false);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages[0].content, "hello");
});

test("toOpenAIBody: maxTokens + temperature + stop", () => {
  const body = toOpenAIBody(makeReq({ maxTokens: 100, temperature: 0.7, stop: ["END"] }));
  assert.equal(body.max_tokens, 100);
  assert.equal(body.temperature, 0.7);
  assert.deepEqual(body.stop, ["END"]);
});

test("toOpenAIBody: tool_choice auto", () => {
  const body = toOpenAIBody(makeReq({ toolChoice: "auto" }));
  assert.equal(body.tool_choice, "auto");
});

test("toOpenAIBody: tool_choice none", () => {
  const body = toOpenAIBody(makeReq({ toolChoice: "none" }));
  assert.equal(body.tool_choice, "none");
});

test("toOpenAIBody: tool_choice specific", () => {
  const body = toOpenAIBody(makeReq({ toolChoice: { name: "Read" } }));
  assert.deepEqual(body.tool_choice, { type: "function", function: { name: "Read" } });
});

test("toOpenAIBody: tools included", () => {
  const body = toOpenAIBody(makeReq({
    tools: [{ name: "Read", description: "Read a file", parameters: { type: "object" } }],
  }));
  assert.equal(body.tools?.length, 1);
  assert.equal(body.tools?.[0].function.name, "Read");
});

test("toOpenAIBody: toolCallId in message preserved", () => {
  const body = toOpenAIBody(makeReq({
    messages: [{ role: "tool", content: "result", toolCallId: "tc_123" }],
  }));
  assert.equal(body.messages[0].tool_call_id, "tc_123");
});

test("fromOpenAIResponse: text only", () => {
  const resp = fromOpenAIResponse({
    id: "x", model: "gpt-4o",
    choices: [{ index: 0, message: { role: "assistant", content: "Hi there" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
  }, Date.now() - 100);
  assert.equal(resp.ok, true);
  assert.equal(resp.text, "Hi there");
  assert.equal(resp.usage.totalTokens, 7);
});

test("fromOpenAIResponse: tool_calls", () => {
  const resp = fromOpenAIResponse({
    id: "x", model: "gpt-4o",
    choices: [{ index: 0, message: { role: "assistant", content: "", tool_calls: [{ id: "tc1", type: "function", function: { name: "Read", arguments: "{\"path\":\"/a\"}" } }] }, finish_reason: "tool_calls" }],
  }, Date.now());
  assert.equal(resp.toolCalls.length, 1);
  assert.equal(resp.toolCalls[0].name, "Read");
});

test("fromOpenAIResponse: no usage → zeroed", () => {
  const resp = fromOpenAIResponse({ id: "x", model: "x", choices: [{ index: 0, message: { role: "assistant", content: "x" }, finish_reason: "stop" }] }, Date.now());
  assert.equal(resp.usage.totalTokens, 0);
});

test("parseOpenAISSEChunk: text delta", () => {
  const chunks = parseOpenAISSEChunk({ choices: [{ delta: { content: "Hello" } }] });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, "text");
});

test("parseOpenAISSEChunk: tool_call delta with name", () => {
  const chunks = parseOpenAISSEChunk({
    choices: [{ delta: { tool_calls: [{ id: "tc1", function: { name: "Write", arguments: "{}" } }] } }],
  });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, "tool_call");
});

test("parseOpenAISSEChunk: tool_call delta without name (skipped)", () => {
  const chunks = parseOpenAISSEChunk({
    choices: [{ delta: { tool_calls: [{ id: "tc1", function: { arguments: "{}" } }] } }],
  });
  assert.equal(chunks.length, 0);
});

test("parseOpenAISSEChunk: no choices", () => {
  assert.equal(parseOpenAISSEChunk({}).length, 0);
});

test("toOpenAISSE: text chunk", () => {
  const line = toOpenAISSE({ type: "text", text: "hi" });
  assert.ok(line.startsWith("data: "));
  assert.ok(line.includes('"content":"hi"'));
});

test("toOpenAISSE: done chunk emits [DONE]", () => {
  const line = toOpenAISSE({ type: "done", finishReason: "stop" });
  assert.ok(line.includes("[DONE]"));
  assert.ok(line.includes('"finish_reason":"stop"'));
});

test("toOpenAISSE: usage + error are no-ops in OpenAI format", () => {
  assert.equal(toOpenAISSE({ type: "usage", promptTokens: 1, completionTokens: 2 }), "");
  assert.equal(toOpenAISSE({ type: "error", message: "x" }), "");
});

test("openAIChatCompletionsPath returns chat/completions", () => {
  assert.equal(openAIChatCompletionsPath(), "chat/completions");
});

test("openAIFidelity: full marks for clean request", () => {
  const f = openAIFidelity(makeReq());
  assert.equal(f, 1.0);
});

test("openAIFidelity: missing model → 0.5", () => {
  const f = openAIFidelity(makeReq({ model: "" }));
  assert.equal(f, 0.5);
});

test("openAIFidelity: empty messages → 0.6", () => {
  const f = openAIFidelity(makeReq({ messages: [] }));
  assert.equal(f, 0.6);
});

test("openAIFidelity: tools → 0.95", () => {
  const f = openAIFidelity(makeReq({ tools: [{ name: "R", description: "d", parameters: {} }] }));
  assert.equal(f, 0.95);
});

test("openAIFidelity: bad temperature → 0.9", () => {
  const f = openAIFidelity(makeReq({ temperature: 5 }));
  assert.equal(f, 0.9);
});

test("openAIFidelity: completely broken → 0", () => {
  const f = openAIFidelity({ model: "", messages: [], stream: false, tools: [{ name: "R", description: "d", parameters: {} }], temperature: 5 } as ChannelRequest);
  assert.equal(f, 0);
});
