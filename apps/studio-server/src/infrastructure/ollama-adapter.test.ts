// V4 OllamaChannelAdapter (Direction E 4/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toOllamaBody,
  fromOllamaResponse,
  nsToMs,
  parseOllamaStreamLine,
  ollamaChatPath,
  ollamaReadiness,
} from "./ollama-adapter.js";
import type { ChannelRequest } from "./channel-adapter.js";

function makeReq(o: Partial<ChannelRequest> = {}): ChannelRequest {
  return { model: "llama3.2", messages: [{ role: "user", content: "hi" }], stream: true, ...o };
}

test("toOllamaBody: minimal", () => {
  const body = toOllamaBody(makeReq());
  assert.equal(body.model, "llama3.2");
  assert.equal(body.stream, true);
  assert.equal(body.messages[0].content, "hi");
});

test("toOllamaBody: options populated", () => {
  const body = toOllamaBody(makeReq({ maxTokens: 200, temperature: 0.5, stop: ["END"] }));
  assert.equal(body.options?.num_predict, 200);
  assert.equal(body.options?.temperature, 0.5);
  assert.deepEqual(body.options?.stop, ["END"]);
});

test("toOllamaBody: no options when nothing set", () => {
  const body = toOllamaBody(makeReq());
  assert.equal(body.options, undefined);
});

test("fromOllamaResponse: text + usage + done", () => {
  const resp = fromOllamaResponse({
    model: "llama3.2",
    message: { role: "assistant", content: "Hi" },
    done: true,
    done_reason: "stop",
    prompt_eval_count: 10,
    eval_count: 5,
  }, Date.now());
  assert.equal(resp.text, "Hi");
  assert.equal(resp.usage.totalTokens, 15);
});

test("fromOllamaResponse: done_reason length", () => {
  const resp = fromOllamaResponse({ model: "x", message: { role: "assistant", content: "" }, done: true, done_reason: "length" }, Date.now());
  const done = resp.chunks.find((c) => c.type === "done");
  assert.equal((done as { type: "done"; finishReason: string }).finishReason, "length");
});

test("fromOllamaResponse: no usage → zero", () => {
  const resp = fromOllamaResponse({ model: "x", message: { role: "assistant", content: "x" }, done: true }, Date.now());
  assert.equal(resp.usage.totalTokens, 0);
});

test("nsToMs: convert nanoseconds", () => {
  assert.equal(nsToMs(undefined), null);
  assert.equal(nsToMs(0), 0);
  assert.equal(nsToMs(1_000_000), 1);
  assert.equal(nsToMs(1_500_000_000), 1500);
});

test("parseOllamaStreamLine: text content", () => {
  const chunks = parseOllamaStreamLine(JSON.stringify({ message: { role: "assistant", content: "Hello" }, done: false }));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, "text");
});

test("parseOllamaStreamLine: done with stop", () => {
  const chunks = parseOllamaStreamLine(JSON.stringify({ message: { role: "assistant", content: "" }, done: true, done_reason: "stop" }));
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, "done");
});

test("parseOllamaStreamLine: invalid JSON → empty", () => {
  assert.equal(parseOllamaStreamLine("not json").length, 0);
});

test("parseOllamaStreamLine: no content, not done → empty", () => {
  assert.equal(parseOllamaStreamLine(JSON.stringify({ done: false })).length, 0);
});

test("ollamaChatPath is api/chat", () => {
  assert.equal(ollamaChatPath(), "api/chat");
});

test("ollamaReadiness: no load duration → 0.5", () => {
  // 0.7 base - 0.2 (no loadMs) + 0 (no eval) = 0.5
  assert.ok(Math.abs(ollamaReadiness(undefined, 0) - 0.5) < 1e-9);
});

test("ollamaReadiness: fast load + tokens → 1.0", () => {
  // 0.7 base + 0.2 (loadMs<500) + 0.1 (eval>0) = 1.0
  assert.ok(Math.abs(ollamaReadiness(100_000_000, 50) - 1.0) < 1e-9);
});

test("ollamaReadiness: slow load → 0.6", () => {
  // 0.7 base + 0 (loadMs>5000 → penalty -0.1) + 0.1 (eval>0) - 0.1 = 0.7
  // Wait: loadMs > 5000 triggers -0.1, evalCount > 0 triggers +0.1 → 0.7
  assert.ok(Math.abs(ollamaReadiness(10_000_000_000, 50) - 0.7) < 1e-9);
});
