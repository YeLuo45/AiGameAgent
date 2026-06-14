// V18 ReadTool (Direction B 18/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  readAll,
  validateReadRequest,
} from "./read-tool.js";

test("readFile: whole file", () => {
  const r = readFile({ path: "/a" }, ["a", "b", "c"]);
  assert.equal(r.content, "a\nb\nc");
  assert.equal(r.truncated, false);
  assert.equal(r.startLine, 0);
  assert.equal(r.endLine, 2);
});

test("readFile: with offset", () => {
  const r = readFile({ path: "/a", offset: 1 }, ["a", "b", "c"]);
  assert.equal(r.content, "b\nc");
  assert.equal(r.startLine, 1);
});

test("readFile: with limit", () => {
  const r = readFile({ path: "/a", limit: 2 }, ["a", "b", "c"]);
  assert.equal(r.content, "a\nb");
  assert.equal(r.truncated, true);
  assert.equal(r.endLine, 1);
});

test("readFile: offset + limit", () => {
  const r = readFile({ path: "/a", offset: 1, limit: 1 }, ["a", "b", "c", "d"]);
  assert.equal(r.content, "b");
  assert.equal(r.truncated, true);
});

test("readFile: offset beyond end = empty", () => {
  const r = readFile({ path: "/a", offset: 10 }, ["a", "b"]);
  assert.equal(r.content, "");
  assert.equal(r.startLine, 10);
});

test("readAll: full content", () => {
  const r = readAll("hello\nworld");
  assert.equal(r.content, "hello\nworld");
  assert.equal(r.size, 11);
});

test("validateReadRequest: valid", () => {
  assert.equal(validateReadRequest({ path: "/a" }).valid, true);
});

test("validateReadRequest: missing path", () => {
  assert.equal(validateReadRequest({ path: "" }).valid, false);
});

test("validateReadRequest: negative offset", () => {
  assert.equal(validateReadRequest({ path: "/a", offset: -1 }).valid, false);
});

test("validateReadRequest: non-positive limit", () => {
  assert.equal(validateReadRequest({ path: "/a", limit: 0 }).valid, false);
  assert.equal(validateReadRequest({ path: "/a", limit: -1 }).valid, false);
});
