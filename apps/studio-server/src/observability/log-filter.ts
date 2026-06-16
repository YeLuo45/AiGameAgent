// V13 LogFilter (Direction F 13/30, thunderbolt)
// Filter log entries by level, source, message pattern

import { type LogEntry } from "./structured-log.js";
import { type LogLevel, levelAtLeast, isValidLevel } from "./log-level.js";

export interface LogFilterCriteria {
  minLevel?: LogLevel;
  maxLevel?: LogLevel;
  sources?: string[];
  /** Message substring match (case-insensitive). */
  messagePattern?: string;
  /** Field key=value match. */
  fieldMatches?: Record<string, unknown>;
  traceId?: string;
  /** If true, only error entries. */
  errorsOnly?: boolean;
}

export function matchesFilter(entry: LogEntry, criteria: LogFilterCriteria): boolean {
  if (criteria.minLevel && !levelAtLeast(entry.level, criteria.minLevel)) return false;
  if (criteria.maxLevel && levelAtLeast(criteria.maxLevel, entry.level) && entry.level !== criteria.maxLevel) return false;
  if (criteria.sources && criteria.sources.length > 0 && !criteria.sources.includes(entry.source)) return false;
  if (criteria.messagePattern) {
    const pat = criteria.messagePattern.toLowerCase();
    if (!entry.message.toLowerCase().includes(pat)) return false;
  }
  if (criteria.fieldMatches) {
    for (const [k, v] of Object.entries(criteria.fieldMatches)) {
      if (entry.fields[k] !== v) return false;
    }
  }
  if (criteria.traceId && entry.traceId !== criteria.traceId) return false;
  if (criteria.errorsOnly && !entry.error) return false;
  return true;
}

export function filterLogs(entries: LogEntry[], criteria: LogFilterCriteria): LogEntry[] {
  return entries.filter((e) => matchesFilter(e, criteria));
}

export function parseFilterSpec(spec: string): LogFilterCriteria {
  const criteria: LogFilterCriteria = {};
  const parts = spec.split(/\s+/);
  for (const p of parts) {
    if (p.startsWith("level=")) {
      const l = p.slice(6);
      if (isValidLevel(l)) criteria.minLevel = l as LogLevel;
    } else if (p.startsWith("source=")) {
      criteria.sources = p.slice(7).split(",");
    } else if (p.startsWith("trace=")) {
      criteria.traceId = p.slice(6);
    } else if (p === "errors") {
      criteria.errorsOnly = true;
    } else if (p.startsWith("msg=")) {
      criteria.messagePattern = p.slice(4);
    }
  }
  return criteria;
}

/** Master metric: filter specificity 0-1. */
export function filterSpecificity(criteria: LogFilterCriteria): number {
  let score = 0;
  if (criteria.minLevel) score += 0.2;
  if (criteria.sources) score += 0.2;
  if (criteria.messagePattern) score += 0.3;
  if (criteria.fieldMatches) score += 0.2;
  if (criteria.traceId) score += 0.2;
  if (criteria.errorsOnly) score += 0.1;
  return Math.min(1, score);
}
