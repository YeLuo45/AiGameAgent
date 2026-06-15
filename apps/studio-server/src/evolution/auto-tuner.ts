// V16 AutoTuner (Direction D 16/30, generic-agent)
// Auto-adjust parameters based on performance trends

export interface TunableParam {
  key: string;
  value: number;
  min: number;
  max: number;
  /** EWMA history (last 5 values). */
  history: number[];
}

export interface TunerState {
  params: Record<string, TunableParam>;
  /** Targets (e.g. success_rate = 0.9). */
  targets: Record<string, number>;
}

export function createTunerState(): TunerState {
  return { params: {}, targets: {} };
}

export function setParam(state: TunerState, key: string, value: number, min: number = 0, max: number = 1): TunerState {
  const clamped = Math.max(min, Math.min(max, value));
  const cur = state.params[key];
  const history = cur ? [...cur.history, cur.value].slice(-5) : [];
  return { ...state, params: { ...state.params, [key]: { key, value: clamped, min, max, history } } };
}

export function getParam(state: TunerState, key: string): TunableParam | undefined {
  return state.params[key];
}

export function setTarget(state: TunerState, key: string, target: number): TunerState {
  return { ...state, targets: { ...state.targets, [key]: target } };
}

/** Adjust a param toward its target based on current metric value. */
export function tuneToward(state: TunerState, key: string, currentMetric: number): TunerState {
  const param = state.params[key];
  const target = state.targets[key];
  if (!param || target === undefined) return state;
  const error = target - currentMetric;
  // Proportional adjustment (scaled to 10% of value)
  const adjustment = param.value * 0.1 * error;
  const newValue = Math.max(param.min, Math.min(param.max, param.value + adjustment));
  return setParam(state, key, newValue, param.min, param.max);
}

/** Auto-tune based on multiple metric values. */
export function autoTune(state: TunerState, metrics: Record<string, number>): TunerState {
  let s = state;
  for (const [key, value] of Object.entries(metrics)) {
    s = tuneToward(s, key, value);
  }
  return s;
}

export function recentTrend(state: TunerState, key: string): "up" | "down" | "stable" | "unknown" {
  const p = state.params[key];
  if (!p || p.history.length < 2) return "unknown";
  const recent = p.history[p.history.length - 1];
  const older = p.history[0];
  if (recent > older * 1.05) return "up";
  if (recent < older * 0.95) return "down";
  return "stable";
}

/** Master metric: tuning stability 0-1 (low = volatile, high = stable). */
export function tuningStability(state: TunerState): number {
  const params = Object.values(state.params);
  if (params.length === 0) return 1.0;
  const totalVolatility = params.reduce((acc, p) => {
    if (p.history.length < 2) return acc;
    const recent = p.history[p.history.length - 1];
    const older = p.history[0];
    return acc + Math.abs(recent - older) / Math.max(1, p.value);
  }, 0);
  return Math.max(0, 1 - totalVolatility / params.length);
}
