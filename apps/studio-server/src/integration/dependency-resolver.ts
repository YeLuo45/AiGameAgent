// V28 DependencyResolver (Direction C 28/30, orchestrator)
// DAG resolution (topological sort + cycle detection)

export interface Node {
  id: string;
  /** IDs this node depends on. */
  deps: string[];
}

export interface ResolutionResult {
  order: string[];
  hasCycle: boolean;
  cycleNodes: string[];
}

export function resolveDeps(nodes: Node[]): ResolutionResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  for (const n of nodes) inDegree.set(n.id, n.deps.length);
  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const n of nodes) {
      if (n.deps.includes(id)) {
        inDegree.set(n.id, (inDegree.get(n.id) ?? 1) - 1);
        if (inDegree.get(n.id) === 0) queue.push(n.id);
      }
    }
  }
  if (order.length < nodes.length) {
    // Find cycle
    const cycle = nodes.filter((n) => !order.includes(n.id)).map((n) => n.id);
    return { order, hasCycle: true, cycleNodes: cycle };
  }
  return { order, hasCycle: false, cycleNodes: [] };
}

export function findCriticalPath(nodes: Node[], weight: (id: string) => number = () => 1): string[] {
  // Find longest path in DAG
  const r = resolveDeps(nodes);
  if (r.hasCycle) return [];
  const memo: Record<string, { length: number; path: string[] }> = {};
  function longest(id: string): { length: number; path: string[] } {
    if (memo[id]) return memo[id];
    const n = nodes.find((x) => x.id === id);
    if (!n) return memo[id] = { length: 0, path: [] };
    let best = { length: weight(id), path: [id] };
    for (const d of n.deps) {
      const sub = longest(d);
      const total = sub.length + weight(id);
      if (total > best.length) {
        best = { length: total, path: [...sub.path, id] };
      }
    }
    return memo[id] = best;
  }
  let overall = { length: 0, path: [] as string[] };
  for (const n of nodes) {
    const l = longest(n.id);
    if (l.length > overall.length) overall = l;
  }
  return overall.path;
}

/** Master metric: DAG density 0-1. */
export function dagDensity(nodes: Node[]): number {
  if (nodes.length === 0) return 0;
  const maxEdges = nodes.length * (nodes.length - 1) / 2;
  if (maxEdges === 0) return 0;
  const edges = nodes.reduce((a, n) => a + n.deps.length, 0);
  return edges / maxEdges;
}
