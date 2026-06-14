// V23 AdapterSharing (Direction E 23/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAdapterSharing,
  addSharedAdapter,
  removeFromProject,
  projectsWithAccess,
  sharedAdapterCount,
  setSharedHealth,
  getSharedHealth,
  sharingEfficiency,
} from "./adapter-sharing.js";
import { createHealthState } from "./health-checker.js";
import type { ChannelAdapter } from "./channel-adapter.js";

function makeAdapter(id: string): ChannelAdapter {
  return {
    id, type: "openai", capabilities: ["text"],
    baseUrl: "http://x", defaultModel: "m",
    chat: async () => ({ ok: true, chunks: [], text: "", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, firstChunkMs: 0, totalMs: 0 }),
    health: async () => ({ ok: true, firstChunkMs: 0, model: "m" }),
    close: async () => {},
  };
}

test("createAdapterSharing: empty", () => {
  const s = createAdapterSharing();
  assert.equal(sharedAdapterCount(s), 0);
  assert.equal(Object.keys(s.healthById).length, 0);
});

test("addSharedAdapter: first project", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  assert.equal(sharedAdapterCount(s), 1);
  assert.deepEqual(projectsWithAccess(s, "a1"), ["p1"]);
});

test("addSharedAdapter: second project", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  s = addSharedAdapter(s, makeAdapter("a1"), "p2");
  assert.deepEqual(projectsWithAccess(s, "a1"), ["p1", "p2"]);
});

test("addSharedAdapter: same project = no-op", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  const s1 = addSharedAdapter(s, makeAdapter("a1"), "p1");
  assert.equal(s1, s);
});

test("removeFromProject: removes but keeps adapter if other projects", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  s = addSharedAdapter(s, makeAdapter("a1"), "p2");
  s = removeFromProject(s, "a1", "p1");
  assert.equal(sharedAdapterCount(s), 1);
  assert.deepEqual(projectsWithAccess(s, "a1"), ["p2"]);
});

test("removeFromProject: removes entirely when last project", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  s = removeFromProject(s, "a1", "p1");
  assert.equal(sharedAdapterCount(s), 0);
});

test("removeFromProject: no-op for missing", () => {
  const s = createAdapterSharing();
  const s1 = removeFromProject(s, "nope", "p1");
  assert.equal(s1, s);
});

test("projectsWithAccess: empty for missing", () => {
  assert.deepEqual(projectsWithAccess(createAdapterSharing(), "x"), []);
});

test("setSharedHealth + getSharedHealth", () => {
  let s = createAdapterSharing();
  const h = createHealthState("a1");
  s = setSharedHealth(s, h);
  assert.equal(getSharedHealth(s, "a1")?.providerId, "a1");
  assert.equal(getSharedHealth(s, "nope"), undefined);
});

test("sharingEfficiency: empty = 0", () => {
  assert.equal(sharingEfficiency(createAdapterSharing()), 0);
});

test("sharingEfficiency: 1 project = 0.333", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  // 1/3 = 0.333
  assert.ok(Math.abs(sharingEfficiency(s) - 0.3333333333333333) < 1e-9);
});

test("sharingEfficiency: 3 projects = 1.0", () => {
  let s = createAdapterSharing();
  s = addSharedAdapter(s, makeAdapter("a1"), "p1");
  s = addSharedAdapter(s, makeAdapter("a1"), "p2");
  s = addSharedAdapter(s, makeAdapter("a1"), "p3");
  assert.equal(sharingEfficiency(s), 1.0);
});
