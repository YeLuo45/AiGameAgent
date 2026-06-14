// V17 EventHook (Direction E 17/30, ruflo)
// Pre/post hooks for events (fire-and-forget or blocking)

export type HookEventType = "job.enqueued" | "job.started" | "job.finished" | "job.failed" | "llm.chunk" | "tool.start" | "tool.end" | "fs.change" | "*";

export type HookPhase = "pre" | "post" | "error";

export interface HookFn {
  (event: { type: string; payload: Record<string, unknown> }, phase: HookPhase): void | Promise<void>;
}

export interface Hook {
  id: string;
  eventType: HookEventType;
  phase: HookPhase;
  fn: HookFn;
  enabled: boolean;
}

export interface EventHookState {
  hooks: Hook[];
  /** Total hook invocations. */
  totalInvoked: number;
  /** Total hook errors. */
  totalErrors: number;
}

export function createEventHookState(): EventHookState {
  return { hooks: [], totalInvoked: 0, totalErrors: 0 };
}

export function registerHook(state: EventHookState, hook: Omit<Hook, "id"> & { id?: string }): EventHookState {
  const id = hook.id ?? `h${state.hooks.length + 1}`;
  return { ...state, hooks: [...state.hooks, { ...hook, id }] };
}

export function unregisterHook(state: EventHookState, id: string): EventHookState {
  return { ...state, hooks: state.hooks.filter((h) => h.id !== id) };
}

export function toggleHook(state: EventHookState, id: string, enabled: boolean): EventHookState {
  return { ...state, hooks: state.hooks.map((h) => h.id === id ? { ...h, enabled } : h) };
}

function matches(hookType: HookEventType, eventType: string): boolean {
  return hookType === "*" || hookType === eventType;
}

export async function fireEvent(
  state: EventHookState,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<{ state: EventHookState; errors: Array<{ hookId: string; error: unknown }> }> {
  const errors: Array<{ hookId: string; error: unknown }> = [];
  let totalInvoked = 0;
  let totalErrors = 0;
  for (const h of state.hooks) {
    if (!h.enabled) continue;
    if (!matches(h.eventType, eventType)) continue;
    totalInvoked++;
    try {
      await h.fn({ type: eventType, payload }, h.phase);
    } catch (err) {
      totalErrors++;
      errors.push({ hookId: h.id, error: err });
    }
  }
  return { state: { ...state, totalInvoked: state.totalInvoked + totalInvoked, totalErrors: state.totalErrors + totalErrors }, errors };
}

export function hookCount(state: EventHookState, filter: { eventType?: HookEventType; phase?: HookPhase; enabledOnly?: boolean } = {}): number {
  let arr = state.hooks;
  if (filter.eventType) arr = arr.filter((h) => h.eventType === filter.eventType);
  if (filter.phase) arr = arr.filter((h) => h.phase === filter.phase);
  if (filter.enabledOnly) arr = arr.filter((h) => h.enabled);
  return arr.length;
}

export function getHook(state: EventHookState, id: string): Hook | undefined {
  return state.hooks.find((h) => h.id === id);
}

/** Master metric: hook system health 0-1. */
export function hookHealth(state: EventHookState): number {
  if (state.totalInvoked === 0) return 1.0;
  return 1.0 - state.totalErrors / state.totalInvoked;
}
