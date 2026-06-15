// V15 SelfReflector (Direction D 15/30, generic-agent)
// Agent reflects on its own performance and produces insights

import { type PerformanceTrackerState, getMetric, listMetrics } from "./performance-tracker.js";
import { type FeedbackCollectorState, queryFeedback } from "./feedback-collector.js";

export type InsightKind = "strength" | "weakness" | "trend" | "anomaly";

export interface Insight {
  agentId: string;
  kind: InsightKind;
  text: string;
  /** Confidence 0-1. */
  confidence: number;
  /** Suggested action. */
  action: string;
}

export interface Reflection {
  ts: number;
  agentId: string;
  insights: Insight[];
}

export function reflect(agentId: string, perf: PerformanceTrackerState, feedback: FeedbackCollectorState): Reflection {
  const metric = getMetric(perf, agentId);
  const insights: Insight[] = [];
  if (!metric) {
    return { ts: Date.now(), agentId, insights: [{ agentId, kind: "anomaly", text: "No performance data available", confidence: 1, action: "Run more tasks to gather data" }] };
  }
  // Strength: high success rate
  if (metric.ewmaSuccess > 0.8 && metric.tasksAttempted >= 3) {
    insights.push({ agentId, kind: "strength", text: `Strong performance: ${(metric.ewmaSuccess * 100).toFixed(0)}% success rate`, confidence: 0.9, action: "Assign more complex tasks" });
  }
  // Weakness: low success rate
  if (metric.ewmaSuccess < 0.5 && metric.tasksAttempted >= 3) {
    insights.push({ agentId, kind: "weakness", text: `Weak performance: ${(metric.ewmaSuccess * 100).toFixed(0)}% success rate`, confidence: 0.85, action: "Investigate failure patterns and retrain" });
  }
  // Trend: improving or declining
  if (metric.tasksAttempted >= 5) {
    const recent = metric.ewmaSuccess;
    if (recent > 0.7) {
      insights.push({ agentId, kind: "trend", text: "Performance trending positive", confidence: 0.7, action: "Maintain current approach" });
    } else if (recent < 0.4) {
      insights.push({ agentId, kind: "trend", text: "Performance trending negative", confidence: 0.7, action: "Reduce task complexity" });
    }
  }
  // Anomaly: feedback mismatch
  const fb = queryFeedback(feedback, { target: agentId });
  const negFb = fb.filter((e) => e.sentiment === "negative");
  if (metric.ewmaSuccess > 0.7 && negFb.length > 2) {
    insights.push({ agentId, kind: "anomaly", text: `High success but ${negFb.length} negative feedbacks`, confidence: 0.6, action: "Review feedback for quality issues" });
  }
  if (insights.length === 0) {
    insights.push({ agentId, kind: "trend", text: "Stable performance, no anomalies detected", confidence: 0.5, action: "Continue monitoring" });
  }
  return { ts: Date.now(), agentId, insights };
}

export function reflectAll(perf: PerformanceTrackerState, feedback: FeedbackCollectorState): Reflection[] {
  return listMetrics(perf).map((m) => reflect(m.agentId, perf, feedback));
}

/** Master metric: reflection quality 0-1. */
export function reflectionQuality(reflection: Reflection): number {
  if (reflection.insights.length === 0) return 0;
  const avgConfidence = reflection.insights.reduce((a, i) => a + i.confidence, 0) / reflection.insights.length;
  return avgConfidence;
}
