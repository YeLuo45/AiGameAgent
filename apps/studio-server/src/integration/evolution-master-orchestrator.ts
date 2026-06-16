// V25 EvolutionMasterOrchestrator (Direction D 25/30, orchestrator)
// Mastery score integrating all evolution engines

import { type EvolverState, evolverHealth } from "../evolution/evolver-orchestrator.js";
import { type AdaptiveScheduleState, scheduleThroughput } from "./adaptive-schedule.js";
import { type KnowledgeTransferState, knowledgeDensity } from "./knowledge-transfer.js";
import { type DriftDetectorState, detectAllDrift, driftStability } from "./drift-detector.js";

export interface EvolutionMasterSnapshot {
  evolverHealth: number;
  scheduleThroughput: number;
  knowledgeDensity: number;
  driftStability: number;
}

export function buildEvolutionSnapshot(input: {
  evolver: EvolverState;
  schedule: AdaptiveScheduleState;
  knowledge: KnowledgeTransferState;
  drift: DriftDetectorState;
}): EvolutionMasterSnapshot {
  return {
    evolverHealth: evolverHealth(input.evolver),
    scheduleThroughput: scheduleThroughput(input.schedule),
    knowledgeDensity: knowledgeDensity(input.knowledge),
    driftStability: driftStability(detectAllDrift(input.drift)),
  };
}

export function evolutionMastery(snap: EvolutionMasterSnapshot): { score: number; density: number; coherence: number; resonance: number; adapt: "bootstrap" | "balance" | "activate" | "maintain" } {
  const values = [snap.evolverHealth, snap.scheduleThroughput, snap.knowledgeDensity, snap.driftStability];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  const density = mean;
  const coherence = 1 - stdDev;
  const resonance = snap.evolverHealth * 0.4 + snap.scheduleThroughput * 0.3 + snap.knowledgeDensity * 0.15 + snap.driftStability * 0.15;
  const score = density * 0.4 + coherence * 0.3 + resonance * 0.3;
  let adapt: "bootstrap" | "balance" | "activate" | "maintain";
  if (density < 0.3) adapt = "bootstrap";
  else if (coherence < 0.4) adapt = "balance";
  else if (density < 0.5) adapt = "activate";
  else adapt = "maintain";
  return { score, density, coherence, resonance, adapt };
}
