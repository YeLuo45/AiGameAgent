// V22 AdaptiveSchedule (Direction D 22/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createScheduleState,
  schedule,
  scheduleMany,
  nextBatch,
  markStarted,
  markCompleted,
  adjustMaxConcurrent,
  scheduleThroughput,
} from "./adaptive-schedule.js";

test("createScheduleState: defaults", () => {
  const s = createScheduleState();
  assert.equal(s.maxConcurrent, 3);
  assert.equal(s.queue.length, 0);
});

test("schedule: adds task", () => {
  const s = schedule(createScheduleState(), { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  assert.equal(s.queue.length, 1);
});

test("scheduleMany: adds multiple", () => {
  const s = scheduleMany(createScheduleState(), [
    { id: "t1", priority: "low", estimatedDurationMs: 100, ts: 1, dependsOn: [] },
    { id: "t2", priority: "high", estimatedDurationMs: 100, ts: 2, dependsOn: [] },
  ]);
  assert.equal(s.queue.length, 2);
});

test("nextBatch: empty = empty", () => {
  const s = createScheduleState();
  const r = nextBatch(s);
  assert.equal(r.next.length, 0);
});

test("nextBatch: respects max concurrent", () => {
  let s = createScheduleState(2);
  s = scheduleMany(s, [
    { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] },
    { id: "t2", priority: "normal", estimatedDurationMs: 100, ts: 2, dependsOn: [] },
    { id: "t3", priority: "normal", estimatedDurationMs: 100, ts: 3, dependsOn: [] },
  ]);
  const r = nextBatch(s);
  assert.equal(r.next.length, 2);
});

test("nextBatch: priority order", () => {
  let s = createScheduleState();
  s = scheduleMany(s, [
    { id: "low", priority: "low", estimatedDurationMs: 100, ts: 1, dependsOn: [] },
    { id: "critical", priority: "critical", estimatedDurationMs: 100, ts: 2, dependsOn: [] },
    { id: "high", priority: "high", estimatedDurationMs: 100, ts: 3, dependsOn: [] },
  ]);
  const r = nextBatch(s);
  assert.equal(r.next[0].id, "critical");
});

test("nextBatch: respects dependencies", () => {
  let s = createScheduleState();
  s = scheduleMany(s, [
    { id: "t1", priority: "high", estimatedDurationMs: 100, ts: 1, dependsOn: ["t2"] }, // depends on t2 first
    { id: "t2", priority: "low", estimatedDurationMs: 100, ts: 2, dependsOn: [] },
  ]);
  const r = nextBatch(s);
  // t1 has higher priority but depends on t2, which is in queue too
  // Since t2 is "completed" (in the algorithm's mental model), t1 should be pickable
  // Actually the algorithm checks if deps are in completedIds set (initially empty)
  // So t1 won't be added because t2 is not yet "completed" in this algorithm
  // t2 should be added first
  assert.equal(r.next[0].id, "t2");
});

test("markStarted: moves to running", () => {
  let s = createScheduleState();
  s = schedule(s, { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  s = markStarted(s, "t1");
  assert.equal(s.queue.length, 0);
  assert.deepEqual(s.running, ["t1"]);
});

test("markCompleted: moves from running", () => {
  let s = createScheduleState();
  s = schedule(s, { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  s = markStarted(s, "t1");
  s = markCompleted(s, "t1", 200);
  assert.deepEqual(s.running, []);
  assert.equal(s.totalCompleted, 1);
});

test("markCompleted: updates avg duration", () => {
  let s = createScheduleState();
  s = markCompleted(s, "t1", 200);
  // 0.7*100 + 0.3*200 = 130
  assert.equal(s.avgDurationMs, 130);
});

test("adjustMaxConcurrent: scales up for big queue", () => {
  let s = createScheduleState(2);
  for (let i = 0; i < 20; i++) s = schedule(s, { id: `t${i}`, priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  const s2 = adjustMaxConcurrent(s, 20);
  assert.ok(s2.maxConcurrent > s.maxConcurrent);
});

test("adjustMaxConcurrent: scales down for small queue", () => {
  let s = createScheduleState(5);
  s = adjustMaxConcurrent(s, 1);
  assert.ok(s.maxConcurrent < 5);
});

test("scheduleThroughput: 1.0 empty", () => {
  assert.equal(scheduleThroughput(createScheduleState()), 1.0);
});

test("scheduleThroughput: ratio", () => {
  let s = createScheduleState();
  s = schedule(s, { id: "t1", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  s = markStarted(s, "t1");
  s = markCompleted(s, "t1", 100);
  s = schedule(s, { id: "t2", priority: "normal", estimatedDurationMs: 100, ts: 1, dependsOn: [] });
  s = markStarted(s, "t2");
  s = markCompleted(s, "t2", 100);
  assert.equal(scheduleThroughput(s), 1.0);
});
