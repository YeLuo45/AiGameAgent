// V19 QuotaTracker (Direction E 19/30, ruflo)
// Per-provider token quota + budget tracker

export interface QuotaState {
  providerId: string;
  /** Daily token limit. */
  dailyLimit: number;
  /** Tokens used today. */
  usedToday: number;
  /** When the current daily window started (ms). */
  windowStartedAt: number;
  /** Cumulative tokens over all time. */
  totalUsed: number;
  /** Total over-limit events. */
  totalOverLimit: number;
}

export function createQuota(providerId: string, dailyLimit: number): QuotaState {
  return { providerId, dailyLimit, usedToday: 0, windowStartedAt: Date.now(), totalUsed: 0, totalOverLimit: 0 };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function maybeResetWindow(state: QuotaState, now: number): QuotaState {
  if (now - state.windowStartedAt >= DAY_MS) {
    return { ...state, usedToday: 0, windowStartedAt: now };
  }
  return state;
}

/** Try to consume N tokens. Returns updated state + ok flag. */
export function tryConsume(state: QuotaState, tokens: number, now: number = Date.now()): { state: QuotaState; ok: boolean; remaining: number } {
  const reset = maybeResetWindow(state, now);
  const projected = reset.usedToday + tokens;
  if (projected > reset.dailyLimit) {
    return { state: { ...reset, totalOverLimit: reset.totalOverLimit + 1 }, ok: false, remaining: reset.dailyLimit - reset.usedToday };
  }
  return { state: { ...reset, usedToday: projected, totalUsed: reset.totalUsed + tokens }, ok: true, remaining: reset.dailyLimit - projected };
}

/** Remaining quota (may be negative if over-consumed somehow). */
export function remaining(state: QuotaState, now: number = Date.now()): number {
  return maybeResetWindow(state, now).dailyLimit - maybeResetWindow(state, now).usedToday;
}

/** Time (ms) until next window reset. */
export function msUntilReset(state: QuotaState, now: number = Date.now()): number {
  return Math.max(0, DAY_MS - (now - state.windowStartedAt));
}

/** Reset quota immediately. */
export function resetQuota(state: QuotaState, now: number = Date.now()): QuotaState {
  return { ...state, usedToday: 0, windowStartedAt: now };
}

/** Usage ratio (0-1) for current window. */
export function usageRatio(state: QuotaState, now: number = Date.now()): number {
  const s = maybeResetWindow(state, now);
  if (s.dailyLimit === 0) return 0;
  return Math.min(1, s.usedToday / s.dailyLimit);
}

/** Master metric: quota headroom 0-1 (1 = full headroom). */
export function quotaHeadroom(state: QuotaState): number {
  return Math.max(0, Math.min(1, 1 - usageRatio(state)));
}
