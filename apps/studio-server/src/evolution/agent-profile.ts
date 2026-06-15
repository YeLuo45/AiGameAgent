// V19 AgentProfile (Direction D 19/30, generic-agent)
// Per-agent capability model (skills, preferences, history)

export interface AgentCapability {
  name: string;
  level: number; // 0-1
  /** Number of times demonstrated. */
  demonstrations: number;
}

export interface AgentProfile {
  agentId: string;
  name: string;
  role: string;
  capabilities: AgentCapability[];
  /** Known preferences (style, format, etc.). */
  preferences: Record<string, string>;
  /** Successful tasks count. */
  totalSuccesses: number;
  /** Total tasks count. */
  totalTasks: number;
  /** Created at. */
  createdAt: number;
  lastActiveAt: number | null;
}

export function createAgentProfile(agentId: string, name: string, role: string): AgentProfile {
  return {
    agentId, name, role, capabilities: [], preferences: {},
    totalSuccesses: 0, totalTasks: 0, createdAt: Date.now(), lastActiveAt: null,
  };
}

export function addCapability(profile: AgentProfile, name: string, level: number = 0.5): AgentProfile {
  const existing = profile.capabilities.find((c) => c.name === name);
  if (existing) {
    return { ...profile, capabilities: profile.capabilities.map((c) => c.name === name ? { ...c, level, demonstrations: c.demonstrations + 1 } : c) };
  }
  return { ...profile, capabilities: [...profile.capabilities, { name, level, demonstrations: 1 }] };
}

export function setPreference(profile: AgentProfile, key: string, value: string): AgentProfile {
  return { ...profile, preferences: { ...profile.preferences, [key]: value } };
}

export function getCapability(profile: AgentProfile, name: string): AgentCapability | undefined {
  return profile.capabilities.find((c) => c.name === name);
}

export function hasCapability(profile: AgentProfile, name: string, minLevel: number = 0): boolean {
  const c = getCapability(profile, name);
  return c ? c.level >= minLevel : false;
}

export function recordTaskCompletion(profile: AgentProfile, success: boolean, now: number = Date.now()): AgentProfile {
  return { ...profile, totalTasks: profile.totalTasks + 1, totalSuccesses: profile.totalSuccesses + (success ? 1 : 0), lastActiveAt: now };
}

export function avgCapabilityLevel(profile: AgentProfile): number {
  if (profile.capabilities.length === 0) return 0;
  return profile.capabilities.reduce((a, c) => a + c.level, 0) / profile.capabilities.length;
}

export function successRate(profile: AgentProfile): number {
  if (profile.totalTasks === 0) return 1.0;
  return profile.totalSuccesses / profile.totalTasks;
}

/** Master metric: agent profile completeness 0-1. */
export function profileCompleteness(profile: AgentProfile): number {
  let score = 0;
  if (profile.capabilities.length > 0) score += 0.4;
  if (Object.keys(profile.preferences).length > 0) score += 0.2;
  if (profile.totalTasks > 0) score += 0.2;
  if (profile.lastActiveAt) score += 0.2;
  return Math.min(1, score);
}
