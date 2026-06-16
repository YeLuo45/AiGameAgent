// V14 LogAggregator (Direction F 14/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLogAggregator, appendLog, getByLevel, getBySource, getByTrace, countErrors, clearLogs, logHealth } from "./log-aggregator.js";

test("createLogAggregator: empty", () => {
  const s = createLogAggregator();
  assert.equal(s.entries.length, 0);
  assert.equal(s.nextId, 1);
});

test("appendLog: adds entry + updates indexes", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "auth", "user logged in");
  assert.equal(s.entries.length, 1);
  assert.equal(s.byLevel.info, 1);
  assert.equal(s.bySource.auth, 1);
});

test("appendLog: trace index", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "y", {}, null, "t1");
  assert.equal(s.byTrace.t1, 1);
});

test("appendLog: no trace = no index", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "y");
  assert.equal(Object.keys(s.byTrace).length, 0);
});

test("appendLog: maxEntries evicts", () => {
  let s = createLogAggregator(2);
  s = appendLog(s, "info", "x", "1");
  s = appendLog(s, "info", "x", "2");
  s = appendLog(s, "info", "x", "3");
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0].message, "2");
});

test("getByLevel: filters", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "1");
  s = appendLog(s, "error", "x", "2");
  s = appendLog(s, "warn", "x", "3");
  assert.equal(getByLevel(s, "error").length, 1);
  assert.equal(getByLevel(s, "warn").length, 1);
});

test("getBySource: filters", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "auth", "1");
  s = appendLog(s, "info", "db", "2");
  assert.equal(getBySource(s, "auth").length, 1);
});

test("getByTrace: filters", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "1", {}, null, "t1");
  s = appendLog(s, "info", "x", "2", {}, null, "t1");
  s = appendLog(s, "info", "x", "3", {}, null, "t2");
  assert.equal(getByTrace(s, "t1").length, 2);
});

test("countErrors: error + fatal", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "y");
  s = appendLog(s, "error", "x", "y");
  s = appendLog(s, "fatal", "x", "y");
  s = appendLog(s, "warn", "x", "y");
  assert.equal(countErrors(s), 2);
});

test("clearLogs: resets", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "y");
  s = clearLogs(s);
  assert.equal(s.entries.length, 0);
});

test("logHealth: 1.0 for empty", () => {
  assert.equal(logHealth(createLogAggregator()), 1.0);
});

test("logHealth: 0.5 for 50% errors", () => {
  let s = createLogAggregator();
  s = appendLog(s, "info", "x", "1");
  s = appendLog(s, "error", "x", "2");
  assert.equal(logHealth(s), 0.5);
});
