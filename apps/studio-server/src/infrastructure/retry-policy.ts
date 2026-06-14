// V8 RetryPolicy (Direction E 8/30, thunderbolt)
// Exponential backoff with jitter for retryable LLM failures

export type RetryDecision = "retry" | "give-up";

export interface RetryPolicyConfig {
  /** Max attempts (including the first). */
  maxAttempts: number;
  /** Base delay in ms. */
  baseDelayMs: number;
  /** Cap delay at this many ms. */
  maxDelayMs: number;
  /** Multiplier per attempt (e.g. 2 for doubling). */
  multiplier: number;
  /** Add ±jitterMs random jitter (0 = no jitter). */
  jitterMs: number;
  /** HTTP status codes that are retryable. */
  retryableStatuses: number[];
  /** Error codes that are retryable. */
  retryableCodes: string[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitterMs: 200,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
  retryableCodes: ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "upstream_timeout"],
};

export interface RetryAttempt {
  attempt: number;
  delayMs: number;
  reason: string;
  /** Cumulative delay so far. */
  cumulativeMs: number;
}

/** Compute the next delay for a given attempt number (1-indexed). */
export function computeDelay(config: RetryPolicyConfig, attempt: number, rand: () => number = Math.random): number {
  if (attempt < 1) return 0;
  const exp = Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(config.multiplier, attempt - 1));
  const jitter = config.jitterMs > 0 ? (rand() * 2 - 1) * config.jitterMs : 0;
  return Math.max(0, Math.round(exp + jitter));
}

/** Decide whether to retry. */
export function shouldRetry(
  config: RetryPolicyConfig,
  attempt: number,
  error: { status?: number; code?: string; message?: string } | null,
): RetryDecision {
  if (attempt >= config.maxAttempts) return "give-up";
  if (!error) return "retry";
  if (error.status !== undefined && config.retryableStatuses.includes(error.status)) return "retry";
  if (error.code && config.retryableCodes.includes(error.code)) return "retry";
  // 4xx other than the retryable set → give up (e.g. 401, 403, 400)
  if (error.status !== undefined && error.status >= 400 && error.status < 500) return "give-up";
  return "retry";
}

/** Build a sequence of retry attempts (for precomputation/UI). */
export function buildRetrySequence(
  config: RetryPolicyConfig,
  errors: Array<{ status?: number; code?: string; message?: string } | null>,
  rand: () => number = Math.random,
): RetryAttempt[] {
  const out: RetryAttempt[] = [];
  let cumulative = 0;
  for (let i = 0; i < errors.length; i++) {
    const attempt = i + 1;
    const decision = shouldRetry(config, attempt, errors[i]);
    if (decision === "give-up") break;
    const delay = computeDelay(config, attempt, rand);
    cumulative += delay;
    out.push({ attempt, delayMs: delay, reason: errors[i]?.code ?? `status_${errors[i]?.status}` ?? "unknown", cumulativeMs: cumulative });
  }
  return out;
}

/** Master metric: resilience score 0-1 (high = more retries available, more codes covered). */
export function resilienceScore(config: RetryPolicyConfig): number {
  let score = 0;
  score += Math.min(0.3, config.maxAttempts * 0.05);
  score += Math.min(0.2, config.retryableStatuses.length * 0.025);
  score += Math.min(0.2, config.retryableCodes.length * 0.05);
  if (config.maxDelayMs >= 10_000) score += 0.15;
  if (config.multiplier >= 2) score += 0.1;
  if (config.jitterMs > 0) score += 0.05;
  return Math.max(0, Math.min(1, score));
}
