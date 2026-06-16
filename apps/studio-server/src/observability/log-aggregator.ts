// V14 LogAggregator (Direction F 14/30, thunderbolt)
// Collect and index log entries for fast querying

import { type LogEntry } from "./structured-log.js";
import { type LogLevel } from "./log-level.js";

export interface LogAggregatorState {
  entries: LogEntry[];
  nextId: number;
  maxEntries: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  byTrace: Record<string, number>;
}

export function createLogAggregator(maxEntries: number = 10000): LogAggregatorState {
  return {
    entries: [], nextId: 1, maxEntries,
    byLevel: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
    bySource: {}, byTrace: {},
  };
}

export function appendLog(state: LogAggregatorState, level: LogLevel, source: string, message: string, fields: Record<string, unknown> = {}, error: string | null = null, traceId: string | null = null): LogAggregatorState {
  const entry: LogEntry = { id: state.nextId, ts: Date.now(), level, source, message, fields, error, traceId };
  const entries = [...state.entries, entry];
  if (entries.length > state.maxEntries) entries.shift();
  return {
    ...state,
    entries,
    nextId: state.nextId + 1,
    byLevel: { ...state.byLevel, [level]: state.byLevel[level] + 1 },
    bySource: { ...state.bySource, [source]: (state.bySource[source] ?? 0) + 1 },
    byTrace: traceId ? { ...state.byTrace, [traceId]: (state.byTrace[traceId] ?? 0) + 1 } : state.byTrace,
  };
}

export function getByLevel(state: LogAggregatorState, level: LogLevel): LogEntry[] {
  return state.entries.filter((e) => e.level === level);
}

export function getBySource(state: LogAggregatorState, source: string): LogEntry[] {
  return state.entries.filter((e) => e.source === source);
}

export function getByTrace(state: LogAggregatorState, traceId: string): LogEntry[] {
  return state.entries.filter((e) => e.traceId === traceId);
}

export function countErrors(state: LogAggregatorState): number {
  return (state.byLevel.error ?? 0) + (state.byLevel.fatal ?? 0);
}

export function clearLogs(state: LogAggregatorState): LogAggregatorState {
  return { ...state, entries: [], byLevel: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }, bySource: {}, byTrace: {} };
}

/** Master metric: log volume health 0-1 (low error rate = healthy). */
export function logHealth(state: LogAggregatorState): number {
  const total = state.entries.length;
  if (total === 0) return 1.0;
  return 1 - (countErrors(state) / total);
}
