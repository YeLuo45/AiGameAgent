// V13 MemorySnapshot (Direction A 13/30, ruflo)
// Point-in-time snapshot of entire memory layer

import { type MemoryLayer } from "./memory-layer.js";

export interface MemorySnapshot {
  id: string;
  ts: number;
  label: string;
  /** Compacted copy of all layers. */
  layerData: {
    l0Count: number;
    l0Size: number;
    l1Versions: number[];
    l1CurrentVersion: number | null;
    l2Count: number;
    l3Agents: string[];
    l4Count: number;
    l4AvgConfidence: number;
  };
  /** Reference to original layer (for restore). */
  layer: MemoryLayer;
}

export function takeSnapshot(layer: MemoryLayer, label: string = ""): MemorySnapshot {
  const l0Size = layer.l0.totalSize;
  const l4Vals = Object.values(layer.l4.patterns);
  const l4AvgConfidence = l4Vals.length === 0 ? 0 : l4Vals.reduce((a, p) => a + p.confidence, 0) / l4Vals.length;
  return {
    id: `snap-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000)}`,
    ts: Date.now(),
    label,
    layerData: {
      l0Count: layer.l0.entries.length,
      l0Size,
      l1Versions: layer.l1.snapshots.map((s) => s.version),
      l1CurrentVersion: layer.l1.currentVersion,
      l2Count: layer.l2.records.length,
      l3Agents: Object.keys(layer.l3),
      l4Count: l4Vals.length,
      l4AvgConfidence,
    },
    layer,
  };
}

export function diffSnapshots(a: MemorySnapshot, b: MemorySnapshot): { l0Delta: number; l1Added: number[]; l1Removed: number[]; l2Delta: number; l3Added: string[]; l3Removed: string[]; l4Delta: number } {
  const aVersions = new Set(a.layerData.l1Versions);
  const bVersions = new Set(b.layerData.l1Versions);
  const aAgents = new Set(a.layerData.l3Agents);
  const bAgents = new Set(b.layerData.l3Agents);
  return {
    l0Delta: b.layerData.l0Count - a.layerData.l0Count,
    l1Added: [...bVersions].filter((v) => !aVersions.has(v)),
    l1Removed: [...aVersions].filter((v) => !bVersions.has(v)),
    l2Delta: b.layerData.l2Count - a.layerData.l2Count,
    l3Added: [...bAgents].filter((x) => !aAgents.has(x)),
    l3Removed: [...aAgents].filter((x) => !bAgents.has(x)),
    l4Delta: b.layerData.l4Count - a.layerData.l4Count,
  };
}

export function restoreFromSnapshot(snap: MemorySnapshot): MemoryLayer {
  return snap.layer;
}

export function listSnapshots(snaps: MemorySnapshot[]): MemorySnapshot[] {
  return [...snaps].sort((a, b) => b.ts - a.ts);
}

/** Master metric: snapshot coverage 0-1 (how much of layer is captured). */
export function snapshotCoverage(snap: MemorySnapshot, current: MemoryLayer): number {
  const total = current.l0.entries.length + current.l1.snapshots.length + current.l2.records.length + Object.keys(current.l3).length + Object.keys(current.l4.patterns).length;
  const captured = snap.layerData.l0Count + snap.layerData.l1Versions.length + snap.layerData.l2Count + snap.layerData.l3Agents.length + snap.layerData.l4Count;
  if (total === 0) return 1.0;
  return Math.min(1, captured / total);
}
