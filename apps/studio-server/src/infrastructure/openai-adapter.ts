// V2 OpenAIChannelAdapter (Direction E 2/30, thunderbolt)
// OpenAI-compatible request/response format converter (pure, no I/O)

import {
  type ChannelChunk,
  type ChannelMessage,
  type ChannelRequest,
  type ChannelResponse,
  type ChannelUsage,
  createEmptyUsage,
} from "./channel-adapter.js";

/** OpenAI ChatCompletion request body. */
export interface OpenAIRequestBody {
  model: string;
  messages: Array<{ role: string; content: string; name?: string; tool_call_id?: string; tool_calls?: unknown[] }>;
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }>;
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

/** OpenAI non-streaming response. */
export interface OpenAIResponseBody {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> };
    finish_reason: "stop" | "length" | "tool_calls" | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export function toOpenAIBody(req: ChannelRequest): OpenAIRequestBody {
  const body: OpenAIRequestBody = {
    model: req.model,
    stream: req.stream,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    })),
  };
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.stop && req.stop.length > 0) body.stop = req.stop;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }
  if (req.toolChoice !== undefined) {
    body.tool_choice = req.toolChoice === "auto" || req.toolChoice === "none"
      ? req.toolChoice
      : { type: "function", function: { name: req.toolChoice.name } };
  }
  return body;
}

export function fromOpenAIResponse(body: OpenAIResponseBody, startedAt: number): ChannelResponse {
  const choice = body.choices?.[0];
  const chunks: ChannelChunk[] = [];
  let text = "";
  const toolCalls: Array<{ id: string; name: string; args: string }> = [];
  if (choice) {
    if (choice.message.content) {
      text = choice.message.content;
      chunks.push({ type: "text", text: text });
    }
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({ id: tc.id, name: tc.function.name, args: tc.function.arguments });
        chunks.push({ type: "tool_call", id: tc.id, name: tc.function.name, args: tc.function.arguments });
      }
    }
  }
  const usage: ChannelUsage = body.usage
    ? { promptTokens: body.usage.prompt_tokens, completionTokens: body.usage.completion_tokens, totalTokens: body.usage.total_tokens }
    : createEmptyUsage();
  if (body.usage) chunks.push({ type: "usage", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens });
  if (choice?.finish_reason) chunks.push({ type: "done", finishReason: choice.finish_reason });
  return { ok: true, chunks, text, toolCalls, usage, firstChunkMs: Date.now() - startedAt, totalMs: Date.now() - startedAt };
}

/** Convert a single SSE chunk to a ChannelChunk. */
export function parseOpenAISSEChunk(obj: { choices?: Array<{ delta?: { content?: unknown; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }> }): ChannelChunk[] {
  const out: ChannelChunk[] = [];
  const c0 = obj?.choices?.[0];
  if (!c0) return out;
  if (c0.delta) {
    const content = c0.delta.content;
    if (typeof content === "string" && content.length > 0) out.push({ type: "text", text: content });
    if (Array.isArray(c0.delta.tool_calls)) {
      for (const tc of c0.delta.tool_calls) {
        if (tc.id && tc.function?.name) {
          out.push({ type: "tool_call", id: tc.id, name: tc.function.name, args: tc.function.arguments ?? "" });
        }
      }
    }
  }
  return out;
}

/** Extract URL path for chat completions. */
export function openAIChatCompletionsPath(): string {
  return "chat/completions";
}

/** Build the SSE line from a ChannelChunk (for replay/testing). */
export function toOpenAISSE(chunk: ChannelChunk): string {
  if (chunk.type === "text") {
    return `data: ${JSON.stringify({ choices: [{ delta: { content: chunk.text } }] })}\n\n`;
  }
  if (chunk.type === "tool_call") {
    return `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ id: chunk.id, function: { name: chunk.name, arguments: chunk.args } }] } }] })}\n\n`;
  }
  if (chunk.type === "done") {
    return `data: ${JSON.stringify({ choices: [{ finish_reason: chunk.finishReason }] })}\n\ndata: [DONE]\n\n`;
  }
  return "";
}

/** Master metric: format fidelity 0-1 (how much of ChannelRequest maps cleanly to OpenAI). */
export function openAIFidelity(req: ChannelRequest): number {
  let score = 1.0;
  if (!req.model) score -= 0.5;
  if (!req.messages || req.messages.length === 0) score -= 0.4;
  if (req.tools && req.tools.length > 0) score -= 0.05; // tools require extra mapping
  if (req.temperature !== undefined && (req.temperature < 0 || req.temperature > 2)) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}
