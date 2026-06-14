// V25 ToolHookLifecycle (Direction B 25/30, generic-agent)
// Pre/post/error hooks for tool execution

export type HookPhase = "pre" | "post" | "error";

export interface ToolHook {
  id: string;
  phase: HookPhase;
  toolPattern: string;
  /** Hook function (id, toolName, phase, payload) => void. */
  fn: (id: string, toolName: string, phase: HookPhase, payload: Record<string, unknown>) => void;
  enabled: boolean;
}

export interface ToolHookState {
  hooks: ToolHook[];
  totalInvoked: number;
  totalErrors: number;
}

export function createToolHookState(): ToolHookState {
  return { hooks: [], totalInvoked: 0, totalErrors: 0 };
}

export function registerToolHook(state: ToolHookState, hook: Omit<ToolHook, "id"> & { id?: string }): ToolHookState {
  const id = hook.id ?? `th${state.hooks.length + 1}`;
  return { ...state, hooks: [...state.hooks, { ...hook, id }] };
}

export function unregisterToolHook(state: ToolHookState, id: string): ToolHookState {
  return { ...state, hooks: state.hooks.filter((h) => h.id !== id) };
}

function matches(pattern: string, toolName: string): boolean {
  if (pattern === "*") return true;
  if (pattern === toolName) return true;
  if (pattern.endsWith("*")) return toolName.startsWith(pattern.slice(0, -1));
  return false;
}

export function fireToolHook(state: ToolHookState, toolName: string, phase: HookPhase, payload: Record<string, unknown> = {}): { state: ToolHookState; errors: Array<{ hookId: string; error: unknown }> } {
  const errors: Array<{ hookId: string; error: unknown }> = [];
  let invoked = 0;
  let errCount = 0;
  for (const h of state.hooks) {
    if (!h.enabled) continue;
    if (h.phase !== phase) continue;
    if (!matches(h.toolPattern, toolName)) continue;
    invoked++;
    try {
      h.fn(h.id, toolName, phase, payload);
    } catch (err) {
      errCount++;
      errors.push({ hookId: h.id, error: err });
    }
  }
  return { state: { ...state, totalInvoked: state.totalInvoked + invoked, totalErrors: state.totalErrors + errCount }, errors };
}

export function toggleToolHook(state: ToolHookState, id: string, enabled: boolean): ToolHookState {
  return { ...state, hooks: state.hooks.map((h) => h.id === id ? { ...h, enabled } : h) };
}

/** Master metric: hook system health 0-1. */
export function toolHookHealth(state: ToolHookState): number {
  if (state.totalInvoked === 0) return 1.0;
  return Math.max(0, 1 - state.totalErrors / state.totalInvoked);
}
