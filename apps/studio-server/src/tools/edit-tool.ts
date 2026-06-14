// V20 EditTool (Direction B 20/30, generic-agent)
// File edit tool with find/replace

export type EditMode = "replace-first" | "replace-all" | "insert-after" | "insert-before";

export interface EditRequest {
  path: string;
  find: string;
  replace: string;
  mode: EditMode;
}

export interface EditResult {
  ok: boolean;
  replacements: number;
  newContent: string;
  modified: boolean;
}

export function editFile(req: EditRequest, currentContent: string): EditResult {
  switch (req.mode) {
    case "replace-first": {
      const idx = currentContent.indexOf(req.find);
      if (idx < 0) return { ok: false, replacements: 0, newContent: currentContent, modified: false };
      const newContent = currentContent.slice(0, idx) + req.replace + currentContent.slice(idx + req.find.length);
      return { ok: true, replacements: 1, newContent, modified: true };
    }
    case "replace-all": {
      if (!currentContent.includes(req.find)) return { ok: false, replacements: 0, newContent: currentContent, modified: false };
      const parts = currentContent.split(req.find);
      const replacements = parts.length - 1;
      return { ok: true, replacements, newContent: parts.join(req.replace), modified: true };
    }
    case "insert-after": {
      const idx = currentContent.indexOf(req.find);
      if (idx < 0) return { ok: false, replacements: 0, newContent: currentContent, modified: false };
      const insertAt = idx + req.find.length;
      return { ok: true, replacements: 1, newContent: currentContent.slice(0, insertAt) + req.replace + currentContent.slice(insertAt), modified: true };
    }
    case "insert-before": {
      const idx = currentContent.indexOf(req.find);
      if (idx < 0) return { ok: false, replacements: 0, newContent: currentContent, modified: false };
      return { ok: true, replacements: 1, newContent: currentContent.slice(0, idx) + req.replace + currentContent.slice(idx), modified: true };
    }
  }
}

export function validateEditRequest(req: EditRequest): { valid: boolean; reason?: string } {
  if (!req.path) return { valid: false, reason: "missing_path" };
  if (!req.find) return { valid: false, reason: "missing_find" };
  return { valid: true };
}
