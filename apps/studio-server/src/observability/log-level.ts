// V11 LogLevel (Direction F 11/30, thunderbolt)
// Log level enum + comparison

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10, info: 20, warn: 30, error: 40, fatal: 50,
};

export function levelRank(level: LogLevel): number {
  return LEVEL_RANK[level];
}

export function levelAtLeast(level: LogLevel, min: LogLevel): boolean {
  return levelRank(level) >= levelRank(min);
}

export function parseLevel(s: string): LogLevel | null {
  const lc = s.toLowerCase().trim();
  if (lc === "debug" || lc === "info" || lc === "warn" || lc === "error" || lc === "fatal") return lc;
  return null;
}

export function isValidLevel(s: string): boolean {
  return parseLevel(s) !== null;
}

/** Master metric: level distribution 0-1 (most common level). */
export function levelDistribution(levels: LogLevel[]): number {
  if (levels.length === 0) return 1.0;
  const counts: Record<string, number> = {};
  for (const l of levels) counts[l] = (counts[l] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  return max / levels.length;
}
