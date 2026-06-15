// V2 GateCondition (Direction C 2/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkGate,
  ideationGate,
  architectureGate,
  designGate,
  productionGate,
  polishGate,
  releaseGate,
  gateForPhase,
  gateStrictness,
} from "./gate-condition.js";

test("checkGate: string valid", () => {
  const r = checkGate({ type: "string" }, "hello");
  assert.equal(r.passed, true);
});

test("checkGate: string type mismatch", () => {
  const r = checkGate({ type: "string" }, 123);
  assert.equal(r.passed, false);
});

test("checkGate: object required fields", () => {
  const schema = { type: "object" as const, required: ["x", "y"], properties: { x: { type: "string" as const }, y: { type: "number" as const } } };
  assert.equal(checkGate(schema, { x: "a", y: 1 }).passed, true);
  const r = checkGate(schema, { x: "a" });
  assert.equal(r.passed, false);
  assert.deepEqual(r.missingFields, ["y"]);
});

test("checkGate: array items", () => {
  const schema = { type: "array" as const, items: { type: "string" as const }, min: 2 };
  assert.equal(checkGate(schema, ["a", "b", "c"]).passed, true);
  assert.equal(checkGate(schema, ["a"]).passed, false);
});

test("checkGate: string min length", () => {
  const r = checkGate({ type: "string", min: 5 }, "abc");
  assert.equal(r.passed, false);
});

test("checkGate: string max length", () => {
  const r = checkGate({ type: "string", max: 3 }, "abcde");
  assert.equal(r.passed, false);
});

test("checkGate: string pattern", () => {
  const r = checkGate({ type: "string", pattern: "^v\\d+$" }, "v1");
  assert.equal(r.passed, true);
  const r2 = checkGate({ type: "string", pattern: "^v\\d+$" }, "x1");
  assert.equal(r2.passed, false);
});

test("checkGate: enum", () => {
  const r = checkGate({ type: "string", enum: ["a", "b"] }, "c");
  assert.equal(r.passed, false);
});

test("checkGate: null type", () => {
  assert.equal(checkGate({ type: "null" }, null).passed, true);
  assert.equal(checkGate({ type: "null" }, "x").passed, false);
});

test("checkGate: nested object error path", () => {
  const schema = { type: "object" as const, properties: { inner: { type: "object" as const, properties: { x: { type: "number" as const } } } } };
  const r = checkGate(schema, { inner: { x: "not a number" } });
  assert.equal(r.passed, false);
  assert.ok(r.errors[0].includes("inner."));
});

test("ideationGate: valid", () => {
  const r = checkGate(ideationGate(), { idea: "a game about cats", pitch: "Play as a cat collecting fish in a small village" });
  assert.equal(r.passed, true);
});

test("ideationGate: too short idea", () => {
  const r = checkGate(ideationGate(), { idea: "short", pitch: "this is a long enough pitch for sure" });
  assert.equal(r.passed, false);
});

test("architectureGate: valid", () => {
  const r = checkGate(architectureGate(), { engine: "phaser", platforms: ["web"] });
  assert.equal(r.passed, true);
});

test("architectureGate: bad engine", () => {
  const r = checkGate(architectureGate(), { engine: "unity", platforms: ["web"] });
  assert.equal(r.passed, false);
});

test("designGate: needs systems", () => {
  const r = checkGate(designGate(), { systems: [] });
  assert.equal(r.passed, false);
  assert.equal(checkGate(designGate(), { systems: [{}] }).passed, true);
});

test("productionGate: needs artifacts", () => {
  assert.equal(checkGate(productionGate(), { artifacts: [] }).passed, false);
  assert.equal(checkGate(productionGate(), { artifacts: ["a.ts"] }).passed, true);
});

test("polishGate: needs testReport", () => {
  assert.equal(checkGate(polishGate(), { testReport: {} }).passed, true);
  assert.equal(checkGate(polishGate(), {}).passed, false);
});

test("releaseGate: needs semver", () => {
  const r = checkGate(releaseGate(), { version: "1.0.0", platforms: ["web"] });
  assert.equal(r.passed, true);
  const r2 = checkGate(releaseGate(), { version: "1.0", platforms: ["web"] });
  assert.equal(r2.passed, false);
});

test("gateForPhase: all 6 phases", () => {
  for (const p of ["ideation", "architecture", "design", "production", "polish", "release"]) {
    assert.ok(gateForPhase(p) !== null);
  }
  assert.equal(gateForPhase("unknown"), null);
});

test("gateStrictness: minimal schema", () => {
  assert.equal(gateStrictness({ type: "string" }), 0.2);
});

test("gateStrictness: complex schema = high", () => {
  const s = gateForPhase("release")!;
  // All release gate schemas are at 0.6 (type + required + properties + enum/pattern)
  assert.ok(gateStrictness(s) > 0.5, `expected > 0.5, got ${gateStrictness(s)}`);
});
