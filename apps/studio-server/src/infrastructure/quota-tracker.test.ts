// V19 QuotaTracker (Direction E 19/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createQuota,
  tryConsume,
  remaining,
  msUntilReset,
  resetQuota,
  usageRatio,
  quotaHeadroom,
} from "./quota-tracker.js";

const DAY = 24 * 60 * 60 * 1000;

test("createQuota: defaults", () => {
  const s = createQuota("p1", 1000);
  assert.equal(s.providerId, "p1");
  assert.equal(s.dailyLimit, 1000);
  assert.equal(s.usedToday, 0);
  assert.equal(s.totalUsed, 0);
  assert.equal(s.totalOverLimit, 0);
});

test("tryConsume: within limit succeeds", () => {
  const s = createQuota("p1", 1000);
  const r = tryConsume(s, 100);
  assert.equal(r.ok, true);
  assert.equal(r.state.usedToday, 100);
  assert.equal(r.state.totalUsed, 100);
  assert.equal(r.remaining, 900);
});

test("tryConsume: over limit fails + counter", () => {
  const s = createQuota("p1", 100);
  const r = tryConsume(s, 200);
  assert.equal(r.ok, false);
  assert.equal(r.state.usedToday, 0);
  assert.equal(r.state.totalOverLimit, 1);
});

test("tryConsume: exactly at limit", () => {
  const s = createQuota("p1", 100);
  const r = tryConsume(s, 100);
  assert.equal(r.ok, true);
  assert.equal(r.remaining, 0);
});

test("tryConsume: multiple partial consumes", () => {
  let s = createQuota("p1", 1000);
  s = tryConsume(s, 300).state;
  s = tryConsume(s, 400).state;
  s = tryConsume(s, 200).state;
  const r = tryConsume(s, 200); // would exceed
  assert.equal(r.ok, false);
  assert.equal(r.remaining, 100);
});

test("tryConsume: resets after 24h", () => {
  const now = Date.now();
  let s = createQuota("p1", 100);
  // Force windowStartedAt to a known time
  s = { ...s, windowStartedAt: now - DAY }; // started yesterday
  const r1 = tryConsume(s, 100, now - DAY + 1000); // consumed yesterday
  // Advance 24h+1s past window
  const r2 = tryConsume(r1.state, 50, now + 1000);
  assert.equal(r2.ok, true);
  assert.equal(r2.state.usedToday, 50); // reset
});

test("remaining: 0 for empty", () => {
  assert.equal(remaining(createQuota("p1", 100)), 100);
});

test("remaining: decreases", () => {
  let s = createQuota("p1", 100);
  s = tryConsume(s, 30).state;
  assert.equal(remaining(s), 70);
});

test("msUntilReset: 24h initially", () => {
  const now = Date.now();
  const s = { ...createQuota("p1", 100), windowStartedAt: now };
  const ms = msUntilReset(s, now);
  assert.equal(ms, DAY);
});

test("msUntilReset: 0 after window", () => {
  const now = Date.now();
  const s = { ...createQuota("p1", 100), windowStartedAt: now - DAY - 1000 };
  assert.equal(msUntilReset(s, now), 0);
});

test("resetQuota: zeros usedToday", () => {
  let s = createQuota("p1", 100);
  s = tryConsume(s, 50).state;
  s = resetQuota(s, 1000);
  assert.equal(s.usedToday, 0);
  assert.equal(s.windowStartedAt, 1000);
  assert.equal(s.totalUsed, 50); // total preserved
});

test("usageRatio: 0 empty", () => {
  assert.equal(usageRatio(createQuota("p1", 100)), 0);
});

test("usageRatio: 0.5 at half", () => {
  let s = createQuota("p1", 100);
  s = tryConsume(s, 50).state;
  assert.equal(usageRatio(s), 0.5);
});

test("usageRatio: clamped to 1.0", () => {
  const s = createQuota("p1", 100);
  // over-consume is impossible normally, but ratio clamps
  assert.equal(usageRatio({ ...s, usedToday: 200 }), 1.0);
});

test("usageRatio: 0 when limit 0", () => {
  assert.equal(usageRatio(createQuota("p1", 0)), 0);
});

test("quotaHeadroom: 1.0 empty", () => {
  assert.equal(quotaHeadroom(createQuota("p1", 100)), 1.0);
});

test("quotaHeadroom: 0.5 at half", () => {
  let s = createQuota("p1", 100);
  s = tryConsume(s, 50).state;
  assert.equal(quotaHeadroom(s), 0.5);
});

test("quotaHeadroom: 0 at full", () => {
  let s = createQuota("p1", 100);
  s = tryConsume(s, 100).state;
  assert.equal(quotaHeadroom(s), 0);
});
