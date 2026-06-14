// V16 ToolRegistry (Direction B 16/30, chatdev)
// CRUD + discovery for tools (Read/Write/Edit/Glob/Grep/Bash + custom)

export type ToolCategory = "filesystem" | "search" | "shell" | "network" | "agent" | "custom";

export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  /** JSON Schema for parameters. */
  parameters: Record<string, unknown>;
  /** Whether this tool requires sandbox. */
  requiresSandbox: boolean;
  /** Default timeout in ms. */
  defaultTimeoutMs: number;
}

export interface RegisteredTool {
  tool: ToolDefinition;
  registeredAt: number;
  registeredBy: string;
  enabled: boolean;
  /** Tags for filtering. */
  tags: string[];
}

export interface ToolRegistryState {
  tools: Record<string, RegisteredTool>;
}

export function createToolRegistry(): ToolRegistryState {
  return { tools: {} };
}

export function registerTool(state: ToolRegistryState, tool: ToolDefinition, registeredBy: string, tags: string[] = []): ToolRegistryState {
  const entry: RegisteredTool = { tool, registeredAt: Date.now(), registeredBy, enabled: true, tags };
  return { ...state, tools: { ...state.tools, [tool.name]: entry } };
}

export function unregisterTool(state: ToolRegistryState, name: string): ToolRegistryState {
  const { [name]: _, ...rest } = state.tools;
  return { ...state, tools: rest };
}

export function getTool(state: ToolRegistryState, name: string): RegisteredTool | undefined {
  return state.tools[name];
}

export function setToolEnabled(state: ToolRegistryState, name: string, enabled: boolean): ToolRegistryState {
  const entry = state.tools[name];
  if (!entry) return state;
  return { ...state, tools: { ...state.tools, [name]: { ...entry, enabled } } };
}

export function listTools(state: ToolRegistryState, filter: { category?: ToolCategory; enabledOnly?: boolean; tag?: string } = {}): RegisteredTool[] {
  let arr = Object.values(state.tools);
  if (filter.category) arr = arr.filter((r) => r.tool.category === filter.category);
  if (filter.tag) arr = arr.filter((r) => r.tags.includes(filter.tag!));
  if (filter.enabledOnly) arr = arr.filter((r) => r.enabled);
  return arr.sort((a, b) => a.tool.name.localeCompare(b.tool.name));
}

export function findToolsByTag(state: ToolRegistryState, tag: string): RegisteredTool[] {
  return listTools(state, { tag });
}

/** Master metric: registry health 0-1. */
export function registryHealth(state: ToolRegistryState): number {
  const total = Object.keys(state.tools).length;
  if (total === 0) return 0;
  const enabled = Object.values(state.tools).filter((r) => r.enabled).length;
  const categories = new Set(Object.values(state.tools).map((r) => r.tool.category));
  let score = enabled / total;
  score += Math.min(0.3, categories.size * 0.1);
  return Math.max(0, Math.min(1, score));
}
