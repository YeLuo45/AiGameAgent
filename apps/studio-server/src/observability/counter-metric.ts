// V5 CounterMetric (Direction F 5/30, thunderbolt)
// Monotonic counter with labels

export interface CounterMetric {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

export function createCounter(name: string, opts: { help?: string; labels?: string[] } = {}): CounterMetric {
  const labels: Record<string, string> = {};
  for (const l of opts.labels ?? []) labels[l] = "";
  return { name, help: opts.help ?? "", value: 0, labels };
}

export function increment(m: CounterMetric, by: number = 1): CounterMetric {
  return { ...m, value: m.value + by };
}

export function decrement(m: CounterMetric, by: number = 1): CounterMetric {
  return { ...m, value: m.value - by };
}

export function reset(m: CounterMetric): CounterMetric {
  return { ...m, value: 0 };
}

export function setLabel(m: CounterMetric, key: string, value: string): CounterMetric {
  return { ...m, labels: { ...m.labels, [key]: value } };
}

export function getLabel(m: CounterMetric, key: string): string | undefined {
  return m.labels[key];
}

export function rate(m: CounterMetric, windowMs: number, now: number = Date.now()): number {
  // Simple rate: value / window (without knowing start time)
  return m.value / Math.max(1, windowMs / 1000);
}

/** Master metric: counter activity 0-1 (non-zero = active). */
export function counterActivity(m: CounterMetric): number {
  return m.value > 0 ? 1.0 : 0.0;
}
