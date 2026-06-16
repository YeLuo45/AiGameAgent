// V13 LogFilter (Direction F 13/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, filterLogs, parseFilterSpec, filterSpecificity } from "./log-filter.js";
import { createEntry } from "./structured-log.js";

const e1 = createEntry(1, "info", "auth", "user logged in", { user: "alice" });
const e2 = createEntry(2, "error", "db", "query failed", { sql: "SELECT 1" }, "ConnectionError", "t1");

test("matchesFilter: minLevel", () => {
  assert.equal(matchesFilter(e1, { minLevel: "warn" }), false);
  assert.equal(matchesFilter(e2, { minLevel: "warn" }), true);
});

test("matchesFilter: sources", () => {
  assert.equal(matchesFilter(e1, { sources: ["auth"] }), true);
  assert.equal(matchesFilter(e1, { sources: ["db"] }), false);
});

test("matchesFilter: messagePattern case-insensitive", () => {
  assert.equal(matchesFilter(e1, { messagePattern: "LOGGED" }), true);
  assert.equal(matchesFilter(e1, { messagePattern: "nope" }), false);
});

test("matchesFilter: fieldMatches", () => {
  assert.equal(matchesFilter(e1, { fieldMatches: { user: "alice" } }), true);
  assert.equal(matchesFilter(e1, { fieldMatches: { user: "bob" } }), false);
});

test("matchesFilter: traceId", () => {
  assert.equal(matchesFilter(e2, { traceId: "t1" }), true);
  assert.equal(matchesFilter(e2, { traceId: "t2" }), false);
});

test("matchesFilter: errorsOnly", () => {
  assert.equal(matchesFilter(e1, { errorsOnly: true }), false);
  assert.equal(matchesFilter(e2, { errorsOnly: true }), true);
});

test("filterLogs: combined", () => {
  const filtered = filterLogs([e1, e2], { minLevel: "error" });
  assert.equal(filtered.length, 1);
});

test("parseFilterSpec: level=warn source=auth errors", () => {
  const c = parseFilterSpec("level=warn source=auth errors");
  assert.equal(c.minLevel, "warn");
  assert.deepEqual(c.sources, ["auth"]);
  assert.equal(c.errorsOnly, true);
});

test("parseFilterSpec: trace=t1", () => {
  const c = parseFilterSpec("trace=t1");
  assert.equal(c.traceId, "t1");
});

test("parseFilterSpec: msg=hello", () => {
  const c = parseFilterSpec("msg=hello");
  assert.equal(c.messagePattern, "hello");
});

test("filterSpecificity: 0 empty", () => {
  assert.equal(filterSpecificity({}), 0);
});

test("filterSpecificity: 1.0 with all", () => {
  assert.equal(filterSpecificity({ minLevel: "warn", sources: ["x"], messagePattern: "y", fieldMatches: { a: 1 }, traceId: "t", errorsOnly: true }), 1.0);
});
