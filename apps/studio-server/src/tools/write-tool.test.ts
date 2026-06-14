// V19 WriteTool (Direction B 19/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile, validateWriteRequest } from "./write-tool.js";

test("writeFile: create new", () => {
  const r = writeFile({ path: "/a", content: "hello", mode: "create" }, null);
  assert.equal(r.ok, true);
  assert.equal(r.bytesWritten, 5);
  assert.equal(r.created, true);
});

test("writeFile: create fails if exists", () => {
  const r = writeFile({ path: "/a", content: "x", mode: "create" }, "existing");
  assert.equal(r.ok, false);
  assert.equal(r.created, false);
});

test("writeFile: overwrite replaces", () => {
  const r = writeFile({ path: "/a", content: "new", mode: "overwrite" }, "old content");
  assert.equal(r.ok, true);
  assert.equal(r.bytesWritten, 3);
  assert.equal(r.totalSize, 3);
  assert.equal(r.created, false);
});

test("writeFile: append extends", () => {
  const r = writeFile({ path: "/a", content: " world", mode: "append" }, "hello");
  assert.equal(r.totalSize, 11);
  assert.equal(r.bytesWritten, 6);
});

test("writeFile: append to empty file", () => {
  const r = writeFile({ path: "/a", content: "x", mode: "append" }, null);
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  assert.equal(r.totalSize, 1);
});

test("writeFile: overwrite on empty file", () => {
  const r = writeFile({ path: "/a", content: "x", mode: "overwrite" }, null);
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
});

test("validateWriteRequest: valid", () => {
  assert.equal(validateWriteRequest({ path: "/a", content: "x", mode: "create" }).valid, true);
});

test("validateWriteRequest: missing path", () => {
  assert.equal(validateWriteRequest({ path: "", content: "x", mode: "create" }).valid, false);
});

test("validateWriteRequest: missing content", () => {
  const r = validateWriteRequest({ path: "/a", content: undefined as unknown as string, mode: "create" });
  assert.equal(r.valid, false);
});
