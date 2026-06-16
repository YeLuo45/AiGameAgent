// V12 StructuredLog (Direction F 12/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEntry, serialize, deserialize, structureQuality } from "./structured-log.js";

test("createEntry: defaults", () => {
  const e = createEntry(1, "info", "auth", "user logged in");
  assert.equal(e.id, 1);
  assert.equal(e.level, "info");
  assert.equal(e.source, "auth");
  assert.equal(e.message, "user logged in");
  assert.deepEqual(e.fields, {});
  assert.equal(e.error, null);
});

test("createEntry: with fields + error + trace", () => {
  const e = createEntry(1, "error", "db", "query failed", { sql: "SELECT 1" }, "ConnectionError", "trace-123");
  assert.deepEqual(e.fields, { sql: "SELECT 1" });
  assert.equal(e.error, "ConnectionError");
  assert.equal(e.traceId, "trace-123");
});

test("serialize: roundtrip-able", () => {
  const e = createEntry(1, "warn", "scheduler", "timeout", { duration: 5000 }, null, "abc-123");
  const s = serialize(e);
  assert.ok(s.includes("ts="));
  assert.ok(s.includes("level=warn"));
  assert.ok(s.includes("source=scheduler"));
  assert.ok(s.includes("trace=abc-123"));
  assert.ok(s.includes('msg="timeout"'));
});

test("serialize: skips empty error/trace", () => {
  const e = createEntry(1, "info", "x", "msg");
  const s = serialize(e);
  assert.ok(!s.includes("error="));
  assert.ok(!s.includes("trace="));
});

test("deserialize: extracts basic fields", () => {
  const e = createEntry(1, "info", "auth", "login", {}, null, null, 1234);
  const s = serialize(e);
  const d = deserialize(s);
  assert.equal(d?.ts, 1234);
  assert.equal(d?.level, "info");
  assert.equal(d?.source, "auth");
  assert.equal(d?.message, "login");
});

test("deserialize: invalid = null", () => {
  assert.equal(deserialize("not a log line"), null);
});

test("structureQuality: 1.0 for empty", () => {
  assert.equal(structureQuality([]), 1.0);
});

test("structureQuality: ratio with fields", () => {
  const a = createEntry(1, "info", "x", "y", { a: 1 });
  const b = createEntry(2, "info", "x", "y");
  assert.equal(structureQuality([a, b]), 0.5);
});
