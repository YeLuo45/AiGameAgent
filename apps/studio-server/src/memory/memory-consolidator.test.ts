// V8 MemoryConsolidator (Direction A 8/30, nanobot) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectTheme,
  consolidate,
  findRepeatingThemes,
  consolidationYield,
} from "./memory-consolidator.js";
import { createL3AgentMemory, addNote } from "./l3-agent-memory.js";
import { createL4PatternMemory } from "./l4-pattern-memory.js";

test("detectTheme: success-pattern", () => {
  assert.equal(detectTheme("this worked perfectly"), "success-pattern");
  assert.equal(detectTheme("test passed"), "success-pattern");
});

test("detectTheme: failure-pattern", () => {
  assert.equal(detectTheme("test failed with error"), "failure-pattern");
  assert.equal(detectTheme("the code broke"), "failure-pattern");
});

test("detectTheme: preference", () => {
  assert.equal(detectTheme("I prefer dark mode"), "preference");
  assert.equal(detectTheme("I love this style"), "preference");
});

test("detectTheme: stylistic", () => {
  assert.equal(detectTheme("use casual tone"), "stylistic");
  assert.equal(detectTheme("keep the format consistent"), "stylistic");
});

test("detectTheme: domain", () => {
  assert.equal(detectTheme("we need better physics"), "domain");
  assert.equal(detectTheme("the game is slow"), "domain");
});

test("detectTheme: null for neutral text", () => {
  assert.equal(detectTheme("just a normal note"), null);
});

test("consolidate: empty inputs", () => {
  const r = consolidate(createL3AgentMemory("a1"), createL4PatternMemory());
  assert.equal(r.result.patternsFound, 0);
  assert.equal(r.result.patternsRecorded, 0);
});

test("consolidate: extracts patterns from notes", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "decision", "use dark mode - user prefers it");
  l3 = addNote(l3, "context", "test passed first time");
  l3 = addNote(l3, "task", "the build broke with an error");
  const r = consolidate(l3, createL4PatternMemory());
  assert.equal(r.result.patternsRecorded, 3);
  assert.equal(Object.keys(r.layer4.patterns).length, 3);
});

test("consolidate: deduplicates by category+key", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "decision", "prefer dark mode");
  l3 = addNote(l3, "decision", "prefer dark mode");
  const r = consolidate(l3, createL4PatternMemory());
  // Same key → one pattern, but observations increment
  assert.equal(r.result.patternsRecorded, 2);
  assert.equal(Object.keys(r.layer4.patterns).length, 1);
});

test("consolidate: ignores non-themed notes", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "task", "do the thing");
  const r = consolidate(l3, createL4PatternMemory());
  assert.equal(r.result.patternsRecorded, 0);
});

test("findRepeatingThemes: returns themes with ≥2 occurrences", () => {
  let l3 = createL3AgentMemory("a1");
  l3 = addNote(l3, "decision", "prefer dark");
  l3 = addNote(l3, "decision", "prefer light");
  l3 = addNote(l3, "task", "fix the bug");
  l3 = addNote(l3, "task", "the bug is critical");
  const themes = findRepeatingThemes(l3, 2);
  assert.ok(themes.includes("preference"));
  assert.ok(themes.includes("failure-pattern"));
});

test("findRepeatingThemes: empty = empty", () => {
  assert.deepEqual(findRepeatingThemes(createL3AgentMemory("a1"), 2), []);
});

test("consolidationYield: 0 empty", () => {
  assert.equal(consolidationYield({ patternsFound: 0, patternsRecorded: 0, notesConsumed: 0, categories: [] }, 0), 0);
});

test("consolidationYield: ratio", () => {
  assert.equal(consolidationYield({ patternsFound: 5, patternsRecorded: 5, notesConsumed: 5, categories: ["x"] }, 10), 0.5);
});
