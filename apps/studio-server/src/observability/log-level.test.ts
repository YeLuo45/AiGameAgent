// V11 LogLevel (Direction F 11/30, thunderbolt) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { levelRank, levelAtLeast, parseLevel, isValidLevel, levelDistribution } from "./log-level.js";

test("levelRank: ascending", () => {
  assert.ok(levelRank("debug") < levelRank("info"));
  assert.ok(levelRank("info") < levelRank("warn"));
  assert.ok(levelRank("warn") < levelRank("error"));
  assert.ok(levelRank("error") < levelRank("fatal"));
});

test("levelAtLeast: true when meets threshold", () => {
  assert.equal(levelAtLeast("error", "warn"), true);
  assert.equal(levelAtLeast("warn", "warn"), true);
  assert.equal(levelAtLeast("info", "warn"), false);
  assert.equal(levelAtLeast("debug", "debug"), true);
});

test("parseLevel: valid", () => {
  assert.equal(parseLevel("INFO"), "info");
  assert.equal(parseLevel("  Error  "), "error");
  assert.equal(parseLevel("debug"), "debug");
});

test("parseLevel: invalid = null", () => {
  assert.equal(parseLevel(""), null);
  assert.equal(parseLevel("trace"), null);
  assert.equal(parseLevel("12"), null);
});

test("isValidLevel: alias", () => {
  assert.equal(isValidLevel("info"), true);
  assert.equal(isValidLevel("xyz"), false);
});

test("levelDistribution: 1.0 for empty", () => {
  assert.equal(levelDistribution([]), 1.0);
});

test("levelDistribution: max ratio", () => {
  assert.equal(levelDistribution(["info", "info", "error", "info"]), 0.75);
  assert.equal(levelDistribution(["warn", "error"]), 0.5);
});
