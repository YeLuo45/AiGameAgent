// V21 GlobTool (Direction B 21/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { glob, globToRegex } from "./glob-tool.js";

test("glob: exact match", () => {
  const r = glob({ pattern: "foo.txt" }, ["foo.txt", "bar.txt", "foo.ts"]);
  assert.deepEqual(r.matches, ["foo.txt"]);
});

test("glob: wildcard *", () => {
  const r = glob({ pattern: "*.ts" }, ["foo.ts", "bar.ts", "foo.txt", "bar.js"]);
  assert.deepEqual(r.matches, ["foo.ts", "bar.ts"]);
});

test("glob: question mark", () => {
  const r = glob({ pattern: "a?c" }, ["abc", "axc", "aXc", "ac"]);
  // "a?c" matches 3-char strings starting with 'a' and ending with 'c' (any middle char)
  assert.equal(r.matches.length, 3);
});

test("glob: hidden files excluded by default", () => {
  const r = glob({ pattern: "*" }, [".hidden", "visible", "another"]);
  assert.deepEqual(r.matches.sort(), ["another", "visible"]);
});

test("glob: hidden files included when flag set", () => {
  const r = glob({ pattern: "*", includeHidden: true }, [".hidden", "visible"]);
  assert.equal(r.matches.length, 2);
});

test("glob: full path basename match", () => {
  const r = glob({ pattern: "*.ts" }, ["src/foo.ts", "tests/bar.ts", "README.md"]);
  assert.deepEqual(r.matches, ["src/foo.ts", "tests/bar.ts"]);
});

test("glob: maxResults truncation", () => {
  const r = glob({ pattern: "*.ts", maxResults: 2 }, ["a.ts", "b.ts", "c.ts", "d.ts"]);
  assert.equal(r.matches.length, 2);
  assert.equal(r.truncated, true);
  assert.equal(r.totalMatches, 4);
});

test("glob: no match", () => {
  const r = glob({ pattern: "*.x" }, ["a.ts", "b.ts"]);
  assert.equal(r.matches.length, 0);
  assert.equal(r.truncated, false);
});

test("globToRegex: escapes special chars", () => {
  const re = globToRegex("a.b+c");
  assert.ok(re.test("a.b+c"));
  assert.ok(!re.test("axbxc"));
});
