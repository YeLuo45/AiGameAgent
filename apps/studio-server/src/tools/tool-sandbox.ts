// V24 ToolSandbox (Direction B 24/30, generic-agent)
// Sandbox wrapper for tool execution (resource limits + path containment)

export interface SandboxConfig {
  /** Max execution time in ms. */
  maxDurationMs: number;
  /** Max memory in bytes. */
  maxMemoryBytes: number;
  /** Allowed paths (prefix match). */
  allowedPaths: string[];
  /** Blocked paths. */
  blockedPaths: string[];
  /** Max output size in bytes. */
  maxOutputBytes: number;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  maxDurationMs: 30_000,
  maxMemoryBytes: 512 * 1024 * 1024,
  allowedPaths: ["/tmp", "/workspace", "/home"],
  blockedPaths: ["/etc", "/root", "/sys", "/proc"],
  maxOutputBytes: 10 * 1024 * 1024,
};

export interface SandboxCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkPath(path: string, config: SandboxConfig): SandboxCheckResult {
  for (const blocked of config.blockedPaths) {
    if (path.startsWith(blocked)) return { allowed: false, reason: `blocked: ${blocked}` };
  }
  for (const allowed of config.allowedPaths) {
    if (path.startsWith(allowed)) return { allowed: true };
  }
  return { allowed: false, reason: "not_in_allowed_paths" };
}

export function checkOutputSize(output: string, config: SandboxConfig): SandboxCheckResult {
  if (output.length > config.maxOutputBytes) return { allowed: false, reason: "output_too_large" };
  return { allowed: true };
}

export function checkDuration(durationMs: number, config: SandboxConfig): SandboxCheckResult {
  if (durationMs > config.maxDurationMs) return { allowed: false, reason: "timeout" };
  return { allowed: true };
}

export function checkMemory(memoryBytes: number, config: SandboxConfig): SandboxCheckResult {
  if (memoryBytes > config.maxMemoryBytes) return { allowed: false, reason: "memory_exceeded" };
  return { allowed: true };
}

/** Master metric: sandbox tightness 0-1 (lower = tighter). */
export function sandboxTightness(config: SandboxConfig): number {
  let score = 0;
  if (config.maxDurationMs < 60_000) score += 0.2;
  if (config.maxMemoryBytes < 1024 * 1024 * 1024) score += 0.2;
  if (config.blockedPaths.length > 0) score += 0.3;
  if (config.allowedPaths.length < 5) score += 0.2;
  if (config.maxOutputBytes < 50 * 1024 * 1024) score += 0.1;
  return Math.min(1, score);
}
