// V25 ToolHookLifecycle (Direction B 25/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createToolHookState,
  registerToolHook,
  unregisterToolHook,
  fireToolHook,
  toggleToolHook,
  toolHookHealth,
} from "./tool-hook-lifecycle.js";

test("createToolHookState: empty", () => {
  const s = createToolHookState();
  assert.equal(s.hooks.length, 0);
});

test("registerToolHook: with auto id", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { phase: "pre", toolPattern: "*", fn: () => {}, enabled: true });
  assert.equal(s.hooks[0].id, "th1");
});

test("registerToolHook: with custom id", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { id: "audit", phase: "post", toolPattern: "Write", fn: () => {}, enabled: true });
  assert.equal(s.hooks[0].id, "audit");
});

test("unregisterToolHook: removes", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { id: "h1", phase: "pre", toolPattern: "*", fn: () => {}, enabled: true });
  s = unregisterToolHook(s, "h1");
  assert.equal(s.hooks.length, 0);
});

test("fireToolHook: matching tool + phase", () => {
  let s = createToolHookState();
  let called = 0;
  s = registerToolHook(s, { phase: "pre", toolPattern: "Read", fn: () => { called++; }, enabled: true });
  const r = fireToolHook(s, "Read", "pre");
  assert.equal(called, 1);
  assert.equal(r.state.totalInvoked, 1);
});

test("fireToolHook: pattern wildcard", () => {
  let s = createToolHookState();
  let called = 0;
  s = registerToolHook(s, { phase: "pre", toolPattern: "*", fn: () => { called++; }, enabled: true });
  fireToolHook(s, "Anything", "pre");
  assert.equal(called, 1);
});

test("fireToolHook: phase mismatch = no fire", () => {
  let s = createToolHookState();
  let called = 0;
  s = registerToolHook(s, { phase: "pre", toolPattern: "*", fn: () => { called++; }, enabled: true });
  fireToolHook(s, "Read", "post");
  assert.equal(called, 0);
});

test("fireToolHook: pattern prefix match", () => {
  let s = createToolHookState();
  let called = 0;
  s = registerToolHook(s, { phase: "pre", toolPattern: "Read*", fn: () => { called++; }, enabled: true });
  fireToolHook(s, "ReadFile", "pre");
  fireToolHook(s, "WriteFile", "pre");
  assert.equal(called, 1);
});

test("fireToolHook: error captured", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { phase: "pre", toolPattern: "*", fn: () => { throw new Error("x"); }, enabled: true });
  const r = fireToolHook(s, "Read", "pre");
  assert.equal(r.errors.length, 1);
  assert.equal(r.state.totalErrors, 1);
});

test("fireToolHook: disabled skipped", () => {
  let s = createToolHookState();
  let called = 0;
  s = registerToolHook(s, { phase: "pre", toolPattern: "*", fn: () => { called++; }, enabled: false });
  fireToolHook(s, "Read", "pre");
  assert.equal(called, 0);
});

test("toggleToolHook: toggles", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { id: "h1", phase: "pre", toolPattern: "*", fn: () => {}, enabled: true });
  s = toggleToolHook(s, "h1", false);
  assert.equal(s.hooks[0].enabled, false);
});

test("toolHookHealth: 1.0 empty", () => {
  assert.equal(toolHookHealth(createToolHookState()), 1.0);
});

test("toolHookHealth: ratio", () => {
  let s = createToolHookState();
  s = registerToolHook(s, { id: "h1", phase: "pre", toolPattern: "*", fn: () => { throw new Error("e"); }, enabled: true });
  s = registerToolHook(s, { id: "h2", phase: "pre", toolPattern: "*", fn: () => {}, enabled: true });
  const r = fireToolHook(s, "x", "pre");
  // 2 invoked, 1 error → 0.5
  assert.equal(toolHookHealth(r.state), 0.5);
});
