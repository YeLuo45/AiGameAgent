// V7 HistogramMetric (Direction F 7/30, thunderbolt)
// Distribution tracking (buckets + count + sum + p50/p95/p99)

export interface HistogramMetric {
  name: string;
  /** Bucket boundaries (ascending). */
  buckets: number[];
  /** Count per bucket. */
  bucketCounts: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
  /** Sample values (for percentile). */
  samples: number[];
  maxSamples: number;
}

export function createHistogram(name: string, buckets: number[] = [0.1, 0.5, 1, 5, 10], maxSamples: number = 1000): HistogramMetric {
  buckets = [...buckets].sort((a, b) => a - b);
  return { name, buckets, bucketCounts: new Array(buckets.length).fill(0), count: 0, sum: 0, min: Infinity, max: -Infinity, samples: [], maxSamples };
}

export function observe(m: HistogramMetric, value: number): HistogramMetric {
  const newBucketCounts = [...m.bucketCounts];
  for (let i = 0; i < m.buckets.length; i++) {
    if (value <= m.buckets[i]) {
      newBucketCounts[i]++;
      break;
    }
  }
  let newSamples = m.samples;
  if (m.samples.length >= m.maxSamples) {
    newSamples = [...m.samples.slice(1), value];
  } else {
    newSamples = [...m.samples, value];
  }
  return { ...m, bucketCounts: newBucketCounts, count: m.count + 1, sum: m.sum + value, min: Math.min(m.min, value), max: Math.max(m.max, value), samples: newSamples };
}

export function mean(m: HistogramMetric): number {
  if (m.count === 0) return 0;
  return m.sum / m.count;
}

export function percentile(m: HistogramMetric, p: number): number {
  if (m.samples.length === 0) return 0;
  const sorted = [...m.samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function p50(m: HistogramMetric): number {
  return percentile(m, 50);
}

export function p95(m: HistogramMetric): number {
  return percentile(m, 95);
}

export function p99(m: HistogramMetric): number {
  return percentile(m, 99);
}

/** Master metric: histogram coverage 0-1 (count-based). */
export function histogramCoverage(m: HistogramMetric): number {
  return Math.min(1, m.count / 100);
}
