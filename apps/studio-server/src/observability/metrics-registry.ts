// V4 MetricsRegistry (Direction F 4/30, thunderbolt)
// Multi-type metric registry (counter + gauge + histogram)

import { type CounterMetric, createCounter, increment, decrement } from "./counter-metric.js";
import { type GaugeMetric, createGauge, setGauge } from "./gauge-metric.js";
import { type HistogramMetric, createHistogram, observe as histObserve } from "./histogram-metric.js";

export type MetricKind = "counter" | "gauge" | "histogram";

export interface MetricEntry {
  name: string;
  kind: MetricKind;
  ref: CounterMetric | GaugeMetric | HistogramMetric;
}

export interface MetricsRegistryState {
  metrics: Record<string, MetricEntry>;
}

export function createMetricsRegistry(): MetricsRegistryState {
  return { metrics: {} };
}

export function registerCounter(state: MetricsRegistryState, name: string, opts: { help?: string; labels?: string[] } = {}): MetricsRegistryState {
  return { ...state, metrics: { ...state.metrics, [name]: { name, kind: "counter", ref: createCounter(name, opts) } } };
}

export function registerGauge(state: MetricsRegistryState, name: string, opts: { help?: string } = {}): MetricsRegistryState {
  return { ...state, metrics: { ...state.metrics, [name]: { name, kind: "gauge", ref: createGauge(name, opts) } } };
}

export function registerHistogram(state: MetricsRegistryState, name: string, buckets: number[] = [0.1, 0.5, 1, 5, 10]): MetricsRegistryState {
  return { ...state, metrics: { ...state.metrics, [name]: { name, kind: "histogram", ref: createHistogram(name, buckets) } } };
}

export function getEntry(state: MetricsRegistryState, name: string): MetricEntry | undefined {
  return state.metrics[name];
}

export function listEntries(state: MetricsRegistryState, kind?: MetricKind): MetricEntry[] {
  let arr = Object.values(state.metrics);
  if (kind) arr = arr.filter((e) => e.kind === kind);
  return arr;
}

export function recordValue(state: MetricsRegistryState, name: string, value: number): MetricsRegistryState {
  const e = state.metrics[name];
  if (!e) return state;
  let ref = e.ref;
  if (e.kind === "counter") ref = increment(ref as CounterMetric, value);
  else if (e.kind === "gauge") ref = setGauge(ref as GaugeMetric, value);
  else if (e.kind === "histogram") ref = histObserve(ref as HistogramMetric, value);
  return { ...state, metrics: { ...state.metrics, [name]: { ...e, ref } } };
}

/** Master metric: registry coverage 0-1 (counts / names). */
export function registryCoverage(state: MetricsRegistryState): number {
  const counters = listEntries(state, "counter").length;
  const gauges = listEntries(state, "gauge").length;
  const histograms = listEntries(state, "histogram").length;
  if (counters + gauges + histograms === 0) return 0;
  // All 3 kinds present = 1.0
  const kinds = (counters > 0 ? 1 : 0) + (gauges > 0 ? 1 : 0) + (histograms > 0 ? 1 : 0);
  return kinds / 3;
}
