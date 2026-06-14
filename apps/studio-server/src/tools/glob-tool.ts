// V21 GlobTool (Direction B 21/30, generic-agent)
// File pattern matching

export interface GlobRequest {
  pattern: string;
  /** Directory to search in. */
  root?: string;
  /** Include hidden files. */
  includeHidden?: boolean;
  /** Max results. */
  maxResults?: number;
}

export interface GlobResult {
  matches: string[];
  truncated: boolean;
  totalMatches: number;
}

function matchPattern(pattern: string, name: string): boolean {
  if (pattern === "*") return true;
  if (pattern === name) return true;
  // Convert glob to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  const re = new RegExp(`^${regexStr}$`);
  return re.test(name);
}

export function glob(req: GlobRequest, fileNames: string[]): GlobResult {
  const hidden = req.includeHidden ?? false;
  const max = req.maxResults ?? 1000;
  const matches = fileNames.filter((f) => {
    if (!hidden && f.startsWith(".")) return false;
    const baseName = f.split("/").pop() ?? f;
    return matchPattern(req.pattern, baseName);
  });
  const total = matches.length;
  return {
    matches: matches.slice(0, max),
    truncated: total > max,
    totalMatches: total,
  };
}

/** Convert glob pattern to regex (for external use). */
export function globToRegex(pattern: string): RegExp {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`);
}
