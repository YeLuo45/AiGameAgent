// V27 TaskDecomposer (Direction C 27/30, orchestrator)
// Break complex tasks into subtasks

export type DecomposeStrategy = "sequential" | "parallel" | "dependency-graph";

export interface SubTask {
  id: string;
  name: string;
  description: string;
  /** Subtask IDs this depends on. */
  dependsOn: string[];
  /** Estimated effort 0-1. */
  effort: number;
}

export interface Decomposition {
  strategy: DecomposeStrategy;
  subtasks: SubTask[];
  /** Total estimated effort. */
  totalEffort: number;
  /** Max depth (longest dependency chain). */
  depth: number;
}

const KEYWORDS: Array<{ pattern: RegExp; suffix: string }> = [
  { pattern: /\band\b/gi, suffix: "concurrent" },
  { pattern: /\bthen\b/gi, suffix: "sequential" },
  { pattern: /\bafter\b/gi, suffix: "sequential" },
  { pattern: /\bbefore\b/gi, suffix: "before-dep" },
  { pattern: /\bwhile\b/gi, suffix: "concurrent" },
];

/** Simple sentence-based decomposer. */
export function decomposeTask(description: string, strategy: DecomposeStrategy = "sequential"): Decomposition {
  // Split by . / ; / then
  const sentences = description.split(/[.;]| then /i).map((s) => s.trim()).filter((s) => s.length > 5);
  if (sentences.length === 0) {
    return { strategy, subtasks: [], totalEffort: 0, depth: 0 };
  }
  const subtasks: SubTask[] = sentences.map((s, i) => ({
    id: `st${i + 1}`,
    name: s.slice(0, 50),
    description: s,
    dependsOn: i > 0 && strategy !== "parallel" ? [`st${i}`] : [],
    effort: Math.min(1, s.length / 100),
  }));
  const totalEffort = subtasks.reduce((a, s) => a + s.effort, 0);
  const depth = computeDepth(subtasks);
  return { strategy, subtasks, totalEffort, depth };
}

function computeDepth(subtasks: SubTask[]): number {
  if (subtasks.length === 0) return 0;
  const byId = new Map(subtasks.map((s) => [s.id, s] as const));
  let maxDepth = 0;
  // Depth = longest chain of dependencies starting from any node
  // We compute it as: max over all nodes of (1 + max depth of any dep)
  // For a linear chain A->B->C, depths are: A=1, B=2, C=3, max=3
  for (const s of subtasks) {
    const d = depthOf(s.id, byId, new Set());
    if (d > maxDepth) maxDepth = d;
  }
  return maxDepth;
}

function depthOf(id: string, byId: Map<string, SubTask>, visiting: Set<string>): number {
  if (visiting.has(id)) return 0; // cycle
  visiting.add(id);
  const node = byId.get(id);
  if (!node) return 0;
  if (node.dependsOn.length === 0) {
    visiting.delete(id);
    return 1;
  }
  let maxDep = 0;
  for (const dep of node.dependsOn) {
    const d = depthOf(dep, byId, visiting);
    if (d > maxDep) maxDep = d;
  }
  visiting.delete(id);
  return 1 + maxDep;
}

/** Build a decomposition from explicit subtasks. */
export function buildDecomposition(subtasks: SubTask[], strategy: DecomposeStrategy = "sequential"): Decomposition {
  const totalEffort = subtasks.reduce((a, s) => a + s.effort, 0);
  return { strategy, subtasks, totalEffort, depth: computeDepth(subtasks) };
}

export function leaves(decomp: Decomposition): SubTask[] {
  return decomp.subtasks.filter((s) => !decomp.subtasks.some((other) => other.dependsOn.includes(s.id)));
}

export function roots(decomp: Decomposition): SubTask[] {
  return decomp.subtasks.filter((s) => s.dependsOn.length === 0);
}

/** Master metric: decomposition quality 0-1 (more subtasks = more granular). */
export function decompositionQuality(decomp: Decomposition): number {
  if (decomp.subtasks.length === 0) return 0;
  return Math.min(1, decomp.subtasks.length / 5);
}
