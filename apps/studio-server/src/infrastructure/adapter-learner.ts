// V25 AdapterLearner (Direction E 25/30, generic-agent)
// Learn which adapter works best for which kind of task (reinforcement-style)

export type TaskKind = "text" | "code" | "summary" | "tools" | "creative";

export interface AdapterScore {
  providerId: string;
  taskKind: TaskKind;
  attempts: number;
  successes: number;
  totalLatencyMs: number;
  /** EWMA of success (0-1). */
  successRate: number;
  /** EWMA of latency (ms). */
  avgLatencyMs: number;
}

export interface AdapterLearnerState {
  scores: Record<string, AdapterScore>; // key = `${providerId}::${taskKind}`
  /** EWMA decay factor (0-1). */
  alpha: number;
  /** Minimum attempts before trusting score. */
  minAttempts: number;
}

export function createAdapterLearner(alpha: number = 0.3, minAttempts: number = 5): AdapterLearnerState {
  return { scores: {}, alpha, minAttempts };
}

function key(providerId: string, taskKind: TaskKind): string {
  return `${providerId}::${taskKind}`;
}

function ensureScore(state: AdapterLearnerState, providerId: string, taskKind: TaskKind): AdapterLearnerState {
  const k = key(providerId, taskKind);
  if (state.scores[k]) return state;
  const newScore: AdapterScore = { providerId, taskKind, attempts: 0, successes: 0, totalLatencyMs: 0, successRate: 0, avgLatencyMs: 0 };
  return { ...state, scores: { ...state.scores, [k]: newScore } };
}

export function recordOutcome(state: AdapterLearnerState, providerId: string, taskKind: TaskKind, success: boolean, latencyMs: number): AdapterLearnerState {
  let s = ensureScore(state, providerId, taskKind);
  const k = key(providerId, taskKind);
  const cur = s.scores[k];
  const attempts = cur.attempts + 1;
  const successes = success ? cur.successes + 1 : cur.successes;
  const totalLatencyMs = cur.totalLatencyMs + latencyMs;
  const successRate = cur.attempts === 0 ? (success ? 1 : 0) : cur.successRate * (1 - s.alpha) + (success ? 1 : 0) * s.alpha;
  const avgLatencyMs = cur.attempts === 0 ? latencyMs : cur.avgLatencyMs * (1 - s.alpha) + latencyMs * s.alpha;
  const updated: AdapterScore = { ...cur, attempts, successes, totalLatencyMs, successRate, avgLatencyMs };
  return { ...s, scores: { ...s.scores, [k]: updated } };
}

/** Get score for a specific (provider, task) pair. */
export function getScore(state: AdapterLearnerState, providerId: string, taskKind: TaskKind): AdapterScore | undefined {
  return state.scores[key(providerId, taskKind)];
}

/** Pick best provider for a task kind (only considers those with minAttempts). */
export function pickBest(state: AdapterLearnerState, taskKind: TaskKind, candidates: string[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const id of candidates) {
    const s = getScore(state, id, taskKind);
    if (!s || s.attempts < state.minAttempts) continue;
    // Composite: success rate - latency penalty (lower better)
    const composite = s.successRate - Math.min(0.5, s.avgLatencyMs / 10_000);
    if (!best || composite > best.score) best = { id, score: composite };
  }
  return best?.id ?? null;
}

/** List providers with sufficient data for a task. */
export function readyProviders(state: AdapterLearnerState, taskKind: TaskKind): string[] {
  return Object.values(state.scores)
    .filter((s) => s.taskKind === taskKind && s.attempts >= state.minAttempts)
    .map((s) => s.providerId);
}

/** Reset all scores. */
export function resetLearner(state: AdapterLearnerState): AdapterLearnerState {
  return { ...state, scores: {} };
}

/** Master metric: learning coverage 0-1 (fraction of candidates with sufficient data). */
export function learningCoverage(state: AdapterLearnerState, candidates: string[], taskKinds: TaskKind[]): number {
  const total = candidates.length * taskKinds.length;
  if (total === 0) return 1.0;
  let ready = 0;
  for (const c of candidates) for (const t of taskKinds) {
    const s = getScore(state, c, t);
    if (s && s.attempts >= state.minAttempts) ready++;
  }
  return ready / total;
}
