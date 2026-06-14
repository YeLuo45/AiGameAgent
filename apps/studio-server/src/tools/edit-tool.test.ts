// V20 EditTool (Direction B 20/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { editFile, validateEditRequest } from "./edit-tool.js";

test("editFile: replace-first occurrence", () => {
  const r = editFile({ path: "/a", find: "foo", replace: "bar", mode: "replace-first" }, "foo foo foo");
  assert.equal(r.ok, true);
  assert.equal(r.replacements, 1);
  assert.equal(r.newContent, "bar foo foo");
});

test("editFile: replace-first when not found", () => {
  const r = editFile({ path: "/a", find: "x", replace: "y", mode: "replace-first" }, "foo");
  assert.equal(r.ok, false);
  assert.equal(r.modified, false);
});

test("editFile: replace-all", () => {
  const r = editFile({ path: "/a", find: "foo", replace: "bar", mode: "replace-all" }, "foo foo foo");
  assert.equal(r.replacements, 3);
  assert.equal(r.newContent, "bar bar bar");
});

test("editFile: insert-after", () => {
  const r = editFile({ path: "/a", find: "X", replace: "Y", mode: "insert-after" }, "AXB");
  assert.equal(r.newContent, "AXYB");
});

test("editFile: insert-before", () => {
  const r = editFile({ path: "/a", find: "X", replace: "Y", mode: "insert-before" }, "AXB");
  assert.equal(r.newContent, "AYXB");
});

test("editFile: not found for insert modes", () => {
  const r = editFile({ path: "/a", find: "Z", replace: "X", mode: "insert-after" }, "abc");
  assert.equal(r.ok, false);
});

test("validateEditRequest: valid", () => {
  assert.equal(validateEditRequest({ path: "/a", find: "x", replace: "y", mode: "replace-first" }).valid, true);
});

test("validateEditRequest: missing path", () => {
  assert.equal(validateEditRequest({ path: "", find: "x", replace: "y", mode: "replace-first" }).valid, false);
});

test("validateEditRequest: missing find", () => {
  assert.equal(validateEditRequest({ path: "/a", find: "", replace: "y", mode: "replace-first" }).valid, false);
});
