// V3 DistributedTrace (Direction F 3/30, thunderbolt)
// Tree of spans linked by parent/child

import { type TraceContext } from "./tracing-context.js";
import { type SpanRecord, type SpanRecorderState } from "./span-recorder.js";

export interface TraceTreeNode {
  span: SpanRecord;
  children: TraceTreeNode[];
}

export function buildTraceTree(state: SpanRecorderState, traceId: string): TraceTreeNode | null {
  const spans = Object.values(state.spans).filter((s) => s.ctx.traceId === traceId);
  if (spans.length === 0) return null;
  spans.sort((a, b) => a.ctx.startTs - b.ctx.startTs);
  const byId = new Map<string, TraceTreeNode>();
  for (const s of spans) byId.set(s.ctx.spanId, { span: s, children: [] });
  let root: TraceTreeNode | null = null;
  for (const node of byId.values()) {
    const parent = node.span.ctx.parentSpanId ? byId.get(node.span.ctx.parentSpanId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      root = node;
    }
  }
  return root;
}

export function treeDepth(node: TraceTreeNode | null): number {
  if (!node) return 0;
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(treeDepth));
}

export function treeSpanCount(node: TraceTreeNode | null): number {
  if (!node) return 0;
  return 1 + node.children.reduce((a, c) => a + treeSpanCount(c), 0);
}

export function treeFindById(node: TraceTreeNode | null, spanId: string): TraceTreeNode | null {
  if (!node) return null;
  if (node.span.ctx.spanId === spanId) return node;
  for (const c of node.children) {
    const found = treeFindById(c, spanId);
    if (found) return found;
  }
  return null;
}

export function treeTotalDurationMs(node: TraceTreeNode | null, now: number = Date.now()): number {
  if (!node) return 0;
  const myDur = node.span.endTs ? node.span.endTs - node.span.ctx.startTs : now - node.span.ctx.startTs;
  const childDur = node.children.reduce((a, c) => a + treeTotalDurationMs(c, now), 0);
  return Math.max(myDur, childDur);
}

/** Master metric: trace complexity 0-1 (based on span count). */
export function traceComplexity(spanCount: number): number {
  return Math.min(1, spanCount / 20);
}
