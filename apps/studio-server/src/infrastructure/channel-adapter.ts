// V1 ChannelAdapter (Direction E 1/30, thunderbolt)
// Base protocol + types for multi-provider LLM channel abstraction
// Replaces the inline `getProviders()` in apps/studio-server/src/index.ts

export type ChannelType = "openai" | "anthropic" | "ollama" | "lan" | "cloud";

export type ChannelCapability = "text" | "image" | "music" | "tools";

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChannelMessage {
  role: Role;
  content: string;
  /** For tool messages, the tool_call_id this responds to. */
  toolCallId?: string;
  /** For assistant messages with tool calls. */
  toolCalls?: Array<{ id: string; name: string; args: string }>;
}

export interface ChannelRequest {
  model: string;
  messages: ChannelMessage[];
  stream: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Stop sequences */
  stop?: string[];
  /** Tool definitions (OpenAI format) */
  tools?: Array<{ name: string; description: string; parameters: unknown }>;
  /** Tool choice: "auto" | "none" | { name: string } */
  toolChoice?: "auto" | "none" | { name: string };
  /** Per-request timeout in ms */
  timeoutMs?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

export type ChannelChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: string }
  | { type: "usage"; promptTokens: number; completionTokens: number }
  | { type: "done"; finishReason: "stop" | "length" | "tool_calls" | "error" }
  | { type: "error"; message: string; code?: string };

export interface ChannelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChannelResponse {
  ok: boolean;
  /** Streaming chunks (empty if non-streaming). */
  chunks: ChannelChunk[];
  /** Aggregated text (for non-streaming callers). */
  text: string;
  /** Aggregated tool calls. */
  toolCalls: Array<{ id: string; name: string; args: string }>;
  /** Usage stats. */
  usage: ChannelUsage;
  /** Time to first chunk in ms. */
  firstChunkMs: number | null;
  /** Total elapsed in ms. */
  totalMs: number;
  /** Error if ok === false. */
  error?: { message: string; code?: string };
}

export interface ChannelHealth {
  ok: boolean;
  firstChunkMs: number | null;
  model: string;
  error?: string;
}

export interface ChannelAdapter {
  readonly id: string;
  readonly type: ChannelType;
  readonly capabilities: ChannelCapability[];
  readonly baseUrl: string;
  readonly defaultModel: string;
  /** Send a request; may stream or return single response. */
  chat(req: ChannelRequest): Promise<ChannelResponse>;
  /** Lightweight health check (small chat completion). */
  health(): Promise<ChannelHealth>;
  /** Release resources. */
  close(): Promise<void>;
}

// ---------- Helpers (pure functions for testability) ----------

export function createEmptyUsage(): ChannelUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function aggregateChunks(chunks: ChannelChunk[]): {
  text: string;
  toolCalls: Array<{ id: string; name: string; args: string }>;
  usage: ChannelUsage;
  finishReason: "stop" | "length" | "tool_calls" | "error" | null;
  error: string | null;
} {
  let text = "";
  const toolCalls: Array<{ id: string; name: string; args: string }> = [];
  let usage = createEmptyUsage();
  let finishReason: "stop" | "length" | "tool_calls" | "error" | null = null;
  let error: string | null = null;
  for (const c of chunks) {
    if (c.type === "text") text += c.text;
    else if (c.type === "tool_call") toolCalls.push({ id: c.id, name: c.name, args: c.args });
    else if (c.type === "usage") {
      usage = { promptTokens: c.promptTokens, completionTokens: c.completionTokens, totalTokens: c.promptTokens + c.completionTokens };
    } else if (c.type === "done") finishReason = c.finishReason;
    else if (c.type === "error") {
      error = c.message;
      if (!finishReason) finishReason = "error";
    }
  }
  return { text, toolCalls, usage, finishReason, error };
}

export function hasCapability(adapter: ChannelAdapter, cap: ChannelCapability): boolean {
  return adapter.capabilities.includes(cap);
}

export function supportsTools(adapter: ChannelAdapter): boolean {
  return hasCapability(adapter, "tools");
}

/** Estimate token count from text (rough: 4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.max(0, Math.floor(text.length / 4));
}

/** Master metric: composite score 0-1 reflecting adapter readiness. */
export function adapterReadiness(adapter: ChannelAdapter, health: ChannelHealth | null): number {
  let score = 0.5;
  if (health) {
    if (health.ok) score += 0.3;
    if (health.firstChunkMs !== null && health.firstChunkMs < 1500) score += 0.2;
  }
  if (adapter.capabilities.length > 0) score += Math.min(0.1, adapter.capabilities.length * 0.025);
  return Math.max(0, Math.min(1, score));
}
