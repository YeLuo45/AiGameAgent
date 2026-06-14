// V23 BashTool (Direction B 23/30, generic-agent)
// Sandboxed shell command (pure logic, no actual exec)

export interface BashRequest {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface BashResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/** Validate command against allowlist/denylist (no actual exec). */
export interface BashPolicy {
  /** Allowed command prefixes (e.g. ["ls", "cat", "grep"]). */
  allow: string[];
  /** Denied command patterns (e.g. ["rm -rf", "sudo"]). */
  deny: string[];
  /** Max command length. */
  maxLength: number;
}

export const DEFAULT_BASH_POLICY: BashPolicy = {
  allow: ["ls", "cat", "grep", "find", "echo", "pwd", "head", "tail", "wc"],
  deny: ["rm -rf", "sudo", "mkfs", "dd if=", "curl", "wget"],
  maxLength: 500,
};

export function validateBashCommand(command: string, policy: BashPolicy = DEFAULT_BASH_POLICY): { valid: boolean; reason?: string } {
  if (command.length > policy.maxLength) return { valid: false, reason: "too_long" };
  for (const denied of policy.deny) {
    if (command.includes(denied)) return { valid: false, reason: `denied: ${denied}` };
  }
  const firstWord = command.trim().split(/\s+/)[0] ?? "";
  if (!policy.allow.includes(firstWord)) return { valid: false, reason: `not_in_allowlist: ${firstWord}` };
  return { valid: true };
}

/** Simulate a bash execution (for testing). */
export function simulateBash(req: BashRequest, policy: BashPolicy = DEFAULT_BASH_POLICY): BashResult {
  const start = Date.now();
  const v = validateBashCommand(req.command, policy);
  if (!v.valid) {
    return { ok: false, exitCode: 1, stdout: "", stderr: v.reason ?? "denied", durationMs: Date.now() - start, timedOut: false };
  }
  // Simulated outputs
  return { ok: true, exitCode: 0, stdout: `executed: ${req.command}`, stderr: "", durationMs: Date.now() - start, timedOut: false };
}
