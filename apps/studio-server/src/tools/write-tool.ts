// V19 WriteTool (Direction B 19/30, generic-agent)
// File write tool with create/append/overwrite modes

export type WriteMode = "create" | "overwrite" | "append";

export interface WriteRequest {
  path: string;
  content: string;
  mode: WriteMode;
}

export interface WriteResult {
  ok: boolean;
  bytesWritten: number;
  totalSize: number;
  created: boolean;
}

export function writeFile(req: WriteRequest, existingContent: string | null): WriteResult {
  let newContent: string;
  let created: boolean;
  switch (req.mode) {
    case "create":
      if (existingContent !== null) return { ok: false, bytesWritten: 0, totalSize: existingContent.length, created: false };
      newContent = req.content;
      created = true;
      break;
    case "append":
      newContent = (existingContent ?? "") + req.content;
      created = existingContent === null;
      break;
    case "overwrite":
      newContent = req.content;
      created = existingContent === null;
      break;
  }
  return { ok: true, bytesWritten: req.content.length, totalSize: newContent.length, created };
}

export function validateWriteRequest(req: WriteRequest): { valid: boolean; reason?: string } {
  if (!req.path) return { valid: false, reason: "missing_path" };
  if (req.content === undefined) return { valid: false, reason: "missing_content" };
  return { valid: true };
}
