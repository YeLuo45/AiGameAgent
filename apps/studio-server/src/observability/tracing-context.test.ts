// V1 TracingContext (Direction F 1/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createContext, createChildContext, newTraceId, newSpanId,
  setAttribute, getAttribute, ageMs, isChildOf, sameTrace, traceDepth,
} from "./tracing-context.js";

test("createContext: defaults", () => {
  const c = createContext("t1", "s1");
  assert.equal(c.traceId, "t1");
  assert.equal(c.spanId, "s1");
  assert.equal(c.parentSpanId, null);
  assert.ok(c.startTs > 0);
  assert.deepEqual(c.attributes, {});
});

test("createChildContext: inherits trace + attrs", () => {
  const parent = createContext("t1", "s1");
  let p = setAttribute(parent, "k", "v");
  const child = createChildContext(p, "s2");
  assert.equal(child.traceId, "t1");
  assert.equal(child.parentSpanId, "s1");
  assert.equal(getAttribute(child, "k"), "v");
});

test("newTraceId: 16 hex chars", () => {
  const id = newTraceId();
  assert.equal(id.length, 16);
  assert.ok(/^[0-9a-f]+$/.test(id));
});

test("newSpanId: 8 hex chars", () => {
  const id = newSpanId();
  assert.equal(id.length, 8);
  assert.ok(/^[0-9a-f]+$/.test(id));
});

test("setAttribute + getAttribute", () => {
  let c = createContext("t", "s");
  c = setAttribute(c, "a", "1");
  c = setAttribute(c, "b", "2");
  assert.equal(getAttribute(c, "a"), "1");
  assert.equal(getAttribute(c, "b"), "2");
  assert.equal(getAttribute(c, "c"), undefined);
});

test("ageMs: time delta", () => {
  const c = createContext("t", "s", null, 1000);
  assert.equal(ageMs(c, 1500), 500);
});

test("isChildOf: true for matching parent", () => {
  const parent = createContext("t", "p");
  const child = createChildContext(parent, "c");
  assert.equal(isChildOf(child, "p"), true);
  assert.equal(isChildOf(parent, "x"), false);
});

test("sameTrace: same traceId", () => {
  const a = createContext("t1", "a");
  const b = createContext("t1", "b");
  const c = createContext("t2", "c");
  assert.equal(sameTrace(a, b), true);
  assert.equal(sameTrace(a, c), false);
});

test("traceDepth: single root = 1", () => {
  const c = createContext("t", "s");
  assert.equal(traceDepth([c]), 1);
});

test("traceDepth: chain of 3 = 3", () => {
  const a = createContext("t", "a");
  const b = createChildContext(a, "b");
  const c = createChildContext(b, "c");
  assert.equal(traceDepth([a, b, c]), 3);
});

test("traceDepth: empty = 0", () => {
  assert.equal(traceDepth([]), 0);
});

test("traceDepth: multiple roots = max", () => {
  const a = createContext("t", "a");
  const b = createContext("t", "b");
  const c = createChildContext(b, "c");
  assert.equal(traceDepth([a, b, c]), 2);
});
