// V30 ToolMasterOrchestrator (Direction B 30/30, orchestrator)
// Master orchestrator: integrates all 29 engines + tool-specific mastery score

import { type ToolRegistryState, listTools, registryHealth } from "./tool-registry.js";
import { type PermissionState, permissionCoverage } from "./tool-permission-control.js";
import { type ToolMetricsState, toolEcosystemHealth } from "./tool-metrics.js";
import { type ToolCacheState, cacheEffectiveness } from "./tool-cache.js";
import { type ToolHookState, toolHookHealth } from "./tool-hook-lifecycle.js";
import { type McpServerState, mcpServerReadiness } from "./tool-mcp-server.js";
import { type SandboxConfig, sandboxTightness } from "./tool-sandbox.js";

export interface ToolMasterSnapshot {
  registryHealth: number;
  permissionCoverage: number;
  toolEcosystemHealth: number;
  cacheEffectiveness: number;
  toolHookHealth: number;
  mcpServerReadiness: number;
  sandboxTightness: number;
  totalTools: number;
  enabledTools: number;
}

export function buildToolSnapshot(input: {
  registry: ToolRegistryState;
  permissions: PermissionState;
  metrics: ToolMetricsState;
  cache: ToolCacheState;
  hooks: ToolHookState;
  mcp: McpServerState;
  sandbox: SandboxConfig;
  allTools: string[];
  allAgents: string[];
}): ToolMasterSnapshot {
  const enabled = listTools(input.registry, { enabledOnly: true });
  return {
    registryHealth: registryHealth(input.registry),
    permissionCoverage: permissionCoverage(input.permissions, input.allTools, input.allAgents),
    toolEcosystemHealth: toolEcosystemHealth(input.metrics),
    cacheEffectiveness: cacheEffectiveness(input.cache),
    toolHookHealth: toolHookHealth(input.hooks),
    mcpServerReadiness: mcpServerReadiness(input.mcp),
    sandboxTightness: sandboxTightness(input.sandbox),
    totalTools: input.allTools.length,
    enabledTools: enabled.length,
  };
}

export function toolMastery(snap: ToolMasterSnapshot): { score: number; density: number; coherence: number; resonance: number; adapt: "bootstrap" | "balance" | "activate" | "maintain" } {
  const values = [
    snap.registryHealth,
    snap.permissionCoverage,
    snap.toolEcosystemHealth,
    snap.cacheEffectiveness,
    snap.toolHookHealth,
    snap.mcpServerReadiness,
    snap.sandboxTightness,
  ];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  const density = mean;
  const coherence = 1 - stdDev;
  const resonance = snap.registryHealth * 0.2 + snap.toolEcosystemHealth * 0.25 + snap.mcpServerReadiness * 0.15 + snap.permissionCoverage * 0.15 + snap.cacheEffectiveness * 0.1 + snap.toolHookHealth * 0.1 + snap.sandboxTightness * 0.05;
  const score = density * 0.4 + coherence * 0.3 + resonance * 0.3;
  let adapt: "bootstrap" | "balance" | "activate" | "maintain";
  if (density < 0.3) adapt = "bootstrap";
  else if (coherence < 0.4) adapt = "balance";
  else if (density < 0.5) adapt = "activate";
  else adapt = "maintain";
  return { score, density, coherence, resonance, adapt };
}

export function toolAction(snap: ToolMasterSnapshot): { action: "expand" | "secure" | "cache" | "hold"; reason: string } {
  if (snap.permissionCoverage < 0.5) return { action: "secure", reason: "Low permission coverage" };
  if (snap.totalTools === 0) return { action: "expand", reason: "No tools registered" };
  if (snap.cacheEffectiveness < 0.3) return { action: "cache", reason: "Cache not effective" };
  return { action: "hold", reason: "Tool ecosystem nominal" };
}
