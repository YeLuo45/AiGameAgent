// V16 JobLifecycle (Direction E 16/30, ruflo) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  transitionJob,
  createJob,
  isTerminal,
  isActive,
  queueWaitMs,
  lifecycleHealth,
} from "./job-lifecycle.js";

test("canTransition: queued → running", () => {
  assert.equal(canTransition("queued", "running"), true);
});

test("canTransition: queued → cancelled", () => {
  assert.equal(canTransition("queued", "cancelled"), true);
});

test("canTransition: running → done", () => {
  assert.equal(canTransition("running", "done"), true);
});

test("canTransition: running → failed", () => {
  assert.equal(canTransition("running", "failed"), true);
});

test("canTransition: done is terminal", () => {
  assert.equal(canTransition("done", "queued"), false);
  assert.equal(canTransition("done", "running"), false);
  assert.equal(canTransition("done", "failed"), false);
});

test("canTransition: failed is terminal", () => {
  assert.equal(canTransition("failed", "queued"), false);
});

test("canTransition: cannot skip queued → done", () => {
  assert.equal(canTransition("queued", "done"), false);
});

test("transitionJob: queued → running sets startedAt", () => {
  const j = createJob("j1", "a1", "task");
  const j2 = transitionJob(j, "running");
  assert.equal(j2.status, "running");
  assert.ok(j2.startedAt !== null);
  assert.equal(j2.finishedAt, null);
});

test("transitionJob: running → done sets durationMs", () => {
  const j = createJob("j1", "a1", "task");
  const j2 = transitionJob(j, "running");
  // Simulate delay
  const j3 = { ...j2, startedAt: j2.startedAt! - 100 };
  const j4 = transitionJob(j3, "done");
  assert.equal(j4.status, "done");
  assert.ok((j4.durationMs ?? 0) >= 100);
});

test("transitionJob: running → failed with reason", () => {
  const j = createJob("j1", "a1", "task");
  const j2 = transitionJob(j, "running");
  const j3 = transitionJob(j2, "failed", "ECONNREFUSED");
  assert.equal(j3.status, "failed");
  assert.equal(j3.failureReason, "ECONNREFUSED");
});

test("transitionJob: invalid transition throws", () => {
  const j = createJob("j1", "a1", "task");
  assert.throws(() => transitionJob(j, "done"));
});

test("createJob: defaults", () => {
  const j = createJob("j1", "a1", "task");
  assert.equal(j.status, "queued");
  assert.equal(j.priority, 0);
  assert.ok(j.startedAt === null);
  assert.ok(j.finishedAt === null);
});

test("isTerminal: done/failed/cancelled", () => {
  assert.equal(isTerminal("done"), true);
  assert.equal(isTerminal("failed"), true);
  assert.equal(isTerminal("cancelled"), true);
  assert.equal(isTerminal("queued"), false);
  assert.equal(isTerminal("running"), false);
});

test("isActive: queued/running", () => {
  assert.equal(isActive("queued"), true);
  assert.equal(isActive("running"), true);
  assert.equal(isActive("done"), false);
  assert.equal(isActive("failed"), false);
  assert.equal(isActive("cancelled"), false);
});

test("queueWaitMs: returns 0 for not started", () => {
  const j = createJob("j1", "a1", "task");
  // Just created, wait should be very small
  const wait = queueWaitMs(j);
  assert.ok(wait >= 0 && wait < 1000);
});

test("queueWaitMs: returns started - created", () => {
  const j = { ...createJob("j1", "a1", "task"), createdAt: 1000, startedAt: 1500 };
  assert.equal(queueWaitMs(j), 500);
});

test("lifecycleHealth: empty = 1.0", () => {
  assert.equal(lifecycleHealth([]), 1.0);
});

test("lifecycleHealth: all success = 1.0", () => {
  const jobs = [
    { ...createJob("j1", "a", "t"), status: "done" as const },
    { ...createJob("j2", "a", "t"), status: "done" as const },
  ];
  assert.equal(lifecycleHealth(jobs), 1.0);
});

test("lifecycleHealth: half success = 0.5", () => {
  const jobs = [
    { ...createJob("j1", "a", "t"), status: "done" as const },
    { ...createJob("j2", "a", "t"), status: "failed" as const },
  ];
  assert.equal(lifecycleHealth(jobs), 0.5);
});

test("lifecycleHealth: no finished jobs = 1.0 (idle)", () => {
  const jobs = [createJob("j1", "a", "t"), { ...createJob("j2", "a", "t"), status: "running" as const }];
  assert.equal(lifecycleHealth(jobs), 1.0);
});
