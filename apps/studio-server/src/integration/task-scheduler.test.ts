// V29 TaskScheduler (Direction C 29/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskScheduler,
  enqueue,
  nextJobs,
  startJob,
  completeJob,
  pendingJobs,
  jobStatus,
  schedulerThroughput,
} from "./task-scheduler.js";

test("createTaskScheduler: defaults", () => {
  const s = createTaskScheduler();
  assert.equal(s.queue.length, 0);
  assert.equal(s.maxConcurrent, 3);
});

test("enqueue: adds", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  assert.equal(s.queue.length, 1);
});

test("nextJobs: empty", () => {
  assert.equal(nextJobs(createTaskScheduler()).length, 0);
});

test("nextJobs: respects max concurrent", () => {
  let s = createTaskScheduler(2);
  for (let i = 0; i < 5; i++) s = enqueue(s, { id: `j${i}`, priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  assert.equal(nextJobs(s).length, 2);
});

test("nextJobs: priority order", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "low", priority: "low", payload: {}, ts: 1, dependsOn: [] });
  s = enqueue(s, { id: "critical", priority: "critical", payload: {}, ts: 2, dependsOn: [] });
  const next = nextJobs(s);
  assert.equal(next[0].id, "critical");
});

test("nextJobs: deadline priority", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "soon", priority: "normal", payload: {}, ts: 1, dependsOn: [], deadlineAt: 100 });
  s = enqueue(s, { id: "late", priority: "normal", payload: {}, ts: 1, dependsOn: [], deadlineAt: 1000 });
  const next = nextJobs(s);
  assert.equal(next[0].id, "soon");
});

test("nextJobs: respects dependencies", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "high", payload: {}, ts: 1, dependsOn: ["j2"] });
  s = enqueue(s, { id: "j2", priority: "low", payload: {}, ts: 2, dependsOn: [] });
  const next = nextJobs(s);
  // j2 is not in completed yet → can't pick j1
  // But j2 has no deps → it can be picked
  // Actually j1 is filtered out because j2 is not in completed
  // So only j2 is returned
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "j2");
});

test("startJob: moves to running", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  s = startJob(s, "j1");
  assert.equal(s.queue.length, 0);
  assert.deepEqual(s.running, ["j1"]);
});

test("completeJob: moves to completed", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  s = startJob(s, "j1");
  s = completeJob(s, "j1");
  assert.equal(s.running.length, 0);
  assert.deepEqual(s.completed, ["j1"]);
});

test("pendingJobs: with unmet deps", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: ["j2"] });
  s = enqueue(s, { id: "j2", priority: "normal", payload: {}, ts: 2, dependsOn: [] });
  // j1 has unmet dep (j2 not completed)
  // j2 has no deps, so it would be pickable
  const p = pendingJobs(s);
  // pendingJobs returns jobs with unmet deps → just j1
  assert.equal(p.length, 1);
  assert.equal(p[0].id, "j1");
});

test("jobStatus: returns state", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  assert.equal(jobStatus(s, "j1"), "queued");
  s = startJob(s, "j1");
  assert.equal(jobStatus(s, "j1"), "running");
  s = completeJob(s, "j1");
  assert.equal(jobStatus(s, "j1"), "completed");
  assert.equal(jobStatus(s, "unknown"), "unknown");
});

test("schedulerThroughput: 1.0 empty", () => {
  assert.equal(schedulerThroughput(createTaskScheduler()), 1.0);
});

test("schedulerThroughput: ratio", () => {
  let s = createTaskScheduler();
  s = enqueue(s, { id: "j1", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  s = startJob(s, "j1");
  s = completeJob(s, "j1");
  s = enqueue(s, { id: "j2", priority: "normal", payload: {}, ts: 1, dependsOn: [] });
  assert.equal(schedulerThroughput(s), 0.5);
});
