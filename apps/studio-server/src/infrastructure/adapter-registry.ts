// V9 AdapterRegistry (Direction E 9/30, nanobot)
// CRUD + lookup registry for ChannelAdapter instances

import { type ChannelAdapter, type ChannelType, type ChannelCapability } from "./channel-adapter.js";

export interface RegisteredAdapter {
  adapter: ChannelAdapter;
  registeredAt: number;
  /** Priority for fallback chain (lower = higher priority). */
  priority: number;
  /** Whether the adapter is enabled. */
  enabled: boolean;
  /** Tags for capability/category filtering. */
  tags: string[];
}

export interface AdapterRegistryState {
  adapters: Record<string, RegisteredAdapter>;
  /** Default priority for new adapters. */
  defaultPriority: number;
}

export function createAdapterRegistry(defaultPriority: number = 100): AdapterRegistryState {
  return { adapters: {}, defaultPriority };
}

export function registerAdapter(
  state: AdapterRegistryState,
  adapter: ChannelAdapter,
  options: { priority?: number; enabled?: boolean; tags?: string[] } = {},
): AdapterRegistryState {
  const entry: RegisteredAdapter = {
    adapter,
    registeredAt: Date.now(),
    priority: options.priority ?? state.defaultPriority,
    enabled: options.enabled ?? true,
    tags: options.tags ?? [],
  };
  return { ...state, adapters: { ...state.adapters, [adapter.id]: entry } };
}

export function unregisterAdapter(state: AdapterRegistryState, id: string): AdapterRegistryState {
  const { [id]: _, ...rest } = state.adapters;
  return { ...state, adapters: rest };
}

export function getAdapter(state: AdapterRegistryState, id: string): RegisteredAdapter | undefined {
  return state.adapters[id];
}

export function setAdapterEnabled(state: AdapterRegistryState, id: string, enabled: boolean): AdapterRegistryState {
  const entry = state.adapters[id];
  if (!entry) return state;
  return { ...state, adapters: { ...state.adapters, [id]: { ...entry, enabled } } };
}

export function setAdapterPriority(state: AdapterRegistryState, id: string, priority: number): AdapterRegistryState {
  const entry = state.adapters[id];
  if (!entry) return state;
  return { ...state, adapters: { ...state.adapters, [id]: { ...entry, priority } } };
}

export function listAdapters(
  state: AdapterRegistryState,
  filter: { type?: ChannelType; capability?: ChannelCapability; enabledOnly?: boolean; tag?: string } = {},
): RegisteredAdapter[] {
  let arr = Object.values(state.adapters);
  if (filter.type) arr = arr.filter((r) => r.adapter.type === filter.type);
  if (filter.capability) arr = arr.filter((r) => r.adapter.capabilities.includes(filter.capability!));
  if (filter.enabledOnly) arr = arr.filter((r) => r.enabled);
  if (filter.tag) arr = arr.filter((r) => r.tags.includes(filter.tag!));
  return arr.sort((a, b) => a.priority - b.priority);
}

export function getDefaultAdapter(state: AdapterRegistryState, capability?: ChannelCapability): RegisteredAdapter | null {
  const candidates = listAdapters(state, { capability, enabledOnly: true });
  return candidates[0] ?? null;
}

export function countAdapters(state: AdapterRegistryState, enabledOnly: boolean = false): number {
  const list = enabledOnly ? Object.values(state.adapters).filter((r) => r.enabled) : Object.values(state.adapters);
  return list.length;
}

/** Build a fallback chain ordered by priority. */
export function buildFallbackChain(state: AdapterRegistryState, capability?: ChannelCapability): ChannelAdapter[] {
  return listAdapters(state, { capability, enabledOnly: true }).map((r) => r.adapter);
}

/** Master metric: registry health 0-1. */
export function registryHealth(state: AdapterRegistryState): number {
  const total = Object.values(state.adapters).length;
  if (total === 0) return 0;
  const enabled = Object.values(state.adapters).filter((r) => r.enabled).length;
  const types = new Set(Object.values(state.adapters).map((r) => r.adapter.type));
  let score = enabled / total;
  score += Math.min(0.3, types.size * 0.1);
  return Math.max(0, Math.min(1, score));
}
