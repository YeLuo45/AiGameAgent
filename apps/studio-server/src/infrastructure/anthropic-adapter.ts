// V3 AnthropicChannelAdapter (Direction E 3/30, thunderbolt)
// Anthropic Messages API format converter (pure, no I/O)

import {
  type ChannelChunk,
  type ChannelMessage,
  type ChannelRequest,
  type ChannelResponse,
  type ChannelUsage,
  createEmptyUsage,
} from "./channel-adapter.js";

export interface AnthropicRequestBody {
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string | Array<unknown> }>;
  system?: string;
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
  tools?: Array<{ name: string; description: string; input_schema: unknown }>;
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
  stream: boolean;
}

export interface AnthropicResponseBody {
  id: string;
  model: string;
  content: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }>;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  usage: { input_tokens: number; output_tokens: number };
}

/** Convert ChannelRequest to Anthropic Messages API body. */
export function toAnthropicBody(req: ChannelRequest, defaultMaxTokens = 4096): AnthropicRequestBody {
  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystem = req.messages.filter((m) => m.role !== "system");
  const body: AnthropicRequestBody = {
    model: req.model,
    messages: nonSystem.map((m) => ({
      role: m.role === "tool" ? "user" : (m.role as "user" | "assistant"),
      content: m.content,
    })),
    max_tokens: req.maxTokens ?? defaultMaxTokens,
    stream: req.stream,
  };
  if (systemMsg) body.system = systemMsg.content;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.stop && req.stop.length > 0) body.stop_sequences = req.stop;
  if (req.tools && req.tools.length > 0) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }
  if (req.toolChoice !== undefined) {
    if (req.toolChoice === "auto") body.tool_choice = { type: "auto" };
    else if (req.toolChoice === "none") body.tool_choice = { type: "auto" }; // Anthropic doesn't have "none", use auto
    else body.tool_choice = { type: "tool", name: req.toolChoice.name };
  }
  return body;
}

export function fromAnthropicResponse(body: AnthropicResponseBody, startedAt: number): ChannelResponse {
  const chunks: ChannelChunk[] = [];
  let text = "";
  const toolCalls: Array<{ id: string; name: string; args: string }> = [];
  for (const block of body.content ?? []) {
    if (block.type === "text") {
      text += block.text;
      chunks.push({ type: "text", text: block.text });
    } else if (block.type === "tool_use") {
      const args = JSON.stringify(block.input);
      toolCalls.push({ id: block.id, name: block.name, args });
      chunks.push({ type: "tool_call", id: block.id, name: block.name, args });
    }
  }
  const usage: ChannelUsage = body.usage
    ? { promptTokens: body.usage.input_tokens, completionTokens: body.usage.output_tokens, totalTokens: body.usage.input_tokens + body.usage.output_tokens }
    : createEmptyUsage();
  if (body.usage) chunks.push({ type: "usage", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens });
  if (body.stop_reason) {
    const fr = body.stop_reason === "end_turn" || body.stop_reason === "stop_sequence" ? "stop"
      : body.stop_reason === "tool_use" ? "tool_calls"
      : body.stop_reason === "max_tokens" ? "length" : "stop";
    chunks.push({ type: "done", finishReason: fr });
  }
  return { ok: true, chunks, text, toolCalls, usage, firstChunkMs: Date.now() - startedAt, totalMs: Date.now() - startedAt };
}

/** Map Anthropic stop_reason to Channel finishReason. */
export function mapAnthropicStopReason(reason: AnthropicResponseBody["stop_reason"]): "stop" | "length" | "tool_calls" | null {
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  if (reason === "tool_use") return "tool_calls";
  return null;
}

/** Extract path for Anthropic messages endpoint. */
export function anthropicMessagesPath(): string {
  return "v1/messages";
}

/** Master metric: Anthropic format fidelity (0-1). */
export function anthropicFidelity(req: ChannelRequest): number {
  let score = 1.0;
  if (!req.model) score -= 0.5;
  if (!req.messages || req.messages.length === 0) score -= 0.4;
  if (req.maxTokens === undefined) score -= 0.05; // Anthropic requires max_tokens
  // Anthropic system goes in body.system, not in messages array
  const hasSystem = req.messages.some((m) => m.role === "system");
  if (hasSystem && req.messages.length === 1) score -= 0.05;
  return Math.max(0, Math.min(1, score));
}
