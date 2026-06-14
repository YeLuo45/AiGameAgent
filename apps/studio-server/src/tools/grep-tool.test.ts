// V22 GrepTool (Direction B 22/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { grep } from "./grep-tool.js";

test("grep: simple substring match", () => {
  const r = grep({ pattern: "foo" }, { "a.txt": ["foo", "bar", "foobar"] });
  assert.equal(r.matches.length, 2);
  assert.equal(r.matches[0].text, "foo");
  assert.equal(r.matches[1].text, "foobar");
});

test("grep: case insensitive", () => {
  const r = grep({ pattern: "FOO", caseInsensitive: true }, { "a.txt": ["foo", "FOO", "FoO"] });
  assert.equal(r.matches.length, 3);
});

test("grep: case sensitive (default)", () => {
  const r = grep({ pattern: "FOO" }, { "a.txt": ["foo", "FOO", "FoO"] });
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].text, "FOO");
});

test("grep: regex mode", () => {
  const r = grep({ pattern: "^\\d+$", regex: true }, { "a.txt": ["123", "abc", "456"] });
  assert.equal(r.matches.length, 2);
});

test("grep: showLineNumbers (1-indexed)", () => {
  const r = grep({ pattern: "x", showLineNumbers: true }, { "a.txt": ["x", "y", "x"] });
  assert.equal(r.matches[0].line, 1);
  assert.equal(r.matches[1].line, 3);
});

test("grep: maxResults truncation", () => {
  const r = grep({ pattern: "x", maxResults: 2 }, { "a.txt": ["x", "x", "x", "x"] });
  assert.equal(r.matches.length, 2);
  assert.equal(r.truncated, true);
  assert.equal(r.totalMatches, 4);
});

test("grep: multiple files", () => {
  const r = grep({ pattern: "x" }, { "a.txt": ["x"], "b.txt": ["x", "x"] });
  assert.equal(r.matches.length, 3);
});

test("grep: no matches", () => {
  const r = grep({ pattern: "x" }, { "a.txt": ["y", "z"] });
  assert.equal(r.matches.length, 0);
});
