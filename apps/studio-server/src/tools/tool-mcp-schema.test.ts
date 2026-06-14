// V29 ToolMCPSchema (Direction B 29/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateJsonSchema,
  buildStringSchema,
  schemaCoverage,
} from "./tool-mcp-schema.js";

test("validateJsonSchema: string valid", () => {
  const r = validateJsonSchema({ type: "string" }, "hello");
  assert.equal(r.valid, true);
});

test("validateJsonSchema: string type mismatch", () => {
  const r = validateJsonSchema({ type: "string" }, 123);
  assert.equal(r.valid, false);
});

test("validateJsonSchema: number valid", () => {
  assert.equal(validateJsonSchema({ type: "number" }, 3.14).valid, true);
});

test("validateJsonSchema: integer requires integer", () => {
  assert.equal(validateJsonSchema({ type: "integer" }, 3.14).valid, false);
  assert.equal(validateJsonSchema({ type: "integer" }, 3).valid, true);
});

test("validateJsonSchema: object with required", () => {
  const schema = { type: "object" as const, required: ["name"], properties: { name: { type: "string" as const } } };
  assert.equal(validateJsonSchema(schema, { name: "x" }).valid, true);
  assert.equal(validateJsonSchema(schema, {}).valid, false);
});

test("validateJsonSchema: nested object", () => {
  const schema = { type: "object" as const, properties: { inner: { type: "object" as const, properties: { x: { type: "number" as const } } } } };
  assert.equal(validateJsonSchema(schema, { inner: { x: 1 } }).valid, true);
  assert.equal(validateJsonSchema(schema, { inner: { x: "y" } }).valid, false);
});

test("validateJsonSchema: array of items", () => {
  const schema = { type: "array" as const, items: { type: "number" as const } };
  assert.equal(validateJsonSchema(schema, [1, 2, 3]).valid, true);
  assert.equal(validateJsonSchema(schema, [1, "x"]).valid, false);
});

test("validateJsonSchema: enum check", () => {
  const schema = { type: "string" as const, enum: ["a", "b", "c"] };
  assert.equal(validateJsonSchema(schema, "a").valid, true);
  assert.equal(validateJsonSchema(schema, "z").valid, false);
});

test("validateJsonSchema: number min/max", () => {
  const schema = { type: "number" as const, minimum: 0, maximum: 10 };
  assert.equal(validateJsonSchema(schema, 5).valid, true);
  assert.equal(validateJsonSchema(schema, -1).valid, false);
  assert.equal(validateJsonSchema(schema, 11).valid, false);
});

test("validateJsonSchema: string minLength/maxLength", () => {
  const schema = { type: "string" as const, minLength: 3, maxLength: 5 };
  assert.equal(validateJsonSchema(schema, "ab").valid, false);
  assert.equal(validateJsonSchema(schema, "abcde").valid, true);
  assert.equal(validateJsonSchema(schema, "abcdef").valid, false);
});

test("validateJsonSchema: string pattern", () => {
  const schema = { type: "string" as const, pattern: "^[a-z]+$" };
  assert.equal(validateJsonSchema(schema, "abc").valid, true);
  assert.equal(validateJsonSchema(schema, "ABC").valid, false);
});

test("validateJsonSchema: null type", () => {
  assert.equal(validateJsonSchema({ type: "null" }, null).valid, true);
  assert.equal(validateJsonSchema({ type: "null" }, "x").valid, false);
});

test("validateJsonSchema: boolean", () => {
  assert.equal(validateJsonSchema({ type: "boolean" }, true).valid, true);
  assert.equal(validateJsonSchema({ type: "boolean" }, "true").valid, false);
});

test("buildStringSchema: defaults", () => {
  const s = buildStringSchema();
  assert.equal(s.type, "string");
});

test("buildStringSchema: with options", () => {
  const s = buildStringSchema({ minLength: 3, pattern: "^[a-z]+$" });
  assert.equal(s.minLength, 3);
  assert.equal(s.pattern, "^[a-z]+$");
});

test("schemaCoverage: 1.0 for valid", () => {
  assert.equal(schemaCoverage({ type: "string" }, "x"), 1.0);
});

test("schemaCoverage: 0 for invalid", () => {
  assert.equal(schemaCoverage({ type: "string" }, 123), 0);
});
