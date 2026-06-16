// V3 DistributedTrace (Direction F 3/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTraceTree, treeDepth, treeSpanCount, treeFindById, treeTotalDurationMs, traceComplexity } from "./distributed-trace.js";
import { createSpanRecorder, startSpan, endSpan } from "./span-recorder.js";
import { createContext, createChildContext } from "./tracing-context.js";

test("buildTraceTree: empty", () => {
  assert.equal(buildTraceTree(createSpanRecorder(), "t1"), null);
});

test("buildTraceTree: single span", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a"));
  const tree = buildTraceTree(s, "t1");
  assert.ok(tree);
  assert.equal(tree?.span.ctx.spanId, "a");
  assert.equal(tree?.children.length, 0);
});

test("buildTraceTree: parent-child", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a", null, 0));
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "b", 100));
  const tree = buildTraceTree(s, "t1");
  assert.equal(tree?.span.ctx.spanId, "a");
  assert.equal(tree?.children.length, 1);
  assert.equal(tree?.children[0].span.ctx.spanId, "b");
});

test("buildTraceTree: multiple traces isolated", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a"));
  s = startSpan(s, createContext("t2", "b"));
  const tree1 = buildTraceTree(s, "t1");
  const tree2 = buildTraceTree(s, "t2");
  assert.equal(tree1?.span.ctx.spanId, "a");
  assert.equal(tree2?.span.ctx.spanId, "b");
});

test("treeDepth: leaf = 1", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a"));
  assert.equal(treeDepth(buildTraceTree(s, "t1")), 1);
});

test("treeDepth: chain of 3 = 3", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a", null, 0));
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "b", 1));
  s = startSpan(s, createChildContext(s.spans["b"].ctx, "c", 2));
  assert.equal(treeDepth(buildTraceTree(s, "t1")), 3);
});

test("treeSpanCount: counts all", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a", null, 0));
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "b", 1));
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "c", 1));
  assert.equal(treeSpanCount(buildTraceTree(s, "t1")), 3);
});

test("treeFindById: found", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a", null, 0));
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "b", 1));
  const node = treeFindById(buildTraceTree(s, "t1"), "b");
  assert.equal(node?.span.ctx.spanId, "b");
});

test("treeFindById: not found = null", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a"));
  assert.equal(treeFindById(buildTraceTree(s, "t1"), "x"), null);
});

test("treeTotalDurationMs: returns max of self vs children", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "a", null, 0));
  s = endSpan(s, "a", "ok", null, 1000);
  s = startSpan(s, createChildContext(s.spans["a"].ctx, "b", 100));
  s = endSpan(s, "b", "ok", null, 500);
  assert.equal(treeTotalDurationMs(buildTraceTree(s, "t1")), 1000);
});

test("traceComplexity: 0 for 0", () => {
  assert.equal(traceComplexity(0), 0);
});

test("traceComplexity: 1.0 for 20+", () => {
  assert.equal(traceComplexity(20), 1.0);
});
