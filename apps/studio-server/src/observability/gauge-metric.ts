// V6 GaugeMetric (Direction F 6/30, thunderbolt)
// Point-in-time value (can go up or down)

export interface GaugeMetric {
  name: string;
  help: string;
  value: number;
  /** Min/max ever observed. */
  min: number;
  max: number;
  lastUpdateTs: number | null;
}

export function createGauge(name: string, opts: { help?: string } = {}): GaugeMetric {
  return { name, help: opts.help ?? "", value: 0, min: Infinity, max: -Infinity, lastUpdateTs: null };
}

export function setGauge(m: GaugeMetric, value: number, now: number = Date.now()): GaugeMetric {
  return { ...m, value, min: Math.min(m.min, value), max: Math.max(m.max, value), lastUpdateTs: now };
}

export function addGauge(m: GaugeMetric, by: number, now: number = Date.now()): GaugeMetric {
  return setGauge(m, m.value + by, now);
}

export function subGauge(m: GaugeMetric, by: number, now: number = Date.now()): GaugeMetric {
  return setGauge(m, m.value - by, now);
}

export function gaugeRange(m: GaugeMetric): number {
  if (m.min === Infinity || m.max === -Infinity) return 0;
  return m.max - m.min;
}

/** Master metric: gauge stability 0-1 (low range = stable). */
export function gaugeStability(m: GaugeMetric): number {
  const range = gaugeRange(m);
  return Math.max(0, 1 - range / 100);
}
