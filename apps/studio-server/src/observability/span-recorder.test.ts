// V2 SpanRecorder (Direction F 2/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSpanRecorder, startSpan, endSpan, addEvent, getSpan, listSpans, spanDurationMs, spanSuccessRate,
} from "./span-recorder.js";
import { createContext } from "./tracing-context.js";

test("createSpanRecorder: empty", () => {
  const s = createSpanRecorder();
  assert.equal(Object.keys(s.spans).length, 0);
});

test("startSpan: records", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t1", "s1"));
  assert.equal(Object.keys(s.spans).length, 1);
});

test("endSpan: marks status + endTs", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "s"));
  s = endSpan(s, "s", "ok", null, 2000);
  const rec = getSpan(s, "s");
  assert.equal(rec?.status, "ok");
  assert.equal(rec?.endTs, 2000);
});

test("endSpan: error captures", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "s"));
  s = endSpan(s, "s", "error", "boom");
  assert.equal(getSpan(s, "s").error, "boom");
});

test("endSpan: no-op for missing", () => {
  let s = createSpanRecorder();
  s = endSpan(s, "missing", "ok");
  assert.equal(Object.keys(s.spans).length, 0);
});

test("addEvent: appends", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "s"));
  s = addEvent(s, "s", "checkpoint", { type: "auth" });
  assert.equal(getSpan(s, "s").events.length, 1);
});

test("getSpan: undefined for missing", () => {
  assert.equal(getSpan(createSpanRecorder(), "x"), undefined);
});

test("listSpans: all sorted by startTs", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "a", null, 200));
  s = startSpan(s, createContext("t", "b", null, 100));
  const list = listSpans(s);
  assert.equal(list[0].ctx.spanId, "b");
});

test("listSpans: filter by status", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "a"));
  s = endSpan(s, "a", "ok");
  s = startSpan(s, createContext("t", "b"));
  assert.equal(listSpans(s, "ok").length, 1);
});

test("spanDurationMs: started", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "s", null, 1000));
  assert.equal(spanDurationMs(getSpan(s, "s"), 1500), 500);
});

test("spanDurationMs: ended", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "s", null, 1000));
  s = endSpan(s, "s", "ok", null, 2500);
  assert.equal(spanDurationMs(getSpan(s, "s")), 1500);
});

test("spanSuccessRate: 1.0 for empty", () => {
  assert.equal(spanSuccessRate(createSpanRecorder()), 1.0);
});

test("spanSuccessRate: ratio", () => {
  let s = createSpanRecorder();
  s = startSpan(s, createContext("t", "a"));
  s = endSpan(s, "a", "ok");
  s = startSpan(s, createContext("t", "b"));
  s = endSpan(s, "b", "error");
  assert.equal(spanSuccessRate(s), 0.5);
});
