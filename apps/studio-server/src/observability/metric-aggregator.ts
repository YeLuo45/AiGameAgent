// V8 MetricAggregator (Direction F 8/30, thunderbolt)
// Window-based aggregation (1m / 5m / 1h)

export type Window = "1m" | "5m" | "1h" | "24h";

export const WINDOW_MS: Record<Window, number> = { "1m": 60_000, "5m": 300_000, "1h": 3_600_000, "24h": 86_400_000 };

export interface WindowedValue {
  window: Window;
  sum: number;
  count: number;
  min: number;
  max: number;
}

export interface AggregatorState {
  /** name → window → values. */
  data: Record<string, Record<Window, WindowedValue>>;
}

export function createAggregatorState(): AggregatorState {
  return { data: {} };
}

export function addObservation(state: AggregatorState, name: string, value: number, window: Window, now: number = Date.now()): AggregatorState {
  const cur = state.data[name]?.[window] ?? { window, sum: 0, count: 0, min: Infinity, max: -Infinity };
  const updated: WindowedValue = { window, sum: cur.sum + value, count: cur.count + 1, min: Math.min(cur.min, value), max: Math.max(cur.max, value) };
  return { ...state, data: { ...state.data, [name]: { ...(state.data[name] ?? {} as Record<Window, WindowedValue>), [window]: updated } } };
}

export function getWindowed(state: AggregatorState, name: string, window: Window): WindowedValue | undefined {
  return state.data[name]?.[window];
}

export function windowedAverage(state: AggregatorState, name: string, window: Window): number {
  const w = state.data[name]?.[window];
  if (!w || w.count === 0) return 0;
  return w.sum / w.count;
}

export function windowedRate(state: AggregatorState, name: string, window: Window): number {
  const w = state.data[name]?.[window];
  if (!w) return 0;
  return w.count / (WINDOW_MS[window] / 1000);
}

export function cleanupWindow(state: AggregatorState, name: string, window: Window): AggregatorState {
  const existing = state.data[name];
  if (!existing) return state;
  const { [window]: _, ...rest } = existing;
  return { ...state, data: { ...state.data, [name]: rest } };
}

/** Master metric: aggregation coverage 0-1. */
export function aggregationCoverage(state: AggregatorState): number {
  const names = Object.keys(state.data);
  if (names.length === 0) return 0;
  const totalWindows = 4;
  let total = 0;
  for (const name of names) total += Object.keys(state.data[name]).length;
  return total / (names.length * totalWindows);
}
