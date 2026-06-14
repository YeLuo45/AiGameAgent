// V23 AdapterSharing (Direction E 23/30, chatdev)
// Cross-project adapter pool (shared connections, shared health)

import { type ChannelAdapter } from "./channel-adapter.js";
import { type HealthCheckerState } from "./health-checker.js";

export interface SharedAdapter {
  adapter: ChannelAdapter;
  /** Projects that have access. */
  sharedWith: string[];
  /** Total shared across all projects. */
  totalShares: number;
}

export interface AdapterSharingState {
  adapters: Record<string, SharedAdapter>;
  /** Health shared across all projects. */
  healthById: Record<string, HealthCheckerState>;
}

export function createAdapterSharing(): AdapterSharingState {
  return { adapters: {}, healthById: {} };
}

export function addSharedAdapter(state: AdapterSharingState, adapter: ChannelAdapter, projectId: string): AdapterSharingState {
  const existing = state.adapters[adapter.id];
  if (existing) {
    if (!existing.sharedWith.includes(projectId)) {
      const updated: SharedAdapter = { ...existing, sharedWith: [...existing.sharedWith, projectId], totalShares: existing.totalShares + 1 };
      return { ...state, adapters: { ...state.adapters, [adapter.id]: updated } };
    }
    return state;
  }
  return { ...state, adapters: { ...state.adapters, [adapter.id]: { adapter, sharedWith: [projectId], totalShares: 1 } } };
}

export function removeFromProject(state: AdapterSharingState, adapterId: string, projectId: string): AdapterSharingState {
  const existing = state.adapters[adapterId];
  if (!existing) return state;
  const sharedWith = existing.sharedWith.filter((p) => p !== projectId);
  if (sharedWith.length === 0) {
    const { [adapterId]: _, ...rest } = state.adapters;
    return { ...state, adapters: rest };
  }
  return { ...state, adapters: { ...state.adapters, [adapterId]: { ...existing, sharedWith } } };
}

export function projectsWithAccess(state: AdapterSharingState, adapterId: string): string[] {
  return state.adapters[adapterId]?.sharedWith ?? [];
}

export function sharedAdapterCount(state: AdapterSharingState): number {
  return Object.keys(state.adapters).length;
}

export function setSharedHealth(state: AdapterSharingState, health: HealthCheckerState): AdapterSharingState {
  return { ...state, healthById: { ...state.healthById, [health.providerId]: health } };
}

export function getSharedHealth(state: AdapterSharingState, adapterId: string): HealthCheckerState | undefined {
  return state.healthById[adapterId];
}

/** Master metric: sharing efficiency 0-1. */
export function sharingEfficiency(state: AdapterSharingState): number {
  const total = Object.values(state.adapters);
  if (total.length === 0) return 0;
  const avgShares = total.reduce((acc, a) => acc + a.sharedWith.length, 0) / total.length;
  return Math.min(1, avgShares / 3); // normalized: 3+ shares = perfect
}
