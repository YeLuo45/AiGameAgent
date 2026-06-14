// V15 ConnectionPool (Direction E 15/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createConnectionPool,
  checkout,
  release,
  closeConnection,
  evictClosed,
  poolStats,
  poolHealth,
} from "./connection-pool.js";

test("createConnectionPool: pre-creates minSize", () => {
  const s = createConnectionPool("p1", 5, 2);
  assert.equal(s.connections.length, 2);
  assert.equal(s.connections.filter((c) => c.state === "idle").length, 2);
  assert.equal(s.totalCreated, 2);
});

test("createConnectionPool: zero minSize", () => {
  const s = createConnectionPool("p1", 5, 0);
  assert.equal(s.connections.length, 0);
});

test("checkout: uses idle connection", () => {
  const s0 = createConnectionPool("p1", 5, 1);
  const r = checkout(s0);
  assert.ok(r.conn);
  assert.equal(r.conn?.state, "in-use");
  assert.equal(s0.connections.length, r.state.connections.length); // no new
});

test("checkout: creates new when no idle and below max", () => {
  const s0 = createConnectionPool("p1", 5, 0);
  const r = checkout(s0);
  assert.ok(r.conn);
  assert.equal(r.state.connections.length, 1);
  assert.equal(r.state.totalCreated, 1);
});

test("checkout: returns null + waitTime when pool full", () => {
  const s0 = createConnectionPool("p1", 1, 1);
  const r1 = checkout(s0);
  const r2 = checkout(r1.state);
  assert.equal(r2.conn, null);
  assert.equal(r2.waitTimeMs, 50);
});

test("checkout: increments totalCheckouts", () => {
  const s0 = createConnectionPool("p1", 5, 1);
  const r1 = checkout(s0);
  const r2 = checkout(r1.state);
  assert.equal(r2.state.totalCheckouts, 2);
});

test("release: sets state to idle and increments useCount", () => {
  const s0 = createConnectionPool("p1", 1, 1);
  const r = checkout(s0);
  const s1 = release(r.state, r.conn!.id);
  const c = s1.connections[0];
  assert.equal(c.state, "idle");
  assert.equal(c.useCount, 1);
});

test("release: no-op for missing conn", () => {
  const s0 = createConnectionPool("p1", 1, 1);
  const s1 = release(s0, "nope");
  assert.equal(s1, s0);
});

test("closeConnection: no-op for missing", () => {
  const s = createConnectionPool("p1", 2, 1);
  const s1 = closeConnection(s, "nope");
  assert.equal(s1, s);
  assert.equal(s1.totalClosed, 0);
});

test("evictClosed: no closed = no change", () => {
  const s = createConnectionPool("p1", 2, 1);
  const s1 = evictClosed(s);
  assert.equal(s1.connections.length, s.connections.length);
});

test("poolStats: empty pool = all zero", () => {
  const s = createConnectionPool("p1", 5, 0);
  const stats = poolStats(s);
  assert.equal(stats.idle, 0);
  assert.equal(stats.inUse, 0);
  assert.equal(stats.closed, 0);
  assert.equal(stats.utilization, 0);
});

test("evictClosed: removes closed conns", () => {
  const s0 = createConnectionPool("p1", 3, 1);
  const r = checkout(s0);
  const s1 = closeConnection(r.state, r.conn!.id);
  const s2 = evictClosed(s1);
  assert.equal(s2.connections.length, 0);
});

test("poolStats: counts by state", () => {
  const s0 = createConnectionPool("p1", 3, 2);
  const r1 = checkout(s0);
  const r2 = checkout(r1.state);
  const stats = poolStats(r2.state);
  assert.equal(stats.inUse, 2);
  assert.equal(stats.idle, 0);
  assert.equal(stats.utilization, 2 / 3);
});

test("poolHealth: full idle = high", () => {
  const s0 = createConnectionPool("p1", 5, 2);
  // 2 idle / 5 max = 0.4 idleRatio * 0.7 + 1.0 * 0.3 = 0.28 + 0.3 = 0.58
  assert.ok(Math.abs(poolHealth(s0) - 0.58) < 1e-9);
});

test("poolHealth: full in-use = lower", () => {
  const s0 = createConnectionPool("p1", 3, 1);
  const r1 = checkout(s0);
  const r2 = checkout(r1.state);
  const r3 = checkout(r2.state);
  // 0 idle / 3 = 0 idleRatio + 0 utilization * 0.3 = 0
  assert.equal(poolHealth(r3.state), 0);
});

test("poolHealth: closed penalty", () => {
  const s0 = createConnectionPool("p1", 3, 1);
  const r = checkout(s0);
  const s1 = closeConnection(r.state, r.conn!.id);
  // 0 idle, 0 inUse, 1 closed. idleRatio=0/3=0, util=0/3=0
  // 0 * 0.7 + 1.0 * 0.3 - 0 (1 closed, minSize=1) = 0.3
  assert.ok(Math.abs(poolHealth(s1) - 0.3) < 1e-9);
});
