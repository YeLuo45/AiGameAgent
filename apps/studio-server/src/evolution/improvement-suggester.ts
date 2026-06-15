// V14 ImprovementSuggester (Direction D 14/30, generic-agent)
// Propose improvements based on metrics + feedback + patterns

import { type PerformanceTrackerState, underPerformers, systemPerformance } from "./performance-tracker.js";
import { type FeedbackCollectorState, averageScore } from "./feedback-collector.js";
import { type PatternLearnerState, significantPatterns } from "./pattern-learner.js";

export type SuggestionSeverity = "info" | "warn" | "critical";

export interface ImprovementSuggestion {
  id: string;
  ts: number;
  category: "performance" | "reliability" | "satisfaction" | "learning";
  severity: SuggestionSeverity;
  target: string;
  message: string;
  suggestedAction: string;
  /** Confidence 0-1. */
  confidence: number;
}

export function suggestImprovements(perf: PerformanceTrackerState, feedback: FeedbackCollectorState, patterns: PatternLearnerState): ImprovementSuggestion[] {
  const out: ImprovementSuggestion[] = [];
  // Underperformers
  for (const m of underPerformers(perf, 0.5)) {
    out.push({
      id: `perf-${m.agentId}-${Date.now()}`,
      ts: Date.now(),
      category: "performance",
      severity: m.ewmaSuccess < 0.3 ? "critical" : "warn",
      target: m.agentId,
      message: `Agent ${m.agentId} has ${(m.ewmaSuccess * 100).toFixed(0)}% success rate over ${m.tasksAttempted} tasks`,
      suggestedAction: `Retrain or replace ${m.agentId}, or assign easier tasks`,
      confidence: Math.min(1, m.tasksAttempted / 10),
    });
  }
  // Negative feedback
  const neg = feedback.entries.filter((e) => e.sentiment === "negative");
  for (const e of neg) {
    out.push({
      id: `fb-${e.id}-${Date.now()}`,
      ts: Date.now(),
      category: "satisfaction",
      severity: e.score < -0.5 ? "critical" : "warn",
      target: e.target,
      message: `Negative feedback on ${e.target}: ${e.comment}`,
      suggestedAction: `Investigate root cause and adjust ${e.target}`,
      confidence: 0.7,
    });
  }
  // System-wide low performance
  if (systemPerformance(perf) < 0.5) {
    out.push({
      id: `sys-perf-${Date.now()}`,
      ts: Date.now(),
      category: "performance",
      severity: "critical",
      target: "system",
      message: `System-wide performance is ${(systemPerformance(perf) * 100).toFixed(0)}%`,
      suggestedAction: "Consider system-wide retraining or model upgrade",
      confidence: 0.9,
    });
  }
  // Low significant patterns
  const sigs = significantPatterns(patterns);
  if (sigs.length < 3) {
    out.push({
      id: `pat-coverage-${Date.now()}`,
      ts: Date.now(),
      category: "learning",
      severity: "info",
      target: "system",
      message: `Only ${sigs.length} significant patterns learned`,
      suggestedAction: "Run more tasks to build pattern knowledge",
      confidence: 0.6,
    });
  }
  return out.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

function severityWeight(s: SuggestionSeverity): number {
  return s === "critical" ? 3 : s === "warn" ? 2 : 1;
}

export function criticalSuggestions(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
  return suggestions.filter((s) => s.severity === "critical");
}

/** Master metric: improvement coverage 0-1. */
export function improvementCoverage(suggestions: ImprovementSuggestion[]): number {
  if (suggestions.length === 0) return 1.0;
  const actedOn = suggestions.filter((s) => s.confidence > 0.8).length;
  return actedOn / suggestions.length;
}
