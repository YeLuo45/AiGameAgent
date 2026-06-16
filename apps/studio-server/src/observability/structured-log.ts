// V12 StructuredLog (Direction F 12/30, thunderbolt)
// Key-value log entry (machine-parseable)

import { type LogLevel } from "./log-level.js";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  /** Source component. */
  source: string;
  /** Free-form message. */
  message: string;
  /** Structured fields. */
  fields: Record<string, unknown>;
  /** Error info if any. */
  error: string | null;
  /** Trace context ID. */
  traceId: string | null;
}

export function createEntry(id: number, level: LogLevel, source: string, message: string, fields: Record<string, unknown> = {}, error: string | null = null, traceId: string | null = null, ts: number = Date.now()): LogEntry {
  return { id, ts, level, source, message, fields, error, traceId };
}

export function serialize(entry: LogEntry): string {
  const parts: string[] = [`ts=${entry.ts}`, `level=${entry.level}`, `source=${entry.source}`];
  if (entry.traceId) parts.push(`trace=${entry.traceId}`);
  if (entry.error) parts.push(`error=${entry.error}`);
  for (const [k, v] of Object.entries(entry.fields)) {
    parts.push(`${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  }
  parts.push(`msg="${entry.message}"`);
  return parts.join(" ");
}

export function deserialize(line: string): LogEntry | null {
  const m = line.match(/ts=(\d+)\s+level=(\w+)\s+source=(\S+)/);
  if (!m) return null;
  const ts = parseInt(m[1], 10);
  const level = m[2] as LogLevel;
  const source = m[3];
  // Best effort: extract msg="..."
  const msgMatch = line.match(/msg="([^"]*)"/);
  const message = msgMatch ? msgMatch[1] : "";
  return createEntry(0, level, source, message, {}, null, null, ts);
}

/** Master metric: structure quality 0-1 (% entries with fields). */
export function structureQuality(entries: LogEntry[]): number {
  if (entries.length === 0) return 1.0;
  return entries.filter((e) => Object.keys(e.fields).length > 0).length / entries.length;
}
