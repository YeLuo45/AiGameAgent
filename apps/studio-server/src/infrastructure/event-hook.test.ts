// V17 EventHook (Direction E 17/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventHookState,
  registerHook,
  unregisterHook,
  toggleHook,
  fireEvent,
  hookCount,
  getHook,
  hookHealth,
} from "./event-hook.js";

test("createEventHookState: empty", () => {
  const s = createEventHookState();
  assert.equal(s.hooks.length, 0);
  assert.equal(s.totalInvoked, 0);
  assert.equal(s.totalErrors, 0);
});

test("registerHook: adds hook with auto id", () => {
  let s = createEventHookState();
  s = registerHook(s, { eventType: "job.started", phase: "pre", fn: () => {}, enabled: true });
  assert.equal(s.hooks.length, 1);
  assert.equal(s.hooks[0].id, "h1");
});

test("registerHook: with custom id", () => {
  let s = createEventHookState();
  s = registerHook(s, { id: "audit-hook", eventType: "job.started", phase: "post", fn: () => {}, enabled: true });
  assert.equal(s.hooks[0].id, "audit-hook");
});

test("unregisterHook: removes by id", () => {
  let s = createEventHookState();
  s = registerHook(s, { id: "h1", eventType: "job.started", phase: "pre", fn: () => {}, enabled: true });
  s = unregisterHook(s, "h1");
  assert.equal(s.hooks.length, 0);
});

test("unregisterHook: no-op for missing", () => {
  const s = createEventHookState();
  const s1 = unregisterHook(s, "nope");
  assert.deepEqual(s1, s);
});

test("toggleHook: enables/disables", () => {
  let s = createEventHookState();
  s = registerHook(s, { eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  s = toggleHook(s, "h1", false);
  assert.equal(s.hooks[0].enabled, false);
});

test("fireEvent: invokes matching hook", async () => {
  let s = createEventHookState();
  let called = 0;
  s = registerHook(s, { eventType: "job.started", phase: "pre", fn: () => { called++; }, enabled: true });
  const r = await fireEvent(s, "job.started", { id: "j1" });
  assert.equal(called, 1);
  assert.equal(r.state.totalInvoked, 1);
});

test("fireEvent: ignores non-matching", async () => {
  let s = createEventHookState();
  let called = 0;
  s = registerHook(s, { eventType: "job.started", phase: "pre", fn: () => { called++; }, enabled: true });
  await fireEvent(s, "tool.end", {});
  assert.equal(called, 0);
});

test("fireEvent: wildcard * matches all", async () => {
  let s = createEventHookState();
  let called = 0;
  s = registerHook(s, { eventType: "*", phase: "pre", fn: () => { called++; }, enabled: true });
  await fireEvent(s, "job.started", {});
  await fireEvent(s, "tool.end", {});
  assert.equal(called, 2);
});

test("fireEvent: disabled hook skipped", async () => {
  let s = createEventHookState();
  let called = 0;
  s = registerHook(s, { eventType: "job.started", phase: "pre", fn: () => { called++; }, enabled: false });
  await fireEvent(s, "job.started", {});
  assert.equal(called, 0);
});

test("fireEvent: multiple hooks fire in order", async () => {
  let s = createEventHookState();
  const order: number[] = [];
  s = registerHook(s, { id: "h1", eventType: "job.started", phase: "pre", fn: () => { order.push(1); }, enabled: true });
  s = registerHook(s, { id: "h2", eventType: "job.started", phase: "pre", fn: () => { order.push(2); }, enabled: true });
  s = registerHook(s, { id: "h3", eventType: "*", phase: "post", fn: () => { order.push(3); }, enabled: true });
  await fireEvent(s, "job.started", {});
  assert.deepEqual(order, [1, 2, 3]);
});

test("fireEvent: errors are captured not thrown", async () => {
  let s = createEventHookState();
  let called = 0;
  s = registerHook(s, { id: "h1", eventType: "x", phase: "pre", fn: () => { throw new Error("boom"); }, enabled: true });
  s = registerHook(s, { id: "h2", eventType: "x", phase: "pre", fn: () => { called++; }, enabled: true });
  const r = await fireEvent(s, "x", {});
  assert.equal(called, 1); // second hook still runs
  assert.equal(r.errors.length, 1);
  assert.equal(r.state.totalErrors, 1);
});

test("fireEvent: async hook awaited", async () => {
  let s = createEventHookState();
  let resolved = false;
  s = registerHook(s, { eventType: "x", phase: "pre", fn: async () => { await new Promise((r) => setTimeout(r, 5)); resolved = true; }, enabled: true });
  await fireEvent(s, "x", {});
  assert.equal(resolved, true);
});

test("hookCount: filters", () => {
  let s = createEventHookState();
  s = registerHook(s, { id: "h1", eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  s = registerHook(s, { id: "h2", eventType: "y", phase: "pre", fn: () => {}, enabled: true });
  s = registerHook(s, { id: "h3", eventType: "x", phase: "post", fn: () => {}, enabled: false });
  assert.equal(hookCount(s), 3);
  assert.equal(hookCount(s, { eventType: "x" }), 2);
  assert.equal(hookCount(s, { phase: "pre" }), 2);
  assert.equal(hookCount(s, { enabledOnly: true }), 2);
});

test("getHook: returns or undefined", () => {
  let s = createEventHookState();
  s = registerHook(s, { id: "h1", eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  assert.ok(getHook(s, "h1"));
  assert.equal(getHook(s, "nope"), undefined);
});

test("hookHealth: no invocations = 1.0", () => {
  assert.equal(hookHealth(createEventHookState()), 1.0);
});

test("hookHealth: all success = 1.0", async () => {
  let s = createEventHookState();
  s = registerHook(s, { eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  await fireEvent(s, "x", {});
  assert.equal(hookHealth(s), 1.0);
});

test("hookHealth: 1 error / 3 invocations = 0.667", async () => {
  let s = createEventHookState();
  s = registerHook(s, { id: "h1", eventType: "x", phase: "pre", fn: () => { throw new Error("e"); }, enabled: true });
  s = registerHook(s, { id: "h2", eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  s = registerHook(s, { id: "h3", eventType: "x", phase: "pre", fn: () => {}, enabled: true });
  const r = await fireEvent(s, "x", {});
  assert.ok(Math.abs(hookHealth(r.state) - (2 / 3)) < 1e-9);
});
