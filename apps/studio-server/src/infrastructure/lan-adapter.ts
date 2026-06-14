// V5 LANChannelAdapter (Direction E 5/30, thunderbolt)
// Generic LAN adapter (vLLM, LM Studio, llama.cpp, etc.) - similar to OpenAI but with discovery

import { type ChannelCapability, type ChannelType, type ChannelRequest, type ChannelResponse, type ChannelUsage, createEmptyUsage } from "./channel-adapter.js";
import { toOpenAIBody, fromOpenAIResponse, type OpenAIRequestBody, type OpenAIResponseBody } from "./openai-adapter.js";

export type LANProviderKind = "vllm" | "lmstudio" | "llamacpp" | "text-generation-webui" | "unknown";

/** Probe a LAN endpoint to identify the provider kind. */
export function detectLANKind(baseUrl: string, modelsResponseBody: unknown): LANProviderKind {
  if (!baseUrl || typeof baseUrl !== "string") return "unknown";
  if (typeof modelsResponseBody === "object" && modelsResponseBody !== null) {
    const obj = modelsResponseBody as { data?: unknown; object?: unknown };
    if (Array.isArray(obj.data)) {
      const first = obj.data[0] as { id?: string; owned_by?: string } | undefined;
      if (first?.owned_by === "vllm" || (typeof first?.id === "string" && first.id.includes("vllm"))) return "vllm";
      if (first?.owned_by === "lmstudio" || (typeof first?.id === "string" && first.id.includes("lmstudio"))) return "lmstudio";
    }
  }
  if (baseUrl.includes("vllm")) return "vllm";
  if (baseUrl.includes("lmstudio") || baseUrl.includes("1234")) return "lmstudio";
  if (baseUrl.includes("llama") || baseUrl.includes("8080")) return "llamacpp";
  if (baseUrl.includes("7860") || baseUrl.includes("text-generation")) return "text-generation-webui";
  return "unknown";
}

/** Pick the right chat path for a LAN provider. */
export function lanChatPath(kind: LANProviderKind): string {
  // Most LAN servers are OpenAI-compatible and use /v1/chat/completions
  if (kind === "vllm" || kind === "lmstudio" || kind === "unknown") return "v1/chat/completions";
  if (kind === "llamacpp") return "v1/chat/completions";
  if (kind === "text-generation-webui") return "v1/chat/completions";
  return "v1/chat/completions";
}

/** Convert ChannelRequest to LAN-flavored OpenAI body. */
export function toLANBody(req: ChannelRequest): OpenAIRequestBody {
  return toOpenAIBody(req);
}

/** Convert LAN response (OpenAI-compatible) to ChannelResponse. */
export function fromLANResponse(body: OpenAIResponseBody, startedAt: number): ChannelResponse {
  return fromOpenAIResponse(body, startedAt);
}

/** Estimate LAN latency from RTT probe. */
export function estimateLANLatency(rttMs: number, modelSize: "tiny" | "small" | "medium" | "large"): number {
  const base = { tiny: 50, small: 200, medium: 500, large: 1500 }[modelSize];
  return Math.round(rttMs + base);
}

/** Determine if URL is a local/private network address. */
export function isLANHost(baseUrl: string): boolean {
  if (!baseUrl) return false;
  try {
    const u = new URL(baseUrl);
    const h = u.hostname;
    if (h === "127.0.0.1" || h === "localhost" || h === "::1") return true;
    if (h.startsWith("192.168.")) return true;
    if (h.startsWith("10.")) return true;
    if (h.startsWith("172.")) {
      const second = parseInt(h.split(".")[1] ?? "0", 10);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Master metric: LAN readiness 0-1. */
export function lanReadiness(rttMs: number, modelSize: "tiny" | "small" | "medium" | "large", isReachable: boolean): number {
  if (!isReachable) return 0;
  let score = 0.6;
  if (rttMs < 10) score += 0.3;
  else if (rttMs < 50) score += 0.2;
  else if (rttMs < 200) score += 0.1;
  const sizePenalty = { tiny: 0, small: 0, medium: -0.05, large: -0.1 }[modelSize];
  score += sizePenalty;
  return Math.max(0, Math.min(1, score));
}

export const LAN_CAPABILITIES: ChannelCapability[] = ["text"];
export const LAN_TYPE: ChannelType = "lan";
