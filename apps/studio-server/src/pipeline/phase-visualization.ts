// V7 PhaseVisualization (Direction C 7/30, chatdev)
// UI-friendly phase status snapshot (for UI rendering)

import type { Phase } from "./phase-engine.js";
import { ALL_PHASES, phaseIndex, type PhaseState } from "./phase-engine.js";

export interface PhaseStatus {
  phase: Phase;
  index: number;
  status: "pending" | "current" | "completed" | "failed" | "skipped";
  hasOutput: boolean;
  outputSummary: string;
}

export interface PhaseVisualization {
  phases: PhaseStatus[];
  overallProgress: number;
  currentPhase: Phase | null;
  totalCompleted: number;
  totalFailed: number;
}

const MAX_SUMMARY_LEN = 50;

export function buildVisualization(state: PhaseState): PhaseVisualization {
  const phases: PhaseStatus[] = [];
  let totalCompleted = 0;
  let totalFailed = 0;
  const currentIdx = phaseIndex(state.current);
  for (const p of ALL_PHASES) {
    const idx = phaseIndex(p);
    const isCurrent = state.current === p;
    const inHistory = state.history.find((h) => h.phase === p);
    let status: PhaseStatus["status"];
    if (isCurrent) {
      // If current phase is in history with failure or skipped, prefer that
      if (inHistory?.result === "failure") {
        status = "failed";
        totalFailed++;
      } else if (inHistory?.result === "skipped") {
        status = "skipped";
      } else {
        status = "current";
      }
    } else if (inHistory) {
      if (inHistory.result === "success") {
        status = "completed";
        totalCompleted++;
      } else if (inHistory.result === "failure") {
        status = "failed";
        totalFailed++;
      } else {
        status = "skipped";
      }
    } else if (idx < currentIdx) {
      // Phase before current with no history → implicitly completed
      status = "completed";
      totalCompleted++;
    } else {
      status = "pending";
    }
    const out = state.outputs[p];
    const hasOutput = out !== undefined && out !== null;
    const outputSummary = hasOutput ? summarizeOutput(out) : "";
    phases.push({ phase: p, index: idx, status, hasOutput, outputSummary });
  }
  return {
    phases,
    overallProgress: (phaseIndex(state.current) + 1) / ALL_PHASES.length,
    currentPhase: state.current,
    totalCompleted,
    totalFailed,
  };
}

function summarizeOutput(out: unknown): string {
  if (typeof out === "string") return out.slice(0, MAX_SUMMARY_LEN);
  try {
    return JSON.stringify(out).slice(0, MAX_SUMMARY_LEN);
  } catch {
    return "";
  }
}

/** Convert to ASCII progress bar. */
export function progressBar(progress: number, width: number = 20): string {
  const filled = Math.round(progress * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

/** Master metric: visualization completeness 0-1. */
export function visualizationCompleteness(viz: PhaseVisualization): number {
  if (viz.phases.length === 0) return 1.0;
  const withStatus = viz.phases.filter((p) => p.status !== "pending").length;
  return withStatus / viz.phases.length;
}
