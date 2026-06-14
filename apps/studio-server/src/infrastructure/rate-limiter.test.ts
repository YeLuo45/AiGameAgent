// V7 RateLimiter (Direction E 7/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  tryAcquire,
  peekTokens,
  timeUntilAvailable,
  reset,
  denyRatio,
  rateLimiterEfficiency,
} from "./rate-limiter.js";

test("createRateLimiter: starts full", () => {
  const s = createRateLimiter("p1", 10, 1);
  assert.equal(s.tokens, 10);
  assert.equal(s.totalAllowed, 0);
  assert.equal(s.totalDenied, 0);
});

test("tryAcquire: success when tokens available", () => {
  let s = createRateLimiter("p1", 10, 1);
  const r = tryAcquire(s, 1, 1000);
  assert.equal(r.ok, true);
  assert.equal(r.state.tokens, 9);
  assert.equal(r.state.totalAllowed, 1);
});

test("tryAcquire: failure when depleted", () => {
  let s = createRateLimiter("p1", 1, 0.1);
  s = tryAcquire(s, 1, 1000).state; // tokens = 0
  const r = tryAcquire(s, 1, 1000);
  assert.equal(r.ok, false);
  assert.ok(r.retryAfterMs > 0);
  assert.equal(r.state.totalDenied, 1);
});

test("tryAcquire: refills over time", () => {
  let s = createRateLimiter("p1", 1, 10); // 10 tokens per second
  s = tryAcquire(s, 1, 1000).state; // tokens = 0
  // 100ms later should have 1 token back
  s = tryAcquire(s, 1, 1100).state; // should succeed
  assert.equal(s.totalAllowed, 2);
});

test("tryAcquire: refill capped at capacity", () => {
  let s = createRateLimiter("p1", 5, 10);
  s = tryAcquire(s, 1, 1000).state; // 4 tokens
  // After 60 seconds, would refill 600, capped at 5
  s = tryAcquire(s, 0, 61_000).state; // peek with 0 consumption
  assert.ok(s.tokens <= 5);
});

test("peekTokens: doesn't consume", () => {
  let s = createRateLimiter("p1", 5, 1);
  const before = peekTokens(s, 1000);
  const after = peekTokens(s, 1000);
  assert.equal(before, after);
  assert.equal(s.tokens, 5);
});

test("timeUntilAvailable: 0 when available", () => {
  const s = createRateLimiter("p1", 5, 1);
  assert.equal(timeUntilAvailable(s, 1, 1000), 0);
});

test("timeUntilAvailable: ms to wait when depleted", () => {
  const s = createRateLimiter("p1", 0, 10);
  // need 5 tokens, 10/s = 0.5s = 500ms
  assert.equal(timeUntilAvailable(s, 5, 1000), 500);
});

test("reset: back to full", () => {
  let s = createRateLimiter("p1", 10, 1);
  s = tryAcquire(s, 5, 1000).state;
  s = tryAcquire(s, 5, 1000).state; // empty
  s = reset(s, 1000);
  assert.equal(s.tokens, 10);
  assert.equal(s.totalAllowed, 0);
});

test("denyRatio: 0 when no traffic", () => {
  assert.equal(denyRatio(createRateLimiter("p1", 1, 1)), 0);
});

test("denyRatio: 1 when all denied", () => {
  let s = createRateLimiter("p1", 1, 0.0001);
  s = tryAcquire(s, 1, 1000).state; // 1 allowed
  s = tryAcquire(s, 1, 1000).state; // 1 denied
  s = tryAcquire(s, 1, 1000).state; // 2 denied
  assert.equal(denyRatio(s), 2 / 3);
});

test("denyRatio: 0.5 mixed", () => {
  let s = createRateLimiter("p1", 1, 0.0001);
  s = tryAcquire(s, 1, 1000).state; // 1 allowed
  s = tryAcquire(s, 1, 1000).state; // denied
  assert.equal(denyRatio(s), 0.5);
});

test("rateLimiterEfficiency: 1.0 with no traffic", () => {
  assert.equal(rateLimiterEfficiency(createRateLimiter("p1", 1, 1)), 1.0);
});

test("rateLimiterEfficiency: equals 1 - denyRatio", () => {
  let s = createRateLimiter("p1", 1, 0.0001);
  s = tryAcquire(s, 1, 1000).state;
  s = tryAcquire(s, 1, 1000).state;
  s = tryAcquire(s, 1, 1000).state;
  assert.equal(rateLimiterEfficiency(s) + denyRatio(s), 1);
});
