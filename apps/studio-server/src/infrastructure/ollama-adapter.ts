// V4 OllamaChannelAdapter (Direction E 4/30, thunderbolt)
// Ollama-specific request/response (uses OpenAI-compatible endpoint + native /api/chat)

import { type ChannelChunk, type ChannelRequest, type ChannelResponse, type ChannelUsage, createEmptyUsage } from "./channel-adapter.js";

export interface OllamaRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  options?: { num_predict?: number; temperature?: number; stop?: string[] };
}

export interface OllamaResponseBody {
  model: string;
  message: { role: "assistant"; content: string };
  done: boolean;
  done_reason?: "stop" | "length" | "load";
  total_duration?: number; // ns
  load_duration?: number; // ns
  prompt_eval_count?: number;
  eval_count?: number;
}

export function toOllamaBody(req: ChannelRequest): OllamaRequestBody {
  const body: OllamaRequestBody = {
    model: req.model,
    stream: req.stream,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  const options: { num_predict?: number; temperature?: number; stop?: string[] } = {};
  if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
  if (req.temperature !== undefined) options.temperature = req.temperature;
  if (req.stop && req.stop.length > 0) options.stop = req.stop;
  if (Object.keys(options).length > 0) body.options = options;
  return body;
}

export function fromOllamaResponse(body: OllamaResponseBody, startedAt: number): ChannelResponse {
  const chunks: ChannelChunk[] = [];
  let text = "";
  if (body.message?.content) {
    text = body.message.content;
    chunks.push({ type: "text", text });
  }
  const usage: ChannelUsage = body.prompt_eval_count !== undefined || body.eval_count !== undefined
    ? { promptTokens: body.prompt_eval_count ?? 0, completionTokens: body.eval_count ?? 0, totalTokens: (body.prompt_eval_count ?? 0) + (body.eval_count ?? 0) }
    : createEmptyUsage();
  if (body.prompt_eval_count !== undefined) chunks.push({ type: "usage", promptTokens: usage.promptTokens, completionTokens: usage.completionTokens });
  if (body.done) {
    const fr = body.done_reason === "load" ? "stop" : body.done_reason === "length" ? "length" : "stop";
    chunks.push({ type: "done", finishReason: fr });
  }
  return { ok: true, chunks, text, toolCalls: [], usage, firstChunkMs: Date.now() - startedAt, totalMs: Date.now() - startedAt };
}

/** Convert nanoseconds to milliseconds. */
export function nsToMs(ns: number | undefined): number | null {
  if (ns === undefined) return null;
  return Math.round(ns / 1_000_000);
}

/** Parse an Ollama streaming JSON line to a ChannelChunk. */
export function parseOllamaStreamLine(json: string): ChannelChunk[] {
  try {
    const obj = JSON.parse(json) as Partial<OllamaResponseBody>;
    if (obj.message?.content) return [{ type: "text", text: obj.message.content }];
    if (obj.done) {
      const fr = obj.done_reason === "length" ? "length" : "stop";
      return [{ type: "done", finishReason: fr }];
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

/** Path for Ollama's native chat endpoint. */
export function ollamaChatPath(): string {
  return "api/chat";
}

/** Master metric: Ollama readiness 0-1. */
export function ollamaReadiness(loadDurationNs: number | undefined, evalCount: number | undefined): number {
  let score = 0.7; // base for local model
  const loadMs = nsToMs(loadDurationNs);
  if (loadMs === null) score -= 0.2;
  else if (loadMs < 500) score += 0.2;
  else if (loadMs > 5000) score -= 0.1;
  if (evalCount !== undefined && evalCount > 0) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
