// V1 TracingContext (Direction F 1/30, thunderbolt)
// Trace ID + span ID propagation across async boundaries

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  startTs: number;
  /** Free-form attributes. */
  attributes: Record<string, string>;
}

export function createContext(traceId: string, spanId: string, parentSpanId: string | null = null, startTs: number = Date.now()): TraceContext {
  return { traceId, spanId, parentSpanId, startTs, attributes: {} };
}

export function createChildContext(parent: TraceContext, childSpanId: string, startTs: number = Date.now()): TraceContext {
  return { traceId: parent.traceId, spanId: childSpanId, parentSpanId: parent.spanId, startTs, attributes: { ...parent.attributes } };
}

export function newTraceId(): string {
  return randomHex(16);
}

export function newSpanId(): string {
  return randomHex(8);
}

function randomHex(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function setAttribute(ctx: TraceContext, key: string, value: string): TraceContext {
  return { ...ctx, attributes: { ...ctx.attributes, [key]: value } };
}

export function getAttribute(ctx: TraceContext, key: string): string | undefined {
  return ctx.attributes[key];
}

export function ageMs(ctx: TraceContext, now: number = Date.now()): number {
  return now - ctx.startTs;
}

export function isChildOf(ctx: TraceContext, parentSpanId: string): boolean {
  return ctx.parentSpanId === parentSpanId;
}

export function sameTrace(a: TraceContext, b: TraceContext): boolean {
  return a.traceId === b.traceId;
}

/** Master metric: trace depth (longest chain). */
export function traceDepth(contexts: TraceContext[]): number {
  if (contexts.length === 0) return 0;
  const byId = new Map(contexts.map((c) => [c.spanId, c] as const));
  function depth(c: TraceContext, visiting: Set<string>): number {
    if (visiting.has(c.spanId)) return 0;
    visiting.add(c.spanId);
    if (!c.parentSpanId) {
      visiting.delete(c.spanId);
      return 1;
    }
    const parent = byId.get(c.parentSpanId);
    visiting.delete(c.spanId);
    return parent ? 1 + depth(parent, visiting) : 1;
  }
  return Math.max(...contexts.map((c) => depth(c, new Set())));
}
