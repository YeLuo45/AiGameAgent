// V8 PhaseDependency (Direction C 8/30, chatdev)
// DAG: which phases depend on which

import type { Phase } from "./phase-engine.js";
import { ALL_PHASES } from "./phase-engine.js";

export interface DependencyGraph {
  nodes: Phase[];
  /** phase → list of dependencies (must complete before). */
  edges: Record<Phase, Phase[]>;
}

/** Default linear dependency: each phase depends on the previous one. */
export function linearDependencyGraph(): DependencyGraph {
  const edges: Record<Phase, Phase[]> = {} as Record<Phase, Phase[]>;
  for (let i = 0; i < ALL_PHASES.length; i++) {
    const p = ALL_PHASES[i];
    edges[p] = i > 0 ? [ALL_PHASES[i - 1]] : [];
  }
  return { nodes: [...ALL_PHASES], edges };
}

/** Custom dependency graph. */
export function buildGraph(edges: Partial<Record<Phase, Phase[]>>): DependencyGraph {
  const fullEdges: Record<Phase, Phase[]> = {} as Record<Phase, Phase[]>;
  for (const p of ALL_PHASES) {
    fullEdges[p] = edges[p] ?? [];
  }
  return { nodes: [...ALL_PHASES], edges: fullEdges };
}

export function dependenciesOf(graph: DependencyGraph, phase: Phase): Phase[] {
  return graph.edges[phase] ?? [];
}

export function dependentsOf(graph: DependencyGraph, phase: Phase): Phase[] {
  return graph.nodes.filter((p) => (graph.edges[p] ?? []).includes(phase));
}

export function isReady(graph: DependencyGraph, phase: Phase, completed: Set<Phase>): boolean {
  return dependenciesOf(graph, phase).every((d) => completed.has(d));
}

export function topologicalOrder(graph: DependencyGraph): Phase[] | null {
  // Detect cycle via Kahn's algorithm
  const inDegree: Record<Phase, number> = {} as Record<Phase, number>;
  for (const n of graph.nodes) inDegree[n] = (graph.edges[n] ?? []).length;
  const queue: Phase[] = graph.nodes.filter((n) => inDegree[n] === 0);
  const order: Phase[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const next of dependentsOf(graph, n)) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }
  return order.length === graph.nodes.length ? order : null;
}

/** Master metric: graph health 0-1 (no cycles = 1.0). */
export function graphHealth(graph: DependencyGraph): number {
  return topologicalOrder(graph) ? 1.0 : 0;
}
