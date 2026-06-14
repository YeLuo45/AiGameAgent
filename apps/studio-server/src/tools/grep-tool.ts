// V22 GrepTool (Direction B 22/30, generic-agent)
// Content search across files

export interface GrepRequest {
  pattern: string;
  /** Case insensitive. */
  caseInsensitive?: boolean;
  /** Regex mode. */
  regex?: boolean;
  /** Max matches. */
  maxResults?: number;
  /** Show line numbers. */
  showLineNumbers?: boolean;
}

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface GrepResult {
  matches: GrepMatch[];
  truncated: boolean;
  totalMatches: number;
}

function buildMatcher(pattern: string, caseInsensitive: boolean, regex: boolean): (line: string) => boolean {
  if (regex) {
    const flags = caseInsensitive ? "i" : "";
    const re = new RegExp(pattern, flags);
    return (line: string) => re.test(line);
  }
  const needle = caseInsensitive ? pattern.toLowerCase() : pattern;
  return (line: string) => {
    const hay = caseInsensitive ? line.toLowerCase() : line;
    return hay.includes(needle);
  };
}

export function grep(req: GrepRequest, fileContents: Record<string, string[]>): GrepResult {
  const match = buildMatcher(req.pattern, req.caseInsensitive ?? false, req.regex ?? false);
  const max = req.maxResults ?? 1000;
  const matches: GrepMatch[] = [];
  let total = 0;
  for (const [file, lines] of Object.entries(fileContents)) {
    for (let i = 0; i < lines.length; i++) {
      if (match(lines[i])) {
        total++;
        if (matches.length < max) {
          matches.push({ file, line: req.showLineNumbers ? i + 1 : i, text: lines[i] });
        }
      }
    }
  }
  return { matches, truncated: total > max, totalMatches: total };
}
