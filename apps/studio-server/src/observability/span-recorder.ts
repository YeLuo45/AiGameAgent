// V2 SpanRecorder (Direction F 2/30, thunderbolt)
// Per-span timing recording (start/end + events)

import { type TraceContext } from "./tracing-context.js";

export type SpanStatus = "running" | "ok" | "error" | "cancelled";

export interface SpanEvent {
  ts: number;
  name: string;
  attributes: Record<string, string>;
}

export interface SpanRecord {
  ctx: TraceContext;
  status: SpanStatus;
  endTs: number | null;
  events: SpanEvent[];
  error: string | null;
}

export interface SpanRecorderState {
  spans: Record<string, SpanRecord>;
}

export function createSpanRecorder(): SpanRecorderState {
  return { spans: {} };
}

export function startSpan(state: SpanRecorderState, ctx: TraceContext): SpanRecorderState {
  const rec: SpanRecord = { ctx, status: "running", endTs: null, events: [], error: null };
  return { ...state, spans: { ...state.spans, [ctx.spanId]: rec } };
}

export function endSpan(state: SpanRecorderState, spanId: string, status: SpanStatus = "ok", error: string | null = null, now: number = Date.now()): SpanRecorderState {
  const cur = state.spans[spanId];
  if (!cur) return state;
  return { ...state, spans: { ...state.spans, [spanId]: { ...cur, status, endTs: now, error } } };
}

export function addEvent(state: SpanRecorderState, spanId: string, name: string, attributes: Record<string, string> = {}, now: number = Date.now()): SpanRecorderState {
  const cur = state.spans[spanId];
  if (!cur) return state;
  return { ...state, spans: { ...state.spans, [spanId]: { ...cur, events: [...cur.events, { ts: now, name, attributes }] } } };
}

export function getSpan(state: SpanRecorderState, spanId: string): SpanRecord | undefined {
  return state.spans[spanId];
}

export function listSpans(state: SpanRecorderState, status?: SpanStatus): SpanRecord[] {
  let arr = Object.values(state.spans);
  if (status) arr = arr.filter((s) => s.status === status);
  return arr.sort((a, b) => a.ctx.startTs - b.ctx.startTs);
}

export function spanDurationMs(rec: SpanRecord, now: number = Date.now()): number {
  return (rec.endTs ?? now) - rec.ctx.startTs;
}

/** Master metric: success rate of ended spans 0-1. */
export function spanSuccessRate(state: SpanRecorderState): number {
  const ended = Object.values(state.spans).filter((s) => s.endTs !== null);
  if (ended.length === 0) return 1.0;
  return ended.filter((s) => s.status === "ok").length / ended.length;
}
