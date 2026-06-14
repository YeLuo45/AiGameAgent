// V2 L1CharterMemory (Direction A 2/30, thunderbolt)
// L1 = project charter snapshots (versioned)

export interface CharterSnapshot {
  id: string; // "charter-{version}"
  version: number;
  ts: number;
  goal: string;
  milestones: string[];
  nodes: string[];
  /** Reason for the snapshot. */
  reason: "initial" | "approval" | "change-meeting" | "rollback";
  /** User who triggered. */
  createdBy: string;
}

export interface L1CharterMemoryState {
  /** All snapshots by id, sorted by version. */
  snapshots: CharterSnapshot[];
  /** Current active version. */
  currentVersion: number | null;
}

export function createL1CharterMemory(): L1CharterMemoryState {
  return { snapshots: [], currentVersion: null };
}

export function addCharterSnapshot(
  state: L1CharterMemoryState,
  snapshot: Omit<CharterSnapshot, "id" | "ts"> & { ts?: number },
): L1CharterMemoryState {
  const ts = snapshot.ts ?? Date.now();
  const id = `charter-${snapshot.version}`;
  const full: CharterSnapshot = { ...snapshot, id, ts };
  const snapshots = [...state.snapshots, full].sort((a, b) => a.version - b.version);
  return { ...state, snapshots, currentVersion: snapshot.version };
}

export function getCurrentCharter(state: L1CharterMemoryState): CharterSnapshot | null {
  if (state.currentVersion === null) return null;
  return state.snapshots.find((s) => s.version === state.currentVersion) ?? null;
}

export function getCharterByVersion(state: L1CharterMemoryState, version: number): CharterSnapshot | null {
  return state.snapshots.find((s) => s.version === version) ?? null;
}

export function listCharters(state: L1CharterMemoryState, sortDesc: boolean = false): CharterSnapshot[] {
  return sortDesc ? [...state.snapshots].sort((a, b) => b.version - a.version) : [...state.snapshots].sort((a, b) => a.version - b.version);
}

export function setCurrentVersion(state: L1CharterMemoryState, version: number): L1CharterMemoryState {
  if (!state.snapshots.find((s) => s.version === version)) return state;
  return { ...state, currentVersion: version };
}

/** Compute diff between two snapshots. */
export function diffCharters(a: CharterSnapshot, b: CharterSnapshot): { goalChanged: boolean; milestonesAdded: string[]; milestonesRemoved: string[]; nodesAdded: string[]; nodesRemoved: string[] } {
  const aMilestones = new Set(a.milestones);
  const bMilestones = new Set(b.milestones);
  const aNodes = new Set(a.nodes);
  const bNodes = new Set(b.nodes);
  return {
    goalChanged: a.goal !== b.goal,
    milestonesAdded: [...bMilestones].filter((m) => !aMilestones.has(m)),
    milestonesRemoved: [...aMilestones].filter((m) => !bMilestones.has(m)),
    nodesAdded: [...bNodes].filter((n) => !aNodes.has(n)),
    nodesRemoved: [...aNodes].filter((n) => !bNodes.has(n)),
  };
}

/** Master metric: charter consistency 0-1 (1 = no drift, lower = more drift). */
export function charterConsistency(state: L1CharterMemoryState): number {
  if (state.snapshots.length < 2) return 1.0;
  const sorted = [...state.snapshots].sort((a, b) => a.version - b.version);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const diff = diffCharters(prev, last);
  let drift = 0;
  if (diff.goalChanged) drift += 0.5;
  drift += diff.milestonesAdded.length * 0.1;
  drift += diff.milestonesRemoved.length * 0.15;
  drift += diff.nodesAdded.length * 0.05;
  drift += diff.nodesRemoved.length * 0.05;
  return Math.max(0, 1 - drift);
}
