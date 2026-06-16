// V23 RateLimit (Direction G 23/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimit, checkLimit, recordRequest, clearKey, clearAll, rateLimitFairness } from "./rate-limit.js";

test("createRateLimit: empty", () => {
  const s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  assert.deepEqual(s.windows, {});
});

test("checkLimit: allows within limit", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 3 });
  const r = checkLimit(s, "key1", 1000);
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 2);
  s = r.state;
});

test("checkLimit: blocks when exceeded", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 2 });
  const r1 = checkLimit(s, "key1", 1000);
  s = r1.state;
  const r2 = checkLimit(s, "key1", 1100);
  s = r2.state;
  const r3 = checkLimit(s, "key1", 1200);
  assert.equal(r3.allowed, false);
});

test("checkLimit: counts", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  for (let i = 0; i < 5; i++) {
    const r = checkLimit(s, "key1", 1000 + i);
    s = r.state;
    assert.equal(r.allowed, true);
  }
  const r = checkLimit(s, "key1", 1010);
  assert.equal(r.allowed, false);
});

test("checkLimit: resetAt = oldest + windowMs", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 1 });
  const r1 = checkLimit(s, "key1", 1000);
  s = r1.state;
  const r = checkLimit(s, "key1", 1100);
  // First check at 1000 (allowed), second at 1100 (blocked)
  // resetAt = oldest timestamp + windowMs = 1000 + 1000 = 2000
  assert.equal(r.resetAt, 2000);
});

test("recordRequest: appends timestamp", () => {
  const s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  const s2 = recordRequest(s, "key1", 1000);
  assert.equal(s2.windows["key1"].length, 1);
});

test("clearKey: removes", () => {
  const s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  const s1 = recordRequest(s, "key1", 1000);
  const s2 = clearKey(s1, "key1");
  assert.deepEqual(s2.windows["key1"], undefined);
});

test("clearAll: empties", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  s = recordRequest(s, "key1");
  s = recordRequest(s, "key2");
  s = clearAll(s);
  assert.deepEqual(s.windows, {});
});

test("rateLimitFairness: 1.0 for empty", () => {
  assert.equal(rateLimitFairness(createRateLimit({ windowMs: 1000, maxRequests: 5 })), 1.0);
});

test("rateLimitFairness: 1.0 for uniform usage", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  s = recordRequest(s, "k1");
  s = recordRequest(s, "k2");
  s = recordRequest(s, "k3");
  assert.equal(rateLimitFairness(s), 1.0);
});

test("rateLimitFairness: lower for skewed", () => {
  let s = createRateLimit({ windowMs: 1000, maxRequests: 5 });
  s = recordRequest(s, "k1");
  for (let i = 0; i < 10; i++) s = recordRequest(s, "k2");
  assert.ok(rateLimitFairness(s) < 1.0);
});
