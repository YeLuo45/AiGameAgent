// V18 ReadTool (Direction B 18/30, generic-agent)
// File read tool with offset + limit

export interface ReadRequest {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadResult {
  ok: boolean;
  content: string;
  size: number;
  truncated: boolean;
  startLine: number;
  endLine: number;
}

export function readFile(req: ReadRequest, allLines: string[]): ReadResult {
  const offset = req.offset ?? 0;
  const limit = req.limit ?? allLines.length;
  const slice = allLines.slice(offset, offset + limit);
  const content = slice.join("\n");
  return {
    ok: true,
    content,
    size: content.length,
    truncated: offset + limit < allLines.length,
    startLine: offset,
    endLine: Math.min(offset + limit, allLines.length) - 1,
  };
}

export function readAll(content: string): ReadResult {
  return { ok: true, content, size: content.length, truncated: false, startLine: 0, endLine: -1 };
}

export function validateReadRequest(req: ReadRequest): { valid: boolean; reason?: string } {
  if (!req.path) return { valid: false, reason: "missing_path" };
  if (req.offset !== undefined && req.offset < 0) return { valid: false, reason: "negative_offset" };
  if (req.limit !== undefined && req.limit <= 0) return { valid: false, reason: "non_positive_limit" };
  return { valid: true };
}
